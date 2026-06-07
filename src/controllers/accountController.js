const accountService = require('../services/accountService');

const getAccounts = async (req, res) => {
  try {
    const accounts = await accountService.getAccounts(req.userId, req.query.includeArchived);
    res.status(200).json(accounts);
  } catch (error) {
    res.status(500).json({ message: 'Error fetching accounts', error: error.message });
  }
};

const getAccountById = async (req, res) => {
  try {
    const account = await accountService.getAccountById(req.params.id, req.userId);
    res.status(200).json(account);
  } catch (error) {
    const status = error.message === 'Account not found' ? 404 : 500;
    res.status(status).json({ message: error.message || 'Error fetching account' });
  }
};

const createAccount = async (req, res) => {
  try {
    const account = await accountService.createAccount(req.userId, req.body);
    res.status(201).json(account);
  } catch (error) {
    const status = error.message.includes('required') ? 400 : 500;
    res.status(status).json({ message: error.message || 'Error creating account' });
  }
};

const updateAccount = async (req, res) => {
  try {
    const account = await accountService.updateAccount(req.params.id, req.userId, req.body);
    res.status(200).json(account);
  } catch (error) {
    const status = error.message === 'Account not found' ? 404 : 500;
    res.status(status).json({ message: error.message || 'Error updating account' });
  }
};

const deleteAccount = async (req, res) => {
  try {
    await accountService.deleteAccount(req.params.id, req.userId);
    res.status(200).json({ message: 'Account deleted successfully' });
  } catch (error) {
    const status = error.message === 'Account not found' ? 404 : 500;
    res.status(status).json({ message: error.message || 'Error deleting account' });
  }
};

const adjustBalance = async (req, res) => {
  try {
    const transaction = await accountService.adjustBalance(req.params.id, req.userId, req.body);
    res.status(201).json({ message: 'Balance adjusted successfully', transaction });
  } catch (error) {
    const status = error.message === 'Account not found' ? 404 : error.message.includes('required') ? 400 : 500;
    res.status(status).json({ message: error.message || 'Error adjusting balance' });
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
