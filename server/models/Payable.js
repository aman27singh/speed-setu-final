const mongoose = require('mongoose');

const PayableSchema = new mongoose.Schema({
  payableId: { type: String, required: true, unique: true },
  vendorName: { type: String, required: true },
  vendorType: { type: String, default: 'Transporter' },
  transporterId: String,
  amount: { type: Number, required: true },
  paidAmount: { type: Number, default: 0 },
  balance: { type: Number, default: 0 },
  dueDate: String,
  status: { type: String, default: 'Pending' },
  tripId: String
}, { timestamps: true, strict: false });

module.exports = mongoose.model('Payable', PayableSchema);
