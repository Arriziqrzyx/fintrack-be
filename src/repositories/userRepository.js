const User = require('../models/User');

const findByUsername = async (username) => {
  return await User.findOne({ username: username.toLowerCase() });
};

const create = async (userData) => {
  return await User.create(userData);
};

const findById = async (id) => {
  return await User.findById(id);
};

const findByIdWithoutPassword = async (id) => {
  return await User.findById(id).select('-passwordHash');
};

const update = async (id, updateData) => {
  return await User.findByIdAndUpdate(id, updateData, { new: true });
};

module.exports = {
  findByUsername,
  create,
  findById,
  findByIdWithoutPassword,
  update
};
