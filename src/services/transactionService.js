const transactionRepository = require('../repositories/transactionRepository');
const accountRepository = require('../repositories/accountRepository');
const categoryRepository = require('../repositories/categoryRepository');
const fundRepository = require('../repositories/fundRepository');
const userRepository = require('../repositories/userRepository');
const Transaction = require('../models/Transaction');
const SalaryCycle = require('../models/SalaryCycle'); // Mapped via service or direct model if required
const mongoose = require('mongoose');
const { getAvailableBalance } = require('./fundService');
const salaryCycleService = require('./salaryCycleService');
const AppError = require('../utils/AppError');
const { isAllocatableAccount } = require('../utils/accountUtils');
const exchangeRateService = require('./exchangeRateService');

const handleAutoAllocation = async (transaction, category) => {
  await fundRepository.deleteTransactionsBySourceId(transaction._id);
  if (transaction.type !== 'INCOME' || !category) return;
  const catName = category.name.toLowerCase();
  if (!catName.includes('gaji') && !catName.includes('honorium')) return;

  const activeFunds = await fundRepository.findActiveFundsByUserId(transaction.userId);
  if (activeFunds.length === 0) return;

  const user = await userRepository.findById(transaction.userId);
  const autoAllocationPercentage = user?.autoAllocationPercentage || 35;
  if (autoAllocationPercentage <= 0) return;

  const idrAmount = transaction.amount * (transaction.conversionRate || 1);
  const totalAllocation = idrAmount * (autoAllocationPercentage / 100);
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

  await fundRepository.insertTransactions(allocations);
};

const calculateBalanceBefore = async (transaction) => {
  const accountId = transaction.accountId._id || transaction.accountId;
  const account = await accountRepository.findByIdAndUser(accountId, transaction.userId);
  if (!account) return 0;

  // Get all transactions for this account before this transaction's date/creation
  const transactions = await Transaction.find({
    userId: transaction.userId,
    $or: [
      { accountId },
      { transferAccountId: accountId }
    ],
    $or: [
      { transactionDate: { $lt: transaction.transactionDate } },
      { 
        transactionDate: transaction.transactionDate,
        createdAt: { $lt: transaction.createdAt }
      }
    ]
  });

  let balance = account.initialBalance;
  for (const tx of transactions) {
    if (tx.accountId.toString() === accountId.toString()) {
      switch (tx.type) {
        case 'INCOME':
          balance += tx.amount;
          break;
        case 'EXPENSE':
          balance -= tx.amount;
          break;
        case 'TRANSFER':
        case 'CONVERSION':
          const fee = (tx.adminFeeAccount === 'SOURCE') ? (tx.adminFee || 0) : 0;
          balance -= (tx.amount + fee);
          break;
        case 'ADJUSTMENT':
          balance += tx.amount;
          break;
      }
    } else if (tx.transferAccountId && tx.transferAccountId.toString() === accountId.toString()) {
      switch (tx.type) {
        case 'TRANSFER':
          const feeDestT = (tx.adminFeeAccount === 'DESTINATION') ? (tx.adminFee || 0) : 0;
          balance += (tx.amount - feeDestT);
          break;
        case 'CONVERSION':
          const feeDestC = (tx.adminFeeAccount === 'DESTINATION') ? (tx.adminFee || 0) : 0;
          balance += ((tx.destinationAmount || tx.amount) - feeDestC);
          break;
      }
    }
  }
  return balance;
};

