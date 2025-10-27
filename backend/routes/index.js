// backend/routes/index.js
const express = require('express');
const authRoutes = require('./auth');
const userRoutes = require('./users');
const adminRoutes = require('./admin');
const problemRoutes = require('./problems');
const submissionRoutes = require('./submissions');
const discussionRoutes = require('./discussion');
const initialDataRoutes = require('./initialData');

const router = express.Router();

// Mount API routes
router.use('/auth', authRoutes);
router.use('/users', userRoutes); // For /api/users/me, /api/users/me/avatar
router.use('/admin', adminRoutes); // For /api/admin/*
router.use('/problems', problemRoutes); // For /api/problems, /api/problems/:id
router.use('/submissions', submissionRoutes); // For /api/submissions
router.use('/discussion', discussionRoutes); // Mount discussion routes under /api/discussion/* (e.g., /api/discussion/posts)
router.use('/initial-data', initialDataRoutes); // For /api/initial-data

// Optional: Add a simple health check or root API endpoint
router.get('/', (req, res) => {
  res.json({ message: 'ML Judge API is running!' });
});


module.exports = router;
