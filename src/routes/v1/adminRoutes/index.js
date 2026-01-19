const express = require('express');
const challanRoutes = require('./challan.routes');
const incomeExpenseRoutes = require('./incomeExpense.routes');
const purchaseOrderRoutes = require('./purchaseOrder.routes');
const vendorRoutes = require('./vendor.routes');

const router = express.Router();

router.use('/challans', challanRoutes);
router.use('/income-expense', incomeExpenseRoutes);
router.use('/purchase-order', purchaseOrderRoutes);
router.use('/vendor', vendorRoutes);

module.exports = router;
