const mongoose = require('mongoose');
const { toJSON, paginate } = require('./plugins');

const productVariantSchema = mongoose.Schema(
    {
        name: { type: String, required: true, trim: true },
        product: { type: mongoose.Schema.Types.ObjectId, ref: 'Product', required: true },
        isActive: { type: Boolean, default: true },
        deleted_at: { type: Date, default: null },
    },
    { timestamps: true, versionKey: false }
);

productVariantSchema.plugin(toJSON);
productVariantSchema.plugin(paginate);

const ProductVariant = mongoose.model('productVariant', productVariantSchema);
module.exports = ProductVariant;
