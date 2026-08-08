const express = require('express');
const router = express.Router();
const db = require('../config/db');
const verifyToken = require('../middleware/verifyToken');
const verifyAdmin = require('../middleware/verifyAdmin');
const transporter = require('../config/email');
const { rewardApprovedEmail, scanVerifiedEmail } = require('../utils/emailTemplates');

// Authenticate first (signature + expiry + is_active), then authorize.
// Chaining these is what keeps admin routes covered by the ban check —
// verifyAdmin no longer verifies anything by itself.
router.use(verifyToken, verifyAdmin);

/**
 * GET /api/admin/stats
 * Get dashboard statistics
 */
router.get('/stats', async (req, res) => {
  try {
    const [stats] = await db.query(`
      SELECT
        (SELECT COUNT(*) FROM users) as total_users,
        (SELECT SUM(total_scans) FROM users) as total_items_recycled,
        (SELECT SUM(lifetime_points) FROM users) as total_points_issued,
        (SELECT COUNT(*) FROM redemptions WHERE status = 'pending') as pending_redemptions,
        (SELECT COUNT(*) FROM scans WHERE verification_status = 'pending') as pending_scans,
        (
          (SELECT COUNT(*) FROM redemptions WHERE status = 'pending') +
          (SELECT COUNT(*) FROM scans WHERE verification_status = 'pending')
        ) as total_pending_approvals
    `);

    res.json({
      success: true,
      data: stats[0],
    });
  } catch (error) {
    console.error('Admin stats error:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to fetch stats',
    });
  }
});

/**
 * GET /api/admin/trends
 * Get recycling activity for last 7 days
 */
router.get('/trends', async (req, res) => {
  try {
    const [trends] = await db.query(`
      SELECT
        DATE(scan_timestamp) as date,
        COUNT(*) as scan_count
      FROM scans
      WHERE scan_timestamp >= DATE_SUB(NOW(), INTERVAL 7 DAY)
      GROUP BY DATE(scan_timestamp)
      ORDER BY date ASC
    `);

    res.json({
      success: true,
      data: trends,
    });
  } catch (error) {
    console.error('Trends fetch error:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to fetch trends',
    });
  }
});

/**
 * GET /api/admin/category-distribution
 * Get waste type breakdown
 */
router.get('/category-distribution', async (req, res) => {
  try {
    const [distribution] = await db.query(`
      SELECT
        item_type as name,
        COUNT(*) as value
      FROM scans
      GROUP BY item_type
      ORDER BY value DESC
    `);

    res.json({
      success: true,
      data: distribution,
    });
  } catch (error) {
    console.error('Distribution fetch error:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to fetch distribution',
    });
  }
});

/**
 * GET /api/admin/pending-redemptions
 * Get reward approval queue
 */
router.get('/pending-redemptions', async (req, res) => {
  try {
    const [redemptions] = await db.query(`
      SELECT
        rd.redemption_id,
        rd.redemption_code,
        rd.points_spent,
        rd.status,
        rd.redeemed_at,
        u.username,
        u.email,
        rw.reward_name,
        rw.reward_type
      FROM redemptions rd
      JOIN users u ON rd.user_id = u.user_id
      JOIN rewards rw ON rd.reward_id = rw.reward_id
      WHERE rd.status = 'pending'
      ORDER BY rd.redeemed_at DESC
    `);

    res.json({
      success: true,
      data: redemptions,
    });
  } catch (error) {
    console.error('Pending redemptions fetch error:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to fetch pending redemptions',
    });
  }
});

/**
 * POST /api/admin/redemptions/:id/approve
 * Approve a reward redemption and send confirmation email
 */
