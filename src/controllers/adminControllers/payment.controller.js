const httpStatus = require('http-status');
const pick = require('../../utils/pick');
const catchAsync = require('../../utils/catchAsync');
const { paymentService } = require('../../services/commonServices');
const apiError = require('../../utils/apiError');

const createPayment = catchAsync(async (req, res) => {
  const payment = await paymentService.createPayment({
    ...req.body,
    createdBy: req.user._id,
  });
  res.status(httpStatus.CREATED).send(payment);
});

const getPayments = catchAsync(async (req, res) => {
  const filter = pick(req.query, ['customerId', 'category', 'transactionType']);
  if (!filter.category) {
    filter.category = { $ne: 'Credit Note' };
  }
  if (req.query.search) {
    filter.remark = { $regex: req.query.search, $options: 'i' };
  }
  const options = pick(req.query, ['sortBy', 'limit', 'page']);
  const result = await paymentService.queryPayments(filter, options);
  res.send(result);
});

const getPayment = catchAsync(async (req, res) => {
  const payment = await paymentService.getPaymentById(req.params.paymentId);
  if (!payment) {
    throw new apiError(httpStatus.NOT_FOUND, 'Payment not found');
  }
  res.send(payment);
});

const updatePayment = catchAsync(async (req, res) => {
  const payment = await paymentService.updatePaymentById(req.params.paymentId, req.body);
  res.send(payment);
});

const getCustomerBalance = catchAsync(async (req, res) => {
  const result = await paymentService.getCustomerBalance(req.params.customerId);
  res.send(result);
});

const deletePayment = catchAsync(async (req, res) => {
  await paymentService.deletePaymentById(req.params.paymentId);
  res.status(httpStatus.NO_CONTENT).send();
});

module.exports = {
  createPayment,
  getPayments,
  getPayment,
  updatePayment,
  getCustomerBalance,
  deletePayment,
};
