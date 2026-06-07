const accountRepository = require('../repositories/accountRepository');
const Transaction = require('../models/Transaction');
const exchangeRateService = require('./exchangeRateService');

const getAccounts = async (userId, includeArchived) => {
  const accounts = await accountRepository.getAccountsWithBalance(userId, includeArchived);
  const rates = await exchangeRateService.getExchangeRates();
  
  return accounts.map(account => {
    account.estimatedValueIDR = exchangeRateService.calculateEstimatedIDR(
      account.assetCode, 
      account.currentBalance, 
      rates, 
      account.unit
    );
    return account;
  });
};

const getAccountById = async (id, userId) => {
  const account = await accountRepository.findByIdAndUser(id, userId);
  if (!account) {
    throw new Error('Account not found');
  }
  return account;
};

const createAccount = async (userId, data) => {
  const { name, type, assetClass, assetCode, unit, initialBalance } = data;
  if (!name || !type) {
    throw new Error('Name and type are required');
  }
  return await accountRepository.create({
    userId,
    name,
    type,
    assetClass: assetClass || 'FIAT',
    assetCode: assetCode || 'IDR',
    unit: unit || null,
    initialBalance: initialBalance || 0,
  });
};

const updateAccount = async (id, userId, data) => {
  const { name, type, isArchived, assetClass, assetCode, unit } = data;
  const account = await accountRepository.findByIdAndUser(id, userId);
  if (!account) {
    throw new Error('Account not found');
  }
  if (name) account.name = name;
  if (type) account.type = type;
  if (typeof isArchived === 'boolean') account.isArchived = isArchived;
  if (assetClass) account.assetClass = assetClass;
  if (assetCode) account.assetCode = assetCode;
  if (unit !== undefined) account.unit = unit;
  return await accountRepository.update(account);
};

const deleteAccount = async (id, userId) => {
  const account = await accountRepository.deleteByIdAndUser(id, userId);
  if (!account) {
    throw new Error('Account not found');
  }
  return account;
};

const adjustBalance = async (id, userId, data) => {
  const { amount, note, transactionDate } = data;
  if (amount === undefined) {
    throw new Error('Amount is required');
  }
  const account = await accountRepository.findByIdAndUser(id, userId);
  if (!account) {
    throw new Error('Account not found');
  }

  // Ideally this should use transactionRepository, but for now we use the model directly
  // until we refactor transactionController
  const transaction = await Transaction.create({
    userId,
    accountId: account._id,
    type: 'ADJUSTMENT',
    amount,
    assetCode: account.assetCode,
    note: note || 'Balance adjustment',
    transactionDate: transactionDate ? new Date(transactionDate) : new Date()
  });

  return transaction;
};

module.exports = {
  getAccounts,
  getAccountById,
  createAccount,
  updateAccount,
  deleteAccount,
  adjustBalance
};
