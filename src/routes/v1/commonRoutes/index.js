const express = require('express');
const challanRoutes = require('./challan.routes');
const challanReturnRoutes = require('./challanReturn.routes');

const router = express.Router();

router.use('/challans', challanRoutes);
router.use('/challan-returns', challanReturnRoutes);

module.exports = router;
