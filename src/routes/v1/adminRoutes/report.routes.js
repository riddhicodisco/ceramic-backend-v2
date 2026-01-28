const express = require('express');
const { authorizeV3 } = require('../../../middlewares/auth');
const { ROLES } = require('../../../helper/constant.helper');
const reportController = require('../../../controllers/adminControllers/report.controller');
const validate = require('../../../middlewares/validate');
const { reportValidation } = require('../../../validations');

const router = express.Router();

router.route('/monthly-purchase-sale').get(authorizeV3(ROLES.admin, ROLES.accountant), reportController.getMonthlyPurchaseSale);
router.route('/profit-loss-summary').get(authorizeV3(ROLES.admin, ROLES.accountant), reportController.getProfitLossSummary);
router.route('/daily-report').get(authorizeV3(ROLES.admin, ROLES.accountant), reportController.getDailyReport);

router.route('/balance-sheet').get(
  authorizeV3(ROLES.admin, ROLES.accountant),
  validate(reportValidation.getBalanceSheet),
  reportController.getBalanceSheet
);

module.exports = router;

