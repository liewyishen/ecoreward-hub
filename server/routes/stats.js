const express = require('express');
const router = express.Router();
const db = require('../config/db');

/**
 * GET /api/stats/global
 * Get global platform statistics for welcome/landing page
 * Public endpoint (no auth required)
 */
router.get('/global', async (req, res) => {
  try {
    // Get comprehensive global stats in a single query
    const [statsRows] = await db.execute(`
      SELECT
        (SELECT COUNT(*) FROM scans) as total_scans,
        (SELECT COUNT(*) FROM users WHERE is_active = 1) as total_users,
        (SELECT COALESCE(SUM(points_earned), 0) FROM scans) as total_points_awarded,
        (SELECT COALESCE(SUM(total_scanned), 0) FROM item_type_stats) as total_items_recycled
    `);

    // Get most popular item type
    const [popularItemRows] = await db.execute(`
      SELECT item_type, total_scanned
      FROM item_type_stats
      ORDER BY total_scanned DESC
      LIMIT 1
    `);

    const stats = statsRows[0];
    const mostPopularItem =
      popularItemRows.length > 0
        ? {
            type: popularItemRows[0].item_type,
            count: popularItemRows[0].total_scanned,
          }
        : null;

    return res.status(200).json({
      success: true,
      data: {
        total_scans: stats.total_scans || 0,
        total_users: stats.total_users || 0,
        total_points_awarded: stats.total_points_awarded || 0,
        total_items_recycled: stats.total_items_recycled || 0,
        most_popular_item: mostPopularItem,
      },
    });
  } catch (error) {
    console.error('Error fetching global stats:', error);
    return res.status(500).json({
      success: false,
      message: 'Failed to fetch global statistics',
      error: process.env.NODE_ENV !== 'production' ? error.message : undefined,
    });
  }
});

/**
 * GET /api/stats/item-types
 * Get statistics breakdown by item type
 * Public endpoint
 */
router.get('/item-types', async (req, res) => {
  try {
    const [itemStats] = await db.execute(`
      SELECT item_type, base_points, total_scanned, last_updated
      FROM item_type_stats
      ORDER BY total_scanned DESC
    `);

    return res.status(200).json({
      success: true,
      data: itemStats,
    });
  } catch (error) {
    console.error('Error fetching item type stats:', error);
    return res.status(500).json({
      success: false,
      message: 'Failed to fetch item type statistics',
      error: process.env.NODE_ENV !== 'production' ? error.message : undefined,
    });
  }
});

module.exports = router;
