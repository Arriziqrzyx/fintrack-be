const fundService = require('../services/fundService');

const getFunds = async (req, res) => {
  try {
    const funds = await fundService.getFunds(req.userId);
    res.status(200).json(funds);
  } catch (error) {
    res.status(500).json({ message: 'Error fetching funds', error: error.message });
  }
};

const createFund = async (req, res) => {
  try {
    const fund = await fundService.createFund(req.userId, req.body);
    res.status(201).json(fund);
  } catch (error) {
    const status = error.message.includes('required') ? 400 : 500;
    res.status(status).json({ message: error.message || 'Error creating fund' });
  }
};

const updateFund = async (req, res) => {
  try {
    const fund = await fundService.updateFund(req.params.id, req.userId, req.body);
    res.status(200).json(fund);
  } catch (error) {
    const status = error.message === 'Fund not found' ? 404 : 500;
    res.status(status).json({ message: error.message || 'Error updating fund' });
  }
};

const allocateFund = async (req, res) => {
  try {
    const transaction = await fundService.allocateFund(req.params.id, req.userId, req.body);
    res.status(200).json(transaction);
  } catch (error) {
    const status = error.message === 'Fund not found' ? 404 : error.message.includes('required') || error.message.includes('Insufficient') ? 400 : 500;
    res.status(status).json({ message: error.message || 'Error allocating fund' });
  }
};

const withdrawFund = async (req, res) => {
  try {
    const transaction = await fundService.withdrawFund(req.params.id, req.userId, req.body);
    res.status(200).json(transaction);
  } catch (error) {
    const status = error.message === 'Fund not found' ? 404 : error.message.includes('required') || error.message.includes('Insufficient') ? 400 : 500;
    res.status(status).json({ message: error.message || 'Error withdrawing fund' });
  }
};

const transferFund = async (req, res) => {
  try {
    await fundService.transferFund(req.userId, req.body);
    res.status(200).json({ message: 'Transfer successful' });
  } catch (error) {
    const status = error.message.includes('not found') ? 404 : error.message.includes('required') || error.message.includes('Insufficient') || error.message.includes('cannot be the same') ? 400 : 500;
    res.status(status).json({ message: error.message || 'Error transferring fund' });
  }
};

const getFundTransactions = async (req, res) => {
  try {
    const transactions = await fundService.getFundTransactions(req.params.id, req.userId);
    res.status(200).json(transactions);
  } catch (error) {
    res.status(500).json({ message: 'Error fetching fund transactions', error: error.message });
  }
};

// Exported for backwards compatibility or other controllers if needed
const getAvailableBalance = async (userId) => {
  return await fundService.getAvailableBalance(userId);
};

module.exports = {
  getFunds,
  getFundTransactions,
  createFund,
  updateFund,
  allocateFund,
  withdrawFund,
  transferFund,
  getAvailableBalance
};
