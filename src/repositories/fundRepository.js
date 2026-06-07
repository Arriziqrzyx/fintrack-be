const Fund = require('../models/Fund');
const FundTransaction = require('../models/FundTransaction');
const Transaction = require('../models/Transaction');
const Account = require('../models/Account');
const mongoose = require('mongoose');

const getAvailableBalance = async (userId) => {
  const accounts = await Account.find({ userId, isArchived: false });
  const totalInitialBalance = accounts.reduce((acc, account) => acc + account.initialBalance, 0);

  const allTimeAgg = await Transaction.aggregate([
    { $match: { userId } },
    {
      $group: {
        _id: null,
        totalIncome: { $sum: { $cond: [{ $eq: ['$type', 'INCOME'] }, '$amount', 0] } },
        totalExpense: { $sum: { $cond: [{ $eq: ['$type', 'EXPENSE'] }, '$amount', 0] } },
        totalAdjustment: { $sum: { $cond: [{ $eq: ['$type', 'ADJUSTMENT'] }, '$amount', 0] } }
      }
    }
  ]);
  
  let netTransactionTotal = 0;
  if (allTimeAgg.length > 0) {
    const { totalIncome, totalExpense, totalAdjustment } = allTimeAgg[0];
    netTransactionTotal = totalIncome - totalExpense + totalAdjustment;
  }
  const totalBalance = totalInitialBalance + netTransactionTotal;

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

  let allocatedFunds = 0;
  if (allocatedAgg.length > 0) {
    allocatedFunds = allocatedAgg[0].totalAllocated - allocatedAgg[0].totalWithdrawn;
  }

  return totalBalance - allocatedFunds;
};

const getFundsWithCurrentAmount = async (userId) => {
  return await Fund.aggregate([
    { $match: { userId, status: { $ne: 'ARCHIVED' } } },
    {
      $lookup: {
        from: 'fundtransactions',
        let: { fundId: '$_id' },
        pipeline: [
          { $match: { $expr: { $eq: ['$fundId', '$$fundId'] } } },
          {
            $group: {
              _id: null,
              totalAllocated: { $sum: { $cond: [{ $in: ['$type', ['ALLOCATE', 'TRANSFER_IN']] }, '$amount', 0] } },
              totalWithdrawn: { $sum: { $cond: [{ $in: ['$type', ['WITHDRAW', 'TRANSFER_OUT']] }, '$amount', 0] } }
            }
          }
        ],
        as: 'transactions'
      }
    },
    {
      $addFields: {
        currentAmount: {
          $cond: [
            { $gt: [{ $size: '$transactions' }, 0] },
            { $subtract: [
              { $arrayElemAt: ['$transactions.totalAllocated', 0] },
              { $arrayElemAt: ['$transactions.totalWithdrawn', 0] }
            ]},
            0
          ]
        }
      }
    },
    {
      $project: {
        transactions: 0
      }
    },
    { $sort: { createdAt: -1 } }
  ]);
};

const findByIdAndUser = async (id, userId) => {
  return await Fund.findOne({ _id: id, userId });
};

const create = async (fundData) => {
  return await Fund.create(fundData);
};

const update = async (fund) => {
  return await fund.save();
};

const getCurrentFundAmount = async (userId, fundId) => {
  const balanceAgg = await FundTransaction.aggregate([
    { $match: { userId, fundId } },
    {
      $group: {
        _id: null,
        totalAllocated: { $sum: { $cond: [{ $in: ['$type', ['ALLOCATE', 'TRANSFER_IN']] }, '$amount', 0] } },
        totalWithdrawn: { $sum: { $cond: [{ $in: ['$type', ['WITHDRAW', 'TRANSFER_OUT']] }, '$amount', 0] } }
      }
    }
  ]);

  if (balanceAgg.length > 0) {
    return balanceAgg[0].totalAllocated - balanceAgg[0].totalWithdrawn;
  }
  return 0;
};

const createTransaction = async (data) => {
  return await FundTransaction.create(data);
};

const getTransactionsByFundId = async (fundId, userId) => {
  return await FundTransaction.find({ fundId, userId })
    .sort({ createdAt: -1 })
    .populate('transferFundId', 'name');
};

module.exports = {
  getAvailableBalance,
  getFundsWithCurrentAmount,
  findByIdAndUser,
  create,
  update,
  getCurrentFundAmount,
  createTransaction,
  getTransactionsByFundId
};
