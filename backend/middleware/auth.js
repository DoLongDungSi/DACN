// backend/middleware/auth.js
const jwt = require('jsonwebtoken');
const { JWT_SECRET, OWNER_ID } = require('../config/constants'); // Import constants

/**
 * Middleware to verify JWT token from cookies.
 * Attaches userId and userRole to the request object if valid.
 */
const authMiddleware = (req, res, next) => {
  const token = req.cookies.token;
  if (!token) {
    return res.status(401).json({ message: 'Not authenticated' });
  }

  try {
    const decoded = jwt.verify(token, JWT_SECRET);
    req.userId = decoded.userId;
    req.userRole = decoded.role; // Assuming role is stored in the token
    next();
  } catch (err) {
    console.error('JWT Verification Error:', err.message);
    // Clear potentially invalid cookie
    res.clearCookie('token');
    return res.status(401).json({ message: 'Invalid or expired token' });
  }
};

/**
 * Middleware to check if the user is an 'owner' or 'creator'.
 * Requires authMiddleware to run first.
 */
const ownerOrCreatorMiddleware = (req, res, next) => {
  // Ensure authMiddleware has run and set userRole
  if (!req.userRole) {
     console.warn('ownerOrCreatorMiddleware called without preceding authMiddleware or failed auth.');
     return res.status(401).json({ message: 'Authentication required' });
  }
  if (req.userRole === 'owner' || req.userRole === 'creator') {
    next();
  } else {
    res.status(403).json({ message: 'Forbidden: Owner or Creator access required' });
  }
};

/**
 * Middleware to check if the user is an 'owner'.
 * Requires authMiddleware to run first.
 */
const ownerMiddleware = (req, res, next) => {
   // Ensure authMiddleware has run and set userRole
   if (!req.userRole) {
      console.warn('ownerMiddleware called without preceding authMiddleware or failed auth.');
      return res.status(401).json({ message: 'Authentication required' });
   }
  if (req.userRole === 'owner') {
    next();
  } else {
    res.status(403).json({ message: 'Forbidden: Owner access required' });
  }
};

module.exports = {
  authMiddleware,
  ownerOrCreatorMiddleware,
  ownerMiddleware,
};
