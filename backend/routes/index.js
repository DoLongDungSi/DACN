const express = require('express');
const router = express.Router();

// Import các route con
const authRoutes = require('./auth');
const problemRoutes = require('./problems');
const submissionRoutes = require('./submissions');
const userRoutes = require('./users');
const adminRoutes = require('./admin');
const mediaRoutes = require('./media');
const discussionRoutes = require('./discussion');
const billingRoutes = require('./billing');
const initialDataRoutes = require('./initialData');

// Gắn các route vào đường dẫn cụ thể
router.use('/auth', authRoutes);
router.use('/problems', problemRoutes);
router.use('/submissions', submissionRoutes);
router.use('/users', userRoutes);
router.use('/admin', adminRoutes);
router.use('/media', mediaRoutes);
router.use('/discussion', discussionRoutes);
router.use('/billing', billingRoutes);
router.use('/initial-data', initialDataRoutes);

// Health check route
router.get('/health', (req, res) => {
    res.status(200).json({ status: 'ok', timestamp: new Date() });
});

module.exports = router;