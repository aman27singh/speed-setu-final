/**
 * Speed Setu Pricing & Quotation Validation Helpers
 */

export const PRICING_STATUS = {
  MATCHED: 'MATCHED',
  MISSING: 'MISSING',
  PENDING_REVIEW: 'PENDING_REVIEW'
};

export const PRICING_SOURCE = {
  QUOTATION: 'QUOTATION',
  RATE_CARD: 'RATE_CARD',
  NONE: 'NONE'
};

export function normalizeRateBasis(basis) {
  const b = String(basis || '')
    .trim()
    .toUpperCase()
    .replace(/[\s\-]+/g, '_');

  if (
    b === 'PER_SHIPMENT' ||
    b === 'SHIPMENT' ||
    b === 'FIXED_PER_SHIPMENT' ||
    b === 'FLAT_RATE' ||
    b === 'FLAT' ||
    b === 'FIXED' ||
    b === 'LUMP_SUM'
  ) {
    return 'PER_SHIPMENT';
  }
  if (b === 'PER_BOX' || b === 'PER_PACKAGE' || b === 'PER_PKG' || b === 'BOX') {
    return 'PER_BOX';
  }
  if (b === 'PER_KM' || b === 'KM') {
    return 'PER_KM';
  }
  return 'PER_KG';
}

export function getRateBasisMeta(basis) {
  const norm = normalizeRateBasis(basis);
  if (norm === 'PER_SHIPMENT') {
    const rawStr = String(basis || '').trim();
    const label = /flat/i.test(rawStr) ? 'Flat Rate' : 'Per Shipment';
    return { normalizedBasis: 'PER_SHIPMENT', label, unit: 'Shipment' };
  }
  if (norm === 'PER_BOX') {
    return { normalizedBasis: 'PER_BOX', label: 'Per Box', unit: 'Box' };
  }
  if (norm === 'PER_KM') {
    return { normalizedBasis: 'PER_KM', label: 'Per KM', unit: 'Km' };
  }
  return { normalizedBasis: 'PER_KG', label: 'Per KG', unit: 'Kg' };
}

export function calculateFreightAmount({
  rateBasis = 'Per KG',
  baseRate = 0,
  actualWeight = 0,
  chargeableWeight = 0,
  minimumWeight = 0,
  packages = 1,
  distanceKm = 1
} = {}) {
  const { normalizedBasis, label, unit } = getRateBasisMeta(rateBasis);
  const rate = Number(baseRate) || 0;
  const rawWeight = Number(chargeableWeight) || Number(actualWeight) || 0;
  const minWt = Number(minimumWeight) || 0;
  const effectiveWeight = minWt > 0 ? Math.max(rawWeight, minWt) : rawWeight;
  const pkgCount = Math.max(1, parseInt(packages, 10) || 1);
  const km = Math.max(1, Number(distanceKm) || 1);

  let freightAmount = 0;
  let quantity = 1;

  if (normalizedBasis === 'PER_SHIPMENT') {
    freightAmount = Math.round(rate);
    quantity = 1;
  } else if (normalizedBasis === 'PER_BOX') {
    freightAmount = Math.round(rate * pkgCount);
    quantity = pkgCount;
  } else if (normalizedBasis === 'PER_KM') {
    freightAmount = Math.round(rate * km);
    quantity = km;
  } else {
    freightAmount = Math.round(rate * effectiveWeight);
    quantity = effectiveWeight;
  }

  const formattedRate = rate.toLocaleString('en-IN');
  const rateDisplay = `₹${formattedRate} / ${unit}`;

  return {
    normalizedBasis,
    rateBasisLabel: label,
    unit,
    rate,
    quantity,
    rawWeight,
    minimumWeight: minWt,
    effectiveWeight,
    freightAmount,
    rateDisplay
  };
}

export function resolveShipmentFreightMode(shipment) {
  if (!shipment) return '';
  const m = String(shipment.mode || '').trim();
  const fm = String(shipment.freightMode || '').trim();
  const pvMode = String(
    shipment.pricingValidation?.freightMode ||
    shipment.pricingValidation?.appliedRuleSnapshot?.mode ||
    shipment.pricingValidation?.pricingSnapshot?.freightMode ||
    ''
  ).trim();

  if (m && m.toLowerCase() !== 'express ltl') return m;
  if (fm) return fm;
  if (m) return m;
  return pvMode || '';
}

