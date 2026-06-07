require('dotenv').config();
const mongoose = require('mongoose');
const Account = require('./src/models/Account');
const Transaction = require('./src/models/Transaction');

async function migrateAssets() {
  try {
    await mongoose.connect(process.env.MONGODB_URI || 'mongodb://localhost:27017/fintrack');
    console.log('Connected to MongoDB');

    // 1. Update Accounts
    const accountResult = await Account.updateMany(
      { assetClass: { $exists: false } },
      { 
        $set: { 
          assetClass: 'FIAT',
          assetCode: 'IDR',
          unit: null
        } 
      }
    );
    console.log(`Updated ${accountResult.modifiedCount} accounts.`);

    // 2. Update Transactions
    const transactionResult = await Transaction.updateMany(
      { assetCode: { $exists: false } },
      { 
        $set: { 
          assetCode: 'IDR'
        } 
      }
    );
    console.log(`Updated ${transactionResult.modifiedCount} transactions.`);

    console.log('Migration completed successfully.');
    process.exit(0);
  } catch (error) {
    console.error('Migration failed:', error);
    process.exit(1);
  }
}

migrateAssets();
