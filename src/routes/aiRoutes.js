const express = require('express');
const router = express.Router();
const rateLimit = require('express-rate-limit');
const aiController = require('../controllers/aiController');
const { authenticate } = require('../middleware/auth');

// Rate limiter for AI routes to protect API quota under free tier
const aiLimiter = rateLimit({
  windowMs: 1 * 60 * 1000, // 1 minute
  max: 10, // Max 10 calls per minute
  message: { message: 'Too many requests to AI helper, please try again after 1 minute' },
  keyGenerator: (req) => {
    return req.userId || req.ip;
  },
  validate: { ip: false },
  standardHeaders: true,
  legacyHeaders: false,
});

router.post('/chat', authenticate, aiLimiter, aiController.chat);
router.get('/history', authenticate, aiLimiter, aiController.getHistory);
router.delete('/history', authenticate, aiLimiter, aiController.clearHistory);

module.exports = router;
