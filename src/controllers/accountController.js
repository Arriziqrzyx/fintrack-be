const accountService = require('../services/accountService');

const getAccounts = async (req, res, next) => {
  try {
    const accounts = await accountService.getAccounts(req.userId, req.query.includeArchived);
    res.status(200).json(accounts);
  } catch (error) {
    next(error);
  }
};

const getAccountById = async (req, res, next) => {
  try {
    const account = await accountService.getAccountById(req.params.id, req.userId);
    res.status(200).json(account);
  } catch (error) {
    next(error);
  }
};

const createAccount = async (req, res, next) => {
  try {
    const account = await accountService.createAccount(req.userId, req.body);
    res.status(201).json(account);
  } catch (error) {
    next(error);
  }
};

const updateAccount = async (req, res, next) => {
  try {
    const account = await accountService.updateAccount(req.params.id, req.userId, req.body);
    res.status(200).json(account);
  } catch (error) {
    next(error);
  }
};

const deleteAccount = async (req, res, next) => {
  try {
    await accountService.deleteAccount(req.params.id, req.userId);
    res.status(200).json({ message: 'Account deleted successfully' });
  } catch (error) {
    next(error);
  }
};

const adjustBalance = async (req, res, next) => {
  try {
    const transaction = await accountService.adjustBalance(req.params.id, req.userId, req.body);
    res.status(201).json({ message: 'Balance adjusted successfully', transaction });
  } catch (error) {
    next(error);
  }
};

module.exports = {
  getAccounts,
  getAccountById,
  createAccount,
  updateAccount,
  deleteAccount,
  adjustBalance
};