const getTransactions = async (userId, filters) => {
  const { accountId, startDate, endDate, type, search, page, limit, sortBy } = filters;
  let query = { userId };
  if (accountId) query.accountId = accountId;
  if (type) query.type = type;
  if (startDate || endDate) {
    query.transactionDate = {};
    if (startDate) {
      const startD = (typeof startDate === 'string' && startDate.length === 10)
        ? new Date(`${startDate}T00:00:00.000+07:00`)
        : new Date(startDate);
      query.transactionDate.$gte = startD;
    }
    if (endDate) {
      const endD = (typeof endDate === 'string' && endDate.length === 10)
        ? new Date(`${endDate}T23:59:59.999+07:00`)
        : new Date(endDate);
      query.transactionDate.$lte = endD;
    }
  }
  
  if (search) {
    // Keep category query in repository or service. categoryRepository handles query.
    // Category list can be fetched via Mongoose query but scoped.
    const matchingCategories = await categoryRepository.findByUserId(userId);
    const filteredMatch = matchingCategories.filter(c => c.name.toLowerCase().includes(search.toLowerCase()));
    const categoryIds = filteredMatch.map(c => c._id);

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
  const limitNum = parseInt(limit, 10) || 0; // 0 means no limit initially
  const skipNum = limitNum > 0 ? (pageNum - 1) * limitNum : 0;

  const transactions = await transactionRepository.getTransactions(query, skipNum, limitNum, sort);
  const total = await transactionRepository.countTransactions(query);

  const transactionsWithBalanceBefore = await Promise.all(
    transactions.map(async (tx) => {
      const txObj = tx.toObject();
      if (txObj.type === 'CONVERSION') {
        txObj.balanceBefore = await calculateBalanceBefore(tx);
      }
      return txObj;
    })
  );

  return {
    transactions: transactionsWithBalanceBefore,
    total,
    page: pageNum,
    limit: limitNum,
    totalPages: limitNum > 0 ? Math.ceil(total / limitNum) : 1
  };
};

const getTransactionById = async (id, userId) => {
  const transaction = await transactionRepository.getTransactionByIdAndUser(id, userId);
  if (!transaction) {
    throw new AppError('Transaction not found', 404);
  }
  
  const txObj = transaction.toObject();
  if (txObj.type === 'CONVERSION') {
    txObj.balanceBefore = await calculateBalanceBefore(transaction);
  }
  return txObj;
};

const createTransaction = async (userId, data) => {
  const { accountId, type, amount, adminFee, adminFeeAccount, categoryId, note, transferAccountId, transactionDate, isPrimarySalary } = data;
  if (!accountId || !type || amount === undefined || !transactionDate) {
    throw new AppError('Missing required fields', 400);
  }

  const account = await accountRepository.findByIdAndUser(accountId, userId);
  if (!account) throw new AppError('Account not found', 404);

  if (type === 'TRANSFER') {
    if (!transferAccountId) throw new AppError('Transfer account is required for transfers', 400);
    const transferAcc = await accountRepository.findByIdAndUser(transferAccountId, userId);
    if (!transferAcc) throw new AppError('Transfer target account not found', 404);
  } else if (type === 'INCOME' || type === 'EXPENSE') {
    if (!categoryId) throw new AppError('Category is required for income/expense', 400);
    const category = await categoryRepository.findByIdAndUser(categoryId, userId);
    if (!category) throw new AppError('Category not found', 404);
    
    if (type === 'EXPENSE' && isAllocatableAccount(account)) {
      const availableBalance = await getAvailableBalance(new mongoose.Types.ObjectId(userId));
      if (amount > availableBalance) {
        throw new AppError('Insufficient Available Balance', 400);
      }
    }
  }

  const baseCurrency = process.env.BASE_CURRENCY || 'IDR';
  const rates = await exchangeRateService.getExchangeRates();
  
  const getRateToBase = (assetCode) => {
    const assetRateInIDR = rates[assetCode] || 1;
    const baseRateInIDR = rates[baseCurrency] || 1;
    return assetRateInIDR / baseRateInIDR;
  };

  let conversionRate = 1;
  if (account.assetClass === 'METAL' && account.unit === 'GRAM') {
    const troyOunceRateInIDR = rates['XAU_TROY_OUNCE'] || 0;
    const baseRateInIDR = rates[baseCurrency] || 1;
    conversionRate = (troyOunceRateInIDR / 31.1034768) / baseRateInIDR;
  } else {
    conversionRate = getRateToBase(account.assetCode);
  }

  if (!conversionRate || isNaN(conversionRate)) {
    throw new AppError('Unable to determine conversion rate. Transaction creation aborted.', 500);
  }

  const baseAmount = amount * conversionRate;
  const adminFeeBaseAmount = (adminFee || 0) * conversionRate;
  const adminFeeCurrency = account.assetCode;

  const tDate = transactionDate ? new Date(transactionDate) : new Date();
  
  // Calculate balances snapshots
  const balanceBefore = await calculateBalanceBefore({
    accountId,
    userId,
    transactionDate: tDate,
    createdAt: new Date()
  });

  let balanceAfter = balanceBefore;
  if (type === 'INCOME') {
    balanceAfter = balanceBefore + amount;
  } else if (type === 'EXPENSE') {
    balanceAfter = balanceBefore - amount;
  } else if (type === 'ADJUSTMENT') {
    balanceAfter = balanceBefore + amount;
  } else if (type === 'TRANSFER') {
    const fee = (adminFeeAccount === 'SOURCE') ? (adminFee || 0) : 0;
    balanceAfter = balanceBefore - (amount + fee);
  }

  let destBalanceBefore = null;
  let destBalanceAfter = null;
  if (type === 'TRANSFER') {
    destBalanceBefore = await calculateBalanceBefore({
      accountId: transferAccountId,
      userId,
      transactionDate: tDate,
      createdAt: new Date()
    });
    const feeDest = (adminFeeAccount === 'DESTINATION') ? (adminFee || 0) : 0;
    destBalanceAfter = destBalanceBefore + (amount - feeDest);
  }

  const transaction = await transactionRepository.create({
    userId,
    accountId,
    type,
    amount,
    conversionRate,
    adminFee: adminFee || 0,
    adminFeeAccount: adminFeeAccount || 'SOURCE',
    assetCode: account.assetCode,
    categoryId: type === 'TRANSFER' || type === 'ADJUSTMENT' ? null : categoryId,
    note,
    transferAccountId: type === 'TRANSFER' ? transferAccountId : null,
    transactionDate: tDate,
    isPrimarySalary: isPrimarySalary || false,
    
    // Snapshots values
    baseCurrency,
    baseAmount,
    exchangeRateSnapshot: {
      fromCurrency: account.assetCode,
      toCurrency: baseCurrency,
      exchangeRate: conversionRate,
      exchangeRateSource: 'Live Rate API',
      exchangeRateTimestamp: new Date()
    },
    adminFeeCurrency,
    adminFeeBaseAmount,
    balanceBefore,
    balanceAfter,
    destBalanceBefore,
    destBalanceAfter
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
    const cat = await categoryRepository.findByIdAndUser(transaction.categoryId, userId);
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
  if (!transaction) throw new AppError('Transaction not found', 404);

  // Track if this was primary BEFORE the update
  const wasPrimary = transaction.isPrimarySalary === true;

  if (accountId) {
    transaction.accountId = accountId;
    const account = await accountRepository.findByIdAndUser(accountId, userId);
    if (!account) throw new AppError('Account not found', 404);
    transaction.assetCode = account.assetCode;
    
    // Recalculate historical conversion rate
    const rates = await exchangeRateService.getExchangeRates();
    let conversionRate = 1;
    if (account.assetClass === 'METAL' && account.unit === 'GRAM') {
      const troyOunceRate = rates['XAU_TROY_OUNCE'] || 0;
      conversionRate = troyOunceRate / 31.1034768;
    } else {
      conversionRate = rates[account.assetCode] || 1;
    }
    transaction.conversionRate = conversionRate;
  }
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
    const cat = await categoryRepository.findByIdAndUser(updatedTransaction.categoryId, userId);
    await handleAutoAllocation(updatedTransaction, cat);
  } else {
    await fundRepository.deleteTransactionsBySourceId(updatedTransaction._id);
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
  if (!transaction) throw new AppError('Transaction not found', 404);
  await fundRepository.deleteTransactionsBySourceId(transaction._id);
  
  if (transaction.isPrimarySalary) {
    await salaryCycleService.rebuildUserCycles(userId);
  }
  
  return transaction;
};

const createConversion = async (userId, data) => {
  const { accountId, transferAccountId, amount, destinationAmount, conversionRate, adminFee, adminFeeAccount, note, transactionDate } = data;
  
  if (!accountId || !transferAccountId || !amount || !destinationAmount || !conversionRate) {
    throw new AppError('Missing required conversion fields', 400);
  }

  const assetAccount = await accountRepository.findByIdAndUser(accountId, userId);
  const liquidAccount = await accountRepository.findByIdAndUser(transferAccountId, userId);

  if (!assetAccount || !liquidAccount) {
    throw new AppError('One or both accounts not found', 404);
  }

  const baseCurrency = process.env.BASE_CURRENCY || 'IDR';
  const rates = await exchangeRateService.getExchangeRates();
  
  // Rate from source assetAccount to baseCurrency
  const sourceRateToBase = (rates[assetAccount.assetCode] || 1) / (rates[baseCurrency] || 1);
  
  // Rate from dest liquidAccount to baseCurrency
  const destRateToBase = (rates[liquidAccount.assetCode] || 1) / (rates[baseCurrency] || 1);
  
  const baseAmount = amount * sourceRateToBase;
  
  const adminFeeCurrency = adminFeeAccount === 'SOURCE' ? assetAccount.assetCode : liquidAccount.assetCode;
  const adminFeeRateToBase = adminFeeAccount === 'SOURCE' ? sourceRateToBase : destRateToBase;
  const adminFeeBaseAmount = (adminFee || 0) * adminFeeRateToBase;

  const tDate = transactionDate ? new Date(transactionDate) : new Date();

  // Balance snapshots
  const balanceBefore = await calculateBalanceBefore({
    accountId,
    userId,
    transactionDate: tDate,
    createdAt: new Date()
  });
  const feeSource = (adminFeeAccount === 'SOURCE') ? (adminFee || 0) : 0;
  const balanceAfter = balanceBefore - (amount + feeSource);

  const destBalanceBefore = await calculateBalanceBefore({
    accountId: transferAccountId,
    userId,
    transactionDate: tDate,
    createdAt: new Date()
  });
  const feeDest = (adminFeeAccount === 'DESTINATION') ? (adminFee || 0) : 0;
  const destBalanceAfter = destBalanceBefore + (destinationAmount - feeDest);

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
    transactionDate: tDate,

    // Snapshots values
    baseCurrency,
    baseAmount,
    exchangeRateSnapshot: {
      fromCurrency: assetAccount.assetCode,
      toCurrency: liquidAccount.assetCode,
      exchangeRate: conversionRate,
      exchangeRateSource: 'User input rate',
      exchangeRateTimestamp: new Date()
    },
    adminFeeCurrency,
    adminFeeBaseAmount,
    balanceBefore,
    balanceAfter,
    destBalanceBefore,
    destBalanceAfter
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
