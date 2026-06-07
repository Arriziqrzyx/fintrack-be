const fundRepository = require('../repositories/fundRepository');
const mongoose = require('mongoose');

const accountService = require('./accountService');
const dashboardRepository = require('../repositories/dashboardRepository');
const { isAllocatableAccount } = require('../utils/accountUtils');

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
    throw new Error('Name and type are required');
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
    throw new Error('Fund not found');
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
    throw new Error('Valid amount is required');
  }
  const fund = await fundRepository.findByIdAndUser(id, userId);
  if (!fund) {
    throw new Error('Fund not found');
  }
  const availableBalance = await fundRepository.getAvailableBalance(new mongoose.Types.ObjectId(userId));
  if (amount > availableBalance) {
    throw new Error('Insufficient Available Balance');
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
    throw new Error('Valid amount is required');
  }
  const fund = await fundRepository.findByIdAndUser(id, userId);
  if (!fund) {
    throw new Error('Fund not found');
  }
  const currentAmount = await fundRepository.getCurrentFundAmount(new mongoose.Types.ObjectId(userId), new mongoose.Types.ObjectId(id));
  if (amount > currentAmount) {
    throw new Error('Insufficient funds in this allocation');
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
    throw new Error('Valid source, destination, and amount are required');
  }
  if (sourceFundId === destinationFundId) {
    throw new Error('Source and destination funds cannot be the same');
  }
  const sourceFund = await fundRepository.findByIdAndUser(sourceFundId, userId);
  const destFund = await fundRepository.findByIdAndUser(destinationFundId, userId);
  if (!sourceFund || !destFund) {
    throw new Error('One or both funds not found');
  }
  const currentAmount = await fundRepository.getCurrentFundAmount(new mongoose.Types.ObjectId(userId), new mongoose.Types.ObjectId(sourceFundId));
  if (amount > currentAmount) {
    throw new Error('Insufficient funds in the source allocation');
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
