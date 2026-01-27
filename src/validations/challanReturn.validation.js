const Joi = require('joi');
const { objectId } = require('./custom.validation');

const createChallanReturn = {
  body: Joi.object().keys({
    customerId: Joi.string().custom(objectId).required(),
    challanId: Joi.string().custom(objectId).required(),
    products: Joi.array()
      .items(
        Joi.object().keys({
          productVariantId: Joi.string().custom(objectId).required(),
          productName: Joi.string().allow(''),
          variantName: Joi.string().allow(''),
          seriesName: Joi.string().allow(''),
          designCode: Joi.string().allow(''),
          dimension: Joi.string().allow(''),
          quantity: Joi.number().required(),
          unitPerPrice: Joi.number().required(),
          totalAmount: Joi.number().required(),
          unit: Joi.string().valid('Sq.Feet/Price', 'Piece/Price').required(),
          totalBox: Joi.number().allow(0, null),
          totalSquareFeet: Joi.number().allow(0, null),
          boxPerPiece: Joi.number().allow(0, null),
        })
      )
      .min(1)
      .required(),
    totalAmount: Joi.number().required(),
    remarks: Joi.string().allow(''),
  }),
};

const getAllChallanReturns = {
  query: Joi.object().keys({
    search: Joi.string().allow('', null),
    customerId: Joi.string().custom(objectId).allow('', null),
    challanId: Joi.string().custom(objectId).allow('', null),
    status: Joi.string().allow('', null),
    sortBy: Joi.string().allow('', null),
    limit: Joi.number().integer(),
    page: Joi.number().integer(),
  }),
};

const getChallanReturn = {
  params: Joi.object().keys({
    id: Joi.string().custom(objectId).required(),
  }),
};

const updateChallanReturn = {
  params: Joi.object().keys({
    id: Joi.string().custom(objectId).required(),
  }),
  body: Joi.object().keys({
    customerId: Joi.string().custom(objectId).optional(),
    challanId: Joi.string().custom(objectId).optional(),
    products: Joi.array()
      .items(
        Joi.object().keys({
          productVariantId: Joi.string().custom(objectId).required(),
          productName: Joi.string().allow(''),
          variantName: Joi.string().allow(''),
          seriesName: Joi.string().allow(''),
          designCode: Joi.string().allow(''),
          dimension: Joi.string().allow(''),
          quantity: Joi.number().required(),
          unitPerPrice: Joi.number().required(),
          totalAmount: Joi.number().required(),
          unit: Joi.string().valid('Sq.Feet/Price', 'Piece/Price').required(),
          totalBox: Joi.number().allow(0, null),
          totalSquareFeet: Joi.number().allow(0, null),
          boxPerPiece: Joi.number().allow(0, null),
        })
      )
      .min(1)
      .optional(),
    totalAmount: Joi.number().optional(),
    remarks: Joi.string().allow('').optional(),
  }),
};

const deleteChallanReturn = {
  params: Joi.object().keys({
    id: Joi.string().custom(objectId).required(),
  }), 
};

module.exports = {
  createChallanReturn,
  getAllChallanReturns,
  getChallanReturn,
  deleteChallanReturn,
  updateChallanReturn,
};
