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
  additionalCharges: Object,
  versionHistory: [{
    version: { type: Number, required: true },
    companyId: String,
    companyName: String,
    companyCode: String,
    rateRules: Array,
    routes: Array,
    additionalCharges: mongoose.Schema.Types.Mixed,
    taxConfiguration: mongoose.Schema.Types.Mixed,
    validFrom: String,
    validUntil: String,
    status: String,
    supersededAt: { type: Date, default: Date.now },
    supersededBy: { type: String, default: 'Admin' },
    changeSummary: String
  }]
}, { timestamps: true, strict: false });

module.exports = mongoose.model('Quotation', QuotationSchema);
