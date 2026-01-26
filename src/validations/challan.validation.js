const Joi = require('joi');
const { objectId } = require('./custom.validation');

const challanProductSchema = Joi.object().keys({
  _id: Joi.string().custom(objectId).optional(),
  productVariantId: Joi.string().custom(objectId).required(),
  seriesProductId: Joi.string().custom(objectId).optional(),
  selectionProductId: Joi.string().custom(objectId).optional(), // Added for V1 tracking
  selectionId: Joi.string().custom(objectId).optional().allow(null),
  unitPerPrice: Joi.number().min(0).required(),
  totalAmount: Joi.number().min(0).required(),
  unit: Joi.string().valid('Sq.Feet/Price', 'Piece/Price').required(),
  designCode: Joi.string().optional().allow(''),
  productName: Joi.string().required(),
  seriesName: Joi.string().optional().allow(''),
  dimension: Joi.string().optional().allow(''),
  seriesId: Joi.string().optional(),
  variantId: Joi.string().optional(),
  variantName: Joi.string().optional().allow(''),
  boxPerPiece: Joi.number().min(0).optional(),
  totalBox: Joi.number().min(0).optional(),
  totalSquareFeet: Joi.number().min(0).optional(),
}).unknown(true);

module.exports = {
  createChallan: {
    body: Joi.object().keys({
      customerId: Joi.string().custom(objectId).when('customerMode', {
        is: 'existing',
        then: Joi.required(),
        otherwise: Joi.optional().allow(null)
      }),
      customerMode: Joi.string().valid('existing', 'new').required(),
      newCustomerData: Joi.when('customerMode', {
        is: 'new',
        then: Joi.object().keys({
          first_name: Joi.string().required(),
          last_name: Joi.string().required(),
          phone: Joi.string().required(),
          email: Joi.string().optional().allow(''),
          address: Joi.string().optional().allow(''),
          customerType: Joi.string().required(),
          reference: Joi.string().optional().allow(''),
        }).required(),
        otherwise: Joi.optional().allow(null)
      }),
      selectionIds: Joi.array().items(Joi.string().custom(objectId)).when('customerMode', {
        is: 'existing',
        then: Joi.array().min(1).required(),
        otherwise: Joi.array().optional()
      }),
      newCustomerSelections: Joi.when('customerMode', {
        is: 'new',
        then: Joi.array().items(Joi.object()).min(1).required(),
        otherwise: Joi.array().optional()
      }),
      assignTo: Joi.array().items(Joi.string().custom(objectId)).optional(),
      products: Joi.array().items(challanProductSchema).min(1).required(),
      remarks: Joi.string().trim().optional().allow(''),
      status: Joi.string().valid('Pending', 'Running', 'Completed', 'Delivered').optional().default('Pending'),
      transporterId: Joi.string().custom(objectId).optional().allow(null, ''),
      transporterName: Joi.string().trim().optional().allow('', null),
      transporterAmount: Joi.number().min(0).optional().allow(null),
    }).unknown(true),
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
      transporterId: Joi.string().custom(objectId).optional().allow(null, ''),
      transporterName: Joi.string().trim().optional().allow('', null),
      transporterAmount: Joi.number().min(0).optional().allow(null),
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
      selectionIds: Joi.string().optional().allow(''),
      startDate: Joi.string().optional().allow(''),
      endDate: Joi.string().optional().allow(''),
      minAmount: Joi.number().optional(),
      maxAmount: Joi.number().optional(),
    }),
  },

  getRecentChallans: {
    query: Joi.object().keys({
      page: Joi.number().integer().min(1).default(1),
      limit: Joi.number().integer().min(1).max(100).default(10),
      search: Joi.string().optional().allow(''),
      status: Joi.string().optional().allow('').valid('Pending', 'Running', 'Completed', 'Delivered', 'All'),
    }),
  },

  // getSelectionProducts: {
  //   query: Joi.object().keys({
  //     selectionIds: Joi.string().required(), // comma-separated IDs
  //   }),
  // },

  getCustomerChallans: {
    params: Joi.object().keys({
      customerId: Joi.string().custom(objectId).required(),
    }),
    query: Joi.object().keys({
      page: Joi.number().integer().min(1).default(1),
      limit: Joi.number().integer().min(1).max(100).default(10),
      status: Joi.string().optional().allow('').valid('Pending', 'Running', 'Completed', 'Delivered', 'All'),
    }),
  },


  downloadChallan: {
    params: Joi.object().keys({
      id: Joi.string().custom(objectId).required(),
    }),
  },
};
