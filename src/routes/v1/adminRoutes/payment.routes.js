const express = require('express');
const { authorizeV3 } = require('../../../middlewares/auth');
const { ROLES } = require('../../../helper/constant.helper');
const validate = require('../../../middlewares/validate');
const paymentValidation = require('../../../validations/payment.validation');
const paymentController = require('../../../controllers/adminControllers/payment.controller');

const router = express.Router();

router
  .route('/')
  .post(
    authorizeV3(ROLES.admin, ROLES.subAdmin, ROLES.accountant),
    validate(paymentValidation.createPayment),
    paymentController.createPayment
  )
  .get(
    authorizeV3(ROLES.admin, ROLES.subAdmin, ROLES.accountant),
    validate(paymentValidation.getPayments),
    paymentController.getPayments
  );

router
  .route('/balance/:customerId')
  .get(
    authorizeV3(ROLES.admin, ROLES.subAdmin, ROLES.accountant),
    validate(paymentValidation.getCustomerBalance),
    paymentController.getCustomerBalance
  );

router
  .route('/:paymentId')
  .get(
    authorizeV3(ROLES.admin, ROLES.subAdmin, ROLES.accountant),
    validate(paymentValidation.getPayment),
    paymentController.getPayment
  )
  .put(
    authorizeV3(ROLES.admin, ROLES.subAdmin, ROLES.accountant),
    validate(paymentValidation.updatePayment),
    paymentController.updatePayment
  )
  .delete(
    authorizeV3(ROLES.admin, ROLES.subAdmin, ROLES.accountant),
    validate(paymentValidation.deletePayment),
    paymentController.deletePayment
  );

module.exports = router;
