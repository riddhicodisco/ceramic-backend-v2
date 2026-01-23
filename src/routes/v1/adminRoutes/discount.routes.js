const express = require('express');
const { authorizeV3 } = require('../../../middlewares/auth');
const { ROLES } = require('../../../helper/constant.helper');
const validate = require('../../../middlewares/validate');
const discountValidation = require('../../../validations/discount.validation');
const discountController = require('../../../controllers/adminControllers/discount.controller');

const router = express.Router();

router
  .route('/')
  .post(
    authorizeV3(ROLES.admin, ROLES.accountant),
    validate(discountValidation.createDiscount),
    discountController.createDiscount
  )
  .get(
    authorizeV3(ROLES.admin, ROLES.accountant),
    validate(discountValidation.getDiscounts),
    discountController.getDiscounts
  );

router
  .route('/:discountId')
  .get(
    authorizeV3(ROLES.admin, ROLES.accountant),
    validate(discountValidation.getDiscount),
    discountController.getDiscount
  )
  .delete(
    authorizeV3(ROLES.admin, ROLES.accountant),
    validate(discountValidation.deleteDiscount),
    discountController.deleteDiscount
  );

module.exports = router;
