const httpStatus = require('http-status');
const catchAsync = require('../../utils/catchAsync');
const PurchaseOrder = require('../../models/purchaseOrder.model');
const Challan = require('../../models/challan.model');
const ChallanReturn = require('../../models/challanReturn.model');
const Payment = require('../../models/payment.model');
const Expense = require('../../models/expense.model');
const VendorPayment = require('../../models/vendorPayment.model');
const ApiError = require('../../utils/apiError');
const v1Service = require('../../services/v1Service');


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

  // 5. Total Returns (ChallanReturn)
  const returnFilter = year ? {
    deletedAt: null,
    createdAt: filter.createdAt
  } : { deletedAt: null };

  const returnAgg = await ChallanReturn.aggregate([
    { $match: returnFilter },
    { $group: { _id: null, totalAmount: { $sum: '$totalAmount' } } }
  ]);
  const totalReturns = returnAgg.length > 0 ? returnAgg[0].totalAmount : 0;


  const tradingExpenses = totalDiscount + totalFreight;
  const grossProfit = totalSaleAmount - (totalPurchaseAmount + tradingExpenses + totalReturns);

  res.send({
    purchaseStock: totalPurchaseAmount,
    tradingExpenses: tradingExpenses,
    discount: totalDiscount,
    freight: totalFreight,
    sales: totalSaleAmount,
    totalReturns: totalReturns,
    grossProfit: grossProfit,
    grandTotal: totalSaleAmount
  });
});

/**
 * Get daily sales and return report for a specific month
 * @route GET /v1/admin/reports/daily-report?month=1&year=2026
 */
const getDailyReport = catchAsync(async (req, res) => {
  const { month, year } = req.query;

  if (!month || !year) {
    throw new ApiError(httpStatus.BAD_REQUEST, 'Month and Year are required');
  }

  const monthNum = parseInt(month, 10);
  const yearNum = parseInt(year, 10);

  if (isNaN(monthNum) || monthNum < 1 || monthNum > 12) {
    throw new ApiError(httpStatus.BAD_REQUEST, 'Invalid month');
  }
  if (isNaN(yearNum) || yearNum < 2000 || yearNum > 2100) {
    throw new ApiError(httpStatus.BAD_REQUEST, 'Invalid year');
  }

  // Define start and end dates for the month
  const startDate = new Date(yearNum, monthNum - 1, 1);
  const endDate = new Date(yearNum, monthNum, 1);

  // Aggregate Challans (Sales) by day
  const salesAgg = await Challan.aggregate([
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
        _id: { $dayOfMonth: '$createdAt' }, // Group by day (1-31)
        amount: { $sum: '$totalAmount' },
      },
    },
  ]);

  // Aggregate Challan Returns (Sales Return) by day
  const returnsAgg = await ChallanReturn.aggregate([
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
        _id: { $dayOfMonth: '$createdAt' }, // Group by day (1-31)
        amount: { $sum: '$totalAmount' },
      },
    },
  ]);

  // Create maps for easy lookup
  const salesMap = {};
  salesAgg.forEach((item) => {
    salesMap[item._id] = item.amount;
  });

  const returnsMap = {};
  returnsAgg.forEach((item) => {
    returnsMap[item._id] = item.amount;
  });

  // Build daily data array
  const daysInMonth = new Date(yearNum, monthNum, 0).getDate();
  const dailyData = [];

  let totalSaleAmount = 0;
  let totalReturnAmount = 0;

  for (let i = 1; i <= daysInMonth; i++) {
    const saleAmount = salesMap[i] || 0;
    const returnAmount = returnsMap[i] || 0;
    const netAmount = saleAmount - returnAmount; // Net = Sales - Returns

    totalSaleAmount += saleAmount;
    totalReturnAmount += returnAmount;

    dailyData.push({
      day: i,
      date: new Date(yearNum, monthNum - 1, i), // Construct date object for frontend formatting
      saleAmount,
      returnAmount,
      netAmount,
    });
  }

  // Calculate overall totals
  const totalNetAmount = totalSaleAmount - totalReturnAmount;

  res.send({
    month: monthNum,
    year: yearNum,
    days: dailyData,
    totals: {
      saleAmount: totalSaleAmount,
      returnAmount: totalReturnAmount,
      netAmount: totalNetAmount,
    },
  });
});



/**
 * Get balance sheet
 * @route GET /v1/admin/reports/balance-sheet
 * @access Private (Admin, Accountant)
 */
