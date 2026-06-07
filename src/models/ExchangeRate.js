const mongoose = require('mongoose');

const exchangeRateSchema = new mongoose.Schema(
  {
    baseCurrency: {
      type: String,
      required: true,
      default: 'USD',
      index: true,
    },
    rates: {
      type: Map,
      of: Number,
      required: true,
    },
    lastUpdated: {
      type: Date,
      required: true,
      default: Date.now,
    },
  },
  {
    timestamps: true,
  }
);

const ExchangeRate = mongoose.model('ExchangeRate', exchangeRateSchema);

module.exports = ExchangeRate;
