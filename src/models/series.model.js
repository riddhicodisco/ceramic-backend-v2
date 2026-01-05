const mongoose = require('mongoose');

const { toJSON,paginate} = require('./plugins');


const seriesSchema = mongoose.Schema(
    {
        series_name: {
            type: String,
            required: true,
            trim: true,
        },
        dimension: {
            type: String,
            trim: true,
        },
         brand:{
             type: String,
          trim:true
        },
        user: {
            type: mongoose.Schema.Types.ObjectId,
            ref: 'users',  // Reference to V1 users collection
            required: true,
        },
        isActive: {
            type: Boolean,
            default: true,
        },
        deleted_at: {
            type: Date,
            default: null,
        },
    },
    {
        timestamps: true,
        versionKey: false,
    }
);


// add plugin that converts mongoose to json
seriesSchema.plugin(toJSON);
seriesSchema.plugin(paginate);


const Series = mongoose.model('series', seriesSchema);

module.exports = Series;
