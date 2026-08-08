const express = require('express');
const router = express.Router();
const multer = require('multer');
const path = require('path');
const fs = require('fs');
const db = require('../config/db');
const verifyToken = require('../middleware/verifyToken');

// Create uploads directory if it doesn't exist
const uploadsDir = path.join(__dirname, '../uploads/profiles');
if (!fs.existsSync(uploadsDir)) {
  fs.mkdirSync(uploadsDir, { recursive: true });
}

// Configure multer for profile picture uploads
const storage = multer.diskStorage({
  destination: (req, file, cb) => {
    cb(null, uploadsDir);
  },
  filename: (req, file, cb) => {
    const userId = req.user?.user_id || 'unknown';
    const timestamp = Date.now();
    const ext = path.extname(file.originalname);
    cb(null, `profile_${userId}_${timestamp}${ext}`);
  },
});

const fileFilter = (req, file, cb) => {
  const allowedTypes = ['image/jpeg', 'image/jpg', 'image/png'];
  if (allowedTypes.includes(file.mimetype)) {
    cb(null, true);
  } else {
    cb(new Error('Invalid file type. Only JPG and PNG are allowed.'), false);
  }
};

const upload = multer({
  storage,
  fileFilter,
  limits: {
    fileSize: 5 * 1024 * 1024, // 5MB max
  },
});

/**
 * GET /api/user/stats
 * Get comprehensive user statistics for dashboard
 * Requires: JWT authentication
 */
router.get('/stats', verifyToken, async (req, res) => {
  try {
    const userId = req.user.user_id;

    // Get user basic stats including streak info
    const [userRows] = await db.execute(
      `SELECT username, email, profile_picture, total_points, lifetime_points,
              total_scans, current_streak_days, longest_streak_days,
              last_scan_date, streak_grace_used, created_at
       FROM users
       WHERE user_id = ? AND is_active = 1`,
      [userId]
    );

    if (userRows.length === 0) {
      return res.status(404).json({
        success: false,
        message: 'User not found',
      });
    }

    let userData = userRows[0];

    // ============================================
    // NEW: Check if streak should be reset
    // ============================================
    if (userData.last_scan_date && userData.current_streak_days > 0) {
      const today = new Date();
      today.setHours(0, 0, 0, 0);
      const lastScanDate = new Date(userData.last_scan_date);
      lastScanDate.setHours(0, 0, 0, 0);
      const daysDiff = Math.floor((today - lastScanDate) / (1000 * 60 * 60 * 24));

      // Check if streak should be broken
      // daysDiff > 2: definitely broken (even with grace)
      // daysDiff === 2 and grace already used: broken
      const streakBroken = daysDiff > 2 || (daysDiff === 2 && userData.streak_grace_used);

      if (streakBroken) {
        // Reset streak in database
        await db.execute(
          `UPDATE users
           SET current_streak_days = 0, streak_grace_used = 0
           WHERE user_id = ?`,
          [userId]
        );
        userData.current_streak_days = 0;
        userData.streak_grace_used = 0;
        console.log(`💔 Streak reset for user ${userId}: ${daysDiff} days since last scan`);
      }
    }

    // Calculate user rank using view_leaderboard
    const [rankRows] = await db.execute(
      `SELECT user_rank
       FROM view_leaderboard
       WHERE user_id = ?`,
      [userId]
    );

    const rank = rankRows.length > 0 ? rankRows[0].user_rank : null;

    return res.status(200).json({
      success: true,
      data: {
        user_id: userId,
        username: userData.username,
        email: userData.email,
        profile_picture: userData.profile_picture,
        total_points: userData.total_points,
        lifetime_points: userData.lifetime_points,
        total_scans: userData.total_scans,
        current_streak_days: userData.current_streak_days,
        longest_streak_days: userData.longest_streak_days,
        rank: rank,
        member_since: userData.created_at,
      },
    });
  } catch (error) {
    console.error('Error fetching user stats:', error);
    return res.status(500).json({
      success: false,
      message: 'Failed to fetch user statistics',
      error: process.env.NODE_ENV !== 'production' ? error.message : undefined,
    });
  }
});

/**
 * GET /api/user/recent-scans
 * Get user's recent scan history (last 3 by default)
 * Query params: limit (default: 3)
 * Requires: JWT authentication
 */
router.get('/recent-scans', verifyToken, async (req, res) => {
  try {
    const userId = req.user.user_id;
    const safeLimit = Math.min(Math.max(parseInt(req.query.limit) || 3, 1), 50);

    // LIMIT cannot use a placeholder with mysql2's prepared-statement protocol
    // (ER_WRONG_ARGUMENTS). safeLimit is parseInt'd and clamped, so inlining is safe.
    const [scans] = await db.execute(
      `SELECT scan_id, item_type, item_subtype, confidence_score,
              points_earned, image_path, scan_timestamp, verification_status
       FROM scans
       WHERE user_id = ?
       ORDER BY scan_timestamp DESC
       LIMIT ${safeLimit}`,
      [userId]
    );

    return res.status(200).json({
      success: true,
      data: scans,
      count: scans.length,
    });
  } catch (error) {
    console.error('Error fetching recent scans:', error);
    return res.status(500).json({
      success: false,
      message: 'Failed to fetch recent scans',
      error: process.env.NODE_ENV !== 'production' ? error.message : undefined,
    });
  }
});

