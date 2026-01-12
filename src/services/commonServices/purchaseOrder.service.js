const { PurchaseOrder } = require('../../models/index');
const mongoose = require('mongoose');

/**
 * Generate next purchase order ID
 * @param {Object} session - Mongoose session for transaction
 * @returns {Promise<string>}
 */
exports.generatePurchaseOrderId = async (session) => {
  try {
    // Get the highest existing order ID
    const lastOrder = await PurchaseOrder.findOne({}, { orderId: 1 })
      .sort({ createdAt: -1 })
      .session(session || null);
    
    let sequence = 1;
    if (lastOrder && lastOrder.orderId) {
      // Extract sequence number from existing order ID (format: PO-TG-XXXXXX)
      const match = lastOrder.orderId.match(/PO-TG-(\d+)/);
      if (match) {
        sequence = parseInt(match[1]) + 1;
      }
    }
    
    const orderId = `PO-TG-${String(sequence).padStart(6, '0')}`;
    return orderId;
  } catch (error) {
    console.error('❌ Error generating purchase order ID:', error);
    throw new Error(`Failed to generate purchase order ID: ${error.message}`);
  }
};

/**
 * Create a Purchase Order
 * @param {Object} payload
 * @returns {Promise<PurchaseOrder>}
 */
exports.create = async (payload) => {
  return PurchaseOrder.create(payload);
};

/**
 * Update a Purchase Order
 * @param {Object} filter - Mongoose filter
 * @param {Object} update - Mongoose update object
 * @returns {Promise<PurchaseOrder>}
 */
exports.update = async (filter, update) => {
  return await PurchaseOrder.findOneAndUpdate(filter, update, {
    new: true,
  });
};

/**
 * Get a Purchase Order
 * @param {Object} filter - Mongoose filter
 */
exports.get = async (filter) => {
  return await PurchaseOrder.findOne(filter);
};

/**
 * Get a Purchase Order with vendor and product details
 * @param {string} identifier - Purchase Order ID or Order Number
 * @param {string} token - Authorization token
 */
