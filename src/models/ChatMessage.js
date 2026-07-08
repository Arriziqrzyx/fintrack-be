const mongoose = require('mongoose');

const chatMessageSchema = new mongoose.Schema(
  {
    userId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      required: true,
      index: true,
    },
    role: {
      type: String,
      enum: ['user', 'assistant'],
      required: true,
    },
    content: {
      type: String,
      required: true,
    },
  },
  {
    timestamps: true, // Auto-adds createdAt and updatedAt
  }
);

// Index to quickly fetch recent history for a user sorted by creation time
chatMessageSchema.index({ userId: 1, createdAt: -1 });

// TTL Index: Automatically delete chat messages older than 30 days (30 * 24 * 3600 seconds)
// This keeps the MongoDB database storage footprint small and clean without manual cron jobs.
chatMessageSchema.index({ createdAt: 1 }, { expireAfterSeconds: 2592000 });

module.exports = mongoose.model('ChatMessage', chatMessageSchema);
