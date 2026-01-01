const mongoose = require('mongoose');

/**
 * Convert string to ObjectId
 */
const objectId = (value, helpers) => {
  if (!mongoose.Types.ObjectId.isValid(value)) {
    return helpers.error('any.invalid');
  }
  return value;
};

module.exports = {
  objectId,
};
