const transactionService = require('../services/transactionService');

const getTransactions = async (req, res, next) => {
  try {
    const transactions = await transactionService.getTransactions(req.userId, req.query);
    res.status(200).json(transactions);
  } catch (error) {
    next(error);
  }
};

const getTransactionById = async (req, res, next) => {
  try {
    const transaction = await transactionService.getTransactionById(req.params.id, req.userId);
    res.status(200).json(transaction);
  } catch (error) {
    next(error);
  }
};

const createTransaction = async (req, res, next) => {
  try {
    const transaction = await transactionService.createTransaction(req.userId, req.body);
    res.status(201).json(transaction);
  } catch (error) {
    next(error);
  }
};

const updateTransaction = async (req, res, next) => {
  try {
    const transaction = await transactionService.updateTransaction(req.params.id, req.userId, req.body);
    res.status(200).json(transaction);
  } catch (error) {
    next(error);
  }
};

const deleteTransaction = async (req, res, next) => {
  try {
    await transactionService.deleteTransaction(req.params.id, req.userId);
    res.status(200).json({ message: 'Transaction deleted successfully' });
  } catch (error) {
    next(error);
  }
};

const createConversion = async (req, res, next) => {
  try {
    const transaction = await transactionService.createConversion(req.userId, req.body);
    res.status(201).json(transaction);
  } catch (error) {
    next(error);
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
