const mongoose = require('mongoose');

/**
 * Speed Setu - Centralized Consignor & Consignee Shared Company Master
 * 
 * BUSINESS RULES:
 * 1. Same company + same address = One record.
 * 2. Same company + different address = Multiple allowed records (e.g., Bangalore, Chennai, Hyderabad).
 * 3. Each unique company-location record = One unique company code (starting from CC100, new company registered as CC101).
 * 4. GST number alone does NOT prevent creation of another location record.
 * 5. Every record can be used interchangeably as both Consignor (Shipper) and Consignee (Receiver).
 */

const ConsignorConsigneeSchema = new mongoose.Schema({
  companyName: {
    type: String,
    required: [true, 'Company name is required'],
    trim: true,
    uppercase: true
  },
  companyCode: {
    type: String,
    required: [true, 'Company code is required'],
    trim: true,
    uppercase: true
  },
  gstNumber: {
    type: String,
    default: '',
    trim: true,
    uppercase: true
  },
  pickupDeliveryLocation: {
    type: String,
    default: '',
    trim: true,
    uppercase: true
  },
  address: {
    addressLine1: { type: String, default: '', trim: true },
    addressLine2: { type: String, default: '', trim: true },
    city: { type: String, default: '', trim: true },
    state: { type: String, default: '', trim: true },
    pinCode: { type: String, default: '', trim: true }
  },
  fullAddress: {
    type: String,
    default: '',
    trim: true
  },
  contactPerson: {
    type: String,
    default: '',
    trim: true
  },
  mobileNumber: {
    type: String,
    default: '',
    trim: true
  },
  email: {
    type: String,
    default: '',
    trim: true,
    lowercase: true
  },
  isActive: {
    type: Boolean,
    default: true
  },
  // Optional partyType preserved for legacy compatibility; defaults to 'SHARED'
  partyType: {
    type: String,
    default: 'SHARED',
    uppercase: true
  }
}, {
  timestamps: true,
  collection: 'consignorConsignee'
});

// Pre-save hook: auto-compute fullAddress if not explicitly set & ensure ALL CAPS
ConsignorConsigneeSchema.pre('save', function (next) {
  if (this.companyName) {
    this.companyName = this.companyName.trim().toUpperCase();
  }
  if (this.gstNumber) {
    this.gstNumber = this.gstNumber.trim().toUpperCase();
  }
  if (this.pickupDeliveryLocation) {
    this.pickupDeliveryLocation = this.pickupDeliveryLocation.trim().toUpperCase();
  }
  if (this.companyCode) {
    this.companyCode = this.companyCode.trim().toUpperCase();
  }
  if (!this.fullAddress && this.address) {
    const parts = [
      this.address.addressLine1,
      this.address.addressLine2,
      this.address.city,
      this.address.state,
      this.address.pinCode ? `PIN: ${this.address.pinCode}` : ''
    ].filter(Boolean);
    this.fullAddress = parts.join(', ');
  }
  next();
});

// Indexes:
// 1. Global unique company code (e.g. CC101, CC102...)
ConsignorConsigneeSchema.index({ companyCode: 1 }, { unique: true });

// 2. GST number index for fast lookups (NON-UNIQUE, as multiple locations can share same GSTIN)
ConsignorConsigneeSchema.index({ gstNumber: 1 });

// 3. Fast lookup & search indexes
ConsignorConsigneeSchema.index({ companyName: 'text', companyCode: 'text', 'address.city': 'text', gstNumber: 'text' });
ConsignorConsigneeSchema.index({ isActive: 1 });
ConsignorConsigneeSchema.index({ companyName: 1 });
ConsignorConsigneeSchema.index({ 'address.city': 1 });
ConsignorConsigneeSchema.index({ 'address.pinCode': 1 });

const ConsignorConsignee = mongoose.model('ConsignorConsignee', ConsignorConsigneeSchema, 'consignorConsignee');

// Automatically drop obsolete unique GST indexes to allow multiple company locations under same GSTIN
ConsignorConsignee.on('index', () => {
  ConsignorConsignee.collection.indexes().then(indexes => {
    for (const idx of indexes) {
      if (idx.name === 'partyType_1_gstNumber_1' || (idx.name.includes('gstNumber') && idx.unique)) {
        console.log(`[ConsignorConsignee] Dropping obsolete unique GST index: ${idx.name}`);
        ConsignorConsignee.collection.dropIndex(idx.name).catch(() => { });
      }
    }
  }).catch(() => { });
});

module.exports = ConsignorConsignee;
