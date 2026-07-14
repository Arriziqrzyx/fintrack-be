const express = require('express');
const { getVapidPublicKey, subscribe, getSettings, updateSettings } = require('../controllers/notificationController');
const { authenticate } = require('../middleware/auth');

const router = express.Router();

router.get('/vapid-public-key', getVapidPublicKey);
router.post('/subscribe', authenticate, subscribe);
router.get('/settings', authenticate, getSettings);
router.put('/settings', authenticate, updateSettings);

module.exports = router;
