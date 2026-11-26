const express = require('express');
const router = express.Router();
const mongoose = require('mongoose');
const Quotation = require('../models/Quotation');
const Company = require('../models/Company');

/**
 * Generate next unique quotation number based on highest existing numerical suffix.
 * Avoids duplicate key collisions that occur when using countDocuments().
 */
async function generateNextQuotationNumber(offset = 0) {
  const currentYear = new Date().getFullYear();
  const existing = await Quotation.find({}, { quotationNumber: 1 }).lean();
  let maxNum = 0;
  for (const doc of existing) {
    if (!doc.quotationNumber) continue;
    // Match QT-YYYY-NNN or QT-NNN (ignoring any trailing version suffix like -v2)
    const match = doc.quotationNumber.match(/^QT-(?:(\d{4})-)?(\d+)/i);
    if (match && match[2]) {
      const num = parseInt(match[2], 10);
      if (!isNaN(num) && num > maxNum) {
        maxNum = num;
      }
    }
  }
  return `QT-${currentYear}-${String(maxNum + 1 + offset).padStart(3, '0')}`;
}

/**
 * Explicit, safe quotation lookup by MongoDB 24-char ObjectId or exact quotationNumber.
 * Prevents regex injection and ambiguous wildcard matching.
 */
async function findQuotationByIdOrNumber(param) {
  if (!param || typeof param !== 'string') return null;
  const trimmed = param.trim();
  if (!trimmed || trimmed === 'undefined' || trimmed === 'null') return null;

  // 1. Strict 24-character hexadecimal MongoDB ObjectId match
  if (/^[0-9a-fA-F]{24}$/.test(trimmed)) {
    try {
      const byId = await Quotation.findById(trimmed);
      if (byId) return byId;
    } catch (e) {
      // Continue to quotationNumber check
    }
  }

  // 2. Strict exact quotationNumber match (with regex escaping to prevent wildcard/regex injection)
  const escaped = trimmed.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  const byNumber = await Quotation.findOne({
    quotationNumber: new RegExp(`^${escaped}$`, 'i')
  });

  return byNumber;
}

