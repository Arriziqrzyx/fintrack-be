const mongoose = require('mongoose');

const accountSchema = new mongoose.Schema(
  {
    userId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      required: true,
      index: true,
    },
    name: {
      type: String,
      required: true,
      trim: true,
    },
    type: {
      type: String,
      enum: ['BANK', 'EWALLET', 'CASH', 'WALLET', 'PRECIOUS_METAL', 'OTHER'],
      required: true,
    },
    assetClass: {
      type: String,
      enum: ['FIAT', 'METAL', 'CRYPTO'],
      default: 'FIAT',
      required: true,
    },
    assetCode: {
      type: String,
      default: 'IDR',
      required: true,
    },
    unit: {
      type: String,
      default: null,
    },
    initialBalance: {
      type: Number,
      default: 0,
    },
    isArchived: {
      type: Boolean,
      default: false,
    },
  },
  {
    timestamps: true,
  }
);

const Account = mongoose.model('Account', accountSchema);

module.exports = Account;
