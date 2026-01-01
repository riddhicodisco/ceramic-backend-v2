const httpStatus = require('http-status');
const { Challan } = require('../models');
const ApiError = require('../utils/apiError');
const axios = require('axios');

/**
 * Create a challan
 * @param {Object} challanBody
 * @returns {Promise<Challan>}
 */
const createChallan = async (challanBody) => {
  const challan = await Challan.create(challanBody);
  
  // Call V1 API to update isChallan flag
  try {
    const v1ApiUrl = `${process.env.V1_BASE_URL}/v1/product/update-challan-flag/${challanBody.productId}`;
    
    await axios.put(v1ApiUrl, {
      isChallan: true
    });
    
    console.log(`V1 product ${challanBody.productId} marked as challan`);
  } catch (error) {
    console.error('Failed to update V1 product:', error.message);
    // Continue even if V1 update fails
  }
  
  return challan;
};

/**
 * Query for challans
 * @param {Object} filter - Mongo filter
 * @param {Object} options - Query options
 * @returns {Promise<QueryResult>}
 */
const queryChallans = async (filter, options) => {
  const challans = await Challan.paginate(filter, options);
  return challans;
};

/**
 * Get challan by id
 * @param {ObjectId} id
 * @returns {Promise<Challan>}
 */
const getChallanById = async (id) => {
  return Challan.findById(id);
};

/**
 * Update challan by id
 * @param {ObjectId} challanId
 * @param {Object} updateBody
 * @returns {Promise<Challan>}
 */
const updateChallanById = async (challanId, updateBody) => {
  const challan = await getChallanById(challanId);
  if (!challan) {
    throw new ApiError(httpStatus.NOT_FOUND, 'Challan not found');
  }
  Object.assign(challan, updateBody);
  await challan.save();
  return challan;
};

/**
 * Delete challan by id
 * @param {ObjectId} challanId
 * @returns {Promise<Challan>}
 */
const deleteChallanById = async (challanId) => {
  const challan = await getChallanById(challanId);
  if (!challan) {
    throw new ApiError(httpStatus.NOT_FOUND, 'Challan not found');
  }
  
  // Call V1 API to reset isChallan flag
  try {
    const v1ApiUrl = `${process.env.V1_BASE_URL}/v1/product/update-challan-flag/${challan.productId}`;
    
    await axios.put(v1ApiUrl, {
      isChallan: false
    });
    
    console.log(`V1 product ${challan.productId} challan flag reset`);
  } catch (error) {
    console.error('Failed to reset V1 product flag:', error.message);
    // Continue even if V1 update fails
  }
  
  await challan.remove();
  return challan;
};

module.exports = {
  createChallan,
  queryChallans,
  getChallanById,
  updateChallanById,
  deleteChallanById,
};
