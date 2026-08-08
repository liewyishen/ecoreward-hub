const express = require('express');
const router = express.Router();
const db = require('../config/db');
const verifyToken = require('../middleware/verifyToken');

/**
 * GET /api/achievements
 * Get all achievements with user's unlock status
 */
router.get('/', verifyToken, async (req, res) => {
  try {
    const userId = req.user.user_id;

    // Get all achievements with user's unlock status
    const [allAchievements] = await db.execute(
      `SELECT
        a.achievement_id,
        a.achievement_name,
        a.description,
        a.requirement_type,
        a.requirement_value,
        a.points_reward,
        a.rarity,
        CASE
          WHEN ua.user_id IS NOT NULL THEN TRUE
          ELSE FALSE
        END as is_unlocked,
        ua.unlocked_at
      FROM achievements a
      LEFT JOIN user_achievements ua
        ON a.achievement_id = ua.achievement_id
        AND ua.user_id = ?
      ORDER BY a.achievement_id`,
      [userId]
    );

    // Convert TINYINT(1) to boolean
    const achievements = allAchievements.map((ach) => ({
      ...ach,
      is_unlocked: Boolean(ach.is_unlocked),
    }));

    const unlockedCount = achievements.filter((a) => a.is_unlocked).length;

    return res.status(200).json({
      success: true,
      data: achievements,
      unlockedCount,
      totalCount: achievements.length,
    });
  } catch (error) {
    console.error('Achievements fetch error:', error);
    return res.status(500).json({
      success: false,
      message: 'Failed to fetch achievements',
    });
  }
});

/**
 * POST /api/achievements/check
 * Check and auto-unlock achievements based on user stats
 * Called after each scan to see if user qualifies for new achievements
 */
router.post('/check', verifyToken, async (req, res) => {
  let connection;

  try {
    const userId = req.user.user_id;
    const newlyUnlocked = [];

    connection = await db.getConnection();
    await connection.beginTransaction();

    // Get user stats
    const [userStats] = await connection.execute(
      `SELECT
        total_scans,
        lifetime_points,
        current_streak_days,
        created_at
      FROM users WHERE user_id = ?`,
      [userId]
    );

    if (userStats.length === 0) {
      throw new Error('User not found');
    }

    const stats = userStats[0];

    // Get count of scans by item type
    const [itemTypeCounts] = await connection.execute(
      `SELECT item_type, COUNT(*) as count
       FROM scans
       WHERE user_id = ?
       GROUP BY item_type`,
      [userId]
    );

    const typeCounts = {};
    itemTypeCounts.forEach((row) => {
      typeCounts[row.item_type] = row.count;
    });

    // Get morning scans (before 10am)
    const [morningScans] = await connection.execute(
      `SELECT COUNT(*) as count
       FROM scans
       WHERE user_id = ? AND HOUR(scan_timestamp) < 10`,
      [userId]
    );

    const morningCount = morningScans[0].count;

    // Define achievement conditions (matching database achievements table)
    const achievementConditions = [
      { id: 1, condition: stats.total_scans >= 1 }, // First Step - first scan
      { id: 2, condition: stats.total_scans >= 10 }, // Eco Warrior - 10 scans
      { id: 3, condition: stats.total_scans >= 100 }, // Century Club - 100 scans
      { id: 4, condition: (typeCounts['Plastic'] || 0) >= 50 }, // Plastic Hunter - 50 plastic items
      { id: 5, condition: stats.current_streak_days >= 7 }, // Week Streak - 7 day streak
      { id: 6, condition: stats.lifetime_points >= 1000 }, // Point Millionaire - 1000 points
    ];

    // Check each achievement
    for (const ach of achievementConditions) {
      if (ach.condition) {
        // Check if already unlocked
        const [existing] = await connection.execute(
          'SELECT * FROM user_achievements WHERE user_id = ? AND achievement_id = ?',
          [userId, ach.id]
        );

        if (existing.length === 0) {
          // Unlock achievement
          await connection.execute(
            'INSERT INTO user_achievements (user_id, achievement_id, unlocked_at) VALUES (?, ?, NOW())',
            [userId, ach.id]
          );

          // Get achievement details for points reward
          const [achDetails] = await connection.execute(
            'SELECT achievement_name, points_reward FROM achievements WHERE achievement_id = ?',
            [ach.id]
          );

          const pointsReward = achDetails[0].points_reward;
          const achievementName = achDetails[0].achievement_name;

          // Award bonus points
          await connection.execute(
            'UPDATE users SET total_points = total_points + ?, lifetime_points = lifetime_points + ? WHERE user_id = ?',
            [pointsReward, pointsReward, userId]
          );

          newlyUnlocked.push({
            achievement_id: ach.id,
            achievement_name: achievementName,
            points_reward: pointsReward,
          });

          console.log(`🏆 Achievement unlocked for user ${userId}: ${achievementName} (+${pointsReward} points)`);
        }
      }
    }

    await connection.commit();

    return res.status(200).json({
      success: true,
      newlyUnlocked,
      message:
        newlyUnlocked.length > 0
          ? `${newlyUnlocked.length} new achievement(s) unlocked!`
          : 'No new achievements',
    });
  } catch (error) {
    if (connection) {
      await connection.rollback();
    }
    console.error('Achievement check error:', error);
    return res.status(500).json({
      success: false,
      message: 'Failed to check achievements',
    });
  } finally {
    if (connection) {
      connection.release();
    }
  }
});

module.exports = router;
