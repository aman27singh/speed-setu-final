const express = require('express');
const router = express.Router();
const mongoose = require('mongoose');
const RateCard = require('../models/RateCard');

/**
 * Generate next unique rate card number based on highest existing numerical suffix.
 */
async function generateNextRateCardNumber(offset = 0) {
  const currentYear = new Date().getFullYear();
  const existing = await RateCard.find({}, { rateCardNumber: 1 }).lean();
  let maxNum = 0;
  for (const doc of existing) {
    if (!doc.rateCardNumber) continue;
    const match = doc.rateCardNumber.match(/^RC-(?:(\d{4})-)?(\d+)/i);
    if (match && match[2]) {
      const num = parseInt(match[2], 10);
      if (!isNaN(num) && num > maxNum) {
        maxNum = num;
      }
    }
  }
  return `RC-${currentYear}-${String(maxNum + 1 + offset).padStart(3, '0')}`;
}

/**
 * Explicit, safe rate card lookup by MongoDB 24-char ObjectId or exact rateCardNumber.
 */
async function findRateCardByIdOrNumber(param) {
  if (!param || typeof param !== 'string') return null;
  const trimmed = param.trim();
  if (!trimmed || trimmed === 'undefined' || trimmed === 'null') return null;

  if (/^[0-9a-fA-F]{24}$/.test(trimmed)) {
    try {
      const byId = await RateCard.findById(trimmed);
      if (byId) return byId;
    } catch (e) {}
  }

  const escaped = trimmed.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  return RateCard.findOne({
    rateCardNumber: new RegExp(`^${escaped}$`, 'i')
  });
}

