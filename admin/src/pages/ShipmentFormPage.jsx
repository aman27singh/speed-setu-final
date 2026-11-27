import React, { useState, useEffect, useRef } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { shipmentService } from '../services/shipmentService';
import { companyService } from '../services/companyService';
import { consignorConsigneeService } from '../services/consignorConsigneeService';
import { validateShipmentForm } from '../utils/shipmentValidation';
import { pricingService } from '../services/pricingService';
import { PageHeader } from '../components/common/PageHeader';
import { LoadingState } from '../components/common/LoadingState';
import { Modal } from '../components/common/Modal';
import { ConsignmentNoteModal } from '../components/shipment/ConsignmentNoteModal';
import { useAuth } from '../context/AuthContext';
import {
  Package,
  Building2,
  User,
  MapPin,
  Truck,
  FileText,
  Save,
  ArrowLeft,
  AlertCircle,
  AlertTriangle,
  CheckCircle2,
  Calendar,
  CreditCard,
  Plus,
  Trash2
} from 'lucide-react';

const MODE_OPTIONS = ['Air', 'Air Express', 'Road', 'Train', 'FTL', 'Express LTL', 'Other'];
const INDIAN_STATES = [
  'Andhra Pradesh', 'Arunachal Pradesh', 'Assam', 'Bihar', 'Chhattisgarh', 'Delhi', 'Goa',
  'Gujarat', 'Haryana', 'Himachal Pradesh', 'Jharkhand', 'Karnataka', 'Kerala', 'Madhya Pradesh',
  'Maharashtra', 'Manipur', 'Meghalaya', 'Mizoram', 'Nagaland', 'Odisha', 'Punjab', 'Rajasthan',
  'Sikkim', 'Tamil Nadu', 'Telangana', 'Tripura', 'Uttar Pradesh', 'Uttarakhand', 'West Bengal'
];

const DEFAULT_CONSIGNORS = [];
const DEFAULT_CONSIGNEES = [];

const INITIAL_FORM_STATE = {
  cnNumber: '',
  cnDate: new Date().toISOString().split('T')[0],
  companyId: '',
  companyName: '',
  companyCode: '',

  consignorId: '',
  consigneeId: '',

  consignor: {
    name: '',
    code: '',
    gstin: '',
    address: '',
    city: '',
    state: '',
    pin: '',
    contact: '',
    pickupDeliveryLocation: ''
  },

  consignee: {
    name: '',
    code: '',
    gstin: '',
    address: '',
    city: '',
    state: '',
    pin: '',
    contact: '',
    pickupDeliveryLocation: ''
  },

  origin: '',
  destination: '',
  mode: 'Air',
  packages: '',
  actualWeight: '',
  chargeableWeight: '',
  materialDescription: '',
  packingCharges: '',
  laborCharges: '',
  pickupCharges: '',
  deliveryCharges: '',
  godownCharges: '',
  godownMonths: '',
  godownRatePerMonth: '',
  godownDays: '',
  godownRatePerDay: '',
  isGodownOnlyBilling: false,

  commercialInvoices: [
    {
      invoiceNumber: '',
      invoiceDate: '',
      invoiceQuantity: '',
      invoiceValue: '',
      ewayBillNumber: ''
    }
  ],

  invoiceDetails: {
    invoiceNumber: '',
    invoiceDate: '',
    invoiceValue: 0,
    invoiceQuantity: ''
  },

  ewayBillNumber: '',
  awbNumber: '',

  operational: {
    pickupDate: new Date().toISOString().split('T')[0],
    expectedDeliveryDate: '',
    currentLocation: '',
    tripId: '',
    transporter: 'Speed Setu Express Fleet',
    driver: '',
    vehicle: ''
  },

  status: 'Booked',
  podStatus: 'Pending',
  billingStatus: 'Not Ready'
};

const toISODate = (dateStr) => {
  if (!dateStr) return '';
  if (/^\d{4}-\d{2}-\d{2}$/.test(dateStr)) return dateStr;
  if (/^\d{1,2}[\/\-]\d{1,2}[\/\-]\d{4}$/.test(dateStr)) {
    const parts = dateStr.split(/[\/\-]/);
    const d = parts[0].padStart(2, '0');
    const m = parts[1].padStart(2, '0');
    const y = parts[2];
    return `${y}-${m}-${d}`;
  }
  const parsed = new Date(dateStr);
  if (!isNaN(parsed.getTime())) {
    return parsed.toISOString().split('T')[0];
  }
  return dateStr;
};

const getFilteredAndRankedList = (list, searchTerm) => {
  if (!list || !Array.isArray(list)) return [];
  if (!searchTerm || !searchTerm.trim()) {
    return list.slice().sort((a, b) => (a.name || '').trim().localeCompare((b.name || '').trim(), 'en', { sensitivity: 'base' }));
  }

  const query = searchTerm.trim().toLowerCase();

  const scoreItem = (item) => {
    const name = (item.name || '').trim().toLowerCase();
    const code = (item.code || '').trim().toLowerCase();
    const city = (item.city || '').trim().toLowerCase();
    const pickupLoc = (item.pickupDeliveryLocation || '').trim().toLowerCase();
    const gst = (item.gstin || '').trim().toLowerCase();
    const pin = (item.pin || '').trim().toLowerCase();

    // Priority 1: Exact or prefix match on company name or company code (e.g. "ADVIK" or "CC101")
    if (name.startsWith(query) || code.startsWith(query)) return 1;

    // Priority 2: Any word in company name starts with query (e.g. "AUTOCOMP" in "ADVIK AUTOCOMP")
    const nameWords = name.split(/[\s\-\_\.\,\/\(\)]+/).filter(Boolean);
    if (nameWords.some((w) => w.startsWith(query))) return 2;

    // Priority 3: Pickup/Delivery location or City starts with query (e.g. "HOSUR" or "BANGALORE")
    if (pickupLoc.startsWith(query) || city.startsWith(query)) return 3;

    // Priority 4: Partial substring match anywhere in company name or company code
    if (name.includes(query) || code.includes(query)) return 4;

    // Priority 5: Partial substring match in pickup/delivery location, city, pin, or GST
    if (pickupLoc.includes(query) || city.includes(query) || pin.includes(query) || gst.includes(query)) return 5;

    return 999;
  };

  return list
    .filter((item) => scoreItem(item) < 999)
    .sort((a, b) => {
      const scoreA = scoreItem(a);
      const scoreB = scoreItem(b);
      if (scoreA !== scoreB) {
        return scoreA - scoreB;
      }
      return (a.name || '').trim().localeCompare((b.name || '').trim(), 'en', { sensitivity: 'base' });
    });
};

