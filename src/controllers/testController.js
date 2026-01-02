const catchAsync = require('../utils/catchAsync');

/**
 * Test endpoint to check authentication
 */
const testAuth = catchAsync(async (req, res) => {
  res.status(200).json({
    success: true,
    message: 'Authentication working!',
    user: req.user
  });
});

module.exports = {
  testAuth
};
