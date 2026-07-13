const authService = require('../services/authService');

const setRefreshCookie = (res, refreshToken) => {
  res.cookie('refreshToken', refreshToken, {
    httpOnly: true,
    secure: process.env.NODE_ENV === 'production',
    sameSite: 'strict',
    maxAge: 30 * 24 * 60 * 60 * 1000 // 30 days
  });
};

const fs = require('fs');
const path = require('path');

const register = async (req, res, next) => {
  try {
    const { name, username, password, secretPin } = req.body;
    const { user, tokens } = await authService.registerUser(name, username, password, secretPin);
    setRefreshCookie(res, tokens.refreshToken);
    res.status(201).json({
      message: 'Registration successful',
      accessToken: tokens.accessToken,
      user: { 
        id: user._id, 
        name: user.name,
        username: user.username,
        isSetupComplete: user.isSetupComplete,
        autoAllocationPercentage: user.autoAllocationPercentage,
        profilePicture: user.profilePicture
      }
    });
  } catch (error) {
    next(error);
  }
};

const login = async (req, res, next) => {
  try {
    const { username, password } = req.body;
    const { user, tokens } = await authService.loginUser(username, password);
    setRefreshCookie(res, tokens.refreshToken);
    res.json({
      message: 'Login successful',
      accessToken: tokens.accessToken,
      user: { 
        id: user._id, 
        name: user.name,
        username: user.username,
        isSetupComplete: user.isSetupComplete,
        autoAllocationPercentage: user.autoAllocationPercentage,
        profilePicture: user.profilePicture
      }
    });
  } catch (error) {
    next(error);
  }
};

const refresh = async (req, res, next) => {
  try {
    const { refreshToken } = req.cookies;
    const { tokens } = await authService.refreshUserToken(refreshToken);
    setRefreshCookie(res, tokens.refreshToken);
    res.json({ accessToken: tokens.accessToken });
  } catch (error) {
    next(error);
  }
};

const logout = async (req, res, next) => {
  try {
    const { refreshToken } = req.cookies;
    await authService.revokeRefreshToken(refreshToken);
  } catch (error) {
    // Silently ignore log errors on revoke during logout
  }
  res.clearCookie('refreshToken');
  res.json({ message: 'Logout successful' });
};

const me = async (req, res, next) => {
  try {
    const user = await authService.getUserProfile(req.userId);
    res.json({ 
      user: { 
        id: user._id, 
        name: user.name,
        username: user.username,
        isSetupComplete: user.isSetupComplete,
        autoAllocationPercentage: user.autoAllocationPercentage,
        profilePicture: user.profilePicture
      } 
    });
  } catch (error) {
    next(error);
  }
};

const updateProfile = async (req, res, next) => {
  try {
    const { name, currentPassword, newPassword, autoAllocationPercentage, profilePicture } = req.body;
    const updatedUser = await authService.updateUserProfile(req.userId, name, currentPassword, newPassword, autoAllocationPercentage, profilePicture);
    res.json({
      message: 'Profile updated successfully',
      user: updatedUser
    });
  } catch (error) {
    next(error);
  }
};

const setup = async (req, res, next) => {
  try {
    const user = await authService.completeSetup(req.userId, req.body);
    res.json({
      message: 'Setup completed successfully',
      user: {
        id: user._id,
        name: user.name,
        username: user.username,
        isSetupComplete: user.isSetupComplete,
        autoAllocationPercentage: user.autoAllocationPercentage,
        profilePicture: user.profilePicture
      }
    });
  } catch (error) {
    next(error);
  }
};

const getProfilePictures = async (req, res, next) => {
  try {
    const picturesDir = path.join(__dirname, '../pictures');
    const files = await fs.promises.readdir(picturesDir);
    const images = files.filter(file => file.endsWith('.jpg'));
    res.json({ pictures: images });
  } catch (error) {
    next(error);
  }
};

module.exports = {
  register,
  login,
  refresh,
  logout,
  me,
  updateProfile,
  setup,
  getProfilePictures
};
