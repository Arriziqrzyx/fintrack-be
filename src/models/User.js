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
  }
}, {
  timestamps: true // adds createdAt and updatedAt
});

const User = mongoose.model('User', userSchema);

module.exports = User;
