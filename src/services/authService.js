const bcrypt = require('bcrypt');
const crypto = require('crypto');
const userRepository = require('../repositories/userRepository');
const { generateTokens, verifyRefreshToken } = require('../utils/jwt');
const Category = require('../models/Category');
const Account = require('../models/Account');
const Fund = require('../models/Fund');
const RefreshToken = require('../models/RefreshToken');

const hashToken = (token) => {
  return crypto.createHash('sha256').update(token).digest('hex');
};

const saveRefreshToken = async (userId, token) => {
  const tokenHash = hashToken(token);
  const expiresAt = new Date(Date.now() + 30 * 24 * 60 * 60 * 1000); // 30 days
  await RefreshToken.create({
    userId,
    tokenHash,
    expiresAt
  });
};

const registerUser = async (name, username, password, secretPin) => {
  if (!name || !username || !password || !secretPin) {
    throw new Error('Name, username, password, and secret PIN are required');
  }

  if (secretPin !== process.env.SECRET_PIN) {
    throw new Error('Invalid secret PIN');
  }

  const existingUser = await userRepository.findByUsername(username);
  if (existingUser) {
    throw new Error('Username already registered');
  }

  const passwordHash = await bcrypt.hash(password, 10);
  const user = await userRepository.create({
    name: name.trim(),
    username: username.toLowerCase(),
    passwordHash
  });
  
  const tokens = generateTokens(user._id);
  await saveRefreshToken(user._id, tokens.refreshToken);
  return { user, tokens };
};

const loginUser = async (username, password) => {
  if (!username || !password) {
    throw new Error('Username and password are required');
  }
  const user = await userRepository.findByUsername(username);
  if (!user) {
    throw new Error('Invalid credentials');
  }
  const isMatch = await bcrypt.compare(password, user.passwordHash);
  if (!isMatch) {
    throw new Error('Invalid credentials');
  }
  
  const tokens = generateTokens(user._id);
  await saveRefreshToken(user._id, tokens.refreshToken);
  return { user, tokens };
};

const refreshUserToken = async (refreshToken) => {
  if (!refreshToken) {
    throw new Error('Refresh token not found');
  }
  const decoded = verifyRefreshToken(refreshToken);
  const user = await userRepository.findById(decoded.userId);
  if (!user) {
    throw new Error('User not found');
  }

  // Hash & cari token di database
  const tokenHash = hashToken(refreshToken);
  const storedToken = await RefreshToken.findOne({ tokenHash, userId: user._id });
  if (!storedToken) {
    throw new Error('Invalid or expired refresh token session');
  }

  // Hapus token lama (Rotation)
  await RefreshToken.deleteOne({ _id: storedToken._id });

  // Buat token baru
  const tokens = generateTokens(user._id);
  await saveRefreshToken(user._id, tokens.refreshToken);
  
  return { tokens };
};

const revokeRefreshToken = async (refreshToken) => {
  if (!refreshToken) return;
  const tokenHash = hashToken(refreshToken);
  await RefreshToken.deleteOne({ tokenHash });
};

const getUserProfile = async (userId) => {
  const user = await userRepository.findByIdWithoutPassword(userId);
  if (!user) {
    throw new Error('User not found');
  }
  return user;
};

const updateUserProfile = async (userId, name, currentPassword, newPassword) => {
  const user = await userRepository.findById(userId);
  if (!user) {
    throw new Error('User not found');
  }

  if (name && name.trim().length > 0) {
    user.name = name.trim();
  }

  if (newPassword) {
    if (!currentPassword) {
      throw new Error('Current password is required to set a new password');
    }
    const isMatch = await bcrypt.compare(currentPassword, user.passwordHash);
    if (!isMatch) {
      throw new Error('Incorrect current password');
    }
    user.passwordHash = await bcrypt.hash(newPassword, 10);
  }

  await user.save();
  return {
    id: user._id,
    name: user.name,
    username: user.username,
    isSetupComplete: user.isSetupComplete,
    autoAllocationPercentage: user.autoAllocationPercentage
  };
};

const completeSetup = async (userId, { categories, autoAllocationPercentage, accounts, funds }) => {
  if (!categories || !Array.isArray(categories)) {
    throw new Error('Categories array is required');
  }

  // Clear existing categories
  await Category.deleteMany({ userId });
  
  // Insert new categories
  const categoriesToInsert = categories.map(cat => ({
    userId,
    name: cat.name,
    transactionType: cat.transactionType,
    isDefault: false
  }));
  await Category.insertMany(categoriesToInsert);

  // Insert accounts if provided
  if (accounts && Array.isArray(accounts) && accounts.length > 0) {
    const accountsToInsert = accounts.map(acc => ({
      userId,
      name: acc.name,
      type: acc.type || 'CASH',
      assetClass: 'FIAT',
      assetCode: 'IDR',
      initialBalance: acc.initialBalance || 0
    }));
    await Account.insertMany(accountsToInsert);
  }

  // Insert funds if provided
  if (funds && Array.isArray(funds) && funds.length > 0) {
    const fundsToInsert = funds.map(fund => ({
      userId,
      name: fund.name,
      type: fund.type || 'GOAL',
      targetAmount: fund.targetAmount || 0,
      status: 'ACTIVE'
    }));
    await Fund.insertMany(fundsToInsert);
  }

  // Update user
  const user = await userRepository.findById(userId);
  user.isSetupComplete = true;
  if (autoAllocationPercentage !== undefined) {
    user.autoAllocationPercentage = Number(autoAllocationPercentage);
  }
  await user.save();

  return user;
};

module.exports = {
  registerUser,
  loginUser,
  refreshUserToken,
  getUserProfile,
  updateUserProfile,
  completeSetup,
  revokeRefreshToken
};
