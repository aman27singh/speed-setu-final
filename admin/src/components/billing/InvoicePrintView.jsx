import React, { useState } from "react";
import { formatINR, formatDate } from "../../utils/formatters";
import { normalizeRateBasis, resolveShipmentFreightMode } from "../../utils/pricingValidation";
import logoImg from "../../assets/logo2.png";

const DEFAULT_TERMS = [
  "Our Company Is Registered Under Msme. Uam No",
  "If Any Discrepancy In The Invoice Please Inform Us Within Two Days After That It Will Not Be Accepted.",
  "The Laws Applicable To This Contract Shall Be The Law In Force In India. The Courts Of New Delhi Shall Have Exclusive Jurisdiction In All Matters Arising Under This Contract.",
  'Payments Should Be Made Through Cheque/Dd. In Favour "Speed Setu Logistics Pvt Ltd "',
  "Payment After Due Date Will Attract Interest @ 2% Or Part Of The Month",
];

export const InvoicePrintView = ({ invoice, defaultTaxType }) => {
  if (!invoice) return null;

  // Supplier Details
  const supplier = invoice.supplierDetails || {};
  const supplierName =
    supplier.companyName || "SPEEDSETU LOGISTICS PRIVATE LIMITED";
  const supplierLogo = supplier.logoUrl || logoImg;
  const supplierAddr1 = supplier.addressLine1 || "Haripur, BHIWANI,";
  const supplierAddr2 =
    supplier.addressLine2 || "Haripur, Bhiwani, Bhiwani, Haryana, 127021";
  const supplierGstin = supplier.gstin || "06ABSCS1710K1Z4";
  const supplierPhone = supplier.phone || "";
  const supplierEmail = supplier.email || "";
  const supplierPan = supplier.pan || "";

  // Extract client company billing profile details with full fallbacks
  const billTo = invoice.billToDetails || invoice.billTo || {};
  const rawCompanyName =
    billTo.companyName ||
    invoice.companyBilling?.companyName ||
    invoice.companyBilling?.registeredName ||
    invoice.billing?.companyName ||
    invoice.company?.billing?.companyName ||
    invoice.companyName ||
    invoice.company?.companyName ||
    "N/A";

  const rawAddrLine1 =
    (billTo.address && billTo.address.trim()) ||
    (invoice.companyAddress && invoice.companyAddress.trim()) ||
    (invoice.address && invoice.address.trim()) ||
    invoice.companyBilling?.address ||
    invoice.billing?.address ||
    invoice.company?.billing?.address ||
    invoice.shipment?.consignor?.address ||
    "";

  const rawAddrLine2 =
    billTo.addressLine2 ||
    invoice.companyBilling?.addressLine2 ||
    invoice.billing?.addressLine2 ||
    invoice.company?.billing?.addressLine2 ||
    "";

  const isAddrLine1LegalName =
    /\b(pvt|private|ltd|limited|inc|corp|corporation)\b/i.test(rawAddrLine1) ||
    (rawAddrLine1.length > 5 &&
      rawAddrLine1.toUpperCase() === rawAddrLine1 &&
      !/\d/.test(rawAddrLine1));

  let displayCompanyName = rawCompanyName;
  let displayAddress = [rawAddrLine1, rawAddrLine2].filter(Boolean).join(", ");

  if (
    isAddrLine1LegalName &&
    rawAddrLine1.trim().toUpperCase() !== rawCompanyName.trim().toUpperCase()
  ) {
    displayCompanyName = rawAddrLine1.trim();
    displayAddress = rawAddrLine2 ? rawAddrLine2.trim() : "";
  }

  const companyGstin =
    (billTo.gstin && billTo.gstin.trim()) ||
    (invoice.companyGstin && invoice.companyGstin.trim()) ||
    (invoice.gstin && invoice.gstin.trim()) ||
    invoice.companyBilling?.gstin ||
    invoice.billing?.gstin ||
    invoice.company?.gstin ||
    invoice.company?.billing?.gstin ||
    invoice.shipment?.consignor?.gstin ||
    "";

  const rawCity =
    (billTo.city && billTo.city.trim()) ||
    (invoice.city && invoice.city.trim()) ||
    invoice.companyBilling?.city ||
    invoice.billing?.city ||
    invoice.company?.billing?.city ||
    invoice.shipment?.consignor?.city ||
    "";

  const rawState =
    (billTo.state && billTo.state.trim()) ||
    (invoice.state && invoice.state.trim()) ||
    invoice.companyBilling?.state ||
    invoice.billing?.state ||
    invoice.company?.billing?.state ||
    invoice.shipment?.consignor?.state ||
    "";

  const rawPinCode =
    (billTo.pinCode && billTo.pinCode.trim()) ||
    (invoice.pinCode && invoice.pinCode.trim()) ||
    invoice.companyBilling?.pinCode ||
    invoice.billing?.pinCode ||
    invoice.company?.billing?.pinCode ||
    invoice.shipment?.consignor?.pin ||
    "";

  // Determine if GST is charged or exempt
  const isInitiallyGstExempt =
    invoice.taxMode === "no_gst" ||
    invoice.isGstExempt === true ||
    invoice.gstRate === 0 ||
    (invoice.gstAmount === 0 &&
      !invoice.cgst &&
      !invoice.sgst &&
      !invoice.igst &&
      !invoice.taxAmount);

  const initialTaxMode =
    invoice.taxMode ||
    defaultTaxType ||
    (isInitiallyGstExempt ? "no_gst" : "charging_gst");
  const [taxMode, setTaxMode] = useState(initialTaxMode);

  const isChargingGst = invoice.taxMode
    ? invoice.taxMode === "charging_gst"
    : taxMode === "charging_gst";
  const useDeliveryDate =
    invoice.is3PL === true ||
    invoice.useDeliveryDate === true ||
    invoice.companyBilling?.is3PL === true;

  // Transport details — use shipment/invoice mode directly, never default silently to TRAIN
  const transport = invoice.transportDetails || {};
  const docketMode = (invoice.dockets || []).map((d) => d?.freightMode || d?.mode).filter(Boolean).join(" / ");
  const rawMode =
    (transport.mode && transport.mode.trim()) ||
    (invoice.mode && invoice.mode.trim()) ||
    (invoice.billingSnapshot?.mode && invoice.billingSnapshot.mode.trim()) ||
    resolveShipmentFreightMode(invoice.shipment) ||
    docketMode ||
    "";
  const transportMode = rawMode || "NOT SPECIFIED";
  const hsnCode =
    transport.hsnCode ||
    invoice.hsnCode ||
    invoice.billingSnapshot?.hsnCode ||
    (isChargingGst ? "996531" : "NA");
  const vehicleNo = transport.vehicleNo || invoice.vehicleNo || "";
  const grNo = transport.grNo || invoice.grNo || "";

  // Build dockets breakdown list
  let dockets = [];

  if (
    invoice.dockets &&
    Array.isArray(invoice.dockets) &&
    invoice.dockets.length > 0
  ) {
    dockets = invoice.dockets.map((d) => {
      const taxable =
        typeof d.taxableAmount === "number" ? d.taxableAmount : d.freight || 0;
      const isInterState =
        d.origin &&
        d.destination &&
        d.origin.toLowerCase().trim() !== d.destination.toLowerCase().trim();
      const gstRate = invoice.gstRate || 18;

      let pickupCharges =
        typeof d.pickupCharges === "number"
          ? d.pickupCharges
          : parseFloat(d.pickupCharges || 0);
      let deliveryCharges =
        typeof d.deliveryCharges === "number"
          ? d.deliveryCharges
          : parseFloat(d.deliveryCharges || 0);

      let cgst = typeof d.cgst === "number" ? d.cgst : 0;
      let sgst = typeof d.sgst === "number" ? d.sgst : 0;
      let igst = typeof d.igst === "number" ? d.igst : 0;

      if (isChargingGst) {
        if (cgst > 0 || sgst > 0 || igst > 0) {
          // keep explicit values
        } else if (isInterState) {
          igst = Math.round(taxable * (gstRate / 100));
        } else {
          cgst = Math.round(taxable * (gstRate / 200));
          sgst = Math.round(taxable * (gstRate / 200));
        }
      } else {
        cgst = 0;
        sgst = 0;
        igst = 0;
      }

      const totalVal =
        typeof d.totalInvoiceValue === "number" && d.totalInvoiceValue > 0
          ? d.totalInvoiceValue
          : isChargingGst
            ? taxable + cgst + sgst + igst
            : taxable;

      return {
        ...d,
        pickupCharges,
        deliveryCharges,
        cgst,
        sgst,
        igst,
        taxableAmount: taxable,
        totalInvoiceValue: totalVal,
      };
    });
  } else if (
    invoice.lineItems &&
    Array.isArray(invoice.lineItems) &&
    invoice.lineItems.length > 0
  ) {
    const freightItem = invoice.lineItems.find((i) =>
      (i.name || i.description || "").toLowerCase().includes("freight"),
    );
    const docketItem = invoice.lineItems.find((i) =>
      (i.name || i.description || "").toLowerCase().includes("docket"),
    );
    const pickupItem = invoice.lineItems.find((i) =>
      (i.name || i.description || "").toLowerCase().includes("pickup"),
    );
    const deliveryItem = invoice.lineItems.find((i) =>
      (i.name || i.description || "").toLowerCase().includes("delivery"),
    );
    const packingItem = invoice.lineItems.find((i) =>
      (i.name || i.description || "").toLowerCase().includes("packing"),
    );
    const laborItem = invoice.lineItems.find(
      (i) =>
        (i.name || i.description || "").toLowerCase().includes("labor") ||
        (i.name || i.description || "").toLowerCase().includes("loading"),
    );
    const godownItem = invoice.lineItems.find(
      (i) =>
        (i.name || i.description || "").toLowerCase().includes("godown") ||
        (i.name || i.description || "").toLowerCase().includes("storage"),
    );

    const wt =
      freightItem?.weight || freightItem?.quantity || invoice.weight || 0;
    const rate = freightItem?.rate || godownItem?.rate || 0;
    const freightAmt = freightItem?.amount || 0;
    const docketAmt = docketItem?.amount || 0;
    const pickupAmt = pickupItem?.amount || 0;
    const deliveryAmt = deliveryItem?.amount || 0;
    const packingAmt = packingItem?.amount || 0;
    const laborAmt = laborItem?.amount || 0;
    const godownAmt = godownItem?.amount || 0;

    const taxable =
      invoice.subTotal ||
      invoice.taxableAmount ||
      freightAmt +
        docketAmt +
        pickupAmt +
        deliveryAmt +
        packingAmt +
        laborAmt +
        godownAmt;
    const gstRate = invoice.gstRate || 18;
    const gstAmt = isChargingGst
      ? invoice.gstAmount || Math.round(taxable * (gstRate / 100))
      : 0;
    const totalVal = taxable + gstAmt;

    dockets = [
      {
        slNo: 1,
        docketNo:
          invoice.cnNumber ||
          (invoice.cns && invoice.cns[0]) ||
          invoice.shipmentIds?.[0] ||
          "-",
        docketDate: formatDate(invoice.invoiceDate || invoice.createdAt),
        origin: invoice.shipment?.origin || invoice.origin || "-",
        destination:
          invoice.shipment?.destination || invoice.destination || "-",
        noPack:
          invoice.numberOfBoxes ||
          invoice.noOfBoxes ||
          invoice.boxes ||
          invoice.packages ||
          invoice.noPack ||
          invoice.shipment?.packages ||
          10,
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
        totalInvoiceValue: totalVal,
      },
    ];
  } else {
    const taxable = invoice.subTotal || invoice.taxableAmount || 0;
    const gstAmt = isChargingGst
      ? invoice.gstAmount || Math.round(taxable * 0.18)
      : 0;
    dockets = [
      {
        slNo: 1,
        docketNo: invoice.cnNumber || (invoice.cns && invoice.cns[0]) || "-",
        docketDate: formatDate(invoice.invoiceDate || invoice.createdAt),
        origin: invoice.origin || "-",
        destination: invoice.destination || "-",
        noPack:
          invoice.numberOfBoxes ||
          invoice.noOfBoxes ||
          invoice.boxes ||
          invoice.packages ||
          invoice.noPack ||
          10,
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
        totalInvoiceValue: taxable + gstAmt,
      },
    ];
  }

  // Sort dockets chronologically by date if slNo not already explicit
  const parseDateVal = (dStr) => {
    if (!dStr) return 0;
    const t = Date.parse(dStr);
    if (!isNaN(t)) return t;
    const parts = String(dStr)
      .trim()
      .split(/[\s\-\/]+/);
    if (parts.length === 3) {
      const months = {
        jan: 0,
        feb: 1,
        mar: 2,
        apr: 3,
        may: 4,
        jun: 5,
        jul: 6,
        aug: 7,
        sep: 8,
        oct: 9,
        nov: 10,
        dec: 11,
      };
      if (parts[0].length === 4) {
        return new Date(
          parseInt(parts[0]),
          parseInt(parts[1]) - 1,
          parseInt(parts[2]),
        ).getTime();
      }
      const day = parseInt(parts[0], 10);
      const month = isNaN(parts[1])
        ? months[parts[1].toLowerCase().slice(0, 3)]
        : parseInt(parts[1], 10) - 1;
      const year = parseInt(parts[2], 10);
      if (!isNaN(day) && month !== undefined && !isNaN(year)) {
        return new Date(year, month, day).getTime();
      }
    }
    return 0;
  };

  const hasExplicitOrder = dockets.every(
    (d) => typeof d.slNo === "number" && d.slNo > 0,
  );
  if (!hasExplicitOrder) {
    dockets = [...dockets]
      .sort((a, b) => {
        const timeA = parseDateVal(a.docketDate || a.cnDate || a.bookingDate);
        const timeB = parseDateVal(b.docketDate || b.cnDate || b.bookingDate);
        return timeA - timeB;
      })
      .map((d, idx) => ({ ...d, slNo: idx + 1 }));
  }

  // Calculate or retrieve totals
  const totalPacksNum = dockets.reduce(
    (sum, d) => sum + (parseInt(String(d.noPack).replace(/\D+/g, ""), 10) || 0),
    0,
  );
  const displayTotalPacks =
    totalPacksNum > 0 ? totalPacksNum : dockets[0]?.noPack || "-";
  const calcTotalPacks = displayTotalPacks;
  const calcTotalWeight = dockets.reduce(
    (sum, d) => sum + (Number(d.weight) || 0),
    0,
  );
  const calcTotalFreight = dockets.reduce(
    (sum, d) => sum + (Number(d.freight) || 0),
    0,
  );
  const calcTotalDocketCharges = dockets.reduce(
    (sum, d) => sum + (Number(d.docketCharges) || 0),
    0,
  );
  const calcTotalPickupCharges = dockets.reduce(
    (sum, d) => sum + (Number(d.pickupCharges) || 0),
    0,
  );
  const calcTotalDeliveryCharges = dockets.reduce(
    (sum, d) => sum + (Number(d.deliveryCharges) || 0),
    0,
  );
  const calcTotalPackingCharges = dockets.reduce(
    (sum, d) => sum + (Number(d.packingCharges || d.packing) || 0),
    0,
  );
  const calcTotalLaborCharges = dockets.reduce(
    (sum, d) => sum + (Number(d.laborCharges || d.labor) || 0),
    0,
  );
  const calcTotalGodownCharges = dockets.reduce(
    (sum, d) => sum + (Number(d.godownCharges || d.godown) || 0),
    0,
  );

  const calcTotalOtherCharges = dockets.reduce((sum, d) => {
    const other = Number(d.otherCharges) || 0;
    const aggregated =
      (Number(d.packingCharges) || 0) +
      (Number(d.laborCharges) || 0) +
      (Number(d.godownCharges) || 0);
    return sum + (other > 0 ? other : aggregated);
  }, 0);

  const calcTotalTaxable = dockets.reduce(
    (sum, d) => sum + (Number(d.taxableAmount) || 0),
    0,
  );
  const calcTotalCGST = isChargingGst
    ? dockets.reduce((sum, d) => sum + (Number(d.cgst) || 0), 0)
    : 0;
  const calcTotalSGST = isChargingGst
    ? dockets.reduce((sum, d) => sum + (Number(d.sgst) || 0), 0)
    : 0;
  const calcTotalIGST = isChargingGst
    ? dockets.reduce((sum, d) => sum + (Number(d.igst) || 0), 0)
    : 0;
  const calcGrandTotal = isChargingGst
    ? calcTotalTaxable + calcTotalCGST + calcTotalSGST + calcTotalIGST
    : calcTotalTaxable;

  // Use manual override values if explicitly flagged
  const isOverride = invoice.totals?.manualOverride === true;
  const totals = invoice.totals || {};

  const totalPacks =
    isOverride && totals.totalPackages !== undefined
      ? totals.totalPackages
      : calcTotalPacks;
  const totalWeight =
    isOverride && typeof totals.totalWeight === "number"
      ? totals.totalWeight
      : calcTotalWeight;
  const totalFreight =
    isOverride && typeof totals.totalFreight === "number"
      ? totals.totalFreight
      : calcTotalFreight;
  const totalDocketCharges =
    isOverride && typeof totals.totalDocketCharges === "number"
      ? totals.totalDocketCharges
      : calcTotalDocketCharges;
  const totalPickupCharges =
    isOverride && typeof totals.totalPickupCharges === "number"
      ? totals.totalPickupCharges
      : calcTotalPickupCharges;
  const totalDeliveryCharges =
    isOverride && typeof totals.totalDeliveryCharges === "number"
      ? totals.totalDeliveryCharges
      : calcTotalDeliveryCharges;
  const totalPackingCharges =
    isOverride && typeof totals.totalPackingCharges === "number"
      ? totals.totalPackingCharges
      : calcTotalPackingCharges;
  const totalLaborCharges =
    isOverride && typeof totals.totalLaborCharges === "number"
      ? totals.totalLaborCharges
      : calcTotalLaborCharges;
  const totalGodownCharges =
    isOverride && typeof totals.totalGodownCharges === "number"
      ? totals.totalGodownCharges
      : calcTotalGodownCharges;
  const totalOtherCharges =
    isOverride && typeof totals.totalOtherCharges === "number"
      ? totals.totalOtherCharges
      : calcTotalOtherCharges;
  const totalTaxable =
    isOverride && typeof totals.totalTaxableAmount === "number"
      ? totals.totalTaxableAmount
      : calcTotalTaxable;
  const totalCGST = isChargingGst
    ? isOverride && typeof totals.totalCgst === "number"
      ? totals.totalCgst
      : calcTotalCGST
    : 0;
  const totalSGST = isChargingGst
    ? isOverride && typeof totals.totalSgst === "number"
      ? totals.totalSgst
      : calcTotalSGST
    : 0;
  const totalIGST = isChargingGst
    ? isOverride && typeof totals.totalIgst === "number"
      ? totals.totalIgst
      : calcTotalIGST
    : 0;
  const grandTotalValue =
    isOverride && typeof totals.grandTotal === "number"
      ? totals.grandTotal
      : calcGrandTotal;

  // Minimum table rows for nice A4 presentation
  const MIN_TABLE_ROWS = 14;
  const emptyRowsCount = Math.max(0, MIN_TABLE_ROWS - dockets.length);
  const emptyRows = Array.from({ length: emptyRowsCount }, () => ({
    isEmptyRow: true,
  }));
  const displayDockets = [...dockets, ...emptyRows];

  // Terms & Conditions
  const termsList =
    Array.isArray(invoice.termsAndConditions) &&
    invoice.termsAndConditions.length > 0
      ? invoice.termsAndConditions
      : DEFAULT_TERMS;

  // Bank Information
  const bank = invoice.bankDetails || {};
  const bankName = bank.bankName || "HDFC BANK LTD";
  const accountHolder =
    bank.accountHolder || "SPEEDSETU LOGISTICS PRIVATE LIMITED";
  const accountNumber = bank.accountNumber || "50200118714271";
  const ifscCode = bank.ifscCode || "HDFC0000479";
  const branchName = bank.branchName || "MEHAM GATE, BHIWANI";
  const bankIcon = bank.icon || "🏛️";
  const upiId = bank.upiId || "";

  // Signatory & Footer
  const signatory = invoice.signatory || {};
  const signatoryName = signatory.name || "Authorised Signatory";
  const signatoryDesignation = signatory.designation || "";
  const signatureUrl = signatory.signatureUrl || "";
  const footerNotes = signatory.footerNotes || "";

  return (
    <div
      id="printable-invoice"
      className="bg-white text-slate-900 font-sans p-3 sm:p-5 w-full max-w-7xl mx-auto space-y-2.5 print:space-y-2 print:p-0 print:m-0 print:max-w-none text-xs"
    >
      {/* PRINT-SPECIFIC CSS RULES INJECTED FOR MULTI-PAGE PRECISION */}
      <style>{`
        @media print {
          @page {
            size: A4;
            margin: 8mm 8mm 8mm 8mm;
          }
          body {
            -webkit-print-color-adjust: exact !important;
            print-color-adjust: exact !important;
          }
          .no-print {
            display: none !important;
          }
          table {
            page-break-inside: auto;
          }
          tr {
            page-break-inside: avoid;
            page-break-after: auto;
          }
          thead {
            display: table-header-group;
          }
          tfoot {
            display: table-footer-group;
          }
        }
      `}</style>

      {/* TAX INVOICE HEADER TITLE */}
      <div className="text-center font-extrabold text-sm uppercase tracking-wider py-0.5 print:py-0.5 print:text-xs">
        TAX INVOICE
      </div>

      {/* TOP HEADER 3-BOX GRID STRUCTURE */}
      <div className="grid grid-cols-12 border border-black text-[10px] print:text-[9px] leading-tight">
        {/* BOX 1: SUPPLIER */}
        <div className="col-span-5 p-2 print:p-2 border-r border-black space-y-0.5">
          <div className="flex items-center gap-1.5 mb-0.5">
            {supplierLogo ? (
              <img
                src={supplierLogo}
                alt="Logo"
                className="h-8 print:h-8 w-auto object-contain shrink-0"
                style={{ imageRendering: "high-quality" }}
                onError={(e) => {
                  e.target.style.display = "none";
                }}
              />
            ) : null}
            <div className="font-extrabold text-[9px] print:text-[8.5px] uppercase text-black">
              SUPPLIER
            </div>
          </div>
          <div className="font-extrabold text-[11px] print:text-[10px]">
            {supplierName}
          </div>
          <div>{supplierAddr1}</div>
          <div>{supplierAddr2}</div>
          <div className="pt-1 font-bold font-mono">GST - {supplierGstin}</div>
          {(supplierPhone || supplierEmail) && (
            <div className="text-[9px] text-slate-700">
              {supplierPhone ? `Ph: ${supplierPhone}` : ""}{" "}
              {supplierEmail ? `| Email: ${supplierEmail}` : ""}
            </div>
          )}
          {supplierPan && (
            <div className="text-[9px] font-mono font-medium">
              PAN: {supplierPan}
            </div>
          )}
        </div>

        {/* BOX 2: BILL TO */}
        <div className="col-span-4 p-2 print:p-2 border-r border-black space-y-0.5">
          <div className="font-extrabold text-[9px] print:text-[8.5px] uppercase text-black">
            BILL TO
          </div>
          <div className="font-extrabold text-[11px] print:text-[10px]">
            {displayCompanyName}
          </div>
          {displayAddress && (
            <div className="text-[9.5px] print:text-[8.5px] leading-tight">
              {displayAddress}
            </div>
          )}
          {(rawCity || rawState || rawPinCode) && (
            <div className="text-[9.5px] print:text-[8.5px] leading-tight font-medium">
              {[rawCity, rawState].filter(Boolean).join(", ")}{" "}
              {rawPinCode ? `- ${rawPinCode}` : ""}
            </div>
          )}
          <div className="pt-1 font-bold font-mono">
            {isChargingGst
              ? companyGstin && companyGstin.trim() !== ""
                ? `GST - ${companyGstin}`
                : "GST - Unregistered"
              : "GST - N/A (Exempt / Unregistered)"}
          </div>
          {(billTo.phone || billTo.email) && (
            <div className="text-[9px] text-slate-700 pt-0.5">
              {billTo.phone ? `Ph: ${billTo.phone}` : ""}{" "}
              {billTo.email ? `| ${billTo.email}` : ""}
            </div>
          )}
        </div>

        {/* BOX 3: INVOICE NUMBER & DATE */}
        <div className="col-span-3 p-2 print:p-2 flex flex-col justify-between text-center">
          <div>
            <div className="font-extrabold text-[9px] print:text-[8.5px] uppercase text-black">
              INVOICE NUMBER
            </div>
            <div className="font-extrabold text-xs print:text-[10.5px] font-mono py-0.5">
              {invoice.invoiceNumber || "-"}
            </div>
          </div>

          <div className="border-t border-black pt-1">
            <div className="font-extrabold text-[9px] print:text-[8.5px] uppercase text-black">
              INVOICE DATE
            </div>
            <div className="font-bold text-[11px] print:text-[10px] font-mono">
              {formatDate(invoice.invoiceDate || invoice.createdAt)}
            </div>
            {invoice.dueDate && (
              <div className="text-[9px] text-slate-600 font-mono mt-0.5">
                Due: {formatDate(invoice.dueDate)}
              </div>
            )}
          </div>
        </div>
      </div>

      {/* SUB-HEADER BAR: MODE, HSN CODE, VEHICLE NO, GR/LR */}
      <div className="grid grid-cols-2 sm:grid-cols-4 border border-black text-center font-bold text-xs print:text-[9.5px] divide-x divide-black">
        <div className="p-1 print:p-1">
          MODE:{" "}
          <span className="font-extrabold uppercase">{transportMode}</span>
        </div>
        <div className="p-1 print:p-1">
          HSN CODE:{" "}
          <span className="font-mono font-extrabold">
            {isChargingGst ? hsnCode : "NA"}
          </span>
        </div>
        <div className="p-1 print:p-1">
          VEHICLE NO:{" "}
          <span className="font-mono font-extrabold uppercase">
            {vehicleNo || "NA"}
          </span>
        </div>
        <div className="p-1 print:p-1">
          GR/LR NO:{" "}
          <span className="font-mono font-extrabold">
            {grNo || (invoice.cns && invoice.cns[0]) || "NA"}
          </span>
        </div>
      </div>

      {/* DOCKET BREAKDOWN TABLE - DYNAMICALLY RENDERED BASED ON GST CHARGE TYPE */}
      {!isChargingGst ? (
        /* ==================== LAYOUT 1: NO GST CHARGED ==================== */
        <div className="border border-black w-full overflow-x-auto print:overflow-visible">
          <table className="w-full text-center border-collapse text-[8px] sm:text-[8.5px] print:text-[7.5px] leading-tight print:leading-[1.15] table-auto">
            <thead className="bg-slate-100 font-extrabold uppercase border-b border-black">
              <tr className="divide-x divide-black">
                <th className="px-1 py-0.5 print:py-0.5 print:px-[1px]">
                  SL. NO.
                </th>
                <th className="px-1 py-0.5 print:py-0.5 print:px-[1px]">
                  DOCKET NO.
                </th>
                <th className="px-1 py-0.5 print:py-0.5 print:px-[1px]">
                  {useDeliveryDate ? "DELIVERY DATE" : "DOCKET DATE"}
                </th>
                <th className="px-1 py-0.5 print:py-0.5 print:px-[1px]">
                  ORIGIN
                </th>
                <th className="px-1 py-0.5 print:py-0.5 print:px-[1px]">
                  DESTINATION
                </th>
                <th className="px-1 py-0.5 print:py-0.5 print:px-[1px]">
                  NO. OF BOXES
                </th>
                <th className="px-1 py-0.5 print:py-0.5 print:px-[1px]">
                  WEIGHT
                </th>
                <th className="px-1 py-0.5 print:py-0.5 print:px-[1px]">
                  RATE
                </th>
                <th className="px-1 py-0.5 print:py-0.5 print:px-[1px]">
                  FREIGHT
                </th>
                <th className="px-1 py-0.5 print:py-0.5 print:px-[1px]">
                  PICKUP CHARGES
                </th>
                <th className="px-1 py-0.5 print:py-0.5 print:px-[1px]">
                  DELIVERY CHARGES
                </th>
                <th className="px-1 py-0.5 print:py-0.5 print:px-[1px]">
                  PACKING CHARGES
                </th>
                <th className="px-1 py-0.5 print:py-0.5 print:px-[1px]">
                  LABOR CHARGES
                </th>
                <th className="px-1 py-0.5 print:py-0.5 print:px-[1px]">
                  STORAGE RATE / MO
                </th>
                <th className="px-1 py-0.5 print:py-0.5 print:px-[1px]">
                  NO. OF MONTHS
                </th>
                <th className="px-1 py-0.5 print:py-0.5 print:px-[1px]">
                  GODOWN CHARGES
                </th>
                <th className="px-1 py-0.5 print:py-0.5 print:px-[1px]">
                  TAXABLE AMOUNT
                </th>
                <th className="px-1 py-0.5 print:py-0.5 print:px-[1px]">
                  IGST
                </th>
                <th className="px-1 py-0.5 print:py-0.5 print:px-[1px] whitespace-nowrap">
                  TOTAL
                </th>
              </tr>
            </thead>
            <tbody className="divide-y divide-black font-medium">
              {displayDockets.map((d, idx) => {
                if (d.isEmptyRow) {
                  return (
                    <tr
                      key={`empty-${idx}`}
                      className="divide-x divide-black h-5 print:h-5"
                    >
                      <td className="px-1 py-0.5 print:py-0.5">&nbsp;</td>
                      <td className="px-1 py-0.5 print:py-0.5">&nbsp;</td>
                      <td className="px-1 py-0.5 print:py-0.5">&nbsp;</td>
                      <td className="px-1 py-0.5 print:py-0.5">&nbsp;</td>
                      <td className="px-1 py-0.5 print:py-0.5">&nbsp;</td>
                      <td className="px-1 py-0.5 print:py-0.5">&nbsp;</td>
                      <td className="px-1 py-0.5 print:py-0.5">&nbsp;</td>
                      <td className="px-1 py-0.5 print:py-0.5">&nbsp;</td>
                      <td className="px-1 py-0.5 print:py-0.5">&nbsp;</td>
                      <td className="px-1 py-0.5 print:py-0.5">&nbsp;</td>
                      <td className="px-1 py-0.5 print:py-0.5">&nbsp;</td>
                      <td className="px-1 py-0.5 print:py-0.5">&nbsp;</td>
                      <td className="px-1 py-0.5 print:py-0.5">&nbsp;</td>
                      <td className="px-1 py-0.5 print:py-0.5">&nbsp;</td>
                      <td className="px-1 py-0.5 print:py-0.5">&nbsp;</td>
                      <td className="px-1 py-0.5 print:py-0.5">&nbsp;</td>
                      <td className="px-1 py-0.5 print:py-0.5">&nbsp;</td>
                      <td className="px-1 py-0.5 print:py-0.5">&nbsp;</td>
                      <td className="px-1 py-0.5 print:py-0.5">&nbsp;</td>
                    </tr>
                  );
                }

                return (
                  <tr
                    key={idx}
                    className="divide-x divide-black hover:bg-slate-50"
                  >
                    <td className="px-1 py-0.5 print:py-0.5 print:px-[1px] font-mono">
                      {d.slNo || idx + 1}
                    </td>
                    <td className="px-1 py-0.5 print:py-0.5 print:px-[1px] font-bold font-mono whitespace-nowrap">
                      {d.docketNo || "-"}
                    </td>
                    <td className="px-1 py-0.5 print:py-0.5 print:px-[1px] font-mono whitespace-nowrap">
                      {d.docketDate || "-"}
                    </td>
                    <td className="px-1 py-0.5 print:py-0.5 print:px-[1px] uppercase">
                      {d.origin || "-"}
                    </td>
                    <td className="px-1 py-0.5 print:py-0.5 print:px-[1px] uppercase">
                      {d.destination || "-"}
                    </td>
                    <td className="px-1 py-0.5 print:py-0.5 print:px-[1px] font-mono">
                      {d.noPack || 1}
                    </td>
                    <td className="px-1 py-0.5 print:py-0.5 print:px-[1px] font-mono">
                      {d.weight > 0 ? d.weight : "-"}
                    </td>
                    <td className="px-1 py-0.5 print:py-0.5 print:px-[1px] font-mono whitespace-nowrap">
                      ₹{(d.rate || 0).toLocaleString("en-IN")}
                      {normalizeRateBasis(d.rateBasis || invoice.billingSnapshot?.rateBasis) === "PER_SHIPMENT" ? " / Shp" : ""}
                    </td>
                    <td className="px-1 py-0.5 print:py-0.5 print:px-[1px] font-mono whitespace-nowrap">
                      ₹{(d.freight || 0).toLocaleString("en-IN")}
                    </td>
                    <td className="px-1 py-0.5 print:py-0.5 print:px-[1px] font-mono font-bold whitespace-nowrap">
                      {(d.pickupCharges || 0).toLocaleString("en-IN")}
                    </td>
                    <td className="px-1 py-0.5 print:py-0.5 print:px-[1px] font-mono whitespace-nowrap">
                      {(d.deliveryCharges || 0).toLocaleString("en-IN")}
                    </td>
                    <td className="px-1 py-0.5 print:py-0.5 print:px-[1px] font-mono font-bold whitespace-nowrap">
                      {(d.packingCharges || d.packing || 0).toLocaleString(
                        "en-IN",
                      )}
                    </td>
                    <td className="px-1 py-0.5 print:py-0.5 print:px-[1px] font-mono font-bold whitespace-nowrap">
                      {(d.laborCharges || d.labor || 0).toLocaleString("en-IN")}
                    </td>
                    <td className="px-1 py-0.5 print:py-0.5 print:px-[1px] font-mono font-bold whitespace-nowrap">
                      {(d.godownCharges || d.godown || 0) > 0
                        ? `₹${(d.godownRatePerMonth || (d.godownMonths > 0 ? Math.round((d.godownCharges || d.godown || 0) / d.godownMonths) : d.godownCharges || d.godown || 0)).toLocaleString("en-IN")}`
                        : "₹0"}
                    </td>
                    <td className="px-1 py-0.5 print:py-0.5 print:px-[1px] font-mono font-bold whitespace-nowrap">
                      {(d.godownCharges || d.godown || 0) > 0
                        ? d.godownMonths
                          ? `${d.godownMonths} Months`
                          : d.godownDays
                            ? `${d.godownDays} Days`
                            : "1 Month"
                        : "-"}
                    </td>
                    <td className="px-1 py-0.5 print:py-0.5 print:px-[1px] font-mono font-bold whitespace-nowrap">
                      ₹
                      {(d.godownCharges || d.godown || 0).toLocaleString(
                        "en-IN",
                      )}
                    </td>
                    <td className="px-1 py-0.5 print:py-0.5 print:px-[1px] font-mono font-bold whitespace-nowrap">
                      {(d.taxableAmount || 0).toLocaleString("en-IN")}
                    </td>
                    <td className="px-1 py-0.5 print:py-0.5 print:px-[1px] font-mono font-bold whitespace-nowrap">
                      0
                    </td>
                    <td className="px-1 py-0.5 print:py-0.5 print:px-[1px] font-mono font-extrabold text-black whitespace-nowrap">
                      {(d.taxableAmount || 0).toLocaleString("en-IN")}
                    </td>
                  </tr>
                );
              })}
            </tbody>

            {/* SUMMARY TOTALS FOOTER ROW */}
            <tfoot className="border-t border-black font-extrabold bg-slate-50">
              <tr className="divide-x divide-black">
                <td
                  colSpan={5}
                  className="px-1 py-0.5 print:py-0.5 text-right uppercase"
                >
                  TOTAL:
                </td>
                <td className="px-1 py-0.5 print:py-0.5 font-mono">
                  {totalPacks}
                </td>
                <td className="px-1 py-0.5 print:py-0.5 font-mono">
                  {totalWeight > 0 ? totalWeight : "-"}
                </td>
                <td className="px-1 py-0.5 print:py-0.5"></td>
                <td className="px-1 py-0.5 print:py-0.5 font-mono whitespace-nowrap">
                  ₹{totalFreight.toLocaleString("en-IN")}
                </td>
                <td className="px-1 py-0.5 print:py-0.5 font-mono whitespace-nowrap">
                  {totalPickupCharges.toLocaleString("en-IN")}
                </td>
                <td className="px-1 py-0.5 print:py-0.5 font-mono whitespace-nowrap">
                  {totalDeliveryCharges.toLocaleString("en-IN")}
                </td>
                <td className="px-1 py-0.5 print:py-0.5 font-mono whitespace-nowrap">
                  ₹{totalPackingCharges.toLocaleString("en-IN")}
                </td>
                <td className="px-1 py-0.5 print:py-0.5 font-mono whitespace-nowrap">
                  ₹{totalLaborCharges.toLocaleString("en-IN")}
                </td>
                <td className="px-1 py-0.5 print:py-0.5"></td>
                <td className="px-1 py-0.5 print:py-0.5"></td>
                <td className="px-1 py-0.5 print:py-0.5 font-mono whitespace-nowrap">
                  ₹{totalGodownCharges.toLocaleString("en-IN")}
                </td>
                <td className="px-1 py-0.5 print:py-0.5 font-mono text-black whitespace-nowrap">
                  ₹{totalTaxable.toLocaleString("en-IN")}
                </td>
                <td className="px-1 py-0.5 print:py-0.5 font-mono text-black whitespace-nowrap">
                  ₹0
                </td>
                <td className="px-1 py-0.5 print:py-0.5 font-mono text-black whitespace-nowrap">
                  ₹{totalTaxable.toLocaleString("en-IN")}
                </td>
              </tr>
            </tfoot>
          </table>
        </div>
      ) : (
        /* ==================== LAYOUT 2: CHARGING GST ==================== */
        <div className="border border-black w-full overflow-x-auto print:overflow-visible">
          <table className="w-full text-center border-collapse text-[8px] sm:text-[8.5px] print:text-[7.5px] leading-tight print:leading-[1.15] table-auto">
            <thead className="bg-slate-100 font-extrabold uppercase border-b border-black">
              <tr className="divide-x divide-black">
                <th className="px-1 py-0.5 print:py-0.5 print:px-[1px]">
                  SL. NO.
                </th>
                <th className="px-1 py-0.5 print:py-0.5 print:px-[1px]">
                  DOCKET NO.
                </th>
                <th className="px-1 py-0.5 print:py-0.5 print:px-[1px]">
                  {useDeliveryDate ? "DELIVERY DATE" : "DOCKET DATE"}
                </th>
                <th className="px-1 py-0.5 print:py-0.5 print:px-[1px]">
                  ORIGIN
                </th>
                <th className="px-1 py-0.5 print:py-0.5 print:px-[1px]">
                  DESTINATION
                </th>
                <th className="px-1 py-0.5 print:py-0.5 print:px-[1px]">
                  NO. PACK
                </th>
                <th className="px-1 py-0.5 print:py-0.5 print:px-[1px]">
                  WEIGHT
                </th>
                <th className="px-1 py-0.5 print:py-0.5 print:px-[1px]">
                  RATE
                </th>
                <th className="px-1 py-0.5 print:py-0.5 print:px-[1px]">
                  FREIGHT
                </th>
                <th className="px-1 py-0.5 print:py-0.5 print:px-[1px]">
                  DOCKET CHARGES
                </th>
                <th className="px-1 py-0.5 print:py-0.5 print:px-[1px]">
                  PICKUP CHARGES
                </th>
                <th className="px-1 py-0.5 print:py-0.5 print:px-[1px]">
                  DELIVERY CHARGES
                </th>
                <th className="px-1 py-0.5 print:py-0.5 print:px-[1px]">
                  OTHER CHARGES
                </th>
                <th className="px-1 py-0.5 print:py-0.5 print:px-[1px]">
                  TAXABLE AMOUNT
                </th>
                <th className="px-1 py-0.5 print:py-0.5 print:px-[1px]">
                  CGST
                </th>
                <th className="px-1 py-0.5 print:py-0.5 print:px-[1px]">
                  SGST
                </th>
                <th className="px-1 py-0.5 print:py-0.5 print:px-[1px]">
                  IGST
                </th>
                <th className="px-1 py-0.5 print:py-0.5 print:px-[1px] whitespace-nowrap">
                  TOTAL INVOICE VALUE
                </th>
              </tr>
            </thead>
            <tbody className="divide-y divide-black font-medium">
              {displayDockets.map((d, idx) => {
                if (d.isEmptyRow) {
                  return (
                    <tr
                      key={`empty-${idx}`}
                      className="divide-x divide-black h-5 print:h-5"
                    >
                      <td className="px-1 py-0.5 print:py-0.5">&nbsp;</td>
                      <td className="px-1 py-0.5 print:py-0.5">&nbsp;</td>
                      <td className="px-1 py-0.5 print:py-0.5">&nbsp;</td>
                      <td className="px-1 py-0.5 print:py-0.5">&nbsp;</td>
                      <td className="px-1 py-0.5 print:py-0.5">&nbsp;</td>
                      <td className="px-1 py-0.5 print:py-0.5">&nbsp;</td>
                      <td className="px-1 py-0.5 print:py-0.5">&nbsp;</td>
                      <td className="px-1 py-0.5 print:py-0.5">&nbsp;</td>
                      <td className="px-1 py-0.5 print:py-0.5">&nbsp;</td>
                      <td className="px-1 py-0.5 print:py-0.5">&nbsp;</td>
                      <td className="px-1 py-0.5 print:py-0.5">&nbsp;</td>
                      <td className="px-1 py-0.5 print:py-0.5">&nbsp;</td>
                      <td className="px-1 py-0.5 print:py-0.5">&nbsp;</td>
                      <td className="px-1 py-0.5 print:py-0.5">&nbsp;</td>
                      <td className="px-1 py-0.5 print:py-0.5">&nbsp;</td>
                      <td className="px-1 py-0.5 print:py-0.5">&nbsp;</td>
                      <td className="px-1 py-0.5 print:py-0.5">&nbsp;</td>
                      <td className="px-1 py-0.5 print:py-0.5">&nbsp;</td>
                    </tr>
                  );
                }

                const other =
                  (Number(d.otherCharges) || 0) > 0
                    ? Number(d.otherCharges)
                    : (Number(d.packingCharges) || 0) +
                      (Number(d.laborCharges) || 0) +
                      (Number(d.godownCharges) || 0);

                return (
                  <tr
                    key={idx}
                    className="divide-x divide-black hover:bg-slate-50"
                  >
                    <td className="px-1 py-0.5 print:py-0.5 print:px-[1px] font-mono">
                      {d.slNo || idx + 1}
                    </td>
                    <td className="px-1 py-0.5 print:py-0.5 print:px-[1px] font-bold font-mono whitespace-nowrap">
                      {d.docketNo || "-"}
                    </td>
                    <td className="px-1 py-0.5 print:py-0.5 print:px-[1px] font-mono whitespace-nowrap">
                      {d.docketDate || "-"}
                    </td>
                    <td className="px-1 py-0.5 print:py-0.5 print:px-[1px] uppercase">
                      {d.origin || "-"}
                    </td>
                    <td className="px-1 py-0.5 print:py-0.5 print:px-[1px] uppercase">
                      {d.destination || "-"}
                    </td>
                    <td className="px-1 py-0.5 print:py-0.5 print:px-[1px] font-mono">
                      {d.noPack || 1}
                    </td>
                    <td className="px-1 py-0.5 print:py-0.5 print:px-[1px] font-mono">
                      {d.weight > 0 ? d.weight : "-"}
                    </td>
                    <td className="px-1 py-0.5 print:py-0.5 print:px-[1px] font-mono whitespace-nowrap">
                      ₹{(d.rate || 0).toLocaleString("en-IN")}
                      {normalizeRateBasis(d.rateBasis || invoice.billingSnapshot?.rateBasis) === "PER_SHIPMENT" ? " / Shp" : ""}
                    </td>
                    <td className="px-1 py-0.5 print:py-0.5 print:px-[1px] font-mono whitespace-nowrap">
                      ₹{(d.freight || 0).toLocaleString("en-IN")}
                    </td>
                    <td className="px-1 py-0.5 print:py-0.5 print:px-[1px] font-mono whitespace-nowrap">
                      {(d.docketCharges || 0).toLocaleString("en-IN")}
                    </td>
                    <td className="px-1 py-0.5 print:py-0.5 print:px-[1px] font-mono whitespace-nowrap">
                      {(d.pickupCharges || 0).toLocaleString("en-IN")}
                    </td>
                    <td className="px-1 py-0.5 print:py-0.5 print:px-[1px] font-mono whitespace-nowrap">
                      {(d.deliveryCharges || 0).toLocaleString("en-IN")}
                    </td>
                    <td className="px-1 py-0.5 print:py-0.5 print:px-[1px] font-mono whitespace-nowrap">
                      {other > 0 ? `₹${other.toLocaleString("en-IN")}` : "-"}
                    </td>
                    <td className="px-1 py-0.5 print:py-0.5 print:px-[1px] font-mono font-bold whitespace-nowrap">
                      {(d.taxableAmount || 0).toLocaleString("en-IN")}
                    </td>
                    <td className="px-1 py-0.5 print:py-0.5 print:px-[1px] font-mono whitespace-nowrap">
                      {d.cgst > 0 ? d.cgst.toLocaleString("en-IN") : "-"}
                    </td>
                    <td className="px-1 py-0.5 print:py-0.5 print:px-[1px] font-mono whitespace-nowrap">
                      {d.sgst > 0 ? d.sgst.toLocaleString("en-IN") : "-"}
                    </td>
                    <td className="px-1 py-0.5 print:py-0.5 print:px-[1px] font-mono font-bold whitespace-nowrap">
                      {d.igst > 0 ? d.igst.toLocaleString("en-IN") : "-"}
                    </td>
                    <td className="px-1 py-0.5 print:py-0.5 print:px-[1px] font-mono font-extrabold text-black whitespace-nowrap">
                      {(d.totalInvoiceValue || 0).toLocaleString("en-IN")}
                    </td>
                  </tr>
                );
              })}
            </tbody>

            {/* SUMMARY TOTALS FOOTER ROW */}
            <tfoot className="border-t border-black font-extrabold bg-slate-50">
              <tr className="divide-x divide-black">
                <td
                  colSpan={5}
                  className="px-1 py-0.5 print:py-0.5 text-right uppercase"
                >
                  TOTAL:
                </td>
                <td className="px-1 py-0.5 print:py-0.5 font-mono">
                  {totalPacks}
                </td>
                <td className="px-1 py-0.5 print:py-0.5 font-mono">
                  {totalWeight > 0 ? totalWeight : "-"}
                </td>
                <td className="px-1 py-0.5 print:py-0.5"></td>
                <td className="px-1 py-0.5 print:py-0.5 font-mono whitespace-nowrap">
                  ₹{totalFreight.toLocaleString("en-IN")}
                </td>
                <td className="px-1 py-0.5 print:py-0.5 font-mono whitespace-nowrap">
                  {totalDocketCharges.toLocaleString("en-IN")}
                </td>
                <td className="px-1 py-0.5 print:py-0.5 font-mono whitespace-nowrap">
                  {totalPickupCharges.toLocaleString("en-IN")}
                </td>
                <td className="px-1 py-0.5 print:py-0.5 font-mono whitespace-nowrap">
                  {totalDeliveryCharges.toLocaleString("en-IN")}
                </td>
                <td className="px-1 py-0.5 print:py-0.5 font-mono whitespace-nowrap">
                  {totalOtherCharges > 0
                    ? `₹${totalOtherCharges.toLocaleString("en-IN")}`
                    : "-"}
                </td>
                <td className="px-1 py-0.5 print:py-0.5 font-mono text-black whitespace-nowrap">
                  ₹{totalTaxable.toLocaleString("en-IN")}
                </td>
                <td className="px-1 py-0.5 print:py-0.5 font-mono whitespace-nowrap">
                  {totalCGST > 0
                    ? `₹${totalCGST.toLocaleString("en-IN")}`
                    : "-"}
                </td>
                <td className="px-1 py-0.5 print:py-0.5 font-mono whitespace-nowrap">
                  {totalSGST > 0
                    ? `₹${totalSGST.toLocaleString("en-IN")}`
                    : "-"}
                </td>
                <td className="px-1 py-0.5 print:py-0.5 font-mono text-black whitespace-nowrap">
                  {totalIGST > 0
                    ? `₹${totalIGST.toLocaleString("en-IN")}`
                    : "-"}
                </td>
                <td className="px-1 py-0.5 print:py-0.5 font-mono text-black whitespace-nowrap">
                  ₹{grandTotalValue.toLocaleString("en-IN")}
                </td>
              </tr>
            </tfoot>
          </table>
        </div>
      )}

      {/* TERMS & CONDITIONS BLOCK */}
      <div className="border border-black p-2 print:p-2 space-y-0.5 text-[9.5px] print:text-[8px] leading-tight">
        <div className="font-extrabold underline text-black">Terms :-</div>
        <ol className="list-decimal list-inside space-y-0.5 text-slate-800">
          {termsList.map((term, i) => (
            <li key={i}>{term}</li>
          ))}
        </ol>
      </div>

      {/* BANK DETAILS & AUTHORISED SIGNATORY GRID */}
      <div className="grid grid-cols-12 gap-2 text-[10px] print:text-[8.5px] pt-0.5 leading-tight items-stretch">
        {/* BANK ACCOUNT BOX */}
        <div className="col-span-7 border border-black p-2 print:p-2 flex items-center gap-3">
          <div className="p-1.5 border border-slate-300 rounded bg-slate-50 shrink-0">
            <span className="font-extrabold text-sm">{bankIcon}</span>
          </div>
          <div className="space-y-0.5 font-medium">
            <div>
              <strong className="text-black">Bank Name :</strong> {bankName}
            </div>
            <div>
              <strong className="text-black">Account Name :</strong>{" "}
              {accountHolder}
            </div>
            <div>
              <strong className="text-black">Account Number :</strong>{" "}
              {accountNumber}
            </div>
            <div>
              <strong className="text-black">IFSC Code :</strong> {ifscCode}
            </div>
            <div>
              <strong className="text-black">Branch :</strong> {branchName}
            </div>
            {upiId && (
              <div>
                <strong className="text-black">UPI ID :</strong> {upiId}
              </div>
            )}
          </div>
        </div>

        {/* SIGNATORY BOX */}
        <div className="col-span-5 border border-black p-2 print:p-2 flex flex-col justify-between text-center min-h-[75px] print:min-h-[70px]">
          <div className="flex-1 flex items-center justify-center">
            {signatureUrl ? (
              <img
                src={signatureUrl}
                alt="Signature"
                className="max-h-10 max-w-[140px] object-contain"
                onError={(e) => {
                  e.target.style.display = "none";
                }}
              />
            ) : (
              <div className="text-[9px] text-slate-400 italic">
                For {supplierName}
              </div>
            )}
          </div>
          <div>
            <div className="font-bold text-[9.5px] print:text-[8.5px] text-slate-900">
              {signatoryName}
            </div>
            {signatoryDesignation && (
              <div className="text-[8.5px] text-slate-600">
                {signatoryDesignation}
              </div>
            )}
            <div className="font-extrabold uppercase text-[9px] print:text-[8px] tracking-wider text-black pt-0.5 border-t border-slate-200 mt-0.5">
              AUTHORISED SIGNATORY
            </div>
          </div>
        </div>
      </div>

      {footerNotes && (
        <div className="text-center text-[8.5px] text-slate-500 italic pt-1 print:pt-0.5">
          {footerNotes}
        </div>
      )}
    </div>
  );
};
