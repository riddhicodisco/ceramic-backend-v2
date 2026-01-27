const httpStatus = require('http-status');
const ApiError = require('../../utils/apiError');
const catchAsync = require('../../utils/catchAsync');
const { challanService } = require('../../services/commonServices');
const { paginationQuery } = require('../../helper/mongoose.helper');
const mongoose = require('mongoose');
const v1Service = require('../../services/v1Service');
const axios = require('axios');

module.exports = {

  /**
   * Create a new challan (Common for both Frontend and Admin)
   */
  createChallan: catchAsync(async (req, res) => {
    try {
      const { customerId, customerMode, newCustomerData, selectionIds, products, remarks, status, assignTo, newCustomerSelections, transporterId, transporterName, transporterAmount } = req.body;
      const token = req.headers.authorization;

      // Validation: customerId is required for existing customer, optional for new customer
      if (customerMode === "existing" && !customerId) {
        throw new ApiError(httpStatus.BAD_REQUEST, 'Customer ID is required for existing customer');
      }

      if (customerMode === "new" && !newCustomerData) {
        throw new ApiError(httpStatus.BAD_REQUEST, 'New customer data is required for new customer');
      }

      let finalCustomerId = customerId;

      // Handle new customer creation
      if (customerMode === "new" && newCustomerData) {

        try {
          // Create customer via V1 API
          const customerResponse = await axios.post(`${process.env.V1_BASE_URL}/v1/mobile/staff/customer/create-customer`, newCustomerData, {
            headers: {
              'Content-Type': 'application/json',
              'Authorization': token
            }
          });

          if (customerResponse.status !== 200 && customerResponse.status !== 201) {
            throw new ApiError(httpStatus.BAD_REQUEST, `Failed to create customer: ${customerResponse.data?.message || 'Unknown error'}`);
          }

          const customerRes = customerResponse.data;
          if (customerRes?.data?._id) {
            finalCustomerId = customerRes.data._id;
          } else {
            throw new ApiError(httpStatus.BAD_REQUEST, 'Failed to create customer: No customer ID returned');
          }
        } catch (error) {
          if (error.response?.status === 400 && error.response?.data?.message) {
            throw new ApiError(httpStatus.BAD_REQUEST, error.response.data.message);
          }
          throw new ApiError(httpStatus.BAD_REQUEST, `Failed to create customer: ${error.response?.data?.message || error.message || 'Unknown error'}`);
        }
      } else {
        const customer = await v1Service.getCustomer(finalCustomerId, token);
        if (!customer) {
          throw new ApiError(httpStatus.NOT_FOUND, 'Customer not found (in V1)');
        }
      }

      let finalSelectionIds = [...selectionIds];
      let createdSelectionsData = null; // Store selection response data

      // Handle new customer selections creation
      if (newCustomerSelections && newCustomerSelections.length > 0) {


        const selectionPayload = {
          customerId: finalCustomerId,
          selectionData: newCustomerSelections.map((s, index) => {

            return {
              requirementType: s.requirementType,
              followUp: s.followUpDate,
              productVariantId: s.products
                .map((p) => ({
                  p_id: p.productVariantId,
                  totalBox: p.totalBox || "",
                  boxPerPiece: p.boxPerPiece || "",
                  totalSquareFeet: Number(p.totalSquareFeet) || 0,
                  unitPerPrice: Number(p.unitPerPrice) || 0,
                  unit: p.unit,
                })),
            };
          }),
        };

        const selectionResponse = await axios.post(`${process.env.V1_BASE_URL}/v1/mobile/staff/selection/create`, selectionPayload, {
          headers: {
            'Content-Type': 'application/json',
            'Authorization': token
          }
        });

        if (selectionResponse.status !== 200 && selectionResponse.status !== 201) {
          throw new ApiError(httpStatus.BAD_REQUEST, `Failed to create selections: ${selectionResponse.data?.message || 'Unknown error'}`);
        }

        const selRes = selectionResponse.data;
        createdSelectionsData = selRes; // Store for later use

        // Extract selection IDs from V1 response and update products
        if (selRes?.data) {
          const createdSelections = Array.isArray(selRes.data) ? selRes.data : [selRes.data];

          createdSelections.forEach((createdSel, index) => {
            const tempSel = newCustomerSelections[index];
            if (tempSel) {
              finalSelectionIds.push(createdSel._id);
            }
          });
        }

      }

      // Handle customer assignment
      if (assignTo && assignTo.length > 0) {
        const assignPayload = {
          customer_id: finalCustomerId, // Use the final customer ID (newly created or existing)
          staff_id: assignTo,
        };

        // Assign customer via V1 API
        const assignResponse = await axios.put(`${process.env.V1_BASE_URL}/v1/mobile/staff/customer/assign-staff`, assignPayload, {
          headers: {
            'Content-Type': 'application/json',
            'Authorization': token
          }
        });

        if (assignResponse.status !== 200 && assignResponse.status !== 201) {
          throw new ApiError(httpStatus.BAD_REQUEST, `Failed to assign customer: ${assignResponse.data?.message || 'Unknown error'}`);
        }
      }
      const selectionMap = {};
      for (const selectionId of finalSelectionIds) {
        const selection = await v1Service.getSelection(selectionId, token);
        if (!selection) {
          throw new ApiError(httpStatus.BAD_REQUEST, `Selection ${selectionId} not found`);
        }
        if (selection.customerId.toString() !== finalCustomerId) {
          throw new ApiError(httpStatus.BAD_REQUEST, `Selection ${selectionId} does not belong to this customer`);
        }
        selectionMap[selectionId] = selection;
      }

      // Calculate totals and enrich products with metadata
      let totalAmount = 0;
      let totalQuantity = 0;
      let totalSquareFeet = 0;
      let totalBox = 0;

      const enrichedProducts = products.map(product => {
        const isTempSelection = product.selectionId === null || !product.selectionId;
        let realSelectionId = product.selectionId;
        let realSelectionProductId = product.selectionProductId;

        // For new customer selections, update the selectionId and selectionProductId with newly created IDs
        if (isTempSelection && createdSelectionsData?.data) {
          const createdSelections = Array.isArray(createdSelectionsData.data) ? createdSelectionsData.data : [createdSelectionsData.data];
          // Use first created selection ID for all new products
          if (createdSelections.length > 0) {
            realSelectionId = createdSelections[0]._id;

            // Find the matching product in created selection to get new product ID
            const createdSelection = createdSelections[0];
            if (createdSelection?.products) {
              const matchingCreatedProduct = createdSelection.products.find(cp =>
                cp.p_id === product.productVariantId || cp.product_variant_id === product.productVariantId
              );
              if (matchingCreatedProduct) {
                realSelectionProductId = matchingCreatedProduct._id;
              }
            }
          }
        }

        const selection = selectionMap[realSelectionId || finalSelectionIds[0]];

        let metadata = {};
        if (selection) {
          const matchingProduct = selection.products?.find(p =>
            (p.product_variant_id && p.product_variant_id.toString() === product.productVariantId?.toString()) ||
            (p._id && p._id.toString() === realSelectionProductId?.toString())
          );

          if (matchingProduct) {
            metadata = {
              productName: product.productName || matchingProduct.product_name || '',
              seriesName: product.seriesName || (Array.isArray(matchingProduct.series_name) ? matchingProduct.series_name.join(', ') : (matchingProduct.series_name || '')),
              dimension: matchingProduct.dimension || '',
              designCode: product.designCode || matchingProduct.design_code || '',
              variantId: product.variantId || matchingProduct.variant_id?.toString() || '',
              seriesId: product.seriesId || matchingProduct.series_id?.toString() || '',
              variantName: product.variantName || matchingProduct.variant_name || '',
            };
          }
        }

        totalAmount += product.totalAmount || 0;
        totalQuantity += product.quantity || 0;
        totalSquareFeet += product.totalSquareFeet || 0;
        totalBox += product.totalBox || 0;

        const finalProduct = {
          ...product,
          ...metadata,
          selectionId: realSelectionId,
          selectionProductId: realSelectionProductId,
          selectionName: selection?.requirementType || ''
        };

        return finalProduct;
      });

      // Add transporter amount to total amount if provided
      if (transporterAmount && transporterAmount > 0) {
        totalAmount += Number(transporterAmount);
      }

      // Validate products not already used
      for (const product of enrichedProducts) {
        const existingChallanProduct = await challanService.get({
          'products.selectionProductId': product.selectionProductId || product._id,
          deletedAt: null
        });
        if (existingChallanProduct) {
          throw new ApiError(
            httpStatus.BAD_REQUEST,
            `Product is already used in challan ${existingChallanProduct.challanNumber}. Cannot create duplicate challan.`
          );
        }
      }

      const session = await mongoose.startSession();
      session.startTransaction();

      try {
        const challanNumber = await challanService.generateChallanWithTransaction(session);

        const challan = await challanService.create({
          challanNumber,
          customerId: finalCustomerId, // Use the final customer ID (newly created or existing)
          selectionIds: finalSelectionIds,
          products: enrichedProducts,
          totalAmount,
          totalQuantity,
          totalSquareFeet,
          totalBox,
          status: status || 'Pending',
          remarks,
          transporterId: transporterId || null,
          transporterName: transporterName || null,
          transporterAmount: transporterAmount || 0,
          createdBy: req.user._id,
        }, { session });

        await session.commitTransaction();

        // Update v1 flags
        try {
          await v1Service.updateMultipleProductChallanFlags(enrichedProducts, true, token, challan._id, challan.challanNumber, 'Created');
        } catch (v1Error) {
          console.warn('Could not update product flags in v1:', v1Error.message);
        }

        // Create transporter history in v1 if transporter is provided
        if (transporterId && transporterAmount && transporterAmount > 0) {
          try {
            await v1Service.createTransporterHistory({
              transporterId: transporterId,
              challanId: challan._id.toString(),
              challanNumber: challan.challanNumber,
              amount: transporterAmount,
              date: new Date()
            }, token);
          } catch (historyError) {
            console.warn('Could not create transporter history in v1:', historyError.message);
            // Don't fail the challan creation if history creation fails
          }
        }

        res.status(httpStatus.CREATED).send({
          success: true,
          message: 'Challan created successfully',
          data: challan,
        });
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
    const {
      page = 1,
      limit = 10,
      search,
      status,
      customerId,
      startDate,
      endDate,
      minAmount,
      maxAmount,
      selectionIds
    } = req.query;

    const matchStage = { deletedAt: null };

    if (search) {
      matchStage.challanNumber = { $regex: search, $options: 'i' };
    }

    if (status && status !== 'All') {
      matchStage.status = status;
    }

    if (customerId) {
      matchStage.customerId = new mongoose.Types.ObjectId(customerId);
    }

    if (startDate || endDate) {
      matchStage.createdAt = {};
      if (startDate) {
        matchStage.createdAt.$gte = new Date(startDate);
      }
      if (endDate) {
        const end = new Date(endDate);
        end.setHours(23, 59, 59, 999);
        matchStage.createdAt.$lte = end;
      }
    }

    if (minAmount !== undefined || maxAmount !== undefined) {
      matchStage.totalAmount = {};
      if (minAmount !== undefined) {
        matchStage.totalAmount.$gte = Number(minAmount);
      }
      if (maxAmount !== undefined) {
        matchStage.totalAmount.$lte = Number(maxAmount);
      }
    }

    if (selectionIds) {
      matchStage.selectionIds = { $in: selectionIds.split(',').map(id => new mongoose.Types.ObjectId(id.trim())) };
    }

    const pipeline = [
      { $match: matchStage },

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
          'products.productName': { $ifNull: ['$products.productName', ''] },
          'products.seriesName': { $ifNull: ['$products.seriesName', ''] },
          'products.dimension': { $ifNull: ['$products.dimension', ''] },
          'products.designCode': { $ifNull: ['$products.designCode', ''] },
          'products.totalBox': { $ifNull: ['$products.totalBox', 0] },
          'products.totalSquareFeet': { $ifNull: ['$products.totalSquareFeet', 0] },
          'products.boxPerPiece': { $ifNull: ['$products.boxPerPiece', 0] },
          'products.unitPerPrice': { $ifNull: ['$products.unitPerPrice', 0] },
          'products.unit': { $ifNull: ['$products.unit', 'Sq.Feet/Price'] },
          'products.totalAmount': { $ifNull: ['$products.totalAmount', 0] },
          'products.selectionId': { $ifNull: ['$products.selectionId', ''] },
          'products.selectionName': { $ifNull: ['$products.selectionName', 'N/A'] },
          'products.selectionProductId': { $ifNull: ['$products.selectionProductId', ''] },
          'products.variantId': { $ifNull: ['$products.variantId', ''] },
          'products.variantName': { $ifNull: ['$products.variantName', ''] },
          'products.seriesId': { $ifNull: ['$products.seriesId', ''] },
        }
      },

      // Group back to restore original structure
      {
        $group: {
          _id: '$_id',
          challanNumber: { $first: '$challanNumber' },
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

    // Populate customer details from V1
    if (challans[0] && challans[0].results && challans[0].results.length > 0) {
      const resultsWithCustomer = await Promise.all(challans[0].results.map(async (challan) => {
        let customer = null;
        if (challan.customerId) {
          try {
            // Fetch customer from V1 like in getChallan
            customer = await v1Service.getCustomer(challan.customerId.toString(), req.headers.authorization);
          } catch (error) {
            console.warn(`Could not fetch customer ${challan.customerId} from v1:`, error.message);
          }
        }
        return {
          ...challan,
          customer: customer
        };
      }));
      challans[0].results = resultsWithCustomer;
    }

    res.status(httpStatus.OK).send({
      success: true,
      message: 'Challans fetched successfully',
      data: challans[0],
    });
  }),

  /**
   * Get recent challans (last 7 days)
   */
  getRecentChallans: catchAsync(async (req, res) => {
    const { page = 1, limit = 10, search, status } = req.query;

    const sevenDaysAgo = new Date();
    sevenDaysAgo.setDate(sevenDaysAgo.getDate() - 7);
    sevenDaysAgo.setHours(0, 0, 0, 0);

    const matchStage = {
      deletedAt: null,
      createdAt: { $gte: sevenDaysAgo }
    };

    if (search) {
      matchStage.challanNumber = { $regex: search, $options: 'i' };
    }

    if (status && status !== 'All') {
      matchStage.status = status;
    }

    const pipeline = [
      {
        $match: matchStage
      },

      // Unwind products for processing
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
          'products.productName': { $ifNull: ['$products.productName', ''] },
          'products.seriesName': { $ifNull: ['$products.seriesName', ''] },
          'products.dimension': { $ifNull: ['$products.dimension', ''] },
          'products.designCode': { $ifNull: ['$products.designCode', ''] },
          'products.totalBox': { $ifNull: ['$products.totalBox', 0] },
          'products.totalSquareFeet': { $ifNull: ['$products.totalSquareFeet', 0] },
          'products.boxPerPiece': { $ifNull: ['$products.boxPerPiece', 0] },
          'products.unitPerPrice': { $ifNull: ['$products.unitPerPrice', 0] },
          'products.unit': { $ifNull: ['$products.unit', 'Sq.Feet/Price'] },
          'products.totalAmount': { $ifNull: ['$products.totalAmount', 0] },
          'products.selectionId': { $ifNull: ['$products.selectionId', ''] },
          'products.selectionName': { $ifNull: ['$products.selectionName', 'N/A'] },
          'products.selectionProductId': { $ifNull: ['$products.selectionProductId', ''] },
          'products.variantId': { $ifNull: ['$products.variantId', ''] },
          'products.variantName': { $ifNull: ['$products.variantName', ''] },
          'products.seriesId': { $ifNull: ['$products.seriesId', ''] },
        }
      },

      // Group back to restore original structure
      {
        $group: {
          _id: '$_id',
          challanNumber: { $first: '$challanNumber' },
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

    // Populate customer details from V1
    if (challans[0] && challans[0].results && challans[0].results.length > 0) {
      const resultsWithCustomer = await Promise.all(challans[0].results.map(async (challan) => {
        let customer = null;
        if (challan.customerId) {
          try {
            customer = await v1Service.getCustomer(challan.customerId.toString(), req.headers.authorization);
          } catch (error) {
            console.warn(`Could not fetch customer ${challan.customerId} from v1:`, error.message);
          }
        }
        return {
          ...challan,
          customer: customer
        };
      }));
      challans[0].results = resultsWithCustomer;
    }

    res.status(httpStatus.OK).send({
      success: true,
      message: 'Recent challans fetched successfully',
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

    // Delete transporter history if transporter was associated with challan
    if (challan.transporterId && challan.transporterAmount && challan.transporterAmount > 0) {
      try {
        await v1Service.deleteTransporterHistoryByChallan({
          transporterId: challan.transporterId,
          challanId: challan._id.toString(),
          challanNumber: challan.challanNumber
        }, req.headers.authorization);
      } catch (historyError) {
        console.warn('Could not delete transporter history in v1:', historyError.message);
        // Don't fail the challan deletion if history deletion fails
      }
    }

    res.status(httpStatus.OK).send({
      success: true,
      message: 'Challan deleted successfully',
      data: deletedChallan,
    });
  }),

  /**
   * Download challan
   */
  downloadChallan: catchAsync(async (req, res) => {
    const { id } = req.params;
    const result = await challanService.getChallanWithProducts(id, req.headers.authorization);

    if (!result.success) {
      throw new ApiError(httpStatus.NOT_FOUND, result.message);
    }

    res.status(httpStatus.OK).send({
      success: true,
      message: 'Challan download details fetched successfully',
      data: result.data,
    });
  }),

  /**
   * Get customers with challan count
   */
  getCustomersWithChallans: catchAsync(async (req, res) => {
    const { search } = req.query;
    const token = req.headers.authorization;

    const pipeline = [
      { $match: { deletedAt: null } },
      {
        $group: {
          _id: '$customerId',
          challanCount: { $sum: 1 },
          lastChallanDate: { $max: '$createdAt' },
          totalAmount: { $sum: '$totalAmount' },
          totalProducts: { $sum: { $size: { $ifNull: ['$products', []] } } },
          totalSelection: { $sum: { $size: { $ifNull: ['$selectionIds', []] } } }
        }
      },
      { $sort: { lastChallanDate: -1 } }
    ];

    const aggregatedCustomers = await challanService.aggregate(pipeline);

    if (!aggregatedCustomers || aggregatedCustomers.length === 0) {
      return res.status(httpStatus.OK).send({
        success: true,
        message: 'No customers with challans found',
        data: [],
      });
    }

    // Fetch customer details from V1
    const customersWithDetails = [];
    await Promise.all(aggregatedCustomers.map(async (item) => {
      try {
        if (!item._id) return;
        const customer = await v1Service.getCustomer(item._id.toString(), token);

        // Filter by search if provided
        if (search) {
          const searchLower = search.toLowerCase();
          const fullName = `${customer?.first_name || ''} ${customer?.last_name || ''}`.toLowerCase();
          const phone = customer?.phone || '';

          if (!fullName.includes(searchLower) && !phone.includes(searchLower)) {
            return;
          }
        }

        if (customer) {
          customersWithDetails.push({
            ...customer,
            challanCount: item.challanCount,
            totalAmount: item.totalAmount,
            totalProducts: item.totalProducts,
            totalSelection: item.totalSelection,
            lastChallanDate: item.lastChallanDate
          });
        }
      } catch (err) {
        console.warn(`Failed to fetch customer ${item._id} from V1`);
      }
    }));

    customersWithDetails.sort((a, b) => new Date(b.lastChallanDate) - new Date(a.lastChallanDate));

    res.status(httpStatus.OK).send({
      success: true,
      message: 'Customers with challans fetched successfully',
      data: customersWithDetails,
    });
  }),

  /**
   * Get challans for specific customer
   */
  getCustomerChallans: catchAsync(async (req, res) => {
    const { customerId } = req.params;
    req.query.customerId = customerId;
    req.query.limit = req.query.limit || 100; // Default to a larger limit for dropdowns
    return module.exports.getAllChallans(req, res);
  }),
};