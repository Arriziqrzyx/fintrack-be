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

router.use(authenticate);

router.route('/')
  .get(getTransactions)
  .post(createTransaction);

router.post('/conversion', createConversion);

router.route('/:id')
  .get(getTransactionById)
  .put(updateTransaction)
  .delete(deleteTransaction);

module.exports = router;
