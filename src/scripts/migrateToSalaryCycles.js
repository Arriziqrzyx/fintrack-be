require('dotenv').config();
const mongoose = require('mongoose');
const User = require('../models/User');
const Transaction = require('../models/Transaction');
const Category = require('../models/Category');
const salaryCycleService = require('../services/salaryCycleService');

const runMigration = async () => {
  try {
    await mongoose.connect(process.env.MONGODB_URI || 'mongodb://localhost:27017/fintrack');
    console.log('Connected to MongoDB');

    const users = await User.find({});
    console.log(`Found ${users.length} users. Migrating...`);

    for (const user of users) {
      console.log(`\nMigrating user: ${user.email}`);

      // 1. Identify "Gaji" category strictly
      const salaryCategories = await Category.find({
        userId: user._id,
        name: { $regex: /^gaji$/i },
      });

      if (salaryCategories.length === 0) {
        console.log('No strict "Gaji" category found for user. Skipping automatic boundary creation.');
        continue;
      }

      const categoryIds = salaryCategories.map(c => c._id);

      // 2. Find all transactions in these categories
      const salaryTransactions = await Transaction.find({
        userId: user._id,
        categoryId: { $in: categoryIds },
        type: 'INCOME'
      });

      console.log(`Found ${salaryTransactions.length} potential primary salary transactions.`);

      // 3. Mark them as primary salary
      for (const tx of salaryTransactions) {
        tx.isPrimarySalary = true;
        await tx.save();
      }

      // 4. Rebuild cycles for the user
      await salaryCycleService.rebuildUserCycles(user._id);
      console.log(`Cycles rebuilt successfully for ${user.email}.`);
    }

    console.log('\nMigration completed successfully.');
    process.exit(0);
  } catch (error) {
    console.error('Migration failed:', error);
    process.exit(1);
  }
};

runMigration();
