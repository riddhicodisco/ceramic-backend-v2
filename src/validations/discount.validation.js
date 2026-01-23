const Joi = require('joi');
const { objectId } = require('./custom.validation');

const createDiscount = {
  body: Joi.object().keys({
    customerId: Joi.string().custom(objectId).required(),
    amount: Joi.number().required(),
    remark: Joi.string().allow('').optional(),
    date: Joi.date().optional(),
    customerName: Joi.string().allow('').optional(),
    customerPhone: Joi.string().allow('').optional(),
  }),
};

const getDiscounts = {
  query: Joi.object().keys({
    customerId: Joi.string().custom(objectId),
    sortBy: Joi.string(),
    limit: Joi.number().integer(),
    page: Joi.number().integer(),
    search: Joi.string().allow('').optional(),
  }),
};

const getDiscount = {
  params: Joi.object().keys({
    discountId: Joi.string().custom(objectId).required(),
  }),
};

const deleteDiscount = {
  params: Joi.object().keys({
    discountId: Joi.string().custom(objectId).required(),
  }),
};

module.exports = {
  createDiscount,
  getDiscounts,
  getDiscount,
  deleteDiscount,
};
