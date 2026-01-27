const { Challan, ChallanCounter } = require('../../models/index');
const { generateChallanWithTransaction } = require('../../helper/challan.helper');

/**
 * Generate next challan number with transaction
 * @param {Object} session - Mongoose session for transaction
 * @returns {Promise<string>}
 */
exports.generateChallanWithTransaction = async (session) => {
  try {
    const sequence = await ChallanCounter.getNextSequence('challan', session);
    const challanNumber = `INV-${String(sequence).padStart(6, '0')}`;
    return challanNumber;
  } catch (error) {
    console.error('❌ Error generating challan number with transaction:', error);
    throw new Error(`Failed to generate challan number: ${error.message}`);
  }
};

/**
 * Generate next challan number (legacy function for backward compatibility)
 * @param {Object} session - Mongoose session for transaction
 * @returns {Promise<string>}
 */
exports.generateChallanNumber = async (session) => {
  return exports.generateChallanWithTransaction(session);
};

/**
 * Create a Challan
 * @param {Object} payload
 * @returns {Promise<Challan>}
 */
exports.create = async (payload) => {
  return Challan.create(payload);
};

/**
 * Update a Challan
 * @param {Object} filter - Mongoose filter
 * @param {Object} update - Mongoose update object
 * @returns {Promise<Challan>}
 */
exports.update = async (filter, update) => {
  return await Challan.findOneAndUpdate(filter, update, {
    new: true,
  });
};

/**
 * Get a Challan
 * @param {Object} filter - Mongoose filter
 */
exports.get = async (filter) => {
  return await Challan.findOne(filter);
};

/**
 * Get a Challan with products and related lookups
 * @param {string} identifier - Challan ID or Challan Number
 * @param {string} token - Authorization token
 */
