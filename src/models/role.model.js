const mongoose = require('mongoose');
const { toJSON, paginate } = require('./plugins');

// V2 Role model that uses V1 roles collection
// Both backends share the same database, so we reference the V1 collection directly

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

// Use V1 roles collection name
const Role = mongoose.model('roles', roleSchema);

module.exports = Role;
