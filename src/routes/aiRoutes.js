const express = require('express');
const router = express.Router();
const rateLimit = require('express-rate-limit');
const aiController = require('../controllers/aiController');
const { authenticate } = require('../middleware/auth');

// Rate limiter for AI routes to protect API quota under free tier
const aiLimiter = rateLimit({
  windowMs: 1 * 60 * 1000, // 1 minute
  max: 15, // Max 15 calls per minute
  message: { message: 'Waduh, pelan-pelan bro! Atmin lagi pusing. Coba lagi semenit lagi ya 😅' },
  standardHeaders: true,
  legacyHeaders: false,
});

router.post('/chat', authenticate, aiLimiter, aiController.chat);
router.get('/history', authenticate, aiLimiter, aiController.getHistory);
router.delete('/history', authenticate, aiLimiter, aiController.clearHistory);

module.exports = router;
