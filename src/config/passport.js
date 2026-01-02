const { Strategy: JwtStrategy, ExtractJwt } = require('passport-jwt');
const { User } = require('../models');
const config = require('./config');
const { TOKEN_TYPES } = require('../helper/constant.helper');

const jwtOptions = {
    secretOrKey: config.jwt.secret,
    jwtFromRequest: ExtractJwt.fromAuthHeaderAsBearerToken(),
};

const jwtVerify = async (payload, done) => {
    try {
        // Allow tokens without type field for backward compatibility (v1 tokens)
        if (payload.type && payload.type !== TOKEN_TYPES.access && payload.type !== 'Access') {
            return done(new Error('Invalid token type'), false);
        }
        
        const userId = payload.sub || payload.userId || payload.id;
        if (!userId) {
            return done(new Error('Token missing user ID'), false);
        }
        
        // First try to find user in v2 database
        let user = await User.findOne({ _id: userId, deleted_at: null });

        // If user not found in v2, create user object from token payload (for v1 tokens)
        if (!user) {
            // Create user object from token payload - this handles v1 tokens
            user = {
                _id: userId,
                email: payload.email,
                first_name: payload.first_name,
                last_name: payload.last_name,
                role: payload.role, // This might be ObjectId or role name string
                is_active: payload.is_active !== false,
                isBlock: payload.isBlock || false,
            };
        }

        if (!user) {
            return done(new Error('User not found'), false);
        }
        done(null, user);
    } catch (error) {
        console.error('JWT Verify Error:', error);
        done(error, false);
    }
};

const jwtStrategy = new JwtStrategy(jwtOptions, jwtVerify);

module.exports = {
    jwtStrategy,
};