export function formatFreightDescription({ rateBasis, rate, source, agreementNumber, version }) {
  const { rateDisplay } = calculateFreightAmount({ rateBasis, baseRate: rate });
  if (agreementNumber) {
    const sourceLabel = source === 'RATE_CARD' ? 'Rate Card' : 'Company Quotation';
    return `Base Freight @ ${rateDisplay} (${sourceLabel} ${agreementNumber} v${version || 1})`;
  }
  return `Base Freight @ ${rateDisplay}`;
}

/**
 * Determine pricing badge config for a shipment
 * @param {Object} shipment
 * @returns {Object} { text, variant, icon, tooltip, isBlocked }
 */
export const getPricingBadgeInfo = (shipment) => {
  const pv = shipment?.pricingValidation;
  const status = pv?.status;
  const source = pv?.source;
  const basisRaw = pv?.rateBasis || pv?.pricingSnapshot?.rateBasis || pv?.appliedRuleSnapshot?.rateBasis || 'Per KG';
  const { unit } = getRateBasisMeta(basisRaw);

  if (status === 'MATCHED' && source === 'QUOTATION') {
    return {
      text: 'Quotation Applied',
      shortText: 'Quotation',
      variant: 'success', // green
      badgeClass: 'bg-emerald-50 text-emerald-700 border-emerald-200',
      dotClass: 'bg-emerald-500',
      tooltip: `Quotation Applied: ${pv.quotationNumber || 'Agreed Rate'} (v${pv.quotationVersion || 1}) • ₹${(pv.appliedRate || 0).toLocaleString('en-IN')} / ${unit}`,
      isCovered: true,
      isBlocked: false
    };
  }

  if (status === 'MATCHED' && source === 'RATE_CARD') {
    return {
      text: 'Rate Card Applied',
      shortText: 'Rate Card',
      variant: 'info', // blue
      badgeClass: 'bg-blue-50 text-blue-700 border-blue-200',
      dotClass: 'bg-blue-500',
      tooltip: `Rate Card Applied: ${pv.rateCardNumber || pv.rateCardName || 'Standard'} (v${pv.rateCardVersion || 1}) • ₹${(pv.appliedRate || 0).toLocaleString('en-IN')} / ${unit}`,
      isCovered: true,
      isBlocked: false
    };
  }

  return {
    text: 'No Quotation',
    shortText: 'Missing',
    variant: 'danger', // red/orange
    badgeClass: 'bg-rose-50 text-rose-700 border-rose-200',
    dotClass: 'bg-rose-500',
    tooltip: pv?.overrideConfirmed
      ? 'Pricing Agreement Missing (Override Confirmed) – Tax Invoice Generation Blocked'
      : 'Pricing Agreement Missing – Tax Invoice Generation Blocked',
    isCovered: false,
    isBlocked: true
  };
};

/**
 * Normalize location string consistently with backend pricingValidationService.js
 */
export function normalizeLocation(loc) {
  if (!loc) return '';
  const str = String(loc)
    .replace(/\s*\([^)]*\)/g, '')
    .replace(/\bhub\b/gi, '')
    .replace(/[^a-zA-Z0-9]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim()
    .toUpperCase();

  if (str === 'BANGALORE' || str === 'BENGALURU') return 'BANGALORE';
  if (str === 'GURGAON' || str === 'GURUGRAM' || str === 'GURGOAN') return 'GURGAON';
  if (str === 'BOMBAY' || str === 'MUMBAI') return 'MUMBAI';
  if (str === 'CALCUTTA' || str === 'KOLKATA') return 'KOLKATA';
  if (str === 'MADRAS' || str === 'CHENNAI') return 'CHENNAI';
  if (str === 'UTTARANCHAL' || str === 'UTTARAKHAND') return 'UTTARAKHAND';
  if (str === 'LUDHINAA' || str === 'LUDHIANA') return 'LUDHIANA';

  return str;
}

/**
 * Normalize freight mode string consistently with backend pricingValidationService.js
 */
