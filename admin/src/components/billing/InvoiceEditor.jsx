import React, { useState, useEffect, useMemo, useRef } from "react";
import { formatINR, formatDate } from "../../utils/formatters";
import { InvoicePrintView } from "./InvoicePrintView";
import { companyService } from "../../services/companyService";
import { billingService } from "../../services/billingService";
import logoImg from "../../assets/logo2.png";
import {
  Save,
  X,
  RotateCcw,
  Plus,
  Trash2,
  Copy,
  ArrowUp,
  ArrowDown,
  Eye,
  EyeOff,
  AlertCircle,
  CheckCircle2,
  DollarSign,
  Truck,
  Building2,
  User,
  FileText,
  Settings,
  ShieldAlert,
  Upload,
  Printer,
  ChevronDown,
  ChevronUp,
  AlertTriangle,
} from "lucide-react";

const DEFAULT_TERMS = [
  "Our Company Is Registered Under Msme. Uam No",
  "If Any Discrepancy In The Invoice Please Inform Us Within Two Days After That It Will Not Be Accepted.",
  "The Laws Applicable To This Contract Shall Be The Law In Force In India. The Courts Of New Delhi Shall Have Exclusive Jurisdiction In All Matters Arising Under This Contract.",
  'Payments Should Be Made Through Cheque/Dd. In Favour "Speed Setu Logistics Pvt Ltd "',
  "Payment After Due Date Will Attract Interest @ 2% Or Part Of The Month",
];

const DEFAULT_SUPPLIER = {
  companyName: "SPEEDSETU LOGISTICS PRIVATE LIMITED",
  logoUrl: "",
  addressLine1: "Haripur, BHIWANI,",
  addressLine2: "Haripur, Bhiwani, Bhiwani, Haryana, 127021",
  gstin: "06ABSCS1710K1Z4",
  phone: "+91 98765 43210",
  email: "billing@speedsetu.com",
  pan: "ABSCS1710K",
};

const DEFAULT_BANK = {
  bankName: "HDFC BANK LTD",
  accountHolder: "SPEEDSETU LOGISTICS PRIVATE LIMITED",
  accountNumber: "50200118714271",
  ifscCode: "HDFC0000479",
  branchName: "MEHAM GATE, BHIWANI",
  icon: "🏛️",
  upiId: "",
};

