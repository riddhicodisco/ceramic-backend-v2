const { Token } = require('../models');

/**
 * Get token by filter
 * @param {Object} filter
 * @returns {Promise<Token>}
 */
exports.getToken = async (filter) => {
  return Token.findOne(filter);
};

/**
 * Create token
 * @param {Object} tokenData
 * @returns {Promise<Token>}
 */
exports.createToken = async (tokenData) => {
  return Token.create(tokenData);
};

/**
 * Update token
 * @param {Object} filter
 * @param {Object} updateData
 * @returns {Promise<Token>}
 */
exports.updateToken = async (filter, updateData) => {
  return Token.findOneAndUpdate(filter, updateData, { new: true });
};

/**
 * Delete token
 * @param {Object} filter
 * @returns {Promise<Token>}
 */
exports.deleteToken = async (filter) => {
  return Token.findOneAndDelete(filter);
};

