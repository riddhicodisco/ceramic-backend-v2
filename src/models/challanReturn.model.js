const mongoose = require('mongoose');
const { toJSON, paginate } = require('./plugins');

const challanReturnProductSchema = new mongoose.Schema(
  {
    productVariantId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Product_variant',
      required: true,
    },
    productName: {
      type: String,
      default: '',
    },
    variantName: {
      type: String,
      default: '',
    },
    seriesName: {
      type: String,
      default: '',
    },
    designCode: {
      type: String,
      default: '',
    },
    dimension: {
      type: String,
      default: '',
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
      required: true,
    },
    totalBox: {
      type: Number,
    },
    totalSquareFeet: {
      type: Number,
      default: 0,
    },
    boxPerPiece: {
      type: Number,
    },
  },
  { _id: false }
);

const challanReturnSchema = new mongoose.Schema(
  {
    challanReturnNumber: {
      type: String,
      required: true,
      unique: true,
    },
    customerId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Customer',
      required: true,
    },
    challanId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'challan',
      required: true,
    },
    products: [challanReturnProductSchema],
    totalAmount: {
      type: Number,
      required: true,
      default: 0,
    },
    remarks: {
      type: String,
      trim: true,
      default: '',
    },
    createdBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'users',
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

challanReturnSchema.plugin(toJSON);
challanReturnSchema.plugin(paginate);

const ChallanReturn = mongoose.model('challan_return', challanReturnSchema);

module.exports = ChallanReturn;
