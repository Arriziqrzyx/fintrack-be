const mongoose = require('mongoose');
const Account = require('./src/models/Account');
require('dotenv').config();

async function migrate() {
  try {
    await mongoose.connect(process.env.MONGODB_URI);
    console.log('Connected to MongoDB');
    
    const result = await Account.updateMany(
      { assetClass: 'METAL', type: 'OTHER' },
      { $set: { type: 'PRECIOUS_METAL' } }
    );
    
    console.log(`Updated ${result.modifiedCount} accounts.`);
    process.exit(0);
  } catch (error) {
    console.error('Migration failed', error);
    process.exit(1);
  }
}

migrate();
