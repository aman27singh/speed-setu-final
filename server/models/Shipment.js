const mongoose = require('mongoose');

const ContactSubSchema = new mongoose.Schema({
  name: { type: String, uppercase: true, trim: true },
  code: { type: String, uppercase: true, trim: true },
  gstin: { type: String, uppercase: true, trim: true },
  address: String,
  city: String,
  state: String,
  pin: String,
  contact: String,
  pickupDeliveryLocation: { type: String, default: '', trim: true, uppercase: true }
}, { _id: false });

const ShipmentSchema = new mongoose.Schema({
  cnNumber: { type: String, required: true, unique: true },
  cnDate: { type: String, default: () => new Date().toISOString().split('T')[0] },
  bookingDate: { type: String, default: () => new Date().toISOString().split('T')[0] },

  companyId: String,
  companyName: String,
  companyCode: String,

  status: { type: String, enum: ['Booked', 'Delivered'], default: 'Booked' },
  podStatus: { type: String, default: 'Pending' },
  billingStatus: { type: String, default: 'Not Ready' },

  origin: String,
  destination: String,

  mode: { type: String, default: 'Express LTL' },
  freightMode: { type: String, default: 'Road' },

  consignor: ContactSubSchema,
  consignee: ContactSubSchema,
  shipper: ContactSubSchema,
  consignorId: { type: String, default: null },
  consigneeId: { type: String, default: null },
  consignorSnapshot: mongoose.Schema.Types.Mixed,
  consigneeSnapshot: mongoose.Schema.Types.Mixed,

  actualWeight: { type: Number, default: 0 },
  chargeableWeight: { type: Number, default: 0 },
  volumetricWeight: { type: Number, default: 0 },
  packages: { type: mongoose.Schema.Types.Mixed, default: 10 },
  materialDescription: String,
  packingCharges: { type: Number, default: 0 },
  laborCharges: { type: Number, default: 0 },
  pickupCharges: { type: Number, default: 0 },
  deliveryCharges: { type: Number, default: 0 },
  godownCharges: { type: Number, default: 0 },
  godownDays: { type: Number, default: 0 },
  godownRatePerDay: { type: Number, default: 0 },
  godownMonths: { type: Number, default: 0 },
  godownRatePerMonth: { type: Number, default: 0 },
  isGodownOnlyBilling: { type: Boolean, default: false },
  gstRate: { type: Number, default: 18 },
  isGstExempt: { type: Boolean, default: false },

  commercialInvoices: [mongoose.Schema.Types.Mixed],

  invoiceDetails: {
    invoiceNumber: String,
    invoiceDate: String,
    invoiceValue: { type: Number, default: 0 },
    invoiceQuantity: { type: mongoose.Schema.Types.Mixed, default: '' }
  },

  ewayBillNumber: String,
  awbNumber: String,

  operational: {
    pickupDate: String,
    expectedDeliveryDate: String,
    currentLocation: String,
    tripId: String,
    transporter: { type: String, default: 'Speed Setu Fleet' },
    driver: String,
    vehicle: String
  },

  documents: [mongoose.Schema.Types.Mixed],
  statusHistory: [mongoose.Schema.Types.Mixed],

  pricingValidation: {
    status: { type: String, enum: ['MATCHED', 'MISSING', 'PENDING_REVIEW'], default: 'MISSING' },
    source: { type: String, enum: ['QUOTATION', 'RATE_CARD', 'NONE'], default: 'NONE' },
    quotationId: { type: String, default: null },
    quotationNumber: { type: String, default: null },
    quotationVersion: { type: Number, default: null },
    rateCardId: { type: String, default: null },
    rateCardNumber: { type: String, default: null },
    rateCardVersion: { type: Number, default: null },
    companyId: { type: String, default: null },
    companyName: { type: String, default: null },
    origin: { type: String, default: null },
    destination: { type: String, default: null },
    freightMode: { type: String, default: null },
    appliedRate: { type: Number, default: 0 },
    minimumChargeableWeight: { type: Number, default: 0 },
    agreementVersion: { type: Number, default: 1 },
    appliedRuleSnapshot: { type: mongoose.Schema.Types.Mixed, default: null },
    // Complete immutable snapshot of applied pricing agreement and charges at booking time
    pricingSnapshot: {
      rateCardId: { type: String, default: null },
      rateCardNumber: { type: String, default: null },
      rateCardVersion: { type: Number, default: null },
      quotationId: { type: String, default: null },
      quotationNumber: { type: String, default: null },
      quotationVersion: { type: Number, default: null },
      agreementType: { type: String, default: 'NONE' },
      agreementNumber: { type: String, default: null },
      agreementVersion: { type: Number, default: 1 },
      origin: { type: String, default: null },
      destination: { type: String, default: null },
      freightMode: { type: String, default: null },
      baseFreightRate: { type: Number, default: 0 },
      minimumWeight: { type: Number, default: 0 },
      chargeableWeight: { type: Number, default: 0 },
      docketCharges: { type: Number, default: 0 },
      pickupCharges: { type: Number, default: 0 },
      deliveryCharges: { type: Number, default: 0 },
      otherCharges: { type: Number, default: 0 },
      additionalCharges: [mongoose.Schema.Types.Mixed],
      gstPercentage: { type: Number, default: 18 },
      taxConfiguration: mongoose.Schema.Types.Mixed,
      calculatedCharges: mongoose.Schema.Types.Mixed,
      effectiveDate: String,
      isImmutable: { type: Boolean, default: true },
      capturedAt: { type: Date, default: Date.now }
    },
    validatedAt: { type: Date, default: Date.now },
    overrideConfirmed: { type: Boolean, default: false },
    overrideConfirmedBy: { type: String, default: null },
    overrideConfirmedAt: { type: Date, default: null },
    auditLog: [{
      action: String,
      previousStatus: String,
      newStatus: String,
      previousSource: String,
      newSource: String,
      reason: String,
      modifiedBy: String,
      modifiedAt: { type: Date, default: Date.now }
    }]
  },

  invoiceId: String,
  tripId: String,
  podDocumentId: String,
  podDocumentUrl: String,

  // Immutable Consignment Note (CN) Template Version & Snapshot captured at CN generation time
  cnTemplateVersion: { type: Number, default: null },
  cnTemplateId: { type: String, default: null },
  cnTemplateSnapshot: { type: mongoose.Schema.Types.Mixed, default: null }
}, { timestamps: true, strict: false });

module.exports = mongoose.model('Shipment', ShipmentSchema);
