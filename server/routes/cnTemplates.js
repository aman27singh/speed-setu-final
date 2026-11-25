'use strict';

const express = require('express');
const mongoose = require('mongoose');
const router = express.Router();
const CnTemplate = require('../models/CnTemplate');
const { DEFAULT_CN_TEMPLATE_CONFIG } = require('../config/defaultCnTemplate');
const { protect, adminOnly } = require('../middleware/auth');

const TEMPLATE_KEY = 'default';

function cloneConfig(obj) {
  return JSON.parse(JSON.stringify(obj));
}

function validateTemplateConfig(config) {
  if (!config || typeof config !== 'object') {
    return 'Template configuration object is required.';
  }
  if (!config.page || typeof config.page !== 'object') {
    return 'Template page configuration is required.';
  }
  if (!Array.isArray(config.elements)) {
    return 'Template elements array is required.';
  }
  return null;
}

// GET /api/cn-templates/active — Load active CN template (authenticated users including drivers creating shipments)
router.get('/active', protect, async (req, res) => {
  try {
    const active = await CnTemplate.findOne({ templateKey: TEMPLATE_KEY, isActive: true })
      .sort({ version: -1 })
      .lean();

    if (!active) {
      return res.json({
        templateId: null,
        templateKey: TEMPLATE_KEY,
        name: 'Speed Setu Standard CN (Default)',
        version: 1,
        isDefault: true,
        isActive: true,
        config: cloneConfig(DEFAULT_CN_TEMPLATE_CONFIG),
        updatedAt: null,
      });
    }

    return res.json({
      templateId: String(active._id),
      templateKey: active.templateKey,
      name: active.name,
      version: active.version,
      isDefault: Boolean(active.isDefault),
      isActive: Boolean(active.isActive),
      changeNote: active.changeNote || '',
      createdBy: active.createdBy || 'Admin',
      config: active.config,
      createdAt: active.createdAt,
      updatedAt: active.updatedAt,
    });
  } catch (err) {
    console.error('[CN Template Active Fetch Error]:', err);
    return res.status(500).json({ error: err.message });
  }
});

// GET /api/cn-templates/default — Get clean factory default template config
router.get('/default', protect, async (req, res) => {
  return res.json({
    name: 'Speed Setu Standard CN (Default)',
    version: 0,
    isDefault: true,
    config: cloneConfig(DEFAULT_CN_TEMPLATE_CONFIG),
  });
});

// GET /api/cn-templates/versions — List all template versions (Admin / Super Admin only)
router.get('/versions', protect, adminOnly, async (req, res) => {
  try {
    const versions = await CnTemplate.find({ templateKey: TEMPLATE_KEY })
      .select('_id templateKey name version isActive isDefault changeNote createdBy createdByRole createdAt updatedAt')
      .sort({ version: -1 })
      .limit(100)
      .lean();

    return res.json(versions);
  } catch (err) {
    console.error('[CN Template Versions List Error]:', err);
    return res.status(500).json({ error: err.message });
  }
});

// GET /api/cn-templates/versions/:versionOrId — Load a specific template version
router.get('/versions/:versionOrId', protect, async (req, res) => {
  try {
    const param = req.params.versionOrId;
    const isId = mongoose.isValidObjectId(param);
    const numVer = Number(param);

    const query = isId
      ? { _id: param }
      : { templateKey: TEMPLATE_KEY, version: !isNaN(numVer) ? numVer : -1 };

    const doc = await CnTemplate.findOne(query).lean();
    if (!doc) {
      return res.status(404).json({ error: 'Template version not found' });
    }
    return res.json(doc);
  } catch (err) {
    console.error('[CN Template Version Fetch Error]:', err);
    return res.status(500).json({ error: err.message });
  }
});

