const httpStatus = require('http-status');
const ApiError = require('../utils/apiError');
const catchAsync = require('../utils/catchAsync');
const { Challan, ChallanCounter } = require('../models');
const v1Service = require('../services/v1Service');
const mongoose = require('mongoose');

module.exports = {
  /**
   * Create a new challan
   */
  createChallan: catchAsync(async (req, res) => {
    const { customerId, selectionIds, products, remarks, status, purchaseOrderId, deliveryNote } = req.body;

    // Validate required fields
    if (!customerId || !selectionIds || !products || products.length === 0) {
      throw new ApiError(httpStatus.BAD_REQUEST, 'customerId, selectionIds, and products are required');
    }

    // Start a session for transaction
    const session = await mongoose.startSession();
    session.startTransaction();

    try {
      // Generate challan number
      const sequence = await ChallanCounter.getNextSequence('challan', session);
      const challanNumber = `CH-${String(sequence).padStart(6, '0')}`;

      // Calculate totals
      let totalAmount = 0;
      let totalQuantity = 0;
      products.forEach(product => {
        totalAmount += product.totalAmount;
        totalQuantity += product.quantity;
      });

      // Create challan in v2 with v1-compatible structure
      const challan = await Challan.create([{
        challanNumber,
        customerId,
        selectionIds,
        products,
        totalAmount,
        totalQuantity,
        status: status || 'Pending',
        remarks,
        purchaseOrderId,
        deliveryNote,
        createdBy: req.user._id,
      }], { session });

      // Update product flag in v1 (non-critical)
      try {
        await v1Service.updateProductChallanFlag(products[0].productId, true);
      } catch (v1Error) {
        console.warn('Could not update product flag in v1:', v1Error.message);
        // Continue with challan creation even if v1 update fails
      }

      await session.commitTransaction();

      res.status(httpStatus.CREATED).send({
        success: true,
        message: 'Challan created successfully and product updated in v1',
        data: challan[0],
      });
    } catch (error) {
      await session.abortTransaction();
      throw error;
    } finally {
      session.endSession();
    }
  }),

  /**
   * Get all challans with pagination
   */
  getAllChallans: catchAsync(async (req, res) => {
    const { page = 1, limit = 10, search, status, customerId } = req.query;

    const filter = {
      deletedAt: null,
    };

    if (search) {
      filter.challanNumber = { $regex: search, $options: 'i' };
    }

    if (status && status !== 'All') {
      filter.status = status;
    }

    if (customerId) {
      filter.customerId = mongoose.Types.ObjectId(customerId);
    }

    const options = {
      page: parseInt(page),
      limit: parseInt(limit),
      sort: { createdAt: -1 }
    };

    const challans = await Challan.paginate(filter, options);

    // Debug: Log the structure of first result
    if (challans.results && challans.results.length > 0) {
      console.log('Raw challan data structure:', JSON.stringify(challans.results[0], null, 2));
    }

    // Populate results with proper error handling
    if (challans.results && challans.results.length > 0) {
      try {
        await Challan.populate(challans.results, [
          { path: 'customerId', select: 'first_name last_name email phone address' },
          { path: 'createdBy', select: 'first_name last_name email' }
        ]);
      } catch (populateError) {
        console.warn('Population error for challan:', populateError.message);
      }
    }

    res.status(httpStatus.OK).send({
      success: true,
      message: 'Challans fetched successfully',
      data: (challans.results && challans.results.length > 0) ? challans.results[0] : null,
    });
  }),

  /**
   * Get single challan by ID
   */
  getChallan: catchAsync(async (req, res) => {
    const { id } = req.params;
    
    // Validate ID
    if (!id || !mongoose.Types.ObjectId.isValid(id)) {
      throw new ApiError(httpStatus.BAD_REQUEST, 'Invalid challan ID');
    }

    const challan = await Challan.findById(id)
      .populate('customerId', 'first_name last_name email phone address')
      .populate('createdBy', 'first_name last_name email');

    if (!challan || challan.deletedAt) {
      throw new ApiError(httpStatus.NOT_FOUND, 'Challan not found');
    }

    res.status(httpStatus.OK).send({
      success: true,
      message: 'Challan details fetched successfully',
      data: challan,
    });
  }),

  /**
   * Update challan
   */
  updateChallan: catchAsync(async (req, res) => {
    const { id } = req.params;
    
    // Validate ID
    if (!id || !mongoose.Types.ObjectId.isValid(id)) {
      throw new ApiError(httpStatus.BAD_REQUEST, 'Invalid challan ID');
    }
    
    const { productId, qty, customerId, remarks, status } = req.body;

    const challan = await Challan.findOne({ _id: id, deletedAt: null });
    if (!challan) {
      throw new ApiError(httpStatus.NOT_FOUND, 'Challan not found');
    }

    // Update challan fields
    if (productId) challan.productId = productId;
    if (qty) {
      challan.qty = qty;
      challan.totalQuantity = qty;
    }
    if (customerId) challan.customerId = customerId;
    if (remarks !== undefined) challan.remarks = remarks;
    if (status) challan.status = status;

    await challan.save();

    // Update product flag in v1 if productId changed (non-critical)
    if (productId && productId !== challan.productId) {
      try {
        // Set old product flag to false
        await v1Service.updateProductChallanFlag(challan.productId, false);
        // Set new product flag to true
        await v1Service.updateProductChallanFlag(productId, true);
      } catch (v1Error) {
        console.warn('Could not update product flag in v1:', v1Error.message);
      }
    }

    const updatedChallan = await Challan.findById(id)
      .populate('customerId', 'first_name last_name email phone address')
      .populate('createdBy', 'first_name last_name email');

    res.status(httpStatus.OK).send({
      success: true,
      message: 'Challan updated successfully',
      data: updatedChallan,
    });
  }),

  /**
   * Delete challan (soft delete)
   */
  deleteChallan: catchAsync(async (req, res) => {
    const { id } = req.params;
    
    // Validate ID
    if (!id || !mongoose.Types.ObjectId.isValid(id)) {
      throw new ApiError(httpStatus.BAD_REQUEST, 'Invalid challan ID');
    }

    const challan = await Challan.findOne({ _id: id, deletedAt: null });
    if (!challan) {
      throw new ApiError(httpStatus.NOT_FOUND, 'Challan not found');
    }

    // Update product flag in v1 to false (non-critical)
    try {
      await v1Service.updateProductChallanFlag(challan.productId, false);
    } catch (v1Error) {
      console.warn('Could not update product flag in v1:', v1Error.message);
      // Continue with challan deletion even if v1 update fails
    }

    // Soft delete challan in v2
    challan.deletedAt = new Date();
    await challan.save();

    res.status(httpStatus.OK).send({
      success: true,
      message: 'Challan deleted successfully and product updated in v1',
      data: challan,
    });
  }),
};