const reportRepository = require('../repositories/reportRepository');

const getJakartaMonthRange = (year, month) => {
  const startDateStr = `${year}-${String(month).padStart(2, '0')}-01T00:00:00.000+07:00`;
  const startDate = new Date(startDateStr);
  
  let nextMonth = month + 1;
  let nextYear = year;
  if (nextMonth > 12) {
    nextMonth = 1;
    nextYear++;
  }
  const endDateStr = `${nextYear}-${String(nextMonth).padStart(2, '0')}-01T00:00:00.000+07:00`;
  const endDate = new Date(new Date(endDateStr).getTime() - 1);
  
  return { startDate, endDate };
};

const getJakartaYearRange = (year) => {
  const startDateStr = `${year}-01-01T00:00:00.000+07:00`;
  const startDate = new Date(startDateStr);
  
  const endDateStr = `${year + 1}-01-01T00:00:00.000+07:00`;
  const endDate = new Date(new Date(endDateStr).getTime() - 1);
  
  return { startDate, endDate };
};

const getMonthlyReport = async (userId, year, month) => {
  const targetYear = year ? parseInt(year) : new Date().getFullYear();
  const targetMonth = month ? parseInt(month) : new Date().getMonth() + 1;
  
  const { startDate, endDate } = getJakartaMonthRange(targetYear, targetMonth);

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
  const { startDate, endDate } = getJakartaYearRange(targetYear);

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
