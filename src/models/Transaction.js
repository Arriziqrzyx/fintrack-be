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
    salaryCycleId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'SalaryCycle',
      default: null,
      index: true,
    },
    isPrimarySalary: {
      type: Boolean,
      default: false,
    },
    // Multi-currency snapshots
    baseCurrency: {
      type: String,
      default: 'IDR',
    },
    baseAmount: {
      type: Number,
      default: 0,
    },
    exchangeRateSnapshot: {
      fromCurrency: { type: String, default: null },
      toCurrency: { type: String, default: null },
      exchangeRate: { type: Number, default: null },
      exchangeRateSource: { type: String, default: null },
      exchangeRateTimestamp: { type: Date, default: null },
    },
    adminFeeCurrency: {
      type: String,
      default: null,
    },
    adminFeeBaseAmount: {
      type: Number,
      default: 0,
    },
    // Balance snapshots (fixed at creation, never re-calculated)
    balanceBefore: {
      type: Number,
      default: null,
    },
    balanceAfter: {
      type: Number,
      default: null,
    },
    destBalanceBefore: {
      type: Number,
      default: null,
    },
    destBalanceAfter: {
      type: Number,
      default: null,
    },
  },
  {
    timestamps: true,
  }
);

transactionSchema.index({ userId: 1, transactionDate: -1 });
transactionSchema.index({ userId: 1, accountId: 1, transactionDate: -1 });

const Transaction = mongoose.model('Transaction', transactionSchema);

module.exports = Transaction;
