const mongoose = require('mongoose');

const QuotationSchema = new mongoose.Schema({
  quotationNumber: { type: String, required: true, unique: true },
  version: { type: Number, default: 1 },
  companyId: String,
  companyName: String,
  companyCode: String,
  status: { type: String, default: 'Active' },
  validFrom: String,
  validUntil: String,
  rateRules: Array,
  routes: Array,
  additionalCharges: Object
}, { timestamps: true, strict: false });

module.exports = mongoose.model('Quotation', QuotationSchema);
