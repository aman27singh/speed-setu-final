/**
 * Speed Setu Logistics Admin - Billing Calculation & Rate Card Matching Engine
 */

export const calculateChargeableWeight = (actualWeight = 0, minimumChargeableWeight = 0) => {
  const actual = parseFloat(actualWeight) || 0;
  const minCharge = parseFloat(minimumChargeableWeight) || 0;
  return Math.max(actual, minCharge);
};

export const calculateFreightLineItem = (rateRule, shipment) => {
  const basis = rateRule?.rateBasis || 'Per KG';
  const rate = parseFloat(rateRule?.rate) || 0;
  const minWeight = parseFloat(rateRule?.minWeight) || 0;
  const actualWeight = parseFloat(shipment?.actualWeight) || 0;
  const packages = parseInt(shipment?.packages, 10) || 1;

  const chargeableWeight = calculateChargeableWeight(actualWeight, minWeight);

  let freightAmount = 0;

  if (basis === 'Per KG') {
    freightAmount = chargeableWeight * rate;
  } else if (basis === 'Flat Rate') {
    freightAmount = rate;
  } else if (basis === 'Per Box' || basis === 'Per Package') {
    freightAmount = packages * rate;
  } else if (basis === 'Weight Slab') {
    // Select slab rate
    freightAmount = chargeableWeight * rate;
  } else {
    freightAmount = chargeableWeight * rate;
  }

  return {
    name: `Freight Charges (${basis} @ ₹${rate}${basis === 'Per KG' || basis === 'Weight Slab' ? '/kg' : ''})`,
    quantity: basis === 'Per KG' || basis === 'Weight Slab' ? chargeableWeight : basis === 'Per Box' ? packages : 1,
    unit: basis === 'Per KG' || basis === 'Weight Slab' ? 'KG' : basis === 'Per Box' ? 'BOX' : 'SHIPMENT',
    rate,
    amount: Math.round(freightAmount),
    basis,
    chargeableWeight
  };
};

export const calculateTaxes = (taxableAmount = 0, stateConsignor = '', stateConsignee = '') => {
  const isInterstate = stateConsignor.toLowerCase().trim() !== stateConsignee.toLowerCase().trim();
  const amount = parseFloat(taxableAmount) || 0;

  if (isInterstate) {
    const igstRate = 5; // 5% IGST on Goods Transport Agency (GTA)
    const igstAmount = Math.round((amount * igstRate) / 100);
    return {
      type: 'IGST',
      rate: igstRate,
      cgst: 0,
      sgst: 0,
      igst: igstAmount,
      totalTax: igstAmount,
      taxBreakdown: [{ name: 'Integrated GST (IGST @ 5%)', amount: igstAmount }]
    };
  }

  const cgstRate = 2.5;
  const sgstRate = 2.5;
  const cgstAmount = Math.round((amount * cgstRate) / 100);
  const sgstAmount = Math.round((amount * sgstRate) / 100);
  const totalTax = cgstAmount + sgstAmount;

  return {
    type: 'CGST_SGST',
    rate: 5,
    cgst: cgstAmount,
    sgst: sgstAmount,
    igst: 0,
    totalTax,
    taxBreakdown: [
      { name: 'Central GST (CGST @ 2.5%)', amount: cgstAmount },
      { name: 'State GST (SGST @ 2.5%)', amount: sgstAmount }
    ]
  };
};
