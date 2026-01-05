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
 */
exports.getChallanWithProducts = async (identifier) => {
  
  const mongoose = require('mongoose');
  const isObjectId = mongoose.Types.ObjectId.isValid(identifier);
  const filter = isObjectId ? { _id: new mongoose.Types.ObjectId(identifier) } : { challanNumber: identifier };
  
  const pipeline = [
    { $match: { ...filter, deletedAt: null } },

    // Lookup customer - use correct collection name based on model
    {
      $lookup: {
        from: 'customers', // Try customers first (most common)
        localField: 'customerId',
        foreignField: '_id',
        as: 'customer',
      },
    },
    { $unwind: { path: '$customer', preserveNullAndEmptyArrays: true } },

    // If customer not found, try alternative collection name
    {
      $lookup: {
        from: 'customer', // Try singular customer
        localField: 'customerId',
        foreignField: '_id',
        as: 'customer_alt',
      },
    },
    {
      $addFields: {
        customer: { $ifNull: ['$customer', '$customer_alt'] }
      }
    },
    { $unwind: { path: '$customer', preserveNullAndEmptyArrays: true } },

    // Lookup selections for reference
    {
      $lookup: {
        from: 'selections',
        localField: 'selectionIds',
        foreignField: '_id',
        as: 'selections',
        pipeline: [
          {
            $project: {
              _id: 1,
              requirementType: 1,
              status: 1,
              createdAt: 1
            }
          }
        ]
      },
    },

    // Unwind only the products that were actually saved with this challan
    { $unwind: { path: '$products', preserveNullAndEmptyArrays: true } },

    // Lookup product variant - try different collection names
    {
      $lookup: {
        from: 'product_variants',
        localField: 'products.productVariantId',
        foreignField: '_id',
        as: 'products.productVariant',
      },
    },
    { $unwind: { path: '$products.productVariant', preserveNullAndEmptyArrays: true } },

    // If productVariant not found, try alternative
    {
      $lookup: {
        from: 'product_variant', // Model reference name
        localField: 'products.productVariantId',
        foreignField: '_id',
        as: 'products.productVariant_alt',
      },
    },
    {
      $addFields: {
        'products.productVariant': { $ifNull: ['$products.productVariant', '$products.productVariant_alt'] }
      }
    },
    { $unwind: { path: '$products.productVariant', preserveNullAndEmptyArrays: true } },

    // Lookup series product - try different collection names
    {
      $lookup: {
        from: 'series_products',
        localField: 'products.productVariant.series_product',
        foreignField: '_id',
        as: 'products.seriesProduct',
      },
    },
    { $unwind: { path: '$products.seriesProduct', preserveNullAndEmptyArrays: true } },

    // If seriesProduct not found, try alternative
    {
      $lookup: {
        from: 'series_product', // Model reference name
        localField: 'products.productVariant.series_product',
        foreignField: '_id',
        as: 'products.seriesProduct_alt',
      },
    },
    {
      $addFields: {
        'products.seriesProduct': { $ifNull: ['$products.seriesProduct', '$products.seriesProduct_alt'] }
      }
    },
    { $unwind: { path: '$products.seriesProduct', preserveNullAndEmptyArrays: true } },

    // Lookup series - try different collection names
    {
      $lookup: {
        from: 'series',
        localField: 'products.seriesProduct.series',
        foreignField: '_id',
        as: 'products.series',
      },
    },
    { $unwind: { path: '$products.series', preserveNullAndEmptyArrays: true } },

    // Lookup selection for this specific product
    {
      $lookup: {
        from: 'selections',
        localField: 'products.selectionId',
        foreignField: '_id',
        as: 'products.selection',
        pipeline: [
          {
            $project: {
              _id: 1,
              requirementType: 1,
              status: 1
            }
          }
        ]
      },
    },
    { $unwind: { path: '$products.selection', preserveNullAndEmptyArrays: true } },

    {
      $addFields: {
        'products.seriesProduct.name': { $ifNull: ['$products.seriesProduct.product_name', ''] },
        'products.series.name': { $ifNull: ['$products.series.series_name', ''] },
        'products.productName': { $ifNull: ['$products.seriesProduct.product_name', ''] },
        'products.seriesName': { $ifNull: ['$products.series.series_name', ''] },
        'products.designCode': { $ifNull: ['$products.seriesProduct.designCode', ''] },
        'products.dimension': { $ifNull: ['$products.series.dimension', ''] },
        'products.selectionName': { $ifNull: ['$products.selection.requirementType', 'N/A'] },
        'products.selectionId': { $ifNull: ['$products.selection._id', null] },
        'products.selectionStatus': { $ifNull: ['$products.selection.status', null] },
        'products.selectionCreatedAt': { $ifNull: ['$products.selection.createdAt', null] }
      }
    },

    // Group back products and format for frontend
    {
      $group: {
        _id: '$_id',
        challanNumber: { $first: '$challanNumber' },
        customerId: { $first: '$customerId' },
        customer: { $first: '$customer' },
        selections: { $first: '$selections' },
        selectionIds: { $first: '$selectionIds' },
        products: { 
          $push: {
            // Keep original fields
            productVariantId: '$products.productVariantId',
            selectionId: '$products.selectionId',
            quantity: '$products.quantity',
            unitPerPrice: '$products.unitPerPrice',
            totalAmount: '$products.totalAmount',
            
            // Frontend-friendly fields
            productName: { $ifNull: ['$products.seriesProduct.product_name', '$products.productName', ''] },
            seriesName: { $ifNull: ['$products.series.series_name', '$products.seriesName', ''] },
            dimension: { $ifNull: ['$products.series.dimension', '$products.dimension', ''] },
            designCode: { $ifNull: ['$products.seriesProduct.designCode', '$products.designCode', ''] },
            selectionName: { $ifNull: ['$products.selection.requirementType', 'N/A'] },
            selectionStatus: { $ifNull: ['$products.selection.status', null] },
            
            // Keep variant and series references for editing
            productVariant: '$products.productVariant',
            seriesProduct: '$products.seriesProduct',
            series: '$products.series',
            selection: '$products.selection',
          }
        },
        totalAmount: { $first: '$totalAmount' },
        totalQuantity: { $first: '$totalQuantity' },
        status: { $first: '$status' },
        remarks: { $first: '$remarks' },
        createdBy: { $first: '$createdBy' },
        createdAt: { $first: '$createdAt' },
        updatedAt: { $first: '$updatedAt' },
        purchaseOrderId: { $first: '$purchaseOrderId' },
        deliveryNote: { $first: '$deliveryNote' },
      },
    },
  ];

  const results = await Challan.aggregate(pipeline);
  
  if (!results || results.length === 0) {
    console.log('❌ No challan found with identifier:', identifier);
    return { success: false, message: 'Challan not found' };
  }

  const result = results[0];

  return {
    success: true,
    data: result
  };
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