router.post('/redemptions/:id/approve', async (req, res) => {
  const connection = await db.getConnection();

  try {
    await connection.beginTransaction();

    const { id } = req.params;

    // Generate unique voucher code
    const timestamp = Date.now();
    const randomStr = Math.random().toString(36).substr(2, 6).toUpperCase();
    const voucherCode = `ECO${timestamp}${randomStr}`;

    // Claim the redemption in the same statement that checks its state. The
    // previous version only refused rows that were already 'completed', which
    // left 'cancelled' approvable: the user kept the refund and received a
    // voucher on top of it. Only a pending redemption can be approved.
    const [claim] = await connection.query(
      `UPDATE redemptions
       SET status = 'completed', redemption_code = ?, completed_at = NOW()
       WHERE redemption_id = ? AND status = 'pending'`,
      [voucherCode, id]
    );

    if (claim.affectedRows === 0) {
      const [existing] = await connection.query(
        'SELECT status FROM redemptions WHERE redemption_id = ?',
        [id]
      );
      await connection.rollback();

      if (existing.length === 0) {
        return res.status(404).json({
          success: false,
          message: 'Redemption not found',
        });
      }

      return res.status(409).json({
        success: false,
        message: `Redemption is already ${existing[0].status} and cannot be approved`,
      });
    }

    // Details for the confirmation email
    const [redemption] = await connection.query(
      `
      SELECT
        rd.points_spent,
        u.username,
        u.email,
        rw.reward_name
      FROM redemptions rd
      JOIN users u ON rd.user_id = u.user_id
      JOIN rewards rw ON rd.reward_id = rw.reward_id
      WHERE rd.redemption_id = ?
    `,
      [id]
    );

    const { username, email, reward_name, points_spent } = redemption[0];

    // Commit database changes FIRST
    await connection.commit();

    console.log(`✅ Redemption approved: ${reward_name} for ${username}, voucher: ${voucherCode}`);

    // THEN send confirmation email with voucher code (non-blocking)
    transporter
      .sendMail({
        from: process.env.SMTP_FROM,
        to: email,
        ...rewardApprovedEmail(username, reward_name, voucherCode, points_spent),
      })
      .then(() => {
        console.log(`📧 Redemption approval email sent to ${email}`);
      })
      .catch((err) => {
        console.error('❌ Approval email failed:', err.message);
        // Approval already committed, just log error
      });

    res.json({
      success: true,
      message: 'Reward approved and confirmation email sent',
      data: {
        voucher_code: voucherCode,
      },
    });
  } catch (error) {
    await connection.rollback();
    console.error('Approve redemption error:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to approve redemption',
    });
  } finally {
    connection.release();
  }
});

/**
 * POST /api/admin/redemptions/:id/reject
 * Reject a reward redemption and refund points
 */
router.post('/redemptions/:id/reject', async (req, res) => {
  const connection = await db.getConnection();

  try {
    await connection.beginTransaction();

    const { id } = req.params;

    // Claim the redemption before refunding anything. Putting the current status
    // in the WHERE clause is what makes this safe: a second rejection — whether it
    // arrives a minute later or concurrently — matches zero rows and never reaches
    // the refund below. Reading the status and then updating would leave a window
    // in which both requests pass the check and the user is credited twice.
    const [claim] = await connection.query(
      `UPDATE redemptions
       SET status = 'cancelled'
       WHERE redemption_id = ? AND status = 'pending'`,
      [id]
    );

    if (claim.affectedRows === 0) {
      const [existing] = await connection.query(
        'SELECT status FROM redemptions WHERE redemption_id = ?',
        [id]
      );
      await connection.rollback();

      if (existing.length === 0) {
        return res.status(404).json({
          success: false,
          message: 'Redemption not found',
        });
      }

      // Already completed (voucher issued) or already cancelled (points refunded).
      // Either way there is nothing to refund and retrying will not help.
      return res.status(409).json({
        success: false,
        message: `Redemption is already ${existing[0].status} and cannot be rejected`,
      });
    }

    const [redemption] = await connection.query(
      'SELECT user_id, points_spent FROM redemptions WHERE redemption_id = ?',
      [id]
    );

    const { user_id, points_spent } = redemption[0];

    // Refund exactly what was taken at request time
    await connection.query(
      'UPDATE users SET total_points = total_points + ? WHERE user_id = ?',
      [points_spent, user_id]
    );

    await connection.commit();

    res.json({
      success: true,
      message: 'Reward rejected and points refunded',
    });
  } catch (error) {
    await connection.rollback();
    console.error('Reject redemption error:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to reject redemption',
    });
  } finally {
    connection.release();
  }
});

/**
 * GET /api/admin/low-confidence-scans
 * Get AI audit - scans with confidence < 70%
 */
router.get('/low-confidence-scans', async (req, res) => {
  try {
    const [scans] = await db.query(`
      SELECT
        s.scan_id,
        s.item_type,
        s.item_subtype,
        s.confidence_score,
        s.image_path,
        s.scan_timestamp,
        u.username
      FROM scans s
      JOIN users u ON s.user_id = u.user_id
      WHERE s.confidence_score < 0.7
      ORDER BY s.scan_timestamp DESC
      LIMIT 20
    `);

    res.json({
      success: true,
      data: scans,
    });
  } catch (error) {
    console.error('Low confidence scans fetch error:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to fetch low confidence scans',
    });
  }
});

/**
 * GET /api/admin/users
 * Get user management list
 */
