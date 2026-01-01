const express = require('express');
const challanRoutes = require('./challan.routes');

const router = express.Router();

router.use('/challans', challanRoutes); // Challan routes.

module.exports = router;
