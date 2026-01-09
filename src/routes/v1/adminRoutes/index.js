const express = require('express');
const challanRoutes = require('./challan.routes');
const purchaseOrderRoutes = require('./purchaseOrder.routes');

const router = express.Router();

router.use('/challans', challanRoutes);
router.use('/purchase-orders', purchaseOrderRoutes);

module.exports = router;
