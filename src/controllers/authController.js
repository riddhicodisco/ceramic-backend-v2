const httpStatus = require('http-status');
const ApiError = require('../utils/apiError');
const catchAsync = require('../utils/catchAsync');
const { Token } = require('../models');
const v1AuthService = require('../services/v1AuthService');
const jwt = require('jsonwebtoken');
const config = require('../config/config');
const moment = require('moment');

/**
 * Generate auth tokens
 */
const generateAuthTokens = async (user) => {
  const accessTokenExpires = moment().add(config.jwt.accessExpirationYear, 'years');
  const refreshTokenExpires = moment().add(config.jwt.refreshExpirationDays, 'days');

  const accessTokenPayload = {
    sub: user._id,
    email: user.email,
    iat: moment().unix(),
    exp: accessTokenExpires.unix(),
    type: 'access'
  };

  const refreshTokenPayload = {
    sub: user._id,
    email: user.email,
    iat: moment().unix(),
    exp: refreshTokenExpires.unix(),
    type: 'refresh'
  };

  const accessToken = jwt.sign(accessTokenPayload, config.jwt.secret);
  const refreshToken = jwt.sign(refreshTokenPayload, config.jwt.secret);

  // Save refresh token to database
  await Token.create({
    token: refreshToken,
    user: user._id,
    type: 'refresh',
    expires: refreshTokenExpires.toDate(),
    blacklisted: false
  });

  return {
    access: {
      token: accessToken,
      expires: accessTokenExpires.toDate()
    },
    refresh: {
      token: refreshToken,
      expires: refreshTokenExpires.toDate()
    }
  };
};

/**
 * Login user (integrates with v1)
 */
const login = catchAsync(async (req, res) => {
  const { email, password } = req.body;

  // Validate credentials with v1
  const v1Response = await v1AuthService.validateCredentials(email, password);
  if (!v1Response.success) {
    throw new ApiError(httpStatus.UNAUTHORIZED, 'Invalid credentials');
  }

  const v1User = v1Response.data.user;

  // Get user permissions from v1
  const permissionsResponse = await v1AuthService.getUserPermissions(v1User._id);
  const permissions = permissionsResponse.data || [];

  // Generate tokens for v2
  const tokens = await generateAuthTokens(v1User);

  res.status(httpStatus.OK).json({
    success: true,
    message: 'Login successful',
    data: {
      user: {
        _id: v1User._id,
        email: v1User.email,
        first_name: v1User.first_name,
        last_name: v1User.last_name,
        role: v1User.role,
        permissions: permissions
      },
      tokens
    }
  });
});

/**
 * Refresh token
 */
const refreshToken = catchAsync(async (req, res) => {
  const { refreshToken } = req.body;

  // Verify refresh token exists in database
  const tokenDoc = await Token.findOne({ token: refreshToken, type: 'refresh', blacklisted: false });
  if (!tokenDoc) {
    throw new ApiError(httpStatus.UNAUTHORIZED, 'Invalid refresh token');
  }

  try {
    // Decode token
    const decoded = jwt.verify(refreshToken, config.jwt.secret);
    
    // Get user from v1
    const v1UserResponse = await v1AuthService.getUserByEmail(decoded.email);
    if (!v1UserResponse.success) {
      throw new ApiError(httpStatus.UNAUTHORIZED, 'User not found');
    }

    const v1User = v1UserResponse.data.user;

    // Generate new tokens
    const tokens = await generateAuthTokens(v1User);

    // Blacklist old refresh token
    tokenDoc.blacklisted = true;
    await tokenDoc.save();

    res.status(httpStatus.OK).json({
      success: true,
      message: 'Token refreshed successfully',
      data: {
        tokens
      }
    });
  } catch (error) {
    if (error.name === 'JsonWebTokenError') {
      throw new ApiError(httpStatus.UNAUTHORIZED, 'Invalid token');
    }
    throw error;
  }
});

/**
 * Logout user
 */
const logout = catchAsync(async (req, res) => {
  const { refreshToken } = req.body;

  // Blacklist refresh token
  await Token.updateOne(
    { token: refreshToken, type: 'refresh' },
    { blacklisted: true }
  );

  res.status(httpStatus.OK).json({
    success: true,
    message: 'Logout successful'
  });
});

module.exports = {
  login,
  refreshToken,
  logout
};
