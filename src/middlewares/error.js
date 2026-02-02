const httpStatus = require('http-status');
const ApiError = require('../utils/apiError');
const logger = require('../config/logger');

const errorHandler = (err, req, res, next) => {
  let error = { ...err };
  error.message = err.message;

  // Mongoose bad ObjectId
  if (err.name === 'CastError') {
    const message = 'Resource not found';
    error = new ApiError(httpStatus.NOT_FOUND, message);
  }

  // Mongoose duplicate key
  if (err.code === 11000) {
    const message = 'Duplicate field value entered';
    error = new ApiError(httpStatus.BAD_REQUEST, message);
  }

  // Mongoose validation error
  if (err.name === 'ValidationError') {
    const message = Object.values(err.errors).map(val => val.message).join(', ');
    error = new ApiError(httpStatus.BAD_REQUEST, message);
  }

  // Prepare error context for logging
  const errorContext = {
    statusCode: error.statusCode || httpStatus.INTERNAL_SERVER_ERROR,
    message: error.message || 'Internal Server Error',
    stack: error.stack || err.stack,
    method: req.method,
    url: req.originalUrl || req.url,
    ip: req.ip || req.connection.remoteAddress,
    userAgent: req.get('user-agent'),
    userId: req.user?.id || req.user?._id || null,
    body: req.body && Object.keys(req.body).length > 0 ? sanitizeRequestBody(req.body) : null,
    query: req.query && Object.keys(req.query).length > 0 ? req.query : null,
    params: req.params && Object.keys(req.params).length > 0 ? req.params : null,
    timestamp: new Date().toISOString(),
    errorName: err.name,
    errorCode: err.code,
  };

  // Log error with context
  logger.error('API Error', errorContext);

  res.status(error.statusCode || httpStatus.INTERNAL_SERVER_ERROR).json({
    success: false,
    message: error.message || 'Internal Server Error',
    ...(process.env.NODE_ENV === 'development' && { stack: error.stack }),
  });
};

const errorConverter = (err, req, res, next) => {
  let error = err;
  if (!(error instanceof ApiError)) {
    const statusCode = error.statusCode || httpStatus.INTERNAL_SERVER_ERROR;
    const message = error.message || httpStatus[statusCode];
    error = new ApiError(statusCode, message, false, err.stack);
  }
  next(error);
};

/**
 * Sanitize request body to remove sensitive information
 * @param {Object} body - Request body object
 * @returns {Object} - Sanitized body
 */
const sanitizeRequestBody = (body) => {
  const sensitiveFields = ['password', 'token', 'secret', 'apiKey', 'authorization'];
  const sanitized = { ...body };

  sensitiveFields.forEach((field) => {
    if (sanitized[field]) {
      sanitized[field] = '***REDACTED***';
    }
  });

  return sanitized;
};

module.exports = {
  errorHandler,
  errorConverter,
};
