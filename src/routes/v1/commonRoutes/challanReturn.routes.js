const express = require('express');
const { challanReturnController } = require('../../../controllers/commonControllers');
const { auth, authorizeV3 } = require('../../../middlewares/auth');
const { ROLES } = require('../../../helper/constant.helper');
const validate = require('../../../middlewares/validate');
const { challanReturnValidation } = require('../../../validations');

const router = express.Router();

router.post(
  '/create',
  authorizeV3(ROLES.admin, ROLES.subAdmin, ROLES.accountant),
  validate(challanReturnValidation.createChallanReturn),
  challanReturnController.createChallanReturn
);

router.get(
  '/list',
  authorizeV3(ROLES.admin, ROLES.subAdmin, ROLES.accountant),
  validate(challanReturnValidation.getAllChallanReturns),
  challanReturnController.getAllChallanReturns
);

router.get(
  '/get/:id',
  authorizeV3(ROLES.admin, ROLES.subAdmin, ROLES.accountant),
  validate(challanReturnValidation.getChallanReturn),
  challanReturnController.getChallanReturn
);

router.delete(
  '/delete/:id',
  authorizeV3(ROLES.admin, ROLES.subAdmin, ROLES.accountant),
  validate(challanReturnValidation.deleteChallanReturn),
  challanReturnController.deleteChallanReturn
);

router.put(
  '/update/:id',
  authorizeV3(ROLES.admin, ROLES.subAdmin, ROLES.accountant),
  validate(challanReturnValidation.updateChallanReturn),
  challanReturnController.updateChallanReturn
);

router.get(
  '/download/:id',
  authorizeV3(ROLES.admin, ROLES.subAdmin, ROLES.accountant),
  challanReturnController.downloadChallanReturn
);

module.exports = router;
