const mongoose = require('mongoose');

const InvoiceSchema = new mongoose.Schema({
  invoiceNumber: { type: String, required: true, unique: true },
  invoiceDate: { type: String, default: () => new Date().toISOString().split('T')[0] },
  dueDate: String,
  companyId: String,
  companyName: String,
  companyCode: String,
  status: { type: String, default: 'Draft' },
  subtotal: { type: Number, default: 0 },
  taxAmount: { type: Number, default: 0 },
  totalAmount: { type: Number, default: 0 },
  paidAmount: { type: Number, default: 0 },
  balanceDue: { type: Number, default: 0 },
  shipmentIds: Array,
  lineItems: Array
}, { timestamps: true, strict: false });

module.exports = mongoose.model('Invoice', InvoiceSchema);
