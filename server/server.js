const express = require('express');
const cors = require('cors');
const passport = require('passport');
const session = require('express-session');
require('dotenv').config();

// Import routes
const authRoutes = require('./routes/auth');
const scanRoutes = require('./routes/scan');
const userRoutes = require('./routes/user');
const statsRoutes = require('./routes/stats');
const facilitiesRoutes = require('./routes/facilities');
const leaderboardRoutes = require('./routes/leaderboard');
const rewardsRoutes = require('./routes/rewards');
const achievementsRoutes = require('./routes/achievements');
const communityRoutes = require('./routes/community');
const adminRoutes = require('./routes/admin');
const chatbotRoutes = require('./routes/chatbot');

// Initialize Express app
const app = express();
const PORT = process.env.PORT || 5000;

// ============================================
// MIDDLEWARE CONFIGURATION
// ============================================

// Serve static files from uploads directory
const path = require('path');
app.use('/uploads', express.static(path.join(__dirname, 'uploads')));

// Enable CORS for frontend requests
app.use(
  cors({
    origin: process.env.FRONTEND_URL || 'http://localhost:5173',
    credentials: true,
  })
);

// Parse JSON request bodies
app.use(express.json({ limit: '10mb' })); // Allow larger payloads for base64 images

// Parse URL-encoded request bodies
app.use(express.urlencoded({ extended: true, limit: '10mb' }));

// Session configuration for Passport
app.use(
  session({
    secret: process.env.JWT_SECRET || 'fallback-secret',
    resave: false,
    saveUninitialized: false,
    cookie: {
      secure: false, // Set to true if using HTTPS
      maxAge: 24 * 60 * 60 * 1000, // 24 hours
    },
  })
);

// Initialize Passport middleware
app.use(passport.initialize());
app.use(passport.session());

// ============================================
// ROUTES
// ============================================

// Health check endpoint
app.get('/', (req, res) => {
  res.json({
    success: true,
    message: 'EcoReward Hub API Server',
    version: '1.0.0',
    timestamp: new Date().toISOString(),
  });
});

// Authentication routes
app.use('/api/auth', authRoutes);

// Scan routes
app.use('/api/scan', scanRoutes);

// User routes
app.use('/api/user', userRoutes);

// Stats routes
app.use('/api/stats', statsRoutes);

// Facilities routes
app.use('/api/facilities', facilitiesRoutes);

// Leaderboard routes
app.use('/api/leaderboard', leaderboardRoutes);

// Rewards routes
app.use('/api/rewards', rewardsRoutes);

// Achievements routes
app.use('/api/achievements', achievementsRoutes);

// Community routes
app.use('/api/community', communityRoutes);

// Admin routes
app.use('/api/admin', adminRoutes);

// Chatbot routes (AI-powered conversational assistant)
app.use('/api/chatbot', chatbotRoutes);

// ============================================
// ERROR HANDLING MIDDLEWARE
// ============================================

// 404 handler - Route not found
app.use((req, res) => {
  res.status(404).json({
    success: false,
    message: 'Route not found',
    path: req.originalUrl,
  });
});

// Global error handler
app.use((err, req, res, next) => {
  console.error('❌ Server Error:', err.stack);

  // Don't leak error details in production
  const errorMessage =
    process.env.NODE_ENV === 'production'
      ? 'Internal server error'
      : err.message;

  res.status(err.status || 500).json({
    success: false,
    message: errorMessage,
  });
});

// ============================================
// START SERVER
// ============================================

app.listen(PORT, () => {
  console.log('');
  console.log('🌱 ======================================');
  console.log('   EcoReward Hub API Server');
  console.log('   ======================================');
  console.log(`   🚀 Server running on port ${PORT}`);
  console.log(`   🌐 API URL: http://localhost:${PORT}`);
  console.log(`   🔗 Frontend: ${process.env.FRONTEND_URL}`);
  console.log('   ======================================');
  console.log('');
});

// Handle graceful shutdown
process.on('SIGINT', () => {
  console.log('\n\n🛑 Server shutting down gracefully...');
  process.exit(0);
});

process.on('SIGTERM', () => {
  console.log('\n\n🛑 Server shutting down gracefully...');
  process.exit(0);
});
