const httpStatus = require('http-status');
const ApiError = require('../../utils/apiError');
const catchAsync = require('../../utils/catchAsync');
const { purchaseOrderService } = require('../../services/commonServices');
const { paginationQuery } = require('../../helper/mongoose.helper');
const mongoose = require('mongoose');
const v1Service = require('../../services/v1Service');

module.exports = {
  /**
   * Create a new purchase order
   */
  createPurchaseOrder: catchAsync(async (req, res) => {
    try {
      const { items, vendor, status, remarks, challan, challanId, orderId } = req.body;
      const token = req.headers.authorization;

      // Validate vendor exists in v1
      const vendorData = await v1Service.getVendor(vendor, token);
      if (!vendorData) {
        throw new ApiError(httpStatus.NOT_FOUND, 'Vendor not found (in V1)');
      }

      // Check for duplicate Order ID if provided by frontend
      if (orderId) {
        const existingOrder = await purchaseOrderService.get({
          orderId,
          deletedAt: null
        });

        if (existingOrder) {
          return res.status(httpStatus.BAD_REQUEST).send({
            success: false,
            message: 'Order ID already exists',
            errors: [{
              field: 'orderId',
              message: 'Order ID already exists',
              code: 'DUPLICATE_ORDER_ID'
            }]
          });
        }
      }

      // Check for duplicate products within the same order
      // Allow same product if they have different selection IDs
      if (items && Array.isArray(items)) {
        const duplicateCheck = items.map((item, index) => ({
          index,
          productVariantId: item.productVariantId?.toString(),
          selectionId: item.selectionId?.toString()
        }));

        const duplicates = duplicateCheck.filter((item, index) => {
          // Check for duplicates based on both productVariantId and selectionId
          return duplicateCheck.findIndex(
            checkItem => checkItem.productVariantId === item.productVariantId &&
              checkItem.selectionId === item.selectionId &&
              checkItem.index !== index
          ) !== -1;
        });

        if (duplicates.length > 0) {
          return res.status(httpStatus.BAD_REQUEST).send({
            success: false,
            message: 'Duplicate products with same selection found in the order',
            errors: [{
              field: 'items',
              message: `Duplicate products found`,
              code: 'DUPLICATE_PRODUCTS'
            }]
          });
        }
      }

      // Debug log for challan validation (matching V1)
      if (challan && challan.trim() !== '') {
        console.log('🔍 DEBUG (CREATE): Challan provided, but validation skipped');
      } else {
        console.log('🔍 DEBUG (CREATE): No challan provided, skipping validation');
      }

      const session = await mongoose.startSession();
      session.startTransaction();

      try {
        // Generate Order ID if not provided
        const finalOrderId = orderId || await purchaseOrderService.generatePurchaseOrderId(session);

        let totalAmount = 0;
        let totalQuantity = 0;
        // let totalSquareFeet = 0;
        // let totalBox = 0;

        const enrichedItems = [];

        for (const item of items) {
          const mrp = parseFloat(item.mrp);
          const discount = parseFloat(item.discount) || 0;
          const quantity = parseFloat(item.quantity);

          // Calculate total based on unit
          const discountAmount = (discount / 100) * mrp;
          const price = mrp - discountAmount;
          const total = price * quantity;

          totalAmount += total;
          totalQuantity += quantity

          // Try to fetch product details from v1 for enrichment
          let productDetails = {
            itemCode: item.itemCode || '',
            itemName: item.itemName || '',
            productName: item.productName || '',
            variantName: item.variantName || item.variant || '',
            variantId: item.variantId || '',
            seriesId: item.seriesId || '',
            seriesName: item.seriesName || item.series || '',
            seriesDimension: item.seriesDimension || '',
            designCode: item.designCode || '',
          };

          if (item.productVariantId && token) {
            try {
              const v1Product = await v1Service.getSeriesProduct(item.productVariantId.toString(), token);
              if (v1Product) {
                productDetails = {
                  itemCode: v1Product.item_code || '',
                  itemName: v1Product.product_name || '',
                  productName: v1Product.product_name || '',
                  variantName: v1Product.variant_name || '',
                  seriesName: v1Product.series_name || '',
                  designCode: v1Product.design_code || '',
                };
              } else {
                console.warn(`Series product not found in V1: ${item.productVariantId} - product may be deleted or inactive`);
                // Use existing item data as fallback
                productDetails = {
                  itemCode: item.itemCode || '',
                  itemName: item.itemName || item.productName || '',
                  productName: item.productName || '',
                  variantName: item.variantName || '',
                  seriesName: item.seriesName || '',
                  designCode: item.designCode || '',
                };
              }
            } catch (error) {
              console.warn(`Could not fetch product details from v1 for ${item.productVariantId}:`, error.message);
              // Use existing item data as fallback
              productDetails = {
                itemCode: item.itemCode || '',
                itemName: item.itemName || item.productName || 'Unknown Product',
                productName: item.productName || 'Unknown Product',
                variantName: item.variantName || '',
                seriesName: item.seriesName || '',
                designCode: item.designCode || '',
              };
            }
          }

          enrichedItems.push({
            productVariantId: item.productVariantId,
            seriesProductId: item.seriesProductId,
            selectionProductId: item.selectionProductId,
            selectionId: item.selectionId,
            itemDetail: item.itemDetail,
            itemCode: productDetails.itemCode,
            itemName: productDetails.itemName,
            productName: productDetails.productName,
            variantName: productDetails.variantName,
            seriesName: productDetails.seriesName,
            designCode: productDetails.designCode,
            mrp: item.mrp,
            discount: discount,
            quantity: quantity,
            price: price.toFixed(2),
            total: total.toFixed(2),
            challanId: item.challanId && item.challanId.trim() !== '' ? item.challanId : undefined,
          });
        }

        const purchaseOrder = await purchaseOrderService.create({
          orderId: finalOrderId,
          vendor,
          items: enrichedItems,
          totalAmount,
          totalQuantity,
          status: status || 'Pending',
          remarks,
          challan,
          challanId,
          createdBy: req.user._id,
        }, { session });

        await session.commitTransaction();

        res.status(httpStatus.CREATED).send({
          success: true,
          message: 'Purchase order created successfully',
          data: purchaseOrder,
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
   * Get all purchase orders with pagination
   */
  getAllPurchaseOrders: catchAsync(async (req, res) => {
    const { page = 1, limit = 10, search, status, vendor } = req.query;
    const token = req.headers.authorization;

    const filter = {
      deletedAt: null,
    };

    if (search) {
      filter.orderId = { $regex: search, $options: 'i' };
    }

    if (status && status !== 'All') {
      filter.status = status;
    }

    if (vendor) {
      filter.vendor = vendor;
    }

    // Use paginate for easier count and page management
    const options = {
      page: parseInt(page),
      limit: parseInt(limit),
      sort: { createdAt: -1 },
    };

    const purchaseOrdersResult = await purchaseOrderService.getAll(filter, options);

    if (!purchaseOrdersResult || purchaseOrdersResult.results.length === 0) {
      return res.status(httpStatus.OK).send({
        success: true,
        message: 'Purchase orders fetched successfully',
        data: {
          results: [],
          page: purchaseOrdersResult?.page || 1,
          limit: purchaseOrdersResult?.limit || 10,
          totalPages: purchaseOrdersResult?.totalPages || 0,
          totalResults: purchaseOrdersResult?.totalResults || 0,
        },
      });
    }

    const purchaseOrders = purchaseOrdersResult.results;

    // Return stored enriched data directly (no additional enrichment needed)
    const enrichedResults = purchaseOrders.map(purchaseOrder => {
      return purchaseOrder.toObject(); // Return enriched data as stored in database
    });

    res.status(httpStatus.OK).send({
      success: true,
      message: 'Purchase orders fetched successfully',
      data: {
        results: enrichedResults,
        page: purchaseOrdersResult.page,
        limit: purchaseOrdersResult.limit,
        totalPages: purchaseOrdersResult.totalPages,
        totalResults: purchaseOrdersResult.totalResults,
      },
    });
  }),

  /**
   * Get single purchase order by ID
   */
  getPurchaseOrder: catchAsync(async (req, res) => {
    const { id } = req.params;

    // Get purchase order with enriched data from database
    const purchaseOrder = await purchaseOrderService.get({ _id: id, deletedAt: null });
    
    if (!purchaseOrder) {
      throw new ApiError(httpStatus.NOT_FOUND, 'Purchase order not found');
    }

    res.status(httpStatus.OK).send({
      success: true,
      message: 'Purchase order details fetched successfully',
      data: purchaseOrder, // Return enriched data stored in database
    });
  }),

  /**
   * Update purchase order
   */
  updatePurchaseOrder: catchAsync(async (req, res) => {
    const { id } = req.params;
    const { items, vendor, status, remarks, challan, challanId, orderId } = req.body;
    const token = req.headers.authorization;

    const purchaseOrder = await purchaseOrderService.get({ _id: id, deletedAt: null });
    if (!purchaseOrder) {
      throw new ApiError(httpStatus.NOT_FOUND, 'Purchase order not found');
    }

    // Validate vendor exists in v1 if provided
    if (vendor) {
      const vendorData = await v1Service.getVendor(vendor, token);
      if (!vendorData) {
        throw new ApiError(httpStatus.NOT_FOUND, 'Vendor not found (in V1)');
      }
      // Store vendor details in purchase order for PWA display
      purchaseOrder.vendorDetails = vendorData;
    }

    // Check for duplicate Order ID if provided and different from current
    if (orderId && orderId !== purchaseOrder.orderId) {
      const existingOrder = await purchaseOrderService.get({
        orderId,
        deletedAt: null,
        _id: { $ne: id } // Exclude current order
      });

      if (existingOrder) {
        return res.status(httpStatus.BAD_REQUEST).send({
          success: false,
          message: 'Order ID already exists in another purchase',
          errors: [{
            field: 'orderId',
            message: 'Order ID already exists in another purchase',
            code: 'DUPLICATE_ORDER_ID'
          }]
        });
      }
    }

    // Check for duplicate products within the same order if items are provided
    if (items && Array.isArray(items)) {
      const duplicateCheck = items.map((item, index) => ({
        index,
        productVariantId: item.productVariantId?.toString(),
        selectionId: item.selectionId?.toString()
      }));

      const duplicates = duplicateCheck.filter((item, index) => {
        return duplicateCheck.findIndex(
          checkItem => checkItem.productVariantId === item.productVariantId &&
            checkItem.selectionId === item.selectionId &&
            checkItem.index !== index
        ) !== -1;
      });

      if (duplicates.length > 0) {
        return res.status(httpStatus.BAD_REQUEST).send({
          success: false,
          message: 'Duplicate products with same selection found in order',
          errors: [{
            field: 'items',
            message: `Duplicate products found`,
            code: 'DUPLICATE_PRODUCTS'
          }]
        });
      }
    }

    // Debug log for challan validation (matching V1)
    if (challan && challan.trim() !== '') {
      console.log('🔍 DEBUG (UPDATE): Challan provided, but validation skipped');
    } else {
      console.log('🔍 DEBUG (UPDATE): No challan provided, skipping validation');
    }

    // Update purchase order logic
    if (items && Array.isArray(items)) {
      let totalAmount = 0;
      let totalQuantity = 0;
      const enrichedItems = [];

      for (const item of items) {
        const mrp = parseFloat(item.mrp);
        const discount = parseFloat(item.discount) || 0;
        const quantity = parseFloat(item.quantity);

        const discountAmount = (discount / 100) * mrp;
        const price = mrp - discountAmount;
        const total = price * quantity;

        totalAmount += total;
        totalQuantity += quantity;

        // Store complete series details from frontend
        let productDetails = {
          itemCode: item.itemCode || '',
          itemName: item.itemName || '',
          productName: item.productName || '',
          variantName: item.variantName || '',
          variantId: item.variantId || '',
          seriesId: item.seriesId || '',
          seriesName: item.seriesName || '',
          seriesDimension: item.seriesDimension || '',
          designCode: item.designCode || '',
        };

        // If productVariantId provided, fetch additional details from v1
        if (item.productVariantId && token) {
          try {
            const v1Product = await v1Service.getSeriesProduct(item.productVariantId.toString(), token);
            if (v1Product) {
              productDetails = {
                itemCode: v1Product.item_code || '',
                itemName: v1Product.product_name || '',
                productName: v1Product.product_name || '',
                variantName: v1Product.variant_name || '',
                variantId: v1Product._id?.toString() || '',
                seriesId: v1Product.series?._id?.toString() || '',
                seriesName: v1Product.series?.series_name || '',
                seriesDimension: v1Product.series?.dimension || '',
                designCode: v1Product.design_code || '',
                // Store complete v1 product data for PWA display
                product_variant: v1Product,
                series_product: v1Product.series_product,
                series: v1Product.series,
                product: v1Product.product,
              };
            } else {
              console.warn(`Series product not found in V1: ${item.productVariantId} - product may be deleted or inactive`);
            }
          } catch (error) {
            console.warn(`Could not fetch product details from v1 for ${item.productVariantId}:`, error.message);
          }
        }

        enrichedItems.push({
          productVariantId: item.productVariantId,
          seriesProductId: item.seriesProductId,
          selectionProductId: item.selectionProductId,
          selectionId: item.selectionId,
          itemDetail: item.itemDetail,
          itemCode: productDetails.itemCode,
          itemName: productDetails.itemName,
          productName: productDetails.productName,
          variantName: productDetails.variantName,
          seriesName: productDetails.seriesName,
          designCode: productDetails.designCode,
          mrp: item.mrp,
          discount: discount,
          quantity: quantity,
          price: price.toFixed(2),
          total: total.toFixed(2),
          challanId: item.challanId && item.challanId.trim() !== '' ? item.challanId : undefined,
          // Store complete v1 enriched data for PWA display
          product_variant: productDetails.product_variant,
          series_product: productDetails.series_product,
          series: productDetails.series,
          product: productDetails.product,
        });
      }

      purchaseOrder.items = enrichedItems;
      purchaseOrder.totalAmount = totalAmount;
      purchaseOrder.totalQuantity = totalQuantity;
    }

    if (vendor !== undefined) purchaseOrder.vendor = vendor;
    if (orderId !== undefined) purchaseOrder.orderId = orderId;
    if (status !== undefined) purchaseOrder.status = status;
    if (remarks !== undefined) purchaseOrder.remarks = remarks;
    if (challan !== undefined) purchaseOrder.challan = challan;
    if (challanId !== undefined) purchaseOrder.challanId = challanId;

    // Update purchase order using service
    const updatedPurchaseOrder = await purchaseOrderService.update(
      { _id: id, deletedAt: null },
      {
        orderId: purchaseOrder.orderId,
        vendor: purchaseOrder.vendor,
        items: purchaseOrder.items,
        totalAmount: purchaseOrder.totalAmount,
        totalQuantity: purchaseOrder.totalQuantity,
        status: purchaseOrder.status,
        remarks: purchaseOrder.remarks,
        challan: purchaseOrder.challan,
        challanId: purchaseOrder.challanId,
        updatedBy: req.user._id,
      }
    );

    console.log('🔍 Saved Purchase Order Items:', JSON.stringify(purchaseOrder.items, null, 2));

    res.status(httpStatus.OK).send({
      success: true,
      message: 'Purchase order updated successfully',
      data: updatedPurchaseOrder,
    });
  }),

  /**
   * Delete purchase order
   */
  deletePurchaseOrder: catchAsync(async (req, res) => {
    const { id } = req.params;

    const purchaseOrder = await purchaseOrderService.get({ _id: id, deletedAt: null });
    if (!purchaseOrder) {
      throw new ApiError(httpStatus.NOT_FOUND, 'Purchase order not found');
    }

    const deletedPurchaseOrder = await purchaseOrderService.delete(
      { _id: id, deletedAt: null },
      { deletedAt: new Date() }
    );

    res.status(httpStatus.OK).send({
      success: true,
      message: 'Purchase order deleted successfully',
      data: deletedPurchaseOrder,
    });
  }),
};