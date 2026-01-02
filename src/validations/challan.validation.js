const Joi = require('joi');
const { objectId } = require('./custom.validation');

const challanProductSchema = Joi.object().keys({
  productVariantId: Joi.string().custom(objectId).required(),
  seriesProductId: Joi.string().custom(objectId).optional(),
  selectionId: Joi.string().custom(objectId).optional(),
  quantity: Joi.number().min(1).required(),
  unitPerPrice: Joi.number().min(0).required(),
  totalAmount: Joi.number().min(0).required(),
  unit: Joi.string().valid('Sq.Feet/Price', 'Piece/Price').optional(),
  boxPerPiece: Joi.number().min(0).optional(),
  totalBox: Joi.number().min(0).optional(),
  totalSquareFeet: Joi.number().min(0).optional(),
});

module.exports = {
  createChallan: {
    body: Joi.object().keys({
      customerId: Joi.string().custom(objectId).required(),
      selectionIds: Joi.array().items(Joi.string().custom(objectId)).min(1).required(),
      products: Joi.array().items(challanProductSchema).min(1).required(),
      remarks: Joi.string().trim().optional().allow(''),
      status: Joi.string().valid('Pending', 'Running', 'Completed', 'Delivered').optional().default('Pending'),
    }),
  },

  updateChallan: {
    params: Joi.object().keys({
      id: Joi.string().custom(objectId).required(),
    }),
    body: Joi.object().keys({
      customerId: Joi.string().custom(objectId).optional(),
      selectionIds: Joi.array().items(Joi.string().custom(objectId)).min(1).optional(),
      products: Joi.array().items(challanProductSchema).min(1).optional(),
      remarks: Joi.string().trim().optional().allow(''),
      status: Joi.string().valid('Pending', 'Running', 'Completed', 'Delivered').optional(),
      purchaseOrderId: Joi.string().custom(objectId).optional().allow(''),
      deliveryNote: Joi.string().trim().optional().allow(''),
    }),
  },

  getChallan: {
    params: Joi.object().keys({
      id: Joi.string().custom(objectId).required(),
    }),
  },

  deleteChallan: {
    params: Joi.object().keys({
      id: Joi.string().custom(objectId).required(),
    }),
  },

  getAllChallans: {
    query: Joi.object().keys({
      page: Joi.number().integer().min(1).default(1),
      limit: Joi.number().integer().min(1).max(100).default(10),
      search: Joi.string().optional().allow(''),
      status: Joi.string().optional().allow('').valid('Pending', 'Running', 'Completed', 'Delivered', 'All'),
      customerId: Joi.string().custom(objectId).optional(),
    }),
  },

  getSelectionProducts: {
    query: Joi.object().keys({
      selectionIds: Joi.string().required(), // comma-separated IDs
    }),
  },

  downloadChallan: {
    params: Joi.object().keys({
      id: Joi.string().custom(objectId).required(),
    }),
  },
};
