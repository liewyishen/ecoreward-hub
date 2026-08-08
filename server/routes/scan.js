const express = require('express');
const router = express.Router();
const multer = require('multer');
const path = require('path');
const fs = require('fs');
const db = require('../config/db');
const verifyToken = require('../middleware/verifyToken');
const { analyzeWasteItem } = require('../config/gemini');

// Create uploads directory if it doesn't exist
const uploadsDir = path.join(__dirname, '../uploads');
if (!fs.existsSync(uploadsDir)) {
  fs.mkdirSync(uploadsDir, { recursive: true });
}

// Configure multer for file uploads
const storage = multer.diskStorage({
  destination: (req, file, cb) => {
    cb(null, uploadsDir);
  },
  filename: (req, file, cb) => {
    // Format: scan_YYYYMMDD_HHMMSS_userid.jpg
    const date = new Date();
    const timestamp = date
      .toISOString()
      .replace(/[-:]/g, '')
      .replace('T', '_')
      .split('.')[0];
    const userId = req.user?.user_id || 'unknown';
    const ext = path.extname(file.originalname);
    cb(null, `scan_${timestamp}_${userId}${ext}`);
  },
});

// File filter - only accept images
const fileFilter = (req, file, cb) => {
  const allowedTypes = ['image/jpeg', 'image/jpg', 'image/png'];
  if (allowedTypes.includes(file.mimetype)) {
    cb(null, true);
  } else {
    cb(new Error('Invalid file type. Only JPG and PNG are allowed.'), false);
  }
};

// Multer upload configuration
const upload = multer({
  storage,
  fileFilter,
  limits: {
    fileSize: 5 * 1024 * 1024, // 5MB max
  },
});

/**
 * POST /api/scan/analyze
 * Analyze uploaded waste item image using Gemini AI
 * NEW: Only returns analysis result, does NOT save to database or award points
 * Requires: JWT authentication, image file
 */
router.post('/analyze', verifyToken, upload.single('image'), async (req, res) => {
  try {
    // Check if file was uploaded
    if (!req.file) {
      return res.status(400).json({
        success: false,
        message: 'No image file provided',
      });
    }

    const imagePath = req.file.path;
    const imageUrl = `/uploads/${req.file.filename}`;

    // Step 1: Analyze image with Gemini AI
    console.log('📸 Analyzing image with Gemini AI...');
    const aiResult = await analyzeWasteItem(imagePath);

    if (!aiResult.success) {
      return res.status(500).json({
        success: false,
        message: 'AI analysis failed: ' + aiResult.error,
        data: aiResult.data, // Return fallback data
      });
    }

    const { type, subtype, confidence, recyclable, tips } = aiResult.data;

    // Step 2: Get base points for item type from database
    const [itemTypeRows] = await db.execute(
      'SELECT base_points FROM item_type_stats WHERE item_type = ?',
      [type]
    );

    let basePoints = 10; // Default points
    if (itemTypeRows.length > 0) {
      basePoints = itemTypeRows[0].base_points;
    }

    // Step 3: Calculate earned points (base * confidence, rounded)
    const pointsEarned = Math.round(basePoints * confidence);

    console.log(`✅ AI Analysis complete: ${type} - ${subtype} (${(confidence * 100).toFixed(0)}% confidence)`);

    // Step 4: Return analysis result WITHOUT saving to database
    return res.status(200).json({
      success: true,
      message: `Successfully identified ${subtype}!`,
      data: {
        item_type: type,
        item_subtype: subtype,
        confidence: confidence,
        recyclable: recyclable,
        points_earned: pointsEarned,
        tips: tips,
        image_url: imageUrl,
        image_path: imageUrl, // For submission
        gemini_raw_response: aiResult.raw_response,
      },
    });
  } catch (error) {
    console.error('Scan analysis error:', error);

    // Delete uploaded file on error
    if (req.file && fs.existsSync(req.file.path)) {
      fs.unlinkSync(req.file.path);
    }

    return res.status(500).json({
      success: false,
      message: 'An error occurred during scan analysis',
      error: process.env.NODE_ENV !== 'production' ? error.message : undefined,
    });
  }
});