// GET /api/quotations — List quotations (strictly scoped to resolved company when companyId/companyCode/companyName is provided)
router.get('/', async (req, res) => {
  const correlationId = req.correlationId || 'req_quotes_list';
  try {
    const { search, status, companyId, companyCode, companyName } = req.query;
    const andConditions = [];

    if (status && status !== 'All') {
      const escapedStatus = status.trim().replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
      andConditions.push({ status: new RegExp(`^${escapedStatus}$`, 'i') });
    }

    const rawCompanyFilter = (companyId && companyId !== 'All' ? companyId : '').trim();
    const rawCompanyCode = (companyCode && companyCode !== 'All' ? companyCode : '').trim();
    const rawCompanyName = (companyName && companyName !== 'All' ? companyName : '').trim();

    if (rawCompanyFilter || rawCompanyCode || rawCompanyName) {
      // Resolve master Company record so all identifiers (_id, companyId, companyCode, companyName) of ONLY this company are matched
      const compLookupOr = [];
      if (rawCompanyFilter) {
        const esc = rawCompanyFilter.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
        if (mongoose.isValidObjectId(rawCompanyFilter)) {
          compLookupOr.push({ _id: rawCompanyFilter });
        }
        compLookupOr.push(
          { companyId: rawCompanyFilter },
          { companyId: new RegExp(`^${esc}$`, 'i') },
          { companyCode: new RegExp(`^${esc}$`, 'i') },
          { companyName: new RegExp(`^${esc}$`, 'i') }
        );
      }
      if (rawCompanyCode) {
        const escCode = rawCompanyCode.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
        compLookupOr.push({ companyCode: new RegExp(`^${escCode}$`, 'i') }, { companyId: new RegExp(`^${escCode}$`, 'i') });
      }
      if (rawCompanyName) {
        const escName = rawCompanyName.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
        compLookupOr.push({ companyName: new RegExp(`^${escName}$`, 'i') });
      }

      let resolvedCompany = null;
      if (compLookupOr.length > 0) {
        resolvedCompany = await Company.findOne({ $or: compLookupOr }).lean().catch(() => null);
      }

      const idValues = new Set();
      const codeValues = new Set();
      const nameValues = new Set();

      if (rawCompanyFilter) idValues.add(rawCompanyFilter);
      if (rawCompanyCode) codeValues.add(rawCompanyCode);
      if (rawCompanyName) nameValues.add(rawCompanyName);

      if (resolvedCompany) {
        if (resolvedCompany._id) idValues.add(resolvedCompany._id.toString());
        if (resolvedCompany.id) idValues.add(String(resolvedCompany.id).trim());
        if (resolvedCompany.companyId) idValues.add(String(resolvedCompany.companyId).trim());
        if (resolvedCompany.companyCode) {
          codeValues.add(String(resolvedCompany.companyCode).trim());
          idValues.add(String(resolvedCompany.companyCode).trim());
        }
        if (resolvedCompany.companyName) nameValues.add(String(resolvedCompany.companyName).trim());
      }

      const companyOr = [];
      for (const idVal of idValues) {
        if (!idVal) continue;
        const esc = idVal.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
        companyOr.push({ companyId: idVal });
        companyOr.push({ companyId: new RegExp(`^${esc}$`, 'i') });
        if (mongoose.isValidObjectId(idVal)) {
          companyOr.push({ companyId: new mongoose.Types.ObjectId(idVal) });
        }
        companyOr.push({ companyCode: new RegExp(`^${esc}$`, 'i') });
        companyOr.push({ companyName: new RegExp(`^${esc}$`, 'i') });
      }
      for (const codeVal of codeValues) {
        if (!codeVal) continue;
        const esc = codeVal.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
        companyOr.push({ companyCode: new RegExp(`^${esc}$`, 'i') });
        companyOr.push({ companyId: new RegExp(`^${esc}$`, 'i') });
      }
      for (const nameVal of nameValues) {
        if (!nameVal) continue;
        const esc = nameVal.trim().replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
        companyOr.push({ companyName: new RegExp(`^\\s*${esc}\\s*$`, 'i') });
      }

      if (companyOr.length > 0) {
        andConditions.push({ $or: companyOr });
      }
      // Strictly exclude generic/rate-card entries when filtering by a specific company
      andConditions.push({
        isRateCard: { $ne: true },
        companyId: { $nin: [null, '', 'ALL', 'all'] },
        companyCode: { $nin: ['ALL', 'all'] }
      });
    }

    if (search) {
      const q = search.trim();
      const escaped = q.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
      andConditions.push({
        $or: [
          { quotationNumber: { $regex: escaped, $options: 'i' } },
          { companyName: { $regex: escaped, $options: 'i' } },
          { companyCode: { $regex: escaped, $options: 'i' } }
        ]
      });
    }

    const query = andConditions.length > 0 ? { $and: andConditions } : {};
    const list = await Quotation.find(query).sort({ version: -1, createdAt: -1 });
    console.log(`✓ [${correlationId}] GET /api/quotations -> 200 OK (${list.length} records)`);
    res.json(list);
  } catch (err) {
    console.error(`❌ [${correlationId}] GET /api/quotations error:`, err.message);
    res.status(500).json({ error: err.message, message: err.message });
  }
});

