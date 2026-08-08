const welcomeEmail = (username, bonusPoints) => ({
  subject: 'Welcome to EcoReward Hub!',
  html: `
    <!DOCTYPE html>
    <html>
    <head>
      <style>
        body { font-family: Arial, sans-serif; line-height: 1.6; color: #333; }
        .container { max-width: 600px; margin: 0 auto; padding: 20px; }
        .header { background: linear-gradient(135deg, #2D5016 0%, #1f3810 100%);
                  color: white; padding: 30px; text-align: center; border-radius: 8px 8px 0 0; }
        .content { background: #f5f5f5; padding: 30px; }
        .highlight { background: #F4A460; color: white; padding: 15px;
                    border-radius: 8px; text-align: center; font-size: 24px;
                    font-weight: bold; margin: 20px 0; }
        .footer { background: #2D5016; color: white; padding: 20px;
                 text-align: center; border-radius: 0 0 8px 8px; font-size: 12px; }
      </style>
    </head>
    <body>
      <div class="container">
        <div class="header">
          <h1>🌱 Welcome to EcoReward Hub!</h1>
          <p>Start your journey to a greener planet</p>
        </div>

        <div class="content">
          <h2>Hi ${username}! 👋</h2>
          <p>Thank you for joining our eco-community! We're excited to have you onboard.</p>

          <div class="highlight">
            🎉 You've been awarded ${bonusPoints} bonus points!
          </div>

          <p><strong>What you can do:</strong></p>
          <ul>
            <li>📷 Scan recyclable items using AI recognition</li>
            <li>🪙 Earn points for every item you recycle</li>
            <li>🎁 Redeem rewards (Touch 'n Go cashback & more)</li>
            <li>🏆 Unlock achievements and climb the leaderboard</li>
          </ul>

          <p style="margin-top: 30px;">
            <a href="http://localhost:5173/dashboard"
               style="background: #2D5016; color: white; padding: 12px 30px;
                      text-decoration: none; border-radius: 6px; display: inline-block;">
              Start Recycling Now →
            </a>
          </p>
        </div>

        <div class="footer">
          <p>EcoReward Hub - Recycle. Earn. Repeat.</p>
          <p>Every small action creates massive change 🌍</p>
        </div>
      </div>
    </body>
    </html>
  `,
});

const rewardApprovedEmail = (username, rewardName, voucherCode, pointsSpent) => ({
  subject: 'Your Reward Has Been Approved!',
  html: `
    <!DOCTYPE html>
    <html>
    <head>
      <style>
        body { font-family: Arial, sans-serif; line-height: 1.6; color: #333; }
        .container { max-width: 600px; margin: 0 auto; padding: 20px; }
        .header { background: linear-gradient(135deg, #2D5016 0%, #1f3810 100%);
                  color: white; padding: 30px; text-align: center; border-radius: 8px 8px 0 0; }
        .content { background: #f5f5f5; padding: 30px; }
        .voucher-box { background: #F4A460; color: white; padding: 20px;
                      border-radius: 8px; text-align: center; margin: 20px 0; }
        .voucher-code { font-size: 32px; font-weight: bold; letter-spacing: 3px;
                       font-family: monospace; margin: 15px 0; }
        .info-box { background: white; padding: 15px; border-radius: 6px;
                   border-left: 4px solid #2D5016; margin: 15px 0; }
        .footer { background: #2D5016; color: white; padding: 20px;
                 text-align: center; border-radius: 0 0 8px 8px; font-size: 12px; }
      </style>
    </head>
    <body>
      <div class="container">
        <div class="header">
          <h1>🎉 Reward Approved!</h1>
        </div>

        <div class="content">
          <h2>Great news, ${username}!</h2>
          <p>Your reward redemption has been approved by our admin team.</p>

          <div class="info-box">
            <strong>Reward:</strong> ${rewardName}<br>
            <strong>Points Used:</strong> ${pointsSpent} points
          </div>

          <div class="voucher-box">
            <p style="margin: 0 0 10px 0; font-size: 14px;">Your Voucher Code:</p>
            <div class="voucher-code">${voucherCode}</div>
            <p style="margin: 10px 0 0 0; font-size: 12px;">
              📸 Screenshot this code or copy it now
            </p>
          </div>

          <div class="info-box">
            <strong>How to use:</strong>
            <ol style="margin: 10px 0;">
              <li>Copy the voucher code above</li>
              <li>Open your Touch 'n Go app (or relevant platform)</li>
              <li>Navigate to "Redeem Voucher"</li>
              <li>Enter the code and enjoy your reward!</li>
            </ol>
          </div>

          <p style="color: #666; font-size: 14px; margin-top: 20px;">
            <strong>Note:</strong> This code is valid for 30 days from the date of approval.
          </p>
        </div>

        <div class="footer">
          <p>Thank you for making the planet greener! 🌍</p>
          <p>EcoReward Hub Team</p>
        </div>
      </div>
    </body>
    </html>
  `,
});

const scanVerifiedEmail = (username, itemType, itemSubtype, pointsEarned, newTotal) => ({
  subject: 'Your Scan Has Been Verified!',
  html: `
    <!DOCTYPE html>
    <html>
    <head>
      <style>
        body { font-family: Arial, sans-serif; line-height: 1.6; color: #333; }
        .container { max-width: 600px; margin: 0 auto; padding: 20px; }
        .header { background: linear-gradient(135deg, #2D5016 0%, #A8D5BA 100%);
                  color: white; padding: 30px; text-align: center; border-radius: 8px 8px 0 0; }
        .content { background: #f5f5f5; padding: 30px; }
        .points-box { background: #F4A460; color: white; padding: 20px;
                     border-radius: 8px; text-align: center; margin: 20px 0; }
        .item-box { background: white; padding: 15px; border-radius: 6px;
                   border-left: 4px solid #2D5016; margin: 15px 0; }
        .footer { background: #2D5016; color: white; padding: 20px;
                 text-align: center; border-radius: 0 0 8px 8px; font-size: 12px; }
      </style>
    </head>
    <body>
      <div class="container">
        <div class="header">
          <h1>🎉 Scan Verified!</h1>
          <p>Your recycling effort has been confirmed</p>
        </div>

        <div class="content">
          <h2>Great work, ${username}! 🌱</h2>
          <p>Our team has verified your recycling submission and awarded your points.</p>

          <div class="item-box">
            <strong>Item Verified:</strong><br>
            ${itemType} - ${itemSubtype}
          </div>

          <div class="points-box">
            <p style="margin: 0 0 10px 0; font-size: 14px;">Points Earned</p>
            <div style="font-size: 36px; font-weight: bold; margin: 10px 0;">
              +${pointsEarned} 🪙
            </div>
            <p style="margin: 10px 0 0 0; font-size: 16px;">
              New Balance: ${newTotal} points
            </p>
          </div>

          <div class="item-box">
            💚 Impact: Every item you recycle contributes to a cleaner planet.
            Keep up the amazing work!
          </div>

          <p style="margin-top: 30px; text-align: center;">
            <a href="http://localhost:5173/rewards"
               style="background: #2D5016; color: white; padding: 12px 30px;
                      text-decoration: none; border-radius: 6px; display: inline-block;">
              Redeem Your Points →
            </a>
          </p>
        </div>

        <div class="footer">
          <p>Thank you for being an eco-warrior! 🌍</p>
          <p>EcoReward Hub - Every scan makes a difference</p>
        </div>
      </div>
    </body>
    </html>
  `,
});

module.exports = { welcomeEmail, rewardApprovedEmail, scanVerifiedEmail };
