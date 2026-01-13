const passport = require('passport');
const httpStatus = require('http-status');
const ApiError = require('../utils/apiError');
const MESSAGE = require('../config/message.json');
const { TOKEN_TYPES, ROLES } = require('../helper/constant.helper');
const { tokenService } = require('../services');

const verifyRoleCallback = (req, resolve, reject, requiredRights) => async (err, user, info) => {
  if (err) {
    return reject(new ApiError(httpStatus.UNAUTHORIZED, err.message || MESSAGE.unauthorized || 'Unauthorized'));
  }

  if (info) {
    return reject(new ApiError(httpStatus.UNAUTHORIZED, info.message || MESSAGE.unauthorized || 'Unauthorized'));
  }

  if (!user) {
    return reject(new ApiError(httpStatus.UNAUTHORIZED, MESSAGE.unauthorized || 'Unauthorized'));
  }

  // Handle role lookup - user.role might be ObjectId or role name string (from v1 tokens)
  let role;
  const mongoose = require('mongoose');

  const v1Service = require('../services/v1Service');

  // Check if user.role is an ObjectId or a string role name
  if (mongoose.Types.ObjectId.isValid(user?.role?._id)) {
    // It's an ObjectId, fetch role from V1
    try {
      const token = req.headers.authorization;
      const v1Role = await v1Service.getRole(user?.role?._id, token);
      if (v1Role) {
        role = v1Role; // Use V1 role object
      } else {
        // If V1 role not found, create a basic role object
        role = { role: 'Unknown', permissions: [] };
      }
    } catch (err) {
      if (err.response) {
        console.warn(`V1 Response Status: ${err.response.status}, Data:`, JSON.stringify(err.response.data));
      }
      role = { role: 'Unknown', permissions: [] };
    }
  } else {
    // It's a role name string (like "Admin", "Accountant"), use it directly
    role = { role: user?.role, permissions: [] };
  }


  if (!requiredRights.includes(role.role)) {
    console.error('Role mismatch. Required:', requiredRights, 'User role:', role.role);
    return reject(new ApiError(httpStatus.FORBIDDEN, MESSAGE.forbidden || 'Forbidden')); // If user role doesn't include in role require rights, throw an error.
  }

  if (user?.isBlock) {
    return reject(new ApiError(httpStatus.UNAUTHORIZED, MESSAGE.account_blocked || 'Account blocked')); // If user is block, throw an error.
  }

  if (user?.is_active === false) {
    return reject(new ApiError(httpStatus.UNAUTHORIZED, MESSAGE.account_not_active || 'Account not active'));
  }

  req.user = user;

  const seller = role.role;
  let oldToken;
  let newToken;

  if (seller === ROLES.seller) {
    oldToken = req.headers.authorization.split(' ')[1]; // Extract token from Authorization header
    const tokenIsExist = await tokenService.getToken({ user: user._id });
    newToken = tokenIsExist?.accessToken; // Get access token or token from the found token document.

    if (newToken != oldToken)
      return reject(
        new ApiError(httpStatus.UNAUTHORIZED, MESSAGE.your_account_is_login_another_device || 'Your account is logged in on another device')
      ); // If user is block, throw an error.
  }
  resolve();
};

const authorizeV3 =
  (...requiredRights) =>
    async (req, res, next) => {
      return new Promise((resolve, reject) => {
        passport.authenticate(
          'jwt',
          { session: false },
          verifyRoleCallback(req, resolve, reject, requiredRights)
        )(req, res, next);
      })
        .then(() => next())
        .catch((err) => next(err));
    };

const auth =
  (...requiredRights) =>
    async (req, res, next) => {
      return new Promise((resolve, reject) => {
        passport.authenticate(
          'jwt',
          { session: false },
          verifyRoleCallback(req, resolve, reject, requiredRights)
        )(req, res, next);
      })
        .then(() => next())
        .catch((err) => next(err));
    };

module.exports = {
  authorizeV3,
  auth
};
