const mongoose = require('mongoose');

const TransporterSchema = new mongoose.Schema({
  transporterId: { type: String, required: true, unique: true },
  name: { type: String, required: true },
  code: String,
  phone: String,
  email: String,
  address: String,
  gstin: String,
  pan: String,
  status: { type: String, default: 'Active' },
  vehicleCount: { type: Number, default: 0 },
  rating: { type: Number, default: 4.5 }
}, { timestamps: true, strict: false });

module.exports = mongoose.model('Transporter', TransporterSchema);
