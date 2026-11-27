const mongoose = require('mongoose');
const Quotation = require('../models/Quotation');
const RateCard = require('../models/RateCard');
const Company = require('../models/Company');
const { calculateFreightAmount, formatFreightDescription } = require('./freightCalculationService');

/**
 * Normalize location name for deterministic exact route comparison.
 * Strips hub prefixes/suffixes, parentheses, but preserves exact city identity.
 */
function normalizeLocation(loc) {
  if (!loc) return '';
  let str = String(loc)
    .replace(/\s*\([^)]*\)/g, '') // remove parenthetical notes, e.g. (KA-BLR-01)
    .replace(/\bhub\b/gi, '')     // remove "Hub"
    .replace(/[^a-zA-Z0-9]/g, ' ') // replace non-alphanumeric with space
    .replace(/\s+/g, ' ')
    .trim()
    .toUpperCase();

  // Standard city alias normalization
  if (str === 'BANGALORE' || str === 'BENGALURU') return 'BANGALORE';
  if (str === 'GURGAON' || str === 'GURUGRAM' || str === 'GURGOAN') return 'GURGAON';
  if (str === 'NARSAPURA' || str === 'NARSARPURA') return 'NARSAPURA';
  if (str === 'BOMBAY' || str === 'MUMBAI') return 'MUMBAI';
  if (str === 'CALCUTTA' || str === 'KOLKATA') return 'KOLKATA';
  if (str === 'MADRAS' || str === 'CHENNAI') return 'CHENNAI';
  if (str === 'UTTARANCHAL' || str === 'UTTARAKHAND') return 'UTTARAKHAND';
  if (str === 'LUDHINAA' || str === 'LUDHIANA') return 'LUDHIANA';

  return str;
}

/**
 * Normalize mode string for comparison
 */
function normalizeMode(mode) {
  if (!mode) return '';
  const m = String(mode).trim().toLowerCase();
  if (m === 'air express' || m === 'express air' || m.includes('air express') || m.includes('express air')) return 'air express';
  if (m === 'air' || m === 'cargo air') return 'air';
  if (m.includes('train') || m.includes('rail')) return 'train';
  if (m.includes('road') || m.includes('surface') || m.includes('ltl') || m.includes('ftl')) return 'road';
  return m;
}

/**
 * Verify whether an agreement is valid on the given date
 */
function isDateValid(item, targetDateStr) {
  const from = item.validFrom || item.effectiveFrom;
  const until = item.validUntil || item.effectiveUntil;
  if (!targetDateStr) return true;

  const targetDate = String(targetDateStr).split('T')[0];

  if (from && String(from).trim()) {
    const fromStr = String(from).split('T')[0];
    if (targetDate < fromStr) return false;
  }

  if (until && String(until).trim()) {
    const untilStr = String(until).split('T')[0];
    if (targetDate > untilStr) return false;
  }

  return true;
}

/**
 * Match a specific route and mode inside an agreement's rules.
 * Strictly differentiates freight modes (e.g. Air vs Air Express vs Train vs Road).
 */
function findMatchingRule(rulesList, origin, destination, mode) {
  if (!Array.isArray(rulesList) || rulesList.length === 0) return null;

  const normOrigin = normalizeLocation(origin);
  const normDest = normalizeLocation(destination);
  const normMode = normalizeMode(mode);

  if (!normOrigin || !normDest) return null;

  // 1. Strict exact route + exact mode
  const exactMatch = rulesList.find((r) => {
    const rOrigin = normalizeLocation(r.origin);
    const rDest = normalizeLocation(r.destination);
    const rMode = normalizeMode(r.mode || r.freightMode);

    const routeMatches = rOrigin === normOrigin && rDest === normDest;
    const modeMatches = Boolean(rMode && normMode && rMode === normMode);
    return routeMatches && modeMatches;
  });

  if (exactMatch) return exactMatch;

  // 2. Strict route match where rule has NO mode specified (mode-agnostic agreement rule)
  const agnosticModeMatch = rulesList.find((r) => {
    const rOrigin = normalizeLocation(r.origin);
    const rDest = normalizeLocation(r.destination);
    const rMode = normalizeMode(r.mode || r.freightMode);
    return rOrigin === normOrigin && rDest === normDest && !rMode;
  });

  return agnosticModeMatch || null;
}

