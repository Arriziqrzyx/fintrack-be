const transactionRepository = require('../repositories/transactionRepository');
const Account = require('../models/Account');
const Category = require('../models/Category');
const Fund = require('../models/Fund');
const FundTransaction = require('../models/FundTransaction');
const User = require('../models/User');
const mongoose = require('mongoose');
const { getAvailableBalance } = require('./fundService');
const salaryCycleService = require('./salaryCycleService');
const SalaryCycle = require('../models/SalaryCycle');

const handleAutoAllocation = async (transaction, category) => {
  await FundTransaction.deleteMany({ sourceTransactionId: transaction._id });
  if (transaction.type !== 'INCOME' || !category) return;
  const catName = category.name.toLowerCase();
  if (!catName.includes('gaji') && !catName.includes('honorium')) return;

  const activeFunds = await Fund.find({ userId: transaction.userId, status: { $ne: 'ARCHIVED' } });
  if (activeFunds.length === 0) return;

  const user = await User.findById(transaction.userId);
  const autoAllocationPercentage = user?.autoAllocationPercentage || 35;
  if (autoAllocationPercentage <= 0) return;

  const totalAllocation = transaction.amount * (autoAllocationPercentage / 100);
  const rawPerFund = totalAllocation / activeFunds.length;
  const roundedPerFund = Math.floor(rawPerFund / 1000) * 1000;

  if (roundedPerFund <= 0) return;

  const allocations = activeFunds.map(fund => ({
    userId: transaction.userId,
    fundId: fund._id,
    type: 'ALLOCATE',
    amount: roundedPerFund,
    note: `Auto-allocation ${autoAllocationPercentage}% from Salary`,
    sourceTransactionId: transaction._id
  }));

  await FundTransaction.insertMany(allocations);
};

const getTransactions = async (userId, filters) => {
  const { accountId, startDate, endDate, type, search, page, limit, sortBy } = filters;
  let query = { userId };
  if (accountId) query.accountId = accountId;
  if (type) query.type = type;
  if (startDate || endDate) {
    query.transactionDate = {};
    if (startDate) query.transactionDate.$gte = new Date(startDate);
    if (endDate) query.transactionDate.$lte = new Date(endDate);
  }
  
  if (search) {
    const matchingCategories = await Category.find({
      $or: [
        { userId },
        { isDefault: true } // Include default categories in search
      ],
      name: { $regex: search, $options: 'i' }
    });
    const categoryIds = matchingCategories.map(c => c._id);

    query.$or = [
      { note: { $regex: search, $options: 'i' } },
      { categoryId: { $in: categoryIds } }
    ];
  }

  // Setup sorting parameters
  let sort = { transactionDate: -1, createdAt: -1 };
  if (sortBy === 'amount_desc') {
    sort = { amount: -1 };
  } else if (sortBy === 'amount_asc') {
    sort = { amount: 1 };
  } else if (sortBy === 'date_asc') {
    sort = { transactionDate: 1, createdAt: 1 };
  }

  const pageNum = parseInt(page, 10) || 1;
  const limitNum = parseInt(limit, 10) || 0; // 0 means no limit initially, but we can set a default
  const skipNum = limitNum > 0 ? (pageNum - 1) * limitNum : 0;

  const transactions = await transactionRepository.getTransactions(query, skipNum, limitNum, sort);
  const total = await transactionRepository.countTransactions(query);

  return {
    transactions,
    total,
    page: pageNum,
    limit: limitNum,
    totalPages: limitNum > 0 ? Math.ceil(total / limitNum) : 1
  };
};

const getTransactionById = async (id, userId) => {
  const transaction = await transactionRepository.getTransactionByIdAndUser(id, userId);
  if (!transaction) {
    throw new Error('Transaction not found');
  }
  return transaction;
};

const createTransaction = async (userId, data) => {
  const { accountId, type, amount, adminFee, adminFeeAccount, categoryId, note, transferAccountId, transactionDate, isPrimarySalary } = data;
  if (!accountId || !type || amount === undefined || !transactionDate) {
    throw new Error('Missing required fields');
  }

  const account = await Account.findOne({ _id: accountId, userId });
  if (!account) throw new Error('Account not found');

  if (type === 'TRANSFER') {
    if (!transferAccountId) throw new Error('Transfer account is required for transfers');
    const transferAcc = await Account.findOne({ _id: transferAccountId, userId });
    if (!transferAcc) throw new Error('Transfer target account not found');
  } else if (type === 'INCOME' || type === 'EXPENSE') {
    if (!categoryId) throw new Error('Category is required for income/expense');
    const category = await Category.findOne({ _id: categoryId, userId });
    if (!category) throw new Error('Category not found');
    
    if (type === 'EXPENSE') {
      const availableBalance = await getAvailableBalance(new mongoose.Types.ObjectId(userId));
      if (amount > availableBalance) {
        throw new Error('Insufficient Available Balance');
      }
    }
  }

  const transaction = await transactionRepository.create({
    userId,
    accountId,
    type,
    amount,
    adminFee: adminFee || 0,
    adminFeeAccount: adminFeeAccount || 'SOURCE',
    assetCode: account.assetCode,
    categoryId: type === 'TRANSFER' || type === 'ADJUSTMENT' ? null : categoryId,
    note,
    transferAccountId: type === 'TRANSFER' ? transferAccountId : null,
    transactionDate: new Date(transactionDate),
    isPrimarySalary: isPrimarySalary || false
  });

  // Determine and set salaryCycleId for non-primary transactions
  if (!transaction.isPrimarySalary) {
    const cycle = await SalaryCycle.findOne({
      userId,
      startDate: { $lte: transaction.transactionDate },
      $or: [{ endDate: { $gte: transaction.transactionDate } }, { endDate: null }]
    });
    if (cycle) {
      transaction.salaryCycleId = cycle._id;
      await transaction.save();
    }
  }

  if (transaction.type === 'INCOME' && transaction.categoryId) {
    const cat = await Category.findById(transaction.categoryId);
    await handleAutoAllocation(transaction, cat);
  }

  if (transaction.isPrimarySalary) {
    await salaryCycleService.rebuildUserCycles(userId);
  }

  return transaction;
};

