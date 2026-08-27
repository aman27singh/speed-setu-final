/**
 * Speed Setu Logistics Admin - Payment Validation & Receivables Aging Helpers
 */

export const calculateInvoiceBalance = (invoiceTotal = 0, paidAmount = 0, creditNotesTotal = 0) => {
  const total = parseFloat(invoiceTotal) || 0;
  const paid = parseFloat(paidAmount) || 0;
  const credit = parseFloat(creditNotesTotal) || 0;
  const balance = total - paid - credit;
  return Math.max(0, balance);
};

export const evaluatePaymentStatus = (invoiceTotal = 0, paidAmount = 0, dueDateStr = '') => {
  const total = parseFloat(invoiceTotal) || 0;
  const paid = parseFloat(paidAmount) || 0;
  const balance = total - paid;

  if (balance <= 0) return 'Paid';

  if (paid > 0) return 'Partially Paid';

  if (dueDateStr) {
    const dueDate = new Date(dueDateStr);
    const today = new Date();
    if (today > dueDate) return 'Overdue';
  }

  return 'Unpaid';
};

export const calculateDaysOverdue = (dueDateStr = '') => {
  if (!dueDateStr) return 0;
  const dueDate = new Date(dueDateStr);
  const today = new Date();
  const diffTime = today - dueDate;
  if (diffTime <= 0) return 0;
  return Math.floor(diffTime / (1000 * 60 * 60 * 24));
};

export const validatePaymentForm = (formData, currentOutstanding = 0) => {
  const errors = {};
  const amount = parseFloat(formData.amount);

  if (!formData.paymentDate) {
    errors.paymentDate = 'Payment date is required.';
  }
  if (!amount || amount <= 0) {
    errors.amount = 'Payment amount must be greater than 0.';
  }
  if (amount > currentOutstanding) {
    errors.amountWarning = `⚠ Payment amount (₹${amount}) exceeds outstanding balance (₹${currentOutstanding}).`;
  }
  if (!formData.method) {
    errors.method = 'Payment method is required.';
  }
  return errors;
};
