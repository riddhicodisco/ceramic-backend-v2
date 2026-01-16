const express = require('express');
const { challanController } = require('../../../controllers/adminControllers');
const { authorizeV3 } = require('../../../middlewares/auth');
const { ROLES } = require('../../../helper/constant.helper');
const validate = require('../../../middlewares/validate');
const { challanValidation } = require('../../../validations');

const router = express.Router();

// Mirroring backend-v1 admin paths with backend-v2 patterns
router.post(
  '/',
  authorizeV3(ROLES.admin, ROLES.accountant),
  validate(challanValidation.createChallan),
  challanController.createChallan
);

router.get(
  '/',
  authorizeV3(ROLES.admin, ROLES.accountant),
  validate(challanValidation.getAllChallans),
  challanController.getAllChallans
);

router.get(
  '/list',
  authorizeV3(ROLES.admin, ROLES.accountant),
  validate(challanValidation.getAllChallans),
  challanController.getAllChallans
);

// router.get(
//   '/selection-products',
//   authorizeV3(ROLES.admin, ROLES.accountant),
//   validate(challanValidation.getSelectionProducts),
//   challanController.getSelectionProducts
// );

router.get(
  '/customers',
  authorizeV3(ROLES.admin, ROLES.accountant),
  challanController.getCustomersWithChallans
);

router.get(
  '/customer/:customerId',
  authorizeV3(ROLES.admin, ROLES.accountant),
  validate(challanValidation.getCustomerChallans),
  challanController.getCustomerChallans
);

router.get(
  '/get/:id',
  authorizeV3(ROLES.admin, ROLES.accountant),
  validate(challanValidation.getChallan),
  challanController.getChallan
);

router.get(
  '/:id',
  authorizeV3(ROLES.admin, ROLES.accountant),
  validate(challanValidation.getChallan),
  challanController.getChallan
);

router.put(
  '/:id',
  authorizeV3(ROLES.admin, ROLES.accountant),
  validate(challanValidation.updateChallan),
  challanController.updateChallan
);

router.delete(
  '/delete/:id',
  authorizeV3(ROLES.admin, ROLES.accountant),
  validate(challanValidation.deleteChallan),
  challanController.deleteChallan
);

router.delete(
  '/:id',
  authorizeV3(ROLES.admin, ROLES.accountant),
  validate(challanValidation.deleteChallan),
  challanController.deleteChallan
);

router.get(
  '/download/:id',
  authorizeV3(ROLES.admin, ROLES.accountant),
  challanController.downloadChallan
);

module.exports = router;
