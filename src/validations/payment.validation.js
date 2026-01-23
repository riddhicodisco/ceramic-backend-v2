const Joi = require('joi');
const { objectId } = require('./custom.validation');

const createPayment = {
  body: Joi.object().keys({
    customerId: Joi.string().custom(objectId).required(),
    amount: Joi.number().required(),
    transactionType: Joi.string().valid('Credit', 'Debit').required(),
    category: Joi.string().valid('Payment', 'Return', 'Credit Note').required(),
    discountGiven: Joi.number().optional(),
    remark: Joi.string().allow('').optional(),
    date: Joi.date().optional(),
    customerName: Joi.string().allow('').optional(),
    customerPhone: Joi.string().allow('').optional(),
  }),
};

const getPayments = {
  query: Joi.object().keys({
    customerId: Joi.string().custom(objectId),
    category: Joi.string().valid('Payment', 'Return', 'Credit Note'),
    transactionType: Joi.string().valid('Credit', 'Debit'),
    sortBy: Joi.string(),
    limit: Joi.number().integer(),
    page: Joi.number().integer(),
    search: Joi.string().allow('').optional(),
  }),
};

const getCustomerBalance = {
  params: Joi.object().keys({
    customerId: Joi.string().custom(objectId).required(),
  }),
};

const getPayment = {
  params: Joi.object().keys({
    paymentId: Joi.string().custom(objectId).required(),
  }),
};

const updatePayment = {
  params: Joi.object().keys({
    paymentId: Joi.string().custom(objectId).required(),
  }),
  body: Joi.object()
    .keys({
      customerId: Joi.string().custom(objectId),
      amount: Joi.number(),
      transactionType: Joi.string().valid('Credit', 'Debit'),
      category: Joi.string().valid('Payment', 'Return', 'Credit Note'),
      discountGiven: Joi.number(),
      remark: Joi.string().allow(''),
      date: Joi.date(),
      customerName: Joi.string().allow(''),
      customerPhone: Joi.string().allow(''),
    })
    .min(1),
};

const deletePayment = {
  params: Joi.object().keys({
    paymentId: Joi.string().custom(objectId).required(),
  }),
};

module.exports = {
  createPayment,
  getPayments,
  getPayment,
  updatePayment,
  getCustomerBalance,
  deletePayment,
};
