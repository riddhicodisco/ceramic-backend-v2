const mongoose = require('mongoose');
const { toJSON, paginate } = require('./plugins');

const challanProductSchema = new mongoose.Schema(
  {
    // Product References
    productVariantId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Product_variant',
      required: true,
    },
    seriesProductId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'series_product',
    },
    selectionProductId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'SelectionProduct',
    },
    selectionId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Selection',
      required: true,
    },
    
    // Pricing & Quantity
    quantity: {
      type: Number,
      required: false, // Make optional for challan creation
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
      default: 'Sq.Feet/Price',
    },
    
    // Box Information
    boxPerPiece: {
      type: Number,
    },
    totalBox: {
      type: Number,
    },
    totalSquareFeet: {
      type: Number,
      default: 0,
    },
    
    // Product Details (NEW - for easy display without lookups)
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
    
    // Metadata (NEW)
    isProductDeleted: {
      type: Boolean,
      default: false,
    },
    
    // Selection Context (NEW - for display purposes)
    selectionInfo: {
      selectionId: {
        type: mongoose.Schema.Types.ObjectId,
      },
      requirementType: {
        type: String,
        default: '',
      },
      customerName: {
        type: String,
        default: '',
      },
      selectionStatus: {
        type: String,
        default: '',
      },
    },
  },
  {
    _id: false, // Don't create separate _id for sub-documents
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
    products: [challanProductSchema], // Now accepts all the fields we're sending
    selectionDetails: {
      type: mongoose.Schema.Types.Mixed,
    },
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
      default: '',
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

challanSchema.plugin(toJSON);
challanSchema.plugin(paginate);

const Challan = mongoose.model('challan', challanSchema);

module.exports = Challan;