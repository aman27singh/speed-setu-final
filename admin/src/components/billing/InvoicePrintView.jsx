import React, { useState } from 'react';
import { formatINR, formatDate } from '../../utils/formatters';
import logoImg from '../../assets/logo1.png';

export const InvoicePrintView = ({ invoice, defaultTaxType }) => {
  if (!invoice) return null;

  // Extract client company billing profile details with full fallbacks
  const rawCompanyName = invoice.companyBilling?.companyName ||
                         invoice.companyBilling?.registeredName ||
                         invoice.billing?.companyName ||
                         invoice.company?.billing?.companyName ||
                         invoice.companyName ||
                         invoice.company?.companyName ||
                         'N/A';

  const rawAddrLine1 = (invoice.companyAddress && invoice.companyAddress.trim()) ||
                       (invoice.address && invoice.address.trim()) ||
                       invoice.companyBilling?.address ||
                       invoice.billing?.address ||
                       invoice.company?.billing?.address ||
                       invoice.shipment?.consignor?.address ||
                       '';

  const rawAddrLine2 = invoice.companyBilling?.addressLine2 ||
                       invoice.billing?.addressLine2 ||
                       invoice.company?.billing?.addressLine2 ||
                       '';

  // Check if rawAddrLine1 is actually a company legal name (e.g. TECHNIQUES SURFACES INDIA PVT LTD.)
  const isAddrLine1LegalName = /\b(pvt|private|ltd|limited|inc|corp|corporation)\b/i.test(rawAddrLine1) ||
                               (rawAddrLine1.length > 5 && rawAddrLine1.toUpperCase() === rawAddrLine1 && !/\d/.test(rawAddrLine1));

  let displayCompanyName = rawCompanyName;
  let displayAddress = [rawAddrLine1, rawAddrLine2].filter(Boolean).join(', ');

  if (isAddrLine1LegalName && rawAddrLine1.trim().toUpperCase() !== rawCompanyName.trim().toUpperCase()) {
    displayCompanyName = rawAddrLine1.trim();
    displayAddress = rawAddrLine2 ? rawAddrLine2.trim() : '';
  }

  const companyGstin = (invoice.companyGstin && invoice.companyGstin.trim()) ||
                       (invoice.gstin && invoice.gstin.trim()) ||
                       invoice.companyBilling?.gstin ||
                       invoice.billing?.gstin ||
                       invoice.company?.gstin ||
                       invoice.company?.billing?.gstin ||
                       invoice.shipment?.consignor?.gstin ||
                       '';

  const rawCity = (invoice.city && invoice.city.trim()) ||
                  invoice.companyBilling?.city ||
                  invoice.billing?.city ||
                  invoice.company?.billing?.city ||
                  invoice.shipment?.consignor?.city ||
                  '';

  const rawState = (invoice.state && invoice.state.trim()) ||
                   invoice.companyBilling?.state ||
                   invoice.billing?.state ||
                   invoice.company?.billing?.state ||
                   invoice.shipment?.consignor?.state ||
                   '';

  const rawPinCode = (invoice.pinCode && invoice.pinCode.trim()) ||
                     invoice.companyBilling?.pinCode ||
                     invoice.billing?.pinCode ||
                     invoice.company?.billing?.pinCode ||
                     invoice.shipment?.consignor?.pin ||
                     '';

  // Determine if GST is charged or exempt
  const isInitiallyGstExempt = invoice.isGstExempt === true || invoice.gstRate === 0 || (invoice.gstAmount === 0 && !invoice.cgst && !invoice.sgst && !invoice.igst);
  const initialTaxMode = defaultTaxType || (isInitiallyGstExempt ? 'no_gst' : 'charging_gst');

  const [taxMode, setTaxMode] = useState(initialTaxMode); // 'no_gst' | 'charging_gst'

  const isChargingGst = taxMode === 'charging_gst';

  // Build dockets breakdown list
  let dockets = [];

  if (invoice.dockets && Array.isArray(invoice.dockets) && invoice.dockets.length > 0) {
    dockets = invoice.dockets.map(d => {
      const taxable = d.taxableAmount || d.freight || 0;
      const isInterState = d.origin && d.destination && d.origin.toLowerCase().trim() !== d.destination.toLowerCase().trim();
      const gstRate = invoice.gstRate || 18;

      let cgst = 0;
      let sgst = 0;
      let igst = 0;

      if (isChargingGst) {
        if (d.cgst > 0 || d.sgst > 0) {
          cgst = d.cgst;
          sgst = d.sgst;
          igst = d.igst || 0;
        } else if (d.igst > 0) {
          igst = d.igst;
        } else if (isInterState) {
          igst = Math.round(taxable * (gstRate / 100));
        } else {
          cgst = Math.round(taxable * (gstRate / 200));
          sgst = Math.round(taxable * (gstRate / 200));
        }
      }

      const totalVal = isChargingGst ? (taxable + cgst + sgst + igst) : taxable;

      return {
        ...d,
        cgst,
        sgst,
        igst,
        taxableAmount: taxable,
        totalInvoiceValue: totalVal
      };
    });
  } else if (invoice.lineItems && Array.isArray(invoice.lineItems) && invoice.lineItems.length > 0) {
    const freightItem = invoice.lineItems.find(i => (i.name || i.description || '').toLowerCase().includes('freight'));
    const docketItem = invoice.lineItems.find(i => (i.name || i.description || '').toLowerCase().includes('docket'));
    const pickupItem = invoice.lineItems.find(i => (i.name || i.description || '').toLowerCase().includes('pickup'));
    const deliveryItem = invoice.lineItems.find(i => (i.name || i.description || '').toLowerCase().includes('delivery'));
    const packingItem = invoice.lineItems.find(i => (i.name || i.description || '').toLowerCase().includes('packing'));
    const laborItem = invoice.lineItems.find(i => (i.name || i.description || '').toLowerCase().includes('labor') || (i.name || i.description || '').toLowerCase().includes('loading'));
    const godownItem = invoice.lineItems.find(i => (i.name || i.description || '').toLowerCase().includes('godown') || (i.name || i.description || '').toLowerCase().includes('storage'));

    const wt = freightItem?.weight || freightItem?.quantity || invoice.weight || 0;
    const rate = freightItem?.rate || godownItem?.rate || 0;
    const freightAmt = freightItem?.amount || 0;
    const docketAmt = docketItem?.amount || 0;
    const pickupAmt = pickupItem?.amount || 0;
    const deliveryAmt = deliveryItem?.amount || 0;
    const packingAmt = packingItem?.amount || 0;
    const laborAmt = laborItem?.amount || 0;
    const godownAmt = godownItem?.amount || 0;

    const taxable = invoice.subTotal || invoice.taxableAmount || (freightAmt + docketAmt + pickupAmt + deliveryAmt + packingAmt + laborAmt + godownAmt);
    const gstRate = invoice.gstRate || 18;
    const gstAmt = isChargingGst ? (invoice.gstAmount || Math.round(taxable * (gstRate / 100))) : 0;
    const totalVal = taxable + gstAmt;

    dockets = [
      {
        slNo: 1,
        docketNo: invoice.cnNumber || (invoice.cns && invoice.cns[0]) || invoice.shipmentIds?.[0] || '-',
        docketDate: formatDate(invoice.invoiceDate || invoice.createdAt),
        origin: invoice.shipment?.origin || invoice.origin || '-',
        destination: invoice.shipment?.destination || invoice.destination || '-',
        noPack: invoice.numberOfBoxes || invoice.noOfBoxes || invoice.boxes || invoice.packages || invoice.noPack || invoice.shipment?.packages || 10,
        weight: wt,
        rate: rate,
        freight: freightAmt,
        docketCharges: docketAmt,
        pickupCharges: pickupAmt,
        deliveryCharges: deliveryAmt,
        packingCharges: packingAmt,
        laborCharges: laborAmt,
        godownCharges: godownAmt,
        otherCharges: packingAmt + laborAmt + godownAmt,
        taxableAmount: taxable,
        cgst: 0,
        sgst: 0,
        igst: gstAmt,
        totalInvoiceValue: totalVal
      }
    ];
  } else {
    const taxable = invoice.subTotal || invoice.taxableAmount || 0;
    const gstAmt = isChargingGst ? (invoice.gstAmount || Math.round(taxable * 0.18)) : 0;
    dockets = [
      {
        slNo: 1,
        docketNo: invoice.cnNumber || (invoice.cns && invoice.cns[0]) || '-',
        docketDate: formatDate(invoice.invoiceDate || invoice.createdAt),
        origin: invoice.origin || '-',
        destination: invoice.destination || '-',
        noPack: invoice.numberOfBoxes || invoice.noOfBoxes || invoice.boxes || invoice.packages || invoice.noPack || 10,
        weight: invoice.weight || 0,
        rate: invoice.ratePerKg || 0,
        freight: taxable,
        docketCharges: 0,
        pickupCharges: 0,
        deliveryCharges: 0,
        otherCharges: 0,
        taxableAmount: taxable,
        cgst: 0,
        sgst: 0,
        igst: gstAmt,
        totalInvoiceValue: taxable + gstAmt
      }
    ];
  }

  // Sort dockets chronologically by date (earliest date first)
  const parseDateVal = (dStr) => {
    if (!dStr) return 0;
    const t = Date.parse(dStr);
    if (!isNaN(t)) return t;
    const parts = String(dStr).trim().split(/[\s\-\/]+/);
    if (parts.length === 3) {
      const months = { jan:0, feb:1, mar:2, apr:3, may:4, jun:5, jul:6, aug:7, sep:8, oct:9, nov:10, dec:11 };
      if (parts[0].length === 4) {
        return new Date(parseInt(parts[0]), parseInt(parts[1]) - 1, parseInt(parts[2])).getTime();
      }
      const day = parseInt(parts[0], 10);
      const month = isNaN(parts[1]) ? months[parts[1].toLowerCase().slice(0, 3)] : parseInt(parts[1], 10) - 1;
      const year = parseInt(parts[2], 10);
      if (!isNaN(day) && month !== undefined && !isNaN(year)) {
        return new Date(year, month, day).getTime();
      }
    }
    return 0;
  };

  dockets = [...dockets].sort((a, b) => {
    const timeA = parseDateVal(a.docketDate || a.cnDate || a.bookingDate);
    const timeB = parseDateVal(b.docketDate || b.cnDate || b.bookingDate);
    return timeA - timeB;
  }).map((d, idx) => ({ ...d, slNo: idx + 1 }));

  const totalPacksNum = dockets.reduce((sum, d) => sum + (parseInt(String(d.noPack).replace(/\D+/g, ''), 10) || 0), 0);
  const displayTotalPacks = totalPacksNum > 0 ? totalPacksNum : (dockets[0]?.noPack || '-');
  const totalPacks = displayTotalPacks;
  const totalWeight = dockets.reduce((sum, d) => sum + (d.weight || 0), 0);
  const totalFreight = dockets.reduce((sum, d) => sum + (d.freight || 0), 0);
  const totalDocketCharges = dockets.reduce((sum, d) => sum + (d.docketCharges || 0), 0);
  const totalPickupCharges = dockets.reduce((sum, d) => sum + (d.pickupCharges || 0), 0);
  const totalDeliveryCharges = dockets.reduce((sum, d) => sum + (d.deliveryCharges || 0), 0);
  const totalPackingCharges = dockets.reduce((sum, d) => sum + (d.packingCharges || d.packing || 0), 0);
  const totalLaborCharges = dockets.reduce((sum, d) => sum + (d.laborCharges || d.labor || 0), 0);
  const totalGodownCharges = dockets.reduce((sum, d) => sum + (d.godownCharges || d.godown || 0), 0);

  const totalOtherCharges = dockets.reduce((sum, d) => {
    const other = d.otherCharges || 0;
    const aggregated = (d.packingCharges || 0) + (d.laborCharges || 0) + (d.godownCharges || 0);
    return sum + (other > 0 ? other : aggregated);
  }, 0);

  const totalTaxable = dockets.reduce((sum, d) => sum + (d.taxableAmount || 0), 0);
  const totalCGST = isChargingGst ? dockets.reduce((sum, d) => sum + (d.cgst || 0), 0) : 0;
  const totalSGST = isChargingGst ? dockets.reduce((sum, d) => sum + (d.sgst || 0), 0) : 0;
  const totalIGST = isChargingGst ? dockets.reduce((sum, d) => sum + (d.igst || 0), 0) : 0;
  const grandTotalValue = isChargingGst ? (totalTaxable + totalCGST + totalSGST + totalIGST) : totalTaxable;

  // Pad table with empty rows to fill A4 page height (minimum 15 rows)
  const MIN_TABLE_ROWS = 15;
  const emptyRowsCount = Math.max(0, MIN_TABLE_ROWS - dockets.length);
  const emptyRows = Array.from({ length: emptyRowsCount }, () => ({ isEmptyRow: true }));
  const displayDockets = [...dockets, ...emptyRows];

  return (
    <div id="printable-invoice" className="bg-white text-slate-900 font-sans p-3 sm:p-5 w-full max-w-7xl mx-auto space-y-2.5 print:space-y-1.5 print:p-0 print:m-0 print:max-w-none text-xs">
      

      {/* TAX INVOICE HEADER TITLE */}
      <div className="text-center font-extrabold text-sm uppercase tracking-wider py-0.5 print:py-0 print:text-xs">
        TAX INVOICE
      </div>

      {/* TOP HEADER 3-BOX GRID STRUCTURE */}
      <div className="grid grid-cols-12 border border-black text-[10px] print:text-[8.5px] leading-tight">

        {/* BOX 1: SUPPLIER */}
        <div className="col-span-5 p-2 print:p-1.5 border-r border-black space-y-0.5 print:space-y-0">
          <div className="flex items-center gap-1.5 mb-0.5">
            <img
              src={logoImg}
              alt="Speed Setu Logo"
              className="h-6 print:h-4.5 w-auto object-contain shrink-0"
            />
            <div className="font-extrabold text-[9px] uppercase text-black">SUPPLIER</div>
          </div>
          <div className="font-extrabold text-[11px] print:text-[9.5px]">SPEEDSETU LOGISTICS PRIVATE LIMITED</div>
          <div>Haripur, BHIWANI,</div>
          <div>Haripur, Bhiwani, Bhiwani, Haryana, 127021</div>
          <div className="pt-1 font-bold font-mono">GST - 06ABSCS1710K1Z4</div>
        </div>

        {/* BOX 2: BILL TO */}
        <div className="col-span-4 p-2 print:p-1.5 border-r border-black space-y-0.5 print:space-y-0">
          <div className="font-extrabold text-[9px] uppercase text-black">BILL TO</div>
          <div className="font-extrabold text-[11px] print:text-[9.5px]">{displayCompanyName}</div>
          {displayAddress && <div className="text-[9.5px] print:text-[8px] leading-tight">{displayAddress}</div>}
          {(rawCity || rawState || rawPinCode) && (
            <div className="text-[9.5px] print:text-[8px] leading-tight font-medium">
              {[rawCity, rawState].filter(Boolean).join(', ')} {rawPinCode ? `- ${rawPinCode}` : ''}
            </div>
          )}
          <div className="pt-1 font-bold font-mono">
            {isChargingGst
              ? (companyGstin && companyGstin.trim() !== '' ? `GST - ${companyGstin}` : 'GST - Unregistered')
              : 'GST - N/A (Exempt / Unregistered)'}
          </div>
        </div>

        {/* BOX 3: INVOICE NUMBER & DATE */}
        <div className="col-span-3 p-2 print:p-1.5 flex flex-col justify-between text-center">
          <div>
            <div className="font-extrabold text-[9px] uppercase text-black">INVOICE NUMBER</div>
            <div className="font-extrabold text-xs print:text-[10px] font-mono py-0.5">{invoice.invoiceNumber || '-'}</div>
          </div>

          <div className="border-t border-black pt-1">
            <div className="font-extrabold text-[9px] uppercase text-black">INVOICE DATE</div>
            <div className="font-bold text-[11px] print:text-[9.5px] font-mono">{formatDate(invoice.invoiceDate || invoice.createdAt)}</div>
          </div>
        </div>

      </div>

      {/* SUB-HEADER BAR: MODE & HSN CODE */}
      <div className="grid grid-cols-2 border border-black text-center font-bold text-xs print:text-[9px]">
        <div className="p-1 print:p-0.5 border-r border-black">
          MODE: <span className="font-extrabold uppercase">{invoice.billingSnapshot?.mode || invoice.mode || 'TRAIN'}</span>
        </div>
        <div className="p-1 print:p-0.5">
          HSN CODE: <span className="font-mono font-extrabold">{isChargingGst ? (invoice.hsnCode || invoice.billingSnapshot?.hsnCode || '996531') : 'NA'}</span>
        </div>
      </div>

      {/* DOCKET BREAKDOWN TABLE - DYNAMICALLY RENDERED BASED ON GST CHARGE TYPE */}
      {!isChargingGst ? (
        /* ==================== LAYOUT 1: NO GST CHARGED (IMAGE 1 LAYOUT) ==================== */
        <div className="border border-black w-full overflow-x-auto print:overflow-visible">
          <table className="w-full text-center border-collapse text-[8px] sm:text-[8.5px] print:text-[7.5px] leading-tight print:leading-[1.1] table-auto">
            <thead className="bg-slate-100 font-extrabold uppercase border-b border-black">
              <tr className="divide-x divide-black">
                <th className="px-1 py-0.5 print:py-[1px] print:px-[1px]">SL. NO.</th>
                <th className="px-1 py-0.5 print:py-[1px] print:px-[1px]">DOCKET NO.</th>
                <th className="px-1 py-0.5 print:py-[1px] print:px-[1px]">DOCKET DATE</th>
                <th className="px-1 py-0.5 print:py-[1px] print:px-[1px]">ORIGIN</th>
                <th className="px-1 py-0.5 print:py-[1px] print:px-[1px]">DESTINATION</th>
                <th className="px-1 py-0.5 print:py-[1px] print:px-[1px]">NO. OF BOXES</th>
                <th className="px-1 py-0.5 print:py-[1px] print:px-[1px]">WEIGHT</th>
                <th className="px-1 py-0.5 print:py-[1px] print:px-[1px]">RATE</th>
                <th className="px-1 py-0.5 print:py-[1px] print:px-[1px]">FREIGHT</th>
                <th className="px-1 py-0.5 print:py-[1px] print:px-[1px]">PICKUP CHARGES</th>
                <th className="px-1 py-0.5 print:py-[1px] print:px-[1px]">DELIVERY CHARGES</th>
                <th className="px-1 py-0.5 print:py-[1px] print:px-[1px]">PACKING CHARGES</th>
                <th className="px-1 py-0.5 print:py-[1px] print:px-[1px]">LABOR CHARGES</th>
                <th className="px-1 py-0.5 print:py-[1px] print:px-[1px]">STORAGE RATE / MO</th>
                <th className="px-1 py-0.5 print:py-[1px] print:px-[1px]">NO. OF MONTHS</th>
                <th className="px-1 py-0.5 print:py-[1px] print:px-[1px]">GODOWN CHARGES</th>
                <th className="px-1 py-0.5 print:py-[1px] print:px-[1px]">TAXABLE AMOUNT</th>
                <th className="px-1 py-0.5 print:py-[1px] print:px-[1px]">IGST</th>
                <th className="px-1 py-0.5 print:py-[1px] print:px-[1px] whitespace-nowrap">TOTAL</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-black font-medium">
              {displayDockets.map((d, idx) => {
                if (d.isEmptyRow) {
                  return (
                    <tr key={`empty-${idx}`} className="divide-x divide-black h-5.5 print:h-5">
                      <td className="px-1 py-0.5 print:py-[1px]">&nbsp;</td>
                      <td className="px-1 py-0.5 print:py-[1px]">&nbsp;</td>
                      <td className="px-1 py-0.5 print:py-[1px]">&nbsp;</td>
                      <td className="px-1 py-0.5 print:py-[1px]">&nbsp;</td>
                      <td className="px-1 py-0.5 print:py-[1px]">&nbsp;</td>
                      <td className="px-1 py-0.5 print:py-[1px]">&nbsp;</td>
                      <td className="px-1 py-0.5 print:py-[1px]">&nbsp;</td>
                      <td className="px-1 py-0.5 print:py-[1px]">&nbsp;</td>
                      <td className="px-1 py-0.5 print:py-[1px]">&nbsp;</td>
                      <td className="px-1 py-0.5 print:py-[1px]">&nbsp;</td>
                      <td className="px-1 py-0.5 print:py-[1px]">&nbsp;</td>
                      <td className="px-1 py-0.5 print:py-[1px]">&nbsp;</td>
                      <td className="px-1 py-0.5 print:py-[1px]">&nbsp;</td>
                      <td className="px-1 py-0.5 print:py-[1px]">&nbsp;</td>
                      <td className="px-1 py-0.5 print:py-[1px]">&nbsp;</td>
                      <td className="px-1 py-0.5 print:py-[1px]">&nbsp;</td>
                      <td className="px-1 py-0.5 print:py-[1px]">&nbsp;</td>
                      <td className="px-1 py-0.5 print:py-[1px]">&nbsp;</td>
                      <td className="px-1 py-0.5 print:py-[1px]">&nbsp;</td>
                    </tr>
                  );
                }

                return (
                  <tr key={idx} className="divide-x divide-black hover:bg-slate-50">
                    <td className="px-1 py-0.5 print:py-[1px] print:px-[1px] font-mono">{d.slNo || idx + 1}</td>
                    <td className="px-1 py-0.5 print:py-[1px] print:px-[1px] font-bold font-mono whitespace-nowrap">{d.docketNo || '-'}</td>
                    <td className="px-1 py-0.5 print:py-[1px] print:px-[1px] font-mono whitespace-nowrap">{d.docketDate || '-'}</td>
                    <td className="px-1 py-0.5 print:py-[1px] print:px-[1px] uppercase">{d.origin || '-'}</td>
                    <td className="px-1 py-0.5 print:py-[1px] print:px-[1px] uppercase">{d.destination || '-'}</td>
                    <td className="px-1 py-0.5 print:py-[1px] print:px-[1px] font-mono">{d.noPack || 1}</td>
                    <td className="px-1 py-0.5 print:py-[1px] print:px-[1px] font-mono">{d.weight || 0}</td>
                    <td className="px-1 py-0.5 print:py-[1px] print:px-[1px] font-mono whitespace-nowrap">₹{(d.rate || 0).toLocaleString('en-IN')}</td>
                    <td className="px-1 py-0.5 print:py-[1px] print:px-[1px] font-mono whitespace-nowrap">₹{(d.freight || 0).toLocaleString('en-IN')}</td>
                    <td className="px-1 py-0.5 print:py-[1px] print:px-[1px] font-mono font-bold whitespace-nowrap">{(d.pickupCharges || 0).toLocaleString('en-IN')}</td>
                    <td className="px-1 py-0.5 print:py-[1px] print:px-[1px] font-mono whitespace-nowrap">{(d.deliveryCharges || 0).toLocaleString('en-IN')}</td>
                    <td className="px-1 py-0.5 print:py-[1px] print:px-[1px] font-mono font-bold whitespace-nowrap">{(d.packingCharges || d.packing || 0).toLocaleString('en-IN')}</td>
                    <td className="px-1 py-0.5 print:py-[1px] print:px-[1px] font-mono font-bold whitespace-nowrap">{(d.laborCharges || d.labor || 0).toLocaleString('en-IN')}</td>
                    <td className="px-1 py-0.5 print:py-[1px] print:px-[1px] font-mono font-bold whitespace-nowrap">
                      {(d.godownCharges || d.godown || 0) > 0
                        ? `₹${(d.godownRatePerMonth || (d.godownMonths > 0 ? Math.round((d.godownCharges || d.godown || 0) / d.godownMonths) : (d.godownCharges || d.godown || 0))).toLocaleString('en-IN')}`
                        : '₹0'}
                    </td>
                    <td className="px-1 py-0.5 print:py-[1px] print:px-[1px] font-mono font-bold whitespace-nowrap">
                      {(d.godownCharges || d.godown || 0) > 0
                        ? (d.godownMonths ? `${d.godownMonths} Months` : (d.godownDays ? `${d.godownDays} Days` : '1 Month'))
                        : '-'}
                    </td>
                    <td className="px-1 py-0.5 print:py-[1px] print:px-[1px] font-mono font-bold whitespace-nowrap">₹{(d.godownCharges || d.godown || 0).toLocaleString('en-IN')}</td>
                    <td className="px-1 py-0.5 print:py-[1px] print:px-[1px] font-mono font-bold whitespace-nowrap">{(d.taxableAmount || 0).toLocaleString('en-IN')}</td>
                    <td className="px-1 py-0.5 print:py-[1px] print:px-[1px] font-mono font-bold whitespace-nowrap">0</td>
                    <td className="px-1 py-0.5 print:py-[1px] print:px-[1px] font-mono font-extrabold text-black whitespace-nowrap">{(d.taxableAmount || 0).toLocaleString('en-IN')}</td>
                  </tr>
                );
              })}
            </tbody>

            {/* SUMMARY TOTALS FOOTER ROW */}
            <tfoot className="border-t border-black font-extrabold bg-slate-50">
              <tr className="divide-x divide-black">
                <td colSpan={5} className="px-1 py-0.5 print:py-[1px] text-right uppercase">TOTAL:</td>
                <td className="px-1 py-0.5 print:py-[1px] font-mono">{totalPacks}</td>
                <td className="px-1 py-0.5 print:py-[1px] font-mono">{totalWeight}</td>
                <td className="px-1 py-0.5 print:py-[1px]"></td>
                <td className="px-1 py-0.5 print:py-[1px] font-mono whitespace-nowrap">₹{totalFreight.toLocaleString('en-IN')}</td>
                <td className="px-1 py-0.5 print:py-[1px] font-mono whitespace-nowrap">{totalPickupCharges.toLocaleString('en-IN')}</td>
                <td className="px-1 py-0.5 print:py-[1px] font-mono whitespace-nowrap">{totalDeliveryCharges.toLocaleString('en-IN')}</td>
                <td className="px-1 py-0.5 print:py-[1px] font-mono whitespace-nowrap">₹{totalPackingCharges.toLocaleString('en-IN')}</td>
                <td className="px-1 py-0.5 print:py-[1px] font-mono whitespace-nowrap">₹{totalLaborCharges.toLocaleString('en-IN')}</td>
                <td className="px-1 py-0.5 print:py-[1px]"></td>
                <td className="px-1 py-0.5 print:py-[1px]"></td>
                <td className="px-1 py-0.5 print:py-[1px] font-mono whitespace-nowrap">₹{totalGodownCharges.toLocaleString('en-IN')}</td>
                <td className="px-1 py-0.5 print:py-[1px] font-mono text-black whitespace-nowrap">₹{totalTaxable.toLocaleString('en-IN')}</td>
                <td className="px-1 py-0.5 print:py-[1px] font-mono text-black whitespace-nowrap">₹0</td>
                <td className="px-1 py-0.5 print:py-[1px] font-mono text-black whitespace-nowrap">₹{totalTaxable.toLocaleString('en-IN')}</td>
              </tr>
            </tfoot>
          </table>
        </div>
      ) : (
        /* ==================== LAYOUT 2: CHARGING GST (IMAGE 2 LAYOUT) ==================== */
        <div className="border border-black w-full overflow-x-auto print:overflow-visible">
          <table className="w-full text-center border-collapse text-[8px] sm:text-[8.5px] print:text-[7.5px] leading-tight print:leading-[1.1] table-auto">
            <thead className="bg-slate-100 font-extrabold uppercase border-b border-black">
              <tr className="divide-x divide-black">
                <th className="px-1 py-0.5 print:py-[1px] print:px-[1px]">SL. NO.</th>
                <th className="px-1 py-0.5 print:py-[1px] print:px-[1px]">DOCKET NO.</th>
                <th className="px-1 py-0.5 print:py-[1px] print:px-[1px]">DOCKET DATE</th>
                <th className="px-1 py-0.5 print:py-[1px] print:px-[1px]">ORIGIN</th>
                <th className="px-1 py-0.5 print:py-[1px] print:px-[1px]">DESTINATION</th>
                <th className="px-1 py-0.5 print:py-[1px] print:px-[1px]">NO. PACK</th>
                <th className="px-1 py-0.5 print:py-[1px] print:px-[1px]">WEIGHT</th>
                <th className="px-1 py-0.5 print:py-[1px] print:px-[1px]">RATE</th>
                <th className="px-1 py-0.5 print:py-[1px] print:px-[1px]">FREIGHT</th>
                <th className="px-1 py-0.5 print:py-[1px] print:px-[1px]">DOCKET CHARGES</th>
                <th className="px-1 py-0.5 print:py-[1px] print:px-[1px]">PICKUP CHARGES</th>
                <th className="px-1 py-0.5 print:py-[1px] print:px-[1px]">DELIVERY CHARGES</th>
                <th className="px-1 py-0.5 print:py-[1px] print:px-[1px]">OTHER CHARGES</th>
                <th className="px-1 py-0.5 print:py-[1px] print:px-[1px]">TAXABLE AMOUNT</th>
                <th className="px-1 py-0.5 print:py-[1px] print:px-[1px]">CGST</th>
                <th className="px-1 py-0.5 print:py-[1px] print:px-[1px]">SGST</th>
                <th className="px-1 py-0.5 print:py-[1px] print:px-[1px]">IGST</th>
                <th className="px-1 py-0.5 print:py-[1px] print:px-[1px] whitespace-nowrap">TOTAL INVOICE VALUE</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-black font-medium">
              {displayDockets.map((d, idx) => {
                if (d.isEmptyRow) {
                  return (
                    <tr key={`empty-${idx}`} className="divide-x divide-black h-5.5 print:h-5">
                      <td className="px-1 py-0.5 print:py-[1px]">&nbsp;</td>
                      <td className="px-1 py-0.5 print:py-[1px]">&nbsp;</td>
                      <td className="px-1 py-0.5 print:py-[1px]">&nbsp;</td>
                      <td className="px-1 py-0.5 print:py-[1px]">&nbsp;</td>
                      <td className="px-1 py-0.5 print:py-[1px]">&nbsp;</td>
                      <td className="px-1 py-0.5 print:py-[1px]">&nbsp;</td>
                      <td className="px-1 py-0.5 print:py-[1px]">&nbsp;</td>
                      <td className="px-1 py-0.5 print:py-[1px]">&nbsp;</td>
                      <td className="px-1 py-0.5 print:py-[1px]">&nbsp;</td>
                      <td className="px-1 py-0.5 print:py-[1px]">&nbsp;</td>
                      <td className="px-1 py-0.5 print:py-[1px]">&nbsp;</td>
                      <td className="px-1 py-0.5 print:py-[1px]">&nbsp;</td>
                      <td className="px-1 py-0.5 print:py-[1px]">&nbsp;</td>
                      <td className="px-1 py-0.5 print:py-[1px]">&nbsp;</td>
                      <td className="px-1 py-0.5 print:py-[1px]">&nbsp;</td>
                      <td className="px-1 py-0.5 print:py-[1px]">&nbsp;</td>
                      <td className="px-1 py-0.5 print:py-[1px]">&nbsp;</td>
                      <td className="px-1 py-0.5 print:py-[1px]">&nbsp;</td>
                    </tr>
                  );
                }

                const other = (d.otherCharges || 0) > 0 ? d.otherCharges : ((d.packingCharges || 0) + (d.laborCharges || 0) + (d.godownCharges || 0));
                return (
                  <tr key={idx} className="divide-x divide-black hover:bg-slate-50">
                    <td className="px-1 py-0.5 print:py-[1px] print:px-[1px] font-mono">{d.slNo || idx + 1}</td>
                    <td className="px-1 py-0.5 print:py-[1px] print:px-[1px] font-bold font-mono whitespace-nowrap">{d.docketNo || '-'}</td>
                    <td className="px-1 py-0.5 print:py-[1px] print:px-[1px] font-mono whitespace-nowrap">{d.docketDate || '-'}</td>
                    <td className="px-1 py-0.5 print:py-[1px] print:px-[1px] uppercase">{d.origin || '-'}</td>
                    <td className="px-1 py-0.5 print:py-[1px] print:px-[1px] uppercase">{d.destination || '-'}</td>
                    <td className="px-1 py-0.5 print:py-[1px] print:px-[1px] font-mono">{d.noPack || 1}</td>
                    <td className="px-1 py-0.5 print:py-[1px] print:px-[1px] font-mono">{d.weight || 0}</td>
                    <td className="px-1 py-0.5 print:py-[1px] print:px-[1px] font-mono whitespace-nowrap">₹{(d.rate || 0).toLocaleString('en-IN')}</td>
                    <td className="px-1 py-0.5 print:py-[1px] print:px-[1px] font-mono whitespace-nowrap">₹{(d.freight || 0).toLocaleString('en-IN')}</td>
                    <td className="px-1 py-0.5 print:py-[1px] print:px-[1px] font-mono whitespace-nowrap">{(d.docketCharges || 0).toLocaleString('en-IN')}</td>
                    <td className="px-1 py-0.5 print:py-[1px] print:px-[1px] font-mono whitespace-nowrap">{(d.pickupCharges || 0).toLocaleString('en-IN')}</td>
                    <td className="px-1 py-0.5 print:py-[1px] print:px-[1px] font-mono whitespace-nowrap">{(d.deliveryCharges || 0).toLocaleString('en-IN')}</td>
                    <td className="px-1 py-0.5 print:py-[1px] print:px-[1px] font-mono whitespace-nowrap">{other > 0 ? `₹${other.toLocaleString('en-IN')}` : '-'}</td>
                    <td className="px-1 py-0.5 print:py-[1px] print:px-[1px] font-mono font-bold whitespace-nowrap">{(d.taxableAmount || 0).toLocaleString('en-IN')}</td>
                    <td className="px-1 py-0.5 print:py-[1px] print:px-[1px] font-mono whitespace-nowrap">{d.cgst > 0 ? d.cgst.toLocaleString('en-IN') : '-'}</td>
                    <td className="px-1 py-0.5 print:py-[1px] print:px-[1px] font-mono whitespace-nowrap">{d.sgst > 0 ? d.sgst.toLocaleString('en-IN') : '-'}</td>
                    <td className="px-1 py-0.5 print:py-[1px] print:px-[1px] font-mono font-bold whitespace-nowrap">{d.igst > 0 ? d.igst.toLocaleString('en-IN') : '-'}</td>
                    <td className="px-1 py-0.5 print:py-[1px] print:px-[1px] font-mono font-extrabold text-black whitespace-nowrap">{(d.totalInvoiceValue || 0).toLocaleString('en-IN')}</td>
                  </tr>
                );
              })}
            </tbody>

            {/* SUMMARY TOTALS FOOTER ROW */}
            <tfoot className="border-t border-black font-extrabold bg-slate-50">
              <tr className="divide-x divide-black">
                <td colSpan={5} className="px-1 py-0.5 print:py-[1px] text-right uppercase">TOTAL:</td>
                <td className="px-1 py-0.5 print:py-[1px] font-mono">{totalPacks}</td>
                <td className="px-1 py-0.5 print:py-[1px] font-mono">{totalWeight}</td>
                <td className="px-1 py-0.5 print:py-[1px]"></td>
                <td className="px-1 py-0.5 print:py-[1px] font-mono whitespace-nowrap">₹{totalFreight.toLocaleString('en-IN')}</td>
                <td className="px-1 py-0.5 print:py-[1px] font-mono whitespace-nowrap">{totalDocketCharges.toLocaleString('en-IN')}</td>
                <td className="px-1 py-0.5 print:py-[1px] font-mono whitespace-nowrap">{totalPickupCharges.toLocaleString('en-IN')}</td>
                <td className="px-1 py-0.5 print:py-[1px] font-mono whitespace-nowrap">{totalDeliveryCharges.toLocaleString('en-IN')}</td>
                <td className="px-1 py-0.5 print:py-[1px] font-mono whitespace-nowrap">{totalOtherCharges > 0 ? `₹${totalOtherCharges.toLocaleString('en-IN')}` : '-'}</td>
                <td className="px-1 py-0.5 print:py-[1px] font-mono text-black whitespace-nowrap">₹{totalTaxable.toLocaleString('en-IN')}</td>
                <td className="px-1 py-0.5 print:py-[1px] font-mono whitespace-nowrap">{totalCGST > 0 ? `₹${totalCGST.toLocaleString('en-IN')}` : '-'}</td>
                <td className="px-1 py-0.5 print:py-[1px] font-mono whitespace-nowrap">{totalSGST > 0 ? `₹${totalSGST.toLocaleString('en-IN')}` : '-'}</td>
                <td className="px-1 py-0.5 print:py-[1px] font-mono text-black whitespace-nowrap">{totalIGST > 0 ? `₹${totalIGST.toLocaleString('en-IN')}` : '-'}</td>
                <td className="px-1 py-0.5 print:py-[1px] font-mono text-black whitespace-nowrap">₹{grandTotalValue.toLocaleString('en-IN')}</td>
              </tr>
            </tfoot>
          </table>
        </div>
      )}

      {/* TERMS & CONDITIONS BLOCK */}
      <div className="border border-black p-2 print:p-1.5 space-y-0.5 text-[9.5px] print:text-[7.5px] leading-tight">
        <div className="font-extrabold underline text-black">Terms :-</div>
        <ol className="list-decimal list-inside space-y-0 text-slate-800">
          <li>Our Company Is Registered Under Msme. Uam No</li>
          <li>If Any Discrepancy In The Invoice Please Inform Us Within Two Days After That It Will Not Be Accepted.</li>
          <li>The Laws Applicable To This Contract Shall Be The Law In Force In India. The Courts Of New Delhi Shall Have Exclusive Jurisdiction In All Matters Arising Under This Contract.</li>
          <li>Payments Should Be Made Through Cheque/Dd. In Favour "Speed Setu Logistics Pvt Ltd "</li>
          <li>Payment After Due Date Will Attract Interest @ 2% Or Part Of The Month</li>
        </ol>
      </div>

      {/* BANK DETAILS & AUTHORISED SIGNATORY GRID */}
      <div className="grid grid-cols-12 gap-2 text-[10px] print:text-[8px] pt-0.5 leading-tight items-stretch">
        {/* BANK ACCOUNT BOX */}
        <div className="col-span-7 border border-black p-2 print:p-1.5 flex items-center gap-3">
          <div className="p-1.5 border border-slate-300 rounded bg-slate-50 shrink-0">
            <span className="font-extrabold text-sm">🏛️</span>
          </div>
          <div className="space-y-0.5 font-medium">
            <div><strong className="text-black">Bank Name :</strong> HDFC BANK LTD</div>
            <div><strong className="text-black">Account Number :</strong> 50200118714271</div>
            <div><strong className="text-black">IFSC Code :</strong> HDFC0000479</div>
            <div><strong className="text-black">Branch :</strong> MEHAM GATE, BHIWANI</div>
          </div>
        </div>

        {/* SIGNATORY BOX */}
        <div className="col-span-5 border border-black p-2 print:p-1.5 flex flex-col justify-end text-center min-h-[65px] print:min-h-[55px]">
          <div className="font-extrabold uppercase text-[9px] print:text-[7.5px] tracking-wider text-black">
            AUTHORISED SIGNATORY
          </div>
        </div>
      </div>

    </div>
  );
};
