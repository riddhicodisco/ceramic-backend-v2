const { VendorPayment, PurchaseOrder } = require('../../models');
const mongoose = require('mongoose');

/**
 * Create a vendor payment
 * @param {Object} paymentBody
 * @returns {Promise<VendorPayment>}
 */
const createVendorPayment = async (paymentBody) => {
  const vendorPayment = await VendorPayment.create(paymentBody);

  // If discount is given, create a sibling Credit Note entry
  if (vendorPayment.discountGiven > 0) {
    const discountEntry = await VendorPayment.create({
      vendorId: vendorPayment.vendorId,
      payableAmount: vendorPayment.discountGiven,
      transactionType: 'Credit',
      category: 'Credit Note',
      notes: `Auto-generated discount from payment`.trim(),
      date: vendorPayment.date || new Date(),
      relatedPaymentId: vendorPayment._id,
      createdBy: vendorPayment.createdBy,
      vendorName: paymentBody.vendorName || vendorPayment.vendorName,
      vendorPhone: paymentBody.vendorPhone || vendorPayment.vendorPhone,
    });

    vendorPayment.relatedPaymentId = discountEntry._id;
    await vendorPayment.save();
  }

  return vendorPayment;
};

/**
 * Query for vendor payments
 * @param {Object} filter - Mongo filter
 * @param {Object} options - Query options
 * @param {string} [options.sortBy] - Sort option in the format: sortField:(desc|asc)
 * @param {number} [options.limit] - Maximum number of results per page (default = 10)
 * @param {number} [options.page] - Current page (default = 1)
 * @returns {Promise<QueryResult>}
 */
const queryVendorPayments = async (filter, options) => {
  const vendorPayments = await VendorPayment.paginate({ ...filter, deletedAt: null }, options);
  return vendorPayments;
};

/**
 * Get vendor payment by id
 * @param {ObjectId} id
 * @returns {Promise<VendorPayment>}
 */
const getVendorPaymentById = async (id) => {
  return VendorPayment.findOne({ _id: id, deletedAt: null });
};

/**
 * Update vendor payment by id
 * @param {ObjectId} paymentId
 * @param {Object} updateBody
 * @returns {Promise<VendorPayment>}
 */
const updateVendorPaymentById = async (paymentId, updateBody) => {
  const vendorPayment = await getVendorPaymentById(paymentId);
  if (!vendorPayment) {
    throw new Error('Vendor payment not found');
  }

  const oldDiscount = vendorPayment.discountGiven;
  Object.assign(vendorPayment, updateBody);
  await vendorPayment.save();

  // Manage sibling Credit Note if discount changed
  if (updateBody.discountGiven !== undefined && updateBody.discountGiven !== oldDiscount) {
    if (vendorPayment.discountGiven > 0) {
      if (vendorPayment.relatedPaymentId) {
        // Update existing sibling
        await VendorPayment.findByIdAndUpdate(vendorPayment.relatedPaymentId, {
          payableAmount: vendorPayment.discountGiven,
          vendorId: vendorPayment.vendorId,
          vendorName: updateBody.vendorName || vendorPayment.vendorName,
          vendorPhone: updateBody.vendorPhone || vendorPayment.vendorPhone,
        });
      } else {
        // Create new sibling
        const discountEntry = await VendorPayment.create({
          vendorId: vendorPayment.vendorId,
          payableAmount: vendorPayment.discountGiven,
          transactionType: 'Credit',
          category: 'Credit Note',
          notes: `Auto-generated discount for payment`.trim(),
          date: vendorPayment.date || new Date(),
          relatedPaymentId: vendorPayment._id,
          createdBy: vendorPayment.createdBy,
          vendorName: updateBody.vendorName || vendorPayment.vendorName,
          vendorPhone: updateBody.vendorPhone || vendorPayment.vendorPhone,
        });
        vendorPayment.relatedPaymentId = discountEntry._id;
        await vendorPayment.save();
      }
    } else if (vendorPayment.relatedPaymentId) {
      // Delete existing sibling if discount is now 0
      await VendorPayment.findByIdAndUpdate(vendorPayment.relatedPaymentId, { deletedAt: new Date() });
      vendorPayment.relatedPaymentId = null;
      await vendorPayment.save();
    }
  }

  return vendorPayment;
};

