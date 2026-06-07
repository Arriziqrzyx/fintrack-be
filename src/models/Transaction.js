const mongoose = require('mongoose');

const transactionSchema = new mongoose.Schema(
  {
    userId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      required: true,
      index: true,
    },
    accountId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Account',
      required: true,
      index: true,
    },
    type: {
      type: String,
      enum: ['INCOME', 'EXPENSE', 'TRANSFER', 'CONVERSION', 'ADJUSTMENT'],
      required: true,
      index: true,
    },
    amount: {
      type: Number,
      required: true,
    },
    destinationAmount: {
      type: Number,
      default: null,
    },
    conversionRate: {
      type: Number,
      default: null,
    },
    assetCode: {
      type: String,
      required: true,
      default: 'IDR',
    },
    categoryId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Category',
      default: null,
    },
    note: {
      type: String,
      default: '',
    },
    transferAccountId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Account',
      default: null,
    },
    transactionDate: {
      type: Date,
      required: true,
      index: true,
    },
    adminFee: {
      type: Number,
      default: 0,
    },
    adminFeeAccount: {
      type: String,
      enum: ['SOURCE', 'DESTINATION'],
      default: 'SOURCE',
    },
  },
  {
    timestamps: true,
  }
);

const Transaction = mongoose.model('Transaction', transactionSchema);

module.exports = Transaction;
