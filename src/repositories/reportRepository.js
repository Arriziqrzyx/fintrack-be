const Transaction = require('../models/Transaction');
const mongoose = require('mongoose');

const getMonthlySummary = async (userId, startDate, endDate) => {
  const summary = await Transaction.aggregate([
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
        _id: null,
        totalIncome: {
          $sum: {
            $cond: [
              { $eq: ['$type', 'INCOME'] },
              '$baseAmount',
              0
            ]
          }
        },
        totalExpense: {
          $sum: {
            $cond: [
              { $eq: ['$type', 'EXPENSE'] },
              '$baseAmount',
              0
            ]
          }
        },
        totalAdminFee: {
          $sum: {
            $cond: [
              { $in: ['$type', ['TRANSFER', 'CONVERSION']] },
              '$adminFeeBaseAmount',
              0
            ]
          }
        }
      }
    }
  ]);

  if (summary.length === 0) {
    return [
      { _id: 'INCOME', total: 0 },
      { _id: 'EXPENSE', total: 0 }
    ];
  }

  return [
    { _id: 'INCOME', total: summary[0].totalIncome },
    { _id: 'EXPENSE', total: summary[0].totalExpense + summary[0].totalAdminFee }
  ];
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
        $or: [
          { type: 'EXPENSE' },
          { type: { $in: ['TRANSFER', 'CONVERSION'] }, adminFee: { $gt: 0 } }
        ]
      }
    },
    {
      $lookup: {
        from: 'categories',
        let: { uId: '$userId' },
        pipeline: [
          {
            $match: {
              $expr: {
                $and: [
                  { $eq: ['$userId', '$$uId'] },
                  { $eq: ['$name', 'Payment Fee'] }
                ]
              }
            }
          }
        ],
        as: 'paymentFeeCat'
      }
    },
    {
      $addFields: {
        resolvedCategoryId: {
          $cond: [
            { $in: ['$type', ['TRANSFER', 'CONVERSION']] },
            { $arrayElemAt: ['$paymentFeeCat._id', 0] },
            '$categoryId'
          ]
        }
      }
    },
    {
      $group: {
        _id: '$resolvedCategoryId',
        totalAmount: {
          $sum: {
            $add: [
              { $cond: [{ $eq: ['$type', 'EXPENSE'] }, '$baseAmount', 0] },
              { $cond: [{ $in: ['$type', ['TRANSFER', 'CONVERSION']] }, '$adminFeeBaseAmount', 0] }
            ]
          }
        }
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
        _id: 0,
        categoryName: {
          $cond: [
            { $eq: ['$_id', null] },
            'Uncategorized',
            { $ifNull: ['$categoryInfo.name', 'Payment Fee'] }
          ]
        },
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
        transactionDate: {
          $gte: startDate,
          $lte: endDate
        },
        $or: [
          { type: { $in: ['INCOME', 'EXPENSE'] } },
          { type: { $in: ['TRANSFER', 'CONVERSION'] }, adminFee: { $gt: 0 } }
        ]
      } 
    },
    {
      $group: {
        _id: {
          month: { $month: { date: '$transactionDate', timezone: 'Asia/Jakarta' } },
          type: {
            $cond: [
              { $eq: ['$type', 'INCOME'] },
              'INCOME',
              'EXPENSE'
            ]
          }
        },
        total: {
          $sum: {
            $cond: [
              { $eq: ['$type', 'INCOME'] },
              '$baseAmount',
              {
                $add: [
                  { $cond: [{ $eq: ['$type', 'EXPENSE'] }, '$baseAmount', 0] },
                  { $cond: [{ $in: ['$type', ['TRANSFER', 'CONVERSION']] }, '$adminFeeBaseAmount', 0] }
                ]
              }
            ]
          }
        }
      }
    }
  ]);
};

module.exports = {
  getMonthlySummary,
  getCategoryBreakdown,
  getMonthlyTrends
};
