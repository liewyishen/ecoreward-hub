const express = require('express');
const router = express.Router();
const { GoogleGenAI } = require('@google/genai');
const db = require('../config/db');
const verifyToken = require('../middleware/verifyToken');

/**
 * AI Chatbot Route with Gemini Function Calling
 *
 * This chatbot uses Google's Gemini AI to provide conversational commerce features:
 * - Natural language understanding
 * - Function calling to execute real actions (check points, redeem rewards, etc.)
 * - Context-aware responses based on conversation history
 *
 * Key Features:
 * 1. getUserPoints - Check user's points balance
 * 2. getAvailableRewards - Browse all available rewards
 * 3. getAffordableRewards - Check what user can afford
 * 4. redeemReward - Process reward redemption with confirmation
 */

// Initialize Gemini AI with API key
const ai = new GoogleGenAI({
  apiKey: process.env.GEMINI_API_KEY,
});

/**
 * Function Implementations
 * These functions are called by Gemini AI when user intent matches
 */
const functions = {
  /**
   * Get user's current points balance and lifetime earnings
   * Called when: User asks about points, balance, or earnings
   *
   * @param {number} userId - User ID from JWT token
   * @returns {Object} Points data or error
   */
  getUserPoints: async (userId) => {
    try {
      const [rows] = await db.execute(
        'SELECT total_points, lifetime_points FROM users WHERE user_id = ?',
        [userId]
      );

      if (rows.length === 0) {
        return { error: 'User not found' };
      }

      return {
        current_points: rows[0].total_points,
        lifetime_points: rows[0].lifetime_points,
      };
    } catch (error) {
      console.error('getUserPoints error:', error);
      return { error: 'Failed to fetch points' };
    }
  },

  /**
   * Get all available rewards in the catalog
   * Called when: User wants to browse rewards, see what's available
   *
   * @returns {Object} List of active rewards
   */
  getAvailableRewards: async () => {
    try {
      const [rows] = await db.execute(
        `SELECT
          reward_id,
          reward_name,
          description,
          points_cost,
          reward_type
        FROM rewards
        WHERE is_active = 1
        ORDER BY points_cost ASC`
      );

      return { rewards: rows };
    } catch (error) {
      console.error('getAvailableRewards error:', error);
      return { error: 'Failed to fetch rewards', rewards: [] };
    }
  },

  /**
   * Get rewards that user can currently afford based on their points
   * Called when: User asks what they can buy, what's affordable
   *
   * @param {number} userId - User ID from JWT token
   * @returns {Object} Affordable rewards and current points
   */
  getAffordableRewards: async (userId) => {
    try {
      // Get user's current points
      const [user] = await db.execute(
        'SELECT total_points FROM users WHERE user_id = ?',
        [userId]
      );

      if (user.length === 0) {
        return { error: 'User not found' };
      }

      const userPoints = user[0].total_points;

      // Get rewards user can afford
      const [rewards] = await db.execute(
        `SELECT
          reward_id,
          reward_name,
          description,
          points_cost,
          reward_type
        FROM rewards
        WHERE is_active = 1 AND points_cost <= ?
        ORDER BY points_cost DESC`,
        [userPoints]
      );

      return {
        current_points: userPoints,
        affordable_rewards: rewards,
        count: rewards.length,
      };
    } catch (error) {
      console.error('getAffordableRewards error:', error);
      return { error: 'Failed to fetch affordable rewards' };
    }
  },

  /**
   * Process reward redemption
   * Called when: User confirms they want to redeem a specific reward
   *
   * This function:
   * 1. Validates reward exists and is active
   * 2. Checks user has enough points
   * 3. Deducts points from user account
   * 4. Creates redemption record with pending status
   * 5. Generates unique redemption code
   *
   * @param {number} userId - User ID from JWT token
   * @param {number} rewardId - ID of reward to redeem
   * @returns {Object} Redemption result with success status
   */
  redeemReward: async (userId, rewardId) => {
    const connection = await db.getConnection();
    try {
      // Start transaction to ensure data consistency
      await connection.beginTransaction();

      // Get reward details
      const [reward] = await connection.execute(
        `SELECT
          reward_id,
          reward_name,
          points_cost,
          stock_quantity
        FROM rewards
        WHERE reward_id = ? AND is_active = 1`,
        [rewardId]
      );

      // Validate reward exists
      if (reward.length === 0) {
        await connection.rollback();
        return {
          success: false,
          message: 'Reward not found or not available',
        };
      }

      // Check stock (if limited)
      if (reward[0].stock_quantity !== -1 && reward[0].stock_quantity <= 0) {
        await connection.rollback();
        return {
          success: false,
          message: 'This reward is currently out of stock',
        };
      }

      // Get user's current points
      const [user] = await connection.execute(
        'SELECT total_points FROM users WHERE user_id = ?',
        [userId]
      );

      // Validate user has enough points
      if (user[0].total_points < reward[0].points_cost) {
        await connection.rollback();
        return {
          success: false,
          message: `Not enough points. You have ${user[0].total_points} but need ${reward[0].points_cost}.`,
        };
      }

      // Deduct points from user account
      await connection.execute(
        'UPDATE users SET total_points = total_points - ? WHERE user_id = ?',
        [reward[0].points_cost, userId]
      );

      // Update stock if limited
      if (reward[0].stock_quantity !== -1) {
        await connection.execute(
          'UPDATE rewards SET stock_quantity = stock_quantity - 1 WHERE reward_id = ?',
          [rewardId]
        );
      }

      // Generate unique redemption code
      const redemptionCode = `ECO${Date.now()}${Math.random()
        .toString(36)
        .substring(2, 8)
        .toUpperCase()}`;

      // Create redemption record with pending status (awaits admin approval)
      await connection.execute(
        `INSERT INTO redemptions
        (user_id, reward_id, points_spent, redemption_code, status)
        VALUES (?, ?, ?, ?, ?)`,
        [userId, rewardId, reward[0].points_cost, redemptionCode, 'pending']
      );

      // Commit transaction
      await connection.commit();

      // Calculate new balance
      const newBalance = user[0].total_points - reward[0].points_cost;

      return {
        success: true,
        message: `Successfully redeemed "${reward[0].reward_name}"!`,
        reward_name: reward[0].reward_name,
        points_spent: reward[0].points_cost,
        new_balance: newBalance,
        status: 'Pending admin approval',
        redemption_code: redemptionCode,
      };
    } catch (error) {
      // Rollback transaction on error
      await connection.rollback();
      console.error('redeemReward error:', error);
      return {
        success: false,
        message: 'Redemption failed. Please try again.',
      };
    } finally {
      // Release connection back to pool
      connection.release();
    }
  },
};

