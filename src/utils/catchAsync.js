const ApiError = require('./apiError');

/**
 * Wrap async controller functions to handle errors
 */
const catchAsync = (fn) => (req, res, next) => {
  Promise.resolve(fn(req, res, next)).catch((error) => {
    if (error instanceof ApiError) {
      next(error);
    } else {
      next(new ApiError(500, error.message));
    }
  });
};

module.exports = catchAsync;
