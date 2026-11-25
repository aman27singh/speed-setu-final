/**
 * Speed Setu - Centralized Freight & Billing Calculation Engine
 * Single source of truth for Per Shipment, Per KG, Per Box, and Per KM calculations,
 * line-item formatting, and shipment freight mode resolution.
 */

function normalizeRateBasis(basis) {
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

function getRateBasisMeta(basis) {
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

/**
 * Compute authoritative freight amount from pricing configuration without assuming type from value.
 * - PER_SHIPMENT: charged flat once per shipment regardless of actual/minimum weight or packages.
 * - PER_KG: charged per chargeable weight = Math.max(weight, minimumWeight).
 * - PER_BOX: charged per package count.
 * - PER_KM: charged per distance KM.
 */
function calculateFreightAmount({
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
    // Charge once per shipment — never multiply by weight, minWeight, or boxes
    freightAmount = Math.round(rate);
    quantity = 1;
  } else if (normalizedBasis === 'PER_BOX') {
    freightAmount = Math.round(rate * pkgCount);
    quantity = pkgCount;
  } else if (normalizedBasis === 'PER_KM') {
    freightAmount = Math.round(rate * km);
    quantity = km;
  } else {
    // PER_KG
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

/**
 * Resolve freight mode strictly from shipment record without hardcoding defaults like TRAIN.
 */
function resolveShipmentFreightMode(shipment) {
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

/**
 * Format freight line-item description accurately by pricing type
 */
function formatFreightDescription({ rateBasis, rate, source, agreementNumber, version }) {
  const { rateDisplay } = calculateFreightAmount({ rateBasis, baseRate: rate });
  if (agreementNumber) {
    const sourceLabel = source === 'RATE_CARD' ? 'Rate Card' : 'Company Quotation';
    return `Base Freight @ ${rateDisplay} (${sourceLabel} ${agreementNumber} v${version || 1})`;
  }
  return `Base Freight @ ${rateDisplay}`;
}

/**
 * Authoritative billing calculation for a single shipment using its saved pricing snapshot.
 * Historical shipments retain their saved quotation version and applied rate.
 */
function calculateShipmentBilling(shipment) {
  if (!shipment) {
    return {
      hasValidRateCard: false,
      error: 'Shipment data not provided.',
      warnings: ['No shipment record available for billing calculation.'],
      lineItems: [],
      taxableAmount: 0,
      subTotal: 0,
      gstRate: 18,
      gstAmount: 0,
      grandTotal: 0
    };
  }

  const numberOfBoxes = shipment.packages || shipment.numberOfBoxes || shipment.noOfBoxes || shipment.boxes || 1;
  const rawShipmentWeight = shipment.chargeableWeight || Math.max(shipment.actualWeight || 0, shipment.volumetricWeight || 0, 0);
  const shipmentMode = resolveShipmentFreightMode(shipment);

  // Godown-only storage billing override
  const godownAmt = typeof shipment.godownCharges === 'number' ? shipment.godownCharges : parseFloat(shipment.godownCharges || 0);
  if (shipment.isGodownOnlyBilling && godownAmt > 0) {
    const gRate = (shipment.isGstExempt || shipment.gstRate === 0) ? 0 : (shipment.gstRate ?? 18);
    const godownLineItems = [{
      name: 'Godown / Storage Charges',
      description: `Warehouse & Godown Demurrage Storage Charges (${shipment.godownDays || 1} Days @ Hub)`,
      cnNumber: shipment.cnNumber,
      weight: 0,
      quantity: shipment.godownDays || 1,
      unit: 'Day',
      rate: godownAmt,
      amount: godownAmt
    }];
    const subTotal = godownAmt;
    const gstAmount = Math.round(subTotal * (gRate / 100));
    const grandTotal = subTotal + gstAmount;

    return {
      shipment,
      cnNumber: shipment.cnNumber,
      companyName: shipment.companyName,
      freightMode: shipmentMode,
      numberOfBoxes,
      noOfBoxes: numberOfBoxes,
      boxes: numberOfBoxes,
      noPack: numberOfBoxes,
      rawShipmentWeight,
      minChargeableWeight: 0,
      weight: rawShipmentWeight,
      ratePerKg: 0,
      appliedRate: 0,
      rateBasis: 'Per Shipment',
      rateBasisNormalized: 'PER_SHIPMENT',
      rateUnit: 'Shipment',
      hasValidRateCard: true,
      matchedQuotation: 'Godown Demurrage Storage Billing',
      quotationVersion: 1,
      matchedRule: null,
      lineItems: godownLineItems,
      taxableAmount: subTotal,
      subTotal,
      gstRate: gRate,
      gstAmount,
      grandTotal,
      billingSnapshot: {
        mode: shipmentMode,
        chargeableWeight: rawShipmentWeight,
        ratePerKg: 0,
        rateBasis: 'Per Shipment'
      }
    };
  }

  // Block billing calculation when pricing agreement is MISSING
  if (shipment.pricingValidation?.status === 'MISSING' || shipment.pricingValidation?.source === 'NONE') {
    return {
      shipment,
      cnNumber: shipment.cnNumber,
      companyName: shipment.companyName,
      freightMode: shipmentMode,
      numberOfBoxes,
      noOfBoxes: numberOfBoxes,
      boxes: numberOfBoxes,
      noPack: numberOfBoxes,
      rawShipmentWeight,
      minChargeableWeight: 0,
      weight: rawShipmentWeight,
      ratePerKg: 0,
      appliedRate: 0,
      hasValidRateCard: false,
      isUnpriced: true,
      pricingStatus: 'MISSING',
      error: `Pricing Agreement Missing: ${shipment.companyName || 'This company'} does not have an agreed quotation or rate card for route ${shipment.origin} → ${shipment.destination}.`,
      warnings: ['This shipment has missing pricing coverage and cannot be billed until a valid agreement is established.'],
      matchedQuotation: 'No Quotation / Rate Card',
      quotationVersion: 0,
      matchedRule: null,
      lineItems: [],
      taxableAmount: 0,
      subTotal: 0,
      gstRate: 18,
      gstAmount: 0,
      grandTotal: 0
    };
  }

  // Matched Shipment Pricing Snapshot (Historical Immutable Lock)
  if (shipment.pricingValidation && shipment.pricingValidation.status === 'MATCHED') {
    const pv = shipment.pricingValidation;
    const snap = pv.pricingSnapshot || {};
    const appliedRule = pv.appliedRuleSnapshot || {};

    const rate = (typeof pv.appliedRate === 'number' && pv.appliedRate > 0)
      ? pv.appliedRate
      : (snap.baseFreightRate ?? appliedRule.freightRate ?? 0);

    const rateBasis = pv.rateBasis || snap.rateBasis || appliedRule.rateBasis || 'Per KG';

    const minChargeableWeight = (typeof pv.minimumChargeableWeight === 'number' && pv.minimumChargeableWeight > 0)
      ? pv.minimumChargeableWeight
      : (snap.minimumWeight ?? appliedRule.minimumChargeableWeight ?? 50);

    const freightCalc = calculateFreightAmount({
      rateBasis,
      baseRate: rate,
      actualWeight: shipment.actualWeight,
      chargeableWeight: rawShipmentWeight,
      minimumWeight: minChargeableWeight,
      packages: numberOfBoxes
    });

    const quotationVersion = pv.quotationVersion || pv.rateCardVersion || pv.agreementVersion || snap.agreementVersion || appliedRule.version || 1;
    const matchedQuotationNum = pv.quotationNumber || pv.rateCardNumber || snap.agreementNumber || appliedRule.rateCardNumber || appliedRule.quotationNumber || 'Agreed Rate';

    let docketCharge = 0;
    let pickupCharge = 0;
    let deliveryCharge = 0;
    const extraCharges = [];

    if (typeof snap.docketCharges === 'number' && snap.docketCharges > 0) {
      docketCharge = snap.docketCharges;
    } else if (Array.isArray(appliedRule.additionalCharges)) {
      const dItem = appliedRule.additionalCharges.find((c) => (c.name || '').toLowerCase().includes('docket'));
      if (dItem) docketCharge = typeof dItem.amount === 'number' ? dItem.amount : (parseFloat(dItem.amount) || 0);
    }

    if (typeof shipment.pickupCharges === 'number' && shipment.pickupCharges > 0) {
      pickupCharge = shipment.pickupCharges;
    } else if (snap.pickupCharges) {
      pickupCharge = snap.pickupCharges;
    }

    if (typeof shipment.deliveryCharges === 'number' && shipment.deliveryCharges > 0) {
      deliveryCharge = shipment.deliveryCharges;
    } else if (snap.deliveryCharges) {
      deliveryCharge = snap.deliveryCharges;
    }

    if (Array.isArray(appliedRule.additionalCharges)) {
      appliedRule.additionalCharges.forEach((chg) => {
        const nameLower = (chg.name || chg.chargeName || '').toLowerCase();
        const val = typeof chg.amount === 'number' ? chg.amount : (parseFloat(chg.amount || 0) || 0);
        if (
          val > 0 &&
          !nameLower.includes('docket') &&
          !nameLower.includes('lr') &&
          !nameLower.includes('bilty') &&
          !nameLower.includes('cn charge') &&
          !nameLower.includes('pickup') &&
          !nameLower.includes('first mile') &&
          !nameLower.includes('delivery') &&
          !nameLower.includes('door delivery') &&
          !nameLower.includes('last mile')
        ) {
          extraCharges.push({ name: chg.name || chg.chargeName, amount: val });
        }
      });
    }

    const packingCharge = Number(shipment.packingCharges) || 0;
    const laborCharge = Number(shipment.laborCharges) || 0;

    const taxConfig = snap.taxConfiguration || appliedRule.taxConfiguration || {};
    const gstRateVal = (shipment.isGstExempt || taxConfig.applicable === false || snap.gstPercentage === 0)
      ? 0
      : (snap.gstPercentage ?? taxConfig.gstRate ?? shipment.gstRate ?? 18);

    const lineItems = [{
      name: 'Freight Charges',
      description: formatFreightDescription({
        rateBasis,
        rate,
        source: pv.source,
        agreementNumber: matchedQuotationNum,
        version: quotationVersion
      }),
      cnNumber: shipment.cnNumber,
      rateBasis: freightCalc.rateBasisLabel,
      rateBasisNormalized: freightCalc.normalizedBasis,
      weight: freightCalc.normalizedBasis === 'PER_KG' ? freightCalc.effectiveWeight : 0,
      quantity: freightCalc.quantity,
      unit: freightCalc.unit,
      rate,
      amount: freightCalc.freightAmount
    }];

    if (docketCharge > 0) {
      lineItems.push({
        name: 'Docket / Documentation Charge',
        description: 'Standard CN Docket Documentation Fee',
        cnNumber: shipment.cnNumber,
        weight: 0,
        quantity: 1,
        unit: 'Job',
        rate: docketCharge,
        amount: docketCharge
      });
    }

    if (pickupCharge > 0) {
      lineItems.push({
        name: 'Pickup / First-Mile Charge',
        description: 'Origin Pickup & Local Transportation Charge',
        cnNumber: shipment.cnNumber,
        weight: 0,
        quantity: 1,
        unit: 'Job',
        rate: pickupCharge,
        amount: pickupCharge
      });
    }

    if (deliveryCharge > 0) {
      lineItems.push({
        name: 'Delivery / Last-Mile Charge',
        description: 'Destination Door Delivery Charge',
        cnNumber: shipment.cnNumber,
        weight: 0,
        quantity: 1,
        unit: 'Job',
        rate: deliveryCharge,
        amount: deliveryCharge
      });
    }

    if (packingCharge > 0) {
      lineItems.push({
        name: 'Packing / Material Charge',
        description: 'Protective Packaging & Crating',
        cnNumber: shipment.cnNumber,
        weight: 0,
        quantity: 1,
        unit: 'Job',
        rate: packingCharge,
        amount: packingCharge
      });
    }

    if (laborCharge > 0) {
      lineItems.push({
        name: 'Labor / Handling Charge',
        description: 'Cargo Loading & Unloading Labor',
        cnNumber: shipment.cnNumber,
        weight: 0,
        quantity: 1,
        unit: 'Job',
        rate: laborCharge,
        amount: laborCharge
      });
    }

    extraCharges.forEach((ec) => {
      lineItems.push({
        name: ec.name,
        description: ec.name,
        cnNumber: shipment.cnNumber,
        weight: 0,
        quantity: 1,
        unit: 'Job',
        rate: ec.amount,
        amount: ec.amount
      });
    });

    if (godownAmt > 0) {
      lineItems.push({
        name: 'Godown / Storage Charges',
        description: 'Warehouse & Godown Storage Charges',
        cnNumber: shipment.cnNumber,
        weight: 0,
        quantity: 1,
        unit: 'Job',
        rate: godownAmt,
        amount: godownAmt
      });
    }

    const taxableAmount = lineItems.reduce((sum, item) => sum + (Number(item.amount) || 0), 0);
    const gstAmount = Math.round(taxableAmount * (gstRateVal / 100));
    const grandTotal = taxableAmount + gstAmount;

    return {
      shipment,
      cnNumber: shipment.cnNumber,
      companyName: shipment.companyName,
      freightMode: shipmentMode,
      numberOfBoxes,
      noOfBoxes: numberOfBoxes,
      boxes: numberOfBoxes,
      noPack: numberOfBoxes,
      rawShipmentWeight,
      minChargeableWeight,
      weight: freightCalc.normalizedBasis === 'PER_KG' ? freightCalc.effectiveWeight : (rawShipmentWeight || minChargeableWeight),
      ratePerKg: rate,
      appliedRate: rate,
      rateBasis: freightCalc.rateBasisLabel,
      rateBasisNormalized: freightCalc.normalizedBasis,
      rateUnit: freightCalc.unit,
      rateDisplay: freightCalc.rateDisplay,
      freightAmount: freightCalc.freightAmount,
      hasValidRateCard: true,
      matchedQuotation: matchedQuotationNum,
      quotationVersion,
      pricingSource: pv.source,
      pricingStatus: 'MATCHED',
      isImmutableSnapshotUsed: true,
      matchedRule: appliedRule,
      pricingSnapshot: snap,
      lineItems,
      taxableAmount,
      subTotal: taxableAmount,
      gstRate: gstRateVal,
      gstAmount,
      grandTotal,
      billingSnapshot: {
        mode: shipmentMode,
        chargeableWeight: freightCalc.normalizedBasis === 'PER_KG' ? freightCalc.effectiveWeight : (rawShipmentWeight || minChargeableWeight),
        ratePerKg: rate,
        appliedRate: rate,
        rateBasis: freightCalc.rateBasisLabel,
        rateBasisNormalized: freightCalc.normalizedBasis,
        quotationNumber: matchedQuotationNum,
        version: quotationVersion,
        pricingSource: pv.source
      }
    };
  }

  return null;
}

module.exports = {
  normalizeRateBasis,
  getRateBasisMeta,
  calculateFreightAmount,
  resolveShipmentFreightMode,
  formatFreightDescription,
  calculateShipmentBilling
};
