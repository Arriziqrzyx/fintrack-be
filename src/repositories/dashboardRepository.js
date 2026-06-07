const Transaction = require('../models/Transaction');
const Account = require('../models/Account');
const FundTransaction = require('../models/FundTransaction');

const getTotalInitialBalanceByAsset = async (userId) => {
  return await Account.aggregate([
    { $match: { userId, isArchived: false } },
    {
      $group: {
        _id: { assetCode: '$assetCode', unit: '$unit' },
        totalInitialBalance: { $sum: '$initialBalance' }
      }
    }
  ]);
};

const getNetTransactionTotalByAsset = async (userId) => {
  return await Transaction.aggregate([
    { $match: { userId } },
    {
      $group: {
        _id: '$assetCode',
        totalIncome: { $sum: { $cond: [{ $eq: ['$type', 'INCOME'] }, '$amount', 0] } },
        totalExpense: { $sum: { $cond: [{ $eq: ['$type', 'EXPENSE'] }, '$amount', 0] } },
        totalAdjustment: { $sum: { $cond: [{ $eq: ['$type', 'ADJUSTMENT'] }, '$amount', 0] } }
      }
    }
  ]);
};

const getAllocatedFundsTotal = async (userId) => {
  const allocatedAgg = await FundTransaction.aggregate([
    { $match: { userId } },
    {
      $group: {
        _id: null,
        totalAllocated: { $sum: { $cond: [{ $in: ['$type', ['ALLOCATE', 'TRANSFER_IN']] }, '$amount', 0] } },
        totalWithdrawn: { $sum: { $cond: [{ $in: ['$type', ['WITHDRAW', 'TRANSFER_OUT']] }, '$amount', 0] } }
      }
    }
  ]);

  if (allocatedAgg.length > 0) {
    return allocatedAgg[0].totalAllocated - allocatedAgg[0].totalWithdrawn;
  }
  return 0;
};

const getMonthIncomeExpenseByAsset = async (userId, startOfMonth, endOfMonth) => {
  return await Transaction.aggregate([
    { 
      $match: { 
        userId,
        transactionDate: { $gte: startOfMonth, $lte: endOfMonth }
      } 
    },
    {
      $group: {
        _id: '$assetCode',
        monthIncome: { $sum: { $cond: [{ $eq: ['$type', 'INCOME'] }, '$amount', 0] } },
        monthExpense: { $sum: { $cond: [{ $eq: ['$type', 'EXPENSE'] }, '$amount', 0] } }
      }
    }
  ]);
};

const getMonthlyReviewStatsByAsset = async (userId, sixMonthsAgo) => {
  return await Transaction.aggregate([
    {
      $match: {
        userId,
        transactionDate: { $gte: sixMonthsAgo },
        type: { $in: ['INCOME', 'EXPENSE'] }
      }
    },
    {
      $group: {
        _id: {
          year: { $year: '$transactionDate' },
          month: { $month: '$transactionDate' },
          assetCode: '$assetCode'
        },
        income: { $sum: { $cond: [{ $eq: ['$type', 'INCOME'] }, '$amount', 0] } },
        expense: { $sum: { $cond: [{ $eq: ['$type', 'EXPENSE'] }, '$amount', 0] } }
      }
    },
    { $sort: { '_id.year': 1, '_id.month': 1 } }
  ]);
};

const getExpenseByCategoryByAsset = async (userId, startOfMonth, endOfMonth) => {
  return await Transaction.aggregate([
    {
      $match: {
        userId,
        transactionDate: { $gte: startOfMonth, $lte: endOfMonth },
        type: 'EXPENSE'
      }
    },
    {
      $group: {
        _id: { categoryId: '$categoryId', assetCode: '$assetCode' },
        totalAmount: { $sum: '$amount' }
      }
    },
    {
      $lookup: {
        from: 'categories',
        localField: '_id.categoryId',
        foreignField: '_id',
        as: 'category'
      }
    },
    {
      $unwind: { path: '$category', preserveNullAndEmptyArrays: true }
    },
    {
      $project: {
        _id: 0,
        categoryId: '$_id.categoryId',
        assetCode: '$_id.assetCode',
        categoryName: { $ifNull: ['$category.name', 'Uncategorized'] },
        totalAmount: 1
      }
    }
  ]);
};

module.exports = {
  getTotalInitialBalanceByAsset,
  getNetTransactionTotalByAsset,
  getAllocatedFundsTotal,
  getMonthIncomeExpenseByAsset,
  getMonthlyReviewStatsByAsset,
  getExpenseByCategoryByAsset
};
