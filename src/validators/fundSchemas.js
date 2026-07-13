const { z } = require('zod');

const createFundSchema = z.object({
  name: z.string().trim().min(1, 'Name is required').max(100, 'Name must not exceed 100 characters'),
  type: z.enum(['EMERGENCY', 'GOAL', 'INVESTMENT']),
  targetAmount: z.number().nonnegative('Target amount must be 0 or positive').default(0),
  targetDate: z.string().datetime({ message: 'Invalid ISO date string format' }).nullable().optional().or(z.string().nullable().optional())
});

const updateFundSchema = createFundSchema.partial().extend({
  status: z.enum(['ACTIVE', 'COMPLETED', 'ARCHIVED']).optional()
});

const allocateFundSchema = z.object({
  amount: z.number().positive('Allocation amount must be greater than 0'),
  note: z.string().trim().max(500, 'Note must not exceed 500 characters').optional().or(z.literal(''))
});

const withdrawFundSchema = z.object({
  amount: z.number().positive('Withdrawal amount must be greater than 0'),
  note: z.string().trim().max(500, 'Note must not exceed 500 characters').optional().or(z.literal(''))
});

const transferFundSchema = z.object({
  sourceFundId: z.string().trim().min(1, 'Source fund is required'),
  destinationFundId: z.string().trim().min(1, 'Destination fund is required'),
  amount: z.number().positive('Transfer amount must be greater than 0'),
  note: z.string().trim().max(500, 'Note must not exceed 500 characters').optional().or(z.literal(''))
}).refine(data => data.sourceFundId !== data.destinationFundId, {
  message: 'Source and destination funds cannot be the same',
  path: ['destinationFundId']
});

module.exports = {
  createFundSchema,
  updateFundSchema,
  allocateFundSchema,
  withdrawFundSchema,
  transferFundSchema
};
