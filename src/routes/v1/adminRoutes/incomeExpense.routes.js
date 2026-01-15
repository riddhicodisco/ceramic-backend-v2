const express = require('express');
const { incomeExpenseController } = require('../../../controllers/adminControllers');
const { authorizeV3 } = require('../../../middlewares/auth');
const { ROLES } = require('../../../helper/constant.helper');
const validate = require('../../../middlewares/validate');
const { incomeExpenseValidation } = require('../../../validations');

const router = express.Router();

router.post(
    '/',
    authorizeV3(ROLES.admin, ROLES.accountant),
    validate(incomeExpenseValidation.createEntry),
    incomeExpenseController.createEntry
);

router.get(
    '/',
    authorizeV3(ROLES.admin, ROLES.accountant),
    validate(incomeExpenseValidation.getEntries),
    incomeExpenseController.getEntries
);

module.exports = router;