// POST /api/cn-templates — Save a new active template version (Admin / Super Admin only)
router.post('/', protect, adminOnly, async (req, res) => {
  try {
    const { name, config, changeNote } = req.body || {};
    const validationError = validateTemplateConfig(config);
    if (validationError) {
      return res.status(400).json({ error: validationError });
    }

    const latest = await CnTemplate.findOne({ templateKey: TEMPLATE_KEY })
      .sort({ version: -1 })
      .lean();
    const nextVersion = latest ? (Number(latest.version) || 0) + 1 : 1;

    await CnTemplate.updateMany(
      { templateKey: TEMPLATE_KEY, isActive: true },
      { $set: { isActive: false } }
    );

    const created = await CnTemplate.create({
      templateKey: TEMPLATE_KEY,
      name: (name || 'Speed Setu Standard CN').trim(),
      version: nextVersion,
      isActive: true,
      isDefault: false,
      changeNote: (changeNote || `Saved template v${nextVersion}`).trim(),
      config: cloneConfig(config),
      createdBy: req.user?.name || req.user?.username || 'Admin',
      createdByRole: req.user?.role || 'Admin',
    });

    return res.status(201).json({
      templateId: String(created._id),
      templateKey: created.templateKey,
      name: created.name,
      version: created.version,
      isActive: created.isActive,
      isDefault: created.isDefault,
      changeNote: created.changeNote,
      createdBy: created.createdBy,
      config: created.config,
      createdAt: created.createdAt,
      updatedAt: created.updatedAt,
    });
  } catch (err) {
    console.error('[CN Template Save Error]:', err);
    return res.status(500).json({ error: err.message });
  }
});

// POST /api/cn-templates/restore/:versionOrId — Restore a previous version as a new active version (Admin / Super Admin only)
router.post('/restore/:versionOrId', protect, adminOnly, async (req, res) => {
  try {
    const param = req.params.versionOrId;
    const isId = mongoose.isValidObjectId(param);
    const numVer = Number(param);

    const source = await CnTemplate.findOne(
      isId
        ? { _id: param }
        : { templateKey: TEMPLATE_KEY, version: !isNaN(numVer) ? numVer : -1 }
    ).lean();

    if (!source) {
      return res.status(404).json({ error: 'Target template version not found' });
    }

    const latest = await CnTemplate.findOne({ templateKey: TEMPLATE_KEY })
      .sort({ version: -1 })
      .lean();
    const nextVersion = latest ? (Number(latest.version) || 0) + 1 : 1;

    await CnTemplate.updateMany(
      { templateKey: TEMPLATE_KEY, isActive: true },
      { $set: { isActive: false } }
    );

    const restored = await CnTemplate.create({
      templateKey: TEMPLATE_KEY,
      name: source.name || 'Speed Setu Standard CN',
      version: nextVersion,
      isActive: true,
      isDefault: Boolean(source.isDefault),
      changeNote: `Restored from v${source.version}`,
      config: cloneConfig(source.config),
      createdBy: req.user?.name || req.user?.username || 'Admin',
      createdByRole: req.user?.role || 'Admin',
    });

    return res.status(201).json({
      templateId: String(restored._id),
      templateKey: restored.templateKey,
      name: restored.name,
      version: restored.version,
      isActive: restored.isActive,
      changeNote: restored.changeNote,
      createdBy: restored.createdBy,
      config: restored.config,
      createdAt: restored.createdAt,
      updatedAt: restored.updatedAt,
    });
  } catch (err) {
    console.error('[CN Template Restore Error]:', err);
    return res.status(500).json({ error: err.message });
  }
});

// POST /api/cn-templates/reset — Reset active template to default blueprint (Admin / Super Admin only)
router.post('/reset', protect, adminOnly, async (req, res) => {
  try {
    const latest = await CnTemplate.findOne({ templateKey: TEMPLATE_KEY })
      .sort({ version: -1 })
      .lean();
    const nextVersion = latest ? (Number(latest.version) || 0) + 1 : 1;

    await CnTemplate.updateMany(
      { templateKey: TEMPLATE_KEY, isActive: true },
      { $set: { isActive: false } }
    );

    const resetDoc = await CnTemplate.create({
      templateKey: TEMPLATE_KEY,
      name: 'Speed Setu Standard CN (Default)',
      version: nextVersion,
      isActive: true,
      isDefault: true,
      changeNote: 'Reset to default CN template',
      config: cloneConfig(DEFAULT_CN_TEMPLATE_CONFIG),
      createdBy: req.user?.name || req.user?.username || 'Admin',
      createdByRole: req.user?.role || 'Admin',
    });

    return res.status(201).json({
      templateId: String(resetDoc._id),
      templateKey: resetDoc.templateKey,
      name: resetDoc.name,
      version: resetDoc.version,
      isActive: resetDoc.isActive,
      isDefault: resetDoc.isDefault,
      changeNote: resetDoc.changeNote,
      createdBy: resetDoc.createdBy,
      config: resetDoc.config,
      createdAt: resetDoc.createdAt,
      updatedAt: resetDoc.updatedAt,
    });
  } catch (err) {
    console.error('[CN Template Reset Error]:', err);
    return res.status(500).json({ error: err.message });
  }
});

module.exports = router;
