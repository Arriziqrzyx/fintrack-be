const categoryRepository = require('../repositories/categoryRepository');
const AppError = require('../utils/AppError');

const getCategories = async (userId) => {
  return await categoryRepository.findByUserId(userId);
};

const createCategory = async (userId, data) => {
  const { name, transactionType } = data;
  if (!name || !transactionType) {
    throw new AppError('Name and transactionType are required', 400);
  }
  return await categoryRepository.create({
    userId,
    name,
    transactionType,
    isDefault: false
  });
};

const updateCategory = async (id, userId, data) => {
  const { name, transactionType } = data;
  const category = await categoryRepository.findByIdAndUser(id, userId);
  if (!category) {
    throw new AppError('Category not found', 404);
  }
  if (category.isDefault) {
    throw new AppError('Cannot update a default category', 403);
  }
  if (name) category.name = name;
  if (transactionType) category.transactionType = transactionType;
  return await categoryRepository.update(category);
};

const deleteCategory = async (id, userId) => {
  const category = await categoryRepository.findByIdAndUser(id, userId);
  if (!category) {
    throw new AppError('Category not found', 404);
  }
  if (category.isDefault) {
    throw new AppError('Cannot delete a default category', 403);
  }
  await categoryRepository.deleteCategory(category);
  return true;
};

module.exports = {
  getCategories,
  createCategory,
  updateCategory,
  deleteCategory
};
