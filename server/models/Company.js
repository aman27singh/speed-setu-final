const mongoose = require('mongoose');

const CompanySchema = new mongoose.Schema({
  companyId: { type: String },
  companyCode: { type: String },
  companyName: { type: String, required: true },
  status: { type: String, default: 'Active' },
  industry: { type: String },
  companyType: { type: String, default: 'Manufacturer' },
  gstin: String,
  pan: String,

  billing: {
    gstin: String,
    address: String,
    addressLine2: String,
    city: String,
    state: String,
    pinCode: String,
    billingEmail: String,
    paymentTerms: { type: String, default: '30 Days Credit' },
    customPaymentDays: Number
  },

  primaryContact: {
    name: String,
    designation: String,
    phone: String,
    alternatePhone: String,
    email: String
  },

  operations: {
    pickupLocations: Array,
    destinations: Array,
    preferredModes: Array
  },

  kpis: {
    totalShipments: { type: Number, default: 0 },
    activeQuotations: { type: Number, default: 0 },
    outstandingAmount: { type: Number, default: 0 },
    totalBilling: { type: Number, default: 0 },
    paidAmount: { type: Number, default: 0 },
    activeShipments: { type: Number, default: 0 },
    lastShipmentDate: { type: String, default: '-' }
  }
}, { timestamps: true, strict: false });

module.exports = mongoose.model('Company', CompanySchema);
