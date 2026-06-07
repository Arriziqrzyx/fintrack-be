require('dotenv').config({ path: '../.env' });
const mongoose = require('mongoose');

const migration = async () => {
  try {
    // Database connection
    await mongoose.connect(process.env.MONGODB_URI || 'mongodb://localhost:27017/fintrack');
    console.log('Connected to MongoDB');

    const db = mongoose.connection.db;

    // We use native driver to read from goals and emergency_funds to avoid defining old models
    const goalsCollection = db.collection('goals');
    const efCollection = db.collection('emergency_funds');

    const Fund = require('../src/models/Fund');
    const FundTransaction = require('../src/models/FundTransaction');

    const goals = await goalsCollection.find({}).toArray();
    console.log(`Found ${goals.length} goals`);

    for (const goal of goals) {
      const fund = await Fund.create({
        userId: goal.userId,
        name: goal.name,
        type: 'GOAL',
        targetAmount: goal.targetAmount,
        targetDate: goal.targetDate,
        status: goal.status
      });

      if (goal.currentAmount > 0) {
        await FundTransaction.create({
          userId: goal.userId,
          fundId: fund._id,
          type: 'ALLOCATE',
          amount: goal.currentAmount,
          note: 'Initial migration from goal'
        });
      }
    }

    const efs = await efCollection.find({}).toArray();
    console.log(`Found ${efs.length} emergency funds`);

    for (const ef of efs) {
      const fund = await Fund.create({
        userId: ef.userId,
        name: 'Emergency Fund',
        type: 'EMERGENCY',
        targetAmount: ef.targetAmount,
        status: 'ACTIVE'
      });

      if (ef.currentAmount > 0) {
        await FundTransaction.create({
          userId: ef.userId,
          fundId: fund._id,
          type: 'ALLOCATE',
          amount: ef.currentAmount,
          note: 'Initial migration from emergency fund'
        });
      }
    }

    console.log('Migration completed successfully');
    
    // Optional: Drop the old collections
    // await goalsCollection.drop();
    // await efCollection.drop();

    process.exit(0);
  } catch (error) {
    console.error('Migration error:', error);
    process.exit(1);
  }
};

migration();
