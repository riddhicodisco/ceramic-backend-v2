const { ChallanReturn, ChallanCounter } = require('../../models');

/**
 * Generate next challan return number with transaction
 * @param {Object} session - Mongoose session for transaction
 * @returns {Promise<string>}
 */
exports.generateReturnNumber = async (session) => {
  try {
    const sequence = await ChallanCounter.getNextSequence('challan_return', session);
    const returnNumber = `RET-${String(sequence).padStart(6, '0')}`;
    return returnNumber;
  } catch (error) {
    console.error('❌ Error generating challan return number:', error);
    throw new Error(`Failed to generate challan return number: ${error.message}`);
  }
};

/**
 * Create a Challan Return
 * @param {Object} payload
 * @returns {Promise<ChallanReturn>}
 */
exports.create = async (payload) => {
  return ChallanReturn.create(payload);
};

/**
 * Get a Challan Return
 * @param {Object} filter
 */
exports.get = async (filter) => {
  return await ChallanReturn.findOne(filter);
};

/**
 * Get All Challan Returns
 * @param {Object} filter
 * @param {Object} options
 */
exports.getAll = async (filter, options = {}) => {
  return await ChallanReturn.paginate(filter, options);
};

/**
 * Soft delete a Challan Return
 * @param {Object} filter
 * @param {Object} update
 */
exports.delete = async (filter, update) => {
  return await ChallanReturn.findOneAndUpdate(filter, update, { new: true });
};

/**
 * Aggregate Challan Return
 * @param {Array} pipeline
 */
exports.aggregate = async (pipeline) => {
  return await ChallanReturn.aggregate(pipeline);
};

/**
 * Update a Challan Return by ID
 * @param {ObjectId} id
 * @param {Object} updateBody
 * @returns {Promise<ChallanReturn>}
 */
exports.updateById = async (id, updateBody) => {
  const challanReturn = await ChallanReturn.findByIdAndUpdate(id, updateBody, {
    new: true,
  });
  return challanReturn;
};
