const express = require('express');
const router = express.Router();
const {
  getCategories,
  createCategory,
  updateCategory,
  deleteCategory
} = require('../controllers/categoryController');
const { authenticate } = require('../middleware/auth');

// Protect all category routes
router.use(authenticate);

// Routes for /api/categories
router.route('/')
  .get(getCategories)
  .post(createCategory);

router.route('/:id')
  .put(updateCategory)
  .delete(deleteCategory);

module.exports = router;
