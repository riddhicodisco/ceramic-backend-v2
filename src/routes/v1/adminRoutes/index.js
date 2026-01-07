const express = require('express');
const challanRoutes = require('./challan.routes');

const router = express.Router();

router.use('/challans', challanRoutes);

module.exports = router;