const getBalanceSheet = catchAsync(async (req, res) => {
  const { startDate, endDate } = req.query;
  const token = req.headers.authorization;

  // Build date filters
  const challanDateFilter = {};
  const purchaseOrderDateFilter = {};
  const customerPaymentDateFilter = {};
  const vendorPaymentDateFilter = {};

  if (startDate || endDate) {
    if (startDate) {
      challanDateFilter.createdAt = { $gte: new Date(startDate) };
      purchaseOrderDateFilter.createdAt = { $gte: new Date(startDate) };
      customerPaymentDateFilter.date = { $gte: new Date(startDate) };
      vendorPaymentDateFilter.date = { $gte: new Date(startDate) };
    }
    if (endDate) {
      const end = new Date(endDate);
      end.setHours(23, 59, 59, 999);
      challanDateFilter.createdAt = { ...challanDateFilter.createdAt, $lte: end };
      purchaseOrderDateFilter.createdAt = { ...purchaseOrderDateFilter.createdAt, $lte: end };
      customerPaymentDateFilter.date = { ...customerPaymentDateFilter.date, $lte: end };
      vendorPaymentDateFilter.date = { ...vendorPaymentDateFilter.date, $lte: end };
    }
  }

  // 1. Get Customer Balance Data
  const customerChallansAgg = await Challan.aggregate([
    {
      $match: {
        deletedAt: null,
        ...challanDateFilter,
      },
    },
    {
      $group: {
        _id: '$customerId',
        totalInvoices: { $sum: '$totalAmount' },
      },
    },
  ]);

  const customerPaymentsAgg = await Payment.aggregate([
    {
      $match: {
        deletedAt: null,
        ...customerPaymentDateFilter,
      },
    },
    {
      $group: {
        _id: '$customerId',
        totalPayments: {
          $sum: {
            $cond: [{ $in: ['$category', ['Payment', 'Return']] }, '$amount', 0],
          },
        },
        totalDiscounts: {
          $sum: {
            $add: [
              { $cond: [{ $eq: ['$category', 'Credit Note'] }, '$amount', 0] },
              { $cond: [{ $eq: ['$relatedPaymentId', null] }, '$discountGiven', 0] },
            ],
          },
        },
      },
    },
  ]);

  // Combine customer data
  const customerMap = new Map();
  
  customerChallansAgg.forEach((item) => {
    if (item._id) {
      customerMap.set(item._id.toString(), {
        customerId: item._id.toString(),
        totalInvoices: item.totalInvoices || 0,
        totalPayments: 0,
        totalDiscounts: 0,
      });
    }
  });

  customerPaymentsAgg.forEach((item) => {
    if (item._id) {
      const existing = customerMap.get(item._id.toString());
      if (existing) {
        existing.totalPayments = item.totalPayments || 0;
        existing.totalDiscounts = item.totalDiscounts || 0;
      } else {
        customerMap.set(item._id.toString(), {
          customerId: item._id.toString(),
          totalInvoices: 0,
          totalPayments: item.totalPayments || 0,
          totalDiscounts: item.totalDiscounts || 0,
        });
      }
    }
  });

  // Calculate balances and fetch customer details
  const customerCreditors = [];
  const customerDebtors = [];

  await Promise.all(
    Array.from(customerMap.values()).map(async (customerData) => {
      const remainingBalance = customerData.totalInvoices - (customerData.totalPayments + customerData.totalDiscounts);
      
      let customerDetails = null;
      try {
        customerDetails = await v1Service.getCustomer(customerData.customerId, token);
      } catch (error) {
        console.warn(`Failed to fetch customer ${customerData.customerId} from V1:`, error.message);
      }

      const customerEntry = {
        customerId: customerData.customerId,
        customerName: customerDetails ? `${customerDetails.first_name || ''} ${customerDetails.last_name || ''}`.trim() : 'Unknown',
        customerPhone: customerDetails?.phone || '',
        totalInvoices: customerData.totalInvoices,
        totalPayments: customerData.totalPayments,
        totalDiscounts: customerData.totalDiscounts,
        remainingBalance,
      };

      if (remainingBalance > 0) {
        customerCreditors.push(customerEntry);
      } else if (remainingBalance < 0) {
        customerDebtors.push(customerEntry);
      }
    })
  );

  // 2. Get Vendor Balance Data
  const vendorPurchaseOrdersAgg = await PurchaseOrder.aggregate([
    {
      $match: {
        deletedAt: null,
        ...purchaseOrderDateFilter,
      },
    },
    {
      $group: {
        _id: '$vendor',
        totalPurchaseOrders: { $sum: '$totalAmount' },
      },
    },
  ]);

  const vendorPaymentsAgg = await VendorPayment.aggregate([
    {
      $match: {
        deletedAt: null,
        ...vendorPaymentDateFilter,
      },
    },
    {
      $group: {
        _id: '$vendorId',
        totalCredit: {
          $sum: {
            $cond: [
              {
                $and: [
                  { $eq: ['$transactionType', 'Credit'] },
                  { $ne: ['$category', 'Credit Note'] },
                ],
              },
              '$payableAmount',
              0,
            ],
          },
        },
        totalDebit: {
          $sum: {
            $cond: [{ $eq: ['$transactionType', 'Debit'] }, '$payableAmount', 0],
          },
        },
        totalDiscounts: {
          $sum: {
            $add: [
              { $cond: [{ $eq: ['$category', 'Credit Note'] }, '$payableAmount', 0] },
              { $cond: [{ $eq: ['$relatedPaymentId', null] }, '$discountGiven', 0] },
            ],
          },
        },
      },
    },
  ]);

  // Combine vendor data
  const vendorMap = new Map();

  vendorPurchaseOrdersAgg.forEach((item) => {
    if (item._id) {
      vendorMap.set(item._id.toString(), {
        vendorId: item._id.toString(),
        totalPurchaseOrders: item.totalPurchaseOrders || 0,
        totalPayments: 0,
        totalDiscounts: 0,
      });
    }
  });

  vendorPaymentsAgg.forEach((item) => {
    if (item._id) {
      const existing = vendorMap.get(item._id.toString());
      // Match the logic from vendorPayment.service.js: totalPayments = totalCredit - totalDebit
      const totalPayments = (item.totalCredit || 0) - (item.totalDebit || 0);
      if (existing) {
        existing.totalPayments = totalPayments;
        existing.totalDiscounts = item.totalDiscounts || 0;
      } else {
        vendorMap.set(item._id.toString(), {
          vendorId: item._id.toString(),
          totalPurchaseOrders: 0,
          totalPayments: totalPayments,
          totalDiscounts: item.totalDiscounts || 0,
        });
      }
    }
  });

  // Calculate balances and fetch vendor details
  const vendorCreditors = [];
  const vendorDebtors = [];

  await Promise.all(
    Array.from(vendorMap.values()).map(async (vendorData) => {
      const remainingBalance = vendorData.totalPurchaseOrders - (vendorData.totalPayments + vendorData.totalDiscounts);
      
      let vendorDetails = null;
      try {
        vendorDetails = await v1Service.getVendor(vendorData.vendorId, token);
      } catch (error) {
        console.warn(`Failed to fetch vendor ${vendorData.vendorId} from V1:`, error.message);
      }

      const vendorEntry = {
        vendorId: vendorData.vendorId,
        vendorName: vendorDetails?.vendorName || 'Unknown',
        vendorPhone: vendorDetails?.phone || '',
        totalPurchaseOrders: vendorData.totalPurchaseOrders,
        totalPayments: vendorData.totalPayments,
        totalDiscounts: vendorData.totalDiscounts,
        remainingBalance,
      };

      if (remainingBalance > 0) {
        vendorCreditors.push(vendorEntry);
      } else if (remainingBalance < 0) {
        vendorDebtors.push(vendorEntry);
      }
    })
  );

  // Calculate summary totals
  const summary = {
    vendorCreditorsTotal: vendorCreditors.reduce((sum, v) => sum + v.remainingBalance, 0),
    vendorDebtorsTotal: Math.abs(vendorDebtors.reduce((sum, v) => sum + v.remainingBalance, 0)),
    customerCreditorsTotal: customerCreditors.reduce((sum, c) => sum + c.remainingBalance, 0),
    customerDebtorsTotal: Math.abs(customerDebtors.reduce((sum, c) => sum + c.remainingBalance, 0)),
  };

  res.status(httpStatus.OK).send({
    success: true,
    message: 'Balance sheet fetched successfully',
    data: {
      dateRange: {
        startDate: startDate || null,
        endDate: endDate || null,
      },
      vendorCreditors: vendorCreditors.sort((a, b) => b.remainingBalance - a.remainingBalance),
      vendorDebtors: vendorDebtors.sort((a, b) => a.remainingBalance - b.remainingBalance),
      customerCreditors: customerCreditors.sort((a, b) => b.remainingBalance - a.remainingBalance),
      customerDebtors: customerDebtors.sort((a, b) => a.remainingBalance - b.remainingBalance),
      summary,
    },
  });
});

module.exports = {
  getMonthlyPurchaseSale,
  getProfitLossSummary,
  getDailyReport,
  getBalanceSheet,
};
