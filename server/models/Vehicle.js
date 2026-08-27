const mongoose = require('mongoose');

const VehicleSchema = new mongoose.Schema({
  vehicleNumber: { type: String, required: true, unique: true },
  vehicleType: { type: String, default: '32 Ft MXL' },
  capacityTons: { type: Number, default: 15 },
  transporterId: String,
  transporterName: String,
  status: { type: String, default: 'Available' },
  fitnessExpiry: String,
  insuranceExpiry: String,
  permitExpiry: String
}, { timestamps: true, strict: false });

module.exports = mongoose.model('Vehicle', VehicleSchema);
