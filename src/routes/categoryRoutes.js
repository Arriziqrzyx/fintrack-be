const express = require('express');
const router = express.Router();
const {
  getCategories,
  createCategory,
  updateCategory,
  deleteCategory
} = require('../controllers/categoryController');
const { authenticate } = require('../middleware/auth');

const { validateBody } = require('../middleware/validationMiddleware');
const { createCategorySchema, updateCategorySchema } = require('../validators/categorySchemas');

// Protect all category routes
router.use(authenticate);

// Routes for /api/categories
router.route('/')
  .get(getCategories)
  .post(validateBody(createCategorySchema), createCategory);

router.route('/:id')
  .put(validateBody(updateCategorySchema), updateCategory)
  .delete(deleteCategory);

module.exports = router;
