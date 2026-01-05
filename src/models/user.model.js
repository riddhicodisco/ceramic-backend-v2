const mongoose = require('mongoose');
const { toJSON, paginate } = require('./plugins');

// V2 User model that uses V1 users collection
// Both backends share the same database, so we reference the V1 collection directly

const userSchema = mongoose.Schema(
    {
        first_name: {
            type: String,
            trim: true,
            maxlength: 20,
        },
        last_name: {
            type: String,
            trim: true,
            maxlength: 20,
        },
        email: {
            type: String,
            trim: true,
            lowercase: true,
        },
        password: {
            type: String,
            trim: true,
            minlength: 8,
        },
        role: {
            type: mongoose.Types.ObjectId,
            ref: 'roles',  // Reference to V1 roles collection
        },
        address: {
            type: String,
            trim: true,
            maxlength: 200,
        },
        country: {
            type: String,
            trim: true,
            maxlength: 50,
        },
        state: {
            type: String,
            trim: true,
            maxlength: 50,
        },
        city: {
            type: String,
            trim: true,
            maxlength: 50,
        },
        zip_code: {
            type: String,
            trim: true,
            maxlength: 20,
        },
        image: {
            type: String,
            default: null,
        },
        is_email_verified: {
            type: Boolean,
            default: false,
        },
        social_id: {
            type: String,
            trim: true,
        },
        social_type: {
            type: String,
        },
        is_block: {
            type: Boolean,
            default: false,
        },
        is_active: {
            type: Boolean,
            default: true,
        },
        phone: {
            type: String,
            default: null,
        },
        reference: {
            type: String,
        },
        encryptedPassword: {
            type: String,
        },
        leave_date: { type: Date, default: null },
        deleted_at: {
            type: Date,
            default: null,
        },
        createdBy: {
            type: mongoose.Types.ObjectId,
            ref: 'users',
            default: null,
        },
    },
    {
        timestamps: true,
        versionKey: false,
    }
);

// add plugin that converts mongoose to json
userSchema.plugin(toJSON);
userSchema.plugin(paginate);

// Use V1 users collection name
const User = mongoose.model('users', userSchema);

module.exports = User;
