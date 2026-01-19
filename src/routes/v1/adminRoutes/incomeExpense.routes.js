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
    '/overview',
    authorizeV3(ROLES.admin, ROLES.accountant),
    incomeExpenseController.getOverview
);

router.get(
    '/',
    authorizeV3(ROLES.admin, ROLES.accountant),
    validate(incomeExpenseValidation.getEntries),
    incomeExpenseController.getEntries
);

router
    .route('/:id')
    .get(
        authorizeV3(ROLES.admin, ROLES.accountant),
        // validate(incomeExpenseValidation.getEntry), // Assuming validation is handled similarly or skipped for now
        incomeExpenseController.getEntry
    )
    .patch(
        authorizeV3(ROLES.admin, ROLES.accountant),
        // validate(incomeExpenseValidation.updateEntry),
        incomeExpenseController.updateEntry
    )
    .delete(
        authorizeV3(ROLES.admin, ROLES.accountant),
        // validate(incomeExpenseValidation.deleteEntry),
        incomeExpenseController.deleteEntry
    );

module.exports = router;
