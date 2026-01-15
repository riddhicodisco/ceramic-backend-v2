const mongoose = require('mongoose');
const { toJSON, paginate } = require('./plugins');

const expenseSchema = mongoose.Schema(
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
expenseSchema.plugin(toJSON);
expenseSchema.plugin(paginate);

const Expense = mongoose.model('Expense', expenseSchema);

module.exports = Expense;
