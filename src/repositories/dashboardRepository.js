const Transaction = require('../models/Transaction');
const Account = require('../models/Account');
const FundTransaction = require('../models/FundTransaction');

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
        _id: null,
        monthIncome: { $sum: { $cond: [{ $eq: ['$type', 'INCOME'] }, '$baseAmount', 0] } },
        monthExpense: {
          $sum: {
            $add: [
              { $cond: [{ $eq: ['$type', 'EXPENSE'] }, '$baseAmount', 0] },
              { $cond: [{ $in: ['$type', ['TRANSFER', 'CONVERSION']] }, '$adminFeeBaseAmount', 0] }
            ]
          }
        }
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
        $or: [
          { type: { $in: ['INCOME', 'EXPENSE'] } },
          { type: { $in: ['TRANSFER', 'CONVERSION'] }, adminFee: { $gt: 0 } }
        ]
      }
    },
    {
      $group: {
        _id: {
          year: { $year: '$transactionDate' },
          month: { $month: '$transactionDate' }
        },
        income: { $sum: { $cond: [{ $eq: ['$type', 'INCOME'] }, '$baseAmount', 0] } },
        expense: {
          $sum: {
            $add: [
              { $cond: [{ $eq: ['$type', 'EXPENSE'] }, '$baseAmount', 0] },
              { $cond: [{ $in: ['$type', ['TRANSFER', 'CONVERSION']] }, '$adminFeeBaseAmount', 0] }
            ]
          }
        }
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
        as: 'category'
      }
    },
    {
      $unwind: { path: '$category', preserveNullAndEmptyArrays: true }
    },
    {
      $project: {
        _id: 0,
        categoryId: '$_id',
        categoryName: {
          $cond: [
            { $eq: ['$_id', null] },
            'Uncategorized',
            { $ifNull: ['$category.name', 'Payment Fee'] }
          ]
        },
        totalAmount: 1
      }
    }
  ]);
};

module.exports = {
  getAllocatedFundsTotal,
  getMonthIncomeExpenseByAsset,
  getMonthlyReviewStatsByAsset,
  getExpenseByCategoryByAsset
};
