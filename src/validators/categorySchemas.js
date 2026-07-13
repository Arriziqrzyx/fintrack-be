const { z } = require('zod');

const createCategorySchema = z.object({
  name: z.string().trim().min(1, 'Name is required').max(50, 'Name must not exceed 50 characters'),
  transactionType: z.enum(['INCOME', 'EXPENSE'])
});

const updateCategorySchema = createCategorySchema.partial();

module.exports = {
  createCategorySchema,
  updateCategorySchema
};
