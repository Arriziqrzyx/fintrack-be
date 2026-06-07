const Category = require('../models/Category');

const findByUserId = async (userId) => {
  return await Category.find({ userId }).sort({ transactionType: 1, name: 1 });
};

const findByIdAndUser = async (id, userId) => {
  return await Category.findOne({ _id: id, userId });
};

const create = async (categoryData) => {
  return await Category.create(categoryData);
};

const update = async (category) => {
  return await category.save();
};

const deleteCategory = async (category) => {
  return await category.deleteOne();
};

module.exports = {
  findByUserId,
  findByIdAndUser,
  create,
  update,
  deleteCategory
};
