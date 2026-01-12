const express = require('express');
const challanRoutes = require('./challan.routes');
const incomeExpenseRoutes = require('./incomeExpense.routes');

const router = express.Router();

router.use('/challans', challanRoutes);
router.use('/income-expense', incomeExpenseRoutes);

module.exports = router;
