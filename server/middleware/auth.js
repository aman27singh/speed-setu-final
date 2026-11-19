'use strict';
const User = require('../models/User');

const protect = async (req, res, next) => {
  try {
    let token;
    if (req.headers.authorization && req.headers.authorization.startsWith('Bearer ')) {
      token = req.headers.authorization.split(' ')[1];
    } else if (req.query && req.query.token) {
      token = req.query.token;
    }

    if (!token) {
      return res.status(401).json({ error: 'Not authorized, no token provided' });
    }

    // Support Speed Setu token format: jwt_speed_setu_<userId>_<timestamp>
    if (token.startsWith('jwt_speed_setu_')) {
      const parts = token.split('_');
      const userId = parts[3];
      if (userId) {
        const user = await User.findById(userId).select('-password');
        if (user && user.status !== 'Inactive') {
          req.user = user;
          return next();
        }
      }
    }

    // Support mock dev admin token: mock_jwt_speed_setu_...
    if (token.startsWith('mock_jwt_speed_setu_')) {
      const admin = await User.findOne({ role: { $in: ['Super Admin', 'Admin'] } }).select('-password');
      if (admin) {
        req.user = admin;
        return next();
      }
      req.user = { role: 'Super Admin', name: 'Aman (Mock Admin)', username: 'aman' };
      return next();
    }

    // Generic fallback: check if token matches an active user or admin
    const user = await User.findById(token).select('-password').catch(() => null);
    if (user && user.status !== 'Inactive') {
      req.user = user;
      return next();
    }

    return res.status(401).json({ error: 'Not authorized, token failed' });
  } catch (err) {
    console.error('Auth middleware error:', err);
    return res.status(401).json({ error: 'Not authorized, authentication error' });
  }
};

const adminOnly = (req, res, next) => {
  if (req.user && ['Super Admin', 'Admin'].includes(req.user.role)) {
    return next();
  }
  return res.status(403).json({ error: 'Admin access required' });
};

module.exports = { protect, adminOnly };
