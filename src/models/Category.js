const mongoose = require('mongoose');

const categorySchema = new mongoose.Schema(
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
    transactionType: {
      type: String,
      enum: ['INCOME', 'EXPENSE'],
      required: true,
    },
    isDefault: {
      type: Boolean,
      default: false,
    },
  },
  {
    timestamps: true, // will add createdAt and updatedAt
  }
);

categorySchema.index({ userId: 1, transactionType: 1 });

const Category = mongoose.model('Category', categorySchema);

module.exports = Category;
