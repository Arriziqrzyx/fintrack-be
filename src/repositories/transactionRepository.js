const Transaction = require('../models/Transaction');

const getTransactions = async (query, skip = 0, limit = 0, sort = { transactionDate: -1, createdAt: -1 }) => {
  let dbQuery = Transaction.find(query)
    .sort(sort)
    .populate('categoryId', 'name transactionType isDefault')
    .populate('accountId', 'name type assetCode unit')
    .populate('transferAccountId', 'name type assetCode unit');
    
  if (skip > 0) dbQuery = dbQuery.skip(skip);
  if (limit > 0) dbQuery = dbQuery.limit(limit);
  
  return await dbQuery;
};

const countTransactions = async (query) => {
  return await Transaction.countDocuments(query);
};

const getTransactionByIdAndUser = async (id, userId) => {
  return await Transaction.findOne({ _id: id, userId })
    .populate('categoryId', 'name transactionType')
    .populate('accountId', 'name')
    .populate('transferAccountId', 'name');
};

const create = async (data) => {
  return await Transaction.create(data);
};

const update = async (transaction) => {
  return await transaction.save();
};

const deleteByIdAndUser = async (id, userId) => {
  return await Transaction.findOneAndDelete({ _id: id, userId });
};

module.exports = {
  getTransactions,
  countTransactions,
  getTransactionByIdAndUser,
  create,
  update,
  deleteByIdAndUser
};
