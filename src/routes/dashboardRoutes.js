const express = require('express');
const router = express.Router();
const {
  getSummary,
  getNetWorth,
  getMonthlyReview,
  getCharts
} = require('../controllers/dashboardController');
const { authenticate } = require('../middleware/auth');

router.use(authenticate);

router.get('/summary', getSummary);
router.get('/net-worth', getNetWorth);
router.get('/monthly-review', getMonthlyReview);
router.get('/charts', getCharts);

module.exports = router;
