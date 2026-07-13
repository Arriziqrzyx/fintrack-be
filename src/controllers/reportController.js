const reportService = require('../services/reportService');

const getMonthlyReport = async (req, res, next) => {
  try {
    const report = await reportService.getMonthlyReport(req.userId, req.query.year, req.query.month);
    res.status(200).json(report);
  } catch (error) {
    next(error);
  }
};

const getYearlyReport = async (req, res, next) => {
  try {
    const report = await reportService.getYearlyReport(req.userId, req.query.year);
    res.status(200).json(report);
  } catch (error) {
    next(error);
  }
};

const getCycleReport = async (req, res, next) => {
  try {
    const report = await reportService.getCycleReport(req.userId, req.params.cycleId);
    res.status(200).json(report);
  } catch (error) {
    next(error);
  }
};

module.exports = {
  getMonthlyReport,
  getYearlyReport,
  getCycleReport
};
