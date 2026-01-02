const express = require('express');
const commonRoutes = require('./commonRoutes');
const authRoutes = require('./auth.routes');
const router = express.Router();

/** Auth routes */
router.use('/auth', authRoutes);

/** Common routes */
router.use('/api', commonRoutes);

module.exports = router;
