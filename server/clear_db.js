const mongoose = require('mongoose');
const connectDB = require('./config/db');

const Counter = require('./models/Counter');
const Company = require('./models/Company');
const Quotation = require('./models/Quotation');
const Shipment = require('./models/Shipment');
const Trip = require('./models/Trip');
const Invoice = require('./models/Invoice');
const Payment = require('./models/Payment');
const Expense = require('./models/Expense');
const Payable = require('./models/Payable');

const clearAllDatabaseData = async () => {
  try {
    await connectDB();

    if (mongoose.connection.name !== 'test_db') {
      console.error(`🚨 [ABORT]: clear_db.js is STRICTLY PROHIBITED on database "${mongoose.connection.name}"! It can only run on "test_db".`);
      process.exit(1);
    }

    console.log(`🗑️ Clearing records from development database: ${mongoose.connection.name}...`);
    
    await Promise.all([
      Counter.deleteMany({}),
      Company.deleteMany({}),
      Quotation.deleteMany({}),
      Shipment.deleteMany({}),
      Trip.deleteMany({}),
      Invoice.deleteMany({}),
      Payment.deleteMany({}),
      Expense.deleteMany({}),
      Payable.deleteMany({})
    ]);

    // Reset Atomic Sequence Counter to 2000 so new CNs start cleanly from SS2001
    await Counter.create({ _id: 'cn_seq', seq: 2000 });

    console.log('✅ ALL dummy data successfully deleted from MongoDB!');
    console.log('CN sequence counter reset to 2000 (First new CN will be SS2001).');
    process.exit(0);
  } catch (err) {
    console.error('❌ Error clearing database:', err);
    process.exit(1);
  }
};

clearAllDatabaseData();
