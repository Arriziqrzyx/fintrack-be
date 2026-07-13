const dashboardService = require('../services/dashboardService');

const getSummary = async (req, res, next) => {
  try {
    const summary = await dashboardService.getSummary(req.userId);
    res.status(200).json(summary);
  } catch (error) {
    next(error);
  }
};

const getNetWorth = async (req, res, next) => {
  try {
    const summary = await dashboardService.getSummary(req.userId);
    res.status(200).json(summary);
  } catch (error) {
    next(error);
  }
};

const getMonthlyReview = async (req, res, next) => {
  try {
    const review = await dashboardService.getMonthlyReview(req.userId);
    res.status(200).json(review);
  } catch (error) {
    next(error);
  }
};

const getCharts = async (req, res, next) => {
  try {
    const chartsData = await dashboardService.getCharts(req.userId);
    res.status(200).json(chartsData);
  } catch (error) {
    next(error);
  }
};

module.exports = {
  getSummary,
  getNetWorth,
  getMonthlyReview,
  getCharts
};
