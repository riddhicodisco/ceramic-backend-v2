const httpStatus = require('http-status');
const catchAsync = require('../../../utils/catchAsync');
const { commonServices } = require('../../../services');
const ApiError = require('../../../utils/apiError');

/**
 * Create a challan
 */
const createChallan = catchAsync(async (req, res) => {
  const challan = await commonServices.challanService.createChallan(req.body);
  res.status(httpStatus.CREATED).send({
    success: true,
    message: 'Challan created successfully',
    data: challan,
  });
});

/**
 * Get all challans
 */
const getChallans = catchAsync(async (req, res) => {
  const { page = 1, limit = 10, productId } = req.query;

  const filter = {
    deletedAt: null,
  };

  if (productId) {
    filter.productId = productId;
  }

  const options = {
    page: parseInt(page),
    limit: parseInt(limit),
    populate: 'productId',
  };

  const challans = await commonServices.challanService.queryChallans(filter, options);

  res.status(httpStatus.OK).send({
    success: true,
    message: 'Challans fetched successfully',
    data: challans,
  });
});

/**
 * Get single challan
 */
const getChallan = catchAsync(async (req, res) => {
  const challan = await commonServices.challanService.getChallanById(req.params.id);
  
  if (!challan) {
    throw new ApiError(httpStatus.NOT_FOUND, 'Challan not found');
  }

  res.status(httpStatus.OK).send({
    success: true,
    message: 'Challan fetched successfully',
    data: challan,
  });
});

/**
 * Update challan
 */
const updateChallan = catchAsync(async (req, res) => {
  const challan = await commonServices.challanService.updateChallanById(req.params.id, req.body);
  
  res.status(httpStatus.OK).send({
    success: true,
    message: 'Challan updated successfully',
    data: challan,
  });
});

/**
 * Delete challan
 */
const deleteChallan = catchAsync(async (req, res) => {
  await commonServices.challanService.deleteChallanById(req.params.id);
  
  res.status(httpStatus.OK).send({
    success: true,
    message: 'Challan deleted successfully',
  });
});

module.exports = {
  createChallan,
  getChallans,
  getChallan,
  updateChallan,
  deleteChallan,
};