/**
 * Function Declarations for Gemini
 * These tell Gemini AI what functions are available and when to call them
 */
const functionDeclarations = [
  {
    name: 'getUserPoints',
    description:
      'REQUIRED when user asks: "how many points", "my points", "points balance", "check points". Returns actual point balance from database. DO NOT guess points - always call this function.',
    parameters: {
      type: 'OBJECT',
      properties: {},
      required: [],
    },
  },
  {
    name: 'getAvailableRewards',
    description:
      'REQUIRED when user asks: "show all rewards", "what rewards exist", "browse rewards", "see rewards catalog". Returns complete list of all rewards from database.',
    parameters: {
      type: 'OBJECT',
      properties: {},
      required: [],
    },
  },
  {
    name: 'getAffordableRewards',
    description:
      'REQUIRED when user asks: "what can I buy", "what can I afford", "what can I get", "show affordable rewards". Returns only rewards user has enough points for.',
    parameters: {
      type: 'OBJECT',
      properties: {},
      required: [],
    },
  },
  {
    name: 'redeemReward',
    description:
      'Process reward redemption. Only call after user confirms they want to redeem. Never call without explicit confirmation.',
    parameters: {
      type: 'OBJECT',
      properties: {
        rewardId: {
          type: 'NUMBER',
          description: 'The reward_id from the rewards list shown to user',
        },
      },
      required: ['rewardId'],
    },
  },
];

/**
 * POST /api/chatbot/message
 * Main chatbot endpoint - handles conversation and function calling
 *
 * Flow:
 * 1. Receive user message and conversation history
 * 2. Build context with system prompt and history
 * 3. Send to Gemini with function calling enabled
 * 4. If Gemini calls a function, execute it and send result back
 * 5. Return final natural language response to user
 *
 * Requires: JWT authentication
 */
