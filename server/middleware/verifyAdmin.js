/**
 * Verify Admin Middleware
 *
 * Answers exactly one question: is the already-authenticated caller an admin?
 *
 * It assumes verifyToken has run first and populated req.user, and must be
 * mounted behind it:
 *
 *   router.use(verifyToken, verifyAdmin);
 *
 * This middleware deliberately does NOT verify the JWT signature and does NOT
 * look the account up in the database. It used to do both, duplicating
 * verifyToken — and that duplication is precisely how the is_active ban check
 * came to cover /api/user/* while leaving all of /api/admin/* exposed: one copy
 * was updated, the other was not. Authentication now has a single source of
 * truth; this file only does authorization.
 *
 * Status codes are split along the standard meaning:
 *   401 — raised by verifyToken: no token, bad signature, expired, or the
 *         account is banned (is_active = 0) or deleted. Not authenticated.
 *   403 — raised here: authenticated fine, but not an admin. Retrying with the
 *         same credentials will never help.
 *
 * Note: the role is read from the JWT claim, which is stamped at login. A user
 * demoted in the database keeps admin access until their token expires.
 */
const verifyAdmin = (req, res, next) => {
  if (!req.user) {
    // verifyToken never ran. This is a mounting bug on our side, not a client
    // error — fail closed and make it loud rather than silently allowing.
    console.error(
      'verifyAdmin was reached without verifyToken in front of it — check the router.use() chain'
    );
    return res.status(500).json({
      success: false,
      message: 'Server misconfiguration.',
    });
  }

  if (req.user.role !== 'admin') {
    return res.status(403).json({
      success: false,
      message: 'Access denied. Admin only.',
    });
  }

  next();
};

module.exports = verifyAdmin;
