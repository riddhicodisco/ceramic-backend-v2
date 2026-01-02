const mongoose = require('mongoose');
const { toJSON, paginate } = require('./plugins');

const challanProductSchema = new mongoose.Schema(
  {
    productVariantId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Product_variant',
      required: true,
    },
    seriesProductId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'series_product',
    },
    selectionId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Selection',
    },
    quantity: {
      type: Number,
      required: true,
    },
    unitPerPrice: {
      type: Number,
      required: true,
    },
    totalAmount: {
      type: Number,
      required: true,
    },
    unit: {
      type: String,
      enum: ['Sq.Feet/Price', 'Piece/Price'],
    },
    boxPerPiece: {
      type: Number,
    },
    totalBox: {
      type: Number,
    },
    totalSquareFeet: {
      type: Number,
    },
  }
);

const challanSchema = new mongoose.Schema(
  {
    challanNumber: {
      type: String,
      required: true,
      unique: true,
    },
    customerId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Customer',
      required: true,
    },
    selectionIds: [
      {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'Selection',
      },
    ],
    products: [challanProductSchema],
    totalAmount: {
      type: Number,
      required: true,
      default: 0,
    },
    totalQuantity: {
      type: Number,
      required: true,
      default: 0,
    },
    status: {
      type: String,
      enum: ['Pending', 'Running', 'Completed', 'Delivered'],
      default: 'Pending',
    },
    remarks: {
      type: String,
      trim: true,
    },
    purchaseOrderId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'PurchaseOrder',
    },
    deliveryNote: {
      type: String,
      trim: true,
    },
    createdBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      required: true,
    },
    deletedAt: {
      type: Date,
      default: null,
    },
  },
  {
    timestamps: true,
    versionKey: false,
  }
);

challanSchema.plugin(toJSON);
challanSchema.plugin(paginate);

const Challan = mongoose.model('Challan', challanSchema);

module.exports = Challan; 