const dashboardService = require('../services/dashboardService');

const getSummary = async (req, res) => {
  try {
    const summary = await dashboardService.getSummary(req.userId);
    res.status(200).json(summary);
  } catch (error) {
    res.status(500).json({ message: 'Error fetching summary', error: error.message });
  }
};

const getNetWorth = async (req, res) => {
  try {
    // For now, Net Worth = Total Account Balance
    // Reusing summary logic until expanded
    const summary = await dashboardService.getSummary(req.userId);
    res.status(200).json(summary);
  } catch (error) {
    res.status(500).json({ message: 'Error fetching net worth', error: error.message });
  }
};

const getMonthlyReview = async (req, res) => {
  try {
    const review = await dashboardService.getMonthlyReview(req.userId);
    res.status(200).json(review);
  } catch (error) {
    res.status(500).json({ message: 'Error fetching monthly review', error: error.message });
  }
};

const getCharts = async (req, res) => {
  try {
    const chartsData = await dashboardService.getCharts(req.userId);
    res.status(200).json(chartsData);
  } catch (error) {
    res.status(500).json({ message: 'Error fetching charts data', error: error.message });
  }
};

module.exports = {
  getSummary,
  getNetWorth,
  getMonthlyReview,
  getCharts
};