/**
 * POST /api/scan/submit
 * Submit analyzed scan with facility selection for admin verification
 * NEW: Saves to database with PENDING status, does NOT award points yet
 * Requires: JWT authentication
 */
router.post('/submit', verifyToken, async (req, res) => {
  const connection = await db.getConnection();

  try {
    await connection.beginTransaction();

    const userId = req.user.user_id;
    const {
      facility_id,
      item_type,
      item_subtype,
      confidence,
      points_earned,
      image_path,
      recycling_tips,
      gemini_raw_response,
    } = req.body;

    // Validate required fields
    if (!facility_id || !item_type || !item_subtype) {
      return res.status(400).json({
        success: false,
        message: 'Missing required fields: facility_id, item_type, item_subtype',
      });
    }

    // Prepare gemini_raw_response: must be valid JSON string or NULL
    // Database has CHECK constraint: json_valid(gemini_raw_response)
    let geminiResponse = null;
    if (gemini_raw_response) {
      try {
        if (typeof gemini_raw_response === 'string') {
          // Try to parse it to validate it's JSON, then stringify again
          const parsed = JSON.parse(gemini_raw_response);
          geminiResponse = JSON.stringify(parsed);
        } else if (typeof gemini_raw_response === 'object') {
          // Convert object to JSON string
          geminiResponse = JSON.stringify(gemini_raw_response);
        }
      } catch (e) {
        // If parsing fails, wrap in a valid JSON object
        console.warn('⚠️  gemini_raw_response is not valid JSON, wrapping it:', e.message);
        geminiResponse = JSON.stringify({
          raw_text: String(gemini_raw_response),
          parse_error: e.message,
        });
      }
    }

    // Insert scan with PENDING verification status
    const [scanResult] = await connection.execute(
      `INSERT INTO scans
       (user_id, item_type, item_subtype, confidence_score, points_earned,
        image_path, facility_id, recycling_tips, gemini_raw_response,
        verification_status, scan_timestamp)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, 'pending', NOW())`,
      [
        userId,
        item_type,
        item_subtype,
        confidence || 0.95,
        points_earned || 10,
        image_path,
        facility_id,
        recycling_tips || null,
        geminiResponse,
      ]
    );

    const scanId = scanResult.insertId;

    // Update item_type_stats (increment scan count for this type)
    await connection.execute(
      `INSERT INTO item_type_stats (item_type, total_scanned, base_points)
       VALUES (?, 1, ?)
       ON DUPLICATE KEY UPDATE total_scanned = total_scanned + 1`,
      [item_type, Math.floor(points_earned / (confidence || 0.95))]
    );

    // ============================================
    // NEW: Update streak based on scan SUBMISSION date
    // ============================================
    const today = new Date().toISOString().split('T')[0]; // YYYY-MM-DD format

    // Get user's current streak info
    const [userStreakInfo] = await connection.execute(
      `SELECT last_scan_date, current_streak_days, longest_streak_days, streak_grace_used
       FROM users WHERE user_id = ?`,
      [userId]
    );

    let newStreak = 1;
    let newGraceUsed = 0;
    let streakMessage = 'Streak started!';
    const userData = userStreakInfo[0];

    if (userData.last_scan_date) {
      const lastScanDate = new Date(userData.last_scan_date);
      const todayDate = new Date(today);
      const daysDiff = Math.floor((todayDate - lastScanDate) / (1000 * 60 * 60 * 24));

      if (daysDiff === 0) {
        // Same day - keep current streak (no change)
        newStreak = userData.current_streak_days;
        newGraceUsed = userData.streak_grace_used;
        streakMessage = 'Streak maintained!';
      } else if (daysDiff === 1) {
        // Consecutive day - increase streak!
        newStreak = userData.current_streak_days + 1;
        newGraceUsed = 0; // Reset grace for new week
        streakMessage = `Streak increased to ${newStreak} days!`;
      } else if (daysDiff === 2 && !userData.streak_grace_used) {
        // 2 days gap but grace period available - keep streak, use grace
        newStreak = userData.current_streak_days;
        newGraceUsed = 1;
        streakMessage = 'Grace period used! Streak maintained.';
      } else {
        // Gap too large - reset streak
        newStreak = 1;
        newGraceUsed = 0;
        streakMessage = 'Streak reset. New streak started!';
      }
    }

    // Update user's streak and last_scan_date
    await connection.execute(
      `UPDATE users
       SET last_scan_date = ?,
           current_streak_days = ?,
           longest_streak_days = GREATEST(longest_streak_days, ?),
           streak_grace_used = ?
       WHERE user_id = ?`,
      [today, newStreak, newStreak, newGraceUsed, userId]
    );

    await connection.commit();

    console.log(`⏳ Scan submitted for verification: scan_id=${scanId}, user=${userId}, facility=${facility_id}`);
    console.log(`🔥 Streak update: ${streakMessage} (${newStreak} days)`);

    return res.status(200).json({
      success: true,
      message: 'Scan submitted for verification! Admin will review shortly.',
      data: {
        scan_id: scanId,
        verification_status: 'pending',
        streak: {
          current: newStreak,
          message: streakMessage,
          grace_used: newGraceUsed === 1,
        },
      },
    });
  } catch (error) {
    if (connection) {
      await connection.rollback();
    }

    console.error('Scan submission error:', error);

    return res.status(500).json({
      success: false,
      message: 'Failed to submit scan for verification',
      error: process.env.NODE_ENV !== 'production' ? error.message : undefined,
    });
  } finally {
    if (connection) {
      connection.release();
    }
  }
});

