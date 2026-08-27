const mongoose = require('mongoose');

const ExpenseSchema = new mongoose.Schema({
  expenseId: { type: String, required: true, unique: true },
  title: String,
  category: { type: String, default: 'Operational' },
  amount: { type: Number, required: true },
  expenseDate: { type: String, default: () => new Date().toISOString().split('T')[0] },
  paymentStatus: { type: String, default: 'Paid' },
  paymentMode: String,
  tripId: String,
  shipmentId: String,
  vendorName: String,
  remarks: String
}, { timestamps: true, strict: false });

module.exports = mongoose.model('Expense', ExpenseSchema);
