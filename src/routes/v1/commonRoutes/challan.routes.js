const express = require('express');
const { challanController } = require('../../../controllers/commonControllers');
const { auth, authorizeV3 } = require('../../../middlewares/auth');
const { ROLES } = require('../../../helper/constant.helper');
const validate = require('../../../middlewares/validate');
const { challanValidation } = require('../../../validations');

const router = express.Router();

router.post(
  '/create',
  authorizeV3(ROLES.admin, ROLES.accountant),
  validate(challanValidation.createChallan),
  challanController.createChallan // Use common controller
);

router.get(
  '/list',
  authorizeV3(ROLES.admin, ROLES.accountant),
  validate(challanValidation.getAllChallans),
  challanController.getAllChallans
);

router.get(
  '/get/:id',
  authorizeV3(ROLES.admin, ROLES.accountant),
  validate(challanValidation.getChallan),
  challanController.getChallan
);

router.put(
  '/update/:id',
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

// router.get(
//   '/selection-products',
//   authorizeV3(ROLES.admin, ROLES.accountant),
//   validate(challanValidation.getSelectionProducts),
//   challanController.getSelectionProducts
// );

router.get(
  '/download/:id',
  authorizeV3(ROLES.admin, ROLES.accountant),
  challanController.downloadChallan
);

module.exports = router;
