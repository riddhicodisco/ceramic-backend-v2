const httpStatus = require('http-status');
const pick = require('../../utils/pick');
const catchAsync = require('../../utils/catchAsync');
const { discountService } = require('../../services/commonServices');
const apiError = require('../../utils/apiError');

const createDiscount = catchAsync(async (req, res) => {
  const discount = await discountService.createDiscount({
    ...req.body,
    createdBy: req.user._id,
  });
  res.status(httpStatus.CREATED).send(discount);
});

const getDiscounts = catchAsync(async (req, res) => {
  const filter = pick(req.query, ['customerId']);
  if (req.query.search) {
    filter.remark = { $regex: req.query.search, $options: 'i' };
  }
  const options = pick(req.query, ['sortBy', 'limit', 'page']);
  const result = await discountService.queryDiscounts(filter, options);
  res.send(result);
});

const getDiscount = catchAsync(async (req, res) => {
  const discount = await discountService.getDiscountById(req.params.discountId);
  if (!discount) {
    throw new apiError(httpStatus.NOT_FOUND, 'Discount not found');
  }
  res.send(discount);
});

const deleteDiscount = catchAsync(async (req, res) => {
  await discountService.deleteDiscountById(req.params.discountId);
  res.status(httpStatus.NO_CONTENT).send();
});

module.exports = {
  createDiscount,
  getDiscounts,
  getDiscount,
  deleteDiscount,
};
