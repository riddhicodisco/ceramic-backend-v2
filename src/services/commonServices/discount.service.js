const { Payment } = require('../../models');

/**
 * Create a discount (Credit Note)
 * @param {Object} discountBody
 * @returns {Promise<Payment>}
 */
const createDiscount = async (discountBody) => {
  return Payment.create({
    ...discountBody,
    transactionType: 'Credit',
    category: 'Credit Note',
  });
};

/**
 * Query for discounts (Credit Notes only)
 * @param {Object} filter - Mongo filter
 * @param {Object} options - Query options
 * @returns {Promise<QueryResult>}
 */
const queryDiscounts = async (filter, options) => {
  const discounts = await Payment.paginate(
    { ...filter, category: 'Credit Note', deletedAt: null },
    options
  );

  // Calculate total discount amount (all discounts, not just current page)
  const totalDiscountAgg = await Payment.aggregate([
    {
      $match: {
        ...filter,
        category: 'Credit Note',
        deletedAt: null,
      },
    },
    {
      $group: {
        _id: null,
        totalDiscount: { $sum: '$amount' },
      },
    },
  ]);

  const totalDiscount = totalDiscountAgg.length > 0 ? totalDiscountAgg[0].totalDiscount : 0;

  return {
    ...discounts,
    totalDiscount,
  };
};

/**
 * Get discount by id
 * @param {ObjectId} id
 * @returns {Promise<Payment>}
 */
const getDiscountById = async (id) => {
  return Payment.findOne({ _id: id, category: 'Credit Note', deletedAt: null });
};

/**
 * Delete discount by id
 * @param {ObjectId} discountId
 * @returns {Promise<Payment>}
 */
const deleteDiscountById = async (discountId) => {
  const discount = await Payment.findOne({ _id: discountId, category: 'Credit Note' });
  if (!discount) {
    throw new Error('Discount not found');
  }

  const now = new Date();
  discount.deletedAt = now;
  await discount.save();

  // If this discount is linked to a payment, clear the discount fields
  if (discount.relatedPaymentId) {
    await Payment.findByIdAndUpdate(discount.relatedPaymentId, {
      discountGiven: 0,
      relatedPaymentId: null,
    });
  }

  return discount;
};

module.exports = {
  createDiscount,
  queryDiscounts,
  getDiscountById,
  deleteDiscountById,
};
