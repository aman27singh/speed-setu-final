'use strict';
/**
 * Field mappings connecting the Sales Register to the Speed Setu Invoice schema.
 * Each entry is a list of candidate property paths on the document.
 */
module.exports = {
  invoice: {
    number: ['invoiceNumber', 'invoiceNo'],
    date: ['invoiceDate'],
    status: ['status'],
    mode: ['transportDetails.mode', 'billingSnapshot.mode', 'mode'],
    hsn: ['transportDetails.hsnCode', 'hsnCode', 'hsn'],
    gstRate: ['gstRate'],
    grandTotal: ['grandTotal', 'totalAmount', 'totals.grandTotal'],
    lines: ['dockets', 'lineItems', 'lines'],
    companyId: ['companyId', 'billToDetails.companyId', 'company'],
  },
  customer: {
    name: ['companyName', 'billToDetails.companyName', 'billTo.name'],
    gstin: ['companyGstin', 'billToDetails.gstin', 'billTo.gstin', 'company.gstin'],
    address: ['companyAddress', 'billToDetails.address', 'billTo.address'],
  },
  line: {
    docketNo: ['docketNo', 'cnNumber', 'cnNo'],
    docketDate: ['docketDate', 'cnDate', 'date'],
    origin: ['origin'],
    destination: ['destination'],
    packages: ['noPack', 'packages', 'noOfPackages', 'pkgs'],
    weight: ['weight', 'chargeableWeight'],
    rate: ['rate'],
    freight: ['freight', 'freightAmount'],
    docketCharges: ['docketCharges'],
    pickupCharges: ['pickupCharges'],
    deliveryCharges: ['deliveryCharges'],
    otherCharges: ['otherCharges'],
    taxable: ['taxableAmount', 'taxableValue'],
    cgst: ['cgst'],
    sgst: ['sgst'],
    igst: ['igst'],
    total: ['totalInvoiceValue', 'total', 'totalAmount', 'lineTotal'],
  },
  populate: [],
};
