const mongoose = require('mongoose');

/**
 * Aggregate Selection Products
 * @param {Array} pipeline - Aggregation pipeline
 */
exports.aggregate = async (pipeline) => {
  try {
    // Query selection_products collection directly (assuming same database)
    const SelectionProduct = mongoose.connection.collection('selection_products');
    const cursor = SelectionProduct.aggregate(pipeline);
    const results = await cursor.toArray();
    return results;
  } catch (error) {
    console.error('Error aggregating selection products:', error.message);
    return [];
  }
};

