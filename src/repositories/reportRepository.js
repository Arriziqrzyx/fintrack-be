const Transaction = require('../models/Transaction');
const mongoose = require('mongoose');

const getMonthlySummary = async (userId, startDate, endDate) => {
  return await Transaction.aggregate([
    { 
      $match: {
        userId: new mongoose.Types.ObjectId(userId),
        transactionDate: {
          $gte: startDate,
          $lte: endDate
        }
      } 
    },
    {
      $group: {
        _id: '$type',
        total: { $sum: '$amount' }
      }
    }
  ]);
};

const getCategoryBreakdown = async (userId, startDate, endDate) => {
  return await Transaction.aggregate([
    { 
      $match: {
        userId: new mongoose.Types.ObjectId(userId),
        transactionDate: {
          $gte: startDate,
          $lte: endDate
        },
        type: 'EXPENSE'
      }
    },
    {
      $group: {
        _id: '$categoryId',
        totalAmount: { $sum: '$amount' }
      }
    },
    {
      $lookup: {
        from: 'categories',
        localField: '_id',
        foreignField: '_id',
        as: 'categoryInfo'
      }
    },
    {
      $unwind: {
        path: '$categoryInfo',
        preserveNullAndEmptyArrays: true
      }
    },
    {
      $project: {
        categoryName: { $ifNull: ['$categoryInfo.name', 'Uncategorized'] },
        totalAmount: 1
      }
    },
    { $sort: { totalAmount: -1 } }
  ]);
};

const getMonthlyTrends = async (userId, startDate, endDate) => {
  return await Transaction.aggregate([
    { 
      $match: {
        userId: new mongoose.Types.ObjectId(userId),
        type: { $in: ['INCOME', 'EXPENSE'] },
        transactionDate: {
          $gte: startDate,
          $lte: endDate
        }
      } 
    },
    {
      $group: {
        _id: {
          month: { $month: { date: '$transactionDate', timezone: 'Asia/Jakarta' } },
          type: '$type'
        },
        total: { $sum: '$amount' }
      }
    }
  ]);
};

module.exports = {
  getMonthlySummary,
  getCategoryBreakdown,
  getMonthlyTrends
};
