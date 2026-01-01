const express = require('express');
const commonRoutes = require('./commonRoutes');
const router = express.Router();

/** Common routes */
router.use('/api', commonRoutes);

module.exports = router;
