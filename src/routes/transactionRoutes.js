const express = require('express');
const router = express.Router();
const {
  getTransactions,
  getTransactionById,
  createTransaction,
  updateTransaction,
  deleteTransaction,
  createConversion
} = require('../controllers/transactionController');
const { authenticate } = require('../middleware/auth');
const { validateBody } = require('../middleware/validationMiddleware');
const { createTransactionSchema, updateTransactionSchema, createConversionSchema } = require('../validators/transactionSchemas');

router.use(authenticate);

router.route('/')
  .get(getTransactions)
  .post(validateBody(createTransactionSchema), createTransaction);

router.post('/conversion', validateBody(createConversionSchema), createConversion);

router.route('/:id')
  .get(getTransactionById)
  .put(validateBody(updateTransactionSchema), updateTransaction)
  .delete(deleteTransaction);

module.exports = router;
