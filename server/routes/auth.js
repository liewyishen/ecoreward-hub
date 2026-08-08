const express = require('express');
const router = express.Router();
const bcrypt = require('bcrypt');
const jwt = require('jsonwebtoken');
const passport = require('passport');
const GoogleStrategy = require('passport-google-oauth20').Strategy;
const multer = require('multer');
const path = require('path');
const fs = require('fs');
const db = require('../config/db');
const transporter = require('../config/email');
const { welcomeEmail } = require('../utils/emailTemplates');
require('dotenv').config();

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
    const timestamp = Date.now();
    const ext = path.extname(file.originalname);
    cb(null, `profile_new_${timestamp}${ext}`);
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

// ============================================
// PASSPORT GOOGLE OAUTH CONFIGURATION
// ============================================

passport.use(
  new GoogleStrategy(
    {
      clientID: process.env.GOOGLE_CLIENT_ID,
      clientSecret: process.env.GOOGLE_CLIENT_SECRET,
      callbackURL: process.env.GOOGLE_CALLBACK_URL,
    },
    async (accessToken, refreshToken, profile, done) => {
      try {
        // Check if user exists by google_id
        const [existingUsers] = await db.query(
          'SELECT * FROM users WHERE google_id = ?',
          [profile.id]
        );

        if (existingUsers.length > 0) {
          // User exists, return user
          return done(null, existingUsers[0]);
        }

        // Check if user exists by email
        const [emailUsers] = await db.query(
          'SELECT * FROM users WHERE email = ?',
          [profile.emails[0].value]
        );

        if (emailUsers.length > 0) {
          // Link Google account to existing user
          await db.query('UPDATE users SET google_id = ? WHERE user_id = ?', [
            profile.id,
            emailUsers[0].user_id,
          ]);
          return done(null, emailUsers[0]);
        }

        // Create new user with welcome bonus
        const username = profile.displayName.replace(/\s/g, '_') + Math.floor(Math.random() * 1000);
        const profilePicture = profile.photos[0]?.value || null;
        const WELCOME_BONUS = 150;

        const [result] = await db.query(
          'INSERT INTO users (username, email, google_id, profile_picture, total_points, lifetime_points) VALUES (?, ?, ?, ?, ?, ?)',
          [username, profile.emails[0].value, profile.id, profilePicture, WELCOME_BONUS, WELCOME_BONUS]
        );

        const [newUser] = await db.query(
          'SELECT * FROM users WHERE user_id = ?',
          [result.insertId]
        );

        // Send welcome email (non-blocking, fire-and-forget)
        const userEmail = profile.emails[0].value;
        console.log(`📧 Attempting to send welcome email to Google user: ${userEmail}`);
        transporter
          .sendMail({
            from: process.env.SMTP_FROM,
            to: userEmail,
            ...welcomeEmail(username, WELCOME_BONUS),
          })
          .then((info) => {
            console.log(`✅ Welcome email sent successfully to Google user ${userEmail}`);
            console.log(`📬 Message ID: ${info.messageId}`);
          })
          .catch((err) => {
            console.error('❌ Welcome email failed for Google user:', err.message);
          });

        return done(null, newUser[0]);
      } catch (error) {
        return done(error, null);
      }
    }
  )
);

// Serialize user to session
passport.serializeUser((user, done) => {
  done(null, user.user_id);
});

// Deserialize user from session
passport.deserializeUser(async (id, done) => {
  try {
    const [users] = await db.query('SELECT * FROM users WHERE user_id = ?', [id]);
    done(null, users[0]);
  } catch (error) {
    done(error, null);
  }
});

// ============================================
// HELPER FUNCTIONS
// ============================================

/**
 * Generate JWT token for user
 * Token expires in 7 days
 */
const generateToken = (userId, email, role = 'user') => {
  return jwt.sign(
    { user_id: userId, email, role },
    process.env.JWT_SECRET,
    { expiresIn: '7d' }
  );
};

/**
 * Validate email format
 */
const isValidEmail = (email) => {
  const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
  return emailRegex.test(email);
};

/**
 * Validate username format (3-20 chars, alphanumeric + underscore)
 */
const isValidUsername = (username) => {
  const usernameRegex = /^[a-zA-Z0-9_]{3,20}$/;
  return usernameRegex.test(username);
};

