const { z } = require('zod');

const createAccountSchema = z.object({
  name: z.string().trim().min(1, 'Name is required').max(100, 'Name must not exceed 100 characters'),
  type: z.enum(['BANK', 'EWALLET', 'CASH', 'WALLET', 'PRECIOUS_METAL', 'OTHER']),
  assetClass: z.enum(['FIAT', 'METAL', 'CRYPTO']).default('FIAT'),
  assetCode: z.string().trim().min(1, 'Asset code is required').default('IDR'),
  unit: z.string().trim().nullable().optional(),
  initialBalance: z.number().default(0),
  isArchived: z.boolean().default(false)
});

const updateAccountSchema = createAccountSchema.partial();

const adjustBalanceSchema = z.object({
  amount: z.number({ required_error: 'Amount is required' }),
  note: z.string().trim().max(500, 'Note must not exceed 500 characters').optional().or(z.literal('')),
  transactionDate: z.string().datetime({ message: 'Invalid ISO date string format' }).optional().or(z.string().optional())
});

module.exports = {
  createAccountSchema,
  updateAccountSchema,
  adjustBalanceSchema
};