/**
 * Delete vendor payment by id
 * @param {ObjectId} paymentId
 * @returns {Promise<VendorPayment>}
 */
const deleteVendorPaymentById = async (paymentId) => {
  const vendorPayment = await VendorPayment.findById(paymentId);
  if (!vendorPayment) {
    throw new Error('Vendor payment not found');
  }

  const now = new Date();

  // If this is a child (Credit Note) being deleted
  if (vendorPayment.category === 'Credit Note' && vendorPayment.relatedPaymentId) {
    // 1. Soft delete the child itself
    vendorPayment.deletedAt = now;
    await vendorPayment.save();

    // 2. Find and update the parent (Main Payment)
    await VendorPayment.findByIdAndUpdate(vendorPayment.relatedPaymentId, {
      discountGiven: 0,
      relatedPaymentId: null,
    });
  } else {
    // If this is a parent (Main Payment) being deleted
    vendorPayment.deletedAt = now;
    await vendorPayment.save();

    // Soft delete the sibling Credit Note if it exists
    if (vendorPayment.relatedPaymentId) {
      await VendorPayment.findByIdAndUpdate(vendorPayment.relatedPaymentId, { deletedAt: now });
    }
  }

  return vendorPayment;
};

/**
 * Get vendor balance/stats information
 * @param {string} vendorId
 * @returns {Promise<Object>}
 */
const getVendorBalance = async (vendorId) => {
  const vendorObjectId = new mongoose.Types.ObjectId(vendorId);

  // 1. Calculate Total Purchase Order Amount from PurchaseOrder table (V2)
  const purchaseOrderAgg = await PurchaseOrder.aggregate([
    {
      $match: {
        vendor: vendorObjectId,
        deletedAt: null,
      },
    },
    {
      $group: {
        _id: null,
        totalPurchasedOrderAmount: { $sum: '$totalAmount' },
      },
    },
  ]);

  const totalPurchasedOrderAmount = purchaseOrderAgg.length > 0 ? purchaseOrderAgg[0].totalPurchasedOrderAmount : 0;

  // 2. Calculate Total Payments (Credit - Debit) and Discounts (Credit Note)
  const vendorPaymentAgg = await VendorPayment.aggregate([
    {
      $match: {
        vendorId: vendorObjectId,
        deletedAt: null,
      },
    },
    {
      $group: {
        _id: null,
        totalCredit: {
            $sum: {
              $cond: [
                {
                  $and: [
                    { $eq: ['$transactionType', 'Credit'] },
                    { $ne: ['$category', 'Credit Note'] }
                  ]
                },
                '$payableAmount',
                0
              ]
            }
        },
        totalDebit: {
          $sum: {
            $cond: [{ $eq: ['$transactionType', 'Debit'] }, '$payableAmount', 0],
          },
        },
        totalDiscounts: {
          $sum: {
            $cond: [{ $eq: ['$category', 'Credit Note'] }, '$payableAmount', 0],
          },
        },
      },
    },
  ]);

  const totalCredit = vendorPaymentAgg.length > 0 ? vendorPaymentAgg[0].totalCredit : 0;
  const totalDebit = vendorPaymentAgg.length > 0 ? vendorPaymentAgg[0].totalDebit : 0;
  const totalPayments = totalCredit - totalDebit;
  const totalDiscounts = vendorPaymentAgg.length > 0 ? vendorPaymentAgg[0].totalDiscounts : 0;

  // 3. Final Calculation
  const remainingBalance = totalPurchasedOrderAmount - (totalPayments + totalDiscounts);

  return {
    totalPurchasedOrderAmount,
    totalPayments,
    totalDiscounts,
    remainingBalance,
  };
};

module.exports = {
  createVendorPayment,
  queryVendorPayments,
  getVendorPaymentById,
  updateVendorPaymentById,
  deleteVendorPaymentById,
  getVendorBalance,
};

