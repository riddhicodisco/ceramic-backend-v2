const mongoose = require('mongoose');
const { toJSON, paginate } = require('./plugins');

const roleSchema = new mongoose.Schema(
    {
        role: {
            type: String,
            trim: true,
            required: true,
        },
        slug: {
            type: String,
            trim: true,
            required: true,
        },
        is_active: {
            type: Boolean,
            default: true,
        },
        deleted_at: {
            type: Date,
            default: null,
        },
    },
    { timestamps: true, versionKey: false }
);

roleSchema.plugin(toJSON);
roleSchema.plugin(paginate);

const Role = new mongoose.model('Role', roleSchema);
module.exports = Role;
