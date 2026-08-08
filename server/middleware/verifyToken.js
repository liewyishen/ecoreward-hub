const jwt = require('jsonwebtoken');
const db = require('../config/db');
require('dotenv').config();

/**
 * Middleware to verify JWT token from request headers
 * Extracts token from Authorization header (Bearer token)
 * Attaches decoded user data to req.user
 *
 * After the signature check, the account is re-checked against the database.
 *
 * Why: JWTs are stateless and valid for 7 days (see generateToken in
 * routes/auth.js). Without this lookup, banning a user via
 * POST /api/admin/users/:id/toggle-status has no effect until their existing
 * token expires — they keep full access for up to a week.
 *
 * Trade-off: this adds one indexed primary-key SELECT to every authenticated
 * request. That is a real cost paid on the hot path, accepted here because a
 * ban that does not take effect is worse than a few milliseconds of latency.
 * If this ever shows up in profiling, the fix is a short-TTL cache or a token
 * revocation list keyed on a jti claim, not removing the check.
 */
const verifyToken = async (req, res, next) => {
  // Get token from Authorization header
  const authHeader = req.headers['authorization'];
  const token = authHeader && authHeader.split(' ')[1]; // Format: "Bearer TOKEN"

  // Check if token exists
  if (!token) {
    return res.status(401).json({
      success: false,
      message: 'Access denied. No token provided.',
    });
  }

  let decoded;
  try {
    // Verify token signature and expiry using JWT_SECRET
    decoded = jwt.verify(token, process.env.JWT_SECRET);
  } catch (error) {
    // Token is invalid or expired
    return res.status(401).json({
      success: false,
      message: 'Invalid or expired token.',
    });
  }

  // Signature is valid — now confirm the account still exists and is active,
  // and read its current role. A token issued before a ban or a demotion must
  // stop granting what it granted at issue time.
  let account;
  try {
    const [rows] = await db.execute(
      'SELECT is_active, role FROM users WHERE user_id = ?',
      [decoded.user_id]
    );

    if (rows.length === 0 || !rows[0].is_active) {
      return res.status(401).json({
        success: false,
        message: 'Account is inactive or no longer exists.',
      });
    }

    account = rows[0];
  } catch (error) {
    // A database failure is not an authentication failure — do not report it
    // as 401, and do not fail open.
    console.error('verifyToken account lookup failed:', error);
    return res.status(500).json({
      success: false,
      message: 'Unable to verify account status.',
    });
  }

  // Attach user data to the request, with the database as the authority on role.
  //
  // The `role` claim inside the JWT is a snapshot taken when the token was
  // signed at login, and it goes stale: demoting an admin to 'user' in the
  // database would otherwise leave their existing token granting admin access
  // until it expires, up to 7 days later. The same staleness problem as
  // is_active, so it gets the same answer — and since the row is already being
  // fetched above, reading role costs nothing extra.
  //
  // Everything else (user_id, email) still comes from the verified token.
  req.user = { ...decoded, role: account.role };

  // Continue to next middleware/route handler
  next();
};

module.exports = verifyToken;
