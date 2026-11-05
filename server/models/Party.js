const mongoose = require('mongoose');

const PartySchema = new mongoose.Schema({
  name: { type: String, required: true, trim: true },
  code: { type: String, trim: true, default: '' },
  type: {
    type: String,
    enum: ['Consignor', 'Consignee', 'Both'],
    default: 'Both'
  },
  gstin: { type: String, trim: true, default: '' },
  address: { type: String, trim: true, default: '' },
  city: { type: String, trim: true, default: '' },
  state: { type: String, trim: true, default: '' },
  pin: { type: String, trim: true, default: '' },
  contact: { type: String, trim: true, default: '' },
  phone: { type: String, trim: true, default: '' },
  email: { type: String, trim: true, default: '' },
  status: { type: String, enum: ['Active', 'Inactive'], default: 'Active' },
  notes: { type: String, default: '' }
}, { timestamps: true });

// Case-insensitive index on name for quick lookups
PartySchema.index({ name: 1 });
PartySchema.index({ city: 1 });

module.exports = mongoose.model('Party', PartySchema);
