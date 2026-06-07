const express = require('express');
const router = express.Router();
const {
  getAccounts,
  getAccountById,
  createAccount,
  updateAccount,
  deleteAccount,
  adjustBalance
} = require('../controllers/accountController');
const { authenticate } = require('../middleware/auth');

// Protect all account routes
router.use(authenticate);

// Routes for /api/accounts
router.route('/')
  .get(getAccounts)
  .post(createAccount);

router.route('/:id')
  .get(getAccountById)
  .put(updateAccount)
  .delete(deleteAccount);

router.post('/:id/adjust-balance', adjustBalance);

module.exports = router;
