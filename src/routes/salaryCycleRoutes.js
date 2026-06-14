const express = require('express');
const router = express.Router();
const { getActiveCycle, getAllCycles, getCycleById, forceRebuild } = require('../controllers/salaryCycleController');
const { authenticate } = require('../middleware/auth');

router.use(authenticate);

router.get('/active', getActiveCycle);
router.get('/', getAllCycles);
router.post('/rebuild', forceRebuild); // useful for manual syncing if needed
router.get('/:id', getCycleById);

module.exports = router;
