const mongoose = require('mongoose');

/**
 * Get a Selection
 * @param {Object} filter - Selection filter
 */
exports.get = async (filter) => {
  try {
    // Query selections collection directly (assuming same database)
    const Selection = mongoose.connection.collection('selections');
    const selection = await Selection.findOne(filter);
    return selection;
  } catch (error) {
    console.error('Error fetching selection:', error.message);
    return null;
  }
};

