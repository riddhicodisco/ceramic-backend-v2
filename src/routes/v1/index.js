const express = require('express');
const commonRoutes = require('./commonRoutes');
const adminRoutes = require('./adminRoutes');
const authRoutes = require('./auth.routes');
const router = express.Router();

/** Auth routes */
router.use('/auth', authRoutes);

/** Common routes */
router.use('/api', commonRoutes);

/** Admin routes */
router.use('/admin', adminRoutes);

module.exports = router;
