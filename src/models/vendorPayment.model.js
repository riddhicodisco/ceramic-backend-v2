const mongoose = require('mongoose');
const { toJSON, paginate } = require('./plugins');

const vendorPaymentSchema = mongoose.Schema(
  {
    vendorId: {
      type: mongoose.Schema.Types.ObjectId,
      required: true,
    },
    payableAmount: {
      type: Number,
      required: true,
      default: 0,
    },
    transactionType: {
      type: String,
      enum: ['Credit', 'Debit'],
      required: true,
    },
    category: {
      type: String,
      enum: ['Payment', 'Return', 'Credit Note'],
      required: true,
    },
    discountGiven: {
      type: Number,
      default: 0,
    },
    notes: {
      type: String,
      trim: true,
      default: '',
    },
    date: {
      type: Date,
      default: Date.now,
    },
    createdBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'users',
      required: true,
    },
    vendorName: {
      type: String,
      trim: true,
    },
    vendorPhone: {
      type: String,
      trim: true,
    },
    deletedAt: {
      type: Date,
      default: null,
    },
    relatedPaymentId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'VendorPayment',
      default: null,
    },
  },
  {
    timestamps: true,
  }
);

// add plugin that converts mongoose to json
vendorPaymentSchema.plugin(toJSON);
vendorPaymentSchema.plugin(paginate);

/**
 * @typedef VendorPayment
 */
const VendorPayment = mongoose.model('VendorPayment', vendorPaymentSchema);

module.exports = VendorPayment;

