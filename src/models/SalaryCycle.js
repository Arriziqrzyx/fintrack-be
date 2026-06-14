const mongoose = require('mongoose');

const salaryCycleSchema = new mongoose.Schema(
  {
    userId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      required: true,
      index: true,
    },
    name: {
      type: String, // e.g., "May 2026"
      required: true,
    },
    startDate: {
      type: Date,
      required: true,
    },
    endDate: {
      type: Date,
      default: null, // null means it's the currently active cycle
    },
    salaryTransactionId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Transaction',
      required: true,
    },
  },
  {
    timestamps: true,
  }
);

salaryCycleSchema.index({ userId: 1, startDate: 1 });
salaryCycleSchema.index({ userId: 1, endDate: 1 });

const SalaryCycle = mongoose.model('SalaryCycle', salaryCycleSchema);

module.exports = SalaryCycle;
