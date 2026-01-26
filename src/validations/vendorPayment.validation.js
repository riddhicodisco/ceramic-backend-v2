const Joi = require('joi');
const { objectId } = require('./custom.validation');

const createVendorPayment = {
  body: Joi.object().keys({
    vendorId: Joi.string().custom(objectId).required(),
    payableAmount: Joi.number().required(),
    transactionType: Joi.string().valid('Credit', 'Debit').required(),
    category: Joi.string().valid('Payment', 'Return', 'Credit Note').required(),
    discountGiven: Joi.number().optional(),
    notes: Joi.string().allow('').optional(),
    date: Joi.date().optional(),
    vendorName: Joi.string().allow('').optional(),
    vendorPhone: Joi.string().allow('').optional(),
  }),
};

const getVendorPayments = {
  query: Joi.object().keys({
    vendorId: Joi.string().custom(objectId),
    category: Joi.string().valid('Payment', 'Return', 'Credit Note'),
    transactionType: Joi.string().valid('Credit', 'Debit'),
    sortBy: Joi.string(),
    limit: Joi.number().integer(),
    page: Joi.number().integer(),
    search: Joi.string().allow('').optional(),
  }),
};

const getVendorPayment = {
  params: Joi.object().keys({
    paymentId: Joi.string().custom(objectId).required(),
  }),
};

const getVendorBalance = {
  params: Joi.object().keys({
    vendorId: Joi.string().custom(objectId).required(),
  }),
};

const updateVendorPayment = {
  params: Joi.object().keys({
    paymentId: Joi.string().custom(objectId).required(),
  }),
  body: Joi.object()
    .keys({
      vendorId: Joi.string().custom(objectId),
      payableAmount: Joi.number(),
      transactionType: Joi.string().valid('Credit', 'Debit'),
      category: Joi.string().valid('Payment', 'Return', 'Credit Note'),
      discountGiven: Joi.number(),
      notes: Joi.string().allow(''),
      date: Joi.date(),
      vendorName: Joi.string().allow(''),
      vendorPhone: Joi.string().allow(''),
    })
    .min(1),
};

const deleteVendorPayment = {
  params: Joi.object().keys({
    paymentId: Joi.string().custom(objectId).required(),
  }),
};

module.exports = {
  createVendorPayment,
  getVendorPayments,
  getVendorPayment,
  updateVendorPayment,
  getVendorBalance,
  deleteVendorPayment,
};

