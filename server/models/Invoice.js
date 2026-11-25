const mongoose = require('mongoose');

const InvoiceSchema = new mongoose.Schema({
  invoiceNumber: { type: String, required: true, unique: true, trim: true },
  invoiceNumberNormalized: { type: String, trim: true, lowercase: true },
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
  balanceAmount: { type: Number, default: 0 },
  taxableAmount: { type: Number, default: 0 },
  gstAmount: { type: Number, default: 0 },
  grandTotal: { type: Number, default: 0 },
  shipmentIds: Array,
  cns: Array,
  cnNumber: String,
  lineItems: Array,
  dockets: Array,
  supplierDetails: {
    companyName: { type: String, default: 'SPEEDSETU LOGISTICS PRIVATE LIMITED' },
    logoUrl: { type: String, default: '' },
    addressLine1: { type: String, default: 'Haripur, BHIWANI,' },
    addressLine2: { type: String, default: 'Haripur, Bhiwani, Bhiwani, Haryana, 127021' },
    gstin: { type: String, default: '06ABSCS1710K1Z4' },
    phone: { type: String, default: '+91 98765 43210' },
    email: { type: String, default: 'billing@speedsetu.com' },
    pan: { type: String, default: 'ABSCS1710K' }
  },
  billToDetails: {
    companyId: String,
    companyName: String,
    address: String,
    addressLine2: String,
    city: String,
    state: String,
    pinCode: String,
    gstin: String,
    phone: String,
    email: String
  },
  billTo: Object,
  transportDetails: {
    mode: { type: String, default: '' },
    hsnCode: { type: String, default: '996531' },
    vehicleNo: { type: String, default: '' },
    driverName: { type: String, default: '' },
    driverPhone: { type: String, default: '' },
    grNo: { type: String, default: '' },
    lrDate: { type: String, default: '' },
    notes: { type: String, default: '' }
  },
  totals: {
    totalPackages: { type: mongoose.Schema.Types.Mixed, default: 0 },
    totalWeight: { type: Number, default: 0 },
    totalFreight: { type: Number, default: 0 },
    totalDocketCharges: { type: Number, default: 0 },
    totalPickupCharges: { type: Number, default: 0 },
    totalDeliveryCharges: { type: Number, default: 0 },
    totalPackingCharges: { type: Number, default: 0 },
    totalLaborCharges: { type: Number, default: 0 },
    totalGodownCharges: { type: Number, default: 0 },
    totalOtherCharges: { type: Number, default: 0 },
    totalTaxableAmount: { type: Number, default: 0 },
    totalCgst: { type: Number, default: 0 },
    totalSgst: { type: Number, default: 0 },
    totalIgst: { type: Number, default: 0 },
    grandTotal: { type: Number, default: 0 },
    manualOverride: { type: Boolean, default: false },
    overrideReason: { type: String, default: '' }
  },
  termsAndConditions: {
    type: [String],
    default: [
      'Our Company Is Registered Under Msme. Uam No',
      'If Any Discrepancy In The Invoice Please Inform Us Within Two Days After That It Will Not Be Accepted.',
      'The Laws Applicable To This Contract Shall Be The Law In Force In India. The Courts Of New Delhi Shall Have Exclusive Jurisdiction In All Matters Arising Under This Contract.',
      'Payments Should Be Made Through Cheque/Dd. In Favour "Speed Setu Logistics Pvt Ltd "',
      'Payment After Due Date Will Attract Interest @ 2% Or Part Of The Month'
    ]
  },
  bankDetails: {
    bankName: { type: String, default: 'HDFC BANK LTD' },
    accountHolder: { type: String, default: 'SPEEDSETU LOGISTICS PRIVATE LIMITED' },
    accountNumber: { type: String, default: '50200118714271' },
    ifscCode: { type: String, default: 'HDFC0000479' },
    branchName: { type: String, default: 'MEHAM GATE, BHIWANI' },
    icon: { type: String, default: '🏛️' },
    upiId: { type: String, default: '' }
  },
  signatory: {
    name: { type: String, default: 'Authorised Signatory' },
    designation: { type: String, default: 'Authorised Signatory' },
    signatureUrl: { type: String, default: '' },
    footerNotes: { type: String, default: 'Subject to Bhiwani Jurisdiction. This is a computer-generated tax invoice.' }
  },
  auditHistory: [{
    modifiedAt: { type: Date, default: Date.now },
    modifiedBy: { type: String, default: 'Admin' },
    action: { type: String, default: 'Invoice Edited' },
    previousTotals: Object,
    newTotals: Object,
    summary: String
  }],
  taxMode: { type: String, default: 'charging_gst' },
  gstRate: { type: Number, default: 18 },
  hsnCode: { type: String, default: '996531' },
  mode: { type: String, default: '' },
  notes: String,
  cancellationReason: String
}, { timestamps: true, strict: false });

InvoiceSchema.pre('save', function (next) {
  if (this.invoiceNumber) {
    this.invoiceNumberNormalized = this.invoiceNumber.trim().toLowerCase();
  }
  next();
});

InvoiceSchema.index({ invoiceNumberNormalized: 1 }, { unique: true, sparse: true });

module.exports = mongoose.model('Invoice', InvoiceSchema);
