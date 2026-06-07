const reportRepository = require('../repositories/reportRepository');

const getMonthlyReport = async (userId, year, month) => {
  const targetYear = year ? parseInt(year) : new Date().getFullYear();
  const targetMonth = month ? parseInt(month) : new Date().getMonth() + 1;
  
  const startDate = new Date(targetYear, targetMonth - 1, 1);
  const endDate = new Date(targetYear, targetMonth, 0, 23, 59, 59, 999);

  const summaryAgg = await reportRepository.getMonthlySummary(userId, startDate, endDate);
  
  let totalIncome = 0;
  let totalExpense = 0;
  
  summaryAgg.forEach(item => {
    if (item._id === 'INCOME') totalIncome = item.total;
    if (item._id === 'EXPENSE') totalExpense = item.total;
  });

  const categoryBreakdown = await reportRepository.getCategoryBreakdown(userId, startDate, endDate);

  return {
    period: { year: targetYear, month: targetMonth },
    summary: {
      totalIncome,
      totalExpense,
      netBalance: totalIncome - totalExpense
    },
    expenseByCategory: categoryBreakdown
  };
};

const getYearlyReport = async (userId, year) => {
  const targetYear = year ? parseInt(year) : new Date().getFullYear();
  const startDate = new Date(targetYear, 0, 1);
  const endDate = new Date(targetYear, 11, 31, 23, 59, 59, 999);

  const monthlyTrends = await reportRepository.getMonthlyTrends(userId, startDate, endDate);

  const trends = Array.from({ length: 12 }, (_, i) => ({
    month: i + 1,
    income: 0,
    expense: 0
  }));

  let totalYearlyIncome = 0;
  let totalYearlyExpense = 0;

  monthlyTrends.forEach(item => {
    const monthIndex = item._id.month - 1;
    if (item._id.type === 'INCOME') {
      trends[monthIndex].income = item.total;
      totalYearlyIncome += item.total;
    } else if (item._id.type === 'EXPENSE') {
      trends[monthIndex].expense = item.total;
      totalYearlyExpense += item.total;
    }
  });

  return {
    year: targetYear,
    summary: {
      totalYearlyIncome,
      totalYearlyExpense,
      netBalance: totalYearlyIncome - totalYearlyExpense
    },
    trends
  };
};

module.exports = {
  getMonthlyReport,
  getYearlyReport
};
