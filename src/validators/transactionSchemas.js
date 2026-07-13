const { z } = require('zod');

const baseTransactionSchema = z.object({
  accountId: z.string().trim().min(1, 'Account ID is required'),
  type: z.enum(['INCOME', 'EXPENSE', 'TRANSFER', 'ADJUSTMENT']),
  amount: z.number().positive('Amount must be greater than 0'),
  categoryId: z.string().trim().nullable().optional(),
  note: z.string().trim().max(500, 'Note must not exceed 500 characters').optional().or(z.literal('')),
  transferAccountId: z.string().trim().nullable().optional(),
  transactionDate: z.string().datetime({ message: 'Invalid ISO date string format' }).or(z.string().min(1, 'Transaction date is required')),
  isPrimarySalary: z.boolean().optional(),
  adminFee: z.number().nonnegative('Admin fee must be 0 or positive').optional(),
  adminFeeAccount: z.enum(['SOURCE', 'DESTINATION']).optional()
});

const createTransactionSchema = baseTransactionSchema.refine(data => {
  if (data.type === 'INCOME' || data.type === 'EXPENSE') {
    return !!data.categoryId;
  }
  return true;
}, {
  message: 'Category is required for income/expense',
  path: ['categoryId']
}).refine(data => {
  if (data.type === 'TRANSFER') {
    return !!data.transferAccountId;
  }
  return true;
}, {
  message: 'Transfer target account is required for transfers',
  path: ['transferAccountId']
});

const updateTransactionSchema = baseTransactionSchema.partial().refine(data => {
  if ((data.type === 'INCOME' || data.type === 'EXPENSE') && data.categoryId === undefined) {
    return false;
  }
  return true;
}, {
  message: 'Category is required for income/expense',
  path: ['categoryId']
}).refine(data => {
  if (data.type === 'TRANSFER' && data.transferAccountId === undefined) {
    return false;
  }
  return true;
}, {
  message: 'Transfer target account is required for transfers',
  path: ['transferAccountId']
});

const createConversionSchema = z.object({
  accountId: z.string().trim().min(1, 'Source asset account is required'),
  transferAccountId: z.string().trim().min(1, 'Destination liquid account is required'),
  amount: z.number().positive('Amount must be greater than 0'),
  destinationAmount: z.number().positive('Destination amount must be greater than 0'),
  conversionRate: z.number().positive('Conversion rate must be greater than 0'),
  adminFee: z.number().nonnegative('Admin fee must be 0 or positive').optional(),
  adminFeeAccount: z.enum(['SOURCE', 'DESTINATION']).optional(),
  note: z.string().trim().max(500, 'Note must not exceed 500 characters').optional().or(z.literal('')),
  transactionDate: z.string().datetime({ message: 'Invalid ISO date string format' }).optional().or(z.string().optional())
});

module.exports = {
  createTransactionSchema,
  updateTransactionSchema,
  createConversionSchema
};
