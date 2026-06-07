const express = require('express');
const router = express.Router();
const { getMonthlyReport, getYearlyReport } = require('../controllers/reportController');
const { authenticate } = require('../middleware/auth');

router.use(authenticate);

router.get('/monthly', getMonthlyReport);
router.get('/yearly', getYearlyReport);

module.exports = router;
