const express = require('express');
const authRoutes = require('./auth');
const userRoutes = require('./users');
const adminRoutes = require('./admin');
const problemRoutes = require('./problems');
const submissionRoutes = require('./submissions');
const discussionRoutes = require('./discussion');
const initialDataRoutes = require('./initialData');
const billingRoutes = require('./billing'); // Route mới
const mediaRoutes = require('./media');     // Route mới

const router = express.Router();

// Mount API routes
router.use('/auth', authRoutes);
router.use('/users', userRoutes);
router.use('/admin', adminRoutes);
router.use('/problems', problemRoutes);
router.use('/submissions', submissionRoutes);
router.use('/discussion', discussionRoutes);
router.use('/initial-data', initialDataRoutes);
router.use('/billing', billingRoutes); // Đăng ký billing
router.use('/media', mediaRoutes);     // Đăng ký media

router.get('/', (req, res) => {
  res.json({ message: 'ML Judge API is running!' });
});

module.exports = router;