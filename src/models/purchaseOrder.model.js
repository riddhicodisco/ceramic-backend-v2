const mongoose = require('mongoose');
const { toJSON, paginate } = require('./plugins');

const purchaseItemSchema = new mongoose.Schema(
  {
    // Product References
    productVariantId: {
      type: mongoose.Schema.Types.Mixed,
      ref: 'Product_variant',
      required: false,
    },
    seriesProductId: {
      type: mongoose.Schema.Types.Mixed,
      ref: 'series_product',
    },
    selectionProductId: {
      type: mongoose.Schema.Types.Mixed,
      ref: 'SelectionProduct',
    },
    selectionId: {
      type: mongoose.Schema.Types.Mixed,
      ref: 'Selection',
      required: false,
    },

    // Item Detail (for frontend display)
    itemDetail: {
      type: String,
      default: '',
    },

    // Item Details (NEW - for easy display without lookups)
    itemCode: {
      type: String,
      default: '',
    },
    itemName: {
      type: String,
      default: '',
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
    seriesDimension: {
      type: String,
      default: '',
    },
    designCode: {
      type: String,
      default: '',
    },

    // Additional Product IDs (NEW - for reference)
    productId: {
      type: String, // Can be String or ObjectId from V1
    },
    variantId: {
      type: String,
    },
    seriesId: {
      type: String,
    },

    // Pricing & Quantity (V2 uses Numbers)
    quantity: {
      type: Number,
      required: false,
    },
    // unitPerPrice: {
    //   type: Number,
    //   required: true,
    // },
    totalAmount: {
      type: Number,
      default: 0,
    },
    unit: {
      type: String,
      enum: ['Sq.Feet/Price', 'Piece/Price'],
      default: 'Sq.Feet/Price',
    },

    // // Box Information
    // totalBox: {
    //   type: Number,
    //   default: 0,
    // },
    // totalSquareFeet: {
    //   type: Number,
    //   default: 0,
    // },

    // Discount & Pricing
    discount: {
      type: Number,
      default: 0,
    },
    mrp: {
      type: Number,
    },
    price: {
      type: Number,
    },
    total: {
      type: Number,
    },

    // Metadata (NEW)
    isProductDeleted: {
      type: Boolean,
      default: false,
    },

    // Challan Reference (if this item is linked to a challan)
    challanId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'challan',
    },
  },
  {
    _id: false, // Don't create separate _id for sub-documents
  }
);

const purchaseOrderSchema = new mongoose.Schema(
  {
    orderId: {
      type: String,
      required: true,
      unique: true,
    },
    vendor: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'vendor',
      required: true,
    },
    items: [purchaseItemSchema],
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
    challan: {
      type: String,
      trim: true,
    },
    challanId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'challan',
    },
    status: {
      type: String,
      enum: ['Pending', 'Completed'],
      default: 'Pending',
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

purchaseOrderSchema.plugin(toJSON);
purchaseOrderSchema.plugin(paginate);

const PurchaseOrder = mongoose.model('PurchaseOrder', purchaseOrderSchema);

module.exports = PurchaseOrder;
