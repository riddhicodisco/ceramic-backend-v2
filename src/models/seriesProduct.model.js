const mongoose = require('mongoose');
const { toJSON, paginate } = require('./plugins');

const seriesProductSchema = mongoose.Schema(
    {
        name: { type: String, required: true, trim: true },
        series: { type: mongoose.Schema.Types.ObjectId, ref: 'Series', required: true },
        isActive: { type: Boolean, default: true },
        deleted_at: { type: Date, default: null },
    },
    { timestamps: true, versionKey: false }
);

seriesProductSchema.plugin(toJSON);
seriesProductSchema.plugin(paginate);

const SeriesProduct = mongoose.model('seriesProduct', seriesProductSchema);
module.exports = SeriesProduct;
