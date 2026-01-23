const mongoose = require('mongoose');
const { toJSON, paginate } = require('./plugins');

const paymentSchema = mongoose.Schema(
  {
    customerId: {
      type: mongoose.Schema.Types.ObjectId,
      // ref: 'customer',
      required: true,
    },
    amount: {
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
    remark: {
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
    customerName: {
      type: String,
      trim: true,
    },
    customerPhone: {
      type: String,
      trim: true,
    },
    deletedAt: {
      type: Date,
      default: null,
    },
    relatedPaymentId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Payment',
      default: null,
    },
  },
  {
    timestamps: true,
  }
);

// add plugin that converts mongoose to json
paymentSchema.plugin(toJSON);
paymentSchema.plugin(paginate);

/**
 * @typedef Payment
 */
const Payment = mongoose.model('Payment', paymentSchema);

module.exports = Payment;
