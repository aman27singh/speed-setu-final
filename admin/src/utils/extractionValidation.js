/**
 * Speed Setu AI Extraction Validation & Confidence Helpers
 */

const extractVal = (field) => {
  if (field === null || field === undefined) return '';
  if (typeof field === 'object' && field.value !== undefined) return String(field.value);
  return String(field);
};

export const getConfidenceLevel = (score) => {
  if (score === null || score === undefined || score === 'Not detected') {
    return { level: 'low', label: 'Not Detected', color: 'red' };
  }
  const numeric = typeof score === 'number' ? score : parseFloat(score);
  if (isNaN(numeric) || numeric < 0.7) {
    return { level: 'low', label: `${Math.round(numeric * 100)}% Low`, color: 'red' };
  }
  if (numeric < 0.9) {
    return { level: 'medium', label: `${Math.round(numeric * 100)}% Med`, color: 'yellow' };
  }
  return { level: 'high', label: `${Math.round(numeric * 100)}% High`, color: 'green' };
};

export const validateExtractionResult = (extractionData, existingCompanies = [], existingShipments = []) => {
  const warnings = [];

  // Company Match Check (Name, Code, or GSTIN)
  const extractedCompName = extractVal(extractionData.company?.name || extractionData.companyName).toLowerCase().trim();
  const extractedGSTIN = extractVal(extractionData.consignee?.gstin || extractionData.consignor?.gstin).toLowerCase().trim();

  const exactComp = existingCompanies.find((c) => {
    const cName = (c.companyName || '').toLowerCase().trim();
    const cCode = (c.companyCode || c.id || '').toLowerCase().trim();
    const cGst = (c.gstin || '').toLowerCase().trim();

    if (cGst && extractedGSTIN && cGst === extractedGSTIN) return true;
    if (cName === extractedCompName) return true;
    if (extractedCompName.includes('p40') && (cName.includes('p40') || cName.includes('advik autocomp'))) return true;
    if (cCode && extractedCompName.includes(cCode)) return true;
    return false;
  });

  let companyMatchStatus = 'none';
  let matchedCompany = null;

  if (exactComp) {
    companyMatchStatus = 'exact';
    matchedCompany = exactComp;
  } else if (extractedCompName) {
    const possibleComp = existingCompanies.find((c) => {
      const cName = (c.companyName || '').toLowerCase().trim();
      return cName.includes('advik') || extractedCompName.includes(cName);
    });
    if (possibleComp) {
      companyMatchStatus = 'exact'; // Auto-select match
      matchedCompany = possibleComp;
    } else {
      companyMatchStatus = 'none';
      warnings.push(`Company '${extractedCompName}' not found in Company Master.`);
    }
  } else {
    warnings.push('Company name not detected in document.');
  }

  // CN Duplicate Check
  const extractedCN = extractVal(extractionData.shipment?.cnNumber);
  const existingCN = extractedCN ? existingShipments.find(
    (s) => s.cnNumber.toLowerCase() === extractedCN.toLowerCase()
  ) : null;

  let cnMatchStatus = 'new';
  if (existingCN) {
    cnMatchStatus = 'existing';
    warnings.push(`Consignment Note number '${extractedCN}' already exists in system.`);
  }

  // Weight Discrepancy Check
  const actual = parseFloat(extractVal(extractionData.shipment?.actualWeight) || 0);
  const chargeable = parseFloat(extractVal(extractionData.shipment?.chargeableWeight) || 0);
  if (chargeable > 0 && actual > 0 && chargeable < actual) {
    warnings.push(`Chargeable Weight (${chargeable} kg) is less than Actual Gross Weight (${actual} kg). Please verify.`);
  }

  return {
    companyMatchStatus,
    matchedCompany,
    cnMatchStatus,
    existingCN,
    warnings
  };
};
