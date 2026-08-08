const express = require('express');
const router = express.Router();
const db = require('../config/db');
const verifyToken = require('../middleware/verifyToken');

/**
 * GET /api/leaderboard
 * Get top users with current user's rank
 * Query params: limit (default: 10)
 * Requires: JWT authentication
 */
router.get('/', verifyToken, async (req, res) => {
  try {
    const userId = req.user.user_id;
    const safeLimit = Math.min(Math.max(parseInt(req.query.limit) || 10, 1), 100);

    // Get top users using the view_leaderboard view
    // LIMIT cannot use a placeholder with mysql2's prepared-statement protocol
    // (ER_WRONG_ARGUMENTS). safeLimit is parseInt'd and clamped, so inlining is safe.
    const [topUsers] = await db.execute(
      `SELECT
        user_id,
        username,
        profile_picture,
        total_points,
        total_scans,
        user_rank
      FROM view_leaderboard
      LIMIT ${safeLimit}`
    );

    // Get current user's rank (even if not in top list)
    const [currentUserRows] = await db.execute(
      `SELECT
        user_id,
        username,
        profile_picture,
        total_points,
        total_scans,
        user_rank
      FROM view_leaderboard
      WHERE user_id = ?`,
      [userId]
    );

    const currentUser = currentUserRows.length > 0 ? currentUserRows[0] : null;

    // Check if current user is in the top list
    const isInTopList = topUsers.some((u) => u.user_id === userId);

    return res.status(200).json({
      success: true,
      data: {
        topUsers: topUsers,
        currentUser: currentUser,
        isInTopList: isInTopList,
      },
    });
  } catch (error) {
    console.error('Leaderboard fetch error:', error);
    return res.status(500).json({
      success: false,
      message: 'Failed to fetch leaderboard',
      error: process.env.NODE_ENV !== 'production' ? error.message : undefined,
    });
  }
});

/**
 * GET /api/leaderboard/stats
 * Get leaderboard metadata and global statistics
 * Public route - no authentication required
 */
router.get('/stats', async (req, res) => {
  try {
    const [stats] = await db.execute(
      `SELECT
        COUNT(*) as total_users,
        SUM(total_points) as total_points_awarded,
        AVG(total_points) as average_points,
        MAX(total_points) as highest_score,
        SUM(total_scans) as total_scans_global
      FROM users
      WHERE is_active = TRUE`
    );

    return res.status(200).json({
      success: true,
      data: stats[0],
    });
  } catch (error) {
    console.error('Leaderboard stats error:', error);
    return res.status(500).json({
      success: false,
      message: 'Failed to fetch leaderboard stats',
      error: process.env.NODE_ENV !== 'production' ? error.message : undefined,
    });
  }
});

module.exports = router;
