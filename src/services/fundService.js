const fundRepository = require('../repositories/fundRepository');
const mongoose = require('mongoose');

const accountService = require('./accountService');
const dashboardRepository = require('../repositories/dashboardRepository');
const { isAllocatableAccount } = require('../utils/accountUtils');
const AppError = require('../utils/AppError');

const getAvailableBalance = async (userId) => {
  const accounts = await accountService.getAccounts(userId, 'false');
  const allocatableAccounts = accounts.filter(isAllocatableAccount);
  const totalAllocatableBalance = allocatableAccounts.reduce((sum, acc) => sum + acc.currentBalance, 0);

  const allocatedFunds = await dashboardRepository.getAllocatedFundsTotal(new mongoose.Types.ObjectId(userId));

  return totalAllocatableBalance - allocatedFunds;
};

const getFunds = async (userId) => {
  return await fundRepository.getFundsWithCurrentAmount(new mongoose.Types.ObjectId(userId));
};

const createFund = async (userId, data) => {
  const { name, type, targetAmount, targetDate } = data;
  if (!name || !type) {
    throw new AppError('Name and type are required', 400);
  }
  const fund = await fundRepository.create({
    userId,
    name,
    type,
    targetAmount: targetAmount || 0,
    targetDate: targetDate ? targetDate : null
  });
  return { ...fund.toObject(), currentAmount: 0 };
};

const updateFund = async (id, userId, data) => {
  const { name, type, targetAmount, targetDate, status } = data;
  const fund = await fundRepository.findByIdAndUser(id, userId);
  if (!fund) {
    throw new AppError('Fund not found', 404);
  }
  if (name) fund.name = name;
  if (type) fund.type = type;
  if (targetAmount !== undefined) fund.targetAmount = targetAmount;
  if (targetDate !== undefined) fund.targetDate = targetDate ? targetDate : null;
  if (status) fund.status = status;
  return await fundRepository.update(fund);
};

const allocateFund = async (id, userId, data) => {
  const { amount, note } = data;
  if (!amount || amount <= 0) {
    throw new AppError('Valid amount is required', 400);
  }
  const fund = await fundRepository.findByIdAndUser(id, userId);
  if (!fund) {
    throw new AppError('Fund not found', 404);
  }
  const availableBalance = await getAvailableBalance(userId);
  if (amount > availableBalance) {
    throw new AppError('Insufficient Available Balance', 400);
  }
  return await fundRepository.createTransaction({
    userId,
    fundId: fund._id,
    type: 'ALLOCATE',
    amount,
    note
  });
};

const withdrawFund = async (id, userId, data) => {
  const { amount, note } = data;
  if (!amount || amount <= 0) {
    throw new AppError('Valid amount is required', 400);
  }
  const fund = await fundRepository.findByIdAndUser(id, userId);
  if (!fund) {
    throw new AppError('Fund not found', 404);
  }
  const currentAmount = await fundRepository.getCurrentFundAmount(new mongoose.Types.ObjectId(userId), new mongoose.Types.ObjectId(id));
  if (amount > currentAmount) {
    throw new AppError('Insufficient funds in this allocation', 400);
  }
  return await fundRepository.createTransaction({
    userId,
    fundId: fund._id,
    type: 'WITHDRAW',
    amount,
    note
  });
};

const transferFund = async (userId, data) => {
  const { sourceFundId, destinationFundId, amount, note } = data;
  if (!sourceFundId || !destinationFundId || !amount || amount <= 0) {
    throw new AppError('Valid source, destination, and amount are required', 400);
  }
  if (sourceFundId === destinationFundId) {
    throw new AppError('Source and destination funds cannot be the same', 400);
  }
  const sourceFund = await fundRepository.findByIdAndUser(sourceFundId, userId);
  const destFund = await fundRepository.findByIdAndUser(destinationFundId, userId);
  if (!sourceFund || !destFund) {
    throw new AppError('One or both funds not found', 404);
  }
  const currentAmount = await fundRepository.getCurrentFundAmount(new mongoose.Types.ObjectId(userId), new mongoose.Types.ObjectId(sourceFundId));
  if (amount > currentAmount) {
    throw new AppError('Insufficient funds in the source allocation', 400);
  }

  const txOut = await fundRepository.createTransaction({
    userId,
    fundId: sourceFundId,
    type: 'TRANSFER_OUT',
    amount,
    note: note || `Transfer to ${destFund.name}`,
    transferFundId: destinationFundId
  });

  await fundRepository.createTransaction({
    userId,
    fundId: destinationFundId,
    type: 'TRANSFER_IN',
    amount,
    note: note || `Transfer from ${sourceFund.name}`,
    transferFundId: sourceFundId
  });

  return txOut;
};

const getFundTransactions = async (id, userId) => {
  return await fundRepository.getTransactionsByFundId(id, userId);
};

module.exports = {
  getAvailableBalance,
  getFunds,
  createFund,
  updateFund,
  allocateFund,
  withdrawFund,
  transferFund,
  getFundTransactions
};
