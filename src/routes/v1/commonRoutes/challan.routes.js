const express = require('express');
const { challanController } = require('../../../controllers/commonControllers');
const { auth, authorizeV3 } = require('../../../middlewares/auth');
const { ROLES } = require('../../../helper/constant.helper');
const validate = require('../../../middlewares/validate');
const { challanValidation } = require('../../../validations');

const router = express.Router();

// Debug: Log when routes are loaded
console.log('🔧 Challan routes loaded, controller:', challanController ? '✅ Found' : '❌ Missing');
console.log('🔧 getAllChallans method:', challanController?.getAllChallans ? '✅ Found' : '❌ Missing');
console.log('🔧 createChallan method:', challanController?.createChallan ? '✅ Found' : '❌ Missing');

// Simple test route
router.get('/test', (req, res) => {
  console.log('✅ Test route hit!');
  res.json({ message: 'Challan routes are working!', timestamp: new Date() });
});

// Simple POST test route
router.post('/test-post', (req, res) => {
  console.log('✅ POST test route hit!', req.body);
  res.json({ message: 'POST test route working!', body: req.body });
});

// Debug controller method
router.post('/debug-create', (req, res, next) => {
  console.log('✅ Debug create route hit!', req.body);
  next();
}, challanController.debugCreate);

router.post(
  '/create',
  // authorizeV3(ROLES.admin, ROLES.accountant),
  // validate(challanValidation.createChallan),
  (req, res, next) => {
    console.log('✅ Create challan route hit!', req.path, req.method, req.body);
    next();
  },
  challanController.createChallan
);

router.get(
  '/list',
  // authorizeV3(ROLES.admin, ROLES.accountant),
  validate(challanValidation.getAllChallans),
  challanController.getAllChallans
);

router.get(
  '/get/:id',
  // authorizeV3(ROLES.admin, ROLES.accountant),
  validate(challanValidation.getChallan),
  challanController.getChallan
);

router.put(
  '/update/:id',
  // authorizeV3(ROLES.admin, ROLES.accountant),
  // validate(challanValidation.updateChallan),
  (req, res, next) => {
    console.log('✅ Update challan route hit!', req.path, req.params, req.body);
    next();
  },
  challanController.updateChallan
);

router.delete(
  '/delete/:id',
  authorizeV3(ROLES.admin, ROLES.accountant),
  validate(challanValidation.deleteChallan),
  challanController.deleteChallan
);

router.get(
  '/selection-products',
  authorizeV3(ROLES.admin, ROLES.accountant),
  validate(challanValidation.getSelectionProducts),
  challanController.getSelectionProducts
);

router.get(
  '/download/:id',
  authorizeV3(ROLES.admin, ROLES.accountant),
  challanController.downloadChallan
);

module.exports = router;
