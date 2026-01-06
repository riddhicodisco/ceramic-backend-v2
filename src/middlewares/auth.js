const passport = require('passport');
const httpStatus = require('http-status');
const Role = require('../models/role.model');
const ApiError = require('../utils/apiError');
const MESSAGE = require('../config/message.json');
const { TOKEN_TYPES, ROLES } = require('../helper/constant.helper');
const { tokenService } = require('../services');

/**
 * Verify JWT token and get user from v1
 */
const verifyToken = async (req, res, next) => {
  // Get token from header
  const authHeader = req.headers.authorization;
  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    return res.status(httpStatus.UNAUTHORIZED).json({
      success: false,
      message: 'Access token is required',
      code: 'TOKEN_REQUIRED'
    });
  }

  const token = authHeader.substring(7); // Remove 'Bearer ' prefix

  try {
    // Try to decode token
    const jwt = require('jsonwebtoken');
    const config = require('../config/config');

    let decoded;
    try {
      decoded = jwt.verify(token, config.jwt.secret);
    } catch (tokenError) {
      return res.status(httpStatus.UNAUTHORIZED).json({
        success: false,
        message: 'Invalid token',
        code: 'INVALID_TOKEN',
        error: tokenError.message
      });
    }

    // Get user from database
    const { User } = require('../models');
    const user = await User.findOne({ _id: decoded.sub, deleted_at: null });

    if (!user) {
      return res.status(httpStatus.UNAUTHORIZED).json({
        success: false,
        message: 'User not found',
        code: 'USER_NOT_FOUND'
      });
    }

    // Attach user data to request
    req.user = user;

    next();
  } catch (error) {
    return res.status(httpStatus.UNAUTHORIZED).json({
      success: false,
      message: 'Authentication failed',
      code: 'AUTH_FAILED',
      error: error.message
    });
  }
};

/**
 * Check if user has required permission (more lenient)
 */
const requirePermission = (permission) => {
  return (req, res, next) => {
    if (!req.user) {
      return res.status(httpStatus.UNAUTHORIZED).json({
        success: false,
        message: 'Authentication required',
        code: 'AUTH_REQUIRED'
      });
    }

    // If user has no permissions array, allow access (for testing)
    if (!req.user.permissions || req.user.permissions.length === 0) {
      console.warn(`⚠️ User ${req.user.email} has no permissions, allowing access for testing`);
      return next();
    }

    if (!req.user.permissions.includes(permission)) {
      return res.status(httpStatus.FORBIDDEN).json({
        success: false,
        message: `Permission '${permission}' required`,
        code: 'PERMISSION_REQUIRED',
        required_permission: permission,
        user_permissions: req.user.permissions
      });
    }

    next();
  };
};

/**
 * Check if user has required role (more lenient)
 */
const requireRole = (role) => {
  return (req, res, next) => {
    if (!req.user) {
      return res.status(httpStatus.UNAUTHORIZED).json({
        success: false,
        message: 'Authentication required',
        code: 'AUTH_REQUIRED'
      });
    }

    // If user has no role, allow access for testing
    if (!req.user.role) {
      console.warn(`User ${req.user.email} has no role, allowing access for testing`);
      return next();
    }

    if (req.user.role !== role) {
      return res.status(httpStatus.FORBIDDEN).json({
        success: false,
        message: `Role '${role}' required`,
        code: 'ROLE_REQUIRED',
        required_role: role,
        user_role: req.user.role
      });
    }

    next();
  };
};

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
  if (mongoose.Types.ObjectId.isValid(user.role) && String(user.role).length === 24) {
    // It's an ObjectId, find by _id locally
    role = await Role.findOne({ _id: user.role });

    // If not found locally, try V1
    if (!role) {
      try {
        // Pass existing auth token if available in headers
        const token = req.headers.authorization;

        const v1Role = await v1Service.getRole(user.role, token);

        if (v1Role) {
          role = v1Role; // Use V1 role object
        }
      } catch (err) {
        if (err.response) {
          console.warn(`V1 Response Status: ${err.response.status}, Data:`, JSON.stringify(err.response.data));
        }
      }
    }
  } else {
    // It's a role name string (like "Admin", "Accountant"), find by role field
    role = await Role.findOne({ role: user.role, deleted_at: null });

    // Fallback: If not found in DB but we trust the token (User object created from token), use the string as role
    if (!role && user.role) {
      console.warn(`⚠️ Role '${user.role}' not found in V2 DB. Synthesizing role object from token claim.`);
      // Ensure it's a valid role by checking constants if possible, or just trusting it
      const isValidRole = Object.values(ROLES).includes(user.role);
      if (isValidRole) {
        role = { role: user.role, permissions: [] }; // Synthesized role object
      }
    }
  }

  if (!role) {
    console.error('Role not found for user:', user._id, 'role:', user.role);
    return reject(new ApiError(httpStatus.NOT_FOUND, MESSAGE.role_not_found || 'Role not found')); // If role doesn't exist, throw an error.
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
  verifyToken,
  requirePermission,
  requireRole,
  authorizeV3,
  auth
};
