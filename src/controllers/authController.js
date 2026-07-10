const authService = require('../services/authService');

const setRefreshCookie = (res, refreshToken) => {
  res.cookie('refreshToken', refreshToken, {
    httpOnly: true,
    secure: process.env.NODE_ENV === 'production',
    sameSite: 'strict',
    maxAge: 30 * 24 * 60 * 60 * 1000 // 30 days
  });
};

const register = async (req, res) => {
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
        autoAllocationPercentage: user.autoAllocationPercentage
      }
    });
  } catch (error) {
    const status = error.message.includes('required') || error.message.includes('registered') || error.message.includes('Invalid secret PIN') ? 400 : 500;
    res.status(status).json({ message: error.message || 'Server error during registration' });
  }
};

const login = async (req, res) => {
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
        autoAllocationPercentage: user.autoAllocationPercentage
      }
    });
  } catch (error) {
    const status = error.message.includes('credentials') || error.message.includes('required') ? 401 : 500;
    res.status(status).json({ message: error.message || 'Server error during login' });
  }
};

const refresh = async (req, res) => {
  try {
    const { refreshToken } = req.cookies;
    const { tokens } = await authService.refreshUserToken(refreshToken);
    setRefreshCookie(res, tokens.refreshToken);
    res.json({ accessToken: tokens.accessToken });
  } catch (error) {
    res.status(401).json({ message: error.message || 'Invalid or expired refresh token' });
  }
};

const logout = async (req, res) => {
  try {
    const { refreshToken } = req.cookies;
    await authService.revokeRefreshToken(refreshToken);
  } catch (error) {
    // Silently ignore log errors on revoke during logout
  }
  res.clearCookie('refreshToken');
  res.json({ message: 'Logout successful' });
};

const me = async (req, res) => {
  try {
    const user = await authService.getUserProfile(req.userId);
    res.json({ 
      user: { 
        id: user._id, 
        name: user.name,
        username: user.username,
        isSetupComplete: user.isSetupComplete,
        autoAllocationPercentage: user.autoAllocationPercentage
      } 
    });
  } catch (error) {
    const status = error.message === 'User not found' ? 404 : 500;
    res.status(status).json({ message: error.message || 'Server error fetching user profile' });
  }
};

const updateProfile = async (req, res) => {
  try {
    const { name, currentPassword, newPassword } = req.body;
    const updatedUser = await authService.updateUserProfile(req.userId, name, currentPassword, newPassword);
    res.json({
      message: 'Profile updated successfully',
      user: updatedUser
    });
  } catch (error) {
    const status = error.message.includes('password') ? 400 : 500;
    res.status(status).json({ message: error.message || 'Server error updating profile' });
  }
};

const setup = async (req, res) => {
  try {
    const user = await authService.completeSetup(req.userId, req.body);
    res.json({
      message: 'Setup completed successfully',
      user: {
        id: user._id,
        name: user.name,
        username: user.username,
        isSetupComplete: user.isSetupComplete,
        autoAllocationPercentage: user.autoAllocationPercentage
      }
    });
  } catch (error) {
    const status = error.message.includes('required') ? 400 : 500;
    res.status(status).json({ message: error.message || 'Server error during setup' });
  }
};

module.exports = {
  register,
  login,
  refresh,
  logout,
  me,
  updateProfile,
  setup
};
