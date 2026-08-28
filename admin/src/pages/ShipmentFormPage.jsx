import React, { useState, useEffect } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { shipmentService } from '../services/shipmentService';
import { companyService } from '../services/companyService';
import { validateShipmentForm } from '../utils/shipmentValidation';
import { PageHeader } from '../components/common/PageHeader';
import { LoadingState } from '../components/common/LoadingState';
import { Modal } from '../components/common/Modal';
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

  consignor: {
    name: '',
    code: '',
    gstin: '',
    address: '',
    city: '',
    state: '',
    pin: '',
    contact: ''
  },

  consignee: {
    name: '',
    code: '',
    gstin: '',
    address: '',
    city: '',
    state: '',
    pin: '',
    contact: ''
  },

  origin: '',
  destination: '',
  mode: 'Express LTL',
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
      invoiceValue: '',
      ewayBillNumber: ''
    }
  ],

  invoiceDetails: {
    invoiceNumber: '',
    invoiceDate: new Date().toISOString().split('T')[0],
    invoiceValue: 0,
    invoiceQuantity: 0
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

export const ShipmentFormPage = () => {
  const navigate = useNavigate();
  const { id } = useParams();
  const isEditMode = !!id;

  const [formData, setFormData] = useState(INITIAL_FORM_STATE);
  const [companies, setCompanies] = useState([]);
  const [errors, setErrors] = useState({});
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  // Consignor & Consignee Dropdown Select State
  const [consignorSelectMode, setConsignorSelectMode] = useState('');
  const [consigneeSelectMode, setConsigneeSelectMode] = useState('');
  const [savedConsignorsList, setSavedConsignorsList] = useState(DEFAULT_CONSIGNORS);
  const [savedConsigneesList, setSavedConsigneesList] = useState(DEFAULT_CONSIGNEES);

  // Success Modal State
  const [createdCN, setCreatedCN] = useState(null);
  const [createdId, setCreatedId] = useState(null);

  const handleAddCommercialInvoice = () => {
    setFormData((prev) => ({
      ...prev,
      commercialInvoices: [
        ...(prev.commercialInvoices || []),
        { invoiceNumber: '', invoiceValue: 0, ewayBillNumber: '', awbNumber: '' }
      ]
    }));
  };

  const handleRemoveCommercialInvoice = (idx) => {
    setFormData((prev) => {
      const updated = (prev.commercialInvoices || []).filter((_, i) => i !== idx);
      const safeList = updated.length > 0 ? updated : [{ invoiceNumber: '', invoiceValue: 0, ewayBillNumber: '', awbNumber: '' }];
      const totalVal = safeList.reduce((sum, inv) => sum + (parseFloat(inv.invoiceValue) || 0), 0);
      const combinedInvoices = safeList.map((inv) => inv.invoiceNumber).filter(Boolean).join(', ');
      const combinedEway = safeList.map((inv) => inv.ewayBillNumber).filter(Boolean).join(', ');
      const combinedAwb = safeList.map((inv) => inv.awbNumber).filter(Boolean).join(', ');

      return {
        ...prev,
        commercialInvoices: safeList,
        invoiceDetails: {
          ...prev.invoiceDetails,
          invoiceNumber: combinedInvoices || prev.invoiceDetails?.invoiceNumber || '',
          invoiceValue: totalVal
        },
        ewayBillNumber: combinedEway || prev.ewayBillNumber || '',
        awbNumber: combinedAwb || prev.awbNumber || ''
      };
    });
  };

  const handleCommercialInvoiceChange = (idx, field, value) => {
    setFormData((prev) => {
      const list = [...(prev.commercialInvoices || [])];
      if (!list[idx]) list[idx] = { invoiceNumber: '', invoiceValue: 0, ewayBillNumber: '', awbNumber: '' };
      list[idx] = { ...list[idx], [field]: value };

      const totalVal = list.reduce((sum, inv) => sum + (parseFloat(inv.invoiceValue) || 0), 0);
      const combinedInvoices = list.map((inv) => inv.invoiceNumber).filter(Boolean).join(', ');
      const combinedEway = list.map((inv) => inv.ewayBillNumber).filter(Boolean).join(', ');
      const combinedAwb = list.map((inv) => inv.awbNumber).filter(Boolean).join(', ');

      return {
        ...prev,
        commercialInvoices: list,
        invoiceDetails: {
          ...prev.invoiceDetails,
          invoiceNumber: combinedInvoices || prev.invoiceDetails?.invoiceNumber || '',
          invoiceValue: totalVal
        },
        ewayBillNumber: combinedEway || prev.ewayBillNumber || '',
        awbNumber: combinedAwb || prev.awbNumber || ''
      };
    });
  };

  useEffect(() => {
    const loadInitialData = async () => {
      setLoading(true);
      try {
        const compList = await companyService.getCompanies();
        setCompanies(compList);

        // Start clean with no pre-fed data - users add custom consignors/consignees one by one
        setSavedConsignorsList([]);
        setSavedConsigneesList([]);

        if (isEditMode) {
          const existing = await shipmentService.getShipment(id);
          const commInvoices = existing.commercialInvoices && existing.commercialInvoices.length > 0
            ? existing.commercialInvoices
            : [
                {
                  invoiceNumber: existing.invoiceDetails?.invoiceNumber || '',
                  invoiceValue: existing.invoiceDetails?.invoiceValue || 0,
                  ewayBillNumber: existing.ewayBillNumber || '',
                  awbNumber: existing.awbNumber || ''
                }
              ];
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
              contact: ''
            },
            consignee: {
              name: '',
              code: '',
              gstin: '',
              address: '',
              city: '',
              state: '',
              pin: '',
              contact: ''
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
          contact: ''
        }
      }));
      return;
    }

    const found = savedConsignorsList.find((c) => c.name === val || c.id === val);
    if (found) {
      setFormData((prev) => ({
        ...prev,
        origin: found.city || prev.origin,
        consignor: {
          ...prev.consignor,
          name: found.name,
          gstin: found.gstin || prev.consignor?.gstin || '',
          contact: found.contact || prev.consignor?.contact || '',
          address: found.address || prev.consignor?.address || '',
          city: found.city || prev.consignor?.city || '',
          state: found.state || prev.consignor?.state || '',
          pin: found.pin || prev.consignor?.pin || ''
        }
      }));
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
          contact: ''
        }
      }));
      return;
    }

    const found = savedConsigneesList.find((e) => e.name === val || e.id === val);
    if (found) {
      setFormData((prev) => ({
        ...prev,
        destination: found.city || prev.destination,
        consignee: {
          ...prev.consignee,
          name: found.name,
          gstin: found.gstin || prev.consignee?.gstin || '',
          contact: found.contact || prev.consignee?.contact || '',
          address: found.address || prev.consignee?.address || '',
          city: found.city || prev.consignee?.city || '',
          state: found.state || prev.consignee?.state || '',
          pin: found.pin || prev.consignee?.pin || ''
        }
      }));
    }
  };

  const handleAutofillSectionB = (compObj) => {
    const targetComp = compObj || companies.find((c) => c.id === formData.companyId) || companies[0];
    if (!targetComp) return;
    setFormData((prev) => ({
      ...prev,
      companyId: targetComp.id,
      companyName: targetComp.companyName,
      companyCode: targetComp.companyCode,
      origin: targetComp.billing?.city ? `${targetComp.billing.city} Hub` : prev.origin,
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
    const targetComp = compObj || companies.find((c) => c.id === formData.companyId) || companies[0];
    if (!targetComp) return;
    setFormData((prev) => ({
      ...prev,
      companyId: targetComp.id,
      companyName: targetComp.companyName,
      companyCode: targetComp.companyCode,
      destination: targetComp.billing?.city ? `${targetComp.billing.city} Hub` : prev.destination,
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

  const handleSubmit = async (e, createAnother = false) => {
    if (e) e.preventDefault();
    const validationErrors = validateShipmentForm(formData);
    if (Object.keys(validationErrors).length > 0) {
      setErrors(validationErrors);
      window.scrollTo({ top: 0, behavior: 'smooth' });
      return;
    }

    setSaving(true);
    try {
      const defaultCompany = companies.find((c) => c.id === formData.companyId) || companies[0] || {};
      const payload = {
        ...formData,
        companyId: formData.companyId || defaultCompany.id || 'GEN-COMP',
        companyName: formData.companyName || defaultCompany.companyName || 'General Corporate Client',
        companyCode: formData.companyCode || defaultCompany.companyCode || 'GCC',
        consignor: {
          ...formData.consignor,
          name: formData.consignor?.name || `${formData.companyName || 'Corporate'} Origin Hub`,
          city: formData.consignor?.city || 'Bengaluru',
          state: formData.consignor?.state || 'Karnataka'
        },
        consignee: {
          ...formData.consignee,
          name: formData.consignee?.name || 'Destination Receiver Store',
          city: formData.consignee?.city || 'Pune',
          state: formData.consignee?.state || 'Maharashtra'
        },
        origin: formData.origin || formData.consignor?.city || 'Origin Hub',
        destination: formData.destination || formData.consignee?.city || 'Destination Hub',
        packages: formData.packages || 1,
        actualWeight: formData.actualWeight || 10,
        chargeableWeight: formData.chargeableWeight || formData.actualWeight || 10
      };

      if (isEditMode) {
        await shipmentService.updateShipment(id, payload);
        navigate(`/admin/shipments/${id}`);
      } else {
        const created = await shipmentService.createShipment(payload);
        if (createAnother) {
          setFormData({
            ...INITIAL_FORM_STATE,
            cnNumber: '',
            companyId: companies[0]?.id || '',
            companyName: companies[0]?.companyName || '',
            companyCode: companies[0]?.companyCode || ''
          });
          setErrors({});
          window.scrollTo({ top: 0, behavior: 'smooth' });
          alert(`Shipment ${created.cnNumber} created successfully!`);
        } else {
          setCreatedCN(created.cnNumber);
          setCreatedId(created.id);
        }
      }
    } catch (err) {
      alert(err.message || 'Failed to save shipment.');
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
          <button
            type="button"
            onClick={() => navigate(-1)}
            className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold text-slate-700 bg-white border border-slate-300 rounded-md hover:bg-slate-50 transition-colors"
          >
            <ArrowLeft className="w-4 h-4" />
            <span>Cancel</span>
          </button>
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
              CN Number: {formData.cnNumber || 'Not specified'}
            </div>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-4 gap-4 text-xs">
            <div>
              <label className="block font-bold text-slate-700 uppercase tracking-wider mb-1">
                Consignment Note (CN) Number
              </label>
              <input
                type="text"
                value={formData.cnNumber}
                disabled={isEditMode}
                onChange={(e) => setFormData((prev) => ({ ...prev, cnNumber: e.target.value }))}
                placeholder="Enter CN Number (e.g. SS101)"
                required
                className="w-full p-2.5 bg-white border border-slate-300 rounded-md font-mono font-bold text-setu-700 focus:outline-none focus:ring-2 focus:ring-setu-600/20 disabled:bg-slate-100 disabled:text-slate-500"
              />
            </div>

            <div>
              <label className="block font-bold text-slate-700 uppercase tracking-wider mb-1">
                AWB / Air Waybill No.
              </label>
              <input
                type="text"
                value={formData.awbNumber || ''}
                onChange={(e) => setFormData((prev) => ({ ...prev, awbNumber: e.target.value }))}
                placeholder="e.g. AWB-80363496"
                className="w-full p-2.5 bg-white border border-slate-300 rounded-md font-mono font-semibold text-slate-900 focus:outline-none focus:ring-2 focus:ring-setu-600/20"
              />
            </div>

            <div>
              <label className="block font-bold text-slate-700 uppercase tracking-wider mb-1">
                Corporate Company Account
              </label>
              <select
                value={formData.companyId}
                disabled={isEditMode}
                onChange={(e) => {
                  const comp = companies.find((c) => c.id === e.target.value);
                  if (comp) {
                    handleSelectCompany(comp);
                  } else {
                    setFormData((prev) => ({ ...prev, companyId: '', companyName: '', companyCode: '' }));
                  }
                }}
                className="w-full p-2.5 bg-slate-50 border border-slate-300 rounded-md focus:outline-none focus:ring-2 focus:ring-setu-600/20 font-bold text-slate-900"
              >
                <option value="">-- Select Corporate Client Account --</option>
                {companies.map((c) => (
                  <option key={c.id} value={c.id}>
                    {c.companyName} ({c.companyCode}) — GST: {c.gstin || 'N/A'}
                  </option>
                ))}
              </select>
            </div>

            <div>
              <label className="block font-bold text-slate-700 uppercase tracking-wider mb-1">
                CN Booking Date
              </label>
              <input
                type="date"
                value={formData.cnDate}
                onChange={(e) => setFormData((prev) => ({ ...prev, cnDate: e.target.value }))}
                className="w-full p-2.5 bg-slate-50 border border-slate-300 rounded-md font-mono font-bold text-slate-900"
              />
            </div>
          </div>
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
                ⚡ Fill Corporate Details
              </button>
            </div>

            <div className="space-y-3 text-xs">
              <div>
                <label className="block font-bold text-slate-700 uppercase tracking-wider mb-1">
                  Select Consignor (Shipper)
                </label>
                <select
                  value={consignorSelectMode}
                  onChange={(e) => handleConsignorSelect(e.target.value)}
                  className="w-full p-2.5 bg-slate-50 border border-slate-300 rounded-md font-bold text-slate-900 focus:outline-none focus:ring-2 focus:ring-emerald-600/20"
                >
                  <option value="">-- Select Saved Consignor / Shipper Hub --</option>
                  {savedConsignorsList.map((c) => (
                    <option key={c.id || c.name} value={c.name}>
                      {c.name} {c.city ? `(${c.city})` : ''}
                    </option>
                  ))}
                  <option value="__custom__">✍️ + Custom Add New Consignor</option>
                </select>
              </div>

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
                ⚡ Fill Corporate Details
              </button>
            </div>

            <div className="space-y-3 text-xs">
              <div>
                <label className="block font-bold text-slate-700 uppercase tracking-wider mb-1">
                  Select Consignee (Receiver)
                </label>
                <select
                  value={consigneeSelectMode}
                  onChange={(e) => handleConsigneeSelect(e.target.value)}
                  className="w-full p-2.5 bg-slate-50 border border-slate-300 rounded-md font-bold text-slate-900 focus:outline-none focus:ring-2 focus:ring-amber-600/20"
                >
                  <option value="">-- Select Saved Consignee / Delivery Store --</option>
                  {savedConsigneesList.map((e) => (
                    <option key={e.id || e.name} value={e.name}>
                      {e.name} {e.city ? `(${e.city})` : ''}
                    </option>
                  ))}
                  <option value="__custom__">✍️ + Custom Add New Consignee</option>
                </select>
              </div>

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
                onChange={(e) => setFormData((prev) => ({ ...prev, mode: e.target.value }))}
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
                onChange={(e) => setFormData((prev) => ({ ...prev, actualWeight: parseFloat(e.target.value) || 0 }))}
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
                onChange={(e) => setFormData((prev) => ({ ...prev, chargeableWeight: parseFloat(e.target.value) || 0 }))}
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
                onChange={(e) => setFormData((prev) => ({ ...prev, packingCharges: e.target.value === '' ? '' : (parseFloat(e.target.value) || 0) }))}
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
                onChange={(e) => setFormData((prev) => ({ ...prev, laborCharges: e.target.value === '' ? '' : (parseFloat(e.target.value) || 0) }))}
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
                onChange={(e) => setFormData((prev) => ({ ...prev, pickupCharges: e.target.value === '' ? '' : (parseFloat(e.target.value) || 0) }))}
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
                onChange={(e) => setFormData((prev) => ({ ...prev, deliveryCharges: e.target.value === '' ? '' : (parseFloat(e.target.value) || 0) }))}
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
                onChange={(e) => setFormData((prev) => ({ ...prev, godownCharges: e.target.value === '' ? '' : (parseFloat(e.target.value) || 0) }))}
                placeholder="0 (e.g. 5000 storage fee)"
                className="w-full p-2.5 bg-amber-50/50 border border-amber-300 rounded-md font-mono text-amber-900 font-bold"
              />
            </div>

            {/* GODOWN MONTHS & MONTHLY RATE CALCULATOR */}
            <div className="md:col-span-3 p-4 bg-amber-50/80 border border-amber-300 rounded-xl space-y-3">
              <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-2 border-b border-amber-200 pb-2">
                <label className="flex items-center gap-2.5 cursor-pointer text-xs font-bold text-amber-950">
                  <input
                    type="checkbox"
                    checked={!!formData.isGodownOnlyBilling}
                    onChange={(e) => setFormData((prev) => ({ ...prev, isGodownOnlyBilling: e.target.checked }))}
                    className="rounded text-amber-600 focus:ring-0 w-4 h-4"
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
              : [{ invoiceNumber: formData.invoiceDetails?.invoiceNumber || '', invoiceValue: formData.invoiceDetails?.invoiceValue || 0, ewayBillNumber: formData.ewayBillNumber || '' }]
            ).map((inv, idx) => (
              <div key={idx} className="flex flex-col sm:flex-row items-start sm:items-center gap-3 p-3 bg-slate-50 border border-slate-200 rounded-lg text-xs">
                <div className="w-6 h-6 rounded-full bg-slate-200 text-slate-700 font-bold flex items-center justify-center text-[10px] shrink-0">
                  #{idx + 1}
                </div>

                <div className="flex-1 grid grid-cols-1 sm:grid-cols-3 gap-3 w-full">
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
          <div className="flex items-center justify-between p-3 bg-blue-50/60 border border-blue-100 rounded-lg text-xs font-semibold text-slate-700">
            <span>Total Commercial Invoices: <strong>{(formData.commercialInvoices || []).length || 1}</strong></span>
            <span>Total Declared Cargo Value: <strong className="text-setu-700 font-mono text-sm">₹{((formData.commercialInvoices || []).reduce((sum, i) => sum + (parseFloat(i.invoiceValue) || 0), 0) || formData.invoiceDetails?.invoiceValue || 0).toLocaleString('en-IN')}</strong></span>
          </div>

          <div className="pt-2 border-t border-slate-100">
            <label className="block font-bold text-slate-800 uppercase tracking-wider mb-2">
              GST Tax Applicable For This Shipment Bill?
            </label>
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
                  onChange={() => setFormData((prev) => ({ ...prev, isGstExempt: false, gstRate: 18 }))}
                  className="text-setu-600 focus:ring-0"
                />
                <div>
                  <span className="font-bold text-slate-900 block text-xs">Charge Standard 18% IGST Tax</span>
                  <span className="text-[11px] text-slate-500 font-normal">Add 18% GST on Freight, Packing, Labor & Charges</span>
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
                  onChange={() => setFormData((prev) => ({ ...prev, isGstExempt: true, gstRate: 0 }))}
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

      {/* SUCCESS MODAL */}
      <Modal
        isOpen={!!createdCN}
        onClose={() => navigate(`/admin/shipments/${createdCN || createdId}`)}
        title="Shipment Created Successfully"
        footer={
          <>
            <button
              onClick={() => {
                setCreatedCN(null);
                setFormData(INITIAL_FORM_STATE);
              }}
              className="px-3.5 py-1.5 text-xs font-semibold text-slate-700 bg-white border border-slate-300 rounded"
            >
              Create Another Shipment
            </button>

            <button
              onClick={() => navigate(`/admin/shipments/${createdCN || createdId}`)}
              className="px-4 py-1.5 text-xs font-bold text-white bg-setu-600 hover:bg-setu-700 rounded shadow-sm"
            >
              View Shipment Details
            </button>
          </>
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
        </div>
      </Modal>
    </div>
  );
};
