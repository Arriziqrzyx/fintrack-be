const transactionService = require('../services/transactionService');

const getTransactions = async (req, res) => {
  try {
    const transactions = await transactionService.getTransactions(req.userId, req.query);
    res.status(200).json(transactions);
  } catch (error) {
    res.status(500).json({ message: 'Error fetching transactions', error: error.message });
  }
};

const getTransactionById = async (req, res) => {
  try {
    const transaction = await transactionService.getTransactionById(req.params.id, req.userId);
    res.status(200).json(transaction);
  } catch (error) {
    const status = error.message === 'Transaction not found' ? 404 : 500;
    res.status(status).json({ message: error.message || 'Error fetching transaction' });
  }
};

const createTransaction = async (req, res) => {
  try {
    const transaction = await transactionService.createTransaction(req.userId, req.body);
    res.status(201).json(transaction);
  } catch (error) {
    const status = error.message.includes('not found') ? 404 : error.message.includes('required') || error.message.includes('Insufficient') ? 400 : 500;
    res.status(status).json({ message: error.message || 'Error creating transaction' });
  }
};

const updateTransaction = async (req, res) => {
  try {
    const transaction = await transactionService.updateTransaction(req.params.id, req.userId, req.body);
    res.status(200).json(transaction);
  } catch (error) {
    const status = error.message === 'Transaction not found' ? 404 : 500;
    res.status(status).json({ message: error.message || 'Error updating transaction' });
  }
};

const deleteTransaction = async (req, res) => {
  try {
    await transactionService.deleteTransaction(req.params.id, req.userId);
    res.status(200).json({ message: 'Transaction deleted successfully' });
  } catch (error) {
    const status = error.message === 'Transaction not found' ? 404 : 500;
    res.status(status).json({ message: error.message || 'Error deleting transaction' });
  }
};

const createConversion = async (req, res) => {
  try {
    const transaction = await transactionService.createConversion(req.userId, req.body);
    res.status(201).json(transaction);
  } catch (error) {
    const status = error.message.includes('not found') ? 404 : error.message.includes('required') ? 400 : 500;
    res.status(status).json({ message: error.message || 'Error creating conversion transaction' });
  }
};

module.exports = {
  getTransactions,
  getTransactionById,
  createTransaction,
  updateTransaction,
  deleteTransaction,
  createConversion
};
