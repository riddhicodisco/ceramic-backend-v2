const { Payment, Challan, ChallanReturn } = require('../../models');
const mongoose = require('mongoose');

/**
 * Create a payment
 * @param {Object} paymentBody
 * @returns {Promise<Payment>}
 */
const createPayment = async (paymentBody) => {
  const payment = await Payment.create(paymentBody);

  // If discount is given, create a sibling Credit Note entry
  if (payment.discountGiven > 0) {
    const discountEntry = await Payment.create({
      customerId: payment.customerId,
      amount: payment.discountGiven,
      transactionType: 'Credit',
      category: 'Credit Note',
      remark: `Auto-generated discount form payment`.trim(),
      date: payment.date || new Date(),
      relatedPaymentId: payment._id,
      createdBy: payment.createdBy,
      customerName: paymentBody.customerName || payment.customerName,
      customerPhone: paymentBody.customerPhone || payment.customerPhone,
    });

    payment.relatedPaymentId = discountEntry._id;
    await payment.save();
  }

  return payment;
};

/**
 * Query for payments
 * @param {Object} filter - Mongo filter
 * @param {Object} options - Query options
 * @param {string} [options.sortBy] - Sort option in the format: sortField:(desc|asc)
 * @param {number} [options.limit] - Maximum number of results per page (default = 10)
 * @param {number} [options.page] - Current page (default = 1)
 * @returns {Promise<QueryResult>}
 */
const queryPayments = async (filter, options) => {
  const payments = await Payment.paginate({ ...filter, deletedAt: null }, options);
  return payments;
};

/**
 * Get customer balance information
 * @param {string} customerId
 * @returns {Promise<Object>}
 */
const getCustomerBalance = async (customerId) => {
  const customerObjectId = new mongoose.Types.ObjectId(customerId);

  // 1. Calculate Total Balance from Challans (Active)
  const challanAgg = await Challan.aggregate([
    {
      $match: {
        customerId: customerObjectId,
        deletedAt: null,
      },
    },
    {
      $group: {
        _id: null,
        totalSales: { $sum: '$totalAmount' },
      },
    },
  ]);

  const totalSales = challanAgg.length > 0 ? challanAgg[0].totalSales : 0;

  // 2. Calculate Total Returns from ChallanReturn collection
  const returnAgg = await ChallanReturn.aggregate([
    {
      $match: {
        customerId: customerObjectId,
        deletedAt: null,
      },
    },
    {
      $group: {
        _id: null,
        totalReturns: { $sum: '$totalAmount' },
      },
    },
  ]);

  const totalReturns = returnAgg.length > 0 ? returnAgg[0].totalReturns : 0;

  // 3. Calculate Total Payments and Discounts
  const paymentAgg = await Payment.aggregate([
    {
      $match: {
        customerId: customerObjectId,
        deletedAt: null,
      },
    },
    {
      $group: {
        _id: null,
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

  const totalPayments = paymentAgg.length > 0 ? paymentAgg[0].totalPayments : 0;
  const totalDiscounts = paymentAgg.length > 0 ? paymentAgg[0].totalDiscounts : 0;

  // 4. Final Calculation
  const remainingBalance = totalSales - (totalPayments + totalReturns + totalDiscounts);

  return {
    totalSales,
    totalPayments,
    totalReturns,
    totalDiscounts,
    remainingBalance,
  };
};

/**
 * Get payment by id
 * @param {ObjectId} id
 * @returns {Promise<Payment>}
 */
const getPaymentById = async (id) => {
  return Payment.findOne({ _id: id, deletedAt: null }).populate('customerId');
};

/**
 * Update payment by id
 * @param {ObjectId} paymentId
 * @param {Object} updateBody
 * @returns {Promise<Payment>}
 */
const updatePaymentById = async (paymentId, updateBody) => {
  const payment = await getPaymentById(paymentId);
  if (!payment) {
    throw new Error('Payment not found');
  }

  const oldDiscount = payment.discountGiven;
  Object.assign(payment, updateBody);
  await payment.save();

  // Manage sibling Credit Note if discount changed
  if (updateBody.discountGiven !== undefined && updateBody.discountGiven !== oldDiscount) {
    if (payment.discountGiven > 0) {
      if (payment.relatedPaymentId) {
        // Update existing sibling
        await Payment.findByIdAndUpdate(payment.relatedPaymentId, {
          amount: payment.discountGiven,
          customerId: payment.customerId,
          customerName: updateBody.customerName || payment.customerName,
          customerPhone: updateBody.customerPhone || payment.customerPhone,
        });
      } else {
        // Create new sibling
        const discountEntry = await Payment.create({
          customerId: payment.customerId,
          amount: payment.discountGiven,
          transactionType: 'Credit',
          category: 'Credit Note',
          remark: `Auto-generated discount for payment`.trim(),
          date: payment.date || new Date(),
          relatedPaymentId: payment._id,
          createdBy: payment.createdBy,
          customerName: updateBody.customerName || payment.customerName,
          customerPhone: updateBody.customerPhone || payment.customerPhone,
        });
        payment.relatedPaymentId = discountEntry._id;
        await payment.save();
      }
    } else if (payment.relatedPaymentId) {
      // Delete existing sibling if discount is now 0
      await Payment.findByIdAndUpdate(payment.relatedPaymentId, { deletedAt: new Date() });
      payment.relatedPaymentId = null;
      await payment.save();
    }
  }

  return payment;
};

/**
 * Delete payment by id
 * @param {ObjectId} paymentId
 * @returns {Promise<Payment>}
 */
const deletePaymentById = async (paymentId) => {
  const payment = await Payment.findById(paymentId);
  if (!payment) {
    throw new Error('Payment not found');
  }

  const now = new Date();

  // If this is a child (Credit Note) being deleted
  if (payment.category === 'Credit Note' && payment.relatedPaymentId) {
    // 1. Soft delete the child itself
    payment.deletedAt = now;
    await payment.save();

    // 2. Find and update the parent (Main Payment)
    await Payment.findByIdAndUpdate(payment.relatedPaymentId, {
      discountGiven: 0,
      relatedPaymentId: null,
    });
  } else {
    // If this is a parent (Main Payment) being deleted
    payment.deletedAt = now;
    await payment.save();

    // Soft delete the sibling Credit Note if it exists
    if (payment.relatedPaymentId) {
      await Payment.findByIdAndUpdate(payment.relatedPaymentId, { deletedAt: now });
    }
  }

  return payment;
};

module.exports = {
  createPayment,
  queryPayments,
  getCustomerBalance,
  getPaymentById,
  updatePaymentById,
  deletePaymentById,
};
