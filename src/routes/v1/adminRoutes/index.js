const express = require('express');
const challanRoutes = require('../commonRoutes/challan.routes');
const challanReturnRoutes = require('../commonRoutes/challanReturn.routes');
const incomeExpenseRoutes = require('./incomeExpense.routes');
const purchaseOrderRoutes = require('./purchaseOrder.routes');
const vendorRoutes = require('./vendor.routes');
const paymentRoutes = require('./payment.routes');
const vendorPaymentRoutes = require('./vendorPayment.routes');
const discountRoutes = require('./discount.routes');
const reportRoutes = require('./report.routes');


const router = express.Router();

router.use('/challans', challanRoutes);
router.use('/challan-returns', challanReturnRoutes);
router.use('/income-expense', incomeExpenseRoutes);
router.use('/purchase-order', purchaseOrderRoutes);
router.use('/vendor', vendorRoutes);
router.use('/payments', paymentRoutes);
router.use('/vendor-payments', vendorPaymentRoutes);
router.use('/discounts', discountRoutes);
router.use('/reports', reportRoutes);


module.exports = router;
