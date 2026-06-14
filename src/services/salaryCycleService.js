const SalaryCycle = require('../models/SalaryCycle');
const Transaction = require('../models/Transaction');
const mongoose = require('mongoose');

const getActiveCycle = async (userId) => {
  return await SalaryCycle.findOne({ userId, endDate: null }).sort({ startDate: -1 });
};

const getCycleById = async (cycleId, userId) => {
  return await SalaryCycle.findOne({ _id: cycleId, userId });
};

const getAllCycles = async (userId) => {
  return await SalaryCycle.find({ userId }).sort({ startDate: -1 });
};

const rebuildUserCycles = async (userId) => {
  // 1. Delete all existing cycles for the user
  await SalaryCycle.deleteMany({ userId });

  // 2. Clear salaryCycleId from all user's transactions
  await Transaction.updateMany({ userId }, { $set: { salaryCycleId: null } });

  // 3. Find all primary salary transactions ordered by date
  const salaryTransactions = await Transaction.find({
    userId,
    isPrimarySalary: true,
  }).sort({ transactionDate: 1 });

  if (salaryTransactions.length === 0) {
    return; // No cycles to build
  }

  const monthNames = ["January", "February", "March", "April", "May", "June", "July", "August", "September", "October", "November", "December"];

  const newCycles = [];

  for (let i = 0; i < salaryTransactions.length; i++) {
    const tx = salaryTransactions[i];
    const startDate = tx.transactionDate;
    
    // End date is 1ms before the next primary salary, or null if it's the last one
    let endDate = null;
    if (i < salaryTransactions.length - 1) {
      const nextTx = salaryTransactions[i + 1];
      endDate = new Date(nextTx.transactionDate.getTime() - 1);
    }

    const monthName = monthNames[startDate.getMonth()];
    const year = startDate.getFullYear();
    const cycleName = `${monthName} ${year}`;

    newCycles.push({
      _id: new mongoose.Types.ObjectId(),
      userId,
      name: cycleName,
      startDate,
      endDate,
      salaryTransactionId: tx._id,
    });
  }

  // 4. Insert the new cycles
  if (newCycles.length > 0) {
    await SalaryCycle.insertMany(newCycles);
  }

  // 5. Update transactions to point to the correct cycle
  for (const cycle of newCycles) {
    const query = {
      userId,
      transactionDate: { $gte: cycle.startDate },
    };
    if (cycle.endDate) {
      query.transactionDate.$lte = cycle.endDate;
    }
    
    await Transaction.updateMany(query, { $set: { salaryCycleId: cycle._id } });
  }
};

module.exports = {
  getActiveCycle,
  getCycleById,
  getAllCycles,
  rebuildUserCycles
};