// GET /api/quotations/:id — Get single quotation
router.get('/:id', async (req, res) => {
  const { id } = req.params;
  const correlationId = req.correlationId || 'req_quote_get';

  if (!id || id === 'undefined' || id === 'null' || !id.trim()) {
    console.warn(`⚠️ [${correlationId}] GET /api/quotations/:id rejected: Missing or invalid quotation identifier: "${id}"`);
    return res.status(400).json({
      error: 'Valid quotation identifier (MongoDB _id or quotationNumber) is required.',
      message: 'Valid quotation identifier (MongoDB _id or quotationNumber) is required.'
    });
  }

  try {
    const q = await findQuotationByIdOrNumber(id);
    if (!q) {
      console.warn(`⚠️ [${correlationId}] GET /api/quotations/${id} -> 404 Not Found`);
      return res.status(404).json({
        error: `Quotation '${id.trim()}' was not found.`,
        message: `Quotation '${id.trim()}' was not found.`
      });
    }

    console.log(`✓ [${correlationId}] GET /api/quotations/${id} -> 200 OK (${q.quotationNumber}, v${q.version || 1})`);
    res.json(q);
  } catch (err) {
    console.error(`❌ [${correlationId}] GET /api/quotations/${id} database query error:`, err.message);
    res.status(500).json({ error: err.message, message: err.message });
  }
});

// POST /api/quotations — Create new quotation
router.post('/', async (req, res) => {
  try {
    const payload = { ...req.body };
    delete payload._id;
    delete payload.id;

    // Normalize date aliases
    if (payload.effectiveFrom && !payload.validFrom) payload.validFrom = payload.effectiveFrom;
    if (payload.validFrom && !payload.effectiveFrom) payload.effectiveFrom = payload.validFrom;
    if (payload.effectiveUntil !== undefined && payload.validUntil === undefined) payload.validUntil = payload.effectiveUntil;
    if (payload.validUntil !== undefined && payload.effectiveUntil === undefined) payload.effectiveUntil = payload.validUntil;

    // Harmonize rateRules and routes
    if (payload.rateRules && !payload.routes) payload.routes = payload.rateRules;
    if (payload.routes && !payload.rateRules) payload.rateRules = payload.routes;

    // Corporate client lookup if companyId provided but companyName/code missing
    if (payload.companyId && (!payload.companyName || !payload.companyCode)) {
      try {
        const comp = await Company.findOne({
          $or: [
            ...(mongoose.isValidObjectId(payload.companyId) ? [{ _id: payload.companyId }] : []),
            { companyCode: payload.companyId }
          ]
        }).lean();
        if (comp) {
          if (!payload.companyName) payload.companyName = comp.companyName;
          if (!payload.companyCode) payload.companyCode = comp.companyCode;
        }
      } catch (cErr) {
        // Proceed with available payload
      }
    }

    const isAutoNumber = !payload.quotationNumber || payload.quotationNumber === 'Auto-generated on Save';
    let saved = null;
    let attempts = 0;
    const maxAttempts = 5;

    while (!saved && attempts < maxAttempts) {
      attempts++;
      try {
        if (isAutoNumber) {
          payload.quotationNumber = await generateNextQuotationNumber(attempts - 1);
        }

        const newQuotation = new Quotation({
          ...payload,
          version: payload.version || 1,
          status: payload.status || 'Active'
        });

        saved = await newQuotation.save();
      } catch (saveErr) {
        if (saveErr.code === 11000 && isAutoNumber && attempts < maxAttempts) {
          console.warn(`[MongoDB Warning] Collision on auto-generated quotationNumber ${payload.quotationNumber}. Retrying (attempt ${attempts + 1})...`);
          continue;
        }
        throw saveErr;
      }
    }

    if (!saved) {
      throw new Error('Failed to persist quotation after retry attempts.');
    }

    console.log(`[MongoDB] New Quotation created: ${saved.quotationNumber} (v${saved.version}) ID: ${saved._id}`);
    res.status(201).json(saved);
  } catch (err) {
    console.error('[MongoDB Error] Quotation creation error:', err.message);
    res.status(500).json({ error: err.message, message: err.message });
  }
});

