const Joi = require('joi');
const { objectId } = require('./custom.validation');

const getVendorPurchaseOrders = {
  params: Joi.object().keys({
    vendorId: Joi.string().custom(objectId).required(),
  }),
  query: Joi.object().keys({
    page: Joi.number().integer().min(1),
    limit: Joi.number().integer().min(1).max(100),
    startDate: Joi.date().iso(),
    endDate: Joi.date().iso().min(Joi.ref('startDate')),
    minAmount: Joi.number().min(0),
    maxAmount: Joi.number().min(Joi.ref('minAmount')),
    challanNumber: Joi.string(),
    status: Joi.string().valid('Pending', 'Completed', 'All'),
  }),
};

module.exports = {
  getVendorPurchaseOrders,
};
