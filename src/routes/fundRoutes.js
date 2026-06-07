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

router.use(authenticate);

router.route('/')
  .get(getFunds)
  .post(createFund);

router.route('/transfer')
  .post(transferFund);

router.route('/:id')
  .put(updateFund);

router.route('/:id/transactions')
  .get(getFundTransactions);

router.route('/:id/allocate')
  .post(allocateFund);

router.route('/:id/withdraw')
  .post(withdrawFund);

module.exports = router;
