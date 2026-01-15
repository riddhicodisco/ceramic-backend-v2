const httpStatus = require('http-status');
const ApiError = require('../../utils/apiError');
const catchAsync = require('../../utils/catchAsync');
const { challanService } = require('../../services/commonServices');
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
      const token = req.headers.authorization;

      // Validate customer exists
      const customer = await v1Service.getCustomer(customerId, token);
      if (!customer) {
        throw new ApiError(httpStatus.NOT_FOUND, 'Customer not found (in V1)');
      }

      // Fetch all selections to get product details for persistence
      const selectionMap = {};
      for (const selectionId of selectionIds) {
        const selection = await v1Service.getSelection(selectionId, token);
        if (!selection) {
          throw new ApiError(httpStatus.BAD_REQUEST, `Selection ${selectionId} not found`);
        }
        if (selection.customerId.toString() !== customerId) {
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
        const selectionId = product.selectionId || selectionIds[0];
        const selection = selectionMap[selectionId];

        let metadata = {};
        if (selection) {
          const matchingProduct = selection.products?.find(p =>
            (p.product_variant_id && p.product_variant_id.toString() === product.productVariantId?.toString()) ||
            (p._id && p._id.toString() === product.selectionProductId?.toString())
          );

          if (matchingProduct) {
            metadata = {
              productName: product.productName || matchingProduct.product_name || '',
              seriesName: product.seriesName || (Array.isArray(matchingProduct.series_name) ? matchingProduct.series_name.join(', ') : (matchingProduct.series_name || '')),
              dimension: Array.isArray(matchingProduct.series_dimension) ? matchingProduct.series_dimension.join(', ') : (matchingProduct.series_dimension || ''),
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

        return {
          ...product,
          ...metadata,
          selectionId
        };
      });

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
          customerId,
          selectionIds,
          products: enrichedProducts,
          totalAmount,
          totalQuantity,
          totalSquareFeet,
          totalBox,
          status: status || 'Pending',
          remarks,
          createdBy: req.user._id,
        }, { session });

        await session.commitTransaction();

        // Update v1 flags
        try {
          await v1Service.updateMultipleProductChallanFlags(
            enrichedProducts,
            true,
            token,
            challan._id,
            challanNumber,
            challan.status
          );
        } catch (v1Error) {
          console.warn('Could not update product flags in v1:', v1Error.message);
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
    const { page = 1, limit = 10, search, status, customerId, selectionIds } = req.query;
    const token = req.headers.authorization;

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

    if (selectionIds) {
      filter.selectionIds = { $in: selectionIds.split(',').map(id => id.trim()) };
    }

    // Use paginate for easier count and page management
    const options = {
      page: parseInt(page),
      limit: parseInt(limit),
      sort: { createdAt: -1 },
    };

    const challansResult = await challanService.getAll(filter, options);

    if (!challansResult || challansResult.results.length === 0) {
      return res.status(httpStatus.OK).send({
        success: true,
        message: 'Challans fetched successfully',
        data: {
          results: [],
          page: challansResult?.page || 1,
          limit: challansResult?.limit || 10,
          totalPages: challansResult?.totalPages || 0,
          totalResults: challansResult?.totalResults || 0,
        },
      });
    }

    const challans = challansResult.results;

    // Collect all unique customer IDs and selection IDs
    const customerIds = new Set();
    const uniqueSelectionIds = new Set();

    challans.forEach(c => {
      if (c.customerId) customerIds.add(c.customerId.toString());
      if (c.selectionIds && Array.isArray(c.selectionIds)) {
        c.selectionIds.forEach(id => uniqueSelectionIds.add(id.toString()));
      }
    });

    // Fetch customers in parallel
    const customerMap = {};
    await Promise.all(Array.from(customerIds).map(async (id) => {
      try {
        const customer = await v1Service.getCustomer(id, token);
        if (customer) customerMap[id] = customer;
      } catch (err) {
        console.warn(`Failed to fetch customer ${id} from V1`);
      }
    }));

    // Fetch selections in parallel to get product names
    const selectionMap = {};
    await Promise.all(Array.from(uniqueSelectionIds).map(async (id) => {
      try {
        const selection = await v1Service.getSelection(id, token);
        if (selection) selectionMap[id] = selection;
      } catch (err) {
        console.warn(`Failed to fetch selection ${id} from V1`);
      }
    }));

    // Process and enrich challans
    const enrichedResults = challans.map(challan => {
      const plainChallan = challan.toObject();

      // Attach customer details
      plainChallan.customer = customerMap[plainChallan.customerId?.toString()] || null;

      // Attach product details
      if (plainChallan.products && Array.isArray(plainChallan.products)) {
        plainChallan.products = plainChallan.products.map(product => {
          // Find matching product in selections
          let productDetails = {};

          if (product.selectionId && selectionMap[product.selectionId.toString()]) {
            const selection = selectionMap[product.selectionId.toString()];
            const matchingProduct = selection.products?.find(p =>
              (p.product_variant_id && p.product_variant_id.toString() === product.productVariantId?.toString()) ||
              (p._id && p._id.toString() === product.selectionProductId?.toString())
            );

            if (matchingProduct) {
              productDetails = {
                productName: matchingProduct.product_name || '',
                seriesName: Array.isArray(matchingProduct.series_name) ? matchingProduct.series_name.join(', ') : (matchingProduct.series_name || ''),
                dimension: Array.isArray(matchingProduct.series_dimension) ? matchingProduct.series_dimension.join(', ') : (matchingProduct.series_dimension || ''),
                designCode: matchingProduct.design_code || '',
                seriesId: matchingProduct.series_id?.toString() || '',
                variantId: matchingProduct.variant_id?.toString() || '',
                variantName: matchingProduct.variant_name || '',
              };
            }
          }

          return {
            ...product,
            ...productDetails,
            productName: product.productName || productDetails.productName || 'Unknown Product',
            seriesName: product.seriesName || productDetails.seriesName || '',
            dimension: product.dimension || productDetails.dimension || '',
            designCode: product.designCode || productDetails.designCode || '',
            seriesId: product.seriesId || productDetails.seriesId || '',
            variantId: product.variantId || productDetails.variantId || '',
            variantName: product.variantName || productDetails.variantName || '',
          };
        });
      }

      return plainChallan;
    });

    res.status(httpStatus.OK).send({
      success: true,
      message: 'Challans fetched successfully',
      data: {
        results: enrichedResults,
        page: challansResult.page,
        limit: challansResult.limit,
        totalPages: challansResult.totalPages,
        totalResults: challansResult.totalResults,
      },
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

    if (products) {
      const token = req.headers.authorization;

      // Fetch all selections to get product details for persistence
      const selectionIds = [...new Set(products.map(p => p.selectionId || challan.selectionIds[0]?.toString()))];
      const selectionMap = {};

      for (const selectionId of selectionIds) {
        if (!selectionId) continue;
        const selection = await v1Service.getSelection(selectionId, token);
        if (selection) selectionMap[selectionId] = selection;
      }

      // Revert old flags
      try {
        if (challan.products && Array.isArray(challan.products)) {
          const oldProductsBySelection = {};
          challan.products.forEach(product => {
            const selectionId = product.selectionId;
            if (!oldProductsBySelection[selectionId]) {
              oldProductsBySelection[selectionId] = { selectionId, productVariantId: [] };
            }
            oldProductsBySelection[selectionId].productVariantId.push({
              p_id: product.selectionProductId || product._id,
              totalSquareFeet: product.totalSquareFeet || 0,
              isChallan: false,
              challanCreated: false,
            });
          });
          await v1Service.updateMultipleProductChallanFlags(Object.values(oldProductsBySelection), false, token);
        }
      } catch (v1Error) { }

      let totalAmount = 0;
      let totalQuantity = 0;
      let totalSquareFeet = 0;
      let totalBox = 0;

      const enrichedProducts = products.map(product => {
        const selectionId = product.selectionId || challan.selectionIds[0]?.toString();
        const selection = selectionMap[selectionId];

        let metadata = {};
        if (selection) {
          const matchingProduct = selection.products?.find(p =>
            (p.product_variant_id && p.product_variant_id.toString() === product.productVariantId?.toString()) ||
            (p._id && p._id.toString() === product.selectionProductId?.toString())
          );

          if (matchingProduct) {
            metadata = {
              productName: product.productName || matchingProduct.product_name || '',
              seriesName: product.seriesName || (Array.isArray(matchingProduct.series_name) ? matchingProduct.series_name.join(', ') : (matchingProduct.series_name || '')),
              dimension: Array.isArray(matchingProduct.series_dimension) ? matchingProduct.series_dimension.join(', ') : (matchingProduct.series_dimension || ''),
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

        return {
          ...product,
          ...metadata,
          selectionId
        };
      });

      challan.products = enrichedProducts;
      challan.totalAmount = totalAmount;
      challan.totalQuantity = totalQuantity;
      challan.totalSquareFeet = totalSquareFeet;
      challan.totalBox = totalBox;

      // Update new flags
      try {
        await v1Service.updateMultipleProductChallanFlags(enrichedProducts, true, token, id, challan.challanNumber, 'Created');
      } catch (v1Error) { }
    }

    if (customerId) {
      const customer = await v1Service.getCustomer(customerId, req.headers.authorization);
      if (!customer) throw new ApiError(httpStatus.NOT_FOUND, 'Customer not found (in V1)');
      challan.customerId = customerId;
    }

    if (selectionIds) challan.selectionIds = selectionIds;
    if (remarks !== undefined) challan.remarks = remarks;
    if (status) challan.status = status;
    if (purchaseOrderId) challan.purchaseOrderId = purchaseOrderId;
    if (deliveryNote !== undefined) challan.deliveryNote = deliveryNote;

    await challan.save();

    if (status && challan.products) {
      try {
        await v1Service.updateMultipleProductChallanFlags(challan.products, true, req.headers.authorization, challan._id, challan.challanNumber, status);
      } catch (v1Error) { }
    }

    res.status(httpStatus.OK).send({
      success: true,
      message: 'Challan updated successfully',
      data: challan,
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
   * Delete challan
   */
  deleteChallan: catchAsync(async (req, res) => {
    const { id } = req.params;
    const challan = await challanService.get({ _id: id, deletedAt: null });
    if (!challan) throw new ApiError(httpStatus.NOT_FOUND, 'Challan not found');

    const deletedChallan = await challanService.delete({ _id: id, deletedAt: null }, { deletedAt: new Date() });

    try {
      if (challan.products) {
        await v1Service.updateMultipleProductChallanFlags(challan.products, false, req.headers.authorization);
      }
    } catch (v1Error) { }

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
    const challan = await challanService.getChallanWithProducts(id, req.headers.authorization);
    if (!challan.success) throw new ApiError(httpStatus.NOT_FOUND, challan.message);

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
    if (!selectionIds) throw new ApiError(httpStatus.BAD_REQUEST, 'Selection IDs are required');

    const ids = selectionIds.split(',').map(id => new mongoose.Types.ObjectId(id.trim()));
    const result = await v1Service.getSelectionProductList(ids, req.headers.authorization);

    res.status(httpStatus.OK).send({
      success: true,
      message: 'Selection products fetched successfully',
      data: result,
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
          lastChallanDate: { $max: '$createdAt' }
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
            lastChallanDate: item.lastChallanDate
          });
        }
      } catch (err) {
        console.warn(`Failed to fetch customer ${item._id} from V1`);
      }
    }));

    // Sort again by last challan date (since Promise.all might have mixed order, 
    // though we are pushing to array, but checking search might filter out)
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
    const { page = 1, limit = 10, status } = req.query;

    // Reuse getAll logic by constructing query
    req.query.customerId = customerId;
    return module.exports.getAllChallans(req, res);
  }),
};