/**
 * GET /api/scan/history
 * Get user's scan history
 */
router.get('/history', verifyToken, async (req, res) => {
  try {
    const userId = req.user.user_id;
    const safeLimit = Math.min(Math.max(parseInt(req.query.limit) || 20, 1), 50);
    const safeOffset = Math.max(parseInt(req.query.offset) || 0, 0);

    // LIMIT/OFFSET cannot use placeholders with mysql2's prepared-statement protocol
    // (ER_WRONG_ARGUMENTS). Both values are parseInt'd and clamped, so inlining is safe.
    const [scans] = await db.execute(
      `SELECT scan_id, item_type, item_subtype, confidence_score,
              points_earned, image_path, scan_timestamp, verification_status
       FROM scans
       WHERE user_id = ?
       ORDER BY scan_timestamp DESC
       LIMIT ${safeLimit} OFFSET ${safeOffset}`,
      [userId]
    );

    return res.status(200).json({
      success: true,
      data: scans,
      count: scans.length,
    });
  } catch (error) {
    console.error('Error fetching scan history:', error);
    return res.status(500).json({
      success: false,
      message: 'Failed to fetch scan history',
    });
  }
});

/**
 * GET /api/scan/:scan_id
 * Get detailed information for a specific scan
 * Requires: JWT authentication
 */
router.get('/:scan_id', verifyToken, async (req, res) => {
  try {
    const userId = req.user.user_id;
    const scanId = req.params.scan_id;

    // Fetch scan details (ensure user owns this scan)
    const [scans] = await db.execute(
      `SELECT
        scan_id,
        item_type,
        item_subtype,
        confidence_score,
        points_earned,
        image_path,
        recycling_tips,
        gemini_raw_response,
        scan_timestamp,
        location_lat,
        location_lng,
        verification_status,
        verified_at
      FROM scans
      WHERE scan_id = ? AND user_id = ?`,
      [scanId, userId]
    );

    if (scans.length === 0) {
      return res.status(404).json({
        success: false,
        message: 'Scan not found or access denied',
      });
    }

    const scan = scans[0];

    // Parse gemini_raw_response if it's a JSON string
    if (scan.gemini_raw_response && typeof scan.gemini_raw_response === 'string') {
      try {
        scan.gemini_raw_response = JSON.parse(scan.gemini_raw_response);
      } catch (e) {
        // Keep as string if parsing fails
      }
    }

    return res.status(200).json({
      success: true,
      data: scan,
    });
  } catch (error) {
    console.error('Error fetching scan details:', error);
    return res.status(500).json({
      success: false,
      message: 'Failed to fetch scan details',
      error: process.env.NODE_ENV !== 'production' ? error.message : undefined,
    });
  }
});

module.exports = router;
