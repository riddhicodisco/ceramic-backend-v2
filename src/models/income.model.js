const mongoose = require('mongoose');
const { toJSON, paginate } = require('./plugins');

const incomeSchema = mongoose.Schema(
    {
        category: {
            type: String,
            required: true,
            trim: true,
        },
        amount: {
            type: Number,
            required: true,
        },
        remark: {
            type: String,
            trim: true,
            default: '',
        },
        type: {
            type: String,
            required: true,
            trim: true,
        },
        date: {
            type: Date,
            default: Date.now,
        },
        createdBy: {
            type: mongoose.Schema.Types.ObjectId,
            ref: 'User',
            required: true,
        },
    },
    {
        timestamps: true,
    }
);

// add plugin that converts mongoose to json
incomeSchema.plugin(toJSON);
incomeSchema.plugin(paginate);

const Income = mongoose.model('Income', incomeSchema);

module.exports = Income;
