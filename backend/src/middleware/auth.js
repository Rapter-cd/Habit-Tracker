const jwt = require('jsonwebtoken');
const User = require('../models/User');

/**
 * JWT Auth Middleware
 *
 * Reads the token from the Authorization header:
 *   Authorization: Bearer <token>
 *
 * On success, attaches the full user document (without password) to req.user.
 * On failure, responds with 401 so the frontend can redirect to /login.
 *
 * Design decision: Authorization header (not httpOnly cookie) was chosen
 * because it avoids same-origin CORS constraints when frontend (Vercel)
 * and backend (Render) live on different domains — no need for sameSite/
 * credentials cookie gymnastics in production.
 */
const protect = async (req, res, next) => {
  try {
    let token;

    const authHeader = req.headers.authorization;
    if (authHeader && authHeader.startsWith('Bearer ')) {
      token = authHeader.split(' ')[1];
    }

    if (!token) {
      return res.status(401).json({ message: 'Not authenticated. No token provided.' });
    }

    // Verify and decode
    const decoded = jwt.verify(token, process.env.JWT_SECRET);

    // Attach user (re-query so we always have fresh data; password excluded via schema select:false)
    const user = await User.findById(decoded.userId);
    if (!user) {
      return res.status(401).json({ message: 'User belonging to this token no longer exists.' });
    }

    req.user = user;
    next();
  } catch (err) {
    if (err.name === 'TokenExpiredError') {
      return res.status(401).json({ message: 'Token expired. Please log in again.' });
    }
    if (err.name === 'JsonWebTokenError') {
      return res.status(401).json({ message: 'Invalid token.' });
    }
    next(err);
  }
};

module.exports = { protect };
