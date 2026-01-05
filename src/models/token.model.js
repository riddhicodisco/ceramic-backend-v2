const mongoose = require('mongoose');
const { toJSON } = require('./plugins');
const { TOKEN_TYPES } = require('../helper/constant.helper');

const tokenSchema = mongoose.Schema(
    {
        token: {
            type: String,
            required: true,
            index: true,
        },
        user: {
            type: mongoose.SchemaTypes.ObjectId,
            ref: 'users',  // Reference to V1 users collection
            required: true,
        },
        type: {
            type: String,
            enum: [TOKEN_TYPES.access, TOKEN_TYPES.refresh, TOKEN_TYPES.verifyOtp],
            required: true,
        },
        expires: {
            type: Date,
            required: true,
        },
        blacklisted: {
            type: Boolean,
            default: false,
        },
    },
    {
        timestamps: true,
        versionKey: false,
    }
);

// add plugin that converts mongoose to json
tokenSchema.plugin(toJSON);

/**
 * @typedef Token
 */
const Token = mongoose.model('token', tokenSchema);

module.exports = Token;
