const Account = require('../models/Account');
const mongoose = require('mongoose');

const getAccountsWithBalance = async (userId, includeArchived) => {
  const matchStage = { userId: new mongoose.Types.ObjectId(userId) };
  if (includeArchived !== 'true') {
    matchStage.isArchived = { $ne: true };
  }

  return await Account.aggregate([
    { $match: matchStage },
    {
      $lookup: {
        from: 'transactions',
        let: { accountId: '$_id' },
        pipeline: [
          {
            $match: {
              $expr: {
                $or: [
                  { $eq: ['$accountId', '$$accountId'] },
                  { $eq: ['$transferAccountId', '$$accountId'] }
                ]
              }
            }
          }
        ],
        as: 'transactions'
      }
    },
    {
      $addFields: {
        currentBalance: {
          $reduce: {
            input: '$transactions',
            initialValue: '$initialBalance',
            in: {
              $add: [
                '$$value',
                {
                  $cond: [
                    { $eq: ['$$this.accountId', '$_id'] },
                    {
                      $switch: {
                        branches: [
                          { case: { $eq: ['$$this.type', 'INCOME'] }, then: '$$this.amount' },
                          { case: { $eq: ['$$this.type', 'EXPENSE'] }, then: { $multiply: ['$$this.amount', -1] } },
                          { case: { $eq: ['$$this.type', 'TRANSFER'] }, then: { $multiply: [ { $add: ['$$this.amount', { $cond: [{ $eq: ['$$this.adminFeeAccount', 'SOURCE'] }, { $ifNull: ['$$this.adminFee', 0] }, 0] }] }, -1] } },
                          { case: { $eq: ['$$this.type', 'CONVERSION'] }, then: { $multiply: [ { $add: ['$$this.amount', { $cond: [{ $eq: ['$$this.adminFeeAccount', 'SOURCE'] }, { $ifNull: ['$$this.adminFee', 0] }, 0] }] }, -1] } },
                          { case: { $eq: ['$$this.type', 'ADJUSTMENT'] }, then: '$$this.amount' }
                        ],
                        default: 0
                      }
                    },
                    {
                      $cond: [
                        { $eq: ['$$this.type', 'TRANSFER'] },
                        { $subtract: ['$$this.amount', { $cond: [{ $eq: ['$$this.adminFeeAccount', 'DESTINATION'] }, { $ifNull: ['$$this.adminFee', 0] }, 0] }] },
                        {
                          $cond: [
                            { $eq: ['$$this.type', 'CONVERSION'] },
                            { $subtract: [{ $ifNull: ['$$this.destinationAmount', '$$this.amount'] }, { $cond: [{ $eq: ['$$this.adminFeeAccount', 'DESTINATION'] }, { $ifNull: ['$$this.adminFee', 0] }, 0] }] },
                            0
                          ]
                        }
                      ]
                    }
                  ]
                }
              ]
            }
          }
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
  return await Account.findOne({ _id: id, userId });
};

const create = async (accountData) => {
  return await Account.create(accountData);
};

const update = async (account) => {
  return await account.save();
};

const deleteByIdAndUser = async (id, userId) => {
  return await Account.findOneAndDelete({ _id: id, userId });
};

module.exports = {
  getAccountsWithBalance,
  findByIdAndUser,
  create,
  update,
  deleteByIdAndUser
};