// Helper to check if quotation pricing-relevant fields changed
function hasQuotationPricingChanged(existing, incoming) {
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

// GET /api/quotations/:id/versions — Get quotation version history
router.get('/:id/versions', async (req, res) => {
  const { id } = req.params;
  const correlationId = req.correlationId || 'req_quote_versions';

  if (!id || id === 'undefined' || id === 'null' || !id.trim()) {
    return res.status(400).json({
      error: 'Valid quotation identifier is required.',
      message: 'Valid quotation identifier is required.'
    });
  }

  try {
    const q = await findQuotationByIdOrNumber(id);
    if (!q) {
      return res.status(404).json({
        error: `Quotation '${id.trim()}' was not found.`,
        message: `Quotation '${id.trim()}' was not found.`
      });
    }

    const currentVersionInfo = {
      version: q.version || 1,
      quotationNumber: q.quotationNumber,
      companyId: q.companyId,
      companyName: q.companyName,
      companyCode: q.companyCode,
      rateRules: q.rateRules,
      routes: q.routes,
      additionalCharges: q.additionalCharges,
      taxConfiguration: q.taxConfiguration,
      validFrom: q.validFrom || q.effectiveFrom,
      validUntil: q.validUntil || q.effectiveUntil,
      status: q.status,
      isCurrent: true
    };

    const history = (q.versionHistory || []).map(v => ({ ...v.toObject ? v.toObject() : v, isCurrent: false }));
    res.json({
      quotationNumber: q.quotationNumber,
      currentVersion: q.version || 1,
      versions: [currentVersionInfo, ...history]
    });
  } catch (err) {
    console.error(`❌ [${correlationId}] GET /api/quotations/${id}/versions error:`, err.message);
    res.status(500).json({ error: err.message, message: err.message });
  }
});

// POST /api/quotations/:id/version — Explicitly publish a new quotation version
router.post('/:id/version', async (req, res) => {
  const { id } = req.params;
  const correlationId = req.correlationId || 'req_quote_pub_ver';

  if (!id || id === 'undefined' || id === 'null' || !id.trim()) {
    return res.status(400).json({
      error: 'Valid quotation identifier is required.',
      message: 'Valid quotation identifier is required.'
    });
  }

  try {
    const q = await findQuotationByIdOrNumber(id);
    if (!q) {
      return res.status(404).json({
        error: `Quotation '${id.trim()}' was not found.`,
        message: `Quotation '${id.trim()}' was not found.`
      });
    }

    const oldVersion = q.version || 1;
    const historyEntry = {
      version: oldVersion,
      companyId: q.companyId,
      companyName: q.companyName,
      companyCode: q.companyCode,
      rateRules: q.rateRules,
      routes: q.routes,
      additionalCharges: q.additionalCharges,
      taxConfiguration: q.taxConfiguration,
      validFrom: q.validFrom || q.effectiveFrom,
      validUntil: q.validUntil || q.effectiveUntil || new Date().toISOString().split('T')[0],
      status: 'Superseded',
      supersededAt: new Date(),
      supersededBy: req.body.modifiedBy || 'Admin',
      changeSummary: req.body.changeReason || `Published Version ${oldVersion + 1}`
    };

    q.versionHistory = [...(q.versionHistory || []), historyEntry];
    q.version = oldVersion + 1;
    if (req.body.rateRules) {
      q.rateRules = req.body.rateRules;
      if (!req.body.routes) q.routes = req.body.rateRules;
    }
    if (req.body.routes) {
      q.routes = req.body.routes;
      if (!req.body.rateRules) q.rateRules = req.body.routes;
    }
    if (req.body.additionalCharges) q.additionalCharges = req.body.additionalCharges;
    if (req.body.taxConfiguration) q.taxConfiguration = req.body.taxConfiguration;
    if (req.body.effectiveFrom || req.body.validFrom) {
      q.validFrom = req.body.validFrom || req.body.effectiveFrom;
      q.effectiveFrom = q.validFrom;
    }
    if (req.body.effectiveUntil !== undefined || req.body.validUntil !== undefined) {
      q.validUntil = req.body.validUntil !== undefined ? req.body.validUntil : req.body.effectiveUntil;
      q.effectiveUntil = q.validUntil;
    }
    q.status = req.body.status || 'Active';
    if (req.body.notes !== undefined) q.notes = req.body.notes;

    const saved = await q.save();
    console.log(`✓ [${correlationId}] Published new Version ${saved.version} for ${saved.quotationNumber}`);
    res.json(saved);
  } catch (err) {
    console.error(`❌ [${correlationId}] POST /api/quotations/${id}/version error:`, err.message);
    res.status(500).json({ error: err.message, message: err.message });
  }
});

// PUT /api/quotations/:id — Update quotation with automatic version control
router.put('/:id', async (req, res) => {
  const { id } = req.params;
  const correlationId = req.correlationId || 'req_quote_put';

  if (!id || id === 'undefined' || id === 'null' || !id.trim()) {
    return res.status(400).json({
      error: 'Valid quotation identifier is required.',
      message: 'Valid quotation identifier is required.'
    });
  }

  try {
    const q = await findQuotationByIdOrNumber(id);
    if (!q) {
      return res.status(404).json({
        error: `Quotation '${id.trim()}' was not found for update.`,
        message: `Quotation '${id.trim()}' was not found for update.`
      });
    }

    const pricingChanged = hasQuotationPricingChanged(q, req.body);

    if (pricingChanged) {
      const oldVersion = q.version || 1;
      const historyEntry = {
        version: oldVersion,
        companyId: q.companyId,
        companyName: q.companyName,
        companyCode: q.companyCode,
        rateRules: q.rateRules,
        routes: q.routes,
        additionalCharges: q.additionalCharges,
        taxConfiguration: q.taxConfiguration,
        validFrom: q.validFrom || q.effectiveFrom,
        validUntil: q.validUntil || q.effectiveUntil || new Date().toISOString().split('T')[0],
        status: 'Superseded',
        supersededAt: new Date(),
        supersededBy: req.body.modifiedBy || 'Admin',
        changeSummary: req.body.changeReason || `Pricing modified. Bumped to Version ${oldVersion + 1}.`
      };

      q.versionHistory = [...(q.versionHistory || []), historyEntry];
      q.version = oldVersion + 1;
      q.validFrom = req.body.validFrom || req.body.effectiveFrom || new Date().toISOString().split('T')[0];
      q.effectiveFrom = q.validFrom;
      console.log(`✓ [${correlationId}] Pricing changed on ${q.quotationNumber}. Archived Version ${oldVersion} -> Activated Version ${q.version}`);
    }

    // Apply updates
    if (req.body.companyName) q.companyName = req.body.companyName;
    if (req.body.companyCode) q.companyCode = req.body.companyCode;
    if (req.body.companyId) q.companyId = req.body.companyId;
    if (req.body.rateRules) {
      q.rateRules = req.body.rateRules;
      if (!req.body.routes) q.routes = req.body.rateRules;
    }
    if (req.body.routes) {
      q.routes = req.body.routes;
      if (!req.body.rateRules) q.rateRules = req.body.routes;
    }
    if (req.body.additionalCharges) q.additionalCharges = req.body.additionalCharges;
    if (req.body.taxConfiguration) q.taxConfiguration = req.body.taxConfiguration;
    if ((req.body.validFrom || req.body.effectiveFrom) && !pricingChanged) {
      q.validFrom = req.body.validFrom || req.body.effectiveFrom;
      q.effectiveFrom = q.validFrom;
    }
    if (req.body.validUntil !== undefined || req.body.effectiveUntil !== undefined) {
      q.validUntil = req.body.validUntil !== undefined ? req.body.validUntil : req.body.effectiveUntil;
      q.effectiveUntil = q.validUntil;
    }
    if (req.body.status) q.status = req.body.status;
    if (req.body.notes !== undefined) q.notes = req.body.notes;

    const saved = await q.save();
    res.json(saved);
  } catch (err) {
    res.status(500).json({ error: err.message, message: err.message });
  }
});

module.exports = router;
