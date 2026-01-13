const { Strategy: JwtStrategy, ExtractJwt } = require('passport-jwt');
const { User } = require('../models');
const config = require('./config');
const { TOKEN_TYPES } = require('../helper/constant.helper');
const v1Service = require('../services/v1Service');

const jwtOptions = {
    secretOrKey: config.jwt.secret,
    jwtFromRequest: ExtractJwt.fromAuthHeaderAsBearerToken(),
    // Add a custom extractor to capture the raw token
    passReqToCallback: true,
};

const jwtVerify = async (req, payload, done) => {
    try {
        // Allow tokens without type field for backward compatibility (v1 tokens)
        if (payload.type && payload.type !== TOKEN_TYPES.access && payload.type !== 'Access') {
            return done(new Error('Invalid token type'), false);
        }
        
        const userId = payload.sub || payload.userId || payload.id;
        if (!userId) {
            return done(new Error('Token missing user ID'), false);
        }
        
        // Extract the raw token from the request
        const token = req.headers.authorization || '';
        const bearerToken = token.startsWith('Bearer ') ? token : `Bearer ${token}`;
        
        // First try to find user in v2 database
        // let user = await User.findOne({ _id: userId, deleted_at: null });
let user;
        // If user not found in v2, get user data from v1 API
        // if (!user) {
            try {
                const v1UserData = await v1Service.getUser(userId, bearerToken);
                if (v1UserData) {
                    // Create user object from v1 API response
                    user = {
                        _id: v1UserData._id || userId,
                        email: v1UserData.email || payload.email,
                        first_name: v1UserData.first_name || payload.first_name,
                        last_name: v1UserData.last_name || payload.last_name,
                        role: v1UserData.role || payload.role, // This might be ObjectId or role name string
                        is_active: v1UserData.is_active !== false,
                        isBlock: v1UserData.isBlock || false,
                        // Add any other fields from v1 user data as needed
                        phone: v1UserData.phone,
                        address: v1UserData.address,
                        // Store the complete v1 data for reference
                        v1Data: v1UserData
                    };
                } else {
                    // Fallback to token payload if v1 API fails
                    user = {
                        _id: userId,
                        email: payload.email,
                        first_name: payload.first_name,
                        last_name: payload.last_name,
                        role: payload.role, // This might be ObjectId or role name string
                        is_active: payload.is_active !== false,
                        isBlock: payload.isBlock || false,
                    };
                    console.log('Using token payload as fallback:', user);
                }
            } catch (error) {
                console.error('Error fetching user from v1 API:', error);
                // Fallback to token payload if v1 API fails
                user = {
                    _id: userId,
                    email: payload.email,
                    first_name: payload.first_name,
                    last_name: payload.last_name,
                    role: payload.role, // This might be ObjectId or role name string
                    is_active: payload.is_active !== false,
                    isBlock: payload.isBlock || false,
                };
                console.log('Using token payload as fallback due to error:', user);
            }
        // }

        // if (!user) {
        //     return done(new Error('User not found'), false);
        // }
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
