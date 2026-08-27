const mongoose = require('mongoose');

const TripSchema = new mongoose.Schema({
  tripNumber: { type: String, required: true, unique: true },
  tripDate: { type: String, default: () => new Date().toISOString().split('T')[0] },
  status: { type: String, default: 'Planned' },
  origin: String,
  destination: String,
  mode: { type: String, default: 'Road' },
  transporterId: String,
  transporterName: String,
  vehicleNumber: String,
  driverName: String,
  driverPhone: String,
  shipmentIds: Array,
  statusHistory: Array,
  documents: Array
}, { timestamps: true, strict: false });

module.exports = mongoose.model('Trip', TripSchema);
