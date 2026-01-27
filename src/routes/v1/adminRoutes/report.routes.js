const express = require('express');
const { authorizeV3 } = require('../../../middlewares/auth');
const { ROLES } = require('../../../helper/constant.helper');
const reportController = require('../../../controllers/adminControllers/report.controller');

const router = express.Router();

router.route('/monthly-purchase-sale').get(authorizeV3(ROLES.admin, ROLES.accountant), reportController.getMonthlyPurchaseSale);
router.route('/profit-loss-summary').get(authorizeV3(ROLES.admin, ROLES.accountant), reportController.getProfitLossSummary);


module.exports = router;