router.get('/users', async (req, res) => {
  try {
    const [users] = await db.query(`
      SELECT
        user_id,
        username,
        email,
        total_points,
        total_scans,
        created_at,
        is_active,
        role
      FROM users
      ORDER BY created_at DESC
      LIMIT 100
    `);

    res.json({
      success: true,
      data: users,
    });
  } catch (error) {
    console.error('Users fetch error:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to fetch users',
    });
  }
});

/**
 * POST /api/admin/users/:id/toggle-status
 * Ban/Unban a user (toggle is_active)
 */
router.post('/users/:id/toggle-status', async (req, res) => {
  try {
    const { id } = req.params;

    await db.query(
      'UPDATE users SET is_active = NOT is_active WHERE user_id = ?',
      [id]
    );

    res.json({
      success: true,
      message: 'User status updated successfully',
    });
  } catch (error) {
    console.error('Toggle user status error:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to update user status',
    });
  }
});

/**
 * GET /api/admin/pending-scans
 * Get all scans awaiting verification
 */
router.get('/pending-scans', async (req, res) => {
  try {
    const [scans] = await db.query(`
      SELECT
        s.scan_id,
        s.item_type,
        s.item_subtype,
        s.confidence_score,
        s.points_earned,
        s.image_path,
        s.scan_timestamp,
        u.user_id,
        u.username,
        u.email,
        f.facility_name
      FROM scans s
      JOIN users u ON s.user_id = u.user_id
      LEFT JOIN recycling_facilities f ON s.facility_id = f.facility_id
      WHERE s.verification_status = 'pending'
      ORDER BY s.scan_timestamp ASC
    `);

    res.json({
      success: true,
      data: scans,
    });
  } catch (error) {
    console.error('Pending scans fetch error:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to fetch pending scans',
    });
  }
});

/**
 * POST /api/admin/scans/:id/approve
 * Approve a scan and award points to user
 */