export const InvoiceEditor = ({ initialInvoice, onSave, onCancel }) => {
  // Normalize initial form state
  const normalizeInitialState = (inv) => {
    const rawTaxMode =
      inv.taxMode ||
      (inv.isGstExempt === true ||
      inv.gstRate === 0 ||
      (inv.gstAmount === 0 && !inv.cgst && !inv.sgst && !inv.igst)
        ? "no_gst"
        : "charging_gst");

    let initDockets = [];
    if (inv.dockets && Array.isArray(inv.dockets) && inv.dockets.length > 0) {
      initDockets = inv.dockets.map((d, idx) => ({
        id: d.id || `docket-${Date.now()}-${idx}`,
        slNo: d.slNo || idx + 1,
        docketNo: d.docketNo || d.cnNumber || "",
        docketDate: d.docketDate || d.cnDate || inv.invoiceDate || "",
        origin: d.origin || "",
        destination: d.destination || "",
        noPack: d.noPack || d.numberOfBoxes || d.packages || 1,
        weight: Number(d.weight) || 0,
        rate: Number(d.rate) || 0,
        freight: Number(d.freight) || 0,
        docketCharges: Number(d.docketCharges) || 0,
        pickupCharges: Number(d.pickupCharges) || 0,
        deliveryCharges: Number(d.deliveryCharges) || 0,
        packingCharges: Number(d.packingCharges || d.packing) || 0,
        laborCharges: Number(d.laborCharges || d.labor) || 0,
        godownCharges: Number(d.godownCharges || d.godown) || 0,
        godownRatePerMonth: Number(d.godownRatePerMonth) || 0,
        godownMonths: Number(d.godownMonths) || 1,
        godownDays: Number(d.godownDays) || 0,
        otherCharges: Number(d.otherCharges) || 0,
        taxableAmount: Number(d.taxableAmount) || 0,
        cgst: Number(d.cgst) || 0,
        sgst: Number(d.sgst) || 0,
        igst: Number(d.igst) || 0,
        totalInvoiceValue: Number(d.totalInvoiceValue) || 0,
      }));
    } else {
      initDockets = [
        {
          id: `docket-${Date.now()}-0`,
          slNo: 1,
          docketNo: inv.cnNumber || (inv.cns && inv.cns[0]) || "",
          docketDate: inv.invoiceDate || "",
          origin: inv.origin || "",
          destination: inv.destination || "",
          noPack: inv.numberOfBoxes || inv.noPack || 1,
          weight: Number(inv.weight) || 0,
          rate: Number(inv.ratePerKg || inv.rate) || 0,
          freight: Number(inv.subTotal || inv.taxableAmount) || 0,
          docketCharges: 0,
          pickupCharges: 0,
          deliveryCharges: 0,
          packingCharges: 0,
          laborCharges: 0,
          godownCharges: 0,
          godownRatePerMonth: 0,
          godownMonths: 1,
          godownDays: 0,
          otherCharges: 0,
          taxableAmount: Number(inv.subTotal || inv.taxableAmount) || 0,
          cgst: 0,
          sgst: 0,
          igst: Number(inv.gstAmount) || 0,
          totalInvoiceValue: Number(inv.grandTotal || inv.totalAmount) || 0,
        },
      ];
    }

    return {
      invoiceNumber: inv.invoiceNumber || "",
      invoiceDate: inv.invoiceDate || new Date().toISOString().split("T")[0],
      dueDate: inv.dueDate || "",
      status: inv.status || "Draft",
      taxMode: rawTaxMode,
      gstRate: typeof inv.gstRate === "number" ? inv.gstRate : 18,
      notes: inv.notes || "",

      supplierDetails: {
        ...DEFAULT_SUPPLIER,
        ...(inv.supplierDetails || {}),
      },

      billToDetails: {
        companyId: inv.billToDetails?.companyId || inv.companyId || "",
        companyName: inv.billToDetails?.companyName || inv.companyName || "",
        address:
          inv.billToDetails?.address || inv.companyAddress || inv.address || "",
        addressLine2: inv.billToDetails?.addressLine2 || "",
        city: inv.billToDetails?.city || inv.city || "",
        state: inv.billToDetails?.state || inv.state || "",
        pinCode: inv.billToDetails?.pinCode || inv.pinCode || "",
        gstin: inv.billToDetails?.gstin || inv.companyGstin || inv.gstin || "",
        phone: inv.billToDetails?.phone || "",
        email: inv.billToDetails?.email || "",
      },

      transportDetails: {
        mode:
          inv.transportDetails?.mode ||
          inv.billingSnapshot?.mode ||
          inv.mode ||
          "TRAIN",
        hsnCode:
          inv.transportDetails?.hsnCode ||
          inv.hsnCode ||
          inv.billingSnapshot?.hsnCode ||
          "996531",
        vehicleNo: inv.transportDetails?.vehicleNo || inv.vehicleNo || "",
        driverName: inv.transportDetails?.driverName || "",
        driverPhone: inv.transportDetails?.driverPhone || "",
        grNo: inv.transportDetails?.grNo || (inv.cns && inv.cns[0]) || "",
        lrDate: inv.transportDetails?.lrDate || inv.invoiceDate || "",
        notes: inv.transportDetails?.notes || "",
      },

      dockets: initDockets,

      totals: {
        manualOverride: inv.totals?.manualOverride || false,
        overrideReason: inv.totals?.overrideReason || "",
        totalPackages: inv.totals?.totalPackages ?? "",
        totalWeight: inv.totals?.totalWeight ?? "",
        totalFreight: inv.totals?.totalFreight ?? "",
        totalDocketCharges: inv.totals?.totalDocketCharges ?? "",
        totalPickupCharges: inv.totals?.totalPickupCharges ?? "",
        totalDeliveryCharges: inv.totals?.totalDeliveryCharges ?? "",
        totalPackingCharges: inv.totals?.totalPackingCharges ?? "",
        totalLaborCharges: inv.totals?.totalLaborCharges ?? "",
        totalGodownCharges: inv.totals?.totalGodownCharges ?? "",
        totalOtherCharges: inv.totals?.totalOtherCharges ?? "",
        totalTaxableAmount: inv.totals?.totalTaxableAmount ?? "",
        totalCgst: inv.totals?.totalCgst ?? "",
        totalSgst: inv.totals?.totalSgst ?? "",
        totalIgst: inv.totals?.totalIgst ?? "",
        grandTotal: inv.totals?.grandTotal ?? "",
      },

      termsAndConditions:
        Array.isArray(inv.termsAndConditions) &&
        inv.termsAndConditions.length > 0
          ? [...inv.termsAndConditions]
          : [...DEFAULT_TERMS],

      bankDetails: {
        ...DEFAULT_BANK,
        ...(inv.bankDetails || {}),
      },

      signatory: {
        name: inv.signatory?.name || "Authorised Signatory",
        designation: inv.signatory?.designation || "Authorised Signatory",
        signatureUrl: inv.signatory?.signatureUrl || "",
        footerNotes:
          inv.signatory?.footerNotes ||
          "Subject to Bhiwani Jurisdiction. This is a computer-generated tax invoice.",
      },
    };
  };

  const [form, setForm] = useState(() => normalizeInitialState(initialInvoice));
  const [originalForm] = useState(() =>
    JSON.stringify(normalizeInitialState(initialInvoice)),
  );
  const [isDirty, setIsDirty] = useState(false);

  // Duplicate Validation States
  const [invoiceNumberError, setInvoiceNumberError] = useState(null);
  const [docketErrors, setDocketErrors] = useState({}); // { [rowIndex]: errorMessage }
  const [detailedDocketConflicts, setDetailedDocketConflicts] = useState([]); // [ { docketNo, conflictingInvoice, row, index, error } ]
  const [validatingDuplicates, setValidatingDuplicates] = useState(false);
  const [saveErrorBanner, setSaveErrorBanner] = useState("");

  // Column visibility for extra charges
  const [visibleColumns, setVisibleColumns] = useState({
    packing: false,
    labor: false,
    godown: false,
    docket: true,
    pickup: true,
    delivery: true,
    other: true,
  });

  // UI view mode: 'editor' | 'split' | 'preview'
  const [viewMode, setViewMode] = useState("split");
  const [companiesList, setCompaniesList] = useState([]);
  const [saving, setSaving] = useState(false);
  const [showCancelPrompt, setShowCancelPrompt] = useState(false);
  const [showPaidWarning, setShowPaidWarning] = useState(false);
  const [changeSummary, setChangeSummary] = useState("");

  const debounceTimerRef = useRef(null);

  // Load companies for customer picker
  useEffect(() => {
    companyService
      .getCompanies()
      .then((list) => setCompaniesList(list || []))
      .catch(() => setCompaniesList([]));
  }, []);

  // Check dirtiness
  useEffect(() => {
    const currentStr = JSON.stringify(form);
    setIsDirty(currentStr !== originalForm);
  }, [form, originalForm]);

  /**
   * Real-Time Duplicate Validation Engine
   * Validates both:
   * 1. Invoice Number (case-insensitive uniqueness excluding current invoice)
   * 2. Docket Numbers (internal duplicate within invoice + external duplicate in other active invoices)
   */
  const runDuplicateValidation = async (targetInvNum, currentDockets) => {
    // 1. Instant Synchronous Internal Duplicate Detection
    const internalErrors = {};
    const internalConflicts = [];
    const seenDockets = new Map();

    (currentDockets || []).forEach((d, idx) => {
      const raw = (d.docketNo || "").trim();
      if (!raw) return;
      const norm = raw.toLowerCase();
      if (seenDockets.has(norm)) {
        const firstIdx = seenDockets.get(norm);
        const errText = `Duplicate docket number in this invoice (row ${firstIdx + 1} and row ${idx + 1}).`;
        internalErrors[idx] = errText;
        internalConflicts.push({
          index: idx,
          row: idx + 1,
          docketNo: raw,
          conflictingInvoice: `This Invoice (Row ${firstIdx + 1})`,
          error: errText,
          type: "internal_duplicate",
        });
      } else {
        seenDockets.set(norm, idx);
      }
    });

    setDocketErrors({ ...internalErrors });
    setDetailedDocketConflicts(internalConflicts);

    // 2. Asynchronous Server / Database Duplicate Check
    setValidatingDuplicates(true);
    try {
      const res = await billingService.validateDuplicates({
        currentInvoiceId: initialInvoice.id || initialInvoice._id,
        currentInvoiceNumber: initialInvoice.invoiceNumber,
        invoiceNumber: targetInvNum,
        dockets: currentDockets,
      });

      if (res) {
        setInvoiceNumberError(res.invoiceNumberError || null);

        const mergedDocketErrors = { ...internalErrors };
        const externalConflicts = [];
        (res.docketErrors || []).forEach((err) => {
          mergedDocketErrors[err.index] = err.error;
          externalConflicts.push({
            index: err.index,
            row: err.row || err.index + 1,
            docketNo: err.docketNo,
            conflictingInvoice: err.conflictingInvoice || "Another Invoice",
            error: err.error,
            type: err.type || "external_duplicate",
          });
        });

        setDocketErrors(mergedDocketErrors);
        const allConflicts = [...internalConflicts, ...externalConflicts];
        setDetailedDocketConflicts(allConflicts);

        const hasAnyError = Boolean(
          res.invoiceNumberError || Object.keys(mergedDocketErrors).length > 0,
        );
        if (!hasAnyError) {
          setSaveErrorBanner("");
        }
        return {
          isValid: !hasAnyError,
          invoiceNumberError: res.invoiceNumberError,
          docketErrors: mergedDocketErrors,
          detailedConflicts: allConflicts,
        };
      }
    } catch (err) {
      console.warn("[Real-Time Duplicate Check Notice]:", err.message);
    } finally {
      setValidatingDuplicates(false);
    }

    return {
      isValid: Object.keys(internalErrors).length === 0,
      invoiceNumberError: null,
      docketErrors: internalErrors,
      detailedConflicts: internalConflicts,
    };
  };

  // Debounced auto-validation whenever invoiceNumber or dockets change
  useEffect(() => {
    if (debounceTimerRef.current) {
      clearTimeout(debounceTimerRef.current);
    }

    debounceTimerRef.current = setTimeout(() => {
      runDuplicateValidation(form.invoiceNumber, form.dockets);
    }, 350);

    return () => {
      if (debounceTimerRef.current) clearTimeout(debounceTimerRef.current);
    };
  }, [form.invoiceNumber, form.dockets]);

  // Recalculate row math helper
  const recalculateRow = (row, taxMode, gstRate) => {
    const wt = Number(row.weight) || 0;
    const rate = Number(row.rate) || 0;
    const freight =
      wt > 0 && rate > 0 ? Math.round(wt * rate) : Number(row.freight) || 0;

    const docketChg = Number(row.docketCharges) || 0;
    const pickupChg = Number(row.pickupCharges) || 0;
    const deliveryChg = Number(row.deliveryCharges) || 0;
    const packingChg = Number(row.packingCharges) || 0;
    const laborChg = Number(row.laborCharges) || 0;
    const godownChg = Number(row.godownCharges) || 0;
    const otherChg = Number(row.otherCharges) || 0;

    const extraAggregated = packingChg + laborChg + godownChg;
    const effectiveOther = otherChg > 0 ? otherChg : extraAggregated;

    const taxableAmount =
      freight + docketChg + pickupChg + deliveryChg + effectiveOther;

    let cgst = 0;
    let sgst = 0;
    let igst = 0;

    if (taxMode === "charging_gst") {
      const isInterState =
        row.origin &&
        row.destination &&
        row.origin.toLowerCase().trim() !==
          row.destination.toLowerCase().trim();
      const ratePct = Number(gstRate) || 18;

      if (isInterState) {
        igst = Math.round(taxableAmount * (ratePct / 100));
      } else {
        cgst = Math.round(taxableAmount * (ratePct / 200));
        sgst = Math.round(taxableAmount * (ratePct / 200));
      }
    }

    const totalInvoiceValue = taxableAmount + cgst + sgst + igst;

    return {
      ...row,
      freight,
      taxableAmount,
      cgst,
      sgst,
      igst,
      totalInvoiceValue,
    };
  };

  // Auto-calculated totals summary
  const calculatedTotals = useMemo(() => {
    const dockets = form.dockets;
    const totalPackages = dockets.reduce(
      (sum, d) =>
        sum + (parseInt(String(d.noPack).replace(/\D+/g, ""), 10) || 0),
      0,
    );
    const totalWeight = dockets.reduce(
      (sum, d) => sum + (Number(d.weight) || 0),
      0,
    );
    const totalFreight = dockets.reduce(
      (sum, d) => sum + (Number(d.freight) || 0),
      0,
    );
    const totalDocketCharges = dockets.reduce(
      (sum, d) => sum + (Number(d.docketCharges) || 0),
      0,
    );
    const totalPickupCharges = dockets.reduce(
      (sum, d) => sum + (Number(d.pickupCharges) || 0),
      0,
    );
    const totalDeliveryCharges = dockets.reduce(
      (sum, d) => sum + (Number(d.deliveryCharges) || 0),
      0,
    );
    const totalPackingCharges = dockets.reduce(
      (sum, d) => sum + (Number(d.packingCharges) || 0),
      0,
    );
    const totalLaborCharges = dockets.reduce(
      (sum, d) => sum + (Number(d.laborCharges) || 0),
      0,
    );
    const totalGodownCharges = dockets.reduce(
      (sum, d) => sum + (Number(d.godownCharges) || 0),
      0,
    );
    const totalOtherCharges = dockets.reduce(
      (sum, d) =>
        sum +
        (Number(d.otherCharges) ||
          (Number(d.packingCharges) || 0) +
            (Number(d.laborCharges) || 0) +
            (Number(d.godownCharges) || 0)),
      0,
    );
    const totalTaxableAmount = dockets.reduce(
      (sum, d) => sum + (Number(d.taxableAmount) || 0),
      0,
    );
    const totalCgst =
      form.taxMode === "charging_gst"
        ? dockets.reduce((sum, d) => sum + (Number(d.cgst) || 0), 0)
        : 0;
    const totalSgst =
      form.taxMode === "charging_gst"
        ? dockets.reduce((sum, d) => sum + (Number(d.sgst) || 0), 0)
        : 0;
    const totalIgst =
      form.taxMode === "charging_gst"
        ? dockets.reduce((sum, d) => sum + (Number(d.igst) || 0), 0)
        : 0;
    const grandTotal =
      form.taxMode === "charging_gst"
        ? totalTaxableAmount + totalCgst + totalSgst + totalIgst
        : totalTaxableAmount;

    return {
      totalPackages,
      totalWeight,
      totalFreight,
      totalDocketCharges,
      totalPickupCharges,
      totalDeliveryCharges,
      totalPackingCharges,
      totalLaborCharges,
      totalGodownCharges,
      totalOtherCharges,
      totalTaxableAmount,
      totalCgst,
      totalSgst,
      totalIgst,
      grandTotal,
    };
  }, [form.dockets, form.taxMode]);

  // Handle row field change
  const handleDocketChange = (index, field, value) => {
    const updated = [...form.dockets];
    const currentRow = { ...updated[index], [field]: value };
    updated[index] = recalculateRow(currentRow, form.taxMode, form.gstRate);
    setForm((prev) => ({ ...prev, dockets: updated }));
  };

  // Add new docket row
  const handleAddDocket = () => {
    const newSlNo = form.dockets.length + 1;
    const newRow = recalculateRow(
      {
        id: `docket-${Date.now()}-${newSlNo}`,
        slNo: newSlNo,
        docketNo: "",
        docketDate: form.invoiceDate,
        origin: form.dockets[0]?.origin || "",
        destination: form.dockets[0]?.destination || "",
        noPack: 1,
        weight: 0,
        rate: form.dockets[0]?.rate || 0,
        freight: 0,
        docketCharges: 0,
        pickupCharges: 0,
        deliveryCharges: 0,
        packingCharges: 0,
        laborCharges: 0,
        godownCharges: 0,
        otherCharges: 0,
        taxableAmount: 0,
        cgst: 0,
        sgst: 0,
        igst: 0,
        totalInvoiceValue: 0,
      },
      form.taxMode,
      form.gstRate,
    );

    setForm((prev) => ({ ...prev, dockets: [...prev.dockets, newRow] }));
  };

  // Duplicate docket row (clears docketNo to prompt user for new unique docket number)
  const handleDuplicateDocket = (index) => {
    const source = form.dockets[index];
    const duplicated = {
      ...source,
      id: `docket-${Date.now()}-dup`,
      slNo: form.dockets.length + 1,
      docketNo: "", // Blanked out so user enters the new unique docket number
    };
    setForm((prev) => ({ ...prev, dockets: [...prev.dockets, duplicated] }));
  };

  // Delete docket row
  const handleDeleteDocket = (index) => {
    if (form.dockets.length === 1) {
      alert("An invoice must have at least one docket row.");
      return;
    }
    const filtered = form.dockets
      .filter((_, i) => i !== index)
      .map((d, i) => ({ ...d, slNo: i + 1 }));
    setForm((prev) => ({ ...prev, dockets: filtered }));
  };

  // Reorder docket row
  const handleMoveDocket = (index, direction) => {
    const targetIndex = index + direction;
    if (targetIndex < 0 || targetIndex >= form.dockets.length) return;
    const reordered = [...form.dockets];
    const temp = reordered[index];
    reordered[index] = reordered[targetIndex];
    reordered[targetIndex] = temp;
    const withUpdatedSlNo = reordered.map((d, i) => ({ ...d, slNo: i + 1 }));
    setForm((prev) => ({ ...prev, dockets: withUpdatedSlNo }));
  };

  // Terms and conditions handlers
  const handleTermChange = (index, value) => {
    const updated = [...form.termsAndConditions];
    updated[index] = value;
    setForm((prev) => ({ ...prev, termsAndConditions: updated }));
  };

  const handleAddTerm = () => {
    setForm((prev) => ({
      ...prev,
      termsAndConditions: [
        ...prev.termsAndConditions,
        "New commercial term or payment condition.",
      ],
    }));
  };

  const handleDeleteTerm = (index) => {
    const updated = form.termsAndConditions.filter((_, i) => i !== index);
    setForm((prev) => ({ ...prev, termsAndConditions: updated }));
  };

  const handleMoveTerm = (index, direction) => {
    const target = index + direction;
    if (target < 0 || target >= form.termsAndConditions.length) return;
    const updated = [...form.termsAndConditions];
    const temp = updated[index];
    updated[index] = updated[target];
    updated[target] = temp;
    setForm((prev) => ({ ...prev, termsAndConditions: updated }));
  };

  // Customer dropdown select
  const handleSelectCustomer = (comp) => {
    if (!comp) return;
    setForm((prev) => ({
      ...prev,
      billToDetails: {
        ...prev.billToDetails,
        companyId: comp.id || comp.companyId || comp.companyCode || "",
        companyName: comp.companyName || "",
        address: comp.billing?.address || comp.address || "",
        addressLine2: comp.billing?.addressLine2 || "",
        city: comp.billing?.city || comp.city || "",
        state: comp.billing?.state || comp.state || "",
        pinCode: comp.billing?.pinCode || comp.pinCode || "",
        gstin: comp.billing?.gstin || comp.gstin || "",
        phone: comp.primaryContact?.phone || comp.phone || "",
        email:
          comp.billing?.billingEmail ||
          comp.primaryContact?.email ||
          comp.email ||
          "",
      },
    }));
  };

  // Handle file uploads (Logo / Signature)
  const handleImageUpload = (e, field) => {
    const file = e.target.files?.[0];
    if (!file) return;
    if (file.size > 2 * 1024 * 1024) {
      alert("Image file size must be less than 2MB.");
      return;
    }
    const reader = new FileReader();
    reader.onload = (event) => {
      const base64 = event.target?.result;
      if (field === "supplierLogo") {
        setForm((prev) => ({
          ...prev,
          supplierDetails: { ...prev.supplierDetails, logoUrl: base64 },
        }));
      } else if (field === "signature") {
        setForm((prev) => ({
          ...prev,
          signatory: { ...prev.signatory, signatureUrl: base64 },
        }));
      }
    };
    reader.readAsDataURL(file);
  };

  // Re-run tax recalculation when Tax Mode or GST Rate changes
  const handleTaxModeChange = (newMode) => {
    const updatedDockets = form.dockets.map((d) =>
      recalculateRow(d, newMode, form.gstRate),
    );
    setForm((prev) => ({
      ...prev,
      taxMode: newMode,
      dockets: updatedDockets,
    }));
  };

  const handleGstRateChange = (newRate) => {
    const r = parseFloat(newRate) || 0;
    const updatedDockets = form.dockets.map((d) =>
      recalculateRow(d, form.taxMode, r),
    );
    setForm((prev) => ({
      ...prev,
      gstRate: r,
      dockets: updatedDockets,
    }));
  };

  // Prepare full invoice object for live preview
  const liveInvoice = useMemo(() => {
    const finalTotals = form.totals.manualOverride
      ? {
          ...calculatedTotals,
          ...form.totals,
          manualOverride: true,
          totalPackages:
            form.totals.totalPackages !== ""
              ? form.totals.totalPackages
              : calculatedTotals.totalPackages,
          totalWeight:
            form.totals.totalWeight !== ""
              ? Number(form.totals.totalWeight)
              : calculatedTotals.totalWeight,
          totalFreight:
            form.totals.totalFreight !== ""
              ? Number(form.totals.totalFreight)
              : calculatedTotals.totalFreight,
          totalTaxableAmount:
            form.totals.totalTaxableAmount !== ""
              ? Number(form.totals.totalTaxableAmount)
              : calculatedTotals.totalTaxableAmount,
          totalCgst:
            form.totals.totalCgst !== ""
              ? Number(form.totals.totalCgst)
              : calculatedTotals.totalCgst,
          totalSgst:
            form.totals.totalSgst !== ""
              ? Number(form.totals.totalSgst)
              : calculatedTotals.totalSgst,
          totalIgst:
            form.totals.totalIgst !== ""
              ? Number(form.totals.totalIgst)
              : calculatedTotals.totalIgst,
          grandTotal:
            form.totals.grandTotal !== ""
              ? Number(form.totals.grandTotal)
              : calculatedTotals.grandTotal,
        }
      : {
          ...calculatedTotals,
          manualOverride: false,
        };

    return {
      ...initialInvoice,
      invoiceNumber: form.invoiceNumber,
      invoiceDate: form.invoiceDate,
      dueDate: form.dueDate,
      status: form.status,
      taxMode: form.taxMode,
      gstRate: form.gstRate,
      notes: form.notes,
      supplierDetails: form.supplierDetails,
      billToDetails: form.billToDetails,
      billTo: form.billToDetails,
      companyName: form.billToDetails.companyName,
      companyAddress: form.billToDetails.address,
      companyGstin: form.billToDetails.gstin,
      transportDetails: form.transportDetails,
      mode: form.transportDetails.mode,
      hsnCode: form.transportDetails.hsnCode,
      vehicleNo: form.transportDetails.vehicleNo,
      dockets: form.dockets,
      totals: finalTotals,
      taxableAmount: finalTotals.totalTaxableAmount,
      subtotal: finalTotals.totalTaxableAmount,
      gstAmount:
        (finalTotals.totalCgst || 0) +
        (finalTotals.totalSgst || 0) +
        (finalTotals.totalIgst || 0),
      grandTotal: finalTotals.grandTotal,
      totalAmount: finalTotals.grandTotal,
      termsAndConditions: form.termsAndConditions,
      bankDetails: form.bankDetails,
      signatory: form.signatory,
      paidAmount: initialInvoice.paidAmount || 0,
      balanceDue: Math.max(
        0,
        finalTotals.grandTotal - (initialInvoice.paidAmount || 0),
      ),
      balanceAmount: Math.max(
        0,
        finalTotals.grandTotal - (initialInvoice.paidAmount || 0),
      ),
    };
  }, [form, calculatedTotals, initialInvoice]);

  // Form submit / Save Handler with Comprehensive Duplicate Prevention
  const handleSaveClick = async () => {
    // Basic validation
    if (!form.invoiceNumber.trim()) {
      setInvoiceNumberError("Invoice number is required.");
      scrollToElement("invoiceNumberInput");
      return;
    }
    if (!form.billToDetails.companyName.trim()) {
      alert("Bill To Company / Customer Name is required.");
      return;
    }
    if (form.dockets.length === 0) {
      alert("Invoice must have at least one docket row.");
      return;
    }

    // Comprehensive duplicate check before proceeding
    const validationResult = await runDuplicateValidation(
      form.invoiceNumber,
      form.dockets,
    );
    if (!validationResult.isValid) {
      setSaveErrorBanner(
        "Cannot save invoice: Duplicate invoice number or docket numbers detected. Please resolve highlighted conflicts.",
      );

      if (validationResult.invoiceNumberError) {
        scrollToElement("invoiceNumberInput");
      } else if (
        validationResult.docketErrors &&
        Object.keys(validationResult.docketErrors).length > 0
      ) {
        const firstErrIdx = Object.keys(validationResult.docketErrors)[0];
        scrollToElement(`docketInput-${firstErrIdx}`);
      }
      return;
    }

    // Check if invoice already has payments recorded
    const existingPaid = Number(initialInvoice.paidAmount) || 0;
    if (
      existingPaid > 0 &&
      liveInvoice.grandTotal !==
        (initialInvoice.grandTotal || initialInvoice.totalAmount)
    ) {
      setShowPaidWarning(true);
      return;
    }

    executeSave();
  };

  const scrollToElement = (id) => {
    setTimeout(() => {
      const el = document.getElementById(id);
      if (el) {
        el.scrollIntoView({ behavior: "smooth", block: "center" });
        if (el.focus) el.focus();
      }
    }, 50);
  };

  const executeSave = async () => {
    setSaving(true);
    setSaveErrorBanner("");
    try {
      await onSave({
        ...liveInvoice,
        changeSummary:
          changeSummary.trim() || "Invoice updated via Full Invoice Editor",
      });
    } catch (err) {
      console.error("[InvoiceEditor] Save error caught:", err);
      const is409 =
        err.status === 409 ||
        err.data?.invoiceNumberError ||
        err.data?.docketErrors;
      const invErr = err.invoiceNumberError || err.data?.invoiceNumberError;
      const dErrs = err.docketErrors || err.data?.docketErrors;

      if (is409 || invErr || (dErrs && dErrs.length > 0)) {
        if (invErr) {
          setInvoiceNumberError(invErr);
          scrollToElement("invoiceNumberInput");
        }
        if (dErrs && Array.isArray(dErrs)) {
          const mappedErrs = {};
          const conflicts = [];
          dErrs.forEach((d) => {
            const rowNum = d.row || d.index + 1;
            mappedErrs[d.index] =
              d.error ||
              `Docket ${d.docketNo} already exists in ${d.conflictingInvoice} (Row ${rowNum})`;
            conflicts.push({
              index: d.index,
              row: rowNum,
              docketNo: d.docketNo,
              conflictingInvoice: d.conflictingInvoice || "Another Invoice",
              error: mappedErrs[d.index],
              type: d.type || "external_duplicate",
            });
          });
          setDocketErrors(mappedErrs);
          setDetailedDocketConflicts(conflicts);
          if (dErrs[0]) {
            scrollToElement(`docketInput-${dErrs[0].index}`);
          }
        }
        setSaveErrorBanner(
          err.message ||
            "Duplicate conflict detected: Invoice number or docket numbers already exist.",
        );
      } else {
        const failureMsg =
          err.message ||
          "Unable to Update Invoice. The changes could not be saved. Please try again.";
        setSaveErrorBanner(failureMsg);
        alert(failureMsg);
      }
    } finally {
      setSaving(false);
      setShowPaidWarning(false);
    }
  };

  const hasDuplicateErrors = Boolean(
    invoiceNumberError || Object.keys(docketErrors).length > 0,
  );

  return (
    <div className="space-y-4">
      {/* TOP STICKY TOOLBAR */}
      <div className="bg-slate-900 text-white rounded-xl p-3 sm:p-4 shadow-lg flex flex-col sm:flex-row items-center justify-between gap-3 sticky top-2 z-30">
        <div className="flex items-center gap-3">
          <div className="bg-setu-500/20 p-2 rounded-lg text-setu-400 border border-setu-500/30">
            <FileText className="w-5 h-5" />
          </div>
          <div>
            <div className="flex items-center gap-2">
              <span className="text-[11px] font-bold uppercase tracking-wider text-setu-400">
                Full Invoice Editor
              </span>
              {isDirty && (
                <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-amber-500/20 text-amber-300 border border-amber-500/30">
                  Unsaved Changes
                </span>
              )}
              {hasDuplicateErrors && (
                <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-rose-500/20 text-rose-300 border border-rose-500/30 animate-pulse flex items-center gap-1">
                  <AlertCircle className="w-3 h-3" />
                  <span>Duplicates Detected</span>
                </span>
              )}
            </div>
            <h2 className="text-base font-bold font-mono text-white flex items-center gap-2">
              <span>{form.invoiceNumber || "NEW INVOICE"}</span>
              <span className="text-xs font-normal text-slate-400">
                — {form.billToDetails.companyName || "No Client"}
              </span>
            </h2>
          </div>
        </div>

        {/* View Mode & Action Buttons */}
        <div className="flex items-center gap-2 flex-wrap justify-end">
          {/* View Mode Toggle */}
          <div className="bg-slate-800 p-1 rounded-lg border border-slate-700 flex items-center text-xs">
            <button
              type="button"
              onClick={() => setViewMode("editor")}
              className={`px-2.5 py-1 rounded font-bold transition-colors ${
                viewMode === "editor"
                  ? "bg-setu-600 text-white"
                  : "text-slate-400 hover:text-white"
              }`}
            >
              Editor Only
            </button>
            <button
              type="button"
              onClick={() => setViewMode("split")}
              className={`px-2.5 py-1 rounded font-bold transition-colors ${
                viewMode === "split"
                  ? "bg-setu-600 text-white"
                  : "text-slate-400 hover:text-white"
              }`}
            >
              Side-by-Side Live
            </button>
            <button
              type="button"
              onClick={() => setViewMode("preview")}
              className={`px-2.5 py-1 rounded font-bold transition-colors ${
                viewMode === "preview"
                  ? "bg-setu-600 text-white"
                  : "text-slate-400 hover:text-white"
              }`}
            >
              Full Preview
            </button>
          </div>

          <button
            type="button"
            onClick={() => {
              if (
                window.confirm("Reset all changes back to original invoice?")
              ) {
                setForm(normalizeInitialState(initialInvoice));
                setInvoiceNumberError(null);
                setDocketErrors({});
                setSaveErrorBanner("");
              }
            }}
            disabled={!isDirty || saving}
            className="px-3 py-1.5 text-xs font-bold bg-slate-800 hover:bg-slate-700 disabled:opacity-40 text-slate-300 border border-slate-700 rounded-lg flex items-center gap-1.5 transition-colors"
          >
            <RotateCcw className="w-3.5 h-3.5" />
            <span className="hidden sm:inline">Reset</span>
          </button>

          <button
            type="button"
            onClick={() => {
              if (isDirty) setShowCancelPrompt(true);
              else onCancel();
            }}
            disabled={saving}
            className="px-3 py-1.5 text-xs font-bold bg-slate-800 hover:bg-rose-950 text-rose-300 border border-slate-700 hover:border-rose-800 rounded-lg flex items-center gap-1.5 transition-colors"
          >
            <X className="w-3.5 h-3.5" />
            <span>Cancel</span>
          </button>

          <button
            type="button"
            onClick={handleSaveClick}
            disabled={saving}
            className={`px-4 py-1.5 text-xs font-bold rounded-lg shadow flex items-center gap-1.5 transition-colors ${
              hasDuplicateErrors
                ? "bg-rose-600 hover:bg-rose-700 text-white ring-2 ring-rose-400 cursor-not-allowed"
                : "bg-emerald-600 hover:bg-emerald-500 text-white disabled:opacity-60"
            }`}
            title={
              hasDuplicateErrors
                ? "Resolve duplicate errors before saving"
                : "Save all invoice modifications"
            }
          >
            <Save className="w-3.5 h-3.5" />
            <span>
              {saving
                ? "Saving Changes..."
                : hasDuplicateErrors
                  ? "Blocked: Resolve Duplicates"
                  : "Save Changes"}
            </span>
          </button>
        </div>
      </div>

      {/* STRUCTURED DUPLICATE VALIDATION & ERROR ALERT BANNER */}
      {(invoiceNumberError ||
        detailedDocketConflicts.length > 0 ||
        saveErrorBanner) && (
        <div className="bg-rose-50 border-2 border-rose-500 rounded-xl p-4 shadow-md space-y-3 animate-fadeIn text-rose-950">
          <div className="flex items-start justify-between gap-3 border-b border-rose-200 pb-2">
            <div className="flex items-center gap-2">
              <div className="p-1.5 bg-rose-600 text-white rounded-lg">
                <AlertCircle className="w-5 h-5" />
              </div>
              <div>
                <h3 className="font-extrabold text-sm text-rose-900">
                  Duplicate Conflict Detected — Save Blocked
                </h3>
                <p className="text-xs text-rose-700">
                  All modifications are preserved in this form. Please correct
                  the conflicting values below to proceed.
                </p>
              </div>
            </div>
            {saveErrorBanner &&
              !invoiceNumberError &&
              detailedDocketConflicts.length === 0 && (
                <button
                  type="button"
                  onClick={() => setSaveErrorBanner("")}
                  className="p-1 text-rose-600 hover:text-rose-900 rounded"
                >
                  <X className="w-4 h-4" />
                </button>
              )}
          </div>

          {/* 1. DUPLICATE INVOICE NUMBER SECTION */}
          {invoiceNumberError && (
            <div className="bg-white border-2 border-rose-400 rounded-lg p-3 text-xs space-y-1 shadow-xs">
              <div className="font-bold text-rose-700 flex items-center gap-1.5 text-sm">
                <AlertTriangle className="w-4 h-4 text-rose-600 shrink-0" />
                <span>Duplicate Invoice Number!</span>
              </div>
              <div className="font-mono text-slate-800 pl-5">
                <strong>Invoice Number:</strong>{" "}
                <span className="text-rose-600 font-bold bg-rose-50 px-1.5 py-0.5 rounded border border-rose-200">
                  {form.invoiceNumber}
                </span>
              </div>
              <p className="text-rose-800 font-medium pl-5">
                This invoice number already exists. Please enter a different
                invoice number.
              </p>
            </div>
          )}

          {/* 2. DUPLICATE DOCKET NUMBERS SECTION (ALL CONFLICTS IN ONE ALERT) */}
          {detailedDocketConflicts.length > 0 && (
            <div className="bg-white border-2 border-rose-400 rounded-lg p-3 text-xs space-y-2 shadow-xs">
              <div className="font-bold text-rose-700 flex items-center gap-1.5 text-sm">
                <AlertTriangle className="w-4 h-4 text-rose-600 shrink-0" />
                <span>Duplicate Docket Number Found!</span>
              </div>

              <div className="space-y-1.5 pl-2 sm:pl-5">
                {detailedDocketConflicts.map((c, i) => (
                  <div
                    key={i}
                    className="p-2 bg-rose-50/80 border border-rose-300 rounded font-mono text-xs text-slate-800 space-y-0.5"
                  >
                    <div>
                      • <strong>Docket Number:</strong>{" "}
                      <span className="text-rose-700 font-bold">
                        {c.docketNo}
                      </span>
                    </div>
                    <div>
                      • <strong>Already Exists In:</strong>{" "}
                      <span className="font-bold text-slate-900">
                        {c.conflictingInvoice}
                      </span>
                    </div>
                    <div>
                      • <strong>Duplicate Found In:</strong>{" "}
                      <span className="font-bold text-indigo-700">
                        Shipment Row {c.row || c.index + 1}
                      </span>
                    </div>
                  </div>
                ))}
              </div>

              <p className="text-rose-800 font-medium pl-2 sm:pl-5">
                This docket number has already been billed. Please correct it
                before saving.
              </p>
            </div>
          )}

          {/* GENERAL ERROR BANNER IF NOT CAUGHT ABOVE */}
          {saveErrorBanner &&
            !invoiceNumberError &&
            detailedDocketConflicts.length === 0 && (
              <div className="bg-white border border-rose-300 rounded-lg p-3 text-xs text-rose-900 font-medium">
                {saveErrorBanner}
              </div>
            )}
        </div>
      )}

      {/* MAIN CONTENT AREA: SPLIT OR FULL GRID */}
      <div
        className={`grid gap-6 ${viewMode === "split" ? "grid-cols-1 lg:grid-cols-12" : "grid-cols-1"}`}
      >
        {/* LEFT COLUMN: THE COMPLETE INVOICE FORM */}
        {(viewMode === "editor" || viewMode === "split") && (
          <div
            className={`${viewMode === "split" ? "lg:col-span-6 xl:col-span-7" : "col-span-1"} space-y-5`}
          >
            {/* SECTION A: INVOICE HEADER & TAX SETTINGS */}
            <div className="bg-white border border-slate-200 rounded-xl p-4 shadow-xs space-y-4">
              <div className="flex items-center justify-between border-b border-slate-100 pb-2">
                <div className="flex items-center gap-2">
                  <FileText className="w-4 h-4 text-setu-600" />
                  <h3 className="font-bold text-slate-900 text-sm">
                    A. Invoice Header & Status
                  </h3>
                </div>
                <span className="text-[11px] font-mono font-bold text-slate-500">
                  Metadata
                </span>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 text-xs">
                {/* INVOICE NUMBER WITH STRICT DUPLICATE VALIDATION */}
                <div id="invoiceNumberInputContainer" className="sm:col-span-1">
                  <label className="block font-bold text-slate-700 mb-1">
                    Invoice Number <span className="text-rose-500">*</span>
                  </label>
                  <input
                    id="invoiceNumberInput"
                    type="text"
                    value={form.invoiceNumber}
                    onChange={(e) =>
                      setForm((prev) => ({
                        ...prev,
                        invoiceNumber: e.target.value,
                      }))
                    }
                    onBlur={() =>
                      runDuplicateValidation(form.invoiceNumber, form.dockets)
                    }
                    className={`w-full p-2 rounded font-mono font-bold transition-colors ${
                      invoiceNumberError
                        ? "border-2 border-rose-500 bg-rose-50/60 text-rose-900 ring-2 ring-rose-200 focus:outline-hidden focus:border-rose-600"
                        : "bg-slate-50 border border-slate-300 text-slate-900 focus:border-setu-500"
                    }`}
                    placeholder="SS2026-101"
                  />
                  {/* INLINE ERROR DISPLAY FOR INVOICE NUMBER */}
                  {invoiceNumberError && (
                    <div className="text-rose-600 font-bold text-[11px] mt-1.5 flex items-start gap-1 p-1 bg-rose-50 border border-rose-200 rounded animate-fadeIn">
                      <AlertCircle className="w-3.5 h-3.5 text-rose-600 shrink-0 mt-0.5" />
                      <span>{invoiceNumberError}</span>
                    </div>
                  )}
                </div>

                <div>
                  <label className="block font-bold text-slate-700 mb-1">
                    Invoice Date *
                  </label>
                  <input
                    type="date"
                    value={form.invoiceDate}
                    onChange={(e) =>
                      setForm((prev) => ({
                        ...prev,
                        invoiceDate: e.target.value,
                      }))
                    }
                    className="w-full p-2 bg-slate-50 border border-slate-300 rounded font-mono text-slate-900"
                  />
                </div>

                <div>
                  <label className="block font-bold text-slate-700 mb-1">
                    Due Date
                  </label>
                  <input
                    type="date"
                    value={form.dueDate}
                    onChange={(e) =>
                      setForm((prev) => ({ ...prev, dueDate: e.target.value }))
                    }
                    className="w-full p-2 bg-slate-50 border border-slate-300 rounded font-mono text-slate-900"
                  />
                </div>

                <div>
                  <label className="block font-bold text-slate-700 mb-1">
                    Invoice Status
                  </label>
                  <select
                    value={form.status}
                    onChange={(e) =>
                      setForm((prev) => ({ ...prev, status: e.target.value }))
                    }
                    className="w-full p-2 bg-slate-50 border border-slate-300 rounded font-bold text-slate-900"
                  >
                    <option value="Draft">Draft</option>
                    <option value="Generated">Generated</option>
                    <option value="Sent">Sent</option>
                    <option value="Paid">Paid</option>
                    <option value="Partially Paid">Partially Paid</option>
                    <option value="Overdue">Overdue</option>
                    <option value="Disputed">Disputed</option>
                    <option value="Cancelled">Cancelled</option>
                  </select>
                </div>

                <div>
                  <label className="block font-bold text-slate-700 mb-1">
                    Tax Scheme
                  </label>
                  <select
                    value={form.taxMode}
                    onChange={(e) => handleTaxModeChange(e.target.value)}
                    className="w-full p-2 bg-slate-50 border border-slate-300 rounded font-bold text-slate-900"
                  >
                    <option value="charging_gst">
                      Charging GST (18% / Standard)
                    </option>
                    <option value="no_gst">
                      GST Exempt / Zero Tax (GTA Exempt)
                    </option>
                  </select>
                </div>

                <div>
                  <label className="block font-bold text-slate-700 mb-1">
                    GST Rate (%)
                  </label>
                  <input
                    type="number"
                    disabled={form.taxMode === "no_gst"}
                    value={form.taxMode === "no_gst" ? 0 : form.gstRate}
                    onChange={(e) => handleGstRateChange(e.target.value)}
                    className="w-full p-2 bg-slate-50 border border-slate-300 rounded font-mono font-bold text-slate-900 disabled:opacity-50"
                  />
                </div>
              </div>

              <div>
                <label className="block font-bold text-slate-700 text-xs mb-1">
                  Consignment References / Notes
                </label>
                <input
                  type="text"
                  value={form.notes}
                  onChange={(e) =>
                    setForm((prev) => ({ ...prev, notes: e.target.value }))
                  }
                  className="w-full p-2 bg-slate-50 border border-slate-300 rounded text-xs text-slate-800"
                  placeholder="e.g. Special express delivery consignment for monthly contract"
                />
              </div>
            </div>

            {/* SECTION B: SUPPLIER DETAILS */}
            <div className="bg-white border border-slate-200 rounded-xl p-4 shadow-xs space-y-4">
              <div className="flex items-center justify-between border-b border-slate-100 pb-2">
                <div className="flex items-center gap-2">
                  <Building2 className="w-4 h-4 text-setu-600" />
                  <h3 className="font-bold text-slate-900 text-sm">
                    B. Supplier Details
                  </h3>
                </div>
                <button
                  type="button"
                  onClick={() =>
                    setForm((prev) => ({
                      ...prev,
                      supplierDetails: { ...DEFAULT_SUPPLIER },
                    }))
                  }
                  className="text-[11px] font-bold text-setu-600 hover:underline"
                >
                  Reset to Default Supplier
                </button>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 text-xs">
                <div className="sm:col-span-2">
                  <label className="block font-bold text-slate-700 mb-1">
                    Supplier Company Legal Name *
                  </label>
                  <input
                    type="text"
                    value={form.supplierDetails.companyName}
                    onChange={(e) =>
                      setForm((prev) => ({
                        ...prev,
                        supplierDetails: {
                          ...prev.supplierDetails,
                          companyName: e.target.value,
                        },
                      }))
                    }
                    className="w-full p-2 bg-slate-50 border border-slate-300 rounded font-bold text-slate-900"
                  />
                </div>

                <div>
                  <label className="block font-bold text-slate-700 mb-1">
                    Registered Address Line 1
                  </label>
                  <input
                    type="text"
                    value={form.supplierDetails.addressLine1}
                    onChange={(e) =>
                      setForm((prev) => ({
                        ...prev,
                        supplierDetails: {
                          ...prev.supplierDetails,
                          addressLine1: e.target.value,
                        },
                      }))
                    }
                    className="w-full p-2 bg-slate-50 border border-slate-300 rounded text-slate-900"
                  />
                </div>

                <div>
                  <label className="block font-bold text-slate-700 mb-1">
                    Registered Address Line 2
                  </label>
                  <input
                    type="text"
                    value={form.supplierDetails.addressLine2}
                    onChange={(e) =>
                      setForm((prev) => ({
                        ...prev,
                        supplierDetails: {
                          ...prev.supplierDetails,
                          addressLine2: e.target.value,
                        },
                      }))
                    }
                    className="w-full p-2 bg-slate-50 border border-slate-300 rounded text-slate-900"
                  />
                </div>

                <div>
                  <label className="block font-bold text-slate-700 mb-1">
                    Supplier GSTIN
                  </label>
                  <input
                    type="text"
                    value={form.supplierDetails.gstin}
                    onChange={(e) =>
                      setForm((prev) => ({
                        ...prev,
                        supplierDetails: {
                          ...prev.supplierDetails,
                          gstin: e.target.value.toUpperCase(),
                        },
                      }))
                    }
                    className="w-full p-2 bg-slate-50 border border-slate-300 rounded font-mono font-bold text-slate-900"
                  />
                </div>

                <div>
                  <label className="block font-bold text-slate-700 mb-1">
                    PAN Number
                  </label>
                  <input
                    type="text"
                    value={form.supplierDetails.pan}
                    onChange={(e) =>
                      setForm((prev) => ({
                        ...prev,
                        supplierDetails: {
                          ...prev.supplierDetails,
                          pan: e.target.value.toUpperCase(),
                        },
                      }))
                    }
                    className="w-full p-2 bg-slate-50 border border-slate-300 rounded font-mono font-bold text-slate-900"
                  />
                </div>

                <div>
                  <label className="block font-bold text-slate-700 mb-1">
                    Phone Number
                  </label>
                  <input
                    type="text"
                    value={form.supplierDetails.phone}
                    onChange={(e) =>
                      setForm((prev) => ({
                        ...prev,
                        supplierDetails: {
                          ...prev.supplierDetails,
                          phone: e.target.value,
                        },
                      }))
                    }
                    className="w-full p-2 bg-slate-50 border border-slate-300 rounded text-slate-900"
                  />
                </div>

                <div>
                  <label className="block font-bold text-slate-700 mb-1">
                    Billing Email
                  </label>
                  <input
                    type="email"
                    value={form.supplierDetails.email}
                    onChange={(e) =>
                      setForm((prev) => ({
                        ...prev,
                        supplierDetails: {
                          ...prev.supplierDetails,
                          email: e.target.value,
                        },
                      }))
                    }
                    className="w-full p-2 bg-slate-50 border border-slate-300 rounded text-slate-900"
                  />
                </div>

                <div className="sm:col-span-2">
                  <label className="block font-bold text-slate-700 mb-1">
                    Supplier Logo (Upload or URL)
                  </label>
                  <div className="flex items-center gap-2">
                    <input
                      type="text"
                      placeholder="Paste Image URL or choose file below..."
                      value={form.supplierDetails.logoUrl}
                      onChange={(e) =>
                        setForm((prev) => ({
                          ...prev,
                          supplierDetails: {
                            ...prev.supplierDetails,
                            logoUrl: e.target.value,
                          },
                        }))
                      }
                      className="flex-1 p-2 bg-slate-50 border border-slate-300 rounded text-xs font-mono"
                    />
                    <label className="px-3 py-2 bg-slate-100 hover:bg-slate-200 border border-slate-300 rounded cursor-pointer font-bold flex items-center gap-1.5 transition-colors">
                      <Upload className="w-3.5 h-3.5 text-slate-600" />
                      <span>Upload</span>
                      <input
                        type="file"
                        accept="image/*"
                        className="hidden"
                        onChange={(e) => handleImageUpload(e, "supplierLogo")}
                      />
                    </label>
                  </div>
                </div>
              </div>
            </div>

            {/* SECTION C: BILL TO / CONSIGNEE DETAILS */}
            <div className="bg-white border border-slate-200 rounded-xl p-4 shadow-xs space-y-4">
              <div className="flex items-center justify-between border-b border-slate-100 pb-2">
                <div className="flex items-center gap-2">
                  <User className="w-4 h-4 text-setu-600" />
                  <h3 className="font-bold text-slate-900 text-sm">
                    C. Bill To / Consignee Details
                  </h3>
                </div>
                <span className="text-[11px] font-bold text-slate-500">
                  Customer Profile
                </span>
              </div>

              {/* Quick Select from Registered Customers */}
              <div>
                <label className="block font-bold text-slate-700 text-xs mb-1">
                  Select from Existing Customers
                </label>
                <select
                  onChange={(e) => {
                    const comp = companiesList.find(
                      (c) => (c.id || c.companyId || c._id) === e.target.value,
                    );
                    if (comp) handleSelectCustomer(comp);
                  }}
                  className="w-full p-2.5 bg-slate-50 border border-slate-300 rounded font-semibold text-slate-900 text-xs"
                >
                  <option value="">
                    -- Choose registered customer or enter details manually
                    below --
                  </option>
                  {companiesList.map((comp) => (
                    <option
                      key={comp.id || comp._id}
                      value={comp.id || comp.companyId || comp._id}
                    >
                      {comp.companyName}{" "}
                      {comp.billing?.gstin ? `(${comp.billing.gstin})` : ""}
                    </option>
                  ))}
                </select>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 text-xs">
                <div className="sm:col-span-2">
                  <label className="block font-bold text-slate-700 mb-1">
                    Customer / Company Name *
                  </label>
                  <input
                    type="text"
                    value={form.billToDetails.companyName}
                    onChange={(e) =>
                      setForm((prev) => ({
                        ...prev,
                        billToDetails: {
                          ...prev.billToDetails,
                          companyName: e.target.value,
                        },
                      }))
                    }
                    className="w-full p-2 bg-slate-50 border border-slate-300 rounded font-bold text-slate-900"
                    placeholder="e.g. TECHNIQUES SURFACES INDIA PVT LTD."
                  />
                </div>

                <div className="sm:col-span-2">
                  <label className="block font-bold text-slate-700 mb-1">
                    Billing Street Address
                  </label>
                  <input
                    type="text"
                    value={form.billToDetails.address}
                    onChange={(e) =>
                      setForm((prev) => ({
                        ...prev,
                        billToDetails: {
                          ...prev.billToDetails,
                          address: e.target.value,
                        },
                      }))
                    }
                    className="w-full p-2 bg-slate-50 border border-slate-300 rounded text-slate-900"
                    placeholder="Plot No, Industrial Area, Street"
                  />
                </div>

                <div>
                  <label className="block font-bold text-slate-700 mb-1">
                    City
                  </label>
                  <input
                    type="text"
                    value={form.billToDetails.city}
                    onChange={(e) =>
                      setForm((prev) => ({
                        ...prev,
                        billToDetails: {
                          ...prev.billToDetails,
                          city: e.target.value,
                        },
                      }))
                    }
                    className="w-full p-2 bg-slate-50 border border-slate-300 rounded text-slate-900"
                  />
                </div>

                <div>
                  <label className="block font-bold text-slate-700 mb-1">
                    State
                  </label>
                  <input
                    type="text"
                    value={form.billToDetails.state}
                    onChange={(e) =>
                      setForm((prev) => ({
                        ...prev,
                        billToDetails: {
                          ...prev.billToDetails,
                          state: e.target.value,
                        },
                      }))
                    }
                    className="w-full p-2 bg-slate-50 border border-slate-300 rounded text-slate-900"
                  />
                </div>

                <div>
                  <label className="block font-bold text-slate-700 mb-1">
                    PIN Code
                  </label>
                  <input
                    type="text"
                    value={form.billToDetails.pinCode}
                    onChange={(e) =>
                      setForm((prev) => ({
                        ...prev,
                        billToDetails: {
                          ...prev.billToDetails,
                          pinCode: e.target.value,
                        },
                      }))
                    }
                    className="w-full p-2 bg-slate-50 border border-slate-300 rounded font-mono text-slate-900"
                  />
                </div>

                <div>
                  <label className="block font-bold text-slate-700 mb-1">
                    Customer GSTIN
                  </label>
                  <input
                    type="text"
                    value={form.billToDetails.gstin}
                    onChange={(e) =>
                      setForm((prev) => ({
                        ...prev,
                        billToDetails: {
                          ...prev.billToDetails,
                          gstin: e.target.value.toUpperCase(),
                        },
                      }))
                    }
                    className="w-full p-2 bg-slate-50 border border-slate-300 rounded font-mono font-bold text-slate-900"
                    placeholder="06XXXXXXXXXXXZX"
                  />
                </div>

                <div>
                  <label className="block font-bold text-slate-700 mb-1">
                    Contact Phone
                  </label>
                  <input
                    type="text"
                    value={form.billToDetails.phone}
                    onChange={(e) =>
                      setForm((prev) => ({
                        ...prev,
                        billToDetails: {
                          ...prev.billToDetails,
                          phone: e.target.value,
                        },
                      }))
                    }
                    className="w-full p-2 bg-slate-50 border border-slate-300 rounded text-slate-900"
                  />
                </div>

                <div>
                  <label className="block font-bold text-slate-700 mb-1">
                    Contact Email
                  </label>
                  <input
                    type="email"
                    value={form.billToDetails.email}
                    onChange={(e) =>
                      setForm((prev) => ({
                        ...prev,
                        billToDetails: {
                          ...prev.billToDetails,
                          email: e.target.value,
                        },
                      }))
                    }
                    className="w-full p-2 bg-slate-50 border border-slate-300 rounded text-slate-900"
                  />
                </div>
              </div>
            </div>

            {/* SECTION D: TRANSPORT DETAILS */}
            <div className="bg-white border border-slate-200 rounded-xl p-4 shadow-xs space-y-4">
              <div className="flex items-center justify-between border-b border-slate-100 pb-2">
                <div className="flex items-center gap-2">
                  <Truck className="w-4 h-4 text-setu-600" />
                  <h3 className="font-bold text-slate-900 text-sm">
                    D. Transport & Movement Details
                  </h3>
                </div>
                <span className="text-[11px] font-bold text-slate-500">
                  Logistics
                </span>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 text-xs">
                <div>
                  <label className="block font-bold text-slate-700 mb-1">
                    Transport Mode *
                  </label>
                  <input
                    type="text"
                    value={form.transportDetails.mode}
                    onChange={(e) =>
                      setForm((prev) => ({
                        ...prev,
                        transportDetails: {
                          ...prev.transportDetails,
                          mode: e.target.value.toUpperCase(),
                        },
                      }))
                    }
                    className="w-full p-2 bg-slate-50 border border-slate-300 rounded font-bold uppercase text-slate-900"
                    placeholder="ROAD / TRAIN / AIR"
                  />
                </div>

                <div>
                  <label className="block font-bold text-slate-700 mb-1">
                    HSN / SAC Code
                  </label>
                  <input
                    type="text"
                    value={form.transportDetails.hsnCode}
                    onChange={(e) =>
                      setForm((prev) => ({
                        ...prev,
                        transportDetails: {
                          ...prev.transportDetails,
                          hsnCode: e.target.value,
                        },
                      }))
                    }
                    className="w-full p-2 bg-slate-50 border border-slate-300 rounded font-mono font-bold text-slate-900"
                    placeholder="996531"
                  />
                </div>

                <div>
                  <label className="block font-bold text-slate-700 mb-1">
                    Vehicle Number
                  </label>
                  <input
                    type="text"
                    value={form.transportDetails.vehicleNo}
                    onChange={(e) =>
                      setForm((prev) => ({
                        ...prev,
                        transportDetails: {
                          ...prev.transportDetails,
                          vehicleNo: e.target.value.toUpperCase(),
                        },
                      }))
                    }
                    className="w-full p-2 bg-slate-50 border border-slate-300 rounded font-mono uppercase text-slate-900"
                    placeholder="HR-16-AB-1234"
                  />
                </div>

                <div>
                  <label className="block font-bold text-slate-700 mb-1">
                    GR / LR Number
                  </label>
                  <input
                    type="text"
                    value={form.transportDetails.grNo}
                    onChange={(e) =>
                      setForm((prev) => ({
                        ...prev,
                        transportDetails: {
                          ...prev.transportDetails,
                          grNo: e.target.value,
                        },
                      }))
                    }
                    className="w-full p-2 bg-slate-50 border border-slate-300 rounded font-mono text-slate-900"
                    placeholder="LR-98231"
                  />
                </div>

                <div>
                  <label className="block font-bold text-slate-700 mb-1">
                    Driver Name
                  </label>
                  <input
                    type="text"
                    value={form.transportDetails.driverName}
                    onChange={(e) =>
                      setForm((prev) => ({
                        ...prev,
                        transportDetails: {
                          ...prev.transportDetails,
                          driverName: e.target.value,
                        },
                      }))
                    }
                    className="w-full p-2 bg-slate-50 border border-slate-300 rounded text-slate-900"
                  />
                </div>

                <div>
                  <label className="block font-bold text-slate-700 mb-1">
                    Driver Contact
                  </label>
                  <input
                    type="text"
                    value={form.transportDetails.driverPhone}
                    onChange={(e) =>
                      setForm((prev) => ({
                        ...prev,
                        transportDetails: {
                          ...prev.transportDetails,
                          driverPhone: e.target.value,
                        },
                      }))
                    }
                    className="w-full p-2 bg-slate-50 border border-slate-300 rounded text-slate-900"
                  />
                </div>
              </div>
            </div>

            {/* SECTION E: COMPLETE SHIPMENT / DOCKETS TABLE WITH DUPLICATE VALIDATION */}
            <div className="bg-white border border-slate-200 rounded-xl p-4 shadow-xs space-y-4">
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 border-b border-slate-100 pb-2">
                <div className="flex items-center gap-2">
                  <DollarSign className="w-4 h-4 text-setu-600" />
                  <h3 className="font-bold text-slate-900 text-sm">
                    E. Shipment Breakdown Table ({form.dockets.length}{" "}
                    {form.dockets.length === 1 ? "Docket" : "Dockets"})
                  </h3>
                </div>

                {/* Column Visibility Toggles */}
                <div className="flex items-center gap-1.5 flex-wrap text-[11px]">
                  <span className="font-bold text-slate-400">
                    Optional Charges:
                  </span>
                  <label className="flex items-center gap-1 cursor-pointer font-semibold text-slate-700 bg-slate-100 px-2 py-0.5 rounded">
                    <input
                      type="checkbox"
                      checked={visibleColumns.packing}
                      onChange={(e) =>
                        setVisibleColumns((prev) => ({
                          ...prev,
                          packing: e.target.checked,
                        }))
                      }
                    />
                    Packing
                  </label>
                  <label className="flex items-center gap-1 cursor-pointer font-semibold text-slate-700 bg-slate-100 px-2 py-0.5 rounded">
                    <input
                      type="checkbox"
                      checked={visibleColumns.labor}
                      onChange={(e) =>
                        setVisibleColumns((prev) => ({
                          ...prev,
                          labor: e.target.checked,
                        }))
                      }
                    />
                    Labor
                  </label>
                  <label className="flex items-center gap-1 cursor-pointer font-semibold text-slate-700 bg-slate-100 px-2 py-0.5 rounded">
                    <input
                      type="checkbox"
                      checked={visibleColumns.godown}
                      onChange={(e) =>
                        setVisibleColumns((prev) => ({
                          ...prev,
                          godown: e.target.checked,
                        }))
                      }
                    />
                    Storage
                  </label>
                </div>
              </div>

              {/* Dockets Table Container */}
              <div className="overflow-x-auto border border-slate-200 rounded-lg max-h-[550px] overflow-y-auto">
                <table className="w-full text-left border-collapse text-xs">
                  <thead className="bg-slate-100 text-slate-700 font-bold uppercase text-[10px] tracking-wider sticky top-0 z-10 border-b border-slate-200">
                    <tr className="divide-x divide-slate-200">
                      <th className="p-2 w-10 text-center">#</th>
                      <th className="p-2 min-w-[140px]">Docket No *</th>
                      <th className="p-2 min-w-[110px]">Date</th>
                      <th className="p-2 min-w-[100px]">Origin</th>
                      <th className="p-2 min-w-[100px]">Destination</th>
                      <th className="p-2 min-w-[65px] text-right">Pkgs</th>
                      <th className="p-2 min-w-[80px] text-right">
                        Weight (kg)
                      </th>
                      <th className="p-2 min-w-[80px] text-right">Rate (₹)</th>
                      <th className="p-2 min-w-[90px] text-right">
                        Freight (₹)
                      </th>
                      <th className="p-2 min-w-[85px] text-right">
                        Docket Chg
                      </th>
                      <th className="p-2 min-w-[85px] text-right">
                        Pickup Chg
                      </th>
                      <th className="p-2 min-w-[85px] text-right">
                        Delivery Chg
                      </th>
                      {visibleColumns.packing && (
                        <th className="p-2 min-w-[85px] text-right">
                          Packing Chg
                        </th>
                      )}
                      {visibleColumns.labor && (
                        <th className="p-2 min-w-[85px] text-right">
                          Labor Chg
                        </th>
                      )}
                      {visibleColumns.godown && (
                        <th className="p-2 min-w-[85px] text-right">
                          Godown Chg
                        </th>
                      )}
                      <th className="p-2 min-w-[85px] text-right">Other Chg</th>
                      <th className="p-2 min-w-[100px] text-right bg-slate-200/60 font-black">
                        Taxable (₹)
                      </th>
                      {form.taxMode === "charging_gst" && (
                        <>
                          <th className="p-2 min-w-[75px] text-right">CGST</th>
                          <th className="p-2 min-w-[75px] text-right">SGST</th>
                          <th className="p-2 min-w-[75px] text-right">IGST</th>
                        </>
                      )}
                      <th className="p-2 min-w-[110px] text-right bg-emerald-50 text-emerald-950 font-black">
                        Total (₹)
                      </th>
                      <th className="p-2 min-w-[90px] text-center">Actions</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-200 bg-white">
                    {form.dockets.map((docket, idx) => {
                      const hasDocketError = Boolean(docketErrors[idx]);
                      return (
                        <tr
                          key={docket.id || idx}
                          className={`divide-x divide-slate-100 hover:bg-slate-50 ${hasDocketError ? "bg-rose-50/20" : ""}`}
                        >
                          <td className="p-1.5 text-center font-mono font-bold text-slate-500">
                            {idx + 1}
                          </td>
                          <td className="p-1">
                            <input
                              id={`docketInput-${idx}`}
                              type="text"
                              value={docket.docketNo}
                              onChange={(e) =>
                                handleDocketChange(
                                  idx,
                                  "docketNo",
                                  e.target.value,
                                )
                              }
                              onBlur={() =>
                                runDuplicateValidation(
                                  form.invoiceNumber,
                                  form.dockets,
                                )
                              }
                              className={`w-full p-1 font-mono font-bold transition-colors ${
                                hasDocketError
                                  ? "border-2 border-rose-500 bg-rose-50/60 text-rose-900 rounded ring-1 ring-rose-400 focus:outline-hidden"
                                  : "bg-transparent text-slate-900 border-b border-transparent hover:border-slate-300 focus:border-setu-500 focus:bg-white focus:outline-hidden"
                              }`}
                              placeholder="CN-1001"
                            />
                            {/* INLINE ERROR DISPLAY FOR DUPLICATE DOCKET */}
                            {hasDocketError && (
                              <div className="text-rose-600 font-bold text-[10px] mt-1 leading-tight flex items-start gap-1 p-1 bg-rose-50 border border-rose-300 rounded shadow-2xs animate-fadeIn">
                                <AlertCircle className="w-3 h-3 text-rose-600 shrink-0 mt-0.5" />
                                <span>{docketErrors[idx]}</span>
                              </div>
                            )}
                          </td>
                          <td className="p-1">
                            <input
                              type="text"
                              value={docket.docketDate}
                              onChange={(e) =>
                                handleDocketChange(
                                  idx,
                                  "docketDate",
                                  e.target.value,
                                )
                              }
                              className="w-full p-1 bg-transparent font-mono text-slate-700 border-b border-transparent hover:border-slate-300 focus:border-setu-500 focus:bg-white focus:outline-hidden"
                              placeholder="YYYY-MM-DD"
                            />
                          </td>
                          <td className="p-1">
                            <input
                              type="text"
                              value={docket.origin}
                              onChange={(e) =>
                                handleDocketChange(
                                  idx,
                                  "origin",
                                  e.target.value.toUpperCase(),
                                )
                              }
                              className="w-full p-1 bg-transparent uppercase font-semibold text-slate-800 border-b border-transparent hover:border-slate-300 focus:border-setu-500 focus:bg-white focus:outline-hidden"
                            />
                          </td>
                          <td className="p-1">
                            <input
                              type="text"
                              value={docket.destination}
                              onChange={(e) =>
                                handleDocketChange(
                                  idx,
                                  "destination",
                                  e.target.value.toUpperCase(),
                                )
                              }
                              className="w-full p-1 bg-transparent uppercase font-semibold text-slate-800 border-b border-transparent hover:border-slate-300 focus:border-setu-500 focus:bg-white focus:outline-hidden"
                            />
                          </td>
                          <td className="p-1">
                            <input
                              type="text"
                              value={docket.noPack}
                              onChange={(e) =>
                                handleDocketChange(
                                  idx,
                                  "noPack",
                                  e.target.value,
                                )
                              }
                              className="w-full p-1 text-right font-mono text-slate-900 border-b border-transparent hover:border-slate-300 focus:border-setu-500 focus:bg-white focus:outline-hidden"
                            />
                          </td>
                          <td className="p-1">
                            <input
                              type="number"
                              value={docket.weight || ""}
                              onChange={(e) =>
                                handleDocketChange(
                                  idx,
                                  "weight",
                                  parseFloat(e.target.value) || 0,
                                )
                              }
                              className="w-full p-1 text-right font-mono text-slate-900 border-b border-transparent hover:border-slate-300 focus:border-setu-500 focus:bg-white focus:outline-hidden"
                            />
                          </td>
                          <td className="p-1">
                            <input
                              type="number"
                              value={docket.rate || ""}
                              onChange={(e) =>
                                handleDocketChange(
                                  idx,
                                  "rate",
                                  parseFloat(e.target.value) || 0,
                                )
                              }
                              className="w-full p-1 text-right font-mono text-slate-900 border-b border-transparent hover:border-slate-300 focus:border-setu-500 focus:bg-white focus:outline-hidden"
                            />
                          </td>
                          <td className="p-1">
                            <input
                              type="number"
                              value={docket.freight || ""}
                              onChange={(e) =>
                                handleDocketChange(
                                  idx,
                                  "freight",
                                  parseFloat(e.target.value) || 0,
                                )
                              }
                              className="w-full p-1 text-right font-mono font-bold text-slate-900 border-b border-transparent hover:border-slate-300 focus:border-setu-500 focus:bg-white focus:outline-hidden"
                            />
                          </td>
                          <td className="p-1">
                            <input
                              type="number"
                              value={docket.docketCharges || ""}
                              onChange={(e) =>
                                handleDocketChange(
                                  idx,
                                  "docketCharges",
                                  parseFloat(e.target.value) || 0,
                                )
                              }
                              className="w-full p-1 text-right font-mono text-slate-700 border-b border-transparent hover:border-slate-300 focus:border-setu-500 focus:bg-white focus:outline-hidden"
                            />
                          </td>
                          <td className="p-1">
                            <input
                              type="number"
                              value={docket.pickupCharges || ""}
                              onChange={(e) =>
                                handleDocketChange(
                                  idx,
                                  "pickupCharges",
                                  parseFloat(e.target.value) || 0,
                                )
                              }
                              className="w-full p-1 text-right font-mono text-slate-700 border-b border-transparent hover:border-slate-300 focus:border-setu-500 focus:bg-white focus:outline-hidden"
                            />
                          </td>
                          <td className="p-1">
                            <input
                              type="number"
                              value={docket.deliveryCharges || ""}
                              onChange={(e) =>
                                handleDocketChange(
                                  idx,
                                  "deliveryCharges",
                                  parseFloat(e.target.value) || 0,
                                )
                              }
                              className="w-full p-1 text-right font-mono text-slate-700 border-b border-transparent hover:border-slate-300 focus:border-setu-500 focus:bg-white focus:outline-hidden"
                            />
                          </td>
                          {visibleColumns.packing && (
                            <td className="p-1">
                              <input
                                type="number"
                                value={docket.packingCharges || ""}
                                onChange={(e) =>
                                  handleDocketChange(
                                    idx,
                                    "packingCharges",
                                    parseFloat(e.target.value) || 0,
                                  )
                                }
                                className="w-full p-1 text-right font-mono text-slate-700 border-b border-transparent hover:border-slate-300 focus:border-setu-500 focus:bg-white focus:outline-hidden"
                              />
                            </td>
                          )}
                          {visibleColumns.labor && (
                            <td className="p-1">
                              <input
                                type="number"
                                value={docket.laborCharges || ""}
                                onChange={(e) =>
                                  handleDocketChange(
                                    idx,
                                    "laborCharges",
                                    parseFloat(e.target.value) || 0,
                                  )
                                }
                                className="w-full p-1 text-right font-mono text-slate-700 border-b border-transparent hover:border-slate-300 focus:border-setu-500 focus:bg-white focus:outline-hidden"
                              />
                            </td>
                          )}
                          {visibleColumns.godown && (
                            <td className="p-1">
                              <input
                                type="number"
                                value={docket.godownCharges || ""}
                                onChange={(e) =>
                                  handleDocketChange(
                                    idx,
                                    "godownCharges",
                                    parseFloat(e.target.value) || 0,
                                  )
                                }
                                className="w-full p-1 text-right font-mono text-slate-700 border-b border-transparent hover:border-slate-300 focus:border-setu-500 focus:bg-white focus:outline-hidden"
                              />
                            </td>
                          )}
                          <td className="p-1">
                            <input
                              type="number"
                              value={docket.otherCharges || ""}
                              onChange={(e) =>
                                handleDocketChange(
                                  idx,
                                  "otherCharges",
                                  parseFloat(e.target.value) || 0,
                                )
                              }
                              className="w-full p-1 text-right font-mono text-slate-700 border-b border-transparent hover:border-slate-300 focus:border-setu-500 focus:bg-white focus:outline-hidden"
                            />
                          </td>
                          <td className="p-1 bg-slate-100/50">
                            <input
                              type="number"
                              value={docket.taxableAmount || ""}
                              onChange={(e) =>
                                handleDocketChange(
                                  idx,
                                  "taxableAmount",
                                  parseFloat(e.target.value) || 0,
                                )
                              }
                              className="w-full p-1 text-right font-mono font-bold text-slate-900 border-b border-transparent hover:border-slate-300 focus:border-setu-500 focus:bg-white focus:outline-hidden"
                            />
                          </td>
                          {form.taxMode === "charging_gst" && (
                            <>
                              <td className="p-1">
                                <input
                                  type="number"
                                  value={docket.cgst || ""}
                                  onChange={(e) =>
                                    handleDocketChange(
                                      idx,
                                      "cgst",
                                      parseFloat(e.target.value) || 0,
                                    )
                                  }
                                  className="w-full p-1 text-right font-mono text-slate-700 border-b border-transparent hover:border-slate-300 focus:border-setu-500 focus:bg-white focus:outline-hidden"
                                />
                              </td>
                              <td className="p-1">
                                <input
                                  type="number"
                                  value={docket.sgst || ""}
                                  onChange={(e) =>
                                    handleDocketChange(
                                      idx,
                                      "sgst",
                                      parseFloat(e.target.value) || 0,
                                    )
                                  }
                                  className="w-full p-1 text-right font-mono text-slate-700 border-b border-transparent hover:border-slate-300 focus:border-setu-500 focus:bg-white focus:outline-hidden"
                                />
                              </td>
                              <td className="p-1">
                                <input
                                  type="number"
                                  value={docket.igst || ""}
                                  onChange={(e) =>
                                    handleDocketChange(
                                      idx,
                                      "igst",
                                      parseFloat(e.target.value) || 0,
                                    )
                                  }
                                  className="w-full p-1 text-right font-mono text-slate-700 border-b border-transparent hover:border-slate-300 focus:border-setu-500 focus:bg-white focus:outline-hidden"
                                />
                              </td>
                            </>
                          )}
                          <td className="p-1 bg-emerald-50/70">
                            <input
                              type="number"
                              value={docket.totalInvoiceValue || ""}
                              onChange={(e) =>
                                handleDocketChange(
                                  idx,
                                  "totalInvoiceValue",
                                  parseFloat(e.target.value) || 0,
                                )
                              }
                              className="w-full p-1 text-right font-mono font-black text-emerald-900 border-b border-transparent hover:border-emerald-300 focus:border-emerald-600 focus:bg-white focus:outline-hidden"
                            />
                          </td>
                          <td className="p-1 text-center">
                            <div className="flex items-center justify-center gap-1">
                              <button
                                type="button"
                                onClick={() => handleMoveDocket(idx, -1)}
                                disabled={idx === 0}
                                className="p-1 text-slate-400 hover:text-slate-700 disabled:opacity-20"
                                title="Move Up"
                              >
                                <ArrowUp className="w-3.5 h-3.5" />
                              </button>
                              <button
                                type="button"
                                onClick={() => handleMoveDocket(idx, 1)}
                                disabled={idx === form.dockets.length - 1}
                                className="p-1 text-slate-400 hover:text-slate-700 disabled:opacity-20"
                                title="Move Down"
                              >
                                <ArrowDown className="w-3.5 h-3.5" />
                              </button>
                              <button
                                type="button"
                                onClick={() => handleDuplicateDocket(idx)}
                                className="p-1 text-slate-400 hover:text-setu-600"
                                title="Duplicate Row"
                              >
                                <Copy className="w-3.5 h-3.5" />
                              </button>
                              <button
                                type="button"
                                onClick={() => handleDeleteDocket(idx)}
                                className="p-1 text-slate-400 hover:text-rose-600"
                                title="Delete Row"
                              >
                                <Trash2 className="w-3.5 h-3.5" />
                              </button>
                            </div>
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>

              {/* Add Row Button */}
              <div className="flex justify-between items-center pt-1">
                <button
                  type="button"
                  onClick={handleAddDocket}
                  className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-bold text-setu-700 bg-setu-50 border border-setu-200 hover:bg-setu-100 rounded-lg transition-colors"
                >
                  <Plus className="w-3.5 h-3.5" />
                  <span>Add Shipment Row</span>
                </button>

                <div className="text-xs text-slate-500 italic">
                  * Unique docket numbers are enforced in real time against all
                  active invoices.
                </div>
              </div>
            </div>

            {/* SECTION F: TOTALS & MANUAL OVERRIDES */}
            <div className="bg-white border border-slate-200 rounded-xl p-4 shadow-xs space-y-4">
              <div className="flex items-center justify-between border-b border-slate-100 pb-2">
                <div className="flex items-center gap-2">
                  <DollarSign className="w-4 h-4 text-setu-600" />
                  <h3 className="font-bold text-slate-900 text-sm">
                    F. Summary Totals & Calculations
                  </h3>
                </div>

                <div className="flex items-center gap-2">
                  <label className="text-xs font-bold text-slate-700 flex items-center gap-1.5 cursor-pointer">
                    <input
                      type="checkbox"
                      checked={form.totals.manualOverride}
                      onChange={(e) =>
                        setForm((prev) => ({
                          ...prev,
                          totals: {
                            ...prev.totals,
                            manualOverride: e.target.checked,
                          },
                        }))
                      }
                      className="rounded border-slate-300 text-setu-600"
                    />
                    <span>Manual Overrides Mode</span>
                  </label>
                </div>
              </div>

              {/* Dynamic Auto-Calculated Metrics Bar */}
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 bg-slate-50 p-3 rounded-lg border border-slate-200 text-xs">
                <div>
                  <span className="text-[11px] font-bold text-slate-500 uppercase block">
                    Total Packages
                  </span>
                  <span className="font-mono font-bold text-slate-900">
                    {calculatedTotals.totalPackages}
                  </span>
                </div>
                <div>
                  <span className="text-[11px] font-bold text-slate-500 uppercase block">
                    Total Weight
                  </span>
                  <span className="font-mono font-bold text-slate-900">
                    {calculatedTotals.totalWeight} Kg
                  </span>
                </div>
                <div>
                  <span className="text-[11px] font-bold text-slate-500 uppercase block">
                    Total Freight
                  </span>
                  <span className="font-mono font-bold text-slate-900">
                    {formatINR(calculatedTotals.totalFreight)}
                  </span>
                </div>
                <div>
                  <span className="text-[11px] font-bold text-slate-500 uppercase block">
                    Taxable Subtotal
                  </span>
                  <span className="font-mono font-bold text-slate-900">
                    {formatINR(calculatedTotals.totalTaxableAmount)}
                  </span>
                </div>
                <div>
                  <span className="text-[11px] font-bold text-slate-500 uppercase block">
                    Total CGST + SGST
                  </span>
                  <span className="font-mono font-bold text-slate-900">
                    {formatINR(
                      calculatedTotals.totalCgst + calculatedTotals.totalSgst,
                    )}
                  </span>
                </div>
                <div>
                  <span className="text-[11px] font-bold text-slate-500 uppercase block">
                    Total IGST
                  </span>
                  <span className="font-mono font-bold text-slate-900">
                    {formatINR(calculatedTotals.totalIgst)}
                  </span>
                </div>
                <div className="sm:col-span-2 bg-white p-2 rounded border border-slate-200">
                  <span className="text-[11px] font-bold text-slate-500 uppercase block">
                    Calculated Grand Total
                  </span>
                  <span className="font-mono font-extrabold text-emerald-700 text-base">
                    {formatINR(calculatedTotals.grandTotal)}
                  </span>
                </div>
              </div>

              {/* Manual Override Fields when Toggled On */}
              {form.totals.manualOverride && (
                <div className="p-3 bg-amber-50/70 border border-amber-200 rounded-lg space-y-3 text-xs">
                  <div className="flex items-center gap-1.5 text-amber-900 font-bold">
                    <ShieldAlert className="w-4 h-4 text-amber-600" />
                    <span>
                      Manual Override Enabled — Custom Values Will Directly
                      Supersede Row Calculations
                    </span>
                  </div>

                  <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
                    <div>
                      <label className="block font-bold text-slate-700 mb-1">
                        Override Taxable Amount
                      </label>
                      <input
                        type="number"
                        placeholder={String(
                          calculatedTotals.totalTaxableAmount,
                        )}
                        value={form.totals.totalTaxableAmount}
                        onChange={(e) =>
                          setForm((prev) => ({
                            ...prev,
                            totals: {
                              ...prev.totals,
                              totalTaxableAmount: e.target.value,
                            },
                          }))
                        }
                        className="w-full p-2 bg-white border border-slate-300 rounded font-mono font-bold"
                      />
                    </div>
                    <div>
                      <label className="block font-bold text-slate-700 mb-1">
                        Override CGST
                      </label>
                      <input
                        type="number"
                        placeholder={String(calculatedTotals.totalCgst)}
                        value={form.totals.totalCgst}
                        onChange={(e) =>
                          setForm((prev) => ({
                            ...prev,
                            totals: {
                              ...prev.totals,
                              totalCgst: e.target.value,
                            },
                          }))
                        }
                        className="w-full p-2 bg-white border border-slate-300 rounded font-mono font-bold"
                      />
                    </div>
                    <div>
                      <label className="block font-bold text-slate-700 mb-1">
                        Override SGST
                      </label>
                      <input
                        type="number"
                        placeholder={String(calculatedTotals.totalSgst)}
                        value={form.totals.totalSgst}
                        onChange={(e) =>
                          setForm((prev) => ({
                            ...prev,
                            totals: {
                              ...prev.totals,
                              totalSgst: e.target.value,
                            },
                          }))
                        }
                        className="w-full p-2 bg-white border border-slate-300 rounded font-mono font-bold"
                      />
                    </div>
                    <div>
                      <label className="block font-bold text-slate-700 mb-1">
                        Override IGST
                      </label>
                      <input
                        type="number"
                        placeholder={String(calculatedTotals.totalIgst)}
                        value={form.totals.totalIgst}
                        onChange={(e) =>
                          setForm((prev) => ({
                            ...prev,
                            totals: {
                              ...prev.totals,
                              totalIgst: e.target.value,
                            },
                          }))
                        }
                        className="w-full p-2 bg-white border border-slate-300 rounded font-mono font-bold"
                      />
                    </div>
                    <div className="sm:col-span-2">
                      <label className="block font-bold text-slate-700 mb-1">
                        Override Grand Total *
                      </label>
                      <input
                        type="number"
                        placeholder={String(calculatedTotals.grandTotal)}
                        value={form.totals.grandTotal}
                        onChange={(e) =>
                          setForm((prev) => ({
                            ...prev,
                            totals: {
                              ...prev.totals,
                              grandTotal: e.target.value,
                            },
                          }))
                        }
                        className="w-full p-2 bg-white border border-emerald-500 rounded font-mono font-black text-emerald-800 text-sm"
                      />
                    </div>
                    <div className="sm:col-span-2">
                      <label className="block font-bold text-slate-700 mb-1">
                        Override Justification / Reason
                      </label>
                      <input
                        type="text"
                        placeholder="e.g. Special round-off or customer commercial credit"
                        value={form.totals.overrideReason}
                        onChange={(e) =>
                          setForm((prev) => ({
                            ...prev,
                            totals: {
                              ...prev.totals,
                              overrideReason: e.target.value,
                            },
                          }))
                        }
                        className="w-full p-2 bg-white border border-slate-300 rounded"
                      />
                    </div>
                  </div>
                </div>
              )}
            </div>

            {/* SECTION G: TERMS & CONDITIONS */}
            <div className="bg-white border border-slate-200 rounded-xl p-4 shadow-xs space-y-4">
              <div className="flex items-center justify-between border-b border-slate-100 pb-2">
                <div className="flex items-center gap-2">
                  <FileText className="w-4 h-4 text-setu-600" />
                  <h3 className="font-bold text-slate-900 text-sm">
                    G. Terms & Conditions
                  </h3>
                </div>
                <div className="flex items-center gap-2">
                  <button
                    type="button"
                    onClick={() =>
                      setForm((prev) => ({
                        ...prev,
                        termsAndConditions: [...DEFAULT_TERMS],
                      }))
                    }
                    className="text-[11px] font-bold text-slate-500 hover:text-slate-800"
                  >
                    Reset Defaults
                  </button>
                  <button
                    type="button"
                    onClick={handleAddTerm}
                    className="inline-flex items-center gap-1 text-[11px] font-bold text-setu-600 hover:text-setu-700"
                  >
                    <Plus className="w-3 h-3" />
                    Add Term
                  </button>
                </div>
              </div>

              <div className="space-y-2 text-xs">
                {form.termsAndConditions.map((term, idx) => (
                  <div
                    key={idx}
                    className="flex items-center gap-2 bg-slate-50 p-2 rounded border border-slate-200"
                  >
                    <span className="font-mono font-bold text-slate-400 w-5">
                      {idx + 1}.
                    </span>
                    <input
                      type="text"
                      value={term}
                      onChange={(e) => handleTermChange(idx, e.target.value)}
                      className="flex-1 bg-transparent border-none text-slate-800 focus:outline-hidden"
                    />
                    <div className="flex items-center gap-1">
                      <button
                        type="button"
                        onClick={() => handleMoveTerm(idx, -1)}
                        disabled={idx === 0}
                        className="p-1 text-slate-400 hover:text-slate-700 disabled:opacity-20"
                      >
                        <ArrowUp className="w-3.5 h-3.5" />
                      </button>
                      <button
                        type="button"
                        onClick={() => handleMoveTerm(idx, 1)}
                        disabled={idx === form.termsAndConditions.length - 1}
                        className="p-1 text-slate-400 hover:text-slate-700 disabled:opacity-20"
                      >
                        <ArrowDown className="w-3.5 h-3.5" />
                      </button>
                      <button
                        type="button"
                        onClick={() => handleDeleteTerm(idx)}
                        className="p-1 text-slate-400 hover:text-rose-600"
                      >
                        <Trash2 className="w-3.5 h-3.5" />
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            </div>

            {/* SECTION H: BANK DETAILS */}
            <div className="bg-white border border-slate-200 rounded-xl p-4 shadow-xs space-y-4">
              <div className="flex items-center justify-between border-b border-slate-100 pb-2">
                <div className="flex items-center gap-2">
                  <Building2 className="w-4 h-4 text-setu-600" />
                  <h3 className="font-bold text-slate-900 text-sm">
                    H. Bank Information & Remittance
                  </h3>
                </div>
                <button
                  type="button"
                  onClick={() =>
                    setForm((prev) => ({
                      ...prev,
                      bankDetails: { ...DEFAULT_BANK },
                    }))
                  }
                  className="text-[11px] font-bold text-setu-600 hover:underline"
                >
                  Reset Bank Details
                </button>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 text-xs">
                <div>
                  <label className="block font-bold text-slate-700 mb-1">
                    Bank Name
                  </label>
                  <input
                    type="text"
                    value={form.bankDetails.bankName}
                    onChange={(e) =>
                      setForm((prev) => ({
                        ...prev,
                        bankDetails: {
                          ...prev.bankDetails,
                          bankName: e.target.value,
                        },
                      }))
                    }
                    className="w-full p-2 bg-slate-50 border border-slate-300 rounded font-bold text-slate-900"
                  />
                </div>

                <div>
                  <label className="block font-bold text-slate-700 mb-1">
                    Account Holder / Beneficiary
                  </label>
                  <input
                    type="text"
                    value={form.bankDetails.accountHolder}
                    onChange={(e) =>
                      setForm((prev) => ({
                        ...prev,
                        bankDetails: {
                          ...prev.bankDetails,
                          accountHolder: e.target.value,
                        },
                      }))
                    }
                    className="w-full p-2 bg-slate-50 border border-slate-300 rounded font-bold text-slate-900"
                  />
                </div>

                <div>
                  <label className="block font-bold text-slate-700 mb-1">
                    Account Number
                  </label>
                  <input
                    type="text"
                    value={form.bankDetails.accountNumber}
                    onChange={(e) =>
                      setForm((prev) => ({
                        ...prev,
                        bankDetails: {
                          ...prev.bankDetails,
                          accountNumber: e.target.value,
                        },
                      }))
                    }
                    className="w-full p-2 bg-slate-50 border border-slate-300 rounded font-mono font-bold text-slate-900"
                  />
                </div>

                <div>
                  <label className="block font-bold text-slate-700 mb-1">
                    IFSC Code
                  </label>
                  <input
                    type="text"
                    value={form.bankDetails.ifscCode}
                    onChange={(e) =>
                      setForm((prev) => ({
                        ...prev,
                        bankDetails: {
                          ...prev.bankDetails,
                          ifscCode: e.target.value.toUpperCase(),
                        },
                      }))
                    }
                    className="w-full p-2 bg-slate-50 border border-slate-300 rounded font-mono font-bold text-slate-900"
                  />
                </div>

                <div>
                  <label className="block font-bold text-slate-700 mb-1">
                    Branch Name
                  </label>
                  <input
                    type="text"
                    value={form.bankDetails.branchName}
                    onChange={(e) =>
                      setForm((prev) => ({
                        ...prev,
                        bankDetails: {
                          ...prev.bankDetails,
                          branchName: e.target.value,
                        },
                      }))
                    }
                    className="w-full p-2 bg-slate-50 border border-slate-300 rounded text-slate-900"
                  />
                </div>

                <div>
                  <label className="block font-bold text-slate-700 mb-1">
                    UPI ID (Optional)
                  </label>
                  <input
                    type="text"
                    value={form.bankDetails.upiId}
                    onChange={(e) =>
                      setForm((prev) => ({
                        ...prev,
                        bankDetails: {
                          ...prev.bankDetails,
                          upiId: e.target.value,
                        },
                      }))
                    }
                    className="w-full p-2 bg-slate-50 border border-slate-300 rounded font-mono text-slate-900"
                    placeholder="speedsetu@hdfcbank"
                  />
                </div>
              </div>
            </div>

            {/* SECTION I: SIGNATORY & FOOTER */}
            <div className="bg-white border border-slate-200 rounded-xl p-4 shadow-xs space-y-4">
              <div className="flex items-center justify-between border-b border-slate-100 pb-2">
                <div className="flex items-center gap-2">
                  <User className="w-4 h-4 text-setu-600" />
                  <h3 className="font-bold text-slate-900 text-sm">
                    I. Authorised Signatory & Footer
                  </h3>
                </div>
                <span className="text-[11px] font-bold text-slate-500">
                  Sign-off
                </span>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 text-xs">
                <div>
                  <label className="block font-bold text-slate-700 mb-1">
                    Signatory Name
                  </label>
                  <input
                    type="text"
                    value={form.signatory.name}
                    onChange={(e) =>
                      setForm((prev) => ({
                        ...prev,
                        signatory: { ...prev.signatory, name: e.target.value },
                      }))
                    }
                    className="w-full p-2 bg-slate-50 border border-slate-300 rounded font-bold text-slate-900"
                  />
                </div>

                <div>
                  <label className="block font-bold text-slate-700 mb-1">
                    Designation
                  </label>
                  <input
                    type="text"
                    value={form.signatory.designation}
                    onChange={(e) =>
                      setForm((prev) => ({
                        ...prev,
                        signatory: {
                          ...prev.signatory,
                          designation: e.target.value,
                        },
                      }))
                    }
                    className="w-full p-2 bg-slate-50 border border-slate-300 rounded text-slate-900"
                  />
                </div>

                <div className="sm:col-span-2">
                  <label className="block font-bold text-slate-700 mb-1">
                    Signature Image (Upload or URL)
                  </label>
                  <div className="flex items-center gap-2">
                    <input
                      type="text"
                      placeholder="Paste Signature Image URL or choose file..."
                      value={form.signatory.signatureUrl}
                      onChange={(e) =>
                        setForm((prev) => ({
                          ...prev,
                          signatory: {
                            ...prev.signatory,
                            signatureUrl: e.target.value,
                          },
                        }))
                      }
                      className="flex-1 p-2 bg-slate-50 border border-slate-300 rounded text-xs font-mono"
                    />
                    <label className="px-3 py-2 bg-slate-100 hover:bg-slate-200 border border-slate-300 rounded cursor-pointer font-bold flex items-center gap-1.5 transition-colors">
                      <Upload className="w-3.5 h-3.5 text-slate-600" />
                      <span>Upload</span>
                      <input
                        type="file"
                        accept="image/*"
                        className="hidden"
                        onChange={(e) => handleImageUpload(e, "signature")}
                      />
                    </label>
                  </div>
                </div>

                <div className="sm:col-span-2">
                  <label className="block font-bold text-slate-700 mb-1">
                    Footer Notes / Jurisdiction Disclaimer
                  </label>
                  <input
                    type="text"
                    value={form.signatory.footerNotes}
                    onChange={(e) =>
                      setForm((prev) => ({
                        ...prev,
                        signatory: {
                          ...prev.signatory,
                          footerNotes: e.target.value,
                        },
                      }))
                    }
                    className="w-full p-2 bg-slate-50 border border-slate-300 rounded text-slate-800"
                  />
                </div>
              </div>
            </div>

            {/* AUDIT SUMMARY INPUT */}
            <div className="bg-slate-50 border border-slate-200 rounded-xl p-3 text-xs space-y-1.5">
              <label className="block font-bold text-slate-700 uppercase tracking-wider text-[11px]">
                Reason / Summary for this Edit (Recorded in Audit Log)
              </label>
              <input
                type="text"
                value={changeSummary}
                onChange={(e) => setChangeSummary(e.target.value)}
                placeholder="e.g. Adjusted shipment weight and corrected customer billing address as per client request"
                className="w-full p-2 bg-white border border-slate-300 rounded font-medium text-slate-900"
              />
            </div>

            {/* BOTTOM SAVE ACTIONS */}
            <div className="flex items-center justify-end gap-3 pt-2">
              <button
                type="button"
                onClick={() => {
                  if (isDirty) setShowCancelPrompt(true);
                  else onCancel();
                }}
                className="px-4 py-2 text-xs font-bold text-slate-700 bg-white border border-slate-300 rounded-lg hover:bg-slate-50"
              >
                Discard & Return
              </button>
              <button
                type="button"
                onClick={handleSaveClick}
                disabled={saving}
                className={`px-6 py-2 text-xs font-bold rounded-lg shadow flex items-center gap-2 transition-colors ${
                  hasDuplicateErrors
                    ? "bg-rose-600 hover:bg-rose-700 text-white cursor-not-allowed"
                    : "bg-emerald-600 hover:bg-emerald-500 text-white"
                }`}
              >
                <Save className="w-4 h-4" />
                <span>
                  {saving
                    ? "Saving..."
                    : hasDuplicateErrors
                      ? "Blocked: Fix Conflicts"
                      : "Save & Persist Changes"}
                </span>
              </button>
            </div>
          </div>
        )}

        {/* RIGHT COLUMN: LIVE SYNCHRONIZED PRINT & PDF PREVIEW */}
        {(viewMode === "preview" || viewMode === "split") && (
          <div
            className={`${viewMode === "split" ? "lg:col-span-6 xl:col-span-5" : "col-span-1"} space-y-3`}
          >
            <div className="bg-white border border-slate-200 rounded-xl p-3 shadow-xs flex items-center justify-between text-xs sticky top-20 z-20">
              <div className="flex items-center gap-2 font-bold text-slate-800">
                <Printer className="w-4 h-4 text-setu-600" />
                <span>Live Synchronized Print Preview</span>
              </div>
              <button
                type="button"
                onClick={() => window.print()}
                className="px-3 py-1 bg-setu-600 hover:bg-setu-700 text-white rounded font-bold flex items-center gap-1 shadow-xs"
              >
                <Printer className="w-3.5 h-3.5" />
                <span>Print Test</span>
              </button>
            </div>

            {/* Scaled/Scrollable Paper Container */}
            <div className="border border-slate-300 rounded-xl bg-slate-200/70 p-2 sm:p-4 shadow-inner overflow-x-auto">
              <div className="shadow-lg bg-white rounded">
                <InvoicePrintView invoice={liveInvoice} />
              </div>
            </div>
          </div>
        )}
      </div>

      {/* UNSAVED CHANGES CONFIRMATION DIALOG */}
      {showCancelPrompt && (
        <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-xs flex items-center justify-center p-4 z-50">
          <div className="bg-white rounded-xl p-6 max-w-md w-full shadow-2xl space-y-4">
            <div className="flex items-center gap-3 text-amber-600">
              <AlertCircle className="w-6 h-6" />
              <h3 className="font-bold text-slate-900 text-base">
                Discard Unsaved Changes?
              </h3>
            </div>
            <p className="text-xs text-slate-600 leading-relaxed">
              You have made modifications to this invoice that have not yet been
              saved to MongoDB. Are you sure you want to discard your edits and
              return to view mode?
            </p>
            <div className="flex justify-end gap-2 pt-2 text-xs">
              <button
                type="button"
                onClick={() => setShowCancelPrompt(false)}
                className="px-3.5 py-2 font-bold text-slate-700 bg-slate-100 hover:bg-slate-200 rounded-lg"
              >
                Keep Editing
              </button>
              <button
                type="button"
                onClick={() => {
                  setShowCancelPrompt(false);
                  onCancel();
                }}
                className="px-4 py-2 font-bold text-white bg-rose-600 hover:bg-rose-700 rounded-lg"
              >
                Discard Changes
              </button>
            </div>
          </div>
        </div>
      )}

      {/* RECORDED PAYMENT WARNING MODAL */}
      {showPaidWarning && (
        <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-xs flex items-center justify-center p-4 z-50">
          <div className="bg-white rounded-xl p-6 max-w-md w-full shadow-2xl space-y-4">
            <div className="flex items-center gap-3 text-rose-600">
              <ShieldAlert className="w-6 h-6" />
              <h3 className="font-bold text-slate-900 text-base">
                Recorded Payment Warning
              </h3>
            </div>
            <div className="p-3 bg-amber-50 border border-amber-200 rounded text-xs text-amber-900 space-y-1">
              <div>
                This invoice currently has{" "}
                <strong className="text-emerald-700">
                  {formatINR(initialInvoice.paidAmount || 0)}
                </strong>{" "}
                in recorded customer payments.
              </div>
              <div>
                Changing the grand total to{" "}
                <strong className="font-mono">
                  {formatINR(liveInvoice.grandTotal)}
                </strong>{" "}
                will update the outstanding balance due to{" "}
                <strong className="font-mono">
                  {formatINR(
                    Math.max(
                      0,
                      liveInvoice.grandTotal - (initialInvoice.paidAmount || 0),
                    ),
                  )}
                </strong>
                .
              </div>
            </div>
            <p className="text-xs text-slate-600">
              Do you wish to confirm and persist these changes?
            </p>
            <div className="flex justify-end gap-2 pt-2 text-xs">
              <button
                type="button"
                onClick={() => setShowPaidWarning(false)}
                className="px-3.5 py-2 font-bold text-slate-700 bg-slate-100 hover:bg-slate-200 rounded-lg"
              >
                Review Edits
              </button>
              <button
                type="button"
                onClick={executeSave}
                disabled={saving}
                className="px-4 py-2 font-bold text-white bg-emerald-600 hover:bg-emerald-500 rounded-lg"
              >
                Confirm & Persist
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
