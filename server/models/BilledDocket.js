const mongoose = require('mongoose');

const BilledDocketSchema = new mongoose.Schema({
  docketNo: {
    type: String,
    required: true,
    trim: true
  },
  docketNoNormalized: {
    type: String,
    required: true,
    trim: true,
    lowercase: true
  },
  invoiceNumber: {
    type: String,
    required: true,
    trim: true
  },
  invoiceNumberNormalized: {
    type: String,
    required: true,
    trim: true,
    lowercase: true
  },
  invoiceId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Invoice'
  },
  status: {
    type: String,
    default: 'Active',
    enum: ['Active', 'Cancelled']
  }
}, { timestamps: true });

// Database-level uniqueness: a docket can only be active in one invoice at a time
BilledDocketSchema.index(
  { docketNoNormalized: 1 },
  {
    unique: true,
    partialFilterExpression: { status: 'Active' },
    name: 'unique_active_docket_no'
  }
);

BilledDocketSchema.index({ invoiceNumberNormalized: 1 });
BilledDocketSchema.index({ invoiceId: 1 });

module.exports = mongoose.model('BilledDocket', BilledDocketSchema);
