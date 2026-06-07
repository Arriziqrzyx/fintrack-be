const mongoose = require('mongoose');

const fundTransactionSchema = new mongoose.Schema({
  userId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true,
    index: true
  },
  fundId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Fund',
    required: true,
    index: true
  },
  type: {
    type: String,
    enum: ['ALLOCATE', 'WITHDRAW', 'TRANSFER_IN', 'TRANSFER_OUT'],
    required: true,
    index: true
  },
  amount: {
    type: Number,
    required: true,
    min: 0
  },
  note: {
    type: String,
    trim: true
  },
  transferFundId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Fund',
    default: null
  },
  sourceTransactionId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Transaction',
    default: null
  }
}, { timestamps: { createdAt: true, updatedAt: false } });

module.exports = mongoose.model('FundTransaction', fundTransactionSchema);
