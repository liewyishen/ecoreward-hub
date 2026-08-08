const express = require('express');
const router = express.Router();
const multer = require('multer');
const path = require('path');
const fs = require('fs');
const db = require('../config/db');
const verifyToken = require('../middleware/verifyToken');

// Create uploads directory if it doesn't exist
const uploadsDir = path.join(__dirname, '../uploads/posts');
if (!fs.existsSync(uploadsDir)) {
  fs.mkdirSync(uploadsDir, { recursive: true });
}

// Configure multer for post image uploads
const storage = multer.diskStorage({
  destination: (req, file, cb) => {
    cb(null, uploadsDir);
  },
  filename: (req, file, cb) => {
    const timestamp = Date.now();
    const ext = path.extname(file.originalname);
    cb(null, `post_${timestamp}${ext}`);
  },
});

const fileFilter = (req, file, cb) => {
  const allowedTypes = ['image/jpeg', 'image/jpg', 'image/png', 'image/webp'];
  if (allowedTypes.includes(file.mimetype)) {
    cb(null, true);
  } else {
    cb(new Error('Only images (JPG, PNG, WEBP) are allowed'), false);
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
 * GET /api/community/posts
 * Fetch all posts (timeline)
 * Optional query params: limit (default: 20)
 */
router.get('/posts', async (req, res) => {
  try {
    const safeLimit = Math.min(Math.max(parseInt(req.query.limit) || 20, 1), 50);

    // LIMIT cannot use a placeholder with mysql2's prepared-statement protocol
    // (ER_WRONG_ARGUMENTS). safeLimit is parseInt'd and clamped, so inlining is safe.
    const query = `
      SELECT
        p.post_id,
        p.user_id,
        p.content,
        p.image_url,
        p.likes_count,
        p.comments_count,
        p.created_at,
        u.username,
        u.profile_picture
      FROM posts p
      JOIN users u ON p.user_id = u.user_id
      WHERE p.is_deleted = FALSE
      ORDER BY p.created_at DESC
      LIMIT ${safeLimit}
    `;

    const [posts] = await db.execute(query);

    return res.status(200).json({
      success: true,
      data: posts,
    });
  } catch (error) {
    console.error('❌ Fetch posts error:', error);
    return res.status(500).json({
      success: false,
      message: 'Failed to fetch posts',
    });
  }
});

/**
 * POST /api/community/posts
 * Create new post
 * Requires: JWT authentication
 * Body: { content: string }
 * File: image (optional)
 */
router.post('/posts', verifyToken, upload.single('image'), async (req, res) => {
  try {
    const { content } = req.body;
    const user_id = req.user.user_id;
    const image_url = req.file ? `/uploads/posts/${req.file.filename}` : null;

    // Validation
    if (!content || content.trim().length === 0) {
      // Delete uploaded file if validation fails
      if (req.file && fs.existsSync(req.file.path)) {
        fs.unlinkSync(req.file.path);
      }
      return res.status(400).json({
        success: false,
        message: 'Content is required',
      });
    }

    if (content.length > 280) {
      // Delete uploaded file if validation fails
      if (req.file && fs.existsSync(req.file.path)) {
        fs.unlinkSync(req.file.path);
      }
      return res.status(400).json({
        success: false,
        message: 'Maximum 280 characters allowed',
      });
    }

    const [result] = await db.execute(
      'INSERT INTO posts (user_id, content, image_url) VALUES (?, ?, ?)',
      [user_id, content.trim(), image_url]
    );

    return res.status(201).json({
      success: true,
      message: 'Post shared! 🌱',
      post_id: result.insertId,
    });
  } catch (error) {
    console.error('❌ Create post error:', error);

    // Delete uploaded file if error occurs
    if (req.file && fs.existsSync(req.file.path)) {
      try {
        fs.unlinkSync(req.file.path);
      } catch (unlinkError) {
        console.error('Failed to delete uploaded file:', unlinkError);
      }
    }

    return res.status(500).json({
      success: false,
      message: 'Failed to create post',
    });
  }
});

/**
 * POST /api/community/posts/:postId/like
 * Toggle like on a post
 * Requires: JWT authentication
 */
router.post('/posts/:postId/like', verifyToken, async (req, res) => {
  let connection;

  try {
    const { postId } = req.params;
    const user_id = req.user.user_id;

    connection = await db.getConnection();
    await connection.beginTransaction();

    // Check if post exists
    const [postExists] = await connection.execute(
      'SELECT post_id FROM posts WHERE post_id = ? AND is_deleted = FALSE',
      [postId]
    );

    if (postExists.length === 0) {
      await connection.rollback();
      return res.status(404).json({
        success: false,
        message: 'Post not found',
      });
    }

    // Check if already liked
    const [existing] = await connection.execute(
      'SELECT * FROM post_likes WHERE user_id = ? AND post_id = ?',
      [user_id, postId]
    );

    let action;

    if (existing.length > 0) {
      // Unlike
      await connection.execute(
        'DELETE FROM post_likes WHERE user_id = ? AND post_id = ?',
        [user_id, postId]
      );

      await connection.execute(
        'UPDATE posts SET likes_count = GREATEST(likes_count - 1, 0) WHERE post_id = ?',
        [postId]
      );

      action = 'unliked';
    } else {
      // Like
      await connection.execute(
        'INSERT INTO post_likes (user_id, post_id) VALUES (?, ?)',
        [user_id, postId]
      );

      await connection.execute(
        'UPDATE posts SET likes_count = likes_count + 1 WHERE post_id = ?',
        [postId]
      );

      action = 'liked';
    }

    await connection.commit();

    // Get updated count
    const [post] = await connection.execute(
      'SELECT likes_count FROM posts WHERE post_id = ?',
      [postId]
    );

    return res.status(200).json({
      success: true,
      action,
      likes_count: post[0].likes_count,
    });
  } catch (error) {
    if (connection) {
      await connection.rollback();
    }
    console.error('❌ Like toggle error:', error);
    return res.status(500).json({
      success: false,
      message: 'Failed to toggle like',
    });
  } finally {
    if (connection) {
      connection.release();
    }
  }
});

/**
 * GET /api/community/posts/:postId/comments
 * Get comments for a post
 * Optional query params: limit (default: 10)
 */
router.get('/posts/:postId/comments', async (req, res) => {
  try {
    const { postId } = req.params;
    const safeLimit = Math.min(Math.max(parseInt(req.query.limit) || 10, 1), 50);

    // LIMIT cannot use a placeholder with mysql2's prepared-statement protocol
    // (ER_WRONG_ARGUMENTS). safeLimit is parseInt'd and clamped, so inlining is safe.
    const query = `
      SELECT
        c.comment_id,
        c.comment_text,
        c.created_at,
        u.user_id,
        u.username,
        u.profile_picture
      FROM comments c
      JOIN users u ON c.user_id = u.user_id
      WHERE c.post_id = ? AND c.is_deleted = FALSE
      ORDER BY c.created_at DESC
      LIMIT ${safeLimit}
    `;

    const [comments] = await db.execute(query, [postId]);

    return res.status(200).json({
      success: true,
      data: comments,
    });
  } catch (error) {
    console.error('❌ Fetch comments error:', error);
    return res.status(500).json({
      success: false,
      message: 'Failed to fetch comments',
    });
  }
});

/**
 * POST /api/community/posts/:postId/comments
 * Add comment to a post
 * Requires: JWT authentication
 * Body: { text: string }
 */
router.post('/posts/:postId/comments', verifyToken, async (req, res) => {
  let connection;

  try {
    const { postId } = req.params;
    const { text } = req.body;
    const user_id = req.user.user_id;

    if (!text || text.trim().length === 0) {
      return res.status(400).json({
        success: false,
        message: 'Comment cannot be empty',
      });
    }

    if (text.length > 500) {
      return res.status(400).json({
        success: false,
        message: 'Comment too long (max 500 characters)',
      });
    }

    connection = await db.getConnection();
    await connection.beginTransaction();

    // Check if post exists
    const [postExists] = await connection.execute(
      'SELECT post_id FROM posts WHERE post_id = ? AND is_deleted = FALSE',
      [postId]
    );

    if (postExists.length === 0) {
      await connection.rollback();
      return res.status(404).json({
        success: false,
        message: 'Post not found',
      });
    }

    // Insert comment
    await connection.execute(
      'INSERT INTO comments (post_id, user_id, comment_text) VALUES (?, ?, ?)',
      [postId, user_id, text.trim()]
    );

    // Update comment count
    await connection.execute(
      'UPDATE posts SET comments_count = comments_count + 1 WHERE post_id = ?',
      [postId]
    );

    await connection.commit();

    return res.status(201).json({
      success: true,
      message: 'Comment added successfully',
    });
  } catch (error) {
    if (connection) {
      await connection.rollback();
    }
    console.error('❌ Add comment error:', error);
    return res.status(500).json({
      success: false,
      message: 'Failed to add comment',
    });
  } finally {
    if (connection) {
      connection.release();
    }
  }
});

/**
 * GET /api/community/posts/:postId/check-like
 * Check if current user liked a post
 * Requires: JWT authentication
 */
router.get('/posts/:postId/check-like', verifyToken, async (req, res) => {
  try {
    const { postId } = req.params;
    const user_id = req.user.user_id;

    const [result] = await db.execute(
      'SELECT * FROM post_likes WHERE user_id = ? AND post_id = ?',
      [user_id, postId]
    );

    return res.status(200).json({
      success: true,
      liked: result.length > 0,
    });
  } catch (error) {
    console.error('❌ Check like error:', error);
    return res.status(500).json({
      success: false,
      message: 'Failed to check like status',
    });
  }
});

module.exports = router;
