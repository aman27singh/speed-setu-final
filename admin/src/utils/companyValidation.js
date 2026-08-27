/**
 * Speed Setu Company Master Validation Helpers
 */

// Regex patterns
const GSTIN_REGEX = /^[0-9]{2}[A-Z]{5}[0-9]{4}[A-Z]{1}[1-9A-Z]{1}Z[0-9A-Z]{1}$/;
const PAN_REGEX = /^[A-Z]{5}[0-9]{4}[A-Z]{1}$/;
const EMAIL_REGEX = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const PHONE_REGEX = /^[6-9]\d{9}$/; // Standard 10-digit Indian mobile number
const PINCODE_REGEX = /^\d{6}$/;

export const validateCompanyForm = (formData) => {
  const errors = {};

  // Basic Info Validation
  if (!formData.companyName || !formData.companyName.trim()) {
    errors.companyName = 'Company Name is required.';
  }

  if (formData.gstin && formData.gstin.trim() && !GSTIN_REGEX.test(formData.gstin.trim().toUpperCase())) {
    errors.gstin = 'Invalid GSTIN format (e.g. 29AASCA8132C1ZJ).';
  }

  if (formData.pan && formData.pan.trim() && !PAN_REGEX.test(formData.pan.trim().toUpperCase())) {
    errors.pan = 'Invalid PAN format (e.g. AASCA8132C).';
  }

  // Primary Contact Validation (Optional, but validate format if entered)
  if (formData.primaryContact?.phone && formData.primaryContact.phone.trim()) {
    const cleanPhone = formData.primaryContact.phone.replace(/\D/g, '');
    if (cleanPhone.length < 10) {
      errors.primaryContactPhone = 'Enter a valid 10-digit phone number.';
    }
  }

  if (formData.primaryContact?.email && formData.primaryContact.email.trim()) {
    if (!EMAIL_REGEX.test(formData.primaryContact.email.trim())) {
      errors.primaryContactEmail = 'Enter a valid email address.';
    }
  }

  // Billing Information Validation (Optional, but validate format if entered)
  if (formData.billing?.pinCode && formData.billing.pinCode.trim()) {
    if (!PINCODE_REGEX.test(formData.billing.pinCode.trim())) {
      errors.billingPinCode = 'PIN Code must be a 6-digit number.';
    }
  }

  if (formData.billing?.billingEmail && formData.billing.billingEmail.trim()) {
    if (!EMAIL_REGEX.test(formData.billing.billingEmail.trim())) {
      errors.billingEmail = 'Enter a valid billing email address.';
    }
  }

  return errors;
};
