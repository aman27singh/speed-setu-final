'use strict';
// Supplier (your company) details printed in the register header.
// Override with environment variables if they ever change.
module.exports = {
  supplier: {
    name: process.env.SUPPLIER_NAME || 'SPEEDSETU LOGISTICS PRIVATE LIMITED',
    address: process.env.SUPPLIER_ADDRESS || 'Haripur, Bhiwani, Haryana - 127021',
    gstin: process.env.SUPPLIER_GSTIN || '06ABSCS1710K1Z4',
  },
  // Used ONLY when an invoice line has no stored GST amounts and the invoice has no gstRate.
  defaultGstRate: 0.18,
  // Your printed bills round inter-state IGST to the nearest rupee per docket line.
  roundIgstToRupee: true,
  // Differences up to this many paise are tolerated by the checks (100 = Rs 1).
  tolerancePaise: 100,
  // Informational warning when a docket is billed this many days after its docket date.
  staleDocketDays: 60,
  standardRates: [0, 0.05, 0.12, 0.18, 0.28],
};
