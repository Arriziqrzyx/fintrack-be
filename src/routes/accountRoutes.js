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
const { validateBody } = require('../middleware/validationMiddleware');
const { createAccountSchema, updateAccountSchema, adjustBalanceSchema } = require('../validators/accountSchemas');

// Protect all account routes
router.use(authenticate);

// Routes for /api/accounts
router.route('/')
  .get(getAccounts)
  .post(validateBody(createAccountSchema), createAccount);

router.route('/:id')
  .get(getAccountById)
  .put(validateBody(updateAccountSchema), updateAccount)
  .delete(deleteAccount);

router.post('/:id/adjust-balance', validateBody(adjustBalanceSchema), adjustBalance);

module.exports = router;
