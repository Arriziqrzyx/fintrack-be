require('dotenv').config();
const mongoose = require('mongoose');

const Fund = require('./src/models/Fund');

async function test() {
  try {
    await mongoose.connect('mongodb://localhost:27017/fintrack');
    console.log('Connected to DB');

    const fund = new Fund({
      userId: new mongoose.Types.ObjectId(),
      name: 'Test Fund',
      type: 'GOAL',
      targetAmount: 0,
      targetDate: null
    });
    
    await fund.validate();
    console.log('Validation passed!');
    
    process.exit(0);
  } catch (err) {
    console.error('Validation Error:', err);
    process.exit(1);
  }
}

test();
