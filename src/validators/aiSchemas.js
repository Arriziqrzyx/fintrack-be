const { z } = require('zod');

const chatSchema = z.object({
  messages: z.array(
    z.object({
      role: z.enum(['user', 'assistant']),
      content: z.string().min(1, 'Message content cannot be empty').max(2000, 'Message content must not exceed 2000 characters')
    })
  ).min(1, 'Messages array is required')
});

module.exports = {
  chatSchema
};
