const express = require('express');
const commonRoutes = require('./commonRoutes');
const adminRoutes = require('./adminRoutes');
const router = express.Router();

/** Common routes */
router.use('/api', commonRoutes);

/** Admin routes */
router.use('/admin', adminRoutes);

module.exports = router;

