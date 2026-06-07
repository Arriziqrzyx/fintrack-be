const categoryRepository = require('../repositories/categoryRepository');

const getCategories = async (userId) => {
  return await categoryRepository.findByUserId(userId);
};

const createCategory = async (userId, data) => {
  const { name, transactionType } = data;
  if (!name || !transactionType) {
    throw new Error('Name and transactionType are required');
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
    throw new Error('Category not found');
  }
  if (category.isDefault) {
    throw new Error('Cannot update a default category');
  }
  if (name) category.name = name;
  if (transactionType) category.transactionType = transactionType;
  return await categoryRepository.update(category);
};

const deleteCategory = async (id, userId) => {
  const category = await categoryRepository.findByIdAndUser(id, userId);
  if (!category) {
    throw new Error('Category not found');
  }
  if (category.isDefault) {
    throw new Error('Cannot delete a default category');
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
