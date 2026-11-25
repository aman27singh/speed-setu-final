/**
 * Speed Setu Logistics Admin - Billing Calculation & Rate Card Matching Engine
 */
import { calculateFreightAmount } from './pricingValidation';

export const calculateChargeableWeight = (actualWeight = 0, minimumChargeableWeight = 0) => {
  const actual = parseFloat(actualWeight) || 0;
  const minCharge = parseFloat(minimumChargeableWeight) || 0;
  return Math.max(actual, minCharge);
};

export const calculateFreightLineItem = (rateRule, shipment) => {
  const basis = rateRule?.rateBasis || 'Per KG';
  const rate = parseFloat(rateRule?.rate ?? rateRule?.freightRate) || 0;
  const minWeight = parseFloat(rateRule?.minWeight ?? rateRule?.minimumChargeableWeight) || 0;
  const actualWeight = parseFloat(shipment?.actualWeight ?? shipment?.chargeableWeight) || 0;
  const packages = parseInt(shipment?.packages, 10) || 1;

  const calc = calculateFreightAmount({
    rateBasis: basis,
    baseRate: rate,
    actualWeight,
    chargeableWeight: actualWeight,
    minimumWeight: minWeight,
    packages
  });

  return {
    name: `Base Freight @ ${calc.rateDisplay}`,
    quantity: calc.quantity,
    unit: calc.unit,
    rate,
    amount: calc.freightAmount,
    basis: calc.rateBasisLabel,
    chargeableWeight: calc.effectiveWeight
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