function buildPricingSnapshot({ source, doc, matchedRule, origin, destination, mode, date, weight = 0, packages = 1 }) {
  const isQuote = source === 'QUOTATION';
  const baseFreight = typeof matchedRule.freightRate === 'number'
    ? matchedRule.freightRate
    : (parseFloat(matchedRule.freightRate || matchedRule.ratePerKg || matchedRule.rate) || 0);

  const minWeight = typeof matchedRule.minimumChargeableWeight === 'number'
    ? matchedRule.minimumChargeableWeight
    : (parseFloat(matchedRule.minimumChargeableWeight || matchedRule.minWeight) || 50);

  const rawAdditional =
    (Array.isArray(matchedRule.additionalCharges) && matchedRule.additionalCharges.length > 0)
      ? matchedRule.additionalCharges
      : (matchedRule.additionalCharges && !Array.isArray(matchedRule.additionalCharges) && Object.keys(matchedRule.additionalCharges).length > 0)
        ? matchedRule.additionalCharges
        : (doc.additionalCharges || []);
  const additionalList = Array.isArray(rawAdditional)
    ? rawAdditional
    : (typeof rawAdditional === 'object' && rawAdditional !== null ? Object.entries(rawAdditional).map(([k, v]) => ({ name: k, amount: v })) : []);

  let docketAmt = 0;
  let pickupAmt = 0;
  let deliveryAmt = 0;
  let packingAmt = 0;
  let laborAmt = 0;
  let godownAmt = 0;
  let otherAmt = 0;

  for (const chg of additionalList) {
    const name = (chg.name || chg.chargeName || chg.type || '').toLowerCase();
    const val = typeof chg.amount === 'number' ? chg.amount : (parseFloat(chg.amount || chg.rate || chg.value) || 0);
    if (name.includes('docket') || name.includes('lr') || name.includes('bilty') || name.includes('cn charge')) {
      docketAmt += val;
    } else if (name.includes('pickup') || name.includes('first mile')) {
      pickupAmt += val;
    } else if (name.includes('delivery') || name.includes('door delivery') || name.includes('last mile')) {
      deliveryAmt += val;
    } else if (name.includes('packing') || name.includes('packaging')) {
      packingAmt += val;
    } else if (name.includes('labor') || name.includes('labour') || name.includes('loading') || name.includes('unloading') || name.includes('handling')) {
      laborAmt += val;
    } else if (name.includes('godown') || name.includes('storage') || name.includes('demurrage') || name.includes('warehouse')) {
      godownAmt += val;
    } else {
      otherAmt += val;
    }
  }

  const taxConfig = matchedRule.taxConfiguration || doc.taxConfiguration || { applicable: true, gstRate: 18 };
  const gstRate = taxConfig.applicable !== false ? (taxConfig.gstRate !== undefined ? taxConfig.gstRate : 18) : 0;
  const isRcm = Boolean(
    taxConfig.isRcm ||
    taxConfig.rcm ||
    taxConfig.reverseCharge ||
    /rcm|reverse\s*charge/i.test(String(taxConfig.notes || doc.notes || ''))
  );
  const rawRateBasis = matchedRule.rateBasis || doc.rateBasis || 'Per KG';
  const freightCalc = calculateFreightAmount({
    rateBasis: rawRateBasis,
    baseRate: baseFreight,
    actualWeight: weight,
    chargeableWeight: weight,
    minimumWeight: minWeight,
    packages
  });

  const effectiveWeight = freightCalc.effectiveWeight;
  const freightAmount = freightCalc.freightAmount;
  const taxableAmount = freightAmount + docketAmt + pickupAmt + deliveryAmt + packingAmt + laborAmt + godownAmt + otherAmt;
  const gstAmount = Math.round(taxableAmount * (gstRate / 100));
  const grandTotal = taxableAmount + gstAmount;

  return {
    rateCardId: !isQuote ? (doc._id ? doc._id.toString() : doc.id) : null,
    rateCardNumber: !isQuote ? (doc.rateCardNumber || doc.name) : null,
    rateCardVersion: !isQuote ? (doc.version || 1) : null,
    quotationId: isQuote ? (doc._id ? doc._id.toString() : doc.id) : null,
    quotationNumber: isQuote ? doc.quotationNumber : null,
    quotationVersion: isQuote ? (doc.version || 1) : null,
    agreementType: source,
    agreementNumber: isQuote ? doc.quotationNumber : (doc.rateCardNumber || doc.name),
    agreementVersion: doc.version || 1,
    origin,
    destination,
    freightMode: mode,
    rateBasis: freightCalc.rateBasisLabel,
    rateBasisNormalized: freightCalc.normalizedBasis,
    rateUnit: freightCalc.unit,
    baseFreightRate: baseFreight,
    minimumWeight: minWeight,
    chargeableWeight: freightCalc.normalizedBasis === 'PER_KG' ? effectiveWeight : (Number(weight) || minWeight),
    docketCharges: docketAmt,
    pickupCharges: pickupAmt,
    deliveryCharges: deliveryAmt,
    packingCharges: packingAmt,
    laborCharges: laborAmt,
    godownCharges: godownAmt,
    otherCharges: otherAmt,
    additionalCharges: additionalList,
    gstPercentage: gstRate,
    isRcm,
    taxConfiguration: { ...taxConfig, isRcm },
    calculatedCharges: {
      freightAmount,
      docketCharges: docketAmt,
      pickupCharges: pickupAmt,
      deliveryCharges: deliveryAmt,
      packingCharges: packingAmt,
      laborCharges: laborAmt,
      godownCharges: godownAmt,
      otherCharges: otherAmt,
      taxableAmount,
      gstRate,
      gstAmount,
      grandTotal,
      lineItems: [
        {
          name: 'Freight Charges',
          description: formatFreightDescription({
            rateBasis: freightCalc.rateBasisLabel,
            rate: baseFreight,
            source,
            agreementNumber: isQuote ? doc.quotationNumber : (doc.rateCardNumber || doc.name),
            version: doc.version || 1
          }),
          rate: baseFreight,
          rateBasis: freightCalc.rateBasisLabel,
          quantity: freightCalc.quantity,
          unit: freightCalc.unit,
          weight: freightCalc.normalizedBasis === 'PER_KG' ? effectiveWeight : 0,
          amount: freightAmount
        },
        ...(docketAmt > 0 ? [{ name: 'Docket Charge', amount: docketAmt }] : []),
        ...(pickupAmt > 0 ? [{ name: 'Pickup Charge', amount: pickupAmt }] : []),
        ...(deliveryAmt > 0 ? [{ name: 'Delivery Charge', amount: deliveryAmt }] : []),
        ...(packingAmt > 0 ? [{ name: 'Packing Charge', amount: packingAmt }] : []),
        ...(laborAmt > 0 ? [{ name: 'Labor Charge', amount: laborAmt }] : []),
        ...(godownAmt > 0 ? [{ name: 'Godown Charge', amount: godownAmt }] : [])
      ]
    },
    effectiveDate: date,
    isImmutable: true,
    capturedAt: new Date().toISOString()
  };
}

