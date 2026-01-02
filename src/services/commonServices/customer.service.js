const { Customer } = require('../../models');

/**
 * Get Customer by filter.
 * @param {Object} filter
 * @returns {Promise<Customer>}
 */
exports.get = async (filter) => {
    return Customer.findOne(filter);
};

