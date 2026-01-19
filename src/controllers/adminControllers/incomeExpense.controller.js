const httpStatus = require('http-status');
const pick = require('../../utils/pick');
const catchAsync = require('../../utils/catchAsync');
const Income = require('../../models/income.model');
const Expense = require('../../models/expense.model');
const ApiError = require('../../utils/apiError');

const Challan = require('../../models/challan.model');
const PurchaseOrder = require('../../models/purchaseOrder.model');

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

const getOverview = catchAsync(async (req, res) => {
    // 1. Calculate Total Income from Challans (only active ones)
    const challanAgg = await Challan.aggregate([
        { $match: { deletedAt: null } },
        { $group: { _id: null, total: { $sum: '$totalAmount' } } },
    ]);
    const totalChallanIncome = challanAgg.length > 0 ? challanAgg[0].total : 0;

    // 2. Calculate Total Income from manual Income entries
    const incomeAgg = await Income.aggregate([
        { $group: { _id: null, total: { $sum: '$amount' } } },
    ]);
    const totalManualIncome = incomeAgg.length > 0 ? incomeAgg[0].total : 0;

    // 3. Calculate Total Expense from Purchase Orders (only active ones)
    const poAgg = await PurchaseOrder.aggregate([
        { $match: { deletedAt: null } },
        { $group: { _id: null, total: { $sum: '$totalAmount' } } },
    ]);
    const totalPOExpense = poAgg.length > 0 ? poAgg[0].total : 0;

    // 4. Calculate Total Expense from manual Expense entries
    const expenseAgg = await Expense.aggregate([
        { $group: { _id: null, total: { $sum: '$amount' } } },
    ]);
    const totalManualExpense = expenseAgg.length > 0 ? expenseAgg[0].total : 0;

    const overview = {
        totalIncome: totalChallanIncome + totalManualIncome,
        totalExpense: totalPOExpense + totalManualExpense,
        breakdown: {
            income: {
                challans: totalChallanIncome,
                manual: totalManualIncome,
            },
            expense: {
                purchaseOrders: totalPOExpense,
                manual: totalManualExpense,
            },
        },
    };

    res.send(overview);
    res.send(overview);
});

const getEntry = catchAsync(async (req, res) => {
    const { id } = req.params;
    const { type } = req.query;

    if (!type) {
        throw new ApiError(httpStatus.BAD_REQUEST, 'Type is required');
    }

    let result;
    if (type === 'income') {
        result = await Income.findById(id);
    } else if (type === 'expense') {
        result = await Expense.findById(id);
    } else {
        throw new ApiError(httpStatus.BAD_REQUEST, 'Invalid type');
    }

    if (!result) {
        throw new ApiError(httpStatus.NOT_FOUND, 'Entry not found');
    }

    res.send(result);
});

const updateEntry = catchAsync(async (req, res) => {
    const { id } = req.params;
    const { type } = req.body;

    if (!type) {
        throw new ApiError(httpStatus.BAD_REQUEST, 'Type is required');
    }

    let result;
    if (type === 'income') {
        const income = await Income.findById(id);
        if (!income) throw new ApiError(httpStatus.NOT_FOUND, 'Income not found');
        Object.assign(income, req.body);
        result = await income.save();
    } else if (type === 'expense') {
        const expense = await Expense.findById(id);
        if (!expense) throw new ApiError(httpStatus.NOT_FOUND, 'Expense not found');
        Object.assign(expense, req.body);
        result = await expense.save();
    } else {
        throw new ApiError(httpStatus.BAD_REQUEST, 'Invalid type');
    }

    res.send(result);
});

const deleteEntry = catchAsync(async (req, res) => {
    const { id } = req.params;
    const { type } = req.query;

    if (!type) {
        throw new ApiError(httpStatus.BAD_REQUEST, 'Type is required');
    }

    if (type === 'income') {
        const income = await Income.findByIdAndDelete(id);
        if (!income) throw new ApiError(httpStatus.NOT_FOUND, 'Income not found');
    } else if (type === 'expense') {
        const expense = await Expense.findByIdAndDelete(id);
        if (!expense) throw new ApiError(httpStatus.NOT_FOUND, 'Expense not found');
    } else {
        throw new ApiError(httpStatus.BAD_REQUEST, 'Invalid type');
    }

    res.status(httpStatus.NO_CONTENT).send();
});

module.exports = {
    createEntry,
    getEntries,
    getOverview,
    getEntry,
    updateEntry,
    deleteEntry,
};


