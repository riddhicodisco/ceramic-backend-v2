const express = require('express');
const selectionController = require('../../controllers/commonControllers/selection.controller');
const auth = require('../../middlewares/auth');

const router = express.Router();

// Get selection list with challan information (similar to V1 mobile API)
router.get('/customer/:customerId/list', 
  auth, 
  selectionController.getSelectionList
);

// Get selections by customer with challan information
router.get('/customer/:customerId', 
  auth, 
  selectionController.getSelectionsByCustomerId
);

// Get selection by ID with challan information
router.get('/:id', 
  auth, 
  selectionController.getSelectionById
);

module.exports = router;