// ============================================
// AUTHENTICATION ROUTES
// ============================================

/**
 * POST /api/auth/register
 * Register new user with email and password
 */
router.post('/register', upload.single('profile_picture'), async (req, res) => {
  const connection = await db.getConnection();

  try {
    await connection.beginTransaction();

    // Debug: Log what we received
    console.log('📝 Registration request body:', req.body);
    console.log('📎 File uploaded:', req.file ? 'Yes' : 'No');

    // Check if req.body exists
    if (!req.body || typeof req.body !== 'object') {
      return res.status(400).json({
        success: false,
        message: 'Invalid request format. Please ensure you are sending form data correctly.',
      });
    }

    // NOTE: role is never taken from the request body. Self-service admin
    // registration was possible before this; privilege escalation now requires
    // direct database access.
    const { username, email, password } = req.body;

    // Get profile picture path from uploaded file (if any)
    const profilePicture = req.file ? `/uploads/profiles/${req.file.filename}` : null;

    // Validate required fields
    if (!username || !email || !password) {
      return res.status(400).json({
        success: false,
        message: 'Username, email, and password are required',
      });
    }

    // Validate username format
    if (!isValidUsername(username)) {
      return res.status(400).json({
        success: false,
        message: 'Username must be 3-20 characters, alphanumeric and underscore only',
      });
    }

    // Validate email format
    if (!isValidEmail(email)) {
      return res.status(400).json({
        success: false,
        message: 'Please enter a valid email address',
      });
    }

    // Validate password length
    if (password.length < 6) {
      return res.status(400).json({
        success: false,
        message: 'Password must be at least 6 characters',
      });
    }

    // Check if username already exists (case-insensitive)
    const [existingUsername] = await connection.query(
      'SELECT user_id FROM users WHERE LOWER(username) = LOWER(?)',
      [username]
    );

    if (existingUsername.length > 0) {
      return res.status(409).json({
        success: false,
        message: 'Username is already taken',
      });
    }

    // Check if email already exists
    const [existingEmail] = await connection.query(
      'SELECT user_id FROM users WHERE email = ?',
      [email]
    );

    if (existingEmail.length > 0) {
      return res.status(409).json({
        success: false,
        message: 'Email is already registered',
      });
    }

    // Hash password with bcrypt (10 salt rounds)
    const passwordHash = await bcrypt.hash(password, 10);

    // Every account created through this endpoint is a regular user.
    // Admin accounts are provisioned by updating users.role directly in the DB.
    const role = 'user';

    // Welcome bonus points
    const WELCOME_BONUS = 150;

    // Insert new user into database WITH initial bonus points
    const [result] = await connection.query(
      'INSERT INTO users (username, email, password_hash, profile_picture, role, total_points, lifetime_points) VALUES (?, ?, ?, ?, ?, ?, ?)',
      [username, email, passwordHash, profilePicture || null, role, WELCOME_BONUS, WELCOME_BONUS]
    );

    const userId = result.insertId;

    // Commit database changes FIRST
    await connection.commit();

    // THEN send welcome email (non-blocking, fire-and-forget)
    console.log(`📧 Attempting to send welcome email to: ${email}`);
    transporter
      .sendMail({
        from: process.env.SMTP_FROM,
        to: email,
        ...welcomeEmail(username, WELCOME_BONUS),
      })
      .then((info) => {
        console.log(`✅ Welcome email sent successfully to ${email}`);
        console.log(`📬 Message ID: ${info.messageId}`);
      })
      .catch((err) => {
        console.error('❌ Welcome email failed:', err.message);
        // Don't fail registration if email fails
      });

    // Return success response
    res.status(201).json({
      success: true,
      message: `Welcome ${username}! Check your email for ${WELCOME_BONUS} bonus points.`,
      user_id: userId,
    });
  } catch (error) {
    await connection.rollback();
    console.error('Registration error:', error);

    // Delete uploaded file if registration failed
    if (req.file && fs.existsSync(req.file.path)) {
      try {
        fs.unlinkSync(req.file.path);
        console.log('Deleted uploaded file after registration failure');
      } catch (err) {
        console.error('Failed to delete uploaded file:', err);
      }
    }

    res.status(500).json({
      success: false,
      message: error.message || 'Server error during registration',
    });
  } finally {
    connection.release();
  }
});

