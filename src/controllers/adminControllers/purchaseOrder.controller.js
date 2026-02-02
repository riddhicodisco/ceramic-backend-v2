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

      if (items && Array.isArray(items)) {
        const duplicateCheck = items.map((item, index) => ({
          index,
          productVariantId: item.productVariantId?.toString(),
          selectionId: item.selectionId?.toString()
        }));

        const duplicates = duplicateCheck.filter((item, index) => {
          if (!item.productVariantId && !item.selectionId) return false;

          return duplicateCheck.findIndex(
            checkItem => (
              (item.productVariantId && checkItem.productVariantId === item.productVariantId) ||
              (item.selectionId && checkItem.selectionId === item.selectionId)
            ) && checkItem.index !== index
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

      const session = await mongoose.startSession();
      session.startTransaction();

      try {
        const finalOrderId = orderId || await purchaseOrderService.generatePurchaseOrderId(session);

        let totalAmount = 0;
        let totalQuantity = 0;
        // let totalSquareFeet = 0;
        // let totalBox = 0;

        const enrichedItems = [];

        for (const item of items) {
          const mrp = parseFloat(item.mrp) || 0;
          const unitPerPrice = parseFloat(item.unitPerPrice) || mrp;
          const discount = parseFloat(item.discount) || 0;
          const quantity = parseFloat(item.quantity) || 0;
          const totalBox = parseFloat(item.totalBox) || 0;
          const boxPerPiece = parseFloat(item.boxPerPiece) || 0;
          const totalSquareFeet = parseFloat(item.totalSquareFeet) || 0;
          const unit = item.unit || 'Sq.Feet/Price';

          // Calculate total based on unit
          let itemTotal = 0;
          if (unit === 'Piece/Price') {
            itemTotal = totalBox * boxPerPiece * unitPerPrice;
          } else {
            itemTotal = (totalSquareFeet || quantity) * unitPerPrice;
          }

          const discountAmount = (discount / 100) * itemTotal;
          const total = Number((itemTotal - discountAmount).toFixed(2));

          totalAmount = Number((totalAmount + total).toFixed(2));
          totalQuantity += (unit === 'Piece/Price' ? totalBox * boxPerPiece : (totalSquareFeet || quantity));

          // Try to fetch product details from v1 for enrichment
          let productDetails = {
            itemCode: item.itemCode || '',
            itemName: item.itemName || '',
            productName: item.productName || '',
            variantName: item.variantName || item.variant || '',
            variantId: item.variantId || '',
            seriesId: item.seriesId || '',
            seriesName: item.seriesName || item.series || '',
            dimension: item.dimension || '',
            designCode: item.designCode || '',
          };

          if (item.productVariantId && token) {
            try {
              const v1Product = await v1Service.getSeriesProduct(item.productVariantId.toString(), token);
              if (v1Product) {
                productDetails = {
                  ...productDetails,
                  itemCode: productDetails.itemCode || v1Product.item_code,
                  itemName: productDetails.itemName || v1Product.product_name,
                  productName: productDetails.productName || v1Product.product_name,
                  variantName: productDetails.variantName || v1Product.variant_name,
                  variantId: productDetails.variantId || v1Product._id?.toString(),
                  dimension: productDetails.dimension || v1Product.dimension || "",
                  seriesId: productDetails.seriesId || v1Product.series?._id?.toString(),
                  seriesName: productDetails.seriesName || v1Product.series?.series_name,
                  designCode: productDetails.designCode || v1Product.design_code,
                  purchaseSqFtPerPiece: v1Product.purchaseSqFtPerPiece || 0,
                  sellSqFtPerPiece: v1Product.sellSqFtPerPiece || 0,
                  piecesPerBox: v1Product.piecesPerBox || 0,
                };
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
            dimension: productDetails.dimension,
            variantId: productDetails.variantId,
            seriesId: productDetails.seriesId,
            productId: productDetails.productId || item.productId,
            // quantity: (unit === 'Piece/Price' ? totalBox * boxPerPiece : (totalSquareFeet || quantity)),
            // mrp: mrp,
            unitPerPrice: unitPerPrice,
            discount: discount,
            price: unitPerPrice - (discount / 100) * unitPerPrice,
            totalAmount: total,
            totalSquareFeet: totalSquareFeet || 0,
            totalBox: totalBox,
            boxPerPiece: boxPerPiece,
            unit: unit,
            total: total,
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

    // If user is accountant, only show last 2 minutes records for testing
    if (req.user.role.role === 'Accountant') {
      const sevenDaysAgo = new Date();
      sevenDaysAgo.setDate(sevenDaysAgo.getDate() - 7);
      sevenDaysAgo.setHours(0, 0, 0, 0); // Start of day
      filter.createdAt = { $gte: sevenDaysAgo };
    }

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

    // Populate vendor and creator details for each purchase order
    const enrichedResults = await Promise.all(purchaseOrders.map(async (purchaseOrder) => {
      const poObj = purchaseOrder.toObject();

      await Promise.all([
        (async () => {
          if (poObj.vendor) {
            try {
              const vendorData = await v1Service.getVendor(poObj.vendor.toString(), token);
              if (vendorData) {
                poObj.vendor = vendorData;
              }
            } catch (error) {
              console.warn(`Failed to fetch vendor for PO ${poObj.orderId}:`, error.message);
            }
          }
        })(),
        (async () => {
          if (poObj.createdBy) {
            try {
              const userData = await v1Service.getUser(poObj.createdBy.toString(), token);
              if (userData) {
                poObj.createdBy = userData;
              }
            } catch (error) {
              console.warn(`Failed to fetch creator for PO ${poObj.orderId}:`, error.message);
            }
          }
        })()
      ]);

      return poObj;
    }));

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

    const purchaseOrder = await purchaseOrderService.get({ _id: id, deletedAt: null });

    if (!purchaseOrder) {
      throw new ApiError(httpStatus.NOT_FOUND, 'Purchase order not found');
    }

    const responseData = purchaseOrder.toObject();
    const token = req.headers.authorization;

    await Promise.all([
      (async () => {
        if (responseData.vendor) {
          try {
            const vendorData = await v1Service.getVendor(responseData.vendor.toString(), token);
            if (vendorData) {
              responseData.vendor = vendorData;
              responseData.vendorDetails = vendorData;
            }
          } catch (error) {
            console.warn('Failed to fetch vendor details from V1:', error.message);
          }
        }
      })(),
      (async () => {
        if (responseData.createdBy) {
          try {
            const userData = await v1Service.getUser(responseData.createdBy.toString(), token);
            if (userData) {
              responseData.createdBy = userData;
            }
          } catch (error) {
            console.warn('Failed to fetch creator details from V1:', error.message);
          }
        }
      })()
    ]);

    res.status(httpStatus.OK).send({
      success: true,
      message: 'Purchase order details fetched successfully',
      data: responseData,
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

    if (vendor) {
      const vendorData = await v1Service.getVendor(vendor, token);
      if (!vendorData) {
        throw new ApiError(httpStatus.NOT_FOUND, 'Vendor not found (in V1)');
      }
      purchaseOrder.vendorDetails = vendorData;
    }

    if (orderId && orderId !== purchaseOrder.orderId) {
      const existingOrder = await purchaseOrderService.get({
        orderId,
        deletedAt: null,
        _id: { $ne: id }
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

    if (items && Array.isArray(items)) {
      const duplicateCheck = items.map((item, index) => ({
        index,
        productVariantId: item.productVariantId?.toString(),
        selectionId: item.selectionId?.toString()
      }));

      const duplicates = duplicateCheck.filter((item, index) => {
        if (!item.productVariantId && !item.selectionId) return false;

        return duplicateCheck.findIndex(
          checkItem => (
            (item.productVariantId && checkItem.productVariantId === item.productVariantId) ||
            (item.selectionId && checkItem.selectionId === item.selectionId)
          ) && checkItem.index !== index
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

    if (items && Array.isArray(items)) {
      let totalAmount = 0;
      let totalQuantity = 0;
      const enrichedItems = [];

      for (const item of items) {
        const mrp = parseFloat(item.mrp) || 0;
        const unitPerPrice = parseFloat(item.unitPerPrice);
        const discount = parseFloat(item.discount) || 0;
        const totalBox = parseFloat(item.totalBox) || 0;
        const boxPerPiece = parseFloat(item.boxPerPiece) || 0;
        const totalSquareFeet = parseFloat(item.totalSquareFeet) || 0;
        const unit = item.unit || 'Sq.Feet/Price';

        let itemTotal = 0;
        if (unit === 'Piece/Price') {
          itemTotal = totalBox * boxPerPiece * unitPerPrice;
        } else {
          itemTotal = (totalSquareFeet || quantity) * unitPerPrice;
        }

        const discountAmount = (discount / 100) * itemTotal;
        const total = Number((itemTotal - discountAmount).toFixed(2));

        totalAmount = Number((totalAmount + total).toFixed(2));
        totalQuantity += (unit === 'Piece/Price' ? totalBox * boxPerPiece : (totalSquareFeet || quantity));

        let productDetails = {
          itemCode: item.itemCode || '',
          itemName: item.itemName || '',
          productName: item.productName || '',
          variantName: item.variantName || '',
          variantId: item.variantId || '',
          seriesId: item.seriesId || '',
          seriesName: item.seriesName || '',
          dimension: item.dimension || '',
          designCode: item.designCode || '',
        };

        if (item.productVariantId && token) {
          try {
            const v1Product = await v1Service.getSeriesProduct(item.productVariantId.toString(), token);
            if (v1Product) {
              productDetails = {
                ...productDetails,
                itemCode: productDetails.itemCode || v1Product.item_code,
                itemName: productDetails.itemName || v1Product.product_name,
                productName: productDetails.productName || v1Product.product_name,
                variantName: productDetails.variantName || v1Product.variant_name,
                variantId: productDetails.variantId || v1Product._id?.toString(),
                seriesId: productDetails.seriesId || v1Product.series?._id?.toString(),
                seriesName: productDetails.seriesName || v1Product.series?.series_name,
                dimension: productDetails.dimension || v1Product.dimension || "",
                designCode: productDetails.designCode || v1Product.design_code,
                purchaseSqFtPerPiece: v1Product.purchaseSqFtPerPiece || 0,
                sellSqFtPerPiece: v1Product.sellSqFtPerPiece || 0,
                piecesPerBox: v1Product.piecesPerBox || 0,
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
          variantId: productDetails.variantId,
          seriesId: productDetails.seriesId,
          productId: productDetails.productId || item.productId,
          dimension: productDetails.dimension,
          unitPerPrice: unitPerPrice,
          discount: discount,
          price: unitPerPrice - (discount / 100) * unitPerPrice,
          totalAmount: total,
          totalSquareFeet: totalSquareFeet,
          totalBox: totalBox,
          boxPerPiece: boxPerPiece,
          unit: unit,
          total: total,
          challanId: item.challanId && item.challanId.trim() !== '' ? item.challanId : undefined,
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