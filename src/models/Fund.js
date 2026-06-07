const mongoose = require('mongoose');

const fundSchema = new mongoose.Schema({
  userId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true,
    index: true
  },
  name: {
    type: String,
    required: true,
    trim: true
  },
  type: {
    type: String,
    enum: ['EMERGENCY', 'GOAL', 'INVESTMENT'],
    required: true
  },
  targetAmount: {
    type: Number,
    required: true,
    default: 0
  },
  targetDate: {
    type: Date,
    default: null
  },
  status: {
    type: String,
    enum: ['ACTIVE', 'COMPLETED', 'ARCHIVED'],
    default: 'ACTIVE',
    index: true
  }
}, { timestamps: true });

// Create compound indexes
fundSchema.index({ userId: 1, type: 1 });

module.exports = mongoose.model('Fund', fundSchema);
