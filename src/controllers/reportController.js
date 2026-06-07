const reportService = require('../services/reportService');

const getMonthlyReport = async (req, res) => {
  try {
    const report = await reportService.getMonthlyReport(req.userId, req.query.year, req.query.month);
    res.status(200).json(report);
  } catch (error) {
    res.status(500).json({ message: 'Error generating monthly report', error: error.message });
  }
};

const getYearlyReport = async (req, res) => {
  try {
    const report = await reportService.getYearlyReport(req.userId, req.query.year);
    res.status(200).json(report);
  } catch (error) {
    res.status(500).json({ message: 'Error generating yearly report', error: error.message });
  }
};

module.exports = {
  getMonthlyReport,
  getYearlyReport
};
