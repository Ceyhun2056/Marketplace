const jwt = require('jsonwebtoken');
const User = require('../models/User');
const cache = require('../utils/cache');

// Protect routes
exports.protect = async (req, res, next) => {
  let token;

  if (req.headers.authorization && req.headers.authorization.startsWith('Bearer')) {
    token = req.headers.authorization.split(' ')[1];
  }

  if (!token) {
    return res.status(401).json({
      success: false,
      message: 'Not authorized to access this route'
    });
  }

  try {
    // Verify token
    const decoded = jwt.verify(token, process.env.JWT_SECRET);

    // Check if user is cached
    let user = await cache.get(`user:${decoded.id}`);
    
    if (!user) {
      user = await User.findById(decoded.id).select('-password');
      if (user) {
        await cache.set(`user:${decoded.id}`, user, 3600); // Cache for 1 hour
      }
    }

    if (!user) {
      return res.status(401).json({
        success: false,
        message: 'No user found with this token'
      });
    }

    req.user = user;
    next();
  } catch (error) {
    return res.status(401).json({
      success: false,
      message: 'Not authorized to access this route'
    });
  }
};

// Grant access to specific roles
exports.authorize = (...roles) => {
  return (req, res, next) => {
    if (!roles.includes(req.user.role)) {
      return res.status(403).json({
        success: false,
        message: `User role ${req.user.role} is not authorized to access this route`
      });
    }
    next();
  };
};

// Optional auth - doesn't require token but sets user if provided
exports.optionalAuth = async (req, res, next) => {
  let token;

  if (req.headers.authorization && req.headers.authorization.startsWith('Bearer')) {
    token = req.headers.authorization.split(' ')[1];
  }

  if (token) {
    try {
      const decoded = jwt.verify(token, process.env.JWT_SECRET);
      
      let user = await cache.get(`user:${decoded.id}`);
      
      if (!user) {
        user = await User.findById(decoded.id).select('-password');
        if (user) {
          await cache.set(`user:${decoded.id}`, user, 3600);
        }
      }

      if (user) {
        req.user = user;
      }
    } catch (error) {
      // Continue without user
    }
  }

  next();
};
