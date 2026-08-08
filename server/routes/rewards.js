const express = require('express');
const router = express.Router();
const db = require('../config/db');
const verifyToken = require('../middleware/verifyToken');

/**
 * GET /api/rewards
 * Get available rewards catalog
 * Public route - no authentication required
 */
router.get('/', async (req, res) => {
  try {
    const query = `
      SELECT
        reward_id,
        reward_name,
        description,
        reward_image,
        points_cost,
        reward_type,
        reward_value,
        stock_quantity,
        is_active
      FROM rewards
      WHERE is_active = TRUE
      ORDER BY points_cost ASC
    `;

    const [rewards] = await db.execute(query);

    return res.status(200).json({
      success: true,
      data: rewards,
      count: rewards.length,
    });
  } catch (error) {
    console.error('Rewards fetch error:', error);
    return res.status(500).json({
      success: false,
      message: 'Failed to fetch rewards',
      error: process.env.NODE_ENV !== 'production' ? error.message : undefined,
    });
  }
});

/**
 * POST /api/rewards/redeem
 * Redeem a reward using points
 * Requires: JWT authentication
 */
router.post('/redeem', verifyToken, async (req, res) => {
  const connection = await db.getConnection();

  try {
    await connection.beginTransaction();

    const { reward_id } = req.body;
    const user_id = req.user.user_id;

    if (!reward_id) {
      throw new Error('Reward ID is required');
    }

    // 1. Get reward details
    const [rewardRows] = await connection.execute(
      'SELECT * FROM rewards WHERE reward_id = ? AND is_active = TRUE',
      [reward_id]
    );

    if (rewardRows.length === 0) {
      throw new Error('Reward not available');
    }

    const reward = rewardRows[0];

    // 2. Check user has enough points
    const [userRows] = await connection.execute(
      'SELECT total_points, username FROM users WHERE user_id = ?',
      [user_id]
    );

    if (userRows.length === 0) {
      throw new Error('User not found');
    }

    const user = userRows[0];

    if (user.total_points < reward.points_cost) {
      throw new Error('Insufficient points');
    }

    // 3. Check stock availability (if limited)
    if (reward.stock_quantity !== -1 && reward.stock_quantity <= 0) {
      throw new Error('Reward out of stock');
    }

    // 4. Deduct points from user immediately (reserved for pending redemption)
    await connection.execute(
      'UPDATE users SET total_points = total_points - ? WHERE user_id = ?',
      [reward.points_cost, user_id]
    );

    // 5. Create redemption record with PENDING status (no voucher code yet)
    await connection.execute(
      `INSERT INTO redemptions
       (user_id, reward_id, points_spent, redemption_code, status, redeemed_at)
       VALUES (?, ?, ?, NULL, 'pending', NOW())`,
      [user_id, reward_id, reward.points_cost]
    );

    // 6. Update stock if limited
    if (reward.stock_quantity !== -1) {
      await connection.execute(
        'UPDATE rewards SET stock_quantity = stock_quantity - 1 WHERE reward_id = ?',
        [reward_id]
      );
    }

    await connection.commit();

    console.log(`⏳ Redemption pending approval: User ${user.username} requested ${reward.reward_name}`);

    return res.status(200).json({
      success: true,
      message: 'Redemption request submitted! Awaiting admin approval.',
      data: {
        reward_name: reward.reward_name,
        points_spent: reward.points_cost,
        new_balance: user.total_points - reward.points_cost,
        status: 'pending',
      },
    });
  } catch (error) {
    await connection.rollback();
    console.error('Redemption error:', error);
    return res.status(400).json({
      success: false,
      message: error.message || 'Redemption failed',
    });
  } finally {
    connection.release();
  }
});

/**
 * GET /api/rewards/history
 * Get user's redemption history
 * Requires: JWT authentication
 */
router.get('/history', verifyToken, async (req, res) => {
  try {
    const user_id = req.user.user_id;
    const safeLimit = Math.min(Math.max(parseInt(req.query.limit) || 20, 1), 50);

    // LIMIT cannot use a placeholder with mysql2's prepared-statement protocol
    // (ER_WRONG_ARGUMENTS). safeLimit is parseInt'd and clamped, so inlining is safe.
    const query = `
      SELECT
        r.redemption_id,
        rw.reward_name,
        rw.reward_type,
        rw.reward_value,
        r.points_spent,
        r.redemption_code,
        r.status,
        r.redeemed_at
      FROM redemptions r
      JOIN rewards rw ON r.reward_id = rw.reward_id
      WHERE r.user_id = ?
      ORDER BY r.redeemed_at DESC
      LIMIT ${safeLimit}
    `;

    const [history] = await db.execute(query, [user_id]);

    return res.status(200).json({
      success: true,
      data: history,
      count: history.length,
    });
  } catch (error) {
    console.error('History fetch error:', error);
    return res.status(500).json({
      success: false,
      message: 'Failed to fetch redemption history',
      error: process.env.NODE_ENV !== 'production' ? error.message : undefined,
    });
  }
});

/**
 * GET /api/rewards/stats
 * Get rewards statistics (total redeemed, most popular, etc.)
 * Public route
 */
router.get('/stats', async (req, res) => {
  try {
    const [stats] = await db.execute(`
      SELECT
        COUNT(*) as total_redemptions,
        SUM(points_spent) as total_points_spent,
        COUNT(DISTINCT user_id) as unique_users
      FROM redemptions
      WHERE status = 'completed'
    `);

    return res.status(200).json({
      success: true,
      data: stats[0],
    });
  } catch (error) {
    console.error('Stats fetch error:', error);
    return res.status(500).json({
      success: false,
      message: 'Failed to fetch stats',
    });
  }
});

module.exports = router;
