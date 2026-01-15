const httpStatus = require('http-status');
const pick = require('../../utils/pick');
const catchAsync = require('../../utils/catchAsync');
const Income = require('../../models/income.model');
const Expense = require('../../models/expense.model');
const ApiError = require('../../utils/apiError');

const createEntry = catchAsync(async (req, res) => {
    let result;
    const { type } = req.body;

    if (type === 'income') {
        result = await Income.create({
            ...req.body,
            createdBy: req.user._id,
        });
    } else if (type === 'expense') {
        result = await Expense.create({
            ...req.body,
            createdBy: req.user._id,
        });
    } else {
        throw new ApiError(httpStatus.BAD_REQUEST, 'Invalid type');
    }

    res.status(httpStatus.CREATED).send(result);
});

const getEntries = catchAsync(async (req, res) => {
    const { type } = req.query;
    if (!type) {
        throw new ApiError(httpStatus.BAD_REQUEST, 'Type is required');
    }

    const filter = pick(req.query, ['category']);
    if (req.query.search) {
        filter.$or = [
            { category: { $regex: req.query.search, $options: 'i' } },
            { remark: { $regex: req.query.search, $options: 'i' } },
        ];
    }
    const options = pick(req.query, ['sortBy', 'limit', 'page']);

    let result;
    if (type === 'income') {
        result = await Income.paginate(filter, options);
    } else if (type === 'expense') {
        result = await Expense.paginate(filter, options);
    } else {
        throw new ApiError(httpStatus.BAD_REQUEST, 'Invalid type');
    }

    res.send(result);
});

module.exports = {
    createEntry,
    getEntries,
};
