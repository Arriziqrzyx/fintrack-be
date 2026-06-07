const dashboardRepository = require('../repositories/dashboardRepository');
const exchangeRateService = require('./exchangeRateService');
const accountService = require('./accountService');
const fundService = require('./fundService');
const mongoose = require('mongoose');

const { isLiquidAccount } = require('../utils/accountUtils');

const getCurrentMonthDates = () => {
  const now = new Date();
  const startOfMonth = new Date(now.getFullYear(), now.getMonth(), 1);
  const endOfMonth = new Date(now.getFullYear(), now.getMonth() + 1, 0, 23, 59, 59, 999);
  return { startOfMonth, endOfMonth };
};

const getSummary = async (userId) => {
  const userObjectId = new mongoose.Types.ObjectId(userId);
  const { startOfMonth, endOfMonth } = getCurrentMonthDates();

  const rates = await exchangeRateService.getExchangeRates();

  // Accounts
  const accounts = await accountService.getAccounts(userId, 'false');
  
  // Calculate balances
  let totalLiquidBalance = 0;
  let assetValue = 0;

  const availableMoneyBreakdown = [];
  const assetValueBreakdown = [];

  accounts.forEach(acc => {
    if (isLiquidAccount(acc)) {
      const idrValue = acc.estimatedValueIDR || acc.currentBalance;
      totalLiquidBalance += idrValue;
      availableMoneyBreakdown.push({
        name: acc.name,
        type: acc.type,
        amount: acc.currentBalance,
        assetCode: acc.assetCode,
        estimatedValueIDR: idrValue
      });
    } else {
      assetValue += (acc.estimatedValueIDR || 0);
      assetValueBreakdown.push({
        name: acc.name,
        type: acc.type,
        amount: acc.currentBalance,
        assetCode: acc.assetCode,
        estimatedValueIDR: acc.estimatedValueIDR || 0
      });
    }
  });

  const netWorth = totalLiquidBalance + assetValue;

  // Allocated Funds
  const allocatedFunds = await dashboardRepository.getAllocatedFundsTotal(userObjectId);
  const availableMoney = totalLiquidBalance - allocatedFunds;
  
  // Allocated Funds Breakdown
  const funds = await fundService.getFunds(userId);
  const allocatedFundsBreakdown = funds.map(f => ({
    name: f.name,
    type: f.type,
    amount: f.currentAmount
  })).filter(f => f.amount > 0);

  if (allocatedFunds > 0) {
    availableMoneyBreakdown.push({
      name: 'Allocated Funds',
      type: 'DEDUCTION',
      amount: -allocatedFunds,
      assetCode: 'IDR',
      estimatedValueIDR: -allocatedFunds
    });
  }
  
  // Month Income Expense
  const monthStats = await dashboardRepository.getMonthIncomeExpenseByAsset(userObjectId, startOfMonth, endOfMonth);
  let monthIncome = 0;
  let monthExpense = 0;

  monthStats.forEach(stat => {
    monthIncome += exchangeRateService.calculateEstimatedIDR(stat._id, stat.monthIncome, rates);
    monthExpense += exchangeRateService.calculateEstimatedIDR(stat._id, stat.monthExpense, rates);
  });

  return {
    availableMoney,
    allocatedFunds,
    assetValue,
    netWorth,
    monthIncome,
    monthExpense,
    availableMoneyBreakdown,
    allocatedFundsBreakdown,
    assetValueBreakdown
  };
};

const getMonthlyReview = async (userId) => {
  const userObjectId = new mongoose.Types.ObjectId(userId);
  const rates = await exchangeRateService.getExchangeRates();
  
  const sixMonthsAgo = new Date();
  sixMonthsAgo.setMonth(sixMonthsAgo.getMonth() - 5);
  sixMonthsAgo.setDate(1);
  sixMonthsAgo.setHours(0, 0, 0, 0);

  const reviewAgg = await dashboardRepository.getMonthlyReviewStatsByAsset(userObjectId, sixMonthsAgo);

  const grouped = {};
  reviewAgg.forEach(item => {
    const key = `${item._id.year}-${item._id.month}`;
    if (!grouped[key]) {
      grouped[key] = {
        month: item._id.month,
        year: item._id.year,
        income: 0,
        expense: 0
      };
    }
    grouped[key].income += exchangeRateService.calculateEstimatedIDR(item._id.assetCode, item.income, rates);
    grouped[key].expense += exchangeRateService.calculateEstimatedIDR(item._id.assetCode, item.expense, rates);
  });

  return Object.values(grouped).sort((a, b) => {
    if (a.year !== b.year) return a.year - b.year;
    return a.month - b.month;
  });
};

const getCharts = async (userId) => {
  const userObjectId = new mongoose.Types.ObjectId(userId);
  const { startOfMonth, endOfMonth } = getCurrentMonthDates();
  const rates = await exchangeRateService.getExchangeRates();

  const expenseByCategoryAsset = await dashboardRepository.getExpenseByCategoryByAsset(userObjectId, startOfMonth, endOfMonth);

  const grouped = {};
  expenseByCategoryAsset.forEach(item => {
    const key = item.categoryId ? item.categoryId.toString() : 'uncategorized';
    if (!grouped[key]) {
      grouped[key] = {
        categoryId: item.categoryId,
        categoryName: item.categoryName,
        totalAmount: 0
      };
    }
    grouped[key].totalAmount += exchangeRateService.calculateEstimatedIDR(item.assetCode, item.totalAmount, rates);
  });

  const expenseByCategory = Object.values(grouped).sort((a, b) => b.totalAmount - a.totalAmount);

  return { expenseByCategory };
};

module.exports = {
  getSummary,
  getMonthlyReview,
  getCharts
};
