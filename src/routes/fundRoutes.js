const express = require('express');
const router = express.Router();
const {
  getFunds,
  getFundTransactions,
  createFund,
  updateFund,
  allocateFund,
  withdrawFund,
  transferFund
} = require('../controllers/fundController');

const { authenticate } = require('../middleware/auth');

const { validateBody } = require('../middleware/validationMiddleware');
const { createFundSchema, updateFundSchema, allocateFundSchema, withdrawFundSchema, transferFundSchema } = require('../validators/fundSchemas');

router.use(authenticate);

router.route('/')
  .get(getFunds)
  .post(validateBody(createFundSchema), createFund);

router.route('/transfer')
  .post(validateBody(transferFundSchema), transferFund);

router.route('/:id')
  .put(validateBody(updateFundSchema), updateFund);

router.route('/:id/transactions')
  .get(getFundTransactions);

router.route('/:id/allocate')
  .post(validateBody(allocateFundSchema), allocateFund);

router.route('/:id/withdraw')
  .post(validateBody(withdrawFundSchema), withdrawFund);

module.exports = router;
