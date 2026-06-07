const categoryService = require('../services/categoryService');

const getCategories = async (req, res) => {
  try {
    const categories = await categoryService.getCategories(req.userId);
    res.status(200).json(categories);
  } catch (error) {
    res.status(500).json({ message: 'Error fetching categories', error: error.message });
  }
};

const createCategory = async (req, res) => {
  try {
    const category = await categoryService.createCategory(req.userId, req.body);
    res.status(201).json(category);
  } catch (error) {
    const status = error.message.includes('required') ? 400 : 500;
    res.status(status).json({ message: error.message || 'Error creating category' });
  }
};

const updateCategory = async (req, res) => {
  try {
    const category = await categoryService.updateCategory(req.params.id, req.userId, req.body);
    res.status(200).json(category);
  } catch (error) {
    const status = error.message === 'Category not found' ? 404 : error.message.includes('Cannot') ? 403 : 500;
    res.status(status).json({ message: error.message || 'Error updating category' });
  }
};

const deleteCategory = async (req, res) => {
  try {
    await categoryService.deleteCategory(req.params.id, req.userId);
    res.status(200).json({ message: 'Category deleted successfully' });
  } catch (error) {
    const status = error.message === 'Category not found' ? 404 : error.message.includes('Cannot') ? 403 : 500;
    res.status(status).json({ message: error.message || 'Error deleting category' });
  }
};

module.exports = {
  getCategories,
  createCategory,
  updateCategory,
  deleteCategory
};
