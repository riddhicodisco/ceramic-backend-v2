const express = require('express');
const { purchaseOrderController } = require('../../../controllers/adminControllers');
const { authorizeV3 } = require('../../../middlewares/auth');
const { ROLES } = require('../../../helper/constant.helper');
const validate = require('../../../middlewares/validate');
const { purchaseOrderValidation } = require('../../../validations');

const router = express.Router();

// Mirroring backend-v1 admin paths with backend-v2 patterns
router.post(
  '/',
  authorizeV3(ROLES.admin, ROLES.subAdmin, ROLES.accountant),
  validate(purchaseOrderValidation.createPurchaseOrder),
  purchaseOrderController.createPurchaseOrder
);

router.get(
  '/',
  authorizeV3(ROLES.admin, ROLES.subAdmin, ROLES.accountant),
  validate(purchaseOrderValidation.getAllPurchaseOrders),
  purchaseOrderController.getAllPurchaseOrders
);

router.get(
  '/list',
  authorizeV3(ROLES.admin, ROLES.subAdmin, ROLES.accountant),
  validate(purchaseOrderValidation.getAllPurchaseOrders),
  purchaseOrderController.getAllPurchaseOrders
);

router.get(
  '/get/:id',
  authorizeV3(ROLES.admin, ROLES.subAdmin, ROLES.accountant),
  validate(purchaseOrderValidation.getPurchaseOrder),
  purchaseOrderController.getPurchaseOrder
);

router.get(
  '/:id',
  authorizeV3(ROLES.admin, ROLES.subAdmin, ROLES.accountant),
  validate(purchaseOrderValidation.getPurchaseOrder),
  purchaseOrderController.getPurchaseOrder
);

router.put(
  '/:id',
  authorizeV3(ROLES.admin, ROLES.subAdmin, ROLES.accountant),
  validate(purchaseOrderValidation.updatePurchaseOrder),
  purchaseOrderController.updatePurchaseOrder
);

router.delete(
  '/delete/:id',
  authorizeV3(ROLES.admin, ROLES.subAdmin, ROLES.accountant),
  validate(purchaseOrderValidation.deletePurchaseOrder),
  purchaseOrderController.deletePurchaseOrder
);

router.delete(
  '/:id',
  authorizeV3(ROLES.admin, ROLES.subAdmin, ROLES.accountant),
  validate(purchaseOrderValidation.deletePurchaseOrder),
  purchaseOrderController.deletePurchaseOrder
);

module.exports = router;