/**
 * Validate pricing coverage for a shipment against Company Quotations and Rate Cards.
 *
 * @param {Object} params
 * @param {string} params.companyId
 * @param {string} params.companyCode
 * @param {string} params.companyName
 * @param {string} params.origin
 * @param {string} params.destination
 * @param {string} params.freightMode
 * @param {string} params.mode
 * @param {string} params.date
 * @param {Object} [dbConnection] Optional mongoose connection
 * @returns {Promise<Object>} Pricing validation object
 */
async function validateShipmentPricing({
  companyId = '',
  companyCode = '',
  companyName = '',
  origin = '',
  destination = '',
  freightMode = '',
  mode = '',
  date = new Date().toISOString().split('T')[0]
}, dbConnection = null) {
  const targetMode = freightMode || mode || 'Road';
  const targetDate = date || new Date().toISOString().split('T')[0];

  const CompanyModel = dbConnection ? dbConnection.model('Company', Company.schema) : Company;
  const QuotationModel = dbConnection ? dbConnection.model('Quotation', Quotation.schema) : Quotation;
  const RateCardModel = dbConnection ? dbConnection.model('RateCard', RateCard.schema) : RateCard;

  // 1. Resolve Master Company record from MongoDB
  let resolvedCompany = null;
  const compQueryConditions = [];
  if (companyId && companyId.trim() && companyId !== 'All') {
    const trimmed = companyId.trim();
    if (mongoose.isValidObjectId(trimmed)) {
      compQueryConditions.push({ _id: trimmed });
    }
    compQueryConditions.push({ companyId: trimmed });
    compQueryConditions.push({ companyId: new RegExp(`^${trimmed}$`, 'i') });
    compQueryConditions.push({ companyCode: new RegExp(`^${trimmed}$`, 'i') });
  }
  if (companyCode && companyCode.trim() && companyCode !== 'All') {
    const trimmedCode = companyCode.trim();
    compQueryConditions.push({ companyCode: new RegExp(`^${trimmedCode}$`, 'i') });
    compQueryConditions.push({ companyId: new RegExp(`^${trimmedCode}$`, 'i') });
  }
  if (companyName && companyName.trim() && companyName !== 'All') {
    const trimmedName = companyName.trim().replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
    compQueryConditions.push({ companyName: new RegExp(`^${trimmedName}$`, 'i') });
  }

  if (compQueryConditions.length > 0) {
    try {
      resolvedCompany = await CompanyModel.findOne({ $or: compQueryConditions });
    } catch (compErr) {
      console.warn('[Pricing Validation Service] Company resolution notice:', compErr.message);
    }
  }

  const allCompanyIds = new Set();
  const allCompanyCodes = new Set();
  const allCompanyNames = new Set();

  if (companyId && companyId.trim() && companyId !== 'All') allCompanyIds.add(companyId.trim());
  if (companyCode && companyCode.trim() && companyCode !== 'All') allCompanyCodes.add(companyCode.trim().toUpperCase());
  if (companyName && companyName.trim() && companyName !== 'All') allCompanyNames.add(companyName.trim().toUpperCase());

  if (resolvedCompany) {
    if (resolvedCompany._id) allCompanyIds.add(resolvedCompany._id.toString());
    if (resolvedCompany.id) allCompanyIds.add(resolvedCompany.id);
    if (resolvedCompany.companyId) allCompanyIds.add(resolvedCompany.companyId);
    if (resolvedCompany.companyCode) {
      allCompanyCodes.add(resolvedCompany.companyCode.toUpperCase());
      allCompanyIds.add(resolvedCompany.companyCode);
    }
    if (resolvedCompany.companyName) allCompanyNames.add(resolvedCompany.companyName.toUpperCase());
  }

  const quotationOrConditions = [];
  for (const id of allCompanyIds) {
    quotationOrConditions.push({ companyId: id });
    quotationOrConditions.push({ companyId: new RegExp(`^${id}$`, 'i') });
    if (mongoose.isValidObjectId(id)) {
      quotationOrConditions.push({ companyId: new mongoose.Types.ObjectId(id) });
    }
  }
  for (const code of allCompanyCodes) {
    quotationOrConditions.push({ companyCode: new RegExp(`^${code}$`, 'i') });
    quotationOrConditions.push({ companyId: new RegExp(`^${code}$`, 'i') });
  }
  for (const name of allCompanyNames) {
    const escaped = name.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
    quotationOrConditions.push({ companyName: new RegExp(`^${escaped}$`, 'i') });
  }

  let companyQuotations = [];
  if (quotationOrConditions.length > 0) {
    companyQuotations = await QuotationModel.find({
      $or: quotationOrConditions,
      status: { $regex: /^active$/i }
    }).sort({ version: -1, createdAt: -1 });
  }

  // Filter for date validity
  const validCompanyQuotations = companyQuotations.filter((q) => isDateValid(q, targetDate));

  // Diagnostic Log Output (Requirement 7)
  console.log(`[Pricing Validation] Checking coverage:
  • Company: ID="${companyId}", Code="${companyCode}", Name="${companyName}"
  • Resolved Master Company: ${resolvedCompany ? `${resolvedCompany.companyName} (${resolvedCompany.companyCode} / ${resolvedCompany.companyId})` : 'None / Not in DB'}
  • Route: "${origin}" → "${destination}", Mode="${targetMode}", Date="${targetDate}"
  • Found Active Quotation(s): [${companyQuotations.map(q => `${q.quotationNumber} (v${q.version}, ${q.status})`).join(', ') || 'None'}]
  • Effective Active Quotations: ${validCompanyQuotations.length}`);

  // When Origin or Destination is not yet entered (e.g. right after selecting company in UI)
  if (!origin || !destination || !origin.trim() || !destination.trim()) {
    if (validCompanyQuotations.length > 0) {
      const primaryQuote = validCompanyQuotations[0];
      const rulesList = [
        ...(Array.isArray(primaryQuote.rateRules) ? primaryQuote.rateRules : []),
        ...(Array.isArray(primaryQuote.routes) ? primaryQuote.routes : [])
      ];
      console.log(`  ➔ Status PENDING_ROUTE: Company has active quotation ${primaryQuote.quotationNumber} (v${primaryQuote.version}) covering ${rulesList.length} route(s). Awaiting pickup & delivery locations.`);
      return {
        status: 'PENDING_ROUTE',
        source: 'QUOTATION',
        quotationId: primaryQuote._id ? primaryQuote._id.toString() : primaryQuote.id,
        quotationNumber: primaryQuote.quotationNumber,
        quotationVersion: primaryQuote.version || 1,
        agreementVersion: primaryQuote.version || 1,
        rateCardId: null,
        rateCardNumber: null,
        rateCardVersion: null,
        companyId: primaryQuote.companyId || (resolvedCompany?.companyId || companyId),
        companyCode: primaryQuote.companyCode || (resolvedCompany?.companyCode || companyCode),
        companyName: primaryQuote.companyName || (resolvedCompany?.companyName || companyName),
        origin: '',
        destination: '',
        freightMode: targetMode,
        appliedRate: 0,
        minimumChargeableWeight: 0,
        appliedRuleSnapshot: null,
        pricingSnapshot: null,
        validatedAt: new Date(),
        overrideConfirmed: false,
        overrideConfirmedBy: null,
        overrideConfirmedAt: null,
        isCovered: false,
        hasCompanyAgreement: true,
        totalRoutesCovered: rulesList.length,
        message: `Quotation Found – ${primaryQuote.quotationNumber} (v${primaryQuote.version || 1}) with ${rulesList.length} route(s). Enter origin and destination to validate route.`
      };
    }
  }

  // Check whether any company quotation covers the exact route
  for (const quote of validCompanyQuotations) {
    const rulesList = [
      ...(Array.isArray(quote.rateRules) ? quote.rateRules : []),
      ...(Array.isArray(quote.routes) ? quote.routes : [])
    ];

    const matchedRule = findMatchingRule(rulesList, origin, destination, targetMode);
    if (matchedRule) {
      console.log(`  ✓ Route MATCHED on Quotation ${quote.quotationNumber}: ${matchedRule.origin} → ${matchedRule.destination} (${matchedRule.mode || targetMode}) @ ₹${matchedRule.freightRate}/kg`);
      const baseFreight = typeof matchedRule.freightRate === 'number'
        ? matchedRule.freightRate
        : (parseFloat(matchedRule.freightRate || matchedRule.ratePerKg || matchedRule.rate) || 0);

      const minWeight = typeof matchedRule.minimumChargeableWeight === 'number'
        ? matchedRule.minimumChargeableWeight
        : (parseFloat(matchedRule.minimumChargeableWeight || matchedRule.minWeight) || 0);

      const pricingSnapshot = buildPricingSnapshot({
        source: 'QUOTATION',
        doc: quote,
        matchedRule,
        origin,
        destination,
        mode: targetMode,
        date: targetDate
      });

      return {
        status: 'MATCHED',
        source: 'QUOTATION',
        quotationId: quote._id ? quote._id.toString() : quote.id,
        quotationNumber: quote.quotationNumber,
        quotationVersion: quote.version || 1,
        agreementVersion: quote.version || 1,
        rateCardId: null,
        rateCardNumber: null,
        rateCardVersion: null,
        companyId: quote.companyId || (resolvedCompany?.companyId || companyId),
        companyCode: quote.companyCode || (resolvedCompany?.companyCode || companyCode),
        companyName: quote.companyName || (resolvedCompany?.companyName || companyName),
        origin,
        destination,
        freightMode: targetMode,
        rateBasis: pricingSnapshot.rateBasis,
        appliedRate: baseFreight,
        minimumChargeableWeight: minWeight,
        appliedRuleSnapshot: {
          quotationNumber: quote.quotationNumber,
          version: quote.version || 1,
          origin: matchedRule.origin,
          destination: matchedRule.destination,
          mode: matchedRule.mode || targetMode,
          rateBasis: pricingSnapshot.rateBasis,
          freightRate: baseFreight,
          minimumChargeableWeight: minWeight,
          additionalCharges: matchedRule.additionalCharges || quote.additionalCharges || [],
          taxConfiguration: pricingSnapshot.taxConfiguration
        },
        pricingSnapshot,
        validatedAt: new Date(),
        overrideConfirmed: false,
        overrideConfirmedBy: null,
        overrideConfirmedAt: null,
        isCovered: true,
        message: `Quotation Available – ${quote.quotationNumber} (v${quote.version || 1})`
      };
    } else {
      console.log(`  ✕ Route ${origin} → ${destination} (${targetMode}) NOT covered by Quotation ${quote.quotationNumber} (${rulesList.length} rules checked)`);
    }
  }

  // 2. Scenario B: Check if an applicable active Rate Card exists
  // Query RateCard collection for active rate cards
  let activeRateCards = [];
  try {
    activeRateCards = await RateCardModel.find({
      status: { $regex: /^active$/i }
    }).sort({ version: -1, createdAt: -1 });
  } catch (rcErr) {
    console.warn('[Pricing Validation Service] RateCard query notice:', rcErr.message);
  }

  // Also allow Quotations marked as generic rate cards (no companyId, companyId='ALL', or isRateCard=true)
  try {
    const genericQuotations = await QuotationModel.find({
      $or: [
        { isRateCard: true },
        { companyId: null },
        { companyId: '' },
        { companyId: 'ALL' },
        { companyCode: 'ALL' }
      ],
      status: { $regex: /^active$/i }
    }).sort({ version: -1, createdAt: -1 });

    activeRateCards = [...activeRateCards, ...genericQuotations];
  } catch (gqErr) {
    // ignore
  }

  const validRateCards = activeRateCards.filter((rc) => isDateValid(rc, targetDate));

  for (const rc of validRateCards) {
    const rulesList = [
      ...(Array.isArray(rc.rateRules) ? rc.rateRules : []),
      ...(Array.isArray(rc.routes) ? rc.routes : [])
    ];

    const matchedRule = findMatchingRule(rulesList, origin, destination, targetMode);
    if (matchedRule) {
      const baseFreight = typeof matchedRule.freightRate === 'number'
        ? matchedRule.freightRate
        : (parseFloat(matchedRule.freightRate || matchedRule.ratePerKg || matchedRule.rate) || 0);

      const minWeight = typeof matchedRule.minimumChargeableWeight === 'number'
        ? matchedRule.minimumChargeableWeight
        : (parseFloat(matchedRule.minimumChargeableWeight || matchedRule.minWeight) || 0);

      const rcNumber = rc.rateCardNumber || rc.quotationNumber || rc.name || 'RC-STANDARD';

      const pricingSnapshot = buildPricingSnapshot({
        source: 'RATE_CARD',
        doc: rc,
        matchedRule,
        origin,
        destination,
        mode: targetMode,
        date: targetDate
      });

      return {
        status: 'MATCHED',
        source: 'RATE_CARD',
        quotationId: null,
        quotationNumber: null,
        quotationVersion: null,
        rateCardId: rc._id ? rc._id.toString() : rc.id,
        rateCardNumber: rcNumber,
        rateCardName: rc.name || rcNumber,
        rateCardVersion: rc.version || 1,
        agreementVersion: rc.version || 1,
        companyId: companyId || 'ALL',
        companyName: companyName || 'Standard / Rate Card',
        origin,
        destination,
        freightMode: targetMode,
        rateBasis: pricingSnapshot.rateBasis,
        appliedRate: baseFreight,
        minimumChargeableWeight: minWeight,
        appliedRuleSnapshot: {
          rateCardNumber: rcNumber,
          rateCardName: rc.name || rcNumber,
          version: rc.version || 1,
          origin: matchedRule.origin,
          destination: matchedRule.destination,
          mode: matchedRule.mode || targetMode,
          rateBasis: pricingSnapshot.rateBasis,
          freightRate: baseFreight,
          minimumChargeableWeight: minWeight,
          additionalCharges: matchedRule.additionalCharges || rc.additionalCharges || [],
          taxConfiguration: pricingSnapshot.taxConfiguration
        },
        pricingSnapshot,
        validatedAt: new Date(),
        overrideConfirmed: false,
        overrideConfirmedBy: null,
        overrideConfirmedAt: null,
        isCovered: true,
        message: `No Company Quotation – Charges Based on Rate Card (${rcNumber})`
      };
    }
  }

  // 3. Scenario C: Neither Quotation nor Rate Card exists
  console.log(`  ✕ Result: Neither Quotation nor Rate Card covers route "${origin}" → "${destination}" (${targetMode}). Returning MISSING.`);
  return {
    status: 'MISSING',
    source: 'NONE',
    quotationId: null,
    quotationNumber: null,
    quotationVersion: null,
    rateCardId: null,
    rateCardNumber: null,
    rateCardVersion: null,
    companyId: resolvedCompany?.companyId || companyId,
    companyCode: resolvedCompany?.companyCode || companyCode,
    companyName: resolvedCompany?.companyName || companyName,
    origin,
    destination,
    freightMode: targetMode,
    appliedRate: 0,
    minimumChargeableWeight: 0,
    appliedRuleSnapshot: null,
    validatedAt: new Date(),
    overrideConfirmed: false,
    overrideConfirmedBy: null,
    overrideConfirmedAt: null,
    isCovered: false,
    message: 'The selected company does not have an applicable quotation or rate card for this shipment route and mode.'
  };
}

module.exports = {
  normalizeLocation,
  normalizeMode,
  isDateValid,
  findMatchingRule,
  buildPricingSnapshot,
  validateShipmentPricing
};
