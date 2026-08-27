const mongoose = require('mongoose');

const ContactSubSchema = new mongoose.Schema({
  name: String,
  code: String,
  gstin: String,
  address: String,
  city: String,
  state: String,
  pin: String,
  contact: String
}, { _id: false });

const ShipmentSchema = new mongoose.Schema({
  cnNumber: { type: String, required: true, unique: true },
  cnDate: { type: String, default: () => new Date().toISOString().split('T')[0] },
  bookingDate: { type: String, default: () => new Date().toISOString().split('T')[0] },

  companyId: String,
  companyName: String,
  companyCode: String,

  status: { type: String, default: 'Booked' },
  podStatus: { type: String, default: 'Pending' },
  billingStatus: { type: String, default: 'Not Ready' },

  origin: String,
  destination: String,

  mode: { type: String, default: 'Express LTL' },
  freightMode: { type: String, default: 'Road' },

  consignor: ContactSubSchema,
  consignee: ContactSubSchema,
  shipper: ContactSubSchema,

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

  invoiceDetails: {
    invoiceNumber: String,
    invoiceDate: String,
    invoiceValue: { type: Number, default: 0 },
    invoiceQuantity: { type: Number, default: 0 }
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

  invoiceId: String,
  tripId: String,
  podDocumentId: String,
  podDocumentUrl: String
}, { timestamps: true, strict: false });

module.exports = mongoose.model('Shipment', ShipmentSchema);
