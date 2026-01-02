const mongoose = require('mongoose');
const { toJSON, paginate } = require('./plugins');

const accessPermissionSchema = mongoose.Schema(
    {
        role: {
            type: mongoose.SchemaTypes.ObjectId,
            ref: 'Role',
            required: true,
        },
        permission: {
            type: mongoose.SchemaTypes.ObjectId,
            ref: 'Permission',
            required: true,
        },
    },
    {
        timestamps: true,
        versionKey: false,
    }
);

// add plugin that converts mongoose to json
accessPermissionSchema.plugin(toJSON);
accessPermissionSchema.plugin(paginate);

/**
 * @typedef accessPermission
 */
const accessPermission = mongoose.model('Access_permission', accessPermissionSchema);

module.exports = accessPermission;
