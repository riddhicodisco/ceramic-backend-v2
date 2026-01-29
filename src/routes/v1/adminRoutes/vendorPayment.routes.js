const express = require('express');
const { authorizeV3 } = require('../../../middlewares/auth');
const { ROLES } = require('../../../helper/constant.helper');
const validate = require('../../../middlewares/validate');
const vendorPaymentValidation = require('../../../validations/vendorPayment.validation');
const vendorPaymentController = require('../../../controllers/adminControllers/vendorPayment.controller');

const router = express.Router();

router
  .route('/')
  .post(
    authorizeV3(ROLES.admin, ROLES.subAdmin, ROLES.accountant),
    validate(vendorPaymentValidation.createVendorPayment),
    vendorPaymentController.createVendorPayment
  )
  .get(
    authorizeV3(ROLES.admin, ROLES.subAdmin, ROLES.accountant),
    validate(vendorPaymentValidation.getVendorPayments),
    vendorPaymentController.getVendorPayments
  );

router
  .route('/balance/:vendorId')
  .get(
    authorizeV3(ROLES.admin, ROLES.subAdmin, ROLES.accountant),
    validate(vendorPaymentValidation.getVendorBalance),
    vendorPaymentController.getVendorBalance
  );

router
  .route('/:paymentId')
  .get(
    authorizeV3(ROLES.admin, ROLES.subAdmin, ROLES.accountant),
    validate(vendorPaymentValidation.getVendorPayment),
    vendorPaymentController.getVendorPayment
  )
  .put(
    authorizeV3(ROLES.admin, ROLES.subAdmin, ROLES.accountant),
    validate(vendorPaymentValidation.updateVendorPayment),
    vendorPaymentController.updateVendorPayment
  )
  .delete(
    authorizeV3(ROLES.admin, ROLES.subAdmin, ROLES.accountant),
    validate(vendorPaymentValidation.deleteVendorPayment),
    vendorPaymentController.deleteVendorPayment
  );

module.exports = router;