export function normalizeMode(mode) {
  if (!mode) return '';
  const m = String(mode).trim().toLowerCase();
  if (m === 'air express' || m === 'express air' || m.includes('air express') || m.includes('express air')) return 'air express';
  if (m === 'air' || m === 'cargo air') return 'air';
  if (m.includes('train') || m.includes('rail')) return 'train';
  if (m.includes('road') || m === 'surface' || m.includes('ltl') || m.includes('ftl')) return 'road';
  return m;
}

/**
 * Verify agreement validity period against shipment booking date
 */
export function isAgreementDateValid(item, targetDateStr) {
  const from = item?.validFrom || item?.effectiveFrom;
  const until = item?.validUntil || item?.effectiveUntil;
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
 * Match a route rule strictly by origin, destination, and freight mode
 */
export function findMatchingRuleInList(rulesList, origin, destination, mode) {
  if (!Array.isArray(rulesList) || rulesList.length === 0) return null;

  const normOrigin = normalizeLocation(origin);
  const normDest = normalizeLocation(destination);
  const normMode = normalizeMode(mode);

  if (!normOrigin || !normDest) return null;

  const exactMatch = rulesList.find((r) => {
    const rOrigin = normalizeLocation(r.origin);
    const rDest = normalizeLocation(r.destination);
    const rMode = normalizeMode(r.mode || r.freightMode);

    return rOrigin === normOrigin && rDest === normDest && Boolean(rMode && normMode && rMode === normMode);
  });

  if (exactMatch) return exactMatch;

  const agnosticModeMatch = rulesList.find((r) => {
    const rOrigin = normalizeLocation(r.origin);
    const rDest = normalizeLocation(r.destination);
    const rMode = normalizeMode(r.mode || r.freightMode);
    return rOrigin === normOrigin && rDest === normDest && !rMode;
  });

  return agnosticModeMatch || null;
}

/**
 * Evaluate whether a rate rule satisfies optional pickup/delivery, packaging, and weight conditions.
 */
function ruleSatisfiesShipmentConditions(rule, shipment) {
  if (!rule || !shipment) return true;

  // 1. Optional Pickup / Delivery location constraints on rule (if explicitly configured)
  const rulePickup = normalizeLocation(rule.pickupLocation || rule.pickupPoint || '');
  const shipPickup = normalizeLocation(
    shipment.consignor?.pickupDeliveryLocation || shipment.consignor?.city || shipment.origin || ''
  );
  if (rulePickup && shipPickup && rulePickup !== shipPickup) {
    return false;
  }

  const ruleDelivery = normalizeLocation(rule.deliveryLocation || rule.deliveryPoint || '');
  const shipDelivery = normalizeLocation(
    shipment.consignee?.pickupDeliveryLocation || shipment.consignee?.city || shipment.destination || ''
  );
  if (ruleDelivery && shipDelivery && ruleDelivery !== shipDelivery) {
    return false;
  }

  // 2. Optional Packaging / Box count conditions (if explicitly configured on rule)
  const pkgCount = parseInt(shipment.packages, 10) || 0;
  if (typeof rule.minPackages === 'number' && rule.minPackages > 0 && pkgCount < rule.minPackages) {
    return false;
  }
  if (typeof rule.maxPackages === 'number' && rule.maxPackages > 0 && pkgCount > rule.maxPackages) {
    return false;
  }
  const shipPackaging = shipment.packagingType || shipment.packageType || '';
  if (rule.packagingType && shipPackaging) {
    if (String(rule.packagingType).trim().toLowerCase() !== String(shipPackaging).trim().toLowerCase()) {
      return false;
    }
  }

  // 3. Optional Weight range conditions (if maxWeight explicitly caps the rule, or weightSlabs must cover weight)
  const rawWeight = Number(shipment.chargeableWeight) || Number(shipment.actualWeight) || 0;
  if (typeof rule.maxWeight === 'number' && rule.maxWeight > 0 && rawWeight > rule.maxWeight) {
    return false;
  }

  return true;
}

/**
 * Match a single Consignment Note (CN) against a company's fetched quotations
 * using the existing quotation matching, validity, status, and priority rules.
 * Pure read-only lookup: never mutates the shipment or saved pricing.
 */
export function matchShipmentToCompanyQuotations(shipment, companyQuotations = []) {
  if (!shipment || !Array.isArray(companyQuotations) || companyQuotations.length === 0) {
    return { matched: false, quotation: null, rule: null, pricingValidation: null };
  }

  const origin = shipment.origin || shipment.consignor?.city || '';
  const destination = shipment.destination || shipment.consignee?.city || '';
  const targetMode = resolveShipmentFreightMode(shipment) || 'Road';
  const shipmentDate =
    shipment.bookingDate ||
    shipment.cnDate ||
    (shipment.createdAt ? String(shipment.createdAt).split('T')[0] : new Date().toISOString().split('T')[0]);
  const weight = Number(shipment.chargeableWeight) || Number(shipment.actualWeight) || 0;
  const packages = parseInt(shipment.packages, 10) || 1;

  const todayStr = new Date().toISOString().split('T')[0];

  // Filter strictly to active company quotations (never inactive/draft/cancelled, never generic/rate-card)
  const activeCompanyQuotations = companyQuotations
    .filter((q) => {
      if (!q) return false;
      if (String(q.status || '').trim().toLowerCase() !== 'active') return false;
      if (q.isRateCard === true) return false;
      const qCompId = String(q.companyId || '').trim().toUpperCase();
      const qCompCode = String(q.companyCode || '').trim().toUpperCase();
      if (qCompId === 'ALL' || qCompCode === 'ALL') return false;
      return true;
    })
    .sort((a, b) => {
      const vDiff = (Number(b.version) || 1) - (Number(a.version) || 1);
      if (vDiff !== 0) return vDiff;
      return new Date(b.createdAt || 0) - new Date(a.createdAt || 0);
    });

  // Tier 1: Quotations whose validity window strictly covers the shipment's booking date.
  // Tier 2: Ongoing/current active quotations (valid as of today & not expired) when older CNs precede effectiveFrom.
  const strictDateQuotations = activeCompanyQuotations.filter((q) => isAgreementDateValid(q, shipmentDate));
  const currentValidQuotations = activeCompanyQuotations.filter((q) => {
    if (isAgreementDateValid(q, shipmentDate)) return false;
    // Never use an already-expired agreement or a future-dated agreement
    return isAgreementDateValid(q, todayStr);
  });
  const eligibleQuotations = [...strictDateQuotations, ...currentValidQuotations];

  if (!origin.trim() || !destination.trim()) {
    return { matched: false, quotation: null, rule: null, pricingValidation: null };
  }

  for (const quote of eligibleQuotations) {
    const rulesList = [
      ...(Array.isArray(quote.rateRules) ? quote.rateRules : []),
      ...(Array.isArray(quote.routes) ? quote.routes : [])
    ].filter((r) => ruleSatisfiesShipmentConditions(r, shipment));

    const matchedRule = findMatchingRuleInList(rulesList, origin, destination, targetMode);
    if (!matchedRule) continue;

    // Resolve slab rate if weightSlabs are configured on the matched rule
    let effectiveRule = matchedRule;
    if (Array.isArray(matchedRule.weightSlabs) && matchedRule.weightSlabs.length > 0) {
      const slab = matchedRule.weightSlabs.find((s) => {
        const minW = Number(s.minWeight ?? 0);
        const maxW = s.maxWeight ? Number(s.maxWeight) : Infinity;
        return weight >= minW && weight <= maxW;
      });
      if (slab && (typeof slab.rate === 'number' || (typeof slab.rate === 'string' && slab.rate !== ''))) {
        effectiveRule = { ...matchedRule, freightRate: parseFloat(slab.rate) || matchedRule.freightRate };
      }
    }

    const pricingSnapshot = buildClientPricingSnapshot({
      source: 'QUOTATION',
      doc: quote,
      matchedRule: effectiveRule,
      origin,
      destination,
      mode: targetMode,
      date: shipmentDate,
      weight,
      packages
    });

    const previewPricingValidation = {
      status: 'MATCHED',
      source: 'QUOTATION',
      quotationId: quote._id ? String(quote._id) : quote.id,
      quotationNumber: quote.quotationNumber,
      quotationVersion: quote.version || 1,
      agreementVersion: quote.version || 1,
      rateCardId: null,
      rateCardNumber: null,
      rateCardVersion: null,
      companyId: quote.companyId || shipment.companyId,
      companyCode: quote.companyCode || shipment.companyCode,
      companyName: quote.companyName || shipment.companyName,
      origin,
      destination,
      freightMode: targetMode,
      rateBasis: pricingSnapshot.rateBasis,
      appliedRate: pricingSnapshot.baseFreightRate,
      minimumChargeableWeight: pricingSnapshot.minimumWeight,
      pricingSnapshot,
      isAutoFetchedPreview: true,
      isCovered: true,
      message: `Quotation Matched – ${quote.quotationNumber} (v${quote.version || 1})`
    };

    return {
      matched: true,
      quotation: quote,
      rule: effectiveRule,
      pricingValidation: previewPricingValidation
    };
  }

  return { matched: false, quotation: null, rule: null, pricingValidation: null };
}

/**
 * Build complete pricing snapshot matching backend pricingValidationService.js structure
 */
export function buildClientPricingSnapshot({ source, doc, matchedRule, origin, destination, mode, date, weight = 0, packages = 1 }) {
  const isQuote = source === 'QUOTATION';
  const baseFreight = typeof matchedRule.freightRate === 'number'
    ? matchedRule.freightRate
    : (parseFloat(matchedRule.freightRate || matchedRule.ratePerKg || matchedRule.rate) || 0);

  const minWeight = typeof matchedRule.minimumChargeableWeight === 'number'
    ? matchedRule.minimumChargeableWeight
    : (parseFloat(matchedRule.minimumChargeableWeight || matchedRule.minWeight) || 50);

  const rawAdditional = matchedRule.additionalCharges || doc.additionalCharges || [];
  const additionalList = Array.isArray(rawAdditional)
    ? rawAdditional
    : (typeof rawAdditional === 'object' && rawAdditional !== null
        ? Object.entries(rawAdditional).map(([k, v]) => ({ name: k, amount: v }))
        : []);

  let docketAmt = 0;
  let pickupAmt = 0;
  let deliveryAmt = 0;
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
  const taxableAmount = freightAmount + docketAmt + pickupAmt + deliveryAmt + otherAmt;
  const gstAmount = Math.round(taxableAmount * (gstRate / 100));
  const grandTotal = taxableAmount + gstAmount;

  return {
    rateCardId: !isQuote ? (doc._id ? String(doc._id) : doc.id) : null,
    rateCardNumber: !isQuote ? (doc.rateCardNumber || doc.name) : null,
    rateCardVersion: !isQuote ? (doc.version || 1) : null,
    quotationId: isQuote ? (doc._id ? String(doc._id) : doc.id) : null,
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
        ...(deliveryAmt > 0 ? [{ name: 'Delivery Charge', amount: deliveryAmt }] : [])
      ]
    },
    effectiveDate: date,
    isImmutable: true,
    capturedAt: new Date().toISOString()
  };
}