/**
 * POST /api/auth/login
 * Login with email and password
 */
router.post('/login', async (req, res) => {
  try {
    const { email, password } = req.body;

    // Validate required fields
    if (!email || !password) {
      return res.status(400).json({
        success: false,
        message: 'Email and password are required',
      });
    }

    // Find user by email
    const [users] = await db.query(
      'SELECT user_id, username, email, password_hash, total_points, profile_picture, role FROM users WHERE email = ? AND is_active = 1',
      [email]
    );

    if (users.length === 0) {
      return res.status(401).json({
        success: false,
        message: 'Invalid email or password',
      });
    }

    const user = users[0];

    // Check if user registered with Google (no password)
    if (!user.password_hash) {
      return res.status(401).json({
        success: false,
        message: 'This account uses Google Sign-In. Please login with Google.',
      });
    }

    // Compare password with hashed password
    const isPasswordValid = await bcrypt.compare(password, user.password_hash);

    if (!isPasswordValid) {
      return res.status(401).json({
        success: false,
        message: 'Invalid email or password',
      });
    }

    // Update last_login timestamp
    await db.query('UPDATE users SET last_login = NOW() WHERE user_id = ?', [
      user.user_id,
    ]);

    // Generate JWT token with role
    const token = generateToken(user.user_id, user.email, user.role || 'user');

    // Return success response with token and user data
    res.json({
      success: true,
      message: 'Login successful',
      token,
      user: {
        user_id: user.user_id,
        username: user.username,
        email: user.email,
        total_points: user.total_points,
        profile_picture: user.profile_picture,
      },
    });
  } catch (error) {
    console.error('Login error:', error);
    res.status(500).json({
      success: false,
      message: 'Server error during login',
    });
  }
});

/**
 * GET /api/auth/check-username/:username
 * Check if username is available (case-insensitive)
 */
router.get('/check-username/:username', async (req, res) => {
  try {
    const { username } = req.params;

    // Validate username format
    if (!isValidUsername(username)) {
      return res.json({
        available: false,
        message: 'Invalid username format',
      });
    }

    // Check if username exists (case-insensitive)
    const [existingUsers] = await db.query(
      'SELECT user_id FROM users WHERE LOWER(username) = LOWER(?)',
      [username]
    );

    res.json({
      available: existingUsers.length === 0,
    });
  } catch (error) {
    console.error('Username check error:', error);
    res.status(500).json({
      available: false,
      message: 'Server error',
    });
  }
});

/**
 * GET /api/auth/google
 * Initiate Google OAuth flow
 */
router.get(
  '/google',
  passport.authenticate('google', {
    scope: ['profile', 'email'],
    prompt: 'select_account', // Force account selection every time
  })
);

/**
 * GET /api/auth/google/callback
 * Handle Google OAuth callback
 */
router.get(
  '/google/callback',
  (req, res, next) => {
    passport.authenticate('google', { session: false }, (err, user, info) => {
      if (err) {
        console.error('Google OAuth error:', err);
        return res.redirect(`${process.env.FRONTEND_URL}/login?error=oauth_failed`);
      }

      if (!user) {
        console.error('Google OAuth failed: No user returned');
        return res.redirect(`${process.env.FRONTEND_URL}/login?error=oauth_failed`);
      }

      // Manually attach user to request
      req.user = user;
      next();
    })(req, res, next);
  },
  async (req, res) => {
    try {
      // Update last_login timestamp
      await db.query('UPDATE users SET last_login = NOW() WHERE user_id = ?', [
        req.user.user_id,
      ]);

      // Generate JWT token with role
      const token = generateToken(req.user.user_id, req.user.email, req.user.role || 'user');

      console.log(`✅ Google OAuth successful for user: ${req.user.email}`);

      // Redirect to frontend with token in URL
      res.redirect(`${process.env.FRONTEND_URL}/dashboard?token=${token}`);
    } catch (error) {
      console.error('Google callback error:', error);
      res.redirect(`${process.env.FRONTEND_URL}/login?error=oauth_failed`);
    }
  }
);

module.exports = router;