/**
 * GET /api/user/profile
 * Get user profile information
 * Requires: JWT authentication
 */
router.get('/profile', verifyToken, async (req, res) => {
  try {
    const userId = req.user.user_id;

    const [userRows] = await db.execute(
      `SELECT user_id, username, email, profile_picture, total_points,
              lifetime_points, total_scans, current_streak_days,
              longest_streak_days, created_at, last_login
       FROM users
       WHERE user_id = ? AND is_active = 1`,
      [userId]
    );

    if (userRows.length === 0) {
      return res.status(404).json({
        success: false,
        message: 'User not found',
      });
    }

    // Get rank
    const [rankRows] = await db.execute(
      `SELECT user_rank FROM view_leaderboard WHERE user_id = ?`,
      [userId]
    );

    // Get achievements count
    const [achievementRows] = await db.execute(
      `SELECT COUNT(*) as achievements_unlocked
       FROM user_achievements
       WHERE user_id = ?`,
      [userId]
    );

    return res.status(200).json({
      success: true,
      data: {
        ...userRows[0],
        rank: rankRows.length > 0 ? rankRows[0].user_rank : null,
        achievements_unlocked:
          achievementRows[0].achievements_unlocked || 0,
      },
    });
  } catch (error) {
    console.error('Error fetching user profile:', error);
    return res.status(500).json({
      success: false,
      message: 'Failed to fetch user profile',
      error: process.env.NODE_ENV !== 'production' ? error.message : undefined,
    });
  }
});

/**
 * PUT /api/user/profile
 * Update user profile (username and/or profile picture)
 * Requires: JWT authentication
 */
router.put('/profile', verifyToken, upload.single('profile_picture'), async (req, res) => {
  let connection;
  const oldProfilePicturePath = null;

  try {
    const userId = req.user.user_id;
    const { username } = req.body;

    // Validate at least one field is being updated
    if (!username && !req.file) {
      return res.status(400).json({
        success: false,
        message: 'No updates provided',
      });
    }

    connection = await db.getConnection();
    await connection.beginTransaction();

    // Get current user data
    const [currentUser] = await connection.execute(
      'SELECT username, profile_picture FROM users WHERE user_id = ?',
      [userId]
    );

    if (currentUser.length === 0) {
      throw new Error('User not found');
    }

    const updates = [];
    const values = [];

    // Check if username is being updated
    if (username && username !== currentUser[0].username) {
      // Validate username is not empty
      if (!username.trim()) {
        throw new Error('Username cannot be empty');
      }

      // Check if username is already taken
      const [existingUser] = await connection.execute(
        'SELECT user_id FROM users WHERE username = ? AND user_id != ?',
        [username, userId]
      );

      if (existingUser.length > 0) {
        throw new Error('Username is already taken');
      }

      updates.push('username = ?');
      values.push(username);
    }

    // Check if profile picture is being updated
    if (req.file) {
      const profilePicturePath = `/uploads/profiles/${req.file.filename}`;
      updates.push('profile_picture = ?');
      values.push(profilePicturePath);

      // Mark old profile picture for deletion
      if (currentUser[0].profile_picture) {
        const oldPath = path.join(__dirname, '..', currentUser[0].profile_picture);
        if (fs.existsSync(oldPath)) {
          try {
            fs.unlinkSync(oldPath);
            console.log(`Deleted old profile picture: ${oldPath}`);
          } catch (err) {
            console.error('Failed to delete old profile picture:', err);
          }
        }
      }
    }

    // Update database
    if (updates.length > 0) {
      values.push(userId);
      const updateQuery = `UPDATE users SET ${updates.join(', ')} WHERE user_id = ?`;
      await connection.execute(updateQuery, values);
    }

    // Get updated user data
    const [updatedUser] = await connection.execute(
      `SELECT user_id, username, email, profile_picture, total_points,
              lifetime_points, total_scans, current_streak_days,
              longest_streak_days, created_at
       FROM users
       WHERE user_id = ?`,
      [userId]
    );

    await connection.commit();

    return res.status(200).json({
      success: true,
      message: 'Profile updated successfully',
      data: updatedUser[0],
    });
  } catch (error) {
    // Rollback transaction
    if (connection) {
      await connection.rollback();
    }

    console.error('Profile update error:', error);

    // Delete uploaded file if transaction failed
    if (req.file && fs.existsSync(req.file.path)) {
      try {
        fs.unlinkSync(req.file.path);
      } catch (err) {
        console.error('Failed to delete uploaded file:', err);
      }
    }

    return res.status(500).json({
      success: false,
      message: error.message || 'Failed to update profile',
    });
  } finally {
    if (connection) {
      connection.release();
    }
  }
});

module.exports = router;
