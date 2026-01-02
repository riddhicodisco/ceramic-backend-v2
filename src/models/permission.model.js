const mongoose = require('mongoose');
const { toJSON, paginate } = require('./plugins');

const permissionSchema = mongoose.Schema(
    {
        module: {
            type: String,
            required: true,
        },
        permission: {
            type: String,
            required: true,
        },
        slug: {
            type: String,
            required: false,
        },
        is_active: {
            type: Boolean,
            default: true,
        },
    },
    {
        timestamps: true,
        versionKey: false,
    }
);

// add plugin that converts mongoose to json
permissionSchema.plugin(toJSON);
permissionSchema.plugin(paginate);

/**
 * @typedef Permission
 */
const Permission = mongoose.model('Permission', permissionSchema);

module.exports = Permission;
