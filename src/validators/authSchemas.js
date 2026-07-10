const { z } = require('zod');

const registerSchema = z.object({
  name: z.string()
    .trim()
    .min(1, 'Name is required')
    .max(100, 'Name must not exceed 100 characters'),
  username: z.string()
    .trim()
    .toLowerCase()
    .min(3, 'Username must be at least 3 characters')
    .max(30, 'Username must not exceed 30 characters')
    .regex(/^[a-zA-Z0-9_]+$/, 'Username can only contain letters, numbers, and underscores'),
  password: z.string()
    .min(8, 'Password must be at least 8 characters')
    .max(128, 'Password must not exceed 128 characters'),
  secretPin: z.string()
    .min(1, 'Secret PIN is required'),
  email: z.string()
    .trim()
    .lowercase()
    .email('Invalid email format')
    .optional()
    .or(z.literal('')) // allow empty string
});

const loginSchema = z.object({
  username: z.string()
    .trim()
    .min(1, 'Username is required'),
  password: z.string()
    .min(1, 'Password is required')
});

module.exports = {
  registerSchema,
  loginSchema
};
