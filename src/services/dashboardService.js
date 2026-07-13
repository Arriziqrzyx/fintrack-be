const dashboardRepository = require('../repositories/dashboardRepository');
const exchangeRateService = require('./exchangeRateService');
const accountService = require('./accountService');
const fundService = require('./fundService');
const salaryCycleService = require('./salaryCycleService');
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
  
  // Get active cycle
  const activeCycle = await salaryCycleService.getActiveCycle(userId);
  
  let startOfCycle, endOfCycle;
  if (activeCycle) {
    startOfCycle = activeCycle.startDate;
    endOfCycle = activeCycle.endDate || new Date(9999, 11, 31); // if no end date, use far future
  } else {
    // Fallback if no cycle
    const { startOfMonth, endOfMonth } = getCurrentMonthDates();
    startOfCycle = startOfMonth;
    endOfCycle = endOfMonth;
  }

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
  
  // Cycle Income Expense
  const cycleStats = await dashboardRepository.getMonthIncomeExpenseByAsset(userObjectId, startOfCycle, endOfCycle);
  const cycleIncome = cycleStats.length > 0 ? cycleStats[0].monthIncome : 0;
  const cycleExpense = cycleStats.length > 0 ? cycleStats[0].monthExpense : 0;

  return {
    availableMoney,
    allocatedFunds,
    assetValue,
    netWorth,
    monthIncome: cycleIncome,
    monthExpense: cycleExpense,
    availableMoneyBreakdown,
    allocatedFundsBreakdown,
    assetValueBreakdown,
    activeCycle: activeCycle ? {
      name: activeCycle.name,
      startDate: activeCycle.startDate,
      endDate: activeCycle.endDate,
    } : null
  };
};

const getMonthlyReview = async (userId) => {
  const userObjectId = new mongoose.Types.ObjectId(userId);
  
  const sixMonthsAgo = new Date();
  sixMonthsAgo.setMonth(sixMonthsAgo.getMonth() - 5);
  sixMonthsAgo.setDate(1);
  sixMonthsAgo.setHours(0, 0, 0, 0);

  const reviewAgg = await dashboardRepository.getMonthlyReviewStatsByAsset(userObjectId, sixMonthsAgo);

  return reviewAgg.map(item => ({
    month: item._id.month,
    year: item._id.year,
    income: item.income,
    expense: item.expense
  })).sort((a, b) => {
    if (a.year !== b.year) return a.year - b.year;
    return a.month - b.month;
  });
};

const getCharts = async (userId) => {
  const userObjectId = new mongoose.Types.ObjectId(userId);
  
  const activeCycle = await salaryCycleService.getActiveCycle(userId);
  let startOfCycle, endOfCycle;
  if (activeCycle) {
    startOfCycle = activeCycle.startDate;
    endOfCycle = activeCycle.endDate || new Date(9999, 11, 31);
  } else {
    const { startOfMonth, endOfMonth } = getCurrentMonthDates();
    startOfCycle = startOfMonth;
    endOfCycle = endOfMonth;
  }
  
  const expenseByCategory = await dashboardRepository.getExpenseByCategoryByAsset(userObjectId, startOfCycle, endOfCycle);

  return { 
    expenseByCategory: expenseByCategory.sort((a, b) => b.totalAmount - a.totalAmount) 
  };
};

module.exports = {
  getSummary,
  getMonthlyReview,
  getCharts
};
