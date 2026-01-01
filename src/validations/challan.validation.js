const Joi = require('joi');
const { objectId } = require('./custom.validation');

const createChallan = {
  body: Joi.object().keys({
    productId: Joi.string().custom(objectId).required(),
    qty: Joi.number().integer().min(1).required(),
  }),
};

const getChallans = {
  query: Joi.object().keys({
    page: Joi.number().integer().min(1).default(1),
    limit: Joi.number().integer().min(1).max(100).default(10),
    productId: Joi.string().custom(objectId).optional(),
  }),
};

const getChallan = {
  params: Joi.object().keys({
    id: Joi.string().custom(objectId).required(),
  }),
};

const updateChallan = {
  params: Joi.object().keys({
    id: Joi.string().custom(objectId).required(),
  }),
  body: Joi.object().keys({
    qty: Joi.number().integer().min(1).optional(),
  }),
};

const deleteChallan = {
  params: Joi.object().keys({
    id: Joi.string().custom(objectId).required(),
  }),
};

module.exports = {
  createChallan,
  getChallans,
  getChallan,
  updateChallan,
  deleteChallan,
};
