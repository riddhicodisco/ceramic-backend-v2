const mongoose = require('mongoose');
const { toJSON, paginate } = require('./plugins');

const seriesVariantSchema = mongoose.Schema(
    {
        name: { type: String, required: true, trim: true },
        series: { type: mongoose.Schema.Types.ObjectId, ref: 'Series', required: true },
        isActive: { type: Boolean, default: true },
        deleted_at: { type: Date, default: null },
    },
    { timestamps: true, versionKey: false }
);

seriesVariantSchema.plugin(toJSON);
seriesVariantSchema.plugin(paginate);

const SeriesVariant = mongoose.model('SeriesVariant', seriesVariantSchema);
module.exports = SeriesVariant;
