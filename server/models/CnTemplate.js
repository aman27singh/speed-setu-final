const mongoose = require('mongoose');

const CnTemplateSchema = new mongoose.Schema(
  {
    templateKey: {
      type: String,
      default: 'default',
      trim: true,
      index: true,
    },
    name: {
      type: String,
      default: 'Speed Setu Standard CN',
      trim: true,
    },
    version: {
      type: Number,
      required: true,
      default: 1,
    },
    isActive: {
      type: Boolean,
      default: true,
      index: true,
    },
    isDefault: {
      type: Boolean,
      default: false,
    },
    changeNote: {
      type: String,
      default: '',
      trim: true,
    },
    config: {
      type: mongoose.Schema.Types.Mixed,
      required: true,
    },
    createdBy: {
      type: String,
      default: 'Admin',
    },
    createdByRole: {
      type: String,
      default: 'Admin',
    },
  },
  { timestamps: true }
);

CnTemplateSchema.index({ templateKey: 1, version: -1 });
CnTemplateSchema.index({ templateKey: 1, isActive: 1 });

module.exports = mongoose.model('CnTemplate', CnTemplateSchema);