exports.getChallanWithProducts = async (identifier, token) => {
  const mongoose = require('mongoose');
  const v1Service = require('../v1Service');

  const isObjectId = mongoose.Types.ObjectId.isValid(identifier);
  const filter = isObjectId ? { _id: new mongoose.Types.ObjectId(identifier) } : { challanNumber: identifier };

  // Fetch the challan from v2 database (contains only IDs and metadata)
  const challan = await Challan.findOne({ ...filter, deletedAt: null });

  if (!challan) {
    return { success: false, message: 'Challan not found' };
  }

  try {
    // Fetch customer details from v1
    let customer = null;
    if (challan.customerId) {
      try {
        customer = await v1Service.getCustomer(challan.customerId.toString(), token);
      } catch (error) {
        console.warn('Could not fetch customer from v1:', error.message);
      }
    }

    // Fetch all selections from v1
    const selections = [];
    if (challan.selectionIds && challan.selectionIds.length > 0) {
      for (const selectionId of challan.selectionIds) {
        try {
          const selection = await v1Service.getSelection(selectionId.toString(), token);
          if (selection) {
            selections.push(selection);
          }
        } catch (error) {
          console.warn(`Could not fetch selection ${selectionId} from v1:`, error.message);
        }
      }
    }

    // Use products from challan as the primary source
    const productsWithDetails = [];

    // First, get all products from challan
    const challanProducts = challan.products || [];

    // For each challan product, find the matching selection product
    for (const challanProduct of challanProducts) {
      let matchingSelectionProduct = null;
      let matchingSelection = null;

      // Find the selection that contains this product
      for (const selection of selections) {
        if (selection && selection.products && selection.products.length > 0) {
          const foundProduct = selection.products.find(selectionProduct =>
            selectionProduct.product_variant_id.toString() === challanProduct.productVariantId.toString() ||
            selectionProduct._id.toString() === challanProduct.selectionProductId.toString()
          );

          if (foundProduct) {
            matchingSelectionProduct = foundProduct;
            matchingSelection = selection;
            break; // Found the match, exit the loop
          }
        }
      }

      // Only include if we found a matching selection product
      if (matchingSelectionProduct && matchingSelection) {
        // Create product object prioritizing V2 challan data for metrics
        const productWithDetails = {
          _id: matchingSelectionProduct._id,
          productVariantId: challanProduct.productVariantId || matchingSelectionProduct.product_variant_id,
          selectionProductId: challanProduct.selectionProductId || matchingSelectionProduct._id,
          selectionId: matchingSelection._id,
          selectionName: challanProduct.selectionName || matchingSelection.requirementType || 'N/A',

          // Use metrics from challan (V2) - these are the stored values
          quantity: challanProduct.quantity ?? matchingSelectionProduct.quantity ?? 1,
          unitPerPrice: challanProduct.unitPerPrice ?? matchingSelectionProduct.unitPerPrice ?? 0,
          totalAmount: challanProduct.totalAmount ?? matchingSelectionProduct.totalAmount ?? 0,
          unit: challanProduct.unit || matchingSelectionProduct.unit || 'Sq.Feet/Price',
          boxPerPiece: challanProduct.boxPerPiece ?? matchingSelectionProduct.boxPerPiece ?? null,
          totalBox: challanProduct.totalBox ?? matchingSelectionProduct.totalBox ?? null,
          totalSquareFeet: challanProduct.totalSquareFeet ?? matchingSelectionProduct.totalSquareFeet ?? 0,

          // Product details from selection product (still primary source for names)
          productName: matchingSelectionProduct.product_name || challanProduct.productName || 'Unknown Product',
          variantName: matchingSelectionProduct.variant_name || challanProduct.variantName || '',
          seriesName: matchingSelectionProduct.series_name || challanProduct.seriesName || '',
          designCode: matchingSelectionProduct.design_code || challanProduct.designCode || '',
          seriesId: matchingSelectionProduct.series_id || challanProduct.seriesId || '',
          variantId: matchingSelectionProduct.variant_id || challanProduct.variantId || '',

          // Selection context
          selectionStatus: matchingSelection.status || null,
          selectionCreatedAt: matchingSelection.createdAt || null,

          // Additional details
          isProductDeleted: matchingSelectionProduct.isProductDeleted || challanProduct.isProductDeleted || false,
        };

        productsWithDetails.push(productWithDetails);
      }
    }

    // Build the final response
    const result = {
      _id: challan._id,
      challanNumber: challan.challanNumber,
      customerId: challan.customerId,
      selectionIds: challan.selectionIds,
      customer: customer || null,
      selections: selections,
      products: productsWithDetails,
      totalAmount: challan.totalAmount,
      totalQuantity: challan.totalQuantity,
      status: challan.status,
      remarks: challan.remarks,
      transporterId: challan.transporterId || undefined,
      transporterName: challan.transporterName || undefined,
      transporterAmount: challan.transporterAmount || undefined,
      createdBy: challan.createdBy,
      createdAt: challan.createdAt,
      updatedAt: challan.updatedAt,
      purchaseOrderId: challan.purchaseOrderId || undefined,
      deliveryNote: challan.deliveryNote || undefined,
    };

    return {
      success: true,
      data: result
    };
  } catch (error) {
    console.error('Error fetching challan details from v1:', error);
    return {
      success: false,
      message: `Failed to fetch challan details: ${error.message}`
    };
  }
};

/**
 * Get All Challans
 * @param {Object} filter - Mongoose filter
 * @param {Object} options - Mongoose query options
 */
exports.getAll = async (filter, options = {}) => {
  return await Challan.paginate(filter, options);
};

/**
 * Delete a Challan (soft delete)
 * @param {Object} filter - Mongoose filter
 * @param {Object} update - Mongoose update object
 * @returns {Promise<Challan>}
 */
exports.delete = async (filter, update) => {
  return await Challan.findOneAndUpdate(filter, update, { new: true });
};

/**
 * Hard Delete a Challan
 * @param {Object} filter - Mongoose filter
 * @returns {Promise<Challan>}
 */
exports.hardDelete = async (filter) => {
  return await Challan.findOneAndDelete(filter);
};

/**
 * Aggregate Challan
 * @param {Array} pipeline - Mongoose aggregation pipeline
 */
exports.aggregate = async (pipeline) => {
  return await Challan.aggregate(pipeline);
};

/**
 * Count Challans
 * @param {Object} filter - Mongoose filter
 */
exports.count = async (filter) => {
  return await Challan.countDocuments(filter);
};

/**
 * Update Many Challans
 * @param {Object} filter - Mongoose filter
 * @param {Object} update - Mongoose update object
 */
exports.bulkUpdate = async (filter, update) => {
  return await Challan.updateMany(filter, update);
};

/**
 * Create bulk Challans
 * @param {Array} payloads - Array of objects to be created
 * @returns {Promise<Array<Challan>>}
 */
exports.insertMany = async (payloads) => {
  return await Challan.insertMany(payloads);
};
