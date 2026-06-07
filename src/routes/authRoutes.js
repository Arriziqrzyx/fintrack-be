const express = require('express');
const rateLimit = require('express-rate-limit');
const { register, login, refresh, logout, me, updateProfile, setup } = require('../controllers/authController');
const { authenticate } = require('../middleware/auth');

const router = express.Router();

// Anti-DDoS / Bruteforce limiter for Auth endpoints
const authLimiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 10, // Limit each IP to 10 requests per `window` (here, per 15 minutes)
  message: { message: 'Too many requests from this IP, please try again after 15 minutes' },
  standardHeaders: true, // Return rate limit info in the `RateLimit-*` headers
  legacyHeaders: false, // Disable the `X-RateLimit-*` headers
});

router.post('/register', authLimiter, register);
router.post('/login', authLimiter, login);
router.post('/refresh', refresh);
router.post('/logout', logout);
router.get('/me', authenticate, me);
router.put('/profile', authenticate, updateProfile);
router.post('/setup', authenticate, setup);

module.exports = router;