/**
 * Evaluate live quotations & rate cards when backend /shipments/validate-pricing is unavailable (e.g. 404).
 */
export function evaluatePricingFromCatalog({
  companies = [],
  quotations = [],
  rateCards = [],
  companyId = '',
  companyCode = '',
  companyName = '',
  origin = '',
  destination = '',
  freightMode = '',
  mode = '',
  date = new Date().toISOString().split('T')[0]
}) {
  const targetMode = freightMode || mode || 'Road';
  const targetDate = date || new Date().toISOString().split('T')[0];

  const cIdLower = String(companyId || '').trim().toLowerCase();
  const cCodeLower = String(companyCode || '').trim().toLowerCase();
  const cNameLower = String(companyName || '').trim().toLowerCase();

  const resolvedCompany = companies.find((c) => {
    const ids = [c._id, c.id, c.companyId, c.companyCode]
      .filter(Boolean)
      .map((v) => String(v).trim().toLowerCase());
    if (cIdLower && ids.includes(cIdLower)) return true;
    if (cCodeLower && ids.includes(cCodeLower)) return true;
    if (cNameLower && c.companyName && String(c.companyName).trim().toLowerCase() === cNameLower) return true;
    return false;
  }) || null;

  const idCandidates = new Set();
  const codeCandidates = new Set();
  const nameCandidates = new Set();

  if (cIdLower && cIdLower !== 'all') idCandidates.add(cIdLower);
  if (cCodeLower && cCodeLower !== 'all') codeCandidates.add(cCodeLower);
  if (cNameLower && cNameLower !== 'all') nameCandidates.add(cNameLower);

  if (resolvedCompany) {
    if (resolvedCompany._id) idCandidates.add(String(resolvedCompany._id).trim().toLowerCase());
    if (resolvedCompany.id) idCandidates.add(String(resolvedCompany.id).trim().toLowerCase());
    if (resolvedCompany.companyId) idCandidates.add(String(resolvedCompany.companyId).trim().toLowerCase());
    if (resolvedCompany.companyCode) {
      const code = String(resolvedCompany.companyCode).trim().toLowerCase();
      codeCandidates.add(code);
      idCandidates.add(code);
    }
    if (resolvedCompany.companyName) {
      nameCandidates.add(String(resolvedCompany.companyName).trim().toLowerCase());
    }
  }

  const companyQuotes = (Array.isArray(quotations) ? quotations : [])
    .filter((q) => {
      if (String(q.status || '').trim().toLowerCase() !== 'active') return false;
      if (!isAgreementDateValid(q, targetDate)) return false;

      const qId = String(q.companyId || '').trim().toLowerCase();
      const qCode = String(q.companyCode || '').trim().toLowerCase();
      const qName = String(q.companyName || '').trim().toLowerCase();

      if (qId && (idCandidates.has(qId) || codeCandidates.has(qId))) return true;
      if (qCode && (codeCandidates.has(qCode) || idCandidates.has(qCode))) return true;
      if (qName && nameCandidates.has(qName)) return true;
      return false;
    })
    .sort((a, b) => {
      const vDiff = (b.version || 1) - (a.version || 1);
      if (vDiff !== 0) return vDiff;
      return new Date(b.createdAt || 0) - new Date(a.createdAt || 0);
    });

  if (!origin || !destination || !String(origin).trim() || !String(destination).trim()) {
    if (companyQuotes.length > 0) {
      const primaryQuote = companyQuotes[0];
      const rulesList = [
        ...(Array.isArray(primaryQuote.rateRules) ? primaryQuote.rateRules : []),
        ...(Array.isArray(primaryQuote.routes) ? primaryQuote.routes : [])
      ];
      return {
        status: 'PENDING_ROUTE',
        source: 'QUOTATION',
        quotationId: primaryQuote._id ? String(primaryQuote._id) : primaryQuote.id,
        quotationNumber: primaryQuote.quotationNumber,
        quotationVersion: primaryQuote.version || 1,
        agreementVersion: primaryQuote.version || 1,
        rateCardId: null,
        rateCardNumber: null,
        rateCardVersion: null,
        companyId: primaryQuote.companyId || resolvedCompany?.companyId || companyId,
        companyCode: primaryQuote.companyCode || resolvedCompany?.companyCode || companyCode,
        companyName: primaryQuote.companyName || resolvedCompany?.companyName || companyName,
        origin: '',
        destination: '',
        freightMode: targetMode,
        appliedRate: 0,
        minimumChargeableWeight: 0,
        appliedRuleSnapshot: null,
        pricingSnapshot: null,
        isCovered: false,
        hasCompanyAgreement: true,
        totalRoutesCovered: rulesList.length,
        message: `Quotation Found – ${primaryQuote.quotationNumber} (v${primaryQuote.version || 1}) with ${rulesList.length} route(s). Enter origin and destination to validate route.`
      };
    }
  }

  for (const quote of companyQuotes) {
    const rulesList = [
      ...(Array.isArray(quote.rateRules) ? quote.rateRules : []),
      ...(Array.isArray(quote.routes) ? quote.routes : [])
    ];
    const matchedRule = findMatchingRuleInList(rulesList, origin, destination, targetMode);
    if (matchedRule) {
      const pricingSnapshot = buildClientPricingSnapshot({
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
        quotationId: quote._id ? String(quote._id) : quote.id,
        quotationNumber: quote.quotationNumber,
        quotationVersion: quote.version || 1,
        agreementVersion: quote.version || 1,
        rateCardId: null,
        rateCardNumber: null,
        rateCardVersion: null,
        companyId: quote.companyId || resolvedCompany?.companyId || companyId,
        companyCode: quote.companyCode || resolvedCompany?.companyCode || companyCode,
        companyName: quote.companyName || resolvedCompany?.companyName || companyName,
        origin,
        destination,
        freightMode: targetMode,
        rateBasis: pricingSnapshot.rateBasis,
        appliedRate: pricingSnapshot.baseFreightRate,
        minimumChargeableWeight: pricingSnapshot.minimumWeight,
        appliedRuleSnapshot: {
          quotationNumber: quote.quotationNumber,
          version: quote.version || 1,
          origin: matchedRule.origin,
          destination: matchedRule.destination,
          mode: matchedRule.mode || targetMode,
          rateBasis: pricingSnapshot.rateBasis,
          freightRate: pricingSnapshot.baseFreightRate,
          minimumChargeableWeight: pricingSnapshot.minimumWeight,
          additionalCharges: matchedRule.additionalCharges || quote.additionalCharges || [],
          taxConfiguration: pricingSnapshot.taxConfiguration
        },
        pricingSnapshot,
        validatedAt: new Date().toISOString(),
        overrideConfirmed: false,
        isCovered: true,
        message: `Quotation Available – ${quote.quotationNumber} (v${quote.version || 1})`
      };
    }
  }

  const genericQuotes = (Array.isArray(quotations) ? quotations : []).filter((q) => {
    if (String(q.status || '').trim().toLowerCase() !== 'active') return false;
    return q.isRateCard === true || !q.companyId || q.companyId === 'ALL' || q.companyCode === 'ALL';
  });

  const combinedRateCards = [
    ...(Array.isArray(rateCards) ? rateCards : []).filter((r) => String(r.status || '').trim().toLowerCase() === 'active'),
    ...genericQuotes
  ]
    .filter((rc) => isAgreementDateValid(rc, targetDate))
    .sort((a, b) => (b.version || 1) - (a.version || 1));

  for (const rc of combinedRateCards) {
    const rulesList = [
      ...(Array.isArray(rc.rateRules) ? rc.rateRules : []),
      ...(Array.isArray(rc.routes) ? rc.routes : [])
    ];
    const matchedRule = findMatchingRuleInList(rulesList, origin, destination, targetMode);
    if (matchedRule) {
      const rcNumber = rc.rateCardNumber || rc.quotationNumber || rc.name || 'RC-STANDARD';
      const pricingSnapshot = buildClientPricingSnapshot({
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
        rateCardId: rc._id ? String(rc._id) : rc.id,
        rateCardNumber: rcNumber,
        rateCardName: rc.name || rcNumber,
        rateCardVersion: rc.version || 1,
        agreementVersion: rc.version || 1,
        companyId: companyId || 'ALL',
        companyCode: companyCode || 'ALL',
        companyName: companyName || 'Standard / Rate Card',
        origin,
        destination,
        freightMode: targetMode,
        rateBasis: pricingSnapshot.rateBasis,
        appliedRate: pricingSnapshot.baseFreightRate,
        minimumChargeableWeight: pricingSnapshot.minimumWeight,
        appliedRuleSnapshot: {
          rateCardNumber: rcNumber,
          rateCardName: rc.name || rcNumber,
          version: rc.version || 1,
          origin: matchedRule.origin,
          destination: matchedRule.destination,
          mode: matchedRule.mode || targetMode,
          rateBasis: pricingSnapshot.rateBasis,
          freightRate: pricingSnapshot.baseFreightRate,
          minimumChargeableWeight: pricingSnapshot.minimumWeight,
          additionalCharges: matchedRule.additionalCharges || rc.additionalCharges || [],
          taxConfiguration: pricingSnapshot.taxConfiguration
        },
        pricingSnapshot,
        validatedAt: new Date().toISOString(),
        overrideConfirmed: false,
        isCovered: true,
        message: `No Company Quotation – Charges Based on Rate Card (${rcNumber})`
      };
    }
  }

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
    pricingSnapshot: null,
    validatedAt: new Date().toISOString(),
    overrideConfirmed: false,
    isCovered: false,
    message: 'The selected company does not have an applicable quotation or rate card for this shipment route and mode.'
  };
}