exports.getPurchaseOrderWithProducts = async (identifier, token) => {
  const mongoose = require('mongoose');
  const v1Service = require('../v1Service');

  const isObjectId = mongoose.Types.ObjectId.isValid(identifier);
  const filter = isObjectId ? { _id: new mongoose.Types.ObjectId(identifier) } : { orderId: identifier };

  // Fetch the purchase order from v2 database
  const purchaseOrder = await PurchaseOrder.findOne({ ...filter, deletedAt: null });

  if (!purchaseOrder) {
    return { success: false, message: 'Purchase order not found' };
  }

  try {
    // Fetch vendor details from v1
    let vendor = null;
    if (purchaseOrder.vendor) {
      try {
        vendor = await v1Service.getVendor(purchaseOrder.vendor.toString(), token);
      } catch (error) {
        console.warn('Could not fetch vendor from v1:', error.message);
      }
    }

    // Use products from the purchase order with enriched details
    const productsWithDetails = [];

    if (purchaseOrder.items && purchaseOrder.items.length > 0) {
      for (const item of purchaseOrder.items) {
        // Try to fetch product details from v1 if we have the product variant ID
        let productDetails = {
          itemCode: item.itemCode || '',
          itemName: item.itemName || item.productName || 'Unknown Product',
          productName: item.productName || 'Unknown Product',
          variantName: item.variantName || '',
          seriesName: item.seriesName || '',
          designCode: item.designCode || '',
        };
console.log(item,'item')
        // If we have seriesProductId, try to get more details from v1
        if ((item.seriesProductId) && token) {
          try {
            const v1Product = await v1Service.getSeriesProduct((item.seriesProductId).toString(), token);
            if (v1Product) {
              productDetails = {
                ...productDetails,
                productName: v1Product.product_name || productDetails.productName,
                variantName: v1Product.variant_name || productDetails.variantName,
                seriesName: v1Product.series_name || productDetails.seriesName,
                designCode: v1Product.design_code || productDetails.designCode,
              };
            } else {
              console.warn(`Series product not found in V1: ${item.seriesProductId} - using fallback data`);
            }
          } catch (error) {
            console.warn(`Could not fetch product details from v1 for ${item.seriesProductId}:`, error.message);
          }
        }

        const productWithDetails = {
          _id: item._id,
          productVariantId: item.productVariantId,
          seriesProductId: item.seriesProductId,
          selectionProductId: item.selectionProductId,
          selectionId: item.selectionId,
          itemCode: item.itemCode,
          itemName: item.itemName,
          
          // Pricing & Quantity
          quantity: item.quantity,
          unitPerPrice: item.unitPerPrice,
          totalAmount: item.totalAmount,
          unit: item.unit,
          totalBox: item.totalBox,
          totalSquareFeet: item.totalSquareFeet,
          discount: item.discount,
          mrp: item.mrp,
          price: item.price,
          total: item.total,
          
          // Product details
          ...productDetails,
          
          // Metadata
          isProductDeleted: item.isProductDeleted || false,
          challanId: item.challanId,
        };

        productsWithDetails.push(productWithDetails);
      }
    }

    // Build the final response
    const result = {
      _id: purchaseOrder._id,
      orderId: purchaseOrder.orderId,
      vendor: vendor || null,
      items: productsWithDetails,
      totalAmount: purchaseOrder.totalAmount,
      totalQuantity: purchaseOrder.totalQuantity,
      status: purchaseOrder.status,
      challan: purchaseOrder.challan,
      challanId: purchaseOrder.challanId,
      remarks: purchaseOrder.remarks,
      createdBy: purchaseOrder.createdBy,
      createdAt: purchaseOrder.createdAt,
      updatedAt: purchaseOrder.updatedAt,
    };

    return {
      success: true,
      data: result
    };
  } catch (error) {
    console.error('Error fetching purchase order details:', error);
    return {
      success: false,
      message: `Failed to fetch purchase order details: ${error.message}`
    };
  }
};

/**
 * Get All Purchase Orders
 * @param {Object} filter - Mongoose filter
 * @param {Object} options - Mongoose query options
 */
exports.getAll = async (filter, options = {}) => {
  return await PurchaseOrder.paginate(filter, options);
};

/**
 * Delete a Purchase Order (soft delete)
 * @param {Object} filter - Mongoose filter
 * @param {Object} update - Mongoose update object
 * @returns {Promise<PurchaseOrder>}
 */
exports.delete = async (filter, update) => {
  return await PurchaseOrder.findOneAndUpdate(filter, update, { new: true });
};

/**
 * Hard Delete a Purchase Order
 * @param {Object} filter - Mongoose filter
 * @returns {Promise<PurchaseOrder>}
 */
exports.hardDelete = async (filter) => {
  return await PurchaseOrder.findOneAndDelete(filter);
};

/**
 * Aggregate Purchase Order
 * @param {Array} pipeline - Mongoose aggregation pipeline
 */
exports.aggregate = async (pipeline) => {
  return await PurchaseOrder.aggregate(pipeline);
};

/**
 * Count Purchase Orders
 * @param {Object} filter - Mongoose filter
 */
exports.count = async (filter) => {
  return await PurchaseOrder.countDocuments(filter);
};

/**
 * Update Many Purchase Orders
 * @param {Object} filter - Mongoose filter
 * @param {Object} update - Mongoose update object
 */
exports.bulkUpdate = async (filter, update) => {
  return await PurchaseOrder.updateMany(filter, update);
};

/**
 * Create bulk Purchase Orders
 * @param {Array} payloads - Array of objects to be created
 * @returns {Promise<Array<PurchaseOrder>>}
 */
exports.insertMany = async (payloads) => {
  return await PurchaseOrder.insertMany(payloads);
};
