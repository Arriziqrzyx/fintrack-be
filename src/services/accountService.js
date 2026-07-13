const accountRepository = require('../repositories/accountRepository');
const transactionRepository = require('../repositories/transactionRepository');
const exchangeRateService = require('./exchangeRateService');
const AppError = require('../utils/AppError');

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
    
    // Calculate exchangeRate (conversion rate to IDR) based on asset and unit
    if (['XAU', 'ANTAM', 'UBS'].includes(account.assetCode) && account.unit === 'GRAM') {
      const troyOunceRate = rates['XAU_TROY_OUNCE'] || 0;
      account.exchangeRate = troyOunceRate / 31.1034768;
    } else {
      account.exchangeRate = rates[account.assetCode] || 1;
    }

    return account;
  });
};

const getAccountById = async (id, userId) => {
  const account = await accountRepository.findByIdAndUser(id, userId);
  if (!account) {
    throw new AppError('Account not found', 404);
  }
  return account;
};

const createAccount = async (userId, data) => {
  const { name, type, assetClass, assetCode, unit, initialBalance } = data;
  if (!name || !type) {
    throw new AppError('Name and type are required', 400);
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
    throw new AppError('Account not found', 404);
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
    throw new AppError('Account not found', 404);
  }
  return account;
};

const adjustBalance = async (id, userId, data) => {
  const { amount, note, transactionDate } = data;
  if (amount === undefined) {
    throw new AppError('Amount is required', 400);
  }
  const account = await accountRepository.findByIdAndUser(id, userId);
  if (!account) {
    throw new AppError('Account not found', 404);
  }

  // Corrected direct Model access violation: call transactionRepository.create
  const transaction = await transactionRepository.create({
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
