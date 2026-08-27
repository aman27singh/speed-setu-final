const mongoose = require('mongoose');

const DriverSchema = new mongoose.Schema({
  driverId: { type: String, required: true, unique: true },
  name: { type: String, required: true },
  phone: { type: String, required: true },
  licenseNumber: String,
  licenseExpiry: String,
  transporterId: String,
  transporterName: String,
  assignedVehicle: String,
  status: { type: String, default: 'Active' }
}, { timestamps: true, strict: false });

module.exports = mongoose.model('Driver', DriverSchema);