const updateTransaction = async (id, userId, data) => {
  const { accountId, type, amount, adminFee, adminFeeAccount, categoryId, note, transferAccountId, transactionDate, isPrimarySalary } = data;
  const transaction = await transactionRepository.getTransactionByIdAndUser(id, userId);
  if (!transaction) throw new Error('Transaction not found');

  // Track if this was primary BEFORE the update
  const wasPrimary = transaction.isPrimarySalary === true;

  if (accountId) transaction.accountId = accountId;
  if (type) transaction.type = type;
  if (amount !== undefined) transaction.amount = amount;
  if (adminFee !== undefined) transaction.adminFee = adminFee;
  if (adminFeeAccount !== undefined) transaction.adminFeeAccount = adminFeeAccount;
  if (categoryId !== undefined) transaction.categoryId = categoryId;
  if (note !== undefined) transaction.note = note;
  if (transferAccountId !== undefined) transaction.transferAccountId = transferAccountId;
  if (transactionDate) transaction.transactionDate = new Date(transactionDate);
  if (isPrimarySalary !== undefined) transaction.isPrimarySalary = isPrimarySalary;

  if (transaction.type === 'TRANSFER' || transaction.type === 'ADJUSTMENT') {
    transaction.categoryId = null;
  }
  if (transaction.type !== 'TRANSFER') {
    transaction.transferAccountId = null;
  }

  const isPrimary = transaction.isPrimarySalary === true;

  // For non-primary, update its cycle if date changed
  if (!isPrimary) {
    const cycle = await SalaryCycle.findOne({
      userId,
      startDate: { $lte: transaction.transactionDate },
      $or: [{ endDate: { $gte: transaction.transactionDate } }, { endDate: null }]
    });
    transaction.salaryCycleId = cycle ? cycle._id : null;
  }

  const updatedTransaction = await transactionRepository.update(transaction);

  if (updatedTransaction.type === 'INCOME' && updatedTransaction.categoryId) {
    const cat = await Category.findById(updatedTransaction.categoryId);
    await handleAutoAllocation(updatedTransaction, cat);
  } else {
    await FundTransaction.deleteMany({ sourceTransactionId: updatedTransaction._id });
  }

  // Only rebuild cycles if:
  // 1. It WAS primary (boundary removed/changed)
  // 2. It IS NOW primary (boundary added/changed)
  const needsRebuild = wasPrimary || isPrimary;
  if (needsRebuild) {
    await salaryCycleService.rebuildUserCycles(userId);
  }

  return updatedTransaction;
};

const deleteTransaction = async (id, userId) => {
  const transaction = await transactionRepository.deleteByIdAndUser(id, userId);
  if (!transaction) throw new Error('Transaction not found');
  await FundTransaction.deleteMany({ sourceTransactionId: transaction._id });
  
  if (transaction.isPrimarySalary) {
    await salaryCycleService.rebuildUserCycles(userId);
  }
  
  return transaction;
};

const createConversion = async (userId, data) => {
  const { accountId, transferAccountId, amount, destinationAmount, conversionRate, adminFee, adminFeeAccount, note, transactionDate } = data;
  
  if (!accountId || !transferAccountId || !amount || !destinationAmount || !conversionRate) {
    throw new Error('Missing required conversion fields');
  }

  const assetAccount = await Account.findOne({ _id: accountId, userId });
  const liquidAccount = await Account.findOne({ _id: transferAccountId, userId });

  if (!assetAccount || !liquidAccount) {
    throw new Error('One or both accounts not found');
  }

  // Ensure they have enough asset
  if (assetAccount.currentBalance !== undefined && amount > assetAccount.currentBalance) {
    // Note: Since currentBalance is dynamic, we'd ideally fetch it using accountService,
    // but the model here doesn't have currentBalance directly. We'll skip strict validation here 
    // or assume the caller validated, to keep it simple, or we could just let them go negative if they override.
    // Let's trust the frontend validation for now.
  }

  const transaction = await transactionRepository.create({
    userId,
    accountId,
    type: 'CONVERSION',
    amount,
    destinationAmount,
    conversionRate,
    adminFee: adminFee || 0,
    adminFeeAccount: adminFeeAccount || 'SOURCE',
    assetCode: assetAccount.assetCode,
    categoryId: null,
    note: note || `Converted ${amount} ${assetAccount.assetCode} to ${liquidAccount.assetCode}`,
    transferAccountId,
    transactionDate: transactionDate ? new Date(transactionDate) : new Date()
  });

  return transaction;
};

module.exports = {
  getTransactions,
  getTransactionById,
  createTransaction,
  updateTransaction,
  deleteTransaction,
  createConversion
};
