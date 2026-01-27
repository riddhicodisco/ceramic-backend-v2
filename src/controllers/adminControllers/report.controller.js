const httpStatus = require('http-status');
const catchAsync = require('../../utils/catchAsync');
const PurchaseOrder = require('../../models/purchaseOrder.model');
const Challan = require('../../models/challan.model');
const Payment = require('../../models/payment.model');
const Expense = require('../../models/expense.model');
const ApiError = require('../../utils/apiError');


/**
 * Get monthly purchase and sale report for a given year
 * @route GET /v1/admin/reports/monthly-purchase-sale?year=2026
 */
const getMonthlyPurchaseSale = catchAsync(async (req, res) => {
  const { year } = req.query;

  if (!year) {
    throw new ApiError(httpStatus.BAD_REQUEST, 'Year is required');
  }

  const yearNum = parseInt(year, 10);
  if (isNaN(yearNum) || yearNum < 2000 || yearNum > 2100) {
    throw new ApiError(httpStatus.BAD_REQUEST, 'Invalid year');
  }

  // Define start and end dates for the year
  const startDate = new Date(yearNum, 0, 1); // Jan 1
  const endDate = new Date(yearNum + 1, 0, 1); // Jan 1 of next year

  // Aggregate Purchase Orders by month
  const purchaseAgg = await PurchaseOrder.aggregate([
    {
      $match: {
        deletedAt: null,
        createdAt: {
          $gte: startDate,
          $lt: endDate,
        },
      },
    },
    {
      $group: {
        _id: { $month: '$createdAt' },
        qty: { $sum: '$totalQuantity' },
        amount: { $sum: '$totalAmount' },
      },
    },
  ]);

  // Aggregate Challans by month
  const challanAgg = await Challan.aggregate([
    {
      $match: {
        deletedAt: null,
        createdAt: {
          $gte: startDate,
          $lt: endDate,
        },
      },
    },
    {
      $group: {
        _id: { $month: '$createdAt' },
        qty: { $sum: '$totalQuantity' },
        amount: { $sum: '$totalAmount' },
      },
    },
  ]);

  // Convert aggregation results to maps for easy lookup
  const purchaseMap = {};
  purchaseAgg.forEach((item) => {
    purchaseMap[item._id] = { qty: item.qty, amount: item.amount };
  });

  const challanMap = {};
  challanAgg.forEach((item) => {
    challanMap[item._id] = { qty: item.qty, amount: item.amount };
  });

  // Month names
  const monthNames = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];

  // Build monthly data array
  const months = [];
  let totalPurchaseQty = 0;
  let totalPurchaseAmount = 0;
  let totalSaleQty = 0;
  let totalSaleAmount = 0;

  for (let i = 1; i <= 12; i++) {
    const purchase = purchaseMap[i] || { qty: 0, amount: 0 };
    const sale = challanMap[i] || { qty: 0, amount: 0 };

    totalPurchaseQty += purchase.qty;
    totalPurchaseAmount += purchase.amount;
    totalSaleQty += sale.qty;
    totalSaleAmount += sale.amount;

    months.push({
      month: monthNames[i - 1],
      monthNumber: i,
      purchase: {
        qty: purchase.qty,
        amount: purchase.amount,
      },
      sale: {
        qty: sale.qty,
        amount: sale.amount,
      },
      total: {
        qty: sale.qty - purchase.qty,
        amount: sale.amount - purchase.amount,
      },
    });
  }

  // Calculate overall totals
  const totals = {
    purchase: {
      qty: totalPurchaseQty,
      amount: totalPurchaseAmount,
    },
    sale: {
      qty: totalSaleQty,
      amount: totalSaleAmount,
    },
    total: {
      qty: totalSaleQty - totalPurchaseQty,
      amount: totalSaleAmount - totalPurchaseAmount,
    },
  };

  // Calculate Profit/Loss Statement Data
  // 1. Total Discount (Credit Notes)
  const discountAgg = await Payment.aggregate([
    {
      $match: {
        category: 'Credit Note',
        deletedAt: null,
        date: {
          $gte: startDate,
          $lt: endDate,
        },
      },
    },
    {
      $group: {
        _id: null,
        totalAmount: { $sum: '$amount' },
      },
    },
  ]);
  const totalDiscount = discountAgg.length > 0 ? discountAgg[0].totalAmount : 0;

  // 2. Total Freight (Expenses with category 'Freight', 'Shipping', or 'Transport')
  const freightAgg = await Expense.aggregate([
    {
      $match: {
        category: { $regex: 'Freight|Shipping|Transport', $options: 'i' }, // Match any transport-related category
        deletedAt: null,
        date: {
          $gte: startDate,
          $lt: endDate,
        },
      },
    },
    {
      $group: {
        _id: null,
        totalAmount: { $sum: '$amount' },
      },
    },
  ]);
  const totalFreight = freightAgg.length > 0 ? freightAgg[0].totalAmount : 0;

  const tradingExpenses = totalDiscount + totalFreight;
  const grossProfit = totalSaleAmount - (totalPurchaseAmount + tradingExpenses);

  res.send({
    year: yearNum,
    months,
    totals,
  });
});

