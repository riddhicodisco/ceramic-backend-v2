const httpStatus = require('http-status');
const ApiError = require('../../utils/apiError');
const catchAsync = require('../../utils/catchAsync');
const commonServices = require('../../services/commonServices');
const { challanService, customerService, selectionService, selectionProductService } = commonServices;
const { paginationQuery } = require('../../helper/mongoose.helper');
const mongoose = require('mongoose');

module.exports = {
  /**
   * Simple debug method
   */
  debugCreate: catchAsync(async (req, res) => {
    console.log('🎯 debugCreate controller called!');
    console.log('📥 Request body:', req.body);
    res.status(200).json({
      success: true,
      message: 'Debug create works!',
      body: req.body
    });
  }),

  /**
   * Create a new challan
   */
  createChallan: catchAsync(async (req, res) => {
    console.log('🎯 createChallan controller called!');
    console.log('📥 Request body:', req.body);
    console.log('👤 User info:', req.user);
    
    try {
      const { customerId, selectionIds, products, remarks, status } = req.body;
      
      console.log('📋 Parsed data:', { customerId, selectionIds, products: products?.length, remarks, status });

      // Validate customer exists
      console.log('🔍 Validating customer...');
      const customer = await customerService.get({ _id: customerId, deletedAt: null });
      console.log('👤 Customer found:', !!customer);
      if (!customer) {
        throw new ApiError(httpStatus.NOT_FOUND, 'Customer not found');
      }

      // Validate selections exist and belong to customer
      console.log('🔍 Validating selections...');
      for (const selectionId of selectionIds) {
        const selection = await selectionService.get({
          _id: new mongoose.Types.ObjectId(selectionId),
          customerId: new mongoose.Types.ObjectId(customerId),
          deletedAt: null
        });
        console.log(`📋 Selection ${selectionId} found:`, !!selection);
        if (!selection) {
          throw new ApiError(httpStatus.BAD_REQUEST, `Selection ${selectionId} not found or does not belong to this customer`);
        }
      }

      // Calculate totals
      console.log('💰 Calculating totals...');
      let totalAmount = 0;
      let totalQuantity = 0;

      products.forEach(product => {
        totalAmount += product.totalAmount;
        totalQuantity += product.quantity;
      });
      console.log('💰 Totals calculated:', { totalAmount, totalQuantity });

      // Start a session for transaction
      console.log('🔄 Starting transaction...');
      const session = await mongoose.startSession();
      session.startTransaction();

      try {
        // Generate challan number
        console.log('🔢 Generating challan number...');
        const challanNumber = await challanService.generateChallanNumber(session);
        console.log('🔢 Challan number generated:', challanNumber);

        // Create challan
        console.log('📝 Creating challan...');
        const challan = await challanService.create({
          challanNumber,
          customerId,
          selectionIds,
          products,
          totalAmount,
          totalQuantity,
          status: status || 'Pending',
          remarks,
          createdBy: req.user._id,
        });
        console.log('✅ Challan created:', challan._id);

        await session.commitTransaction();
        console.log('✅ Transaction committed');

        res.status(httpStatus.CREATED).send({
          success: true,
          message: 'Challan created successfully',
          data: challan,
        });
      } catch (error) {
        console.log('❌ Transaction error:', error.message);
        await session.abortTransaction();
        throw error;
      } finally {
        session.endSession();
        console.log('🔚 Session ended');
      }
    } catch (error) {
      console.log('❌ Controller error:', error.message);
      throw error;
    }
  }),

  /**
   * Get all challans with pagination
   */
  getAllChallans: catchAsync(async (req, res) => {
    console.log('🎯 getAllChallans controller called!');
    console.log('📥 Query params:', req.query);
    
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
      filter.customerId = customerId;
    }

    const pipeline = [
      { $match: filter },

      // Lookup customer - fix collection name
      {
        $lookup: {
          from: 'customers', // MongoDB collection name is usually plural
          localField: 'customerId',
          foreignField: '_id',
          as: 'customer',
        },
      },
      { $unwind: { path: '$customer', preserveNullAndEmptyArrays: true } },

      // Unwind products for processing (only the ones saved with challan)
      { $unwind: { path: '$products', preserveNullAndEmptyArrays: true } },

      // Lookup product variant
      {
        $lookup: {
          from: 'product_variants',
          localField: 'products.productVariantId',
          foreignField: '_id',
          as: 'products.productVariant',
        },
      },
      { $unwind: { path: '$products.productVariant', preserveNullAndEmptyArrays: true } },

      // Lookup series product
      {
        $lookup: {
          from: 'series_products',
          localField: 'products.productVariant.series_product',
          foreignField: '_id',
          as: 'products.seriesProduct',
        },
      },
      { $unwind: { path: '$products.seriesProduct', preserveNullAndEmptyArrays: true } },

      // Lookup series
      {
        $lookup: {
          from: 'series',
          localField: 'products.seriesProduct.series',
          foreignField: '_id',
          as: 'products.series',
        },
      },
      { $unwind: { path: '$products.series', preserveNullAndEmptyArrays: true } },

      // Add frontend-friendly fields
      {
        $addFields: {
          'products.productName': { $ifNull: ['$products.seriesProduct.product_name', ''] },
          'products.seriesName': { $ifNull: ['$products.series.series_name', ''] },
          'products.dimension': { $ifNull: ['$products.series.dimension', ''] },
          'products.designCode': { $ifNull: ['$products.seriesProduct.designCode', ''] },
        }
      },

      // Group back to restore original structure
      {
        $group: {
          _id: '$_id',
          challanNumber: { $first: '$challanNumber' },
          customer: { $first: '$customer' },
          customerId: { $first: '$customerId' },
          selectionIds: { $first: '$selectionIds' },
          products: { $push: '$products' },
          totalAmount: { $first: '$totalAmount' },
          totalQuantity: { $first: '$totalQuantity' },
          status: { $first: '$status' },
          remarks: { $first: '$remarks' },
          createdBy: { $first: '$createdBy' },
          createdAt: { $first: '$createdAt' },
          updatedAt: { $first: '$updatedAt' },
        }
      },

      // Sort by creation date (newest first)
      { $sort: { createdAt: -1 } },

      ...paginationQuery({ page, limit }),
    ];

    const challans = await challanService.aggregate(pipeline);

    res.status(httpStatus.OK).send({
      success: true,
      message: 'Challans fetched successfully',
      data: challans[0],
    });
  }),

  /**
   * Get single challan by ID
   */
  getChallan: catchAsync(async (req, res) => {
    console.log('🎯 getChallan controller called!');
    console.log('📥 Params:', req.params);
    
    const { id } = req.params;
    const result = await challanService.getChallanWithProducts(id);

    if (!result.success) {
      throw new ApiError(httpStatus.NOT_FOUND, result.message);
    }

    res.status(httpStatus.OK).send({
      success: true,
      message: 'Challan details fetched successfully',
      data: result.data,
    });
  }),

  /**
   * Update challan
   */
  updateChallan: catchAsync(async (req, res) => {
    console.log('🎯 updateChallan controller called!');
    console.log('📥 Params:', req.params);
    console.log('📥 Body:', req.body);
    
    const { id } = req.params;
    const { customerId, selectionIds, products, remarks, status, purchaseOrderId, deliveryNote } = req.body;

    const challan = await challanService.get({ _id: id, deletedAt: null });
    if (!challan) {
      throw new ApiError(httpStatus.NOT_FOUND, 'Challan not found');
    }

    // Calculate new totals if products are updated
    if (products) {
      let totalAmount = 0;
      let totalQuantity = 0;

      products.forEach(product => {
        totalAmount += product.totalAmount;
        totalQuantity += product.quantity;
      });

      challan.products = products;
      challan.totalAmount = totalAmount;
      challan.totalQuantity = totalQuantity;
    }

    if (customerId) challan.customerId = customerId;
    if (selectionIds) challan.selectionIds = selectionIds;
    if (remarks !== undefined) challan.remarks = remarks;
    if (status) challan.status = status;
    if (purchaseOrderId) challan.purchaseOrderId = purchaseOrderId;
    if (deliveryNote !== undefined) challan.deliveryNote = deliveryNote;

    await challan.save();

    res.status(httpStatus.OK).send({
      success: true,
      message: 'Challan updated successfully',
      data: challan,
    });
  }),

  /**
   * Delete challan (soft delete)
   */
  deleteChallan: catchAsync(async (req, res) => {
    const { id } = req.params;

    const challan = await challanService.get({ _id: id, deletedAt: null });
    if (!challan) {
      throw new ApiError(httpStatus.NOT_FOUND, 'Challan not found');
    }

    const deletedChallan = await challanService.delete(
      { _id: id, deletedAt: null },
      { deletedAt: new Date() }
    );

    res.status(httpStatus.OK).send({
      success: true,
      message: 'Challan deleted successfully',
      data: deletedChallan,
    });
  }),



  /**
   * Download challan PDF
   */
  downloadChallan: catchAsync(async (req, res) => {
    const { id } = req.params;

    const challan = await challanService.getChallanWithProducts(id);
    
    if (!challan.success) {
      throw new ApiError(httpStatus.NOT_FOUND, challan.message);
    }

    // TODO: Generate PDF here
    // For now, return a placeholder response
    res.status(httpStatus.OK).send({
      success: true,
      message: 'Challan download functionality not yet implemented',
      data: {
        challanNumber: challan.data.challanNumber,
        downloadUrl: `/challans/download/${id}`
      }
    });
  }),

  /**
   * Get products from selected selections
   */
  getSelectionProducts: catchAsync(async (req, res) => {
    const { selectionIds } = req.query;

    if (!selectionIds) {
      throw new ApiError(httpStatus.BAD_REQUEST, 'Selection IDs are required');
    }

    const ids = selectionIds.split(',').map(id => new mongoose.Types.ObjectId(id.trim()));

    const pipeline = [
      { $match: { selectionId: { $in: ids }, deletedAt: null } },
      {
        $lookup: {
          from: 'product_variants',
          localField: 'productVariantId',
          foreignField: '_id',
          as: 'productVariant',
        },
      },
      { $unwind: { path: '$productVariant', preserveNullAndEmptyArrays: true } },
      {
        $lookup: {
          from: 'series_products',
          localField: 'productVariant.series_product',
          foreignField: '_id',
          as: 'seriesProduct',
        },
      },
      { $unwind: { path: '$seriesProduct', preserveNullAndEmptyArrays: true } },
      {
        $lookup: {
          from: 'series',
          localField: 'seriesProduct.series',
          foreignField: '_id',
          as: 'series',
        },
      },
      { $unwind: { path: '$series', preserveNullAndEmptyArrays: true } },
      {
        $addFields: {
          'seriesProduct.name': '$seriesProduct.product_name',
          'series.name': '$series.series_name',
          'productVariant.dimension': '$series.dimension'
        }
      },

    ];

    const products = await selectionProductService.aggregate(pipeline);

    res.status(httpStatus.OK).send({
      success: true,
      message: 'Selection products fetched successfully',
      data: products,
    });
  }),
};
