const httpStatus = require('http-status');
const ApiError = require('../../utils/apiError');
const catchAsync = require('../../utils/catchAsync');
const { challanService, customerService } = require('../../services/commonServices');
const { paginationQuery } = require('../../helper/mongoose.helper');
const mongoose = require('mongoose');
const v1Service = require('../../services/v1Service');

module.exports = {
  /**
   * Create a new challan
   */
  createChallan: catchAsync(async (req, res) => {
    try {
      const { customerId, selectionIds, products, remarks, status } = req.body;

      // Validate customer exists
      const customer = await v1Service.getCustomer(customerId, req.headers.authorization); // Fetch from V1
      if (!customer) {
        throw new ApiError(httpStatus.NOT_FOUND, 'Customer not found (in V1)');
      }

      // Validate selections exist and belong to customer
      for (const selectionId of selectionIds) {
    
        const selection = await v1Service.getSelection(selectionId, req.headers.authorization);

        if (!selection) {
          throw new ApiError(httpStatus.BAD_REQUEST, `Selection ${selectionId} not found`);
        }

        // Validate selection belongs to the customer
        if (selection.customerId.toString() !== customerId) {
          throw new ApiError(httpStatus.BAD_REQUEST, `Selection ${selectionId} does not belong to this customer`);
        }
      }

      // Calculate totals
      let totalAmount = 0;
      let totalQuantity = 0;
      let totalSquareFeet = 0;
      let totalBox = 0;

      // Add selectionId to each product in the products array
      // Each product should already have its selectionId from the frontend
      const productsWithSelectionId = products.map(product => {
        // If product doesn't have selectionId, we need to determine it
        if (!product.selectionId) {
          // For now, assign to first selection (but this should be fixed in frontend)
          product.selectionId = selectionIds[0];
        }

        return {
          ...product,
          selectionId: product.selectionId
        };
      });

      // Validate that none of the products are already used in other challans
      for (const product of productsWithSelectionId) {
        const existingChallanProduct = await challanService.get({
          'products.selectionProductId': product.selectionProductId || product._id,
          deletedAt: null
        });

        if (existingChallanProduct) {
          throw new ApiError(
            httpStatus.BAD_REQUEST,
            `Product  is already used in challan ${existingChallanProduct.challanNumber}. Cannot create duplicate challan.`
          );
        }
      }

      productsWithSelectionId.forEach(product => {
        totalAmount += product.totalAmount || 0;
        totalQuantity += product.quantity || 0;
        totalSquareFeet += product.totalSquareFeet || 0;
        totalBox += product.totalBox || 0;
      });

      // Start a session for transaction
      const session = await mongoose.startSession();
      session.startTransaction();

      try {
        // Generate challan number with transaction
        const challanNumber = await challanService.generateChallanWithTransaction(session);

        // Create challan
        const challan = await challanService.create({
          challanNumber,
          customerId,
          selectionIds,
          products: productsWithSelectionId, // Use products with selectionId
          totalAmount,
          totalQuantity,
          totalSquareFeet, // Add totalSquareFeet
          totalBox, // Add totalBox
          status: status || 'Pending',
          remarks,
          createdBy: req.user._id,
        }, { session });

        await session.commitTransaction();

        res.status(httpStatus.CREATED).send({
          success: true,
          message: 'Challan created successfully',
          data: challan,
        });

        // Update isChallan flag in selection_products table using multiple update API
        try {
          await v1Service.updateMultipleProductChallanFlags(
            productsWithSelectionId,  // Products with selectionId
            true,  // challanCreated: true
            req.headers.authorization,
            challan._id,  // challanId
            challanNumber,  // challanNumber
            challan.status  // challanStatus (actual status from challan)
          );
        } catch (v1Error) {
          console.warn('Could not update product flags in v1:', v1Error.message);
        }
      } catch (error) {
        await session.abortTransaction();
        throw error;
      } finally {
        session.endSession();
      }
    } catch (error) {
      throw error;
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
    const { id } = req.params;
    const result = await challanService.getChallanWithProducts(id, req.headers.authorization);

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
    const { id } = req.params;
    const { customerId, selectionIds, products, remarks, status, purchaseOrderId, deliveryNote } = req.body;

    const challan = await challanService.get({ _id: id, deletedAt: null });
    if (!challan) {
      throw new ApiError(httpStatus.NOT_FOUND, 'Challan not found');
    }

    // Calculate new totals if products are updated
    if (products) {
      // Revert flags for old products
      try {
        if (challan.products && Array.isArray(challan.products)) {
          // Group old products by selectionId for multiple update
          const oldProductsBySelection = {};
          challan.products.forEach(product => {
            const selectionId = product.selectionId;
            if (!oldProductsBySelection[selectionId]) {
              oldProductsBySelection[selectionId] = {
                selectionId: selectionId,
                productVariantId: []
              };
            }
            oldProductsBySelection[selectionId].productVariantId.push({
              p_id: product.selectionProductId || product._id,
              totalSquareFeet: product.totalSquareFeet || 0,
              isChallan: false,
              challanId: null,
              challanCreated: false,
              challanNumber: null,
              challanStatus: null
            });
          });

          const oldUpdates = Object.values(oldProductsBySelection);

          await v1Service.updateMultipleProductChallanFlags(
            oldUpdates,  // Old products with selectionId
            false,  // challanCreated: false
            req.headers.authorization,
            null,  // challanId (null for reverting)
            null,  // challanNumber (null for reverting)
            null   // challanStatus (null for reverting)
          );
        }
      } catch (v1Error) {
        // Handle revert errors silently
      }

      let totalAmount = 0;
      let totalQuantity = 0;
      let totalSquareFeet = 0;
      let totalBox = 0;

      products.forEach(product => {
        totalAmount += product.totalAmount || 0;
        totalQuantity += product.quantity || 0;
        totalSquareFeet += product.totalSquareFeet || 0;
        totalBox += product.totalBox || 0;
      });

      challan.products = products;
      challan.totalAmount = totalAmount;
      challan.totalQuantity = totalQuantity;
      challan.totalSquareFeet = totalSquareFeet; // Add totalSquareFeet
      challan.totalBox = totalBox; // Add totalBox

      // Set flags for new products using multiple update API
      try {
        await v1Service.updateMultipleProductChallanFlags(
          products,  // Products with selectionId
          true,  // challanCreated: true
          req.headers.authorization,
          id,  // challanId
          challan.challanNumber,  // challanNumber
          'Created'  // challanStatus
        );
      } catch (v1Error) {
        // Handle update errors silently
      }
    }

    if (customerId) {
      const customer = await v1Service.getCustomer(customerId, req.headers.authorization);
      if (!customer) {
        throw new ApiError(httpStatus.NOT_FOUND, 'Customer not found (in V1)');
      }
      challan.customerId = customerId;
    }

    if (selectionIds) {
      // Validate selections exist and belong to customer (or new customer if updated)
      const targetCustomerId = customerId || challan.customerId.toString();

      for (const selectionId of selectionIds) {
        const selection = await v1Service.getSelection(selectionId, req.headers.authorization);

        if (!selection) {
          throw new ApiError(httpStatus.BAD_REQUEST, `Selection ${selectionId} not found`);
        }

        if (selection.customerId.toString() !== targetCustomerId) {
          throw new ApiError(httpStatus.BAD_REQUEST, `Selection ${selectionId} does not belong to this customer`);
        }
      }
      challan.selectionIds = selectionIds;
    }

    if (remarks !== undefined) challan.remarks = remarks;
    if (status) challan.status = status;
    if (purchaseOrderId) challan.purchaseOrderId = purchaseOrderId;
    if (deliveryNote !== undefined) challan.deliveryNote = deliveryNote;

    await challan.save();

    // Update challan status in selection products if status changed
    if (status && challan.products && Array.isArray(challan.products)) {
      try {
        await v1Service.updateMultipleProductChallanFlags(
          challan.products,  // Products with selectionId
          true,  // challanCreated: true (keep as true since challan exists)
          req.headers.authorization,
          challan._id,  // challanId
          challan.challanNumber,  // challanNumber
          status  // challanStatus (new status)
        );
      } catch (v1Error) {
        console.warn('Could not update challan status in selection products:', v1Error.message);
      }
    }

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

    // Update product flag in v1 to false using multiple update API (non-critical)
    try {
      if (challan.products && Array.isArray(challan.products)) {
        await v1Service.updateMultipleProductChallanFlags(
          challan.products,  // Products with selectionId
          false,  // challanCreated: false
          req.headers.authorization,
          null,  // challanId (null for deletion)
          null,  // challanNumber (null for deletion)
          null   // challanStatus (null for deletion)
        );
      }
    } catch (v1Error) {
      // Handle delete errors silently
    }

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

    const challan = await challanService.getChallanWithProducts(id, req.headers.authorization);

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
