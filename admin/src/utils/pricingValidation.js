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

/**
 * Determine pricing badge config for a shipment
 * @param {Object} shipment
 * @returns {Object} { text, variant, icon, tooltip, isBlocked }
 */
export const getPricingBadgeInfo = (shipment) => {
  const pv = shipment?.pricingValidation;
  const status = pv?.status;
  const source = pv?.source;

  if (status === 'MATCHED' && source === 'QUOTATION') {
    return {
      text: 'Quotation Applied',
      shortText: 'Quotation',
      variant: 'success', // green
      badgeClass: 'bg-emerald-50 text-emerald-700 border-emerald-200',
      dotClass: 'bg-emerald-500',
      tooltip: `Quotation Applied: ${pv.quotationNumber || 'Agreed Rate'} (v${pv.quotationVersion || 1}) • ₹${pv.appliedRate || 0}/Kg`,
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
      tooltip: `Rate Card Applied: ${pv.rateCardNumber || pv.rateCardName || 'Standard'} (v${pv.rateCardVersion || 1}) • ₹${pv.appliedRate || 0}/Kg`,
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
