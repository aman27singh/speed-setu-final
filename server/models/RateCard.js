const mongoose = require('mongoose');

const RateRuleSubSchema = new mongoose.Schema({
  origin: { type: String, required: true, trim: true },
  destination: { type: String, required: true, trim: true },
  mode: { type: String, default: 'Air', trim: true },
  rateBasis: { type: String, default: 'Per KG' },
  freightRate: { type: Number, required: true, default: 0 },
  minimumChargeableWeight: { type: Number, default: 50 },
  additionalCharges: [mongoose.Schema.Types.Mixed],
  taxConfiguration: {
    applicable: { type: Boolean, default: true },
    gstRate: { type: Number, default: 18 },
    cgst: { type: Number, default: 9 },
    sgst: { type: Number, default: 9 },
    igst: { type: Number, default: 18 },
    notes: String
  }
}, { _id: false });

const RateCardSchema = new mongoose.Schema({
  rateCardNumber: { type: String, required: true, unique: true, trim: true },
  name: { type: String, required: true, trim: true },
  version: { type: Number, default: 1 },
  companyId: { type: String, default: null }, // null or 'ALL' for standard rate card
  companyName: { type: String, default: 'All / Standard' },
  companyCode: { type: String, default: 'ALL' },
  status: { type: String, enum: ['Active', 'Inactive'], default: 'Active' },
  validFrom: { type: String, default: () => new Date().toISOString().split('T')[0] },
  validUntil: { type: String, default: '' },
  rateRules: [RateRuleSubSchema],
  routes: Array,
  additionalCharges: Object,
  notes: { type: String, default: 'Standard logistics rate card.' },
  versionHistory: [{
    version: { type: Number, required: true },
    name: String,
    rateRules: [RateRuleSubSchema],
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

module.exports = mongoose.model('RateCard', RateCardSchema);