router.post('/scans/:id/approve', async (req, res) => {
  const connection = await db.getConnection();

  try {
    await connection.beginTransaction();

    const { id } = req.params;
    const admin_id = req.user.user_id;

    // Claim the scan before crediting anything. The status is part of the WHERE
    // clause so that a second approval matches zero rows instead of running the
    // point award, the total_scans increment and the achievement check a second
    // time. This runs before the read because the claim, not the read, is what
    // decides whether the rest of the handler may proceed.
    const [claim] = await connection.query(
      `UPDATE scans
       SET verification_status = 'approved',
           verified_by = ?,
           verified_at = NOW()
       WHERE scan_id = ? AND verification_status = 'pending'`,
      [admin_id, id]
    );

    if (claim.affectedRows === 0) {
      const [existing] = await connection.query(
        'SELECT verification_status FROM scans WHERE scan_id = ?',
        [id]
      );
      await connection.rollback();

      if (existing.length === 0) {
        return res.status(404).json({
          success: false,
          message: 'Scan not found',
        });
      }

      return res.status(409).json({
        success: false,
        message: `Scan is already ${existing[0].verification_status} and cannot be approved`,
      });
    }

    // Get scan details. total_points is still the pre-credit balance here, which
    // is what the email needs to report the new total.
    const [scan] = await connection.query(
      `
      SELECT
        s.user_id,
        s.item_type,
        s.item_subtype,
        s.points_earned,
        u.username,
        u.email,
        u.total_points
      FROM scans s
      JOIN users u ON s.user_id = u.user_id
      WHERE s.scan_id = ?
    `,
      [id]
    );

    if (scan.length === 0) {
      throw new Error('Scan not found');
    }

    const {
      user_id,
      item_type,
      item_subtype,
      points_earned,
      username,
      email,
      total_points,
    } = scan[0];

    // Award points to user (streak is now updated on scan SUBMISSION, not approval)
    // Only increment total_scans here since streak was already counted when user submitted
    await connection.query(
      `UPDATE users
       SET total_points = total_points + ?,
           lifetime_points = lifetime_points + ?,
           total_scans = total_scans + 1
       WHERE user_id = ?`,
      [points_earned, points_earned, user_id]
    );

    const newTotal = total_points + points_earned;

    // ==================== CHECK ACHIEVEMENTS ====================
    // After updating stats, check if user unlocked any achievements
    const newlyUnlocked = [];

    // Get updated user stats
    const [userStats] = await connection.execute(
      `SELECT total_scans, lifetime_points, current_streak_days FROM users WHERE user_id = ?`,
      [user_id]
    );
    const stats = userStats[0];

    // Get item type counts
    const [itemTypeCounts] = await connection.execute(
      `SELECT item_type, COUNT(*) as count FROM scans WHERE user_id = ? AND verification_status = 'approved' GROUP BY item_type`,
      [user_id]
    );
    const typeCounts = {};
    itemTypeCounts.forEach((row) => {
      typeCounts[row.item_type] = row.count;
    });

    // Get morning scans count
    const [morningScans] = await connection.execute(
      `SELECT COUNT(*) as count FROM scans WHERE user_id = ? AND verification_status = 'approved' AND HOUR(scan_timestamp) < 10`,
      [user_id]
    );
    const morningCount = morningScans[0].count;

    // Achievement conditions (matching database achievements table)
    const achievementConditions = [
      { id: 1, condition: stats.total_scans >= 1 }, // First Step - first scan
      { id: 2, condition: stats.total_scans >= 10 }, // Eco Warrior - 10 scans
      { id: 3, condition: stats.total_scans >= 100 }, // Century Club - 100 scans
      { id: 4, condition: (typeCounts['Plastic'] || 0) >= 50 }, // Plastic Hunter - 50 plastic items
      { id: 5, condition: stats.current_streak_days >= 7 }, // Week Streak - 7 day streak
      { id: 6, condition: stats.lifetime_points >= 1000 }, // Point Millionaire - 1000 points
    ];

    // Check and unlock achievements
    for (const ach of achievementConditions) {
      if (ach.condition) {
        const [existing] = await connection.execute(
          'SELECT * FROM user_achievements WHERE user_id = ? AND achievement_id = ?',
          [user_id, ach.id]
        );

        if (existing.length === 0) {
          // Unlock achievement
          await connection.execute(
            'INSERT INTO user_achievements (user_id, achievement_id, unlocked_at) VALUES (?, ?, NOW())',
            [user_id, ach.id]
          );

          // Get achievement details
          const [achDetails] = await connection.execute(
            'SELECT achievement_name, points_reward FROM achievements WHERE achievement_id = ?',
            [ach.id]
          );

          const achPointsReward = achDetails[0].points_reward;
          const achievementName = achDetails[0].achievement_name;

          // Award bonus points
          await connection.execute(
            'UPDATE users SET total_points = total_points + ?, lifetime_points = lifetime_points + ? WHERE user_id = ?',
            [achPointsReward, achPointsReward, user_id]
          );

          newlyUnlocked.push({
            achievement_name: achievementName,
            points_reward: achPointsReward,
          });

          console.log(`🏆 Achievement unlocked: ${achievementName} (+${achPointsReward} pts) for user ${username}`);
        }
      }
    }
    // ==================== END ACHIEVEMENT CHECK ====================

    // Commit all changes
    await connection.commit();

    console.log(`✅ Scan verified: scan_id=${id}, user=${username}, +${points_earned} pts`);

    // Then send email
    transporter
      .sendMail({
        from: process.env.SMTP_FROM,
        to: email,
        ...scanVerifiedEmail(username, item_type, item_subtype, points_earned, newTotal),
      })
      .then((info) => {
        console.log(`📧 Verification email sent to ${email}`);
      })
      .catch((err) => {
        console.error('❌ Verification email failed:', err.message);
      });

    res.json({
      success: true,
      message: 'Scan verified and user notified',
    });
  } catch (error) {
    await connection.rollback();
    console.error('Approve scan error:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to approve scan',
    });
  } finally {
    connection.release();
  }
});

/**
 * POST /api/admin/scans/:id/reject
 * Reject a scan (no points awarded)
 */
router.post('/scans/:id/reject', async (req, res) => {
  try {
    const { id } = req.params;
    const admin_id = req.user.user_id;

    // Same guard as the approve path. Rejecting twice would be harmless on its own
    // — no points move here — but without the status in the WHERE clause an already
    // approved scan could be flipped to 'rejected' while the points it granted stay
    // on the account, leaving the row and the balance permanently disagreeing.
    const [claim] = await db.query(
      `UPDATE scans
       SET verification_status = 'rejected',
           verified_by = ?,
           verified_at = NOW()
       WHERE scan_id = ? AND verification_status = 'pending'`,
      [admin_id, id]
    );

    if (claim.affectedRows === 0) {
      const [existing] = await db.query(
        'SELECT verification_status FROM scans WHERE scan_id = ?',
        [id]
      );

      if (existing.length === 0) {
        return res.status(404).json({
          success: false,
          message: 'Scan not found',
        });
      }

      return res.status(409).json({
        success: false,
        message: `Scan is already ${existing[0].verification_status} and cannot be rejected`,
      });
    }

    console.log(`❌ Scan rejected: scan_id=${id}, admin_id=${admin_id}`);

    // Points are never awarded for rejected scans (they were pending)

    res.json({
      success: true,
      message: 'Scan rejected',
    });
  } catch (error) {
    console.error('Reject scan error:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to reject scan',
    });
  }
});

module.exports = router;
