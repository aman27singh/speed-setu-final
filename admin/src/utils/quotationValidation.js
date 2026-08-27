/**
 * Speed Setu Quotation & Rate Card Validation Helpers
 */

export const validateQuotationForm = (formData) => {
  const errors = {};

  // Basic Information Validation
  if (!formData.companyId) {
    errors.companyId = 'Company selection is required.';
  }

  if (!formData.effectiveFrom) {
    errors.effectiveFrom = 'Effective From date is required.';
  }

  if (formData.effectiveFrom && formData.effectiveUntil) {
    const from = new Date(formData.effectiveFrom);
    const until = new Date(formData.effectiveUntil);
    if (until < from) {
      errors.effectiveUntil = 'Effective Until date cannot be before Effective From date.';
    }
  }

  // Rate Rules Validation
  if (!formData.rateRules || formData.rateRules.length === 0) {
    errors.rateRules = 'At least one Rate Rule is required for a quotation.';
  } else {
    formData.rateRules.forEach((rule, idx) => {
      if (!rule.origin || !rule.origin.trim()) {
        errors[`rateRule_${idx}_origin`] = `Rate Rule #${idx + 1}: Origin is required.`;
      }
      if (!rule.destination || !rule.destination.trim()) {
        errors[`rateRule_${idx}_destination`] = `Rate Rule #${idx + 1}: Destination is required.`;
      }
      if (!rule.mode) {
        errors[`rateRule_${idx}_mode`] = `Rate Rule #${idx + 1}: Mode is required.`;
      }
      if (rule.freightRate === undefined || rule.freightRate === null || isNaN(rule.freightRate) || rule.freightRate < 0) {
        errors[`rateRule_${idx}_freightRate`] = `Rate Rule #${idx + 1}: Freight rate must be a non-negative number.`;
      }

    });
  }

  return errors;
};
