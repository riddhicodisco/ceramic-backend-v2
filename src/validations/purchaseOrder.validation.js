const Joi = require("joi");
const { objectId } = require("./custom.validation");

const purchaseItemSchema = Joi.object()
  .keys({
    itemCode: Joi.string().required(),
    itemDetail: Joi.string().custom(objectId).required(),
    itemName: Joi.string().optional(),
    productVariantId: Joi.string().optional().allow("", null),
    selectionId: Joi.string().optional().allow("", null),
    challanId: Joi.string().optional().allow('', null),
    // mrp: Joi.number().required(),
    totalSquareFeet: Joi.number().optional().allow(null),
    totalBox: Joi.number().optional(),
    boxPerPiece: Joi.number().optional(),
    unit: Joi.string().optional(),
    discount: Joi.number().optional().default(0),
  })
  .unknown(true);

module.exports = {
  createPurchaseOrder: {
    body: Joi.object()
      .keys({
        orderId: Joi.string().optional(),
        vendor: Joi.string().custom(objectId).required(),
        items: Joi.array().items(purchaseItemSchema).min(1).required(),
        status: Joi.string()
          .valid("Pending", "Completed")
          .optional()
          .default("Pending"),
        remarks: Joi.string().trim().optional().allow(""),
        challan: Joi.when("status", {
          is: "Completed",
          then: Joi.string().trim().required(),
          otherwise: Joi.optional().allow("", null),
        }),
        challanId: Joi.string().optional().allow("", null),
      })
      .unknown(true),
  },

  updatePurchaseOrder: {
    params: Joi.object().keys({
      id: Joi.string().custom(objectId).required(),
    }),
    body: Joi.object().keys({
      orderId: Joi.string().optional(),
      vendor: Joi.string().custom(objectId).optional(),
      items: Joi.array().items(purchaseItemSchema).min(1).optional(),
      status: Joi.string().valid("Pending", "Completed").optional(),
      remarks: Joi.string().trim().optional().allow("", null),
      challan: Joi.string().trim().optional().allow("", null),
      challanId: Joi.string().optional().allow('', null),
    }),
  },

  getPurchaseOrder: {
    params: Joi.object().keys({
      id: Joi.string().custom(objectId).required(),
    }),
  },

  deletePurchaseOrder: {
    params: Joi.object().keys({
      id: Joi.string().custom(objectId).required(),
    }),
  },

  getAllPurchaseOrders: {
    query: Joi.object().keys({
      page: Joi.number().integer().min(1).default(1),
      limit: Joi.number().integer().min(1).max(100).default(10),
      search: Joi.string().optional().allow(""),
      status: Joi.string().optional().allow("").valid("Pending", "Completed"),
      vendor: Joi.string().custom(objectId).optional(),
    }),
  },
};
