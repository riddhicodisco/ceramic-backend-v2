const express = require('express');
const { commonControllers } = require('../../controllers');
const validate = require('../../middlewares/validate');
const { challanValidation } = require('../../validations');

const router = express.Router();

/**
 * POST /v1/api/challans
 * Create a new challan
 */
router.post('/', validate(challanValidation.createChallan), commonControllers.challanController.createChallan);

/**
 * GET /v1/api/challans
 * Get all challans
 */
router.get('/', validate(challanValidation.getChallans), commonControllers.challanController.getChallans);

/**
 * GET /v1/api/challans/:id
 * Get single challan
 */
router.get('/:id', validate(challanValidation.getChallan), commonControllers.challanController.getChallan);

/**
 * PUT /v1/api/challans/:id
 * Update challan
 */
router.put('/:id', validate(challanValidation.updateChallan), commonControllers.challanController.updateChallan);

/**
 * DELETE /v1/api/challans/:id
 * Delete challan
 */
router.delete('/:id', validate(challanValidation.deleteChallan), commonControllers.challanController.deleteChallan);

module.exports = router;
