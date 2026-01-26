const httpStatus = require('http-status');
const pick = require('../../utils/pick');
const catchAsync = require('../../utils/catchAsync');
const { vendorPaymentService } = require('../../services/commonServices');
const apiError = require('../../utils/apiError');

const createVendorPayment = catchAsync(async (req, res) => {
  const vendorPayment = await vendorPaymentService.createVendorPayment({
    ...req.body,
    createdBy: req.user._id,
  });
  res.status(httpStatus.CREATED).send({
    success: true,
    message: 'Vendor payment created successfully',
    data: vendorPayment,
  });
});

const getVendorPayments = catchAsync(async (req, res) => {
  const filter = pick(req.query, ['vendorId', 'category', 'transactionType']);
  if (!filter.category) {
    filter.category = { $ne: 'Credit Note' };
  }
  if (req.query.search) {
    filter.notes = { $regex: req.query.search, $options: 'i' };
  }
  const options = pick(req.query, ['sortBy', 'limit', 'page']);
  // Default sorting by date desc if not provided
  if (!options.sortBy) {
    options.sortBy = 'date:desc';
  }
  const result = await vendorPaymentService.queryVendorPayments(filter, options);
  res.status(httpStatus.OK).send({
    success: true,
    message: 'Vendor payments fetched successfully',
    data: result,
  });
});

const getVendorPayment = catchAsync(async (req, res) => {
  const vendorPayment = await vendorPaymentService.getVendorPaymentById(req.params.paymentId);
  if (!vendorPayment) {
    throw new apiError(httpStatus.NOT_FOUND, 'Vendor payment not found');
  }
  res.status(httpStatus.OK).send({
    success: true,
    message: 'Vendor payment fetched successfully',
    data: vendorPayment,
  });
});

const updateVendorPayment = catchAsync(async (req, res) => {
  const vendorPayment = await vendorPaymentService.updateVendorPaymentById(req.params.paymentId, req.body);
  res.status(httpStatus.OK).send({
    success: true,
    message: 'Vendor payment updated successfully',
    data: vendorPayment,
  });
});

const getVendorBalance = catchAsync(async (req, res) => {
  const result = await vendorPaymentService.getVendorBalance(req.params.vendorId);
  res.status(httpStatus.OK).send({
    success: true,
    message: 'Vendor balance fetched successfully',
    data: result,
  });
});

const deleteVendorPayment = catchAsync(async (req, res) => {
  await vendorPaymentService.deleteVendorPaymentById(req.params.paymentId);
  res.status(httpStatus.OK).send({
    success: true,
    message: 'Vendor payment deleted successfully',
  });
});

module.exports = {
  createVendorPayment,
  getVendorPayments,
  getVendorPayment,
  updateVendorPayment,
  getVendorBalance,
  deleteVendorPayment,
};

