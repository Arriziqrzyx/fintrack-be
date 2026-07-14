const mongoose = require('mongoose');

const userSchema = new mongoose.Schema({
  name: {
    type: String,
    required: true,
    trim: true,
  },
  username: {
    type: String,
    required: true,
    unique: true,
    trim: true,
    lowercase: true,
  },
  passwordHash: {
    type: String,
    required: true,
  },
  isSetupComplete: {
    type: Boolean,
    default: false
  },
  autoAllocationPercentage: {
    type: Number,
    default: 0
  },
  profilePicture: {
    type: String,
    default: 'cat-001.jpg'
  },
  notificationSettings: {
    dailyReminder: { type: Boolean, default: true },
    salaryCycle: { type: Boolean, default: true },
    spendingAnomaly: { type: Boolean, default: true },
    weeklyInsight: { type: Boolean, default: true },
    largeTransaction: { type: Boolean, default: true },
    duplicateTransaction: { type: Boolean, default: true },
    largeTransactionThreshold: { type: Number, default: 2000000 }
  },
  pushSubscriptions: [
    {
      endpoint: { type: String, required: true },
      keys: {
        p256dh: { type: String, required: true },
        auth: { type: String, required: true }
      }
    }
  ],
  lastNotificationSent: {
    dailyReminder: { type: Date, default: null },
    salaryCycle: { type: Date, default: null },
    spendingAnomaly: { type: Date, default: null },
    weeklyInsight: { type: Date, default: null },
    largeTransaction: { type: Date, default: null },
    duplicateTransaction: { type: Date, default: null }
  }
}, {
  timestamps: true // adds createdAt and updatedAt
});

const User = mongoose.model('User', userSchema);

module.exports = User;
