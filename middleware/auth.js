const jwt = require('jsonwebtoken');
const db = require('../config/db');
require('dotenv').config();

const ACCESS_SECRET = process.env.JWT_ACCESS_SECRET || 'access_secret_key_123';
const REFRESH_SECRET = process.env.JWT_REFRESH_SECRET || 'refresh_secret_key_456';

/**
 * Generate Access Token (short-lived 15m or 1h)
 */
function generateAccessToken(payload) {
  return jwt.sign(payload, ACCESS_SECRET, { expiresIn: '1h' });
}

/**
 * Generate Refresh Token (long-lived 7d)
 */
function generateRefreshToken(payload) {
  return jwt.sign(payload, REFRESH_SECRET, { expiresIn: '7d' });
}

/**
 * Middleware to authenticate requests using JWT from cookie or Authorization header.
 */
async function authenticateToken(req, res, next) {
  let token = req.cookies ? req.cookies.access_token : null;

  if (!token && req.headers['authorization']) {
    const authHeader = req.headers['authorization'];
    if (authHeader.startsWith('Bearer ')) {
      token = authHeader.substring(7);
    }
  }

  if (!token) {
    // If browser requesting HTML page, redirect to login
    if (req.accepts('html')) {
      return res.redirect('/auth/login');
    }
    return res.status(401).json({ success: false, message: 'Authentication token required.' });
  }

  try {
    const decoded = jwt.verify(token, ACCESS_SECRET);
    req.user = decoded;
    res.locals.user = decoded; // Available in EJS views automatically!
    next();
  } catch (err) {
    // Attempt token refresh if refresh_token cookie exists
    const refreshToken = req.cookies ? req.cookies.refresh_token : null;
    if (refreshToken) {
      try {
        const decodedRefresh = jwt.verify(refreshToken, REFRESH_SECRET);
        // Verify token in DB
        const tokenRes = await db.query(
          'SELECT * FROM refresh_tokens WHERE token = $1 AND user_id = $2 AND expires_at > NOW()',
          [refreshToken, decodedRefresh.id]
        );

        if (tokenRes.rows.length > 0) {
          const newAccessToken = generateAccessToken({
            id: decodedRefresh.id,
            email: decodedRefresh.email,
            role: decodedRefresh.role,
            profile_id: decodedRefresh.profile_id,
            name: decodedRefresh.name,
          });

          res.cookie('access_token', newAccessToken, { httpOnly: true, maxAge: 3600000 });
          req.user = decodedRefresh;
          res.locals.user = decodedRefresh;
          return next();
        }
      } catch (refreshErr) {
        console.warn('Refresh token invalid or expired:', refreshErr.message);
      }
    }

    // Clear invalid cookies
    res.clearCookie('access_token');
    res.clearCookie('refresh_token');

    if (req.accepts('html')) {
      return res.redirect('/auth/login?error=session_expired');
    }
    return res.status(403).json({ success: false, message: 'Invalid or expired token.' });
  }
}

/**
 * Role authorization guard middleware.
 * @param {string[]} roles Allowed roles
 */
function authorizeRoles(...roles) {
  return (req, res, next) => {
    if (!req.user || !roles.includes(req.user.role)) {
      if (req.accepts('html')) {
        return res.status(403).render('auth/login', {
          error: 'Unauthorized access for your user role.',
        });
      }
      return res.status(403).json({ success: false, message: 'Access denied.' });
    }
    next();
  };
}

module.exports = {
  generateAccessToken,
  generateRefreshToken,
  authenticateToken,
  authorizeRoles,
};
