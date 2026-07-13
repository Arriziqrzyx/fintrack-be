const fundService = require('../services/fundService');

const getFunds = async (req, res, next) => {
  try {
    const funds = await fundService.getFunds(req.userId);
    res.status(200).json(funds);
  } catch (error) {
    next(error);
  }
};

const createFund = async (req, res, next) => {
  try {
    const fund = await fundService.createFund(req.userId, req.body);
    res.status(201).json(fund);
  } catch (error) {
    next(error);
  }
};

const updateFund = async (req, res, next) => {
  try {
    const fund = await fundService.updateFund(req.params.id, req.userId, req.body);
    res.status(200).json(fund);
  } catch (error) {
    next(error);
  }
};

const allocateFund = async (req, res, next) => {
  try {
    const transaction = await fundService.allocateFund(req.params.id, req.userId, req.body);
    res.status(200).json(transaction);
  } catch (error) {
    next(error);
  }
};

const withdrawFund = async (req, res, next) => {
  try {
    const transaction = await fundService.withdrawFund(req.params.id, req.userId, req.body);
    res.status(200).json(transaction);
  } catch (error) {
    next(error);
  }
};

const transferFund = async (req, res, next) => {
  try {
    await fundService.transferFund(req.userId, req.body);
    res.status(200).json({ message: 'Transfer successful' });
  } catch (error) {
    next(error);
  }
};

const getFundTransactions = async (req, res, next) => {
  try {
    const transactions = await fundService.getFundTransactions(req.params.id, req.userId);
    res.status(200).json(transactions);
  } catch (error) {
    next(error);
  }
};

module.exports = {
  getFunds,
  getFundTransactions,
  createFund,
  updateFund,
  allocateFund,
  withdrawFund,
  transferFund
};
