const express = require('express');
const { vendorController } = require('../../../controllers/adminControllers');
const { authorizeV3 } = require('../../../middlewares/auth');
const { ROLES } = require('../../../helper/constant.helper');
const validate = require('../../../middlewares/validate');
const { vendorValidation } = require('../../../validations');

const router = express.Router();

// Get vendors with purchase order count (for hidden feature vendor list)
router.get(
  '/with-purchase-orders',
  authorizeV3(ROLES.admin, ROLES.accountant),
  vendorController.getVendorsWithPurchaseOrders
);

// Get purchase orders for specific vendor with filters
router.get(
  '/:vendorId/purchase-orders',
  authorizeV3(ROLES.admin, ROLES.accountant),
  validate(vendorValidation.getVendorPurchaseOrders),
  vendorController.getVendorPurchaseOrders
);

module.exports = router;