/**
 * Get profit and loss summary
 * @route GET /v1/admin/reports/profit-loss-summary
 * @access Private (Admin, Accountant)
 */
const getProfitLossSummary = catchAsync(async (req, res) => {
  const { year } = req.query;
  let filter = { deletedAt: null };
  // If year is provided, filter by date range
  if (year) {
    const yearNum = parseInt(year);
    if (!yearNum || yearNum < 2000 || yearNum > 2100) {
      throw new ApiError(httpStatus.BAD_REQUEST, 'Invalid year provided');
    }
    const startDate = new Date(yearNum, 0, 1);
    const endDate = new Date(yearNum + 1, 0, 1);
    filter = {
      deletedAt: null,
      createdAt: { $gte: startDate, $lt: endDate } // For Purchase/Sales
    };
    // Note: For Payment/Expense, field is 'date' usually, need to handle separately
  }

  // 1. Total Purchase (PurchaseOrder)
  // PurchaseOrder has createdAt
  const purchaseFilter = year ? {
    deletedAt: null,
    createdAt: filter.createdAt
  } : { deletedAt: null };

  const purchaseAgg = await PurchaseOrder.aggregate([
    { $match: purchaseFilter },
    { $group: { _id: null, totalAmount: { $sum: '$totalAmount' } } }
  ]);
  const totalPurchaseAmount = purchaseAgg.length > 0 ? purchaseAgg[0].totalAmount : 0;

  // 2. Total Sales (Challan)
  // Challan has createdAt
  const saleFilter = year ? {
    deletedAt: null,
    createdAt: filter.createdAt
  } : { deletedAt: null };

  const saleAgg = await Challan.aggregate([
    { $match: saleFilter },
    { $group: { _id: null, totalAmount: { $sum: '$totalAmount' } } }
  ]);
  const totalSaleAmount = saleAgg.length > 0 ? saleAgg[0].totalAmount : 0; // Using Total Sales

  // 3. Total Discount (Payment - Credit Note)
  // Payment has 'date' field? Let's check model. Usually 'date' or 'createdAt'.
  // Based on previous code: `date: { $gte: startDate, $lt: endDate }`
  const discountFilter = {
    category: 'Credit Note',
    deletedAt: null
  };
  if (year) {
    const yearNum = parseInt(year);
    discountFilter.date = {
      $gte: new Date(yearNum, 0, 1),
      $lt: new Date(yearNum + 1, 0, 1)
    };
  }

  const discountAgg = await Payment.aggregate([
    { $match: discountFilter },
    { $group: { _id: null, totalAmount: { $sum: '$amount' } } }
  ]);
  const totalDiscount = discountAgg.length > 0 ? discountAgg[0].totalAmount : 0;

  // 4. Total Freight (Expense)
  // Expense has 'date' field.
  const freightFilter = {
    category: { $regex: 'Freight|Shipping|Transport', $options: 'i' },
    deletedAt: null
  };
  if (year) {
    const yearNum = parseInt(year);
    freightFilter.date = {
      $gte: new Date(yearNum, 0, 1),
      $lt: new Date(yearNum + 1, 0, 1)
    };
  }

  const freightAgg = await Expense.aggregate([
    { $match: freightFilter },
    { $group: { _id: null, totalAmount: { $sum: '$amount' } } }
  ]);
  const totalFreight = freightAgg.length > 0 ? freightAgg[0].totalAmount : 0;


  const tradingExpenses = totalDiscount + totalFreight;
  const grossProfit = totalSaleAmount - (totalPurchaseAmount + tradingExpenses);

  res.send({
    purchaseStock: totalPurchaseAmount,
    tradingExpenses: tradingExpenses,
    discount: totalDiscount,
    freight: totalFreight,
    sales: totalSaleAmount,
    grossProfit: grossProfit,
    grandTotal: totalSaleAmount
  });
});


module.exports = {
  getMonthlyPurchaseSale,
  getProfitLossSummary,
};
