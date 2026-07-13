const bcrypt = require('bcrypt');
const crypto = require('crypto');
const userRepository = require('../repositories/userRepository');
const { generateTokens, verifyRefreshToken } = require('../utils/jwt');
const Category = require('../models/Category');
const Account = require('../models/Account');
const Fund = require('../models/Fund');
const RefreshToken = require('../models/RefreshToken');
const AppError = require('../utils/AppError');

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
    throw new AppError('Name, username, password, and secret PIN are required', 400);
  }

  if (secretPin !== process.env.SECRET_PIN) {
    throw new AppError('Invalid secret PIN', 400);
  }

  const existingUser = await userRepository.findByUsername(username);
  if (existingUser) {
    throw new AppError('Username already registered', 400);
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
    throw new AppError('Username and password are required', 400);
  }
  const user = await userRepository.findByUsername(username);
  if (!user) {
    throw new AppError('Invalid credentials', 401);
  }
  const isMatch = await bcrypt.compare(password, user.passwordHash);
  if (!isMatch) {
    throw new AppError('Invalid credentials', 401);
  }
  
  const tokens = generateTokens(user._id);
  await saveRefreshToken(user._id, tokens.refreshToken);
  return { user, tokens };
};

const refreshUserToken = async (refreshToken) => {
  if (!refreshToken) {
    throw new AppError('Refresh token not found', 401);
  }
  const decoded = verifyRefreshToken(refreshToken);
  const user = await userRepository.findById(decoded.userId);
  if (!user) {
    throw new AppError('User not found', 404);
  }

  // Hash & cari token di database
  const tokenHash = hashToken(refreshToken);
  const storedToken = await RefreshToken.findOne({ tokenHash, userId: user._id });
  if (!storedToken) {
    throw new AppError('Invalid or expired refresh token session', 401);
  }

  // Hapus token lama (Rotation)
  await RefreshToken.deleteOne({ _id: storedToken._id });

  // Buat token baru
  const tokens = generateTokens(user._id);
  try {
    await saveRefreshToken(user._id, tokens.refreshToken);
  } catch (error) {
    if (error.code !== 11000) {
      throw error;
    }
  }
  
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
    throw new AppError('User not found', 404);
  }
  return user;
};

const ALLOWED_PROFILE_PICTURES = [
  'cat-001.jpg', 'cat-002.jpg', 'cat-003.jpg', 'cat-004.jpg',
  'cat-005.jpg', 'cat-006.jpg', 'cat-007.jpg', 'cat-008.jpg'
];

const updateUserProfile = async (userId, name, currentPassword, newPassword, autoAllocationPercentage, profilePicture) => {
  const user = await userRepository.findById(userId);
  if (!user) {
    throw new AppError('User not found', 404);
  }

  if (name && name.trim().length > 0) {
    user.name = name.trim();
  }

  if (autoAllocationPercentage !== undefined) {
    const percentage = Number(autoAllocationPercentage);
    if (isNaN(percentage) || percentage < 0 || percentage > 100) {
      throw new AppError('Auto allocation percentage must be between 0 and 100', 400);
    }
    user.autoAllocationPercentage = percentage;
  }

  if (profilePicture !== undefined) {
    if (!ALLOWED_PROFILE_PICTURES.includes(profilePicture)) {
      throw new AppError('Invalid profile picture selection', 400);
    }
    user.profilePicture = profilePicture;
  }

  if (newPassword) {
    if (!currentPassword) {
      throw new AppError('Current password is required to set a new password', 400);
    }
    const isMatch = await bcrypt.compare(currentPassword, user.passwordHash);
    if (!isMatch) {
      throw new AppError('Incorrect current password', 400);
    }
    user.passwordHash = await bcrypt.hash(newPassword, 10);
  }

  await user.save();
  return {
    id: user._id,
    name: user.name,
    username: user.username,
    isSetupComplete: user.isSetupComplete,
    autoAllocationPercentage: user.autoAllocationPercentage,
    profilePicture: user.profilePicture
  };
};

const completeSetup = async (userId, { categories, autoAllocationPercentage, accounts, funds }) => {
  if (!categories || !Array.isArray(categories)) {
    throw new AppError('Categories array is required', 400);
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
