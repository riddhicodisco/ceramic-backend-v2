const httpStatus = require('http-status');
const ApiError = require('../utils/apiError');

const validate = (schema) => (req, res, next) => {
  const validSchema = schema;
  const object = req.method === 'GET' ? 'query' : 'body';
  
  if (validSchema[object]) {
    const { error, value } = validSchema[object].validate(req[object]);
    
    if (error) {
      const errorMessage = error.details.map((details) => details.message).join(', ');
      return next(new ApiError(httpStatus.BAD_REQUEST, errorMessage));
    }
    
    Object.assign(req[object], value);
  }
  
  if (validSchema.params) {
    const { error, value } = validSchema.params.validate(req.params);
    
    if (error) {
      const errorMessage = error.details.map((details) => details.message).join(', ');
      return next(new ApiError(httpStatus.BAD_REQUEST, errorMessage));
    }
    
    Object.assign(req.params, value);
  }
  
  return next();
};

module.exports = validate;
