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

  // Fetch the challan from v2 database (contains all items and metadata)
  const challan = await Challan.findOne({ ...filter, deletedAt: null });

  if (!challan) {
    return { success: false, message: 'Challan not found' };
  }

  try {
    // Fetch customer details from v1 (still needed for customer metadata)
    let customer = null;
    if (challan.customerId) {
      try {
        customer = await v1Service.getCustomer(challan.customerId.toString(), token);
      } catch (error) {
        console.warn('Could not fetch customer from v1:', error.message);
      }
    }

    // Use products stored in v2 directly as the source of truth
    let products = (challan.products || []).map(p => ({
      ...p.toObject(),
      selectionName: p.selectionName || 'N/A',
      productName: p.productName || 'Unknown Product',
      variantName: p.variantName || '',
      seriesName: p.seriesName || '',
      designCode: p.designCode || '',
      dimension: p.dimension || '',
      quantity: p.quantity || 1,
      unitPerPrice: p.unitPerPrice || 0,
      totalAmount: p.totalAmount || 0,
      unit: p.unit || 'Sq.Feet/Price',
      totalSquareFeet: p.totalSquareFeet || 0,
    }));

    // BACKWARD COMPATIBILITY FALLBACK:
    // If some metadata is missing (like dimension or productName), fetch from v1 selections once
    const isMetadataMissing = products.some(p => !p.dimension || !p.productName || p.productName === 'Unknown Product');

    if (isMetadataMissing && challan.selectionIds && challan.selectionIds.length > 0) {
      console.log(`Metadata missing for challan ${challan.challanNumber}, falling back to v1 selections...`);
      const selections = [];
      for (const selectionId of challan.selectionIds) {
        try {
          const selection = await v1Service.getSelection(selectionId.toString(), token);
          if (selection) selections.push(selection);
        } catch (error) {
          console.warn(`Could not fetch selection ${selectionId} for fallback:`, error.message);
        }
      }

      // Merge v1 metadata into products
      products = products.map(p => {
        let matchingV1Product = null;
        for (const sel of selections) {
          matchingV1Product = (sel.products || []).find(v1p =>
            (v1p.product_variant_id && v1p.product_variant_id.toString() === p.productVariantId?.toString()) ||
            (v1p._id && v1p._id.toString() === p.selectionProductId?.toString())
          );
          if (matchingV1Product) break;
        }

        if (matchingV1Product) {
          return {
            ...p,
            productName: p.productName && p.productName !== 'Unknown Product' ? p.productName : (matchingV1Product.product_name || ''),
            seriesName: p.seriesName ? p.seriesName : (Array.isArray(matchingV1Product.series_name) ? matchingV1Product.series_name.join(', ') : (matchingV1Product.series_name || '')),
            dimension: p.dimension ? p.dimension : (matchingV1Product.dimension || ''),
            designCode: p.designCode ? p.designCode : (matchingV1Product.design_code || ''),
            variantName: p.variantName ? p.variantName : (matchingV1Product.variant_name || ''),
            variantId: p.variantId ? p.variantId : (matchingV1Product.variant_id?.toString() || ''),
            seriesId: p.seriesId ? p.seriesId : (matchingV1Product.series_id?.toString() || ''),
          };
        }
        return p;
      });
    }

    // Build the final response
    const result = {
      _id: challan._id,
      challanNumber: challan.challanNumber,
      customerId: challan.customerId,
      selectionIds: challan.selectionIds,
      customer: customer || null,
      selections: [],
      products: products,
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
    console.error('Error processing challan details:', error);
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
