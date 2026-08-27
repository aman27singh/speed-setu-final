const mongoose = require('mongoose');

const PaymentSchema = new mongoose.Schema({
  paymentNumber: { type: String, required: true, unique: true },
  paymentDate: { type: String, default: () => new Date().toISOString().split('T')[0] },
  companyId: String,
  companyName: String,
  amount: { type: Number, required: true },
  paymentMode: { type: String, default: 'NEFT/RTGS' },
  referenceNumber: String,
  status: { type: String, default: 'Success' },
  invoiceId: String,
  remarks: String
}, { timestamps: true, strict: false });

module.exports = mongoose.model('Payment', PaymentSchema);