// GET /api/rate-cards — List all rate cards
router.get('/', async (req, res) => {
  try {
    const { search, status } = req.query;
    let query = {};
    if (status && status !== 'All') query.status = status;

    if (search) {
      const q = search.trim();
      query.$or = [
        { rateCardNumber: { $regex: q, $options: 'i' } },
        { name: { $regex: q, $options: 'i' } }
      ];
    }

    const list = await RateCard.find(query).sort({ createdAt: -1 });
    res.json(list);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// GET /api/rate-cards/:id — Get single rate card
router.get('/:id', async (req, res) => {
  const { id } = req.params;
  const correlationId = req.correlationId || 'req_rc_get';

  if (!id || id === 'undefined' || id === 'null' || !id.trim()) {
    return res.status(400).json({
      error: 'Valid rate card identifier is required.',
      message: 'Valid rate card identifier is required.'
    });
  }

  try {
    const rc = await findRateCardByIdOrNumber(id);
    if (!rc) {
      return res.status(404).json({
        error: `Rate card '${id.trim()}' was not found.`,
        message: `Rate card '${id.trim()}' was not found.`
      });
    }

    console.log(`✓ [${correlationId}] GET /api/rate-cards/${id} -> 200 OK (${rc.rateCardNumber})`);
    res.json(rc);
  } catch (err) {
    console.error(`❌ [${correlationId}] GET /api/rate-cards/${id} error:`, err.message);
    res.status(500).json({ error: err.message, message: err.message });
  }
});

// POST /api/rate-cards — Create new rate card
router.post('/', async (req, res) => {
  try {
    const payload = { ...req.body };
    delete payload._id;
    delete payload.id;

    const isAutoNumber = !payload.rateCardNumber || payload.rateCardNumber === 'Auto-generated on Save';
    let saved = null;
    let attempts = 0;
    const maxAttempts = 5;

    while (!saved && attempts < maxAttempts) {
      attempts++;
      try {
        if (isAutoNumber) {
          payload.rateCardNumber = await generateNextRateCardNumber(attempts - 1);
        }

        const newRC = new RateCard({
          ...payload,
          version: payload.version || 1,
          status: payload.status || 'Active'
        });

        saved = await newRC.save();
      } catch (saveErr) {
        if (saveErr.code === 11000 && isAutoNumber && attempts < maxAttempts) {
          console.warn(`[MongoDB Warning] Collision on auto-generated rateCardNumber ${payload.rateCardNumber}. Retrying (attempt ${attempts + 1})...`);
          continue;
        }
        throw saveErr;
      }
    }

    if (!saved) {
      throw new Error('Failed to persist rate card after retry attempts.');
    }

    console.log(`[MongoDB] New RateCard created: ${saved.rateCardNumber} ID: ${saved._id}`);
    res.status(201).json(saved);
  } catch (err) {
    console.error('[MongoDB Error] RateCard creation error:', err.message);
    res.status(500).json({ error: err.message, message: err.message });
  }
});

// Helper to check if pricing-relevant fields changed
function hasPricingChanged(existing, incoming) {
  if (incoming.publishNewVersion) return true;
  if (incoming.version && incoming.version > (existing.version || 1)) return true;

  if (incoming.rateRules && JSON.stringify(incoming.rateRules) !== JSON.stringify(existing.rateRules)) {
    return true;
  }
  if (incoming.routes && JSON.stringify(incoming.routes) !== JSON.stringify(existing.routes)) {
    return true;
  }
  if (incoming.additionalCharges && JSON.stringify(incoming.additionalCharges) !== JSON.stringify(existing.additionalCharges)) {
    return true;
  }
  if (incoming.taxConfiguration && JSON.stringify(incoming.taxConfiguration) !== JSON.stringify(existing.taxConfiguration)) {
    return true;
  }
  return false;
}

// GET /api/rate-cards/:id/versions — Get version history
router.get('/:id/versions', async (req, res) => {
  try {
    const param = req.params.id;
    const isValidId = mongoose.isValidObjectId(param);
    const rc = await RateCard.findOne({
      $or: [
        ...(isValidId ? [{ _id: param }] : []),
        { rateCardNumber: new RegExp(`^${param}$`, 'i') }
      ]
    });
    if (!rc) return res.status(404).json({ error: 'Rate card not found' });

    const currentVersionInfo = {
      version: rc.version || 1,
      name: rc.name,
      rateRules: rc.rateRules,
      routes: rc.routes,
      additionalCharges: rc.additionalCharges,
      taxConfiguration: rc.taxConfiguration,
      validFrom: rc.validFrom,
      validUntil: rc.validUntil,
      status: rc.status,
      isCurrent: true
    };

    const history = (rc.versionHistory || []).map(v => ({ ...v.toObject ? v.toObject() : v, isCurrent: false }));
    res.json({
      rateCardNumber: rc.rateCardNumber,
      currentVersion: rc.version || 1,
      versions: [currentVersionInfo, ...history]
    });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// POST /api/rate-cards/:id/version — Explicitly publish a new rate card version
router.post('/:id/version', async (req, res) => {
  try {
    const param = req.params.id;
    const isValidId = mongoose.isValidObjectId(param);
    const rc = await RateCard.findOne({
      $or: [
        ...(isValidId ? [{ _id: param }] : []),
        { rateCardNumber: new RegExp(`^${param}$`, 'i') }
      ]
    });
    if (!rc) return res.status(404).json({ error: 'Rate card not found' });

    const oldVersion = rc.version || 1;
    const historyEntry = {
      version: oldVersion,
      name: rc.name,
      rateRules: rc.rateRules,
      routes: rc.routes,
      additionalCharges: rc.additionalCharges,
      taxConfiguration: rc.taxConfiguration,
      validFrom: rc.validFrom,
      validUntil: rc.validUntil || new Date().toISOString().split('T')[0],
      status: 'Superseded',
      supersededAt: new Date(),
      supersededBy: req.body.modifiedBy || 'Admin',
      changeSummary: req.body.changeReason || `Published Version ${oldVersion + 1}`
    };

    rc.versionHistory = [...(rc.versionHistory || []), historyEntry];
    rc.version = oldVersion + 1;
    if (req.body.rateRules) rc.rateRules = req.body.rateRules;
    if (req.body.additionalCharges) rc.additionalCharges = req.body.additionalCharges;
    if (req.body.taxConfiguration) rc.taxConfiguration = req.body.taxConfiguration;
    if (req.body.name) rc.name = req.body.name;
    if (req.body.validFrom) rc.validFrom = req.body.validFrom;
    if (req.body.validUntil) rc.validUntil = req.body.validUntil;
    rc.status = req.body.status || 'Active';

    const saved = await rc.save();
    console.log(`[RateCard] Published new Version ${saved.version} for ${saved.rateCardNumber}`);
    res.json(saved);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// PUT /api/rate-cards/:id — Update rate card with automatic version control
router.put('/:id', async (req, res) => {
  try {
    const param = req.params.id;
    const isValidId = mongoose.isValidObjectId(param);

    const rc = await RateCard.findOne({
      $or: [
        { rateCardNumber: new RegExp(`^${param}$`, 'i') },
        ...(isValidId ? [{ _id: param }] : [])
      ]
    });

    if (!rc) return res.status(404).json({ error: 'Rate card not found for update' });

    const pricingChanged = hasPricingChanged(rc, req.body);

    if (pricingChanged) {
      const oldVersion = rc.version || 1;
      const historyEntry = {
        version: oldVersion,
        name: rc.name,
        rateRules: rc.rateRules,
        routes: rc.routes,
        additionalCharges: rc.additionalCharges,
        taxConfiguration: rc.taxConfiguration,
        validFrom: rc.validFrom,
        validUntil: rc.validUntil || new Date().toISOString().split('T')[0],
        status: 'Superseded',
        supersededAt: new Date(),
        supersededBy: req.body.modifiedBy || 'Admin',
        changeSummary: req.body.changeReason || `Pricing modified. Bumped to Version ${oldVersion + 1}.`
      };

      rc.versionHistory = [...(rc.versionHistory || []), historyEntry];
      rc.version = oldVersion + 1;
      rc.validFrom = req.body.validFrom || new Date().toISOString().split('T')[0];
      console.log(`[RateCard] Pricing changed on ${rc.rateCardNumber}. Archived Version ${oldVersion} -> Activated Version ${rc.version}`);
    }

    // Apply updates
    if (req.body.name) rc.name = req.body.name;
    if (req.body.rateRules) rc.rateRules = req.body.rateRules;
    if (req.body.routes) rc.routes = req.body.routes;
    if (req.body.additionalCharges) rc.additionalCharges = req.body.additionalCharges;
    if (req.body.taxConfiguration) rc.taxConfiguration = req.body.taxConfiguration;
    if (req.body.validFrom && !pricingChanged) rc.validFrom = req.body.validFrom;
    if (req.body.validUntil !== undefined) rc.validUntil = req.body.validUntil;
    if (req.body.status) rc.status = req.body.status;
    if (req.body.notes !== undefined) rc.notes = req.body.notes;

    const saved = await rc.save();
    res.json(saved);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

module.exports = router;
