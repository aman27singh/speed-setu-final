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

  // Company Match Check
  const extractedCompName = extractVal(extractionData.company?.name);
  const exactComp = existingCompanies.find(
    (c) => c.companyName.toLowerCase() === extractedCompName.toLowerCase()
  );

  let companyMatchStatus = 'none';
  let matchedCompany = null;

  if (exactComp) {
    companyMatchStatus = 'exact';
    matchedCompany = exactComp;
  } else if (extractedCompName) {
    const possibleComp = existingCompanies.find((c) =>
      c.companyName.toLowerCase().includes(extractedCompName.toLowerCase()) ||
      extractedCompName.toLowerCase().includes(c.companyName.toLowerCase())
    );
    if (possibleComp) {
      companyMatchStatus = 'possible';
      matchedCompany = possibleComp;
      warnings.push(`Company name '${extractedCompName}' differs slightly from master '${possibleComp.companyName}'.`);
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
