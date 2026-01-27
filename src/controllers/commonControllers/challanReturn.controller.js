const httpStatus = require('http-status');
const ApiError = require('../../utils/apiError');
const catchAsync = require('../../utils/catchAsync');
const { challanReturnService, challanService } = require('../../services/commonServices');
const { paginationQuery } = require('../../helper/mongoose.helper');
const mongoose = require('mongoose');
const v1Service = require('../../services/v1Service');

module.exports = {
  /**
   * Create a new challan return
   */
  createChallanReturn: catchAsync(async (req, res) => {
    const { customerId, challanId, products, totalAmount, remarks } = req.body;
    const token = req.headers.authorization;

    // Validate challan exists
    const challan = await challanService.get({ _id: challanId, deletedAt: null });
    if (!challan) {
      throw new ApiError(httpStatus.NOT_FOUND, 'Challan not found');
    }

    const session = await mongoose.startSession();
    session.startTransaction();

    try {
      const challanReturnNumber = await challanReturnService.generateReturnNumber(session);

      const challanReturn = await challanReturnService.create({
        challanReturnNumber,
        customerId,
        challanId,
        products,
        totalAmount,
        remarks,
        createdBy: req.user._id,
      }, { session });

      await session.commitTransaction();

      res.status(httpStatus.CREATED).send({
        success: true,
        message: 'Challan return created successfully',
        data: challanReturn,
      });
    } catch (error) {
      await session.abortTransaction();
      throw error;
    } finally {
      session.endSession();
    }
  }),

  /**
   * Get all challan returns with pagination
   */
  getAllChallanReturns: catchAsync(async (req, res) => {
    const { page = 1, limit = 10, search, customerId, status } = req.query;

    const matchStage = { deletedAt: null };

    if (search) {
      matchStage.challanReturnNumber = { $regex: search, $options: 'i' };
    }

    if (customerId) {
      matchStage.customerId = new mongoose.Types.ObjectId(customerId);
    }

    const totalAgg = await challanReturnService.aggregate([
      { $match: matchStage },
      { $group: { _id: null, totalAmount: { $sum: '$totalAmount' } } }
    ]);
    const totalReturnAmount = totalAgg[0] ? totalAgg[0].totalAmount : 0;

    const pipeline = [
      { $match: matchStage },
      { $sort: { createdAt: -1 } },
      ...paginationQuery({ page, limit }),
    ];

    const returns = await challanReturnService.aggregate(pipeline);

    if (returns[0] && returns[0].results && returns[0].results.length > 0) {
      const resultsWithCustomer = await Promise.all(
        returns[0].results.map(async (ret) => {
          let customer = null;
          if (ret.customerId) {
            try {
              customer = await v1Service.getCustomer(ret.customerId.toString(), req.headers.authorization);
            } catch (error) {
              console.warn(`Could not fetch customer ${ret.customerId} from v1:`, error.message);
            }
          }
          return {
            ...ret,
            customer,
          };
        })
      );
      returns[0].results = resultsWithCustomer;
    }

    res.status(httpStatus.OK).send({
      success: true,
      message: 'Challan returns fetched successfully',
      data: {
        ...returns[0],
        totalAmount: totalReturnAmount
      },
    });
  }),

  /**
   * Get single challan return by ID
   */
  getChallanReturn: catchAsync(async (req, res) => {
    const { id } = req.params;
    const challanReturn = await challanReturnService.get({ _id: id, deletedAt: null });

    if (!challanReturn) {
      throw new ApiError(httpStatus.NOT_FOUND, 'Challan return not found');
    }

    let customer = null;
    if (challanReturn.customerId) {
      customer = await v1Service.getCustomer(challanReturn.customerId.toString(), req.headers.authorization);
    }

    res.status(httpStatus.OK).send({
      success: true,
      message: 'Challan return details fetched successfully',
      data: {
        ...challanReturn.toJSON(),
        customer,
      },
    });
  }),

  /**
   * Delete challan return (soft delete)
   */
  deleteChallanReturn: catchAsync(async (req, res) => {
    const { id } = req.params;

    const challanReturn = await challanReturnService.get({ _id: id, deletedAt: null });
    if (!challanReturn) {
      throw new ApiError(httpStatus.NOT_FOUND, 'Challan return not found');
    }

    await challanReturnService.delete(
      { _id: id },
      { deletedAt: new Date() }
    );

    res.status(httpStatus.OK).send({
      success: true,
      message: 'Challan return deleted successfully',
    });
  }),

  /**
   * Update challan return
   */
  updateChallanReturn: catchAsync(async (req, res) => {
    const { id } = req.params;
    const updateBody = req.body;

    // Check if challan return exists
    const challanReturn = await challanReturnService.get({ _id: id, deletedAt: null });
    if (!challanReturn) {
      throw new ApiError(httpStatus.NOT_FOUND, 'Challan return not found');
    }

    // Process Update
    const updatedReturn = await challanReturnService.updateById(id, updateBody);

    res.status(httpStatus.OK).send({
      success: true,
      message: 'Challan return updated successfully',
      data: updatedReturn,
    });
  }),

  /**
   * Download challan return receipt (placeholder)
   */
  downloadChallanReturn: catchAsync(async (req, res) => {
    // PDF generation logic would go here
    res.status(httpStatus.NOT_IMPLEMENTED).send({
      success: false,
      message: 'Download functionality not yet implemented',
    });
  }),
};