export const ShipmentFormPage = () => {
  const navigate = useNavigate();
  const { id } = useParams();
  const isEditMode = !!id;
  const { user, isDriver } = useAuth();
  const isDriverUser = isDriver || user?.role === 'Driver';

  const [formMode, setFormMode] = useState(isDriverUser ? 'driver' : 'driver');
  const [formData, setFormData] = useState(INITIAL_FORM_STATE);
  const [companies, setCompanies] = useState([]);
  const [errors, setErrors] = useState({});
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [cnDuplicateError, setCnDuplicateError] = useState(null);
  const [awbDuplicateError, setAwbDuplicateError] = useState(null);

  // Consignor & Consignee Dropdown Select State
  const [consignorSelectMode, setConsignorSelectMode] = useState('');
  const [consigneeSelectMode, setConsigneeSelectMode] = useState('');
  const [savedConsignorsList, setSavedConsignorsList] = useState(DEFAULT_CONSIGNORS);
  const [savedConsigneesList, setSavedConsigneesList] = useState(DEFAULT_CONSIGNEES);

  // Live Search Auto-complete States
  const [consignorSearchTerm, setConsignorSearchTerm] = useState('');
  const [consigneeSearchTerm, setConsigneeSearchTerm] = useState('');
  const [showConsignorSuggestions, setShowConsignorSuggestions] = useState(false);
  const [showConsigneeSuggestions, setShowConsigneeSuggestions] = useState(false);

  // Success Modal State
  const [createdCN, setCreatedCN] = useState(null);
  const [createdId, setCreatedId] = useState(null);
  const [createdShipment, setCreatedShipment] = useState(null);
  const [showCNModal, setShowCNModal] = useState(false);

  // Pricing & Quotation Coverage Validation
  const [pricingValidation, setPricingValidation] = useState(null);
  const [validatingPricing, setValidatingPricing] = useState(false);
  const [showUnpricedConfirmModal, setShowUnpricedConfirmModal] = useState(false);
  const [pendingSubmit, setPendingSubmit] = useState(null);
  const lastAppliedPricingKeyRef = useRef(null);
  const lastLaneKeyRef = useRef('');
  const manualEditedFieldsRef = useRef(new Set());

  const computeLaneKey = (data) => {
    const comp = String(data?.companyId || data?.companyName || '').trim().toLowerCase();
    const orig = String(data?.origin || data?.consignor?.pickupDeliveryLocation || data?.consignor?.city || '').trim().toUpperCase();
    const dest = String(data?.destination || data?.consignee?.pickupDeliveryLocation || data?.consignee?.city || '').trim().toUpperCase();
    const m = String(data?.freightMode || data?.mode || '').trim().toLowerCase();
    return `${comp}|${orig}|${dest}|${m}`;
  };

  const extractChargeAmounts = (res) => {
    const snap = res?.pricingSnapshot || {};
    const rule = res?.appliedRuleSnapshot || {};
    const additionalList =
      (Array.isArray(snap.additionalCharges) && snap.additionalCharges.length > 0)
        ? snap.additionalCharges
        : (Array.isArray(rule.additionalCharges) ? rule.additionalCharges : []);

    let parsedDocket = 0;
    let parsedPickup = 0;
    let parsedDelivery = 0;
    let parsedPacking = 0;
    let parsedLabor = 0;
    let parsedGodown = 0;
    let parsedOther = 0;

    for (const chg of additionalList) {
      const name = (chg.name || chg.chargeName || chg.type || '').toLowerCase();
      const val = typeof chg.amount === 'number' ? chg.amount : (parseFloat(chg.amount || chg.rate || chg.value) || 0);
      if (name.includes('docket') || name.includes('lr') || name.includes('bilty') || name.includes('cn charge')) {
        parsedDocket += val;
      } else if (name.includes('pickup') || name.includes('first mile')) {
        parsedPickup += val;
      } else if (name.includes('delivery') || name.includes('door delivery') || name.includes('last mile')) {
        parsedDelivery += val;
      } else if (name.includes('packing') || name.includes('packaging')) {
        parsedPacking += val;
      } else if (name.includes('labor') || name.includes('labour') || name.includes('loading') || name.includes('unloading') || name.includes('handling')) {
        parsedLabor += val;
      } else if (name.includes('godown') || name.includes('storage') || name.includes('demurrage') || name.includes('warehouse')) {
        parsedGodown += val;
      } else {
        parsedOther += val;
      }
    }

    const docketAmt = typeof snap.docketCharges === 'number' && snap.docketCharges > 0 ? snap.docketCharges : parsedDocket;
    const pickupAmt = typeof snap.pickupCharges === 'number' && snap.pickupCharges > 0 ? snap.pickupCharges : parsedPickup;
    const deliveryAmt = typeof snap.deliveryCharges === 'number' && snap.deliveryCharges > 0 ? snap.deliveryCharges : parsedDelivery;
    const packingAmt = typeof snap.packingCharges === 'number' && snap.packingCharges > 0 ? snap.packingCharges : parsedPacking;
    const laborAmt = typeof snap.laborCharges === 'number' && snap.laborCharges > 0 ? snap.laborCharges : parsedLabor;
    const godownAmt = typeof snap.godownCharges === 'number' && snap.godownCharges > 0 ? snap.godownCharges : parsedGodown;
    const otherAmt = typeof snap.otherCharges === 'number' && snap.otherCharges > 0 ? snap.otherCharges : parsedOther;

    const taxConfig = snap.taxConfiguration || rule.taxConfiguration || { applicable: true, gstRate: 18 };
    const gstApplicable = taxConfig.applicable !== false;
    const gstRateVal = gstApplicable
      ? (taxConfig.gstRate !== undefined ? taxConfig.gstRate : (snap.gstPercentage !== undefined ? snap.gstPercentage : 18))
      : 0;
    const isGstExempt = !gstApplicable || gstRateVal === 0;
    const isRcm = Boolean(
      snap.isRcm ||
      taxConfig.isRcm ||
      taxConfig.rcm ||
      taxConfig.reverseCharge ||
      /rcm|reverse\s*charge/i.test(String(taxConfig.notes || ''))
    );

    return {
      baseFreight: res?.appliedRate ?? snap.baseFreightRate ?? rule.freightRate ?? 0,
      rateBasis: res?.rateBasis || snap.rateBasis || rule.rateBasis || 'Per KG',
      minWeight: res?.minimumChargeableWeight ?? snap.minimumWeight ?? rule.minimumChargeableWeight ?? 50,
      docketAmt,
      pickupAmt,
      deliveryAmt,
      packingAmt,
      laborAmt,
      godownAmt,
      otherAmt,
      additionalList,
      taxConfig: { ...taxConfig, isRcm },
      gstRateVal,
      isGstExempt,
      isRcm
    };
  };

  const checkPricingCoverage = async (overrideForm = null) => {
    const data = overrideForm || formData;
    if (!data.companyId && !data.companyName) {
      setPricingValidation(null);
      return null;
    }
    const currentOrigin = data.origin || data.consignor?.pickupDeliveryLocation || data.consignor?.city || '';
    const currentDest = data.destination || data.consignee?.pickupDeliveryLocation || data.consignee?.city || '';
    const currentLaneKey = computeLaneKey(data);
    const laneChanged = Boolean(lastLaneKeyRef.current && lastLaneKeyRef.current !== currentLaneKey);

    // When Company, Origin, Destination, or Mode changes, clear manual field locks so the new rate card updates fields cleanly
    if (laneChanged) {
      manualEditedFieldsRef.current.clear();
    }
    lastLaneKeyRef.current = currentLaneKey;

    setValidatingPricing(true);
    try {
      const res = await pricingService.validatePricing({
        companyId: data.companyId,
        companyCode: data.companyCode,
        companyName: data.companyName,
        origin: currentOrigin,
        destination: currentDest,
        freightMode: data.freightMode || data.mode,
        mode: data.mode || data.freightMode,
        date: data.cnDate || data.bookingDate
      });
      setPricingValidation(res);

      if (res?.status === 'MATCHED') {
        const extracted = extractChargeAmounts(res);
        const ruleKey = [
          res.source,
          res.quotationNumber || res.rateCardNumber,
          `v${res.agreementVersion || 1}`,
          res.origin,
          res.destination,
          res.freightMode,
          extracted.baseFreight,
          extracted.minWeight,
          extracted.docketAmt,
          extracted.pickupAmt,
          extracted.deliveryAmt,
          extracted.packingAmt,
          extracted.laborAmt,
          extracted.godownAmt,
          extracted.gstRateVal
        ].join(':');

        const ruleChanged = lastAppliedPricingKeyRef.current !== ruleKey;
        if (ruleChanged || laneChanged) {
          lastAppliedPricingKeyRef.current = ruleKey;
          const edited = manualEditedFieldsRef.current;

          setFormData((prev) => {
            const rawActual = parseFloat(prev.actualWeight) || 0;
            const prevChg = parseFloat(prev.chargeableWeight) || 0;
            const nextChargeable = edited.has('chargeableWeight') && !laneChanged
              ? prev.chargeableWeight
              : (rawActual > 0
                  ? Math.max(rawActual, extracted.minWeight)
                  : (prevChg === 0 || laneChanged || !isEditMode) && extracted.minWeight > 0
                    ? extracted.minWeight
                    : prev.chargeableWeight);

            const resolveField = (fieldName, rateCardVal) => {
              if (edited.has(fieldName) && !laneChanged) {
                return prev[fieldName];
              }
              return rateCardVal > 0 ? rateCardVal : 0;
            };

            return {
              ...prev,
              baseFreightRate: extracted.baseFreight,
              rateBasis: extracted.rateBasis,
              minimumWeight: extracted.minWeight,
              docketCharges: extracted.docketAmt,
              packingCharges: resolveField('packingCharges', extracted.packingAmt),
              laborCharges: resolveField('laborCharges', extracted.laborAmt),
              pickupCharges: resolveField('pickupCharges', extracted.pickupAmt),
              deliveryCharges: resolveField('deliveryCharges', extracted.deliveryAmt),
              godownCharges: resolveField('godownCharges', extracted.godownAmt),
              gstRate: (edited.has('gst') && !laneChanged) ? prev.gstRate : extracted.gstRateVal,
              isGstExempt: (edited.has('gst') && !laneChanged) ? prev.isGstExempt : extracted.isGstExempt,
              rcmApplicable: extracted.isRcm,
              taxConfiguration: extracted.taxConfig,
              chargeableWeight: nextChargeable
            };
          });
        }
      } else if ((res?.status === 'MISSING' || res?.status === 'PENDING_ROUTE') && (lastAppliedPricingKeyRef.current !== null || laneChanged)) {
        lastAppliedPricingKeyRef.current = null;
        const edited = manualEditedFieldsRef.current;
        setFormData((prev) => {
          const rawActual = parseFloat(prev.actualWeight) || 0;
          return {
            ...prev,
            baseFreightRate: 0,
            rateBasis: '',
            minimumWeight: 0,
            docketCharges: 0,
            packingCharges: (!edited.has('packingCharges') || laneChanged) ? 0 : prev.packingCharges,
            laborCharges: (!edited.has('laborCharges') || laneChanged) ? 0 : prev.laborCharges,
            pickupCharges: (!edited.has('pickupCharges') || laneChanged) ? 0 : prev.pickupCharges,
            deliveryCharges: (!edited.has('deliveryCharges') || laneChanged) ? 0 : prev.deliveryCharges,
            godownCharges: (!edited.has('godownCharges') || laneChanged) ? 0 : prev.godownCharges,
            gstRate: (!edited.has('gst') || laneChanged) ? 18 : prev.gstRate,
            isGstExempt: (!edited.has('gst') || laneChanged) ? false : prev.isGstExempt,
            rcmApplicable: false,
            taxConfiguration: null,
            chargeableWeight: (!edited.has('chargeableWeight') || laneChanged) ? (rawActual > 0 ? rawActual : 0) : prev.chargeableWeight
          };
        });
      }

      return res;
    } catch (e) {
      console.warn('Pricing validation check failed:', e.message);
      return null;
    } finally {
      setValidatingPricing(false);
    }
  };

  useEffect(() => {
    if (!formData.companyId && !formData.companyName) {
      setPricingValidation(null);
      return;
    }
    const timer = setTimeout(() => {
      checkPricingCoverage();
    }, 350);
    return () => clearTimeout(timer);
  }, [
    formData.companyId,
    formData.companyCode,
    formData.companyName,
    formData.origin,
    formData.destination,
    formData.consignor?.pickupDeliveryLocation,
    formData.consignee?.pickupDeliveryLocation,
    formData.consignor?.city,
    formData.consignee?.city,
    formData.mode,
    formData.freightMode,
    formData.cnDate,
    formData.bookingDate
  ]);

  const handleAddCommercialInvoice = () => {
    setFormData((prev) => ({
      ...prev,
      commercialInvoices: [
        ...(prev.commercialInvoices || []),
        { invoiceNumber: '', invoiceDate: '', invoiceQuantity: '', invoiceValue: 0, ewayBillNumber: '', awbNumber: '' }
      ]
    }));
  };

  const handleRemoveCommercialInvoice = (idx) => {
    setFormData((prev) => {
      const updated = (prev.commercialInvoices || []).filter((_, i) => i !== idx);
      const safeList = updated.length > 0 ? updated : [{ invoiceNumber: '', invoiceDate: '', invoiceQuantity: '', invoiceValue: 0, ewayBillNumber: '', awbNumber: '' }];
      const totalVal = safeList.reduce((sum, inv) => sum + (parseFloat(inv.invoiceValue) || 0), 0);
      const hasAnyQty = safeList.some((inv) => inv.invoiceQuantity !== '' && inv.invoiceQuantity !== undefined && inv.invoiceQuantity !== null && inv.invoiceQuantity !== 0 && inv.invoiceQuantity !== '0');
      const totalQty = hasAnyQty ? safeList.reduce((sum, inv) => sum + (parseInt(inv.invoiceQuantity, 10) || 0), 0) : '';
      const combinedInvoices = safeList.map((inv) => inv.invoiceNumber).filter(Boolean).join(', ');
      const combinedEway = safeList.map((inv) => inv.ewayBillNumber).filter(Boolean).join(', ');
      const combinedAwb = safeList.map((inv) => inv.awbNumber).filter(Boolean).join(', ');
      const firstInvoiceDate = safeList.find((inv) => inv.invoiceDate)?.invoiceDate || '';

      return {
        ...prev,
        commercialInvoices: safeList,
        invoiceDetails: {
          ...prev.invoiceDetails,
          invoiceNumber: combinedInvoices || prev.invoiceDetails?.invoiceNumber || '',
          invoiceDate: firstInvoiceDate || prev.invoiceDetails?.invoiceDate || '',
          invoiceValue: totalVal,
          invoiceQuantity: totalQty
        },
        ewayBillNumber: combinedEway || prev.ewayBillNumber || '',
        awbNumber: combinedAwb || prev.awbNumber || ''
      };
    });
  };

  const handleCommercialInvoiceChange = (idx, field, value) => {
    setFormData((prev) => {
      const list = [...(prev.commercialInvoices || [])];
      if (!list[idx]) list[idx] = { invoiceNumber: '', invoiceDate: '', invoiceQuantity: '', invoiceValue: 0, ewayBillNumber: '', awbNumber: '' };
      list[idx] = { ...list[idx], [field]: value };

      const totalVal = list.reduce((sum, inv) => sum + (parseFloat(inv.invoiceValue) || 0), 0);
      const hasAnyQty = list.some((inv) => inv.invoiceQuantity !== '' && inv.invoiceQuantity !== undefined && inv.invoiceQuantity !== null && inv.invoiceQuantity !== 0 && inv.invoiceQuantity !== '0');
      const totalQty = hasAnyQty ? list.reduce((sum, inv) => sum + (parseInt(inv.invoiceQuantity, 10) || 0), 0) : '';
      const combinedInvoices = list.map((inv) => inv.invoiceNumber).filter(Boolean).join(', ');
      const combinedEway = list.map((inv) => inv.ewayBillNumber).filter(Boolean).join(', ');
      const combinedAwb = list.map((inv) => inv.awbNumber).filter(Boolean).join(', ');
      const firstInvoiceDate = list.find((inv) => inv.invoiceDate)?.invoiceDate || '';

      return {
        ...prev,
        commercialInvoices: list,
        invoiceDetails: {
          ...prev.invoiceDetails,
          invoiceNumber: combinedInvoices || prev.invoiceDetails?.invoiceNumber || '',
          invoiceDate: firstInvoiceDate || prev.invoiceDetails?.invoiceDate || '',
          invoiceValue: totalVal,
          invoiceQuantity: totalQty
        },
        ewayBillNumber: combinedEway || prev.ewayBillNumber || '',
        awbNumber: combinedAwb || prev.awbNumber || ''
      };
    });
  };

  // Refresh active parties strictly from centralized Consignor & Consignee Master Directory
  const refreshMasterParties = async () => {
    try {
      const masterParties = await consignorConsigneeService.getActiveParties();
      const savedParties = (masterParties || []).map((p) => ({
        id: p.id || p._id,
        name: (p.companyName || '').trim().toUpperCase(),
        code: (p.companyCode || '').trim().toUpperCase(),
        gstin: (p.gstNumber || '').trim().toUpperCase(),
        address: p.fullAddress || p.address?.addressLine1 || '',
        addressLine1: p.address?.addressLine1 || '',
        addressLine2: p.address?.addressLine2 || '',
        city: p.address?.city || '',
        state: p.address?.state || '',
        pin: p.address?.pinCode || '',
        contact: p.mobileNumber || p.contactPerson || '',
        pickupDeliveryLocation: (p.pickupDeliveryLocation || '').trim().toUpperCase()
      })).sort((a, b) =>
        (a.name || '').localeCompare((b.name || ''), 'en', { sensitivity: 'base' })
      );

      setSavedConsignorsList(savedParties);
      setSavedConsigneesList(savedParties);
      return savedParties;
    } catch (partyErr) {
      console.warn('[ShipmentFormPage] Error refreshing master party records:', partyErr.message);
      return [];
    }
  };

  useEffect(() => {
    const loadInitialData = async () => {
      setLoading(true);
      try {
        const [compList, masterParties] = await Promise.all([
          companyService.getCompanies().catch(() => []),
          consignorConsigneeService.getActiveParties().catch(() => [])
        ]);
        setCompanies(compList);

        // EXCLUSIVELY map from active saved records in centralized MongoDB consignorConsignee collection
        // Historical shipment records are NEVER included as fallback
        const savedParties = (masterParties || []).map((p) => ({
          id: p.id || p._id,
          name: (p.companyName || '').trim().toUpperCase(),
          code: (p.companyCode || '').trim().toUpperCase(),
          gstin: (p.gstNumber || '').trim().toUpperCase(),
          address: p.fullAddress || p.address?.addressLine1 || '',
          addressLine1: p.address?.addressLine1 || '',
          addressLine2: p.address?.addressLine2 || '',
          city: p.address?.city || '',
          state: p.address?.state || '',
          pin: p.address?.pinCode || '',
          contact: p.mobileNumber || p.contactPerson || '',
          pickupDeliveryLocation: (p.pickupDeliveryLocation || '').trim().toUpperCase()
        })).sort((a, b) =>
          (a.name || '').localeCompare((b.name || ''), 'en', { sensitivity: 'base' })
        );

        setSavedConsignorsList(savedParties);
        setSavedConsigneesList(savedParties);

        if (isEditMode) {
          const existing = await shipmentService.getShipment(id);
          const commInvoices = existing.commercialInvoices && existing.commercialInvoices.length > 0
            ? existing.commercialInvoices.map((inv) => ({
                invoiceNumber: inv.invoiceNumber || '',
                invoiceDate: inv.invoiceDate || existing.invoiceDetails?.invoiceDate || '',
                invoiceQuantity: inv.invoiceQuantity !== undefined && inv.invoiceQuantity !== null ? inv.invoiceQuantity : '',
                invoiceValue: inv.invoiceValue || 0,
                ewayBillNumber: inv.ewayBillNumber || '',
                awbNumber: inv.awbNumber || ''
              }))
            : [
                {
                  invoiceNumber: existing.invoiceDetails?.invoiceNumber || '',
                  invoiceDate: existing.invoiceDetails?.invoiceDate || '',
                  invoiceQuantity: existing.invoiceDetails?.invoiceQuantity || '',
                  invoiceValue: existing.invoiceDetails?.invoiceValue || 0,
                  ewayBillNumber: existing.ewayBillNumber || '',
                  awbNumber: existing.awbNumber || ''
                }
              ];
          lastLaneKeyRef.current = computeLaneKey(existing);
          const editedSet = new Set();
          const hasOverride = Boolean(existing.pricingValidation?.pricingSnapshot?.shipmentChargesOverride);
          if (hasOverride) {
            ['packingCharges', 'laborCharges', 'pickupCharges', 'deliveryCharges', 'godownCharges', 'chargeableWeight', 'gst'].forEach((k) => editedSet.add(k));
          } else {
            if ((Number(existing.packingCharges) || 0) > 0) editedSet.add('packingCharges');
            if ((Number(existing.laborCharges) || 0) > 0) editedSet.add('laborCharges');
            if ((Number(existing.pickupCharges) || 0) > 0) editedSet.add('pickupCharges');
            if ((Number(existing.deliveryCharges) || 0) > 0) editedSet.add('deliveryCharges');
            if ((Number(existing.godownCharges) || 0) > 0) editedSet.add('godownCharges');
            if ((Number(existing.chargeableWeight) || 0) > 0) editedSet.add('chargeableWeight');
          }
          manualEditedFieldsRef.current = editedSet;

          setFormData({
            ...existing,
            cnDate: toISODate(existing.cnDate || existing.bookingDate),
            operational: {
              ...(existing.operational || {}),
              pickupDate: toISODate(existing.operational?.pickupDate || existing.cnDate || existing.bookingDate),
              expectedDeliveryDate: toISODate(existing.operational?.expectedDeliveryDate)
            },
            commercialInvoices: commInvoices
          });
          if (existing.consignor?.name) setConsignorSelectMode(existing.consignor.name);
          if (existing.consignee?.name) setConsigneeSelectMode(existing.consignee.name);
          if (existing.pricingValidation) setPricingValidation(existing.pricingValidation);
        } else {
          setFormData((prev) => ({
            ...prev,
            cnNumber: '',
            companyId: '',
            companyName: '',
            companyCode: '',
            origin: '',
            destination: '',
            consignor: {
              name: '',
              code: '',
              gstin: '',
              address: '',
              city: '',
              state: '',
              pin: '',
              contact: '',
              pickupDeliveryLocation: ''
            },
            consignee: {
              name: '',
              code: '',
              gstin: '',
              address: '',
              city: '',
              state: '',
              pin: '',
              contact: '',
              pickupDeliveryLocation: ''
            }
          }));
        }
      } catch (err) {
        alert(err.message || 'Failed to load form initialization.');
        navigate('/admin/shipments');
      } finally {
        setLoading(false);
      }
    };

    loadInitialData();
  }, [id, isEditMode, navigate]);

  const handleConsignorSelect = (val) => {
    setConsignorSelectMode(val);
    if (val === '__custom__') {
      setFormData((prev) => ({
        ...prev,
        consignor: {
          name: '',
          code: '',
          gstin: '',
          address: '',
          city: '',
          state: '',
          pin: '',
          contact: '',
          pickupDeliveryLocation: ''
        }
      }));
      return;
    }

    const found = typeof val === 'object'
      ? val
      : savedConsignorsList.find((c) => c.id === val || (c.code && c.code === val) || c.name === val);
    if (found) {
      // Auto-detect billing company from consignor if not already set
      let matchedComp = null;
      if (!formData.companyId) {
        const valNorm = (found.name || '').toLowerCase().trim();
        matchedComp = companies.find((comp) => {
          const compNorm = (comp.companyName || '').toLowerCase().trim();
          return compNorm && valNorm && (compNorm.includes(valNorm) || valNorm.includes(compNorm));
        });
      }

      setFormData((prev) => {
        const originLoc = (found.pickupDeliveryLocation || found.city || prev.origin || '').toUpperCase();
        return {
          ...prev,
          consignorId: found.id || '',
          origin: originLoc,
          ...(matchedComp ? {
            companyId: matchedComp.id,
            companyName: matchedComp.companyName,
            companyCode: matchedComp.companyCode
          } : {}),
          consignor: {
            ...prev.consignor,
            name: (found.name || '').toUpperCase(),
            code: (found.code || '').toUpperCase(),
            gstin: (found.gstin || '').toUpperCase(),
            contact: found.contact || '',
            address: found.address || '',
            city: found.city || '',
            state: found.state || '',
            pin: found.pin || '',
            pickupDeliveryLocation: (found.pickupDeliveryLocation || '').toUpperCase()
          }
        };
      });
    }
  };

  const handleConsigneeSelect = (val) => {
    setConsigneeSelectMode(val);
    if (val === '__custom__') {
      setFormData((prev) => ({
        ...prev,
        consignee: {
          name: '',
          code: '',
          gstin: '',
          address: '',
          city: '',
          state: '',
          pin: '',
          contact: '',
          pickupDeliveryLocation: ''
        }
      }));
      return;
    }

    const found = typeof val === 'object'
      ? val
      : savedConsigneesList.find((e) => e.id === val || (e.code && e.code === val) || e.name === val);
    if (found) {
      // Auto-detect billing company from consignee if not already set
      let matchedComp = null;
      if (!formData.companyId) {
        const valNorm = (found.name || '').toLowerCase().trim();
        matchedComp = companies.find((comp) => {
          const compNorm = (comp.companyName || '').toLowerCase().trim();
          return compNorm && valNorm && (compNorm.includes(valNorm) || valNorm.includes(compNorm));
        });
      }

      setFormData((prev) => {
        const destLoc = (found.pickupDeliveryLocation || found.city || prev.destination || '').toUpperCase();
        return {
          ...prev,
          consigneeId: found.id || '',
          destination: destLoc,
          ...(matchedComp ? {
            companyId: matchedComp.id,
            companyName: matchedComp.companyName,
            companyCode: matchedComp.companyCode
          } : {}),
          consignee: {
            ...prev.consignee,
            name: (found.name || '').toUpperCase(),
            code: (found.code || '').toUpperCase(),
            gstin: (found.gstin || '').toUpperCase(),
            contact: found.contact || '',
            address: found.address || '',
            city: found.city || '',
            state: found.state || '',
            pin: found.pin || '',
            pickupDeliveryLocation: (found.pickupDeliveryLocation || '').toUpperCase()
          }
        };
      });
    }
  };

  const handleAutofillSectionB = (compObj) => {
    const targetComp = compObj || companies.find((c) => c.id === formData.companyId);
    if (!targetComp) return;
    setFormData((prev) => ({
      ...prev,
      companyId: targetComp.id,
      companyName: targetComp.companyName,
      companyCode: targetComp.companyCode,
      origin: targetComp.billing?.city || prev.origin,
      consignor: {
        ...prev.consignor,
        name: `${targetComp.companyName} (Vendor Hub)`,
        code: targetComp.companyCode || '',
        gstin: targetComp.gstin || '',
        address: targetComp.billing?.address || '',
        city: targetComp.billing?.city || '',
        state: targetComp.billing?.state || '',
        pin: targetComp.billing?.pinCode || '',
        contact: targetComp.primaryContact?.phone || ''
      }
    }));
  };

  const handleAutofillSectionC = (compObj) => {
    const targetComp = compObj || companies.find((c) => c.id === formData.companyId);
    if (!targetComp) return;
    setFormData((prev) => ({
      ...prev,
      companyId: targetComp.id,
      companyName: targetComp.companyName,
      companyCode: targetComp.companyCode,
      destination: targetComp.billing?.city || prev.destination,
      consignee: {
        ...prev.consignee,
        name: targetComp.companyName,
        code: targetComp.companyCode || '',
        gstin: targetComp.gstin || '',
        address: targetComp.billing?.address || '',
        city: targetComp.billing?.city || '',
        state: targetComp.billing?.state || '',
        pin: targetComp.billing?.pinCode || '',
        contact: targetComp.primaryContact?.phone || ''
      }
    }));
  };

  const handleSelectCompany = (compObj) => {
    if (!compObj) return;
    setFormData((prev) => ({
      ...prev,
      companyId: compObj.id,
      companyName: compObj.companyName,
      companyCode: compObj.companyCode
    }));
  };

  const handleNestedInputChange = (section, field, value) => {
    setFormData((prev) => ({
      ...prev,
      [section]: {
        ...prev[section],
        [field]: value
      }
    }));
  };

  const renderPricingCoverageBanner = () => {
    if (!formData.companyId && !formData.companyName) {
      return (
        <div className="p-3 bg-slate-50 border border-slate-200 rounded-xl text-slate-500 text-xs flex items-center gap-2">
          <Building2 className="w-4 h-4 text-slate-400 shrink-0" />
          <span>Select a Client Company to validate quotation and rate card coverage for this shipment.</span>
        </div>
      );
    }

    if (validatingPricing) {
      return (
        <div className="p-3 bg-blue-50/70 border border-blue-200 rounded-xl text-blue-800 text-xs flex items-center gap-2 animate-pulse">
          <span className="w-4 h-4 border-2 border-blue-600 border-t-transparent rounded-full animate-spin shrink-0" />
          <span>Checking Company Quotation & Rate Card coverage for route...</span>
        </div>
      );
    }

    if (!pricingValidation) return null;

    if (pricingValidation.status === 'PENDING_ROUTE') {
      return (
        <div className="p-3.5 bg-blue-50/90 border border-blue-200 rounded-xl text-blue-950 text-xs space-y-1 shadow-xs">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2 font-bold text-blue-900 text-sm">
              <CheckCircle2 className="w-4 h-4 text-blue-600 shrink-0" />
              <span>✓ Active Quotation Found – {pricingValidation.quotationNumber}</span>
              <span className="px-2 py-0.5 text-[10px] font-mono bg-blue-100 text-blue-800 rounded font-semibold border border-blue-200">
                v{pricingValidation.quotationVersion || 1}
              </span>
            </div>
            <span className="text-[11px] font-bold text-blue-700 bg-blue-100 px-2 py-0.5 rounded border border-blue-200">
              {pricingValidation.totalRoutesCovered || 0} Routes Covered
            </span>
          </div>
          <p className="text-[11px] text-blue-800 leading-normal">
            Company quotation agreement is active on file. Select or enter <strong>Pickup Location (Origin)</strong> and <strong>Drop Location (Destination)</strong> below to validate agreed route pricing.
          </p>
        </div>
      );
    }

    if (pricingValidation.status === 'MATCHED' && pricingValidation.source === 'QUOTATION') {
      const details = extractChargeAmounts(pricingValidation);
      const otherAddl = details.additionalList.filter((chg) => {
        const n = (chg.name || chg.chargeName || chg.type || '').toLowerCase();
        return !n.includes('docket') && !n.includes('lr') && !n.includes('bilty') && !n.includes('cn charge') &&
               !n.includes('pickup') && !n.includes('first mile') &&
               !n.includes('delivery') && !n.includes('door delivery') && !n.includes('last mile');
      });

      return (
        <div className="p-3.5 bg-emerald-50 border border-emerald-300 rounded-xl text-emerald-950 text-xs space-y-2.5 shadow-xs">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <div className="flex flex-wrap items-center gap-2 font-bold text-emerald-900 text-sm">
              <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0" />
              <span>✓ Quotation Available</span>
              <span className="px-2 py-0.5 text-[10px] font-mono bg-emerald-100 text-emerald-800 rounded font-semibold border border-emerald-200">
                {pricingValidation.quotationNumber} | Version {pricingValidation.quotationVersion || 1}
              </span>
            </div>
            <span className="text-[11px] font-bold text-emerald-700 bg-emerald-100/80 px-2 py-0.5 rounded border border-emerald-200">
              Pricing Source: Company Quotation (Auto-Applied)
            </span>
          </div>

          <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 pt-1 font-mono text-[11px] bg-white/75 p-2.5 rounded-lg border border-emerald-200/80">
            <div>
              <span className="text-emerald-700/80 block text-[10px] uppercase font-sans font-bold">Route & Mode</span>
              <strong className="text-emerald-950">{pricingValidation.origin} → {pricingValidation.destination} ({pricingValidation.freightMode})</strong>
            </div>
            <div>
              <span className="text-emerald-700/80 block text-[10px] uppercase font-sans font-bold">Base Freight ({details.rateBasis})</span>
              <strong className="text-emerald-950">₹{details.baseFreight} / {details.rateBasis}</strong>
            </div>
            <div>
              <span className="text-emerald-700/80 block text-[10px] uppercase font-sans font-bold">Min Chargeable Wt</span>
              <strong className="text-emerald-950">{details.minWeight} Kg</strong>
            </div>
            <div>
              <span className="text-emerald-700/80 block text-[10px] uppercase font-sans font-bold">GST Configuration</span>
              <strong className="text-emerald-950">
                {details.isGstExempt ? '0% GST Exempt' : `${details.gstRateVal}% GST`}
                {details.isRcm && ' • RCM'}
              </strong>
            </div>
          </div>

          <div className="flex flex-wrap items-center gap-x-4 gap-y-1 text-[11px] font-mono text-emerald-900">
            <span>Docket Charge: <strong>₹{details.docketAmt.toLocaleString('en-IN')}</strong></span>
            <span>Pickup Charge: <strong>₹{details.pickupAmt.toLocaleString('en-IN')}</strong></span>
            <span>Delivery Charge: <strong>₹{details.deliveryAmt.toLocaleString('en-IN')}</strong></span>
            {otherAddl.map((chg, i) => (
              <span key={i}>{chg.name || chg.chargeName}: <strong>₹{(parseFloat(chg.amount || chg.rate || 0) || 0).toLocaleString('en-IN')}</strong></span>
            ))}
            {details.taxConfig?.notes && (
              <span className="text-emerald-800 font-sans font-semibold bg-emerald-100 px-2 py-0.5 rounded border border-emerald-200">
                {details.taxConfig.notes}
              </span>
            )}
          </div>
        </div>
      );
    }

    if (pricingValidation.status === 'MATCHED' && pricingValidation.source === 'RATE_CARD') {
      const details = extractChargeAmounts(pricingValidation);
      return (
        <div className="p-3.5 bg-blue-50 border border-blue-300 rounded-xl text-blue-950 text-xs space-y-2 shadow-xs">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <div className="flex flex-wrap items-center gap-2 font-bold text-blue-900 text-sm">
              <CheckCircle2 className="w-4 h-4 text-blue-600 shrink-0" />
              <span>✓ Rate Card Applied</span>
              <span className="px-2 py-0.5 text-[10px] font-mono bg-blue-100 text-blue-800 rounded font-semibold border border-blue-200">
                Rate Card Version: Version {pricingValidation.rateCardVersion || 1}
              </span>
            </div>
            <span className="text-[11px] font-bold text-blue-700 bg-blue-100 px-2 py-0.5 rounded border border-blue-200">
              {pricingValidation.rateCardNumber || pricingValidation.rateCardName || 'Standard Rate Card'}
            </span>
          </div>
          <p className="text-[11px] text-blue-800 leading-normal">
            No company-specific quotation covers this route. Freight charges will be calculated using the applicable rate card agreement.
          </p>
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 font-mono text-[11px] bg-white/75 p-2.5 rounded-lg border border-blue-200/80">
            <div>
              <span className="text-blue-700/80 block text-[10px] uppercase font-sans font-bold">Route & Mode</span>
              <strong>{pricingValidation.origin} → {pricingValidation.destination} ({pricingValidation.freightMode})</strong>
            </div>
            <div>
              <span className="text-blue-700/80 block text-[10px] uppercase font-sans font-bold">Rate ({details.rateBasis})</span>
              <strong>₹{details.baseFreight} / {details.rateBasis}</strong>
            </div>
            <div>
              <span className="text-blue-700/80 block text-[10px] uppercase font-sans font-bold">Min Chargeable Wt</span>
              <strong>{details.minWeight} Kg</strong>
            </div>
            <div>
              <span className="text-blue-700/80 block text-[10px] uppercase font-sans font-bold">Charges & GST</span>
              <strong>
                D:₹{details.docketAmt} P:₹{details.pickupAmt} Del:₹{details.deliveryAmt} • {details.gstRateVal}%{details.isRcm ? ' RCM' : ''}
              </strong>
            </div>
          </div>
        </div>
      );
    }

    if (pricingValidation.status === 'ERROR') {
      return (
        <div className="p-3.5 bg-amber-50 border border-amber-300 rounded-xl text-amber-950 text-xs space-y-1.5 shadow-xs">
          <div className="flex items-center justify-between gap-2">
            <div className="flex items-center gap-2 font-bold text-amber-900 text-sm">
              <AlertTriangle className="w-4 h-4 text-amber-600 shrink-0" />
              <span>Unable to Verify Quotation Coverage</span>
            </div>
            <button
              type="button"
              onClick={() => checkPricingCoverage()}
              className="px-2.5 py-1 text-[11px] font-bold text-amber-900 bg-amber-200/70 hover:bg-amber-200 rounded border border-amber-300 cursor-pointer"
            >
              Retry Lookup
            </button>
          </div>
          <p className="text-[11px] text-amber-800">{pricingValidation.message}</p>
        </div>
      );
    }

    if (pricingValidation.status === 'MISSING') {
      return (
        <div className="p-3.5 bg-rose-50 border border-rose-300 rounded-xl text-rose-950 text-xs space-y-1.5 shadow-xs">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2 font-bold text-rose-900 text-sm">
              <AlertCircle className="w-4 h-4 text-rose-600 shrink-0" />
              <span>⚠ No Quotation / Rate Card Found</span>
            </div>
            <span className="text-[10px] font-bold text-rose-700 bg-rose-100 px-2 py-0.5 rounded border border-rose-200 uppercase tracking-wide">
              Pricing Uncovered
            </span>
          </div>
          <p className="text-[11px] text-rose-800 leading-normal">
            The selected company's quotation does not cover route <strong>{formData.origin || formData.consignor?.city || 'Origin'} → {formData.destination || formData.consignee?.city || 'Destination'}</strong> ({formData.freightMode || formData.mode || 'Mode'}), and no applicable rate card was found.
          </p>
          <div className="p-2 bg-rose-100/70 rounded-lg text-rose-900 font-medium text-[11px] flex items-center gap-1.5">
            <AlertTriangle className="w-3.5 h-3.5 text-rose-600 shrink-0" />
            <span>Confirmation is required to save without agreed pricing. <strong>This shipment will be blocked from tax invoices until pricing is established.</strong></span>
          </div>
        </div>
      );
    }

    return null;
  };

  const handleSubmit = async (e, createAnother = false, confirmedOverride = false) => {
    if (e) e.preventDefault();
    setCnDuplicateError(null);
    setAwbDuplicateError(null);

    const validationErrors = validateShipmentForm(formData, isEditMode);
    if (Object.keys(validationErrors).length > 0) {
      setErrors(validationErrors);
      window.scrollTo({ top: 0, behavior: 'smooth' });
      return;
    }

    // Pre-save pricing validation check (Section 2 Scenario C)
    let currentPricing = pricingValidation;
    if ((!currentPricing || currentPricing.status === 'PENDING_ROUTE' || currentPricing.status === 'ERROR') && (formData.companyId || formData.companyName)) {
      currentPricing = await checkPricingCoverage();
    }

    if (currentPricing && currentPricing.status === 'ERROR') {
      alert(currentPricing.message || 'Unable to verify quotation coverage with server. Please retry before saving.');
      return;
    }

    if (currentPricing && currentPricing.status === 'MISSING' && !confirmedOverride) {
      setShowUnpricedConfirmModal(true);
      setPendingSubmit({ createAnother });
      return;
    }

    setSaving(true);
    try {
      const rawCN = (formData.cnNumber || '').trim();
      const isAutoCN = !rawCN || rawCN.startsWith('Auto') || rawCN.toLowerCase() === 'auto';
      const checkCN = isEditMode ? (rawCN || id) : (isAutoCN ? undefined : rawCN);

      // 1. Strict duplicate validation before save (AWB duplicate check skipped — AWB may stay same/shared)
      const dupCheck = await shipmentService.validateDuplicates({
        currentShipmentId: id,
        currentCnNumber: isEditMode ? (formData.cnNumber || id) : undefined,
        cnNumber: checkCN,
        commercialInvoices: formData.commercialInvoices
      });

      if (!dupCheck.isValid) {
        if (dupCheck.cnNumberError) {
          setCnDuplicateError(dupCheck.cnNumberError);
        }
        const errorMsg = dupCheck.cnNumberError || dupCheck.commercialInvoiceErrors?.[0]?.error || 'Duplicate detected.';
        alert(`Cannot save shipment: ${errorMsg}`);
        window.scrollTo({ top: 0, behavior: 'smooth' });
        setSaving(false);
        return;
      }

      // Find selected company, or match from consignor/consignee, NEVER blindly fallback to companies[0]!
      let targetComp = companies.find((c) => c.id === formData.companyId);
      if (!targetComp && formData.companyName) {
        targetComp = companies.find((c) => c.companyName.toLowerCase().trim() === formData.companyName.toLowerCase().trim());
      }
      if (!targetComp) {
        const cNorm = (formData.consignor?.name || '').toLowerCase().trim();
        const ceNorm = (formData.consignee?.name || '').toLowerCase().trim();
        targetComp = companies.find((c) => {
          const compNameNorm = (c.companyName || '').toLowerCase().trim();
          return (cNorm && (compNameNorm.includes(cNorm) || cNorm.includes(compNameNorm))) ||
                 (ceNorm && (compNameNorm.includes(ceNorm) || ceNorm.includes(compNameNorm)));
        });
      }

      const finalCompId = targetComp?.id || formData.companyId || '';
      const finalCompName = targetComp?.companyName || formData.companyName || formData.consignor?.name || '';
      const finalCompCode = targetComp?.companyCode || formData.companyCode || 'CLIENT';

      const creatorId = user?.id || user?._id || user?.username || user?.email || 'driver-user';
      const creatorName = user?.name || user?.username || 'Driver User';
      const creatorRole = user?.role || 'Driver';

      const payload = {
        ...formData,
        cnNumber: isEditMode ? rawCN : (isAutoCN ? '' : rawCN),
        cnDate: formData.cnDate || formData.bookingDate || new Date().toISOString().split('T')[0],
        bookingDate: formData.bookingDate || formData.cnDate || new Date().toISOString().split('T')[0],
        createdBy: formData.createdBy || creatorId,
        createdByName: formData.createdByName || creatorName,
        createdByRole: formData.createdByRole || creatorRole,
        driverId: formData.driverId || user?.driverId || (user?.role === 'Driver' ? creatorId : null),
        companyId: finalCompId,
        companyName: finalCompName,
        companyCode: finalCompCode,
        pricingValidation: currentPricing ? {
          ...currentPricing,
          overrideConfirmed: confirmedOverride || Boolean(currentPricing.overrideConfirmed),
          overrideConfirmedBy: (confirmedOverride || currentPricing.overrideConfirmed) ? (user?.name || user?.username || 'Admin') : null,
          overrideConfirmedAt: (confirmedOverride || currentPricing.overrideConfirmed) ? new Date() : null
        } : undefined,
        overrideConfirmed: confirmedOverride || Boolean(currentPricing?.overrideConfirmed),
        overrideConfirmedBy: (confirmedOverride || currentPricing?.overrideConfirmed) ? (user?.name || user?.username || 'Admin') : null,
        consignor: {
          ...formData.consignor,
          name: formData.consignor?.name || '',
          code: formData.consignor?.code || '',
          gstin: formData.consignor?.gstin || '',
          contact: formData.consignor?.contact || '',
          address: formData.consignor?.address || '',
          city: formData.consignor?.city || '',
          state: formData.consignor?.state || '',
          pin: formData.consignor?.pin || ''
        },
        shipper: {
          ...formData.consignor,
          name: formData.consignor?.name || '',
          code: formData.consignor?.code || '',
          gstin: formData.consignor?.gstin || '',
          contact: formData.consignor?.contact || '',
          address: formData.consignor?.address || '',
          city: formData.consignor?.city || '',
          state: formData.consignor?.state || '',
          pin: formData.consignor?.pin || ''
        },
        consignee: {
          ...formData.consignee,
          name: formData.consignee?.name || '',
          code: formData.consignee?.code || '',
          gstin: formData.consignee?.gstin || '',
          contact: formData.consignee?.contact || '',
          address: formData.consignee?.address || '',
          city: formData.consignee?.city || '',
          state: formData.consignee?.state || '',
          pin: formData.consignee?.pin || ''
        },
        operational: {
          ...(formData.operational || {}),
          driver: formData.operational?.driver || (user?.role === 'Driver' ? creatorName : '')
        },
        origin: formData.origin || formData.consignor?.city || '',
        destination: formData.destination || formData.consignee?.city || '',
        mode: formData.mode || formData.freightMode || '',
        freightMode: formData.mode || formData.freightMode || '',
        packages: formData.packages || 1,
        actualWeight: parseFloat(formData.actualWeight) || 0,
        chargeableWeight: parseFloat(formData.chargeableWeight) || parseFloat(formData.actualWeight) || 0,
        packingCharges: formData.packingCharges === '' ? 0 : (parseFloat(formData.packingCharges) || 0),
        laborCharges: formData.laborCharges === '' ? 0 : (parseFloat(formData.laborCharges) || 0),
        pickupCharges: formData.pickupCharges === '' ? 0 : (parseFloat(formData.pickupCharges) || 0),
        deliveryCharges: formData.deliveryCharges === '' ? 0 : (parseFloat(formData.deliveryCharges) || 0),
        godownCharges: formData.godownCharges === '' ? 0 : (parseFloat(formData.godownCharges) || 0),
        shipmentChargesOverride: Boolean(
          isEditMode ||
          formData.packingCharges !== '' ||
          formData.laborCharges !== '' ||
          formData.pickupCharges !== '' ||
          formData.deliveryCharges !== '' ||
          formData.godownCharges !== ''
        ),
        godownMonths: formData.godownMonths === '' ? 0 : (parseFloat(formData.godownMonths) || 0),
        godownRatePerMonth: formData.godownRatePerMonth === '' ? 0 : (parseFloat(formData.godownRatePerMonth) || 0),
        isGodownOnlyBilling: Boolean(formData.isGodownOnlyBilling),
        isGstExempt: Boolean(formData.isGstExempt),
        gstRate: formData.isGstExempt ? 0 : (Number(formData.gstRate) || 18),
        commercialInvoices: formData.commercialInvoices || []
      };

      if (isEditMode) {
        const updated = await shipmentService.updateShipment(id, payload);
        const destinationCN = updated?.cnNumber || payload.cnNumber || id;
        alert(`Shipment ${destinationCN} updated successfully! All modifications have been saved.`);
        navigate(`/admin/shipments/${encodeURIComponent(destinationCN)}`);
      } else {
        const created = await shipmentService.createShipment(payload);
        if (createAnother) {
          setFormData({
            ...INITIAL_FORM_STATE,
            cnNumber: '',
            companyId: '',
            companyName: '',
            companyCode: ''
          });
          setErrors({});
          window.scrollTo({ top: 0, behavior: 'smooth' });
          alert(`Shipment ${created.cnNumber} created successfully!`);
        } else {
          setCreatedCN(created.cnNumber);
          setCreatedId(created.id);
          setCreatedShipment(created);
          setShowCNModal(true); // Opens CN document popup immediately on creation!
        }
      }
    } catch (err) {
      console.error('[ShipmentFormPage] Save Error:', err);
      if (err.data?.field === 'cnNumber' || err.message?.toLowerCase().includes('duplicate cn') || err.message?.toLowerCase().includes('already exists in the database')) {
        setCnDuplicateError(err.data?.message || err.message || 'Duplicate CN Number detected. Please enter a unique CN Number.');
        window.scrollTo({ top: 0, behavior: 'smooth' });
      } else if (err.data?.field === 'awbNumber' || err.message?.toLowerCase().includes('awb number')) {
        setAwbDuplicateError(err.data?.message || err.message);
        window.scrollTo({ top: 0, behavior: 'smooth' });
      }
      const isConnectionErr = err.name === 'TypeError' || err.message?.includes('Failed to fetch') || err.message?.includes('NetworkError');
      const displayMsg = isConnectionErr
        ? 'Cannot connect to backend server at http://localhost:5050. Please ensure the backend server is running via "npm run dev" in C:\\SpeedSetu\\server.'
        : (err.data?.message || err.message || 'Failed to save shipment to the database.');
      alert(displayMsg);
    } finally {
      setSaving(false);
    }
  };

  if (loading) {
    return <LoadingState message="Initializing Consignment Note Dispatch Form..." />;
  }

  return (
    <div className="space-y-6 max-w-5xl mx-auto pb-12">
      <PageHeader
        title={isEditMode ? `Edit Shipment — CN ${formData.cnNumber}` : (formData.cnNumber ? `New Shipment Consignment Note — ${formData.cnNumber}` : 'New Shipment Consignment Note')}
        description="Issue Consignment Note (CN), record consignor/consignee details, e-way bill and dispatch specs."
        breadcrumbs={['Speed Setu Admin', 'Operations', 'Shipments', isEditMode ? 'Edit' : 'New']}
        actions={
          <div className="flex items-center space-x-2">
            {!isDriverUser && !isEditMode && (
              <button
                type="button"
                onClick={() => setFormMode(formMode === 'driver' ? 'full' : 'driver')}
                className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold text-setu-700 bg-setu-50 border border-setu-200 rounded-md hover:bg-setu-100 transition-colors"
              >
                <span>{formMode === 'driver' ? 'Switch to Full ERP Form' : 'Switch to Driver Express Form'}</span>
              </button>
            )}
            <button
              type="button"
              onClick={() => navigate(-1)}
              className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold text-slate-700 bg-white border border-slate-300 rounded-md hover:bg-slate-50 transition-colors"
            >
              <ArrowLeft className="w-4 h-4" />
              <span>Cancel</span>
            </button>
          </div>
        }
      />

      {/* Global Validation Banner */}
      {Object.keys(errors).length > 0 && (
        <div className="p-4 bg-rose-50 border border-rose-200 rounded-xl text-rose-800 text-xs font-medium space-y-1">
          <div className="flex items-center gap-2 font-bold text-rose-900 text-sm mb-1">
            <AlertCircle className="w-4 h-4 text-rose-600" />
            <span>Please resolve form errors before saving shipment:</span>
          </div>
          <ul className="list-disc list-inside space-y-0.5 text-rose-700">
            {Object.values(errors).map((err, idx) => (
              <li key={idx}>{err}</li>
            ))}
          </ul>
        </div>
      )}

      {/* DRIVER EXPRESS CN FORM */}
      {formMode === 'driver' && !isEditMode ? (
        <form onSubmit={(e) => handleSubmit(e, false)} className="space-y-6">
          {/* STEP 1: BILLING COMPANY (CORPORATE CLIENT) */}
          <div className="bg-white border border-slate-200 rounded-2xl p-4 sm:p-6 shadow-sm space-y-3">
            <div className="flex items-center justify-between border-b border-slate-100 pb-2">
              <div className="flex items-center space-x-2">
                <span className="w-6 h-6 rounded-full bg-setu-600 text-white font-extrabold text-xs flex items-center justify-center">1</span>
                <h3 className="text-sm font-extrabold text-slate-900 uppercase tracking-wider">Billing Company (Corporate Client)</h3>
              </div>
              <span className="text-xs text-slate-400">Account billed for freight</span>
            </div>

            <div className="text-xs">
              <label className="block font-bold text-slate-700 mb-1">
                Select Client Company to Bill <span className="text-rose-500">*</span>
              </label>
              <select
                required
                value={formData.companyId || ''}
                onChange={(e) => {
                  const comp = companies.find((c) => c.id === e.target.value);
                  if (comp) {
                    setFormData((prev) => ({
                      ...prev,
                      companyId: comp.id,
                      companyName: comp.companyName,
                      companyCode: comp.companyCode
                    }));
                  } else {
                    setFormData((prev) => ({
                      ...prev,
                      companyId: '',
                      companyName: '',
                      companyCode: ''
                    }));
                  }
                }}
                className="w-full p-3 bg-white border border-slate-300 rounded-xl font-bold text-slate-900 text-sm focus:ring-2 focus:ring-setu-600 cursor-pointer"
              >
                <option value="">-- Choose Billing Company (e.g. Advik Autocomp, Techniques Surfaces, DK Automotive...) --</option>
                {companies.map((c) => (
                  <option key={c.id} value={c.id}>
                    {c.companyName} ({c.companyCode || 'CLIENT'})
                  </option>
                ))}
              </select>
              <p className="text-[11px] text-slate-400 mt-1">
                {formData.companyName ? `Currently billing to: ${formData.companyName}` : 'Select which registered corporate client will be billed for this shipment'}
              </p>
            </div>

            {renderPricingCoverageBanner()}
          </div>

          {/* STEP 2: CONSIGNOR & CONSIGNEE DETAILS */}
          <div className="bg-white border border-slate-200 rounded-2xl p-4 sm:p-6 shadow-sm space-y-6">
            
            {/* CONSIGNOR BLOCK */}
            <div className="space-y-3 pb-6 border-b border-slate-100">
              <div className="flex items-center justify-between">
                <div className="flex items-center space-x-2">
                  <span className="w-6 h-6 rounded-full bg-setu-600 text-white font-extrabold text-xs flex items-center justify-center">2</span>
                  <h3 className="text-sm font-extrabold text-slate-900 uppercase tracking-wider">Consignor Details (Shipper)</h3>
                </div>
                <span className="text-xs text-slate-400">Select shipper or enter name</span>
              </div>



              <div className="space-y-3 pt-1 text-xs">
                {/* Row 1: Consignor Name (Autocomplete) & Consignor Code */}
                <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                  <div className="sm:col-span-2 relative">
                    <label className="block font-bold text-slate-600 mb-1">
                      Consignor Name <span className="text-rose-500">*</span> <span className="text-[10px] text-slate-400 font-normal">(Type to search master)</span>
                    </label>
                    <input
                      type="text"
                      required
                      value={formData.consignor?.name || ''}
                      onFocus={() => {
                        setShowConsignorSuggestions(true);
                        refreshMasterParties();
                      }}
                      onBlur={() => setTimeout(() => setShowConsignorSuggestions(false), 200)}
                      onChange={(e) => {
                        const val = e.target.value.toUpperCase();
                        handleNestedInputChange('consignor', 'name', val);
                        setConsignorSearchTerm(val);
                        setShowConsignorSuggestions(true);
                      }}
                      placeholder="Type to search e.g. GKN, ADVIK, TECHNIQUES..."
                      className="w-full p-2.5 bg-white border border-slate-300 rounded-lg font-bold text-slate-900 focus:ring-2 focus:ring-setu-600 uppercase"
                    />

                    {/* Auto-complete Suggestions Dropdown */}
                    {showConsignorSuggestions && (
                      <div className="absolute z-30 left-0 right-0 top-full mt-1 bg-white border border-slate-300 rounded-xl shadow-xl max-h-56 overflow-y-auto divide-y divide-slate-100">
                        {getFilteredAndRankedList(savedConsignorsList, formData.consignor?.name || '').map((c) => (
                          <button
                            key={c.id || c.code || `${c.name}-${c.city}-${c.pin}`}
                            type="button"
                            onMouseDown={() => {
                              handleConsignorSelect(c.id ? c.id : c);
                              setShowConsignorSuggestions(false);
                            }}
                            className="w-full text-left p-2.5 hover:bg-setu-50 transition-colors flex items-center justify-between cursor-pointer"
                          >
                            <div className="space-y-0.5 min-w-0 pr-2">
                              <div className="flex items-center gap-2">
                                <span className="font-bold text-slate-900 text-xs truncate">{c.name}</span>
                                {c.code && (
                                  <span className="font-mono font-bold text-[10px] px-1.5 py-0.5 rounded bg-blue-50 text-blue-700 border border-blue-200 shrink-0">
                                    {c.code}
                                  </span>
                                )}
                              </div>
                              <div className="flex flex-wrap items-center gap-x-2 gap-y-0.5 text-[10px] text-slate-500">
                                {c.pickupDeliveryLocation && (
                                  <span className="font-semibold text-amber-700 bg-amber-50 px-1.5 py-0.2 rounded border border-amber-200">
                                    📍 {c.pickupDeliveryLocation}
                                  </span>
                                )}
                                {c.city && <span className="font-semibold text-slate-700">{c.city}</span>}
                                {c.pin && <span className="font-mono text-slate-600">PIN: {c.pin}</span>}
                                {c.address && <span className="truncate max-w-xs text-slate-400">• {c.address}</span>}
                                {c.gstin && <span className="font-mono text-slate-400">• GST: {c.gstin}</span>}
                              </div>
                            </div>
                          </button>
                        ))}
                        {getFilteredAndRankedList(savedConsignorsList, formData.consignor?.name || '').length === 0 && (
                          <div className="p-4 text-xs text-slate-500 text-center space-y-2">
                            <p className="font-bold text-slate-700">No saved consignor/consignee found.</p>
                            <p className="text-[11px] text-slate-400">
                              Only saved records from the centralized Master are shown.
                            </p>
                            <a
                              href="/operations/consignors-consignees"
                              target="_blank"
                              rel="noopener noreferrer"
                              className="inline-flex items-center gap-1.5 text-xs font-bold text-setu-600 hover:text-setu-700 bg-setu-50 hover:bg-setu-100 px-3 py-1.5 rounded-lg border border-setu-200 transition-colors shadow-xs cursor-pointer"
                              onMouseDown={(e) => e.stopPropagation()}
                            >
                              <Plus className="w-3.5 h-3.5" /> Add Consignor / Consignee
                            </a>
                          </div>
                        )}
                      </div>
                    )}
                  </div>

                  <div>
                    <label className="block font-bold text-slate-600 mb-1">Consignor Code</label>
                    <input
                      type="text"
                      readOnly
                      disabled
                      value={formData.consignor?.code || (formData.consignorId ? 'Linked' : 'Auto-assigned upon submit')}
                      className="w-full p-2.5 bg-slate-100 border border-slate-300 rounded-lg font-mono font-bold text-slate-700 text-xs cursor-not-allowed"
                    />
                  </div>
                </div>

                {/* Row 2: Address, City, State, PIN */}
                <div className="grid grid-cols-1 sm:grid-cols-4 gap-3">
                  <div className="sm:col-span-2">
                    <label className="block font-bold text-slate-600 mb-1">Pickup Street Address</label>
                    <input
                      type="text"
                      value={formData.consignor?.address || ''}
                      onChange={(e) => handleNestedInputChange('consignor', 'address', e.target.value)}
                      placeholder="Street, Plot, Industrial Area..."
                      className="w-full p-2.5 bg-white border border-slate-300 rounded-lg font-medium text-slate-900"
                    />
                  </div>

                  <div>
                    <label className="block font-bold text-slate-600 mb-1">City</label>
                    <input
                      type="text"
                      value={formData.consignor?.city || ''}
                      onChange={(e) => handleNestedInputChange('consignor', 'city', e.target.value)}
                      placeholder="e.g. Pune, Bhiwani..."
                      className="w-full p-2.5 bg-white border border-slate-300 rounded-lg font-medium text-slate-900"
                    />
                  </div>

                  <div>
                    <label className="block font-bold text-slate-600 mb-1">PIN Code</label>
                    <input
                      type="text"
                      maxLength={6}
                      value={formData.consignor?.pin || ''}
                      onChange={(e) => handleNestedInputChange('consignor', 'pin', e.target.value.replace(/\D/g, ''))}
                      placeholder="6-digit PIN"
                      className="w-full p-2.5 bg-white border border-slate-300 rounded-lg font-mono font-bold text-slate-900"
                    />
                  </div>
                </div>

                {/* Row 3: Pickup/Delivery, GSTIN & Contact Person */}
                <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                  <div>
                    <label className="block font-bold text-slate-600 mb-1">
                      Pickup / Delivery <span className="text-[10px] text-setu-600 font-semibold">(Origin)</span>
                    </label>
                    <input
                      type="text"
                      value={formData.consignor?.pickupDeliveryLocation || ''}
                      onChange={(e) => {
                        const val = e.target.value.toUpperCase();
                        handleNestedInputChange('consignor', 'pickupDeliveryLocation', val);
                        setFormData((prev) => ({ ...prev, origin: val }));
                      }}
                      placeholder="e.g. Pune Hub, Chakan..."
                      className="w-full p-2.5 bg-white border border-slate-300 rounded-lg font-bold text-slate-900 uppercase"
                    />
                  </div>

                  <div>
                    <label className="block font-bold text-slate-600 mb-1">Consignor GSTIN (Optional)</label>
                    <input
                      type="text"
                      maxLength={15}
                      value={formData.consignor?.gstin || ''}
                      onChange={(e) => handleNestedInputChange('consignor', 'gstin', e.target.value.toUpperCase())}
                      placeholder="15-character GSTIN"
                      className="w-full p-2.5 bg-white border border-slate-300 rounded-lg font-mono font-semibold text-slate-900 uppercase"
                    />
                  </div>

                  <div>
                    <label className="block font-bold text-slate-600 mb-1">Contact Details (Optional)</label>
                    <input
                      type="text"
                      value={formData.consignor?.contact || ''}
                      onChange={(e) => handleNestedInputChange('consignor', 'contact', e.target.value)}
                      placeholder="Contact Person / Phone"
                      className="w-full p-2.5 bg-white border border-slate-300 rounded-lg font-medium text-slate-900"
                    />
                  </div>
                </div>
              </div>
            </div>

            {/* CONSIGNEE BLOCK */}
            <div className="space-y-3">
              <div className="flex items-center justify-between">
                <div className="flex items-center space-x-2">
                  <span className="w-6 h-6 rounded-full bg-emerald-600 text-white font-extrabold text-xs flex items-center justify-center">3</span>
                  <h3 className="text-sm font-extrabold text-slate-900 uppercase tracking-wider">Consignee Details (Receiver)</h3>
                </div>
                <span className="text-xs text-slate-400">Select receiver or enter name</span>
              </div>

              <div className="space-y-3 pt-1 text-xs">
                {/* Row 1: Consignee Name (Autocomplete) & Consignee Code */}
                <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                  <div className="sm:col-span-2 relative">
                    <label className="block font-bold text-slate-600 mb-1">
                      Consignee Name <span className="text-rose-500">*</span> <span className="text-[10px] text-slate-400 font-normal">(Type to search master)</span>
                    </label>
                    <input
                      type="text"
                      required
                      value={formData.consignee?.name || ''}
                      onFocus={() => {
                        setShowConsigneeSuggestions(true);
                        refreshMasterParties();
                      }}
                      onBlur={() => setTimeout(() => setShowConsigneeSuggestions(false), 200)}
                      onChange={(e) => {
                        const val = e.target.value.toUpperCase();
                        handleNestedInputChange('consignee', 'name', val);
                        setConsigneeSearchTerm(val);
                        setShowConsigneeSuggestions(true);
                      }}
                      placeholder="Type to search e.g. SANSERA, ADVIK, RELIANCE..."
                      className="w-full p-2.5 bg-white border border-slate-300 rounded-lg font-bold text-slate-900 focus:ring-2 focus:ring-emerald-600 uppercase"
                    />

                    {/* Auto-complete Suggestions Dropdown */}
                    {showConsigneeSuggestions && (
                      <div className="absolute z-30 left-0 right-0 top-full mt-1 bg-white border border-slate-300 rounded-xl shadow-xl max-h-56 overflow-y-auto divide-y divide-slate-100">
                        {getFilteredAndRankedList(savedConsigneesList, formData.consignee?.name || '').map((c) => (
                          <button
                            key={c.id || c.code || `${c.name}-${c.city}-${c.pin}`}
                            type="button"
                            onMouseDown={() => {
                              handleConsigneeSelect(c.id ? c.id : c);
                              setShowConsigneeSuggestions(false);
                            }}
                            className="w-full text-left p-2.5 hover:bg-emerald-50 transition-colors flex items-center justify-between cursor-pointer"
                          >
                            <div className="space-y-0.5 min-w-0 pr-2">
                              <div className="flex items-center gap-2">
                                <span className="font-bold text-slate-900 text-xs truncate">{c.name}</span>
                                {c.code && (
                                  <span className="font-mono font-bold text-[10px] px-1.5 py-0.5 rounded bg-emerald-50 text-emerald-700 border border-emerald-200 shrink-0">
                                    {c.code}
                                  </span>
                                )}
                              </div>
                              <div className="flex flex-wrap items-center gap-x-2 gap-y-0.5 text-[10px] text-slate-500">
                                {c.pickupDeliveryLocation && (
                                  <span className="font-semibold text-amber-700 bg-amber-50 px-1.5 py-0.2 rounded border border-amber-200">
                                    📍 {c.pickupDeliveryLocation}
                                  </span>
                                )}
                                {c.city && <span className="font-semibold text-slate-700">{c.city}</span>}
                                {c.pin && <span className="font-mono text-slate-600">PIN: {c.pin}</span>}
                                {c.address && <span className="truncate max-w-xs text-slate-400">• {c.address}</span>}
                                {c.gstin && <span className="font-mono text-slate-400">• GST: {c.gstin}</span>}
                              </div>
                            </div>
                          </button>
                        ))}
                        {getFilteredAndRankedList(savedConsigneesList, formData.consignee?.name || '').length === 0 && (
                          <div className="p-4 text-xs text-slate-500 text-center space-y-2">
                            <p className="font-bold text-slate-700">No saved consignor/consignee found.</p>
                            <p className="text-[11px] text-slate-400">
                              Only saved records from the centralized Master are shown.
                            </p>
                            <a
                              href="/operations/consignors-consignees"
                              target="_blank"
                              rel="noopener noreferrer"
                              className="inline-flex items-center gap-1.5 text-xs font-bold text-emerald-700 hover:text-emerald-800 bg-emerald-50 hover:bg-emerald-100 px-3 py-1.5 rounded-lg border border-emerald-200 transition-colors shadow-xs cursor-pointer"
                              onMouseDown={(e) => e.stopPropagation()}
                            >
                              <Plus className="w-3.5 h-3.5" /> Add Consignor / Consignee
                            </a>
                          </div>
                        )}
                      </div>
                    )}
                  </div>

                  <div>
                    <label className="block font-bold text-slate-600 mb-1">Consignee Code</label>
                    <input
                      type="text"
                      readOnly
                      disabled
                      value={formData.consignee?.code || (formData.consigneeId ? 'Linked' : 'Auto-assigned upon submit')}
                      className="w-full p-2.5 bg-slate-100 border border-slate-300 rounded-lg font-mono font-bold text-slate-700 text-xs cursor-not-allowed"
                    />
                  </div>
                </div>

                {/* Row 2: Address, City, State, PIN */}
                <div className="grid grid-cols-1 sm:grid-cols-4 gap-3">
                  <div className="sm:col-span-2">
                    <label className="block font-bold text-slate-600 mb-1">Delivery Street Address</label>
                    <input
                      type="text"
                      value={formData.consignee?.address || ''}
                      onChange={(e) => handleNestedInputChange('consignee', 'address', e.target.value)}
                      placeholder="Street, Destination Hub, Unit..."
                      className="w-full p-2.5 bg-white border border-slate-300 rounded-lg font-medium text-slate-900"
                    />
                  </div>

                  <div>
                    <label className="block font-bold text-slate-600 mb-1">City</label>
                    <input
                      type="text"
                      value={formData.consignee?.city || ''}
                      onChange={(e) => handleNestedInputChange('consignee', 'city', e.target.value)}
                      placeholder="e.g. Bangalore, Pantnagar..."
                      className="w-full p-2.5 bg-white border border-slate-300 rounded-lg font-medium text-slate-900"
                    />
                  </div>

                  <div>
                    <label className="block font-bold text-slate-600 mb-1">PIN Code</label>
                    <input
                      type="text"
                      maxLength={6}
                      value={formData.consignee?.pin || ''}
                      onChange={(e) => handleNestedInputChange('consignee', 'pin', e.target.value.replace(/\D/g, ''))}
                      placeholder="6-digit PIN"
                      className="w-full p-2.5 bg-white border border-slate-300 rounded-lg font-mono font-bold text-slate-900"
                    />
                  </div>
                </div>

                {/* Row 3: Pickup/Delivery, GSTIN & Contact Person */}
                <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                  <div>
                    <label className="block font-bold text-slate-600 mb-1">
                      Pickup / Delivery <span className="text-[10px] text-emerald-600 font-semibold">(Destination)</span>
                    </label>
                    <input
                      type="text"
                      value={formData.consignee?.pickupDeliveryLocation || ''}
                      onChange={(e) => {
                        const val = e.target.value.toUpperCase();
                        handleNestedInputChange('consignee', 'pickupDeliveryLocation', val);
                        setFormData((prev) => ({ ...prev, destination: val }));
                      }}
                      placeholder="e.g. Bangalore Hub, Peenya..."
                      className="w-full p-2.5 bg-white border border-slate-300 rounded-lg font-bold text-slate-900 uppercase"
                    />
                  </div>

                  <div>
                    <label className="block font-bold text-slate-600 mb-1">Consignee GSTIN (Optional)</label>
                    <input
                      type="text"
                      maxLength={15}
                      value={formData.consignee?.gstin || ''}
                      onChange={(e) => handleNestedInputChange('consignee', 'gstin', e.target.value.toUpperCase())}
                      placeholder="15-character GSTIN"
                      className="w-full p-2.5 bg-white border border-slate-300 rounded-lg font-mono font-semibold text-slate-900 uppercase"
                    />
                  </div>

                  <div>
                    <label className="block font-bold text-slate-600 mb-1">Contact Details (Optional)</label>
                    <input
                      type="text"
                      value={formData.consignee?.contact || ''}
                      onChange={(e) => handleNestedInputChange('consignee', 'contact', e.target.value)}
                      placeholder="Contact Person / Phone"
                      className="w-full p-2.5 bg-white border border-slate-300 rounded-lg font-medium text-slate-900"
                    />
                  </div>
                </div>
              </div>
            </div>
          </div>

          {/* STEP 4: PICKUP FROM (ORIGIN) & DELIVER TO (DESTINATION) */}
          <div className="bg-white border border-slate-200 rounded-2xl p-4 sm:p-6 shadow-sm space-y-4">
            <div className="flex items-center space-x-2 border-b border-slate-100 pb-2">
              <span className="w-6 h-6 rounded-full bg-setu-600 text-white font-extrabold text-xs flex items-center justify-center">4</span>
              <h3 className="text-sm font-extrabold text-slate-900 uppercase tracking-wider">Pickup & Delivery Locations</h3>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 text-xs">
              <div>
                <label className="block font-bold text-slate-700 mb-1">Pickup From (Origin) <span className="text-rose-500">*</span></label>
                <input
                  type="text"
                  required
                  value={formData.origin || ''}
                  onChange={(e) => setFormData((prev) => ({ ...prev, origin: e.target.value.toUpperCase() }))}
                  placeholder="Auto-filled from consignor pickup/delivery or city..."
                  className="w-full p-3 bg-slate-50 border border-slate-300 rounded-xl font-bold text-slate-900 text-sm focus:ring-2 focus:ring-amber-500 focus:bg-white transition-all uppercase"
                />
              </div>

              <div>
                <label className="block font-bold text-slate-700 mb-1">Deliver To (Destination) <span className="text-rose-500">*</span></label>
                <input
                  type="text"
                  required
                  value={formData.destination || ''}
                  onChange={(e) => setFormData((prev) => ({ ...prev, destination: e.target.value.toUpperCase() }))}
                  placeholder="Auto-filled from consignee pickup/delivery or city..."
                  className="w-full p-3 bg-slate-50 border border-slate-300 rounded-xl font-bold text-slate-900 text-sm focus:ring-2 focus:ring-amber-500 focus:bg-white transition-all uppercase"
                />
              </div>
            </div>
          </div>

          {/* STEP 5: TRANSPORT MODE (AIR, TRAIN, ROAD, AIR EXPRESS) */}
          <div className="bg-white border border-slate-200 rounded-2xl p-4 sm:p-6 shadow-sm space-y-4">
            <div className="flex items-center space-x-2 border-b border-slate-100 pb-2">
              <span className="w-6 h-6 rounded-full bg-setu-600 text-white font-extrabold text-xs flex items-center justify-center">5</span>
              <h3 className="text-sm font-extrabold text-slate-900 uppercase tracking-wider">Select Transport Mode</h3>
            </div>

            <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 text-xs">
              {[
                { id: 'Air', label: 'Air' },
                { id: 'Train', label: 'Train' },
                { id: 'Road', label: 'Road' },
                { id: 'Air Express', label: 'Air Express' }
              ].map((m) => {
                const isSelected = formData.mode === m.id;
                return (
                  <label
                    key={m.id}
                    onClick={() => setFormData((prev) => ({ ...prev, mode: m.id, freightMode: m.id }))}
                    className={`py-3.5 px-4 rounded-xl border-2 font-extrabold text-center transition-all flex items-center justify-center gap-3 cursor-pointer select-none ${
                      isSelected
                        ? 'border-setu-600 bg-setu-50 text-setu-900 shadow-sm ring-1 ring-setu-600'
                        : 'border-slate-200 bg-white text-slate-700 hover:border-slate-300 hover:bg-slate-50'
                    }`}
                  >
                    <div className={`w-4 h-4 rounded-full border-2 flex items-center justify-center shrink-0 transition-colors ${
                      isSelected ? 'border-setu-600 bg-setu-600' : 'border-slate-400 bg-white'
                    }`}>
                      {isSelected && <div className="w-1.5 h-1.5 rounded-full bg-white" />}
                    </div>
                    <input
                      type="radio"
                      name="transportMode"
                      value={m.id}
                      checked={isSelected}
                      onChange={() => setFormData((prev) => ({ ...prev, mode: m.id, freightMode: m.id }))}
                      className="sr-only"
                    />
                    <span className="text-xs font-extrabold uppercase tracking-wide">{m.label}</span>
                  </label>
                );
              })}
            </div>
          </div>

          {/* STEP 6: BOX COUNT & WEIGHT */}
          <div className="bg-white border border-slate-200 rounded-2xl p-4 sm:p-6 shadow-sm space-y-4">
            <div className="flex items-center space-x-2 border-b border-slate-100 pb-2">
              <span className="w-6 h-6 rounded-full bg-setu-600 text-white font-extrabold text-xs flex items-center justify-center">6</span>
              <h3 className="text-sm font-extrabold text-slate-900 uppercase tracking-wider">Cargo Quantity & Weight</h3>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 text-xs">
              <div>
                <label className="block font-bold text-slate-700 mb-1">Number of Boxes / Packages <span className="text-rose-500">*</span></label>
                <input
                  type="number"
                  min="1"
                  required
                  value={formData.packages || ''}
                  onChange={(e) => setFormData((prev) => ({ ...prev, packages: e.target.value }))}
                  placeholder="e.g. 10"
                  className="w-full p-3 bg-slate-50 border border-slate-300 rounded-xl font-bold font-mono text-slate-900 text-sm focus:ring-2 focus:ring-purple-600 focus:bg-white transition-all"
                />
              </div>

              <div>
                <label className="block font-bold text-slate-700 mb-1">Actual Weight (Kgs) <span className="text-rose-500">*</span></label>
                <input
                  type="number"
                  min="0"
                  step="any"
                  required
                  value={formData.actualWeight || ''}
                  onChange={(e) => {
                    const val = e.target.value;
                    const num = parseFloat(val) || 0;
                    const minWt = pricingValidation?.status === 'MATCHED' ? (pricingValidation.minimumChargeableWeight || 0) : 0;
                    setFormData((prev) => ({
                      ...prev,
                      actualWeight: val,
                      chargeableWeight: num > 0 ? Math.max(num, minWt) : val
                    }));
                  }}
                  placeholder="e.g. 250"
                  className="w-full p-3 bg-slate-50 border border-slate-300 rounded-xl font-bold font-mono text-slate-900 text-sm focus:ring-2 focus:ring-purple-600 focus:bg-white transition-all"
                />
                {pricingValidation?.status === 'MATCHED' && pricingValidation.minimumChargeableWeight > 0 && (
                  <p className="text-[11px] text-emerald-700 font-semibold mt-1">
                    Min Chargeable Weight per {pricingValidation.quotationNumber || pricingValidation.rateCardNumber}: {pricingValidation.minimumChargeableWeight} Kg
                  </p>
                )}
              </div>
            </div>
          </div>

          {/* STEP 7: MULTIPLE COMMERCIAL INVOICES */}
          <div className="bg-white border border-slate-200 rounded-2xl p-4 sm:p-6 shadow-sm space-y-4">
            <div className="flex items-center space-x-2 border-b border-slate-100 pb-2">
              <span className="w-6 h-6 rounded-full bg-setu-600 text-white font-extrabold text-xs flex items-center justify-center">7</span>
              <h3 className="text-sm font-extrabold text-slate-900 uppercase tracking-wider">Commercial Invoices</h3>
            </div>

            <div className="space-y-3">
              {(formData.commercialInvoices || []).map((inv, idx) => (
                <div key={idx} className="p-3.5 bg-slate-50 border border-slate-200 rounded-xl relative space-y-3">
                  <div className="flex items-center justify-between">
                    <span className="text-xs font-extrabold text-slate-700 font-mono">Invoice #{idx + 1}</span>
                    {(formData.commercialInvoices || []).length > 1 && (
                      <button
                        type="button"
                        onClick={() => handleRemoveCommercialInvoice(idx)}
                        className="p-1 text-rose-600 hover:bg-rose-100 rounded-md transition-colors cursor-pointer"
                        title="Remove invoice"
                      >
                        <Trash2 className="w-4 h-4" />
                      </button>
                    )}
                  </div>

                  <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-3 text-xs">
                    <div>
                      <label className="block font-bold text-slate-600 mb-1">Invoice Number</label>
                      <input
                        type="text"
                        value={inv.invoiceNumber || ''}
                        onChange={(e) => handleCommercialInvoiceChange(idx, 'invoiceNumber', e.target.value)}
                        placeholder="e.g. INV-2024-889"
                        className="w-full p-2.5 bg-white border border-slate-300 rounded-lg font-mono font-bold text-slate-900"
                      />
                    </div>

                    <div>
                      <label className="block font-bold text-slate-600 mb-1">Invoice Date</label>
                      <input
                        type="date"
                        value={inv.invoiceDate || ''}
                        onChange={(e) => handleCommercialInvoiceChange(idx, 'invoiceDate', e.target.value)}
                        className="w-full p-2.5 bg-white border border-slate-300 rounded-lg font-mono font-semibold text-slate-900"
                      />
                    </div>

                    <div>
                      <label className="block font-bold text-slate-600 mb-1">Invoice Quantity (Boxes)</label>
                      <input
                        type="number"
                        value={inv.invoiceQuantity !== undefined && inv.invoiceQuantity !== null && inv.invoiceQuantity !== 0 && inv.invoiceQuantity !== '0' ? inv.invoiceQuantity : ''}
                        onChange={(e) => handleCommercialInvoiceChange(idx, 'invoiceQuantity', e.target.value === '' ? '' : (parseInt(e.target.value, 10) || ''))}
                        placeholder="e.g. 5"
                        className="w-full p-2.5 bg-white border border-slate-300 rounded-lg font-mono font-semibold text-slate-900"
                      />
                    </div>

                    <div>
                      <label className="block font-bold text-slate-600 mb-1">Invoice Value (Rs.)</label>
                      <input
                        type="number"
                        value={inv.invoiceValue || ''}
                        onChange={(e) => handleCommercialInvoiceChange(idx, 'invoiceValue', e.target.value)}
                        placeholder="e.g. 150000"
                        className="w-full p-2.5 bg-white border border-slate-300 rounded-lg font-mono font-semibold text-slate-900"
                      />
                    </div>

                    <div>
                      <label className="block font-bold text-slate-600 mb-1">E-Way Bill Number</label>
                      <input
                        type="text"
                        value={inv.ewayBillNumber || ''}
                        onChange={(e) => handleCommercialInvoiceChange(idx, 'ewayBillNumber', e.target.value)}
                        placeholder="e.g. EWB-1810294"
                        className="w-full p-2.5 bg-white border border-slate-300 rounded-lg font-mono font-semibold text-slate-900"
                      />
                    </div>
                  </div>
                </div>
              ))}
            </div>

            {/* Bottom Add Another Invoice Button */}
            <div className="pt-1">
              <button
                type="button"
                onClick={handleAddCommercialInvoice}
                className="w-full py-3 px-4 rounded-xl bg-setu-50 hover:bg-setu-100 text-setu-700 border-2 border-dashed border-setu-300 font-extrabold text-xs shadow-2xs transition-all flex items-center justify-center space-x-1.5 cursor-pointer active:scale-[0.99]"
              >
                <Plus className="w-4 h-4 text-setu-600" />
                <span>+ Add Another Invoice</span>
              </button>
            </div>
          </div>

          {/* SUBMIT BUTTON */}
          <div className="pt-2">
            <button
              type="submit"
              disabled={saving}
              className="w-full py-4 px-6 bg-setu-600 hover:bg-setu-700 disabled:opacity-50 text-white font-extrabold text-base rounded-2xl shadow-lg transition-all active:scale-[0.99] flex items-center justify-center space-x-2.5 cursor-pointer"
            >
              <Save className="w-5 h-5 text-amber-300" />
              <span>{saving ? 'Creating Consignment Note...' : 'Submit & Generate CN Document'}</span>
            </button>
          </div>
        </form>
      ) : (
        /* FULL ERP FORM FOR ADMINS */
        <form onSubmit={(e) => handleSubmit(e, false)} className="space-y-6">
        {/* SECTION A: COMPANY SELECTION */}
        <div className="bg-white border border-slate-200 rounded-xl p-4 sm:p-6 shadow-xs space-y-4">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 border-b border-slate-100 pb-3">
            <div className="flex items-center gap-2">
              <div className="p-2 rounded-lg bg-blue-50 text-setu-600 shrink-0">
                <Building2 className="w-4 h-4" />
              </div>
              <div>
                <h3 className="text-sm font-bold text-slate-900">Section A — Corporate Client Reference</h3>
                <p className="text-xs text-slate-500">B2B client account billing reference for rate cards</p>
              </div>
            </div>

            <div className="self-start sm:self-auto px-3 py-1 bg-setu-50 text-setu-700 rounded font-mono font-bold text-xs border border-setu-100 whitespace-nowrap">
              CN Number: {isEditMode ? (formData.cnNumber || 'Not specified') : (formData.cnNumber ? formData.cnNumber : 'Auto-generated on Submit')}
            </div>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-4 gap-4 text-xs">
            <div>
              <label className="block font-bold text-slate-700 uppercase tracking-wider mb-1">
                Consignment Note (CN) Number {isEditMode && <span className="text-rose-500">*</span>}
                {!isEditMode && <span className="text-[10px] text-slate-400 font-normal lowercase ml-1">(auto-assigned on submit)</span>}
              </label>
              <input
                type="text"
                value={formData.cnNumber || ''}
                onChange={(e) => {
                  const val = e.target.value.toUpperCase();
                  setFormData((prev) => ({ ...prev, cnNumber: val }));
                  if (cnDuplicateError) setCnDuplicateError(null);
                  if (errors.cnNumber) setErrors((prev) => { const copy = { ...prev }; delete copy.cnNumber; return copy; });
                }}
                placeholder={isEditMode ? "Enter CN Number (e.g. SS101)" : "Auto-generated on submit (e.g. SS2098)"}
                required={isEditMode}
                className={`w-full p-2.5 bg-white border ${cnDuplicateError || errors.cnNumber ? 'border-rose-500 ring-2 ring-rose-200' : 'border-slate-300'} rounded-md font-mono font-bold text-setu-700 focus:outline-none focus:ring-2 focus:ring-setu-600/20`}
              />
              {cnDuplicateError && (
                <p className="text-xs text-rose-600 font-bold mt-1 flex items-center gap-1">
                  <AlertCircle className="w-3.5 h-3.5 shrink-0" />
                  <span>{cnDuplicateError}</span>
                </p>
              )}
              {errors.cnNumber && !cnDuplicateError && (
                <p className="text-xs text-rose-600 font-bold mt-1">
                  {errors.cnNumber}
                </p>
              )}
            </div>

            <div>
              <label className="block font-bold text-slate-700 uppercase tracking-wider mb-1">
                AWB / Air Waybill No.
              </label>
              <input
                type="text"
                value={formData.awbNumber || ''}
                onChange={(e) => {
                  const val = e.target.value;
                  setFormData((prev) => ({ ...prev, awbNumber: val }));
                  if (awbDuplicateError) setAwbDuplicateError(null);
                }}
                placeholder="e.g. AWB-80363496"
                className={`w-full p-2.5 bg-white border ${awbDuplicateError ? 'border-rose-500 ring-2 ring-rose-200' : 'border-slate-300'} rounded-md font-mono font-semibold text-slate-900 focus:outline-none focus:ring-2 focus:ring-setu-600/20`}
              />
              {awbDuplicateError && (
                <p className="text-xs text-rose-600 font-bold mt-1 flex items-center gap-1">
                  <AlertCircle className="w-3.5 h-3.5 shrink-0" />
                  <span>{awbDuplicateError}</span>
                </p>
              )}
            </div>

            <div>
              <label className="block font-bold text-slate-700 uppercase tracking-wider mb-1">
                Corporate Company Account <span className="text-rose-500">*</span>
              </label>
              <select
                value={formData.companyId || ''}
                onChange={(e) => {
                  const comp = companies.find((c) => c.id === e.target.value);
                  if (comp) {
                    handleSelectCompany(comp);
                  } else {
                    setFormData((prev) => ({ ...prev, companyId: '', companyName: '', companyCode: '' }));
                  }
                  if (errors.companyId) setErrors((prev) => { const copy = { ...prev }; delete copy.companyId; return copy; });
                }}
                className={`w-full p-2.5 bg-white border ${errors.companyId ? 'border-rose-500 ring-2 ring-rose-200' : 'border-slate-300'} rounded-md focus:outline-none focus:ring-2 focus:ring-setu-600/20 font-bold text-slate-900 cursor-pointer`}
              >
                <option value="">-- Select Corporate Client Account --</option>
                {companies.map((c) => (
                  <option key={c.id} value={c.id}>
                    {c.companyName} ({c.companyCode || 'CLIENT'}) — GST: {c.gstin || 'N/A'}
                  </option>
                ))}
              </select>
              {errors.companyId && (
                <p className="text-xs text-rose-600 font-bold mt-1">
                  {errors.companyId}
                </p>
              )}
            </div>

            <div>
              <label className="block font-bold text-slate-700 uppercase tracking-wider mb-1">
                CN Booking Date
              </label>
              <input
                type="date"
                value={formData.cnDate || formData.bookingDate || ''}
                onChange={(e) => setFormData((prev) => ({ ...prev, cnDate: e.target.value, bookingDate: e.target.value }))}
                className="w-full p-2.5 bg-white border border-slate-300 rounded-md font-mono font-bold text-slate-900"
              />
            </div>
          </div>

          {renderPricingCoverageBanner()}
        </div>

        {/* SECTION B & C: CONSIGNOR & CONSIGNEE CARDS */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          {/* Section B: Consignor */}
          <div className="bg-white border border-slate-200 rounded-xl p-4 sm:p-6 shadow-xs space-y-4">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 border-b border-slate-100 pb-3">
              <div className="flex items-center gap-2">
                <div className="p-2 rounded-lg bg-emerald-50 text-emerald-600 shrink-0">
                  <User className="w-4 h-4" />
                </div>
                <div>
                  <h3 className="text-sm font-bold text-slate-900">Section B — Origin Consignor (Shipper)</h3>
                  <p className="text-xs text-slate-500">Pickup address and dispatch contact</p>
                </div>
              </div>

              <button
                type="button"
                onClick={() => handleAutofillSectionB()}
                className="self-start sm:self-auto px-2.5 py-1 text-[11px] font-bold text-emerald-700 bg-emerald-50 border border-emerald-200 rounded-lg hover:bg-emerald-100 transition-colors shadow-2xs shrink-0 whitespace-nowrap"
                title="Fill Section B with selected Corporate Account details"
              >
                Fill Corporate Details
              </button>
            </div>

            <div className="space-y-3 text-xs">


              <div>
                <label className="block font-bold text-slate-700 uppercase tracking-wider mb-1">
                  Consignor Name / Hub
                </label>
                <input
                  type="text"
                  value={formData.consignor?.name || ''}
                  onChange={(e) => {
                    setConsignorSelectMode('__custom__');
                    handleNestedInputChange('consignor', 'name', e.target.value);
                  }}
                  placeholder="e.g. Reliance Retail Ventures Ltd (Vendor Hub)"
                  className="w-full p-2.5 bg-white border border-slate-300 rounded-md font-semibold text-slate-900 focus:outline-none focus:ring-2 focus:ring-emerald-600/20"
                />
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <label className="block font-bold text-slate-700 uppercase tracking-wider mb-1">GSTIN</label>
                  <input
                    type="text"
                    value={formData.consignor?.gstin || ''}
                    onChange={(e) => handleNestedInputChange('consignor', 'gstin', e.target.value.toUpperCase())}
                    className="w-full p-2.5 bg-slate-50 border border-slate-300 rounded-md font-mono"
                  />
                </div>
                <div>
                  <label className="block font-bold text-slate-700 uppercase tracking-wider mb-1">Contact Phone</label>
                  <input
                    type="text"
                    value={formData.consignor?.contact || ''}
                    onChange={(e) => handleNestedInputChange('consignor', 'contact', e.target.value)}
                    placeholder="+91 98450 11223"
                    className="w-full p-2.5 bg-slate-50 border border-slate-300 rounded-md font-mono"
                  />
                </div>
              </div>

              <div>
                <label className="block font-bold text-slate-700 uppercase tracking-wider mb-1">Pickup Address</label>
                <input
                  type="text"
                  value={formData.consignor?.address || ''}
                  onChange={(e) => handleNestedInputChange('consignor', 'address', e.target.value)}
                  placeholder="Plot 14-A, Industrial Area"
                  className="w-full p-2.5 bg-slate-50 border border-slate-300 rounded-md"
                />
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                <div>
                  <label className="block font-bold text-slate-700 uppercase tracking-wider mb-1">City</label>
                  <input
                    type="text"
                    value={formData.consignor?.city || ''}
                    onChange={(e) => handleNestedInputChange('consignor', 'city', e.target.value)}
                    placeholder="Bengaluru"
                    className="w-full p-2.5 bg-slate-50 border border-slate-300 rounded-md font-semibold"
                  />
                </div>
                <div>
                  <label className="block font-bold text-slate-700 uppercase tracking-wider mb-1">State</label>
                  <select
                    value={formData.consignor?.state || ''}
                    onChange={(e) => handleNestedInputChange('consignor', 'state', e.target.value)}
                    className="w-full p-2.5 bg-slate-50 border border-slate-300 rounded-md"
                  >
                    <option value="">Select State...</option>
                    {INDIAN_STATES.map((s) => (
                      <option key={s} value={s}>{s}</option>
                    ))}
                  </select>
                </div>
                <div>
                  <label className="block font-bold text-slate-700 uppercase tracking-wider mb-1">PIN Code</label>
                  <input
                    type="text"
                    value={formData.consignor?.pin || ''}
                    onChange={(e) => handleNestedInputChange('consignor', 'pin', e.target.value)}
                    placeholder="560099"
                    maxLength={6}
                    className="w-full p-2.5 bg-slate-50 border border-slate-300 rounded-md font-mono"
                  />
                </div>
              </div>
            </div>
          </div>

          {/* Section C: Consignee */}
          <div className="bg-white border border-slate-200 rounded-xl p-4 sm:p-6 shadow-xs space-y-4">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 border-b border-slate-100 pb-3">
              <div className="flex items-center gap-2">
                <div className="p-2 rounded-lg bg-amber-50 text-amber-600 shrink-0">
                  <User className="w-4 h-4" />
                </div>
                <div>
                  <h3 className="text-sm font-bold text-slate-900">Section C — Destination Consignee (Receiver)</h3>
                  <p className="text-xs text-slate-500">Delivery address and recipient contact</p>
                </div>
              </div>

              <button
                type="button"
                onClick={() => handleAutofillSectionC()}
                className="self-start sm:self-auto px-2.5 py-1 text-[11px] font-bold text-amber-800 bg-amber-50 border border-amber-200 rounded-lg hover:bg-amber-100 transition-colors shadow-2xs shrink-0 whitespace-nowrap"
                title="Fill Section C with selected Corporate Account details"
              >
                Fill Corporate Details
              </button>
            </div>

            <div className="space-y-3 text-xs">


              <div>
                <label className="block font-bold text-slate-700 uppercase tracking-wider mb-1">
                  Consignee Name / Store
                </label>
                <input
                  type="text"
                  value={formData.consignee?.name || ''}
                  onChange={(e) => {
                    setConsigneeSelectMode('__custom__');
                    handleNestedInputChange('consignee', 'name', e.target.value);
                  }}
                  placeholder="e.g. Reliance Digital Megastore Depot"
                  className="w-full p-2.5 bg-white border border-slate-300 rounded-md font-semibold text-slate-900 focus:outline-none focus:ring-2 focus:ring-amber-600/20"
                />
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <label className="block font-bold text-slate-700 uppercase tracking-wider mb-1">GSTIN</label>
                  <input
                    type="text"
                    value={formData.consignee?.gstin || ''}
                    onChange={(e) => handleNestedInputChange('consignee', 'gstin', e.target.value.toUpperCase())}
                    className="w-full p-2.5 bg-slate-50 border border-slate-300 rounded-md font-mono"
                  />
                </div>
                <div>
                  <label className="block font-bold text-slate-700 uppercase tracking-wider mb-1">Contact Phone</label>
                  <input
                    type="text"
                    value={formData.consignee?.contact || ''}
                    onChange={(e) => handleNestedInputChange('consignee', 'contact', e.target.value)}
                    placeholder="+91 98220 33445"
                    className="w-full p-2.5 bg-slate-50 border border-slate-300 rounded-md font-mono"
                  />
                </div>
              </div>

              <div>
                <label className="block font-bold text-slate-700 uppercase tracking-wider mb-1">Delivery Address</label>
                <input
                  type="text"
                  value={formData.consignee?.address || ''}
                  onChange={(e) => handleNestedInputChange('consignee', 'address', e.target.value)}
                  placeholder="Industrial Park, Gate 2"
                  className="w-full p-2.5 bg-slate-50 border border-slate-300 rounded-md"
                />
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                <div>
                  <label className="block font-bold text-slate-700 uppercase tracking-wider mb-1">City</label>
                  <input
                    type="text"
                    value={formData.consignee?.city || ''}
                    onChange={(e) => handleNestedInputChange('consignee', 'city', e.target.value)}
                    placeholder="Pune"
                    className="w-full p-2.5 bg-slate-50 border border-slate-300 rounded-md font-semibold"
                  />
                </div>
                <div>
                  <label className="block font-bold text-slate-700 uppercase tracking-wider mb-1">State</label>
                  <select
                    value={formData.consignee?.state || ''}
                    onChange={(e) => handleNestedInputChange('consignee', 'state', e.target.value)}
                    className="w-full p-2.5 bg-slate-50 border border-slate-300 rounded-md"
                  >
                    <option value="">Select State...</option>
                    {INDIAN_STATES.map((s) => (
                      <option key={s} value={s}>{s}</option>
                    ))}
                  </select>
                </div>
                <div>
                  <label className="block font-bold text-slate-700 uppercase tracking-wider mb-1">PIN Code</label>
                  <input
                    type="text"
                    value={formData.consignee?.pin || ''}
                    onChange={(e) => handleNestedInputChange('consignee', 'pin', e.target.value)}
                    placeholder="411018"
                    maxLength={6}
                    className="w-full p-2.5 bg-slate-50 border border-slate-300 rounded-md font-mono"
                  />
                </div>
              </div>
            </div>
          </div>
        </div>

        {/* SECTION D: SHIPMENT DETAILS */}
        <div className="bg-white border border-slate-200 rounded-xl p-6 shadow-xs space-y-4">
          <div className="flex items-center gap-2 border-b border-slate-100 pb-3">
            <div className="p-2 rounded-lg bg-purple-50 text-purple-600">
              <Package className="w-4 h-4" />
            </div>
            <div>
              <h3 className="text-sm font-bold text-slate-900">Section D — Cargo & Dispatch Specifications</h3>
              <p className="text-xs text-slate-500">Route, package counts, actual and chargeable weight</p>
            </div>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-4 text-xs">
            <div>
              <label className="block font-bold text-slate-700 uppercase tracking-wider mb-1">
                Origin City / Hub
              </label>
              <input
                type="text"
                value={formData.origin}
                onChange={(e) => setFormData((prev) => ({ ...prev, origin: e.target.value }))}
                placeholder="e.g. Bengaluru Hub"
                className="w-full p-2.5 bg-slate-50 border border-slate-300 rounded-md font-semibold text-slate-900"
              />
            </div>

            <div>
              <label className="block font-bold text-slate-700 uppercase tracking-wider mb-1">
                Destination City / Hub
              </label>
              <input
                type="text"
                value={formData.destination}
                onChange={(e) => setFormData((prev) => ({ ...prev, destination: e.target.value }))}
                placeholder="e.g. Pune Hub"
                className="w-full p-2.5 bg-slate-50 border border-slate-300 rounded-md font-semibold text-slate-900"
              />
            </div>

            <div>
              <label className="block font-bold text-slate-700 uppercase tracking-wider mb-1">
                Freight Mode
              </label>
              <select
                value={formData.mode}
                onChange={(e) => setFormData((prev) => ({ ...prev, mode: e.target.value, freightMode: e.target.value }))}
                className="w-full p-2.5 bg-slate-50 border border-slate-300 rounded-md font-bold text-slate-900"
              >
                {MODE_OPTIONS.map((m) => (
                  <option key={m} value={m}>{m}</option>
                ))}
              </select>
            </div>

            <div>
              <label className="block font-bold text-slate-700 uppercase tracking-wider mb-1">
                Number of Packages
              </label>
              <input
                type="text"
                value={formData.packages ?? ''}
                onChange={(e) => setFormData((prev) => ({ ...prev, packages: e.target.value }))}
                placeholder="e.g. 10 Boxes, 142 Cartons, 5 Pallets"
                className="w-full p-2.5 bg-slate-50 border border-slate-300 rounded-md font-mono font-bold text-slate-900"
              />
            </div>

            <div>
              <label className="block font-bold text-slate-700 uppercase tracking-wider mb-1">
                Actual Gross Weight (Kg)
              </label>
              <input
                type="number"
                step="0.1"
                value={formData.actualWeight}
                onChange={(e) => {
                  const val = parseFloat(e.target.value) || 0;
                  const minWt = pricingValidation?.status === 'MATCHED' ? (pricingValidation.minimumChargeableWeight || 0) : 0;
                  setFormData((prev) => ({
                    ...prev,
                    actualWeight: val,
                    chargeableWeight: manualEditedFieldsRef.current.has('chargeableWeight')
                      ? prev.chargeableWeight
                      : (val > 0 ? Math.max(val, minWt) : (minWt > 0 ? minWt : 0))
                  }));
                }}
                className="w-full p-2.5 bg-slate-50 border border-slate-300 rounded-md font-mono font-bold text-slate-900"
              />
            </div>

            <div>
              <label className="block font-bold text-slate-700 uppercase tracking-wider mb-1">
                Chargeable Volumetric Weight (Kg)
              </label>
              <input
                type="number"
                step="0.1"
                value={formData.chargeableWeight}
                onChange={(e) => {
                  manualEditedFieldsRef.current.add('chargeableWeight');
                  setFormData((prev) => ({ ...prev, chargeableWeight: e.target.value === '' ? '' : (parseFloat(e.target.value) || 0) }));
                }}
                className="w-full p-2.5 bg-slate-50 border border-slate-300 rounded-md font-mono font-bold text-setu-700"
              />
            </div>

            <div className="md:col-span-3">
              <label className="block font-bold text-slate-700 uppercase tracking-wider mb-1">
                Commodity & Material Description
              </label>
              <input
                type="text"
                value={formData.materialDescription}
                onChange={(e) => setFormData((prev) => ({ ...prev, materialDescription: e.target.value }))}
                placeholder="e.g. Automotive Spare Electronics & Molded Plastic Assemblies"
                className="w-full p-2.5 bg-slate-50 border border-slate-300 rounded-md font-medium"
              />
            </div>

            <div>
              <label className="block font-bold text-slate-700 uppercase tracking-wider mb-1">
                Packing Charges (₹) <span className="text-[10px] text-slate-400 font-normal">(Optional)</span>
              </label>
              <input
                type="number"
                min="0"
                step="1"
                value={formData.packingCharges !== undefined && formData.packingCharges !== null ? formData.packingCharges : ''}
                onChange={(e) => {
                  manualEditedFieldsRef.current.add('packingCharges');
                  setFormData((prev) => ({ ...prev, packingCharges: e.target.value === '' ? '' : (parseFloat(e.target.value) || 0) }));
                }}
                placeholder="0 (Leave blank if N/A)"
                className="w-full p-2.5 bg-slate-50 border border-slate-300 rounded-md font-mono text-slate-900 font-bold"
              />
            </div>

            <div>
              <label className="block font-bold text-slate-700 uppercase tracking-wider mb-1">
                Labor & Loading Charges (₹) <span className="text-[10px] text-slate-400 font-normal">(Optional)</span>
              </label>
              <input
                type="number"
                min="0"
                step="1"
                value={formData.laborCharges !== undefined && formData.laborCharges !== null ? formData.laborCharges : ''}
                onChange={(e) => {
                  manualEditedFieldsRef.current.add('laborCharges');
                  setFormData((prev) => ({ ...prev, laborCharges: e.target.value === '' ? '' : (parseFloat(e.target.value) || 0) }));
                }}
                placeholder="0 (Leave blank if N/A)"
                className="w-full p-2.5 bg-slate-50 border border-slate-300 rounded-md font-mono text-slate-900 font-bold"
              />
            </div>

            <div>
              <label className="block font-bold text-slate-700 uppercase tracking-wider mb-1">
                Pickup Charges (₹) <span className="text-[10px] text-slate-400 font-normal">(Optional)</span>
              </label>
              <input
                type="number"
                min="0"
                step="1"
                value={formData.pickupCharges !== undefined && formData.pickupCharges !== null ? formData.pickupCharges : ''}
                onChange={(e) => {
                  manualEditedFieldsRef.current.add('pickupCharges');
                  setFormData((prev) => ({ ...prev, pickupCharges: e.target.value === '' ? '' : (parseFloat(e.target.value) || 0) }));
                }}
                placeholder="Leave blank for Rate Card"
                className="w-full p-2.5 bg-slate-50 border border-slate-300 rounded-md font-mono text-slate-900 font-bold"
              />
            </div>

            <div>
              <label className="block font-bold text-slate-700 uppercase tracking-wider mb-1">
                Delivery Charges (₹) <span className="text-[10px] text-slate-400 font-normal">(Optional)</span>
              </label>
              <input
                type="number"
                min="0"
                step="1"
                value={formData.deliveryCharges !== undefined && formData.deliveryCharges !== null ? formData.deliveryCharges : ''}
                onChange={(e) => {
                  manualEditedFieldsRef.current.add('deliveryCharges');
                  setFormData((prev) => ({ ...prev, deliveryCharges: e.target.value === '' ? '' : (parseFloat(e.target.value) || 0) }));
                }}
                placeholder="Leave blank for Rate Card"
                className="w-full p-2.5 bg-slate-50 border border-slate-300 rounded-md font-mono text-slate-900 font-bold"
              />
            </div>

            <div>
              <label className="block font-bold text-amber-800 uppercase tracking-wider mb-1">
                Godown Storage Charges (₹) <span className="text-[10px] text-slate-400 font-normal">(Optional)</span>
              </label>
              <input
                type="number"
                min="0"
                step="1"
                value={formData.godownCharges !== undefined && formData.godownCharges !== null ? formData.godownCharges : ''}
                onChange={(e) => {
                  manualEditedFieldsRef.current.add('godownCharges');
                  setFormData((prev) => ({ ...prev, godownCharges: e.target.value === '' ? '' : (parseFloat(e.target.value) || 0) }));
                }}
                placeholder="0 (e.g. 5000 storage fee)"
                className="w-full p-2.5 bg-amber-50/50 border border-amber-300 rounded-md font-mono text-amber-900 font-bold"
              />
            </div>

            {/* GODOWN MONTHS & MONTHLY RATE CALCULATOR */}
            <div className={`md:col-span-3 p-4 rounded-xl space-y-3 transition-all ${
              formData.isGodownOnlyBilling
                ? 'bg-amber-50/90 border-2 border-amber-400 shadow-xs'
                : 'bg-amber-50/40 border border-amber-200'
            }`}>
              <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-2 border-b border-amber-200/60 pb-2">
                <label className="flex items-center gap-2.5 cursor-pointer text-xs font-bold text-amber-950">
                  <input
                    type="checkbox"
                    checked={!!formData.isGodownOnlyBilling}
                    onChange={(e) => {
                      const checked = e.target.checked;
                      setFormData((prev) => {
                        const months = parseFloat(prev.godownMonths) || 0;
                        const rate = parseFloat(prev.godownRatePerMonth) || 0;
                        const calcGodown = (checked && months > 0 && rate > 0) ? (months * rate) : prev.godownCharges;
                        return {
                          ...prev,
                          isGodownOnlyBilling: checked,
                          godownCharges: calcGodown
                        };
                      });
                    }}
                    className="rounded text-amber-600 focus:ring-0 w-4 h-4 cursor-pointer"
                  />
                  <div>
                    <span className="block font-extrabold text-amber-950 text-sm">Shipment Held in Godown — Storage Billing</span>
                    <span className="text-[11px] font-normal text-amber-800">Check this to calculate storage fees per month and bill ONLY godown charges (Freight excluded).</span>
                  </div>
                </label>

                {((formData.godownCharges > 0) || (formData.godownMonths > 0)) && (
                  <span className="px-3 py-1 bg-amber-200/90 text-amber-950 rounded-full font-mono text-xs font-extrabold shadow-xs">
                    Total Storage: ₹{((formData.godownCharges || (parseFloat(formData.godownMonths || 0) * parseFloat(formData.godownRatePerMonth || 0))) || 0).toLocaleString('en-IN')}
                  </span>
                )}
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 pt-1">
                <div>
                  <label className="block text-xs font-bold text-amber-900 mb-1">
                    Number of Months Held in Godown
                  </label>
                  <input
                    type="number"
                    min="0"
                    step="0.5"
                    value={formData.godownMonths !== undefined && formData.godownMonths !== null ? formData.godownMonths : ''}
                    onChange={(e) => {
                      const val = e.target.value;
                      const months = val === '' ? '' : (parseFloat(val) || 0);
                      const rate = parseFloat(formData.godownRatePerMonth) || 0;
                      const calculatedTotal = (typeof months === 'number' && rate > 0) ? months * rate : formData.godownCharges;
                      setFormData((prev) => ({
                        ...prev,
                        godownMonths: months,
                        godownCharges: calculatedTotal
                      }));
                    }}
                    placeholder="e.g. 2 (Months)"
                    className="w-full p-2.5 bg-white border border-amber-300 rounded-md font-mono text-slate-900 font-bold"
                  />
                </div>

                <div>
                  <label className="block text-xs font-bold text-amber-900 mb-1">
                    Godown Charge Per Month (₹ / Month)
                  </label>
                  <input
                    type="number"
                    min="0"
                    step="100"
                    value={formData.godownRatePerMonth !== undefined && formData.godownRatePerMonth !== null ? formData.godownRatePerMonth : ''}
                    onChange={(e) => {
                      const val = e.target.value;
                      const rate = val === '' ? '' : (parseFloat(val) || 0);
                      const months = parseFloat(formData.godownMonths) || 0;
                      const calculatedTotal = (months > 0 && typeof rate === 'number') ? months * rate : formData.godownCharges;
                      setFormData((prev) => ({
                        ...prev,
                        godownRatePerMonth: rate,
                        godownCharges: calculatedTotal
                      }));
                    }}
                    placeholder="e.g. 5000 (₹ / Month)"
                    className="w-full p-2.5 bg-white border border-amber-300 rounded-md font-mono text-slate-900 font-bold"
                  />
                </div>
              </div>
            </div>
          </div>
        </div>

        {/* SECTION E: COMMERCIAL INVOICES & E-WAY BILLS */}
        <div className="bg-white border border-slate-200 rounded-xl p-4 sm:p-6 shadow-xs space-y-4">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 border-b border-slate-100 pb-3">
            <div className="flex items-center gap-2">
              <div className="p-2 rounded-lg bg-blue-50 text-setu-600 shrink-0">
                <FileText className="w-4 h-4" />
              </div>
              <div>
                <h3 className="text-sm font-bold text-slate-900">Section E — Commercial Invoice & E-Way Bill Details</h3>
                <p className="text-xs text-slate-500">Shipper invoice numbers, declared cargo values and E-Way bills</p>
              </div>
            </div>

            <button
              type="button"
              onClick={handleAddCommercialInvoice}
              className="self-start sm:self-auto px-3 py-1.5 text-xs font-bold text-setu-700 bg-setu-50 border border-setu-200 rounded-lg hover:bg-setu-100 transition-colors flex items-center gap-1.5 shadow-2xs shrink-0 whitespace-nowrap"
            >
              <Plus className="w-3.5 h-3.5" />
              + Add Commercial Invoice
            </button>
          </div>

          {/* Invoices List */}
          <div className="space-y-3">
            {(formData.commercialInvoices && formData.commercialInvoices.length > 0
              ? formData.commercialInvoices
              : [{ invoiceNumber: formData.invoiceDetails?.invoiceNumber || '', invoiceDate: formData.invoiceDetails?.invoiceDate || '', invoiceQuantity: formData.invoiceDetails?.invoiceQuantity || '', invoiceValue: formData.invoiceDetails?.invoiceValue || 0, ewayBillNumber: formData.ewayBillNumber || '' }]
            ).map((inv, idx) => (
              <div key={idx} className="flex flex-col sm:flex-row items-start sm:items-center gap-3 p-3 bg-slate-50 border border-slate-200 rounded-lg text-xs">
                <div className="w-6 h-6 rounded-full bg-slate-200 text-slate-700 font-bold flex items-center justify-center text-[10px] shrink-0">
                  #{idx + 1}
                </div>

                <div className="flex-1 grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-3 w-full">
                  <div>
                    <label className="block font-bold text-slate-700 uppercase tracking-wider mb-1 text-[11px]">
                      Invoice Number
                    </label>
                    <input
                      type="text"
                      value={inv.invoiceNumber || ''}
                      onChange={(e) => handleCommercialInvoiceChange(idx, 'invoiceNumber', e.target.value)}
                      placeholder="e.g. INV-904128"
                      className="w-full p-2 bg-white border border-slate-300 rounded font-mono font-semibold text-slate-900"
                    />
                  </div>

                  <div>
                    <label className="block font-bold text-slate-700 uppercase tracking-wider mb-1 text-[11px]">
                      Invoice Date
                    </label>
                    <input
                      type="date"
                      value={inv.invoiceDate || ''}
                      onChange={(e) => handleCommercialInvoiceChange(idx, 'invoiceDate', e.target.value)}
                      className="w-full p-2 bg-white border border-slate-300 rounded font-mono font-semibold text-slate-900"
                    />
                  </div>

                  <div>
                    <label className="block font-bold text-slate-700 uppercase tracking-wider mb-1 text-[11px]">
                      Invoice Quantity (Pcs/Units)
                    </label>
                    <input
                      type="number"
                      min="0"
                      value={inv.invoiceQuantity !== undefined && inv.invoiceQuantity !== null && inv.invoiceQuantity !== 0 && inv.invoiceQuantity !== '0' ? inv.invoiceQuantity : ''}
                      onChange={(e) => handleCommercialInvoiceChange(idx, 'invoiceQuantity', e.target.value === '' ? '' : (parseInt(e.target.value, 10) || ''))}
                      placeholder="e.g. 50"
                      className="w-full p-2 bg-white border border-slate-300 rounded font-mono font-bold text-slate-900"
                    />
                  </div>

                  <div>
                    <label className="block font-bold text-slate-700 uppercase tracking-wider mb-1 text-[11px]">
                      Invoice Value (Declared ₹)
                    </label>
                    <input
                      type="number"
                      value={inv.invoiceValue !== undefined && inv.invoiceValue !== null ? inv.invoiceValue : ''}
                      onChange={(e) => handleCommercialInvoiceChange(idx, 'invoiceValue', e.target.value === '' ? 0 : parseFloat(e.target.value) || 0)}
                      placeholder="0"
                      className="w-full p-2 bg-white border border-slate-300 rounded font-mono font-bold text-slate-900"
                    />
                  </div>

                  <div>
                    <label className="block font-bold text-slate-700 uppercase tracking-wider mb-1 text-[11px]">
                      E-Way Bill Number (12 Digits)
                    </label>
                    <input
                      type="text"
                      value={inv.ewayBillNumber || ''}
                      onChange={(e) => handleCommercialInvoiceChange(idx, 'ewayBillNumber', e.target.value)}
                      placeholder="e.g. 381029481920"
                      maxLength={12}
                      className="w-full p-2 bg-white border border-slate-300 rounded font-mono text-slate-900"
                    />
                  </div>
                </div>

                {(formData.commercialInvoices || []).length > 1 && (
                  <button
                    type="button"
                    onClick={() => handleRemoveCommercialInvoice(idx)}
                    className="p-1.5 text-slate-400 hover:text-rose-600 rounded transition-colors self-end sm:self-center"
                    title="Remove Invoice"
                  >
                    <Trash2 className="w-4 h-4" />
                  </button>
                )}
              </div>
            ))}
          </div>

          {/* Summary Box */}
          <div className="flex flex-wrap items-center justify-between gap-2 p-3 bg-blue-50/60 border border-blue-100 rounded-lg text-xs font-semibold text-slate-700">
            <span>Total Commercial Invoices: <strong>{(formData.commercialInvoices || []).length || 1}</strong></span>
            <span>Total Invoice Qty: <strong className="text-blue-700 font-mono text-sm">{(() => {
              const hasQty = (formData.commercialInvoices || []).some(i => i.invoiceQuantity !== '' && i.invoiceQuantity !== undefined && i.invoiceQuantity !== null && i.invoiceQuantity !== 0 && i.invoiceQuantity !== '0');
              if (hasQty) {
                const total = (formData.commercialInvoices || []).reduce((sum, i) => sum + (parseInt(i.invoiceQuantity, 10) || 0), 0);
                return `${total.toLocaleString('en-IN')} Units`;
              }
              if (formData.invoiceDetails?.invoiceQuantity && formData.invoiceDetails?.invoiceQuantity !== 0 && formData.invoiceDetails?.invoiceQuantity !== '0') {
                return `${Number(formData.invoiceDetails.invoiceQuantity).toLocaleString('en-IN')} Units`;
              }
              return '-';
            })()}</strong></span>
            <span>Total Declared Cargo Value: <strong className="text-setu-700 font-mono text-sm">₹{((formData.commercialInvoices || []).reduce((sum, i) => sum + (parseFloat(i.invoiceValue) || 0), 0) || formData.invoiceDetails?.invoiceValue || 0).toLocaleString('en-IN')}</strong></span>
          </div>

          <div className="pt-2 border-t border-slate-100">
            <div className="flex flex-wrap items-center justify-between gap-2 mb-2">
              <label className="block font-bold text-slate-800 uppercase tracking-wider">
                GST Tax Applicable For This Shipment Bill?
              </label>
              {pricingValidation?.status === 'MATCHED' && (
                <span className="text-[11px] font-bold px-2 py-0.5 rounded bg-emerald-50 text-emerald-800 border border-emerald-200">
                  From Quotation: {formData.isGstExempt ? '0% GST Exempt' : `${formData.gstRate ?? 18}% GST`}
                  {formData.rcmApplicable ? ' • Under RCM' : ''}
                </span>
              )}
            </div>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 text-xs">
              <label className={`flex items-center gap-2.5 p-3 rounded-lg border cursor-pointer transition-all ${
                !formData.isGstExempt && formData.gstRate !== 0
                  ? 'bg-setu-50/60 border-setu-300 text-setu-900 shadow-xs'
                  : 'bg-slate-50 border-slate-200 text-slate-700 hover:bg-slate-100'
              }`}>
                <input
                  type="radio"
                  name="gstExemptOption"
                  checked={!formData.isGstExempt && formData.gstRate !== 0}
                  onChange={() => {
                    manualEditedFieldsRef.current.add('gst');
                    setFormData((prev) => ({
                      ...prev,
                      isGstExempt: false,
                      gstRate: (prev.taxConfiguration?.gstRate && prev.taxConfiguration.gstRate > 0) ? prev.taxConfiguration.gstRate : 18
                    }));
                  }}
                  className="text-setu-600 focus:ring-0"
                />
                <div>
                  <span className="font-bold text-slate-900 block text-xs">
                    Charge {formData.gstRate || 18}% GST Tax{formData.rcmApplicable ? ' (Under RCM)' : ' (IGST)'}
                  </span>
                  <span className="text-[11px] text-slate-500 font-normal">
                    {formData.taxConfiguration?.notes || 'Add GST on Freight, Packing, Labor & Charges'}
                  </span>
                </div>
              </label>

              <label className={`flex items-center gap-2.5 p-3 rounded-lg border cursor-pointer transition-all ${
                formData.isGstExempt || formData.gstRate === 0
                  ? 'bg-emerald-50/60 border-emerald-300 text-emerald-900 shadow-xs'
                  : 'bg-slate-50 border-slate-200 text-slate-700 hover:bg-slate-100'
              }`}>
                <input
                  type="radio"
                  name="gstExemptOption"
                  checked={formData.isGstExempt || formData.gstRate === 0}
                  onChange={() => {
                    manualEditedFieldsRef.current.add('gst');
                    setFormData((prev) => ({ ...prev, isGstExempt: true, gstRate: 0 }));
                  }}
                  className="text-emerald-600 focus:ring-0"
                />
                <div>
                  <span className="font-bold text-emerald-800 block text-xs">0% GST Exempt / Reverse Charge (No Tax)</span>
                  <span className="text-[11px] text-emerald-600 font-normal">Do not charge GST on bill (Tax = ₹0)</span>
                </div>
              </label>
            </div>
          </div>
        </div>

        {/* BOTTOM FORM ACTIONS */}
        <div className="flex flex-col-reverse sm:flex-row items-stretch sm:items-center justify-end gap-2.5 sm:gap-3 pt-4 border-t border-slate-200">
          <button
            type="button"
            onClick={() => navigate(-1)}
            className="w-full sm:w-auto px-4 py-2 text-xs font-semibold text-slate-700 bg-white border border-slate-300 rounded-md hover:bg-slate-50 transition-colors text-center"
          >
            Cancel
          </button>

          {!isEditMode && (
            <button
              type="button"
              disabled={saving}
              onClick={(e) => handleSubmit(e, true)}
              className="w-full sm:w-auto px-4 py-2 text-xs font-bold text-setu-700 bg-setu-50 border border-setu-200 rounded-md hover:bg-setu-100 transition-colors text-center"
            >
              Create & Add Another
            </button>
          )}

          <button
            type="submit"
            disabled={saving}
            className="w-full sm:w-auto inline-flex items-center justify-center gap-2 px-5 py-2 text-xs font-bold text-white bg-setu-600 hover:bg-setu-700 rounded-md shadow-sm transition-colors disabled:opacity-50"
          >
            <Save className="w-4 h-4" />
            <span>{saving ? 'Saving...' : isEditMode ? 'Save Changes' : 'Create Shipment'}</span>
          </button>
        </div>
      </form>
      )}

      {/* SUCCESS MODAL */}
      <Modal
        isOpen={!!createdCN}
        onClose={() => navigate(`/admin/shipments/${createdCN || createdId}`)}
        title="Shipment Created Successfully"
        footer={
          <div className="flex flex-wrap items-center justify-end gap-2 w-full">
            <button
              onClick={() => {
                setCreatedCN(null);
                setCreatedShipment(null);
                setFormData(INITIAL_FORM_STATE);
              }}
              className="px-3 py-1.5 text-xs font-semibold text-slate-700 bg-white border border-slate-300 rounded hover:bg-slate-50"
            >
              Create Another Shipment
            </button>

            <button
              onClick={() => setShowCNModal(true)}
              className="px-3.5 py-1.5 text-xs font-bold text-slate-900 bg-amber-400 hover:bg-amber-300 rounded shadow-xs inline-flex items-center gap-1.5"
            >
              <span>Print Pickup Document (CN)</span>
            </button>

            <button
              onClick={() => navigate(`/admin/shipments/${createdCN || createdId}`)}
              className="px-4 py-1.5 text-xs font-bold text-white bg-setu-600 hover:bg-setu-700 rounded shadow-xs"
            >
              View Shipment Details
            </button>
          </div>
        }
      >
        <div className="space-y-3 text-xs text-center py-2">
          <CheckCircle2 className="w-10 h-10 text-emerald-600 mx-auto" />
          <h4 className="font-bold text-slate-900 text-sm">Consignment Note Issued</h4>
          <p className="text-slate-600 text-xs">
            Shipment has been registered under <strong>{formData.companyName}</strong>.
          </p>
          <div className="p-3 bg-setu-50 border border-setu-200 rounded-lg inline-block font-mono text-base font-bold text-setu-700">
            CN Number: {createdCN}
          </div>

          <div className="p-3 bg-amber-50 border border-amber-200 rounded-lg text-amber-900 text-left text-xs space-y-1">
            <span className="font-bold block">Pickup Document Ready</span>
            <p>You can generate and print the official Speed Setu Consignment Note (Pickup Document) immediately using the button below or print it anytime later from the shipment details page.</p>
          </div>
        </div>
      </Modal>

      {/* SCENARIO C: NO QUOTATION / RATE CARD CONFIRMATION MODAL */}
      <Modal
        isOpen={showUnpricedConfirmModal}
        onClose={() => {
          setShowUnpricedConfirmModal(false);
          setPendingSubmit(null);
        }}
        title="Warning: No Quotation / Rate Card Found"
        maxWidth="max-w-lg"
      >
        <div className="space-y-4 text-xs">
          <div className="p-3 bg-amber-50 border border-amber-200 rounded-lg text-amber-900 flex items-start gap-2.5">
            <AlertTriangle className="w-5 h-5 text-amber-600 shrink-0 mt-0.5" />
            <p className="leading-relaxed">
              The selected company's quotation does not cover this pickup and drop location, and no applicable rate card was found. Do you want to proceed with creating this shipment without agreed pricing?
            </p>
          </div>

          <div className="bg-slate-50 border border-slate-200 rounded-lg p-3 space-y-1.5 font-mono text-[11px]">
            <div className="flex justify-between">
              <span className="text-slate-500">Company:</span>
              <strong className="text-slate-800">{formData.companyName || 'Not specified'}</strong>
            </div>
            <div className="flex justify-between">
              <span className="text-slate-500">Pickup Location:</span>
              <strong className="text-slate-800">{formData.origin || formData.consignor?.city || 'Origin'}</strong>
            </div>
            <div className="flex justify-between">
              <span className="text-slate-500">Drop Location:</span>
              <strong className="text-slate-800">{formData.destination || formData.consignee?.city || 'Destination'}</strong>
            </div>
            <div className="flex justify-between">
              <span className="text-slate-500">Freight Mode:</span>
              <strong className="text-slate-800">{formData.freightMode || formData.mode || 'Road'}</strong>
            </div>
          </div>

          <div className="p-2.5 bg-rose-50 border border-rose-200 rounded-lg text-rose-800 text-[11px] font-medium">
            ⚠️ <strong>Billing Restriction:</strong> This shipment will be marked as requiring pricing approval. <strong>Tax invoices cannot be generated for this shipment</strong> until valid quotation or rate card coverage is established.
          </div>

          <div className="flex items-center justify-end gap-2 pt-3 border-t border-slate-100">
            <button
              type="button"
              onClick={() => {
                setShowUnpricedConfirmModal(false);
                setPendingSubmit(null);
              }}
              className="px-4 py-2 text-xs font-bold text-slate-700 bg-white border border-slate-300 rounded-lg hover:bg-slate-50 transition-colors cursor-pointer"
            >
              Cancel
            </button>
            <button
              type="button"
              onClick={() => {
                setShowUnpricedConfirmModal(false);
                handleSubmit(null, pendingSubmit?.createAnother || false, true);
              }}
              className="px-4 py-2 text-xs font-bold text-white bg-amber-600 hover:bg-amber-700 rounded-lg shadow-sm transition-colors cursor-pointer"
            >
              Proceed Without Quotation
            </button>
          </div>
        </div>
      </Modal>

      {/* CONSIGNMENT NOTE PICKUP DOCUMENT MODAL */}
      <ConsignmentNoteModal
        isOpen={showCNModal}
        onClose={() => setShowCNModal(false)}
        shipment={createdShipment || { ...formData, cnNumber: createdCN, id: createdId }}
      />
    </div>
  );
};