router.post('/message', verifyToken, async (req, res) => {
  try {
    const { message, history = [] } = req.body;
    const userId = req.user.user_id;
    const username = req.user.username;

    // Validate input
    if (!message || message.trim().length === 0) {
      return res.status(400).json({
        success: false,
        message: 'Message is required',
      });
    }

    // Build conversation history for context
    // Keep last 10 messages to maintain context while avoiding token limits
    const conversationHistory = history.slice(-10).map((msg) => ({
      role: msg.role === 'user' ? 'user' : 'model',
      parts: [{ text: msg.content }],
    }));

    // System prompt - defines chatbot personality and capabilities
    const systemPrompt = `You are EcoBot for EcoReward Hub (Malaysia). Current user: ${username}

MANDATORY RULES:
1. When user asks about points/balance -> MUST call getUserPoints()
2. When user asks what they can buy/afford -> MUST call getAffordableRewards()
3. When user asks to see all rewards -> MUST call getAvailableRewards()
4. When user wants to redeem -> confirm first, then call redeemReward(id)

NEVER guess or make up points or rewards data. You MUST use the functions.

After calling a function, briefly explain the result in 1-2 friendly sentences with emojis 🌱♻️.`;

    // Use Gemini AI to analyze user intent first
    console.log('🤖 Analyzing user intent with Gemini...');

    const intentAnalysisPrompt = `Analyze this user message and determine intent:

User message: "${message}"

Conversation context (last 2 messages):
${history.slice(-2).map(m => `${m.role}: ${m.content}`).join('\n')}

Classify the intent as ONE of:
1. "getUserPoints" - User wants to check their points/balance
2. "getAffordableRewards" - User asks what they can buy/afford
3. "getAvailableRewards" - User wants to see all rewards/browse catalog
4. "redeemReward" - User wants to purchase/redeem a specific reward
5. "confirmRedemption" - User is confirming a previous redemption request (saying yes/ok/confirm)
6. "general" - General question about recycling, greetings, or other topics

If intent is "redeemReward" or "confirmRedemption", also extract:
- reward_id (1-5) if you can identify which reward
- reward_name if mentioned

Respond in JSON format:
{
  "intent": "intentName",
  "reward_id": null or number,
  "reward_name": "name or null",
  "confidence": "high/medium/low"
}`;

    const intentResponse = await ai.models.generateContent({
      model: 'gemini-2.5-flash',
      contents: [{ role: 'user', parts: [{ text: intentAnalysisPrompt }] }],
    });

    // Extract intent analysis
    let intentAnalysis = null;
    try {
      const intentText = intentResponse.candidates[0].content.parts[0].text;
      console.log('🔍 Raw intent response:', intentText);

      // Extract JSON from response (might be wrapped in markdown)
      const jsonMatch = intentText.match(/\{[\s\S]*\}/);
      if (jsonMatch) {
        intentAnalysis = JSON.parse(jsonMatch[0]);
        console.log('✅ Parsed intent:', intentAnalysis);
      }
    } catch (error) {
      console.warn('⚠️  Failed to parse intent:', error.message);
    }

    // Execute function based on Gemini's intent analysis
    let detectedFunction = null;
    let functionResult = null;

    console.log('🔍 About to check intent:', intentAnalysis?.intent);

    if (intentAnalysis && intentAnalysis.intent !== 'general') {
      const intent = intentAnalysis.intent;
      console.log(`🎯 Gemini detected intent: ${intent}`);

      if (intent === 'getUserPoints') {
        detectedFunction = 'getUserPoints';
        functionResult = await functions.getUserPoints(userId);
        console.log('✅ Function result:', functionResult);
      } else if (intent === 'getAffordableRewards') {
        detectedFunction = 'getAffordableRewards';
        const affordableResult = await functions.getAffordableRewards(userId);
        const allRewardsResult = await functions.getAvailableRewards();

        functionResult = {
          current_points: affordableResult.current_points,
          affordable_rewards: affordableResult.affordable_rewards,
          all_rewards: allRewardsResult.rewards,
          affordable_count: affordableResult.count,
          total_count: allRewardsResult.rewards.length,
        };
        console.log('✅ Combined result:', functionResult);
      } else if (intent === 'getAvailableRewards') {
        detectedFunction = 'getAvailableRewards';
        functionResult = await functions.getAvailableRewards();
        console.log('✅ Function result:', functionResult);
      } else if (intent === 'confirmRedemption' || intent === 'redeemReward') {
      console.log('🎯 Detected: potential redemption request');

      // Define lowercase message for pattern matching
      const lowerMessage = message.toLowerCase();

      // Try to extract reward identifier from message
      let rewardId = null;
      let rewardName = null;

      // Check for reward_id pattern (e.g., "reward 5", "id 5")
      const idMatch = lowerMessage.match(/(?:reward|id)\s*[:#]?\s*(\d+)/i);
      if (idMatch) {
        rewardId = parseInt(idMatch[1]);
      }

      // Check for reward names
      if (!rewardId) {
        if (lowerMessage.match(/coffee|voucher/i)) {
          rewardName = 'Coffee Voucher';
          rewardId = 5;
        } else if (lowerMessage.match(/tote\s*bag|bag/i)) {
          rewardName = 'Eco Tote Bag';
          rewardId = 4;
        } else if (lowerMessage.match(/rm\s*20|20.*touch|touch.*20/i)) {
          rewardName = 'RM20 Touch n Go';
          rewardId = 3;
        } else if (lowerMessage.match(/rm\s*10|10.*touch|touch.*10/i)) {
          rewardName = 'RM10 Touch n Go';
          rewardId = 2;
        } else if (lowerMessage.match(/rm\s*5|5.*touch|touch.*5/i)) {
          rewardName = 'RM5 Touch n Go';
          rewardId = 1;
        }
      }

      // Check if this is a confirmation message
      const isConfirmation = lowerMessage.match(/^(yes|yeah|yep|ok|okay|sure|confirm|proceed|do it)/i);

      // If user is confirming but we don't have rewardId in current message,
      // try to extract from conversation history
      if (isConfirmation && !rewardId && history.length > 0) {
        console.log('🔍 User confirmed but no reward in message, checking history...');

        // Look through recent history (last 3 messages) for reward mentions
        const recentHistory = history.slice(-3).reverse();
        for (const msg of recentHistory) {
          if (msg.role === 'assistant' || msg.role === 'model') {
            const historyMsg = msg.content.toLowerCase();

            if (historyMsg.match(/coffee|voucher/i)) {
              rewardId = 5;
              rewardName = 'Coffee Voucher';
              console.log('📌 Found Coffee Voucher in history');
              break;
            } else if (historyMsg.match(/tote\s*bag|bag/i)) {
              rewardId = 4;
              rewardName = 'Eco Tote Bag';
              console.log('📌 Found Eco Tote Bag in history');
              break;
            } else if (historyMsg.match(/rm\s*20|20.*touch/i)) {
              rewardId = 3;
              rewardName = 'RM20 Touch n Go';
              console.log('📌 Found RM20 Touch n Go in history');
              break;
            } else if (historyMsg.match(/rm\s*10|10.*touch/i)) {
              rewardId = 2;
              rewardName = 'RM10 Touch n Go';
              console.log('📌 Found RM10 Touch n Go in history');
              break;
            } else if (historyMsg.match(/rm\s*5|5.*touch/i)) {
              rewardId = 1;
              rewardName = 'RM5 Touch n Go';
              console.log('📌 Found RM5 Touch n Go in history');
              break;
            }
          }
        }
      }

      if (rewardId && isConfirmation) {
        // User is confirming redemption - execute it
        detectedFunction = 'redeemReward';
        console.log(`✅ Confirmed redemption for reward_id: ${rewardId}`);
        functionResult = await functions.redeemReward(userId, rewardId);
        console.log('✅ Redemption result:', functionResult);
      } else if (rewardId) {
        // User mentioned a specific reward - get details for confirmation
        console.log(`🛒 User wants to redeem reward_id: ${rewardId}`);
        detectedFunction = 'confirmRedemption';

        // Get reward details and user points
        const [rewardRows] = await db.execute(
          'SELECT * FROM rewards WHERE reward_id = ? AND is_active = 1',
          [rewardId]
        );
        const pointsResult = await functions.getUserPoints(userId);

        if (rewardRows.length > 0) {
          functionResult = {
            reward: rewardRows[0],
            user_points: pointsResult.current_points,
            can_afford: pointsResult.current_points >= rewardRows[0].points_cost,
            needs_confirmation: true,
          };
        } else {
          functionResult = { error: 'Reward not found' };
        }
      } // Close the else-if (rewardId) block
    } // Close the else-if (intent === 'confirmRedemption' || intent === 'redeemReward') block
  } // Close the main if (intentAnalysis && intentAnalysis.intent !== 'general') block

    console.log('🔍 Check point - detectedFunction:', detectedFunction, 'functionResult:', !!functionResult);

    // If we manually called a function, skip Gemini function calling
    // and directly format the result
    if (detectedFunction && functionResult) {
      console.log('📤 Sending function result to Gemini for formatting...');

      // Build prompt with function result
      let promptWithResult = `User asked: "${message}"

I called ${detectedFunction}() and got this result from the database:
${JSON.stringify(functionResult, null, 2)}

Please format this data in a friendly, natural response (2-3 sentences max). Use emojis 🌱♻️.`;

      // Special handling for affordable rewards
      if (detectedFunction === 'getAffordableRewards') {
        promptWithResult = `User asked: "${message}"

Database results:
- User has: ${functionResult.current_points} points
- Can afford: ${functionResult.affordable_count} rewards
- Total available: ${functionResult.total_count} rewards

${
  functionResult.affordable_count > 0
    ? `Affordable rewards:\n${JSON.stringify(functionResult.affordable_rewards, null, 2)}`
    : `No affordable rewards yet. All rewards:\n${JSON.stringify(functionResult.all_rewards, null, 2)}\n\nTell the user how many more points they need for the cheapest reward.`
}

Format this as a friendly response (2-3 sentences). If they can't afford anything, encourage them and show what they're working towards! Use emojis 🌱♻️🎁.`;
      }

      // Special handling for redemption confirmation
      if (detectedFunction === 'confirmRedemption') {
        if (functionResult.error) {
          promptWithResult = `User wanted to redeem a reward but: ${functionResult.error}

Tell them the reward is not available. Keep it brief and helpful.`;
        } else {
          promptWithResult = `User wants to redeem: ${functionResult.reward.reward_name}

Reward details:
- Name: ${functionResult.reward.reward_name}
- Cost: ${functionResult.reward.points_cost} points
- User has: ${functionResult.user_points} points
- Can afford: ${functionResult.can_afford}

Ask the user to confirm if they want to proceed with this redemption. Make it clear they need to say "yes" to confirm. Keep it friendly and brief (2-3 sentences). Use emojis ☕🎁✅.`;
        }
      }

      // Special handling for successful redemption
      if (detectedFunction === 'redeemReward') {
        if (functionResult.success) {
          promptWithResult = `Redemption successful!

Details:
- Reward: ${functionResult.reward_name}
- Points spent: ${functionResult.points_spent}
- New balance: ${functionResult.new_balance}
- Redemption code: ${functionResult.redemption_code}
- Status: ${functionResult.status}

Congratulate the user and tell them their redemption code. Mention it's pending admin approval. Keep it brief and exciting! Use emojis 🎉✅🎁.`;
        } else {
          promptWithResult = `Redemption failed: ${functionResult.message}

Tell the user what went wrong and be supportive. Suggest they check their points or try a different reward.`;
        }
      }

      console.log('📤 Sending to Gemini for formatting...');
      const response = await ai.models.generateContent({
        model: 'gemini-2.5-flash',
        contents: [
          {
            role: 'user',
            parts: [{ text: promptWithResult }],
          },
        ],
      });

      console.log('✅ Got formatting response from Gemini');

      // Extract text response
      let textResponse = '';
      if (response.candidates?.[0]?.content?.parts) {
        textResponse = response.candidates[0].content.parts
          .filter((part) => part.text)
          .map((part) => part.text)
          .join('');
      }

      console.log('📨 Sending response to client:', textResponse.substring(0, 100) + '...');

      return res.status(200).json({
        success: true,
        data: {
          message: textResponse,
          functionResult: {
            type: detectedFunction,
            data: functionResult,
          },
        },
      });
    } else {
      // Normal conversation flow (no function detected)
      const contents = [
      ...conversationHistory,
      {
        role: 'user',
        parts: [{ text: message }],
      },
    ];

    // Call Gemini API without function calling for general questions
    console.log('🤖 Calling Gemini AI for general conversation...');

    const response = await ai.models.generateContent({
      model: 'gemini-2.5-flash',
      systemInstruction: {
        parts: [{ text: systemPrompt }],
      },
      contents: contents,
    });

    // Extract text from response for general conversation
    let textResponse = '';
    if (response.candidates?.[0]?.content?.parts) {
      textResponse = response.candidates[0].content.parts
        .filter((part) => part.text)
        .map((part) => part.text)
        .join('');
    }

      return res.status(200).json({
        success: true,
        data: {
          message: textResponse || 'Sorry, I could not generate a response.',
        },
      });
    }
  } catch (error) {
    console.error('❌ Chatbot error:', error);

    return res.status(500).json({
      success: false,
      message: 'Chatbot encountered an error. Please try again.',
      error: process.env.NODE_ENV === 'development' ? error.message : undefined,
    });
  }
});

module.exports = router;
