import React, { useState, useEffect } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { companyService } from '../services/companyService';
import { validateCompanyForm } from '../utils/companyValidation';
import { PageHeader } from '../components/common/PageHeader';
import { LoadingState } from '../components/common/LoadingState';
import {
  Building2,
  User,
  CreditCard,
  Truck,
  Save,
  ArrowLeft,
  X,
  Plus,
  AlertCircle
} from 'lucide-react';

const INITIAL_FORM_STATE = {
  companyName: '',
  companyCode: 'Auto-generated on Save',
  gstin: '',
  pan: '',
  companyType: 'Manufacturer',
  status: 'Active',

  primaryContact: {
    name: '',
    designation: '',
    phone: '',
    alternatePhone: '',
    email: ''
  },

  billing: {
    address: '',
    addressLine2: '',
    city: '',
    state: '',
    pinCode: '',
    gstin: '',
    billingEmail: '',
    paymentTerms: '30 Days',
    customPaymentDays: 30
  },

  operations: {
    pickupLocations: [],
    destinations: [],
    preferredModes: ['FTL', 'Road']
  }
};

const MODE_OPTIONS = ['Air', 'Road', 'Train', 'Air Express', 'FTL', 'Other'];
const COMPANY_TYPES = ['Manufacturer', 'E-Commerce', 'Distributor', 'SMB', 'Enterprise', 'Other'];
const PAYMENT_TERMS_LIST = [
  'Per CN / Consignment Note (On Delivery)',
  'Per Trip (On Trip Completion)',
  'On-Demand Consolidated CN Selection',
  'Due on Receipt',
  '7 Days Credit',
  '15 Days Credit',
  '30 Days Credit',
  '45 Days Credit',
  '60 Days Credit',
  'Custom'
];
const INDIAN_STATES = [
  'Andhra Pradesh', 'Arunachal Pradesh', 'Assam', 'Bihar', 'Chhattisgarh', 'Delhi', 'Goa',
  'Gujarat', 'Haryana', 'Himachal Pradesh', 'Jharkhand', 'Karnataka', 'Kerala', 'Madhya Pradesh',
  'Maharashtra', 'Manipur', 'Meghalaya', 'Mizoram', 'Nagaland', 'Odisha', 'Punjab', 'Rajasthan',
  'Sikkim', 'Tamil Nadu', 'Telangana', 'Tripura', 'Uttar Pradesh', 'Uttarakhand', 'West Bengal'
];

export const CompanyFormPage = () => {
  const navigate = useNavigate();
  const { id } = useParams();
  const isEditMode = !!id;

  const [formData, setFormData] = useState(INITIAL_FORM_STATE);
  const [errors, setErrors] = useState({});
  const [loading, setLoading] = useState(isEditMode);
  const [saving, setSaving] = useState(false);

  // Tag Inputs
  const [pickupInput, setPickupInput] = useState('');
  const [destinationInput, setDestinationInput] = useState('');

  useEffect(() => {
    if (isEditMode) {
      setLoading(true);
      companyService.getCompany(id)
        .then((data) => {
          setFormData(data);
        })
        .catch((err) => {
          alert(err.message || 'Failed to load company for editing.');
          navigate('/admin/companies');
        })
        .finally(() => setLoading(false));
    }
  }, [id, isEditMode, navigate]);

  const handleInputChange = (field, value, section = null) => {
    if (section) {
      setFormData((prev) => ({
        ...prev,
        [section]: {
          ...prev[section],
          [field]: value
        }
      }));
    } else {
      setFormData((prev) => ({
        ...prev,
        [field]: value
      }));
    }

    // Clear error on field update
    if (errors[field] || errors[`${section}${field.charAt(0).toUpperCase()}${field.slice(1)}`]) {
      setErrors((prev) => {
        const copy = { ...prev };
        delete copy[field];
        delete copy[`${section}${field.charAt(0).toUpperCase()}${field.slice(1)}`];
        return copy;
      });
    }
  };

  const handleAddPickupLocation = () => {
    if (pickupInput.trim()) {
      setFormData((prev) => ({
        ...prev,
        operations: {
          ...prev.operations,
          pickupLocations: [...(prev.operations?.pickupLocations || []), pickupInput.trim()]
        }
      }));
      setPickupInput('');
    }
  };

  const handleRemovePickupLocation = (idx) => {
    setFormData((prev) => ({
      ...prev,
      operations: {
        ...prev.operations,
        pickupLocations: prev.operations.pickupLocations.filter((_, i) => i !== idx)
      }
    }));
  };

  const handleAddDestination = () => {
    if (destinationInput.trim()) {
      setFormData((prev) => ({
        ...prev,
        operations: {
          ...prev.operations,
          destinations: [...(prev.operations?.destinations || []), destinationInput.trim()]
        }
      }));
      setDestinationInput('');
    }
  };

  const handleRemoveDestination = (idx) => {
    setFormData((prev) => ({
      ...prev,
      operations: {
        ...prev.operations,
        destinations: prev.operations.destinations.filter((_, i) => i !== idx)
      }
    }));
  };

  const handleToggleMode = (mode) => {
    const currentModes = formData.operations?.preferredModes || [];
    const updated = currentModes.includes(mode)
      ? currentModes.filter((m) => m !== mode)
      : [...currentModes, mode];

    setFormData((prev) => ({
      ...prev,
      operations: {
        ...prev.operations,
        preferredModes: updated
      }
    }));
  };

  const handleSubmit = async (e, addAnother = false) => {
    if (e) e.preventDefault();

    const validationErrors = validateCompanyForm(formData);
    if (Object.keys(validationErrors).length > 0) {
      setErrors(validationErrors);
      window.scrollTo({ top: 0, behavior: 'smooth' });
      return;
    }

    setSaving(true);
    try {
      if (isEditMode) {
        await companyService.updateCompany(id, formData);
        navigate(`/admin/companies/${id}`);
      } else {
        const created = await companyService.createCompany(formData);
        if (addAnother) {
          setFormData(INITIAL_FORM_STATE);
          setErrors({});
          window.scrollTo({ top: 0, behavior: 'smooth' });
          alert(`Company '${created.companyName}' (${created.companyCode}) created successfully!`);
        } else {
          navigate('/admin/companies');
        }
      }
    } catch (err) {
      alert(err.message || 'Failed to save company.');
    } finally {
      setSaving(false);
    }
  };

  if (loading) {
    return <LoadingState message="Loading company form data..." />;
  }

  return (
    <div className="space-y-6 max-w-5xl mx-auto pb-12">
      {/* Header */}
      <PageHeader
        title={isEditMode ? `Edit Company — ${formData.companyName}` : 'Add New Corporate Company'}
        description="Register master billing information, primary contacts, and preferred shipping modes."
        breadcrumbs={['Speed Setu Admin', 'Commercial', 'Companies', isEditMode ? 'Edit' : 'New']}
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

      {/* Global Validation Alert */}
      {Object.keys(errors).length > 0 && (
        <div className="p-4 bg-rose-50 border border-rose-200 rounded-xl text-rose-800 text-xs font-medium space-y-1">
          <div className="flex items-center gap-2 font-bold text-rose-900 text-sm mb-1">
            <AlertCircle className="w-4 h-4 text-rose-600" />
            <span>Please correct the errors in the form before saving:</span>
          </div>
          <ul className="list-disc list-inside space-y-0.5 text-rose-700">
            {Object.values(errors).map((err, idx) => (
              <li key={idx}>{err}</li>
            ))}
          </ul>
        </div>
      )}

      <form onSubmit={(e) => handleSubmit(e, false)} className="space-y-6">
        {/* SECTION 1: BASIC INFORMATION */}
        <div className="bg-white border border-slate-200 rounded-xl p-6 shadow-xs space-y-4">
          <div className="flex items-center gap-2 border-b border-slate-100 pb-3">
            <div className="p-2 rounded-lg bg-blue-50 text-setu-600">
              <Building2 className="w-4 h-4" />
            </div>
            <div>
              <h3 className="text-sm font-bold text-slate-900">1. Basic Information</h3>
              <p className="text-xs text-slate-500">Legal entity name, GSTIN registration, and corporate status</p>
            </div>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-4 text-xs">
            <div className="md:col-span-2">
              <label className="block font-bold text-slate-700 uppercase tracking-wider mb-1">
                Company Legal Name <span className="text-rose-500">*</span>
              </label>
              <input
                type="text"
                value={formData.companyName}
                onChange={(e) => handleInputChange('companyName', e.target.value)}
                placeholder="e.g. Advik Autocomp Pvt Ltd"
                className={`w-full p-2.5 bg-slate-50 border rounded-md focus:outline-none focus:ring-2 focus:ring-setu-600/20 text-slate-900 font-semibold ${
                  errors.companyName ? 'border-rose-500 bg-rose-50/20' : 'border-slate-300'
                }`}
              />
              {errors.companyName && <span className="text-rose-600 text-[11px] mt-1 block">{errors.companyName}</span>}
            </div>

            <div>
              <label className="block font-bold text-slate-700 uppercase tracking-wider mb-1">
                Company Code
              </label>
              <input
                type="text"
                disabled
                value={formData.companyCode}
                className="w-full p-2.5 bg-slate-100 border border-slate-200 rounded-md text-slate-500 font-mono font-bold"
              />
              <span className="text-[10px] text-slate-400 mt-1 block">Auto-generated code for system reference</span>
            </div>

            <div>
              <label className="block font-bold text-slate-700 uppercase tracking-wider mb-1">
                GSTIN Number
              </label>
              <input
                type="text"
                value={formData.gstin}
                onChange={(e) => handleInputChange('gstin', e.target.value.toUpperCase())}
                placeholder="29AASCA8132C1ZJ"
                maxLength={15}
                className={`w-full p-2.5 bg-slate-50 border rounded-md font-mono focus:outline-none focus:ring-2 focus:ring-setu-600/20 uppercase ${
                  errors.gstin ? 'border-rose-500 bg-rose-50/20' : 'border-slate-300'
                }`}
              />
              {errors.gstin && <span className="text-rose-600 text-[11px] mt-1 block">{errors.gstin}</span>}
            </div>

            <div>
              <label className="block font-bold text-slate-700 uppercase tracking-wider mb-1">
                PAN Number
              </label>
              <input
                type="text"
                value={formData.pan}
                onChange={(e) => handleInputChange('pan', e.target.value.toUpperCase())}
                placeholder="AASCA8132C"
                maxLength={10}
                className={`w-full p-2.5 bg-slate-50 border rounded-md font-mono focus:outline-none focus:ring-2 focus:ring-setu-600/20 uppercase ${
                  errors.pan ? 'border-rose-500 bg-rose-50/20' : 'border-slate-300'
                }`}
              />
              {errors.pan && <span className="text-rose-600 text-[11px] mt-1 block">{errors.pan}</span>}
            </div>

            <div>
              <label className="block font-bold text-slate-700 uppercase tracking-wider mb-1">
                Company Category / Type
              </label>
              <select
                value={formData.companyType}
                onChange={(e) => handleInputChange('companyType', e.target.value)}
                className="w-full p-2.5 bg-slate-50 border border-slate-300 rounded-md focus:outline-none focus:ring-2 focus:ring-setu-600/20 font-semibold"
              >
                {COMPANY_TYPES.map((t) => (
                  <option key={t} value={t}>{t}</option>
                ))}
              </select>
            </div>

            <div>
              <label className="block font-bold text-slate-700 uppercase tracking-wider mb-1">
                Operational Status
              </label>
              <select
                value={formData.status}
                onChange={(e) => handleInputChange('status', e.target.value)}
                className="w-full p-2.5 bg-slate-50 border border-slate-300 rounded-md focus:outline-none focus:ring-2 focus:ring-setu-600/20 font-semibold"
              >
                <option value="Active">Active (Selectable for Bookings)</option>
                <option value="Inactive">Inactive (Disabled for Future Bookings)</option>
              </select>
            </div>
          </div>
        </div>

        {/* SECTION 2: PRIMARY CONTACT */}
        <div className="bg-white border border-slate-200 rounded-xl p-6 shadow-xs space-y-4">
          <div className="flex items-center gap-2 border-b border-slate-100 pb-3">
            <div className="p-2 rounded-lg bg-emerald-50 text-emerald-600">
              <User className="w-4 h-4" />
            </div>
            <div>
              <h3 className="text-sm font-bold text-slate-900">2. Primary Contact Person</h3>
              <p className="text-xs text-slate-500">Key point of contact for operational dispatches & billing</p>
            </div>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-4 text-xs">
            <div>
              <label className="block font-bold text-slate-700 uppercase tracking-wider mb-1">
                Contact Person Name
              </label>
              <input
                type="text"
                value={formData.primaryContact?.name || ''}
                onChange={(e) => handleInputChange('name', e.target.value, 'primaryContact')}
                placeholder="e.g. Sanjay Verma"
                className={`w-full p-2.5 bg-slate-50 border rounded-md focus:outline-none focus:ring-2 focus:ring-setu-600/20 font-medium ${
                  errors.primaryContactName ? 'border-rose-500 bg-rose-50/20' : 'border-slate-300'
                }`}
              />
              {errors.primaryContactName && <span className="text-rose-600 text-[11px] mt-1 block">{errors.primaryContactName}</span>}
            </div>

            <div>
              <label className="block font-bold text-slate-700 uppercase tracking-wider mb-1">
                Designation / Role
              </label>
              <input
                type="text"
                value={formData.primaryContact?.designation || ''}
                onChange={(e) => handleInputChange('designation', e.target.value, 'primaryContact')}
                placeholder="e.g. GM Logistics & Supply Chain"
                className="w-full p-2.5 bg-slate-50 border border-slate-300 rounded-md focus:outline-none focus:ring-2 focus:ring-setu-600/20"
              />
            </div>

            <div>
              <label className="block font-bold text-slate-700 uppercase tracking-wider mb-1">
                Primary Phone Number
              </label>
              <input
                type="text"
                value={formData.primaryContact?.phone || ''}
                onChange={(e) => handleInputChange('phone', e.target.value, 'primaryContact')}
                placeholder="+91 98450 11223"
                className={`w-full p-2.5 bg-slate-50 border rounded-md font-mono focus:outline-none focus:ring-2 focus:ring-setu-600/20 ${
                  errors.primaryContactPhone ? 'border-rose-500 bg-rose-50/20' : 'border-slate-300'
                }`}
              />
              {errors.primaryContactPhone && <span className="text-rose-600 text-[11px] mt-1 block">{errors.primaryContactPhone}</span>}
            </div>

            <div>
              <label className="block font-bold text-slate-700 uppercase tracking-wider mb-1">
                Alternate Phone Number
              </label>
              <input
                type="text"
                value={formData.primaryContact?.alternatePhone || ''}
                onChange={(e) => handleInputChange('alternatePhone', e.target.value, 'primaryContact')}
                placeholder="+91 98450 11224"
                className="w-full p-2.5 bg-slate-50 border border-slate-300 rounded-md font-mono focus:outline-none focus:ring-2 focus:ring-setu-600/20"
              />
            </div>

            <div className="md:col-span-2">
              <label className="block font-bold text-slate-700 uppercase tracking-wider mb-1">
                Email Address
              </label>
              <input
                type="email"
                value={formData.primaryContact?.email || ''}
                onChange={(e) => handleInputChange('email', e.target.value, 'primaryContact')}
                placeholder="sanjay.verma@advikauto.com"
                className={`w-full p-2.5 bg-slate-50 border rounded-md font-mono focus:outline-none focus:ring-2 focus:ring-setu-600/20 ${
                  errors.primaryContactEmail ? 'border-rose-500 bg-rose-50/20' : 'border-slate-300'
                }`}
              />
              {errors.primaryContactEmail && <span className="text-rose-600 text-[11px] mt-1 block">{errors.primaryContactEmail}</span>}
            </div>
          </div>
        </div>

        {/* SECTION 3: BILLING INFORMATION */}
        <div className="bg-white border border-slate-200 rounded-xl p-6 shadow-xs space-y-4">
          <div className="flex items-center gap-2 border-b border-slate-100 pb-3">
            <div className="p-2 rounded-lg bg-amber-50 text-amber-600">
              <CreditCard className="w-4 h-4" />
            </div>
            <div>
              <h3 className="text-sm font-bold text-slate-900">3. Billing & Payment Terms</h3>
              <p className="text-xs text-slate-500">Registered address for invoicing, tax filing, and credit days</p>
            </div>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-4 text-xs">
            <div className="md:col-span-2">
              <label className="block font-bold text-slate-700 uppercase tracking-wider mb-1">
                Billing Address Line 1
              </label>
              <input
                type="text"
                value={formData.billing?.address || ''}
                onChange={(e) => handleInputChange('address', e.target.value, 'billing')}
                placeholder="Plot 12, KIADB Industrial Area, Phase 2"
                className={`w-full p-2.5 bg-slate-50 border rounded-md focus:outline-none focus:ring-2 focus:ring-setu-600/20 ${
                  errors.billingAddress ? 'border-rose-500 bg-rose-50/20' : 'border-slate-300'
                }`}
              />
              {errors.billingAddress && <span className="text-rose-600 text-[11px] mt-1 block">{errors.billingAddress}</span>}
            </div>

            <div>
              <label className="block font-bold text-slate-700 uppercase tracking-wider mb-1">
                Address Line 2
              </label>
              <input
                type="text"
                value={formData.billing?.addressLine2 || ''}
                onChange={(e) => handleInputChange('addressLine2', e.target.value, 'billing')}
                placeholder="Near Toyota Kirloskar Plant"
                className="w-full p-2.5 bg-slate-50 border border-slate-300 rounded-md focus:outline-none focus:ring-2 focus:ring-setu-600/20"
              />
            </div>

            <div>
              <label className="block font-bold text-slate-700 uppercase tracking-wider mb-1">
                City
              </label>
              <input
                type="text"
                value={formData.billing?.city || ''}
                onChange={(e) => handleInputChange('city', e.target.value, 'billing')}
                placeholder="Bengaluru"
                className={`w-full p-2.5 bg-slate-50 border rounded-md focus:outline-none focus:ring-2 focus:ring-setu-600/20 ${
                  errors.billingCity ? 'border-rose-500 bg-rose-50/20' : 'border-slate-300'
                }`}
              />
              {errors.billingCity && <span className="text-rose-600 text-[11px] mt-1 block">{errors.billingCity}</span>}
            </div>

            <div>
              <label className="block font-bold text-slate-700 uppercase tracking-wider mb-1">
                State
              </label>
              <select
                value={formData.billing?.state || ''}
                onChange={(e) => handleInputChange('state', e.target.value, 'billing')}
                className={`w-full p-2.5 bg-slate-50 border rounded-md focus:outline-none focus:ring-2 focus:ring-setu-600/20 font-medium ${
                  errors.billingState ? 'border-rose-500 bg-rose-50/20' : 'border-slate-300'
                }`}
              >
                <option value="">Select State...</option>
                {INDIAN_STATES.map((st) => (
                  <option key={st} value={st}>{st}</option>
                ))}
              </select>
              {errors.billingState && <span className="text-rose-600 text-[11px] mt-1 block">{errors.billingState}</span>}
            </div>

            <div>
              <label className="block font-bold text-slate-700 uppercase tracking-wider mb-1">
                PIN Code
              </label>
              <input
                type="text"
                value={formData.billing?.pinCode || ''}
                onChange={(e) => handleInputChange('pinCode', e.target.value, 'billing')}
                placeholder="560099"
                maxLength={6}
                className={`w-full p-2.5 bg-slate-50 border rounded-md font-mono focus:outline-none focus:ring-2 focus:ring-setu-600/20 ${
                  errors.billingPinCode ? 'border-rose-500 bg-rose-50/20' : 'border-slate-300'
                }`}
              />
              {errors.billingPinCode && <span className="text-rose-600 text-[11px] mt-1 block">{errors.billingPinCode}</span>}
            </div>

            <div>
              <label className="block font-bold text-slate-700 uppercase tracking-wider mb-1">
                Accounts Billing Email
              </label>
              <input
                type="email"
                value={formData.billing?.billingEmail || ''}
                onChange={(e) => handleInputChange('billingEmail', e.target.value, 'billing')}
                placeholder="accounts@advikauto.com"
                className={`w-full p-2.5 bg-slate-50 border rounded-md font-mono focus:outline-none focus:ring-2 focus:ring-setu-600/20 ${
                  errors.billingEmail ? 'border-rose-500 bg-rose-50/20' : 'border-slate-300'
                }`}
              />
              {errors.billingEmail && <span className="text-rose-600 text-[11px] mt-1 block">{errors.billingEmail}</span>}
            </div>

            <div>
              <label className="block font-bold text-slate-700 uppercase tracking-wider mb-1">
                Payment Terms
              </label>
              <select
                value={formData.billing?.paymentTerms || '30 Days'}
                onChange={(e) => handleInputChange('paymentTerms', e.target.value, 'billing')}
                className="w-full p-2.5 bg-slate-50 border border-slate-300 rounded-md focus:outline-none focus:ring-2 focus:ring-setu-600/20 font-bold"
              >
                {PAYMENT_TERMS_LIST.map((pt) => (
                  <option key={pt} value={pt}>{pt}</option>
                ))}
              </select>
            </div>

            {formData.billing?.paymentTerms === 'Custom' && (
              <div>
                <label className="block font-bold text-slate-700 uppercase tracking-wider mb-1">
                  Custom Credit Days
                </label>
                <input
                  type="number"
                  min={1}
                  max={365}
                  value={formData.billing?.customPaymentDays || 30}
                  onChange={(e) => handleInputChange('customPaymentDays', parseInt(e.target.value, 10), 'billing')}
                  className="w-full p-2.5 bg-slate-50 border border-slate-300 rounded-md font-mono font-bold focus:outline-none focus:ring-2 focus:ring-setu-600/20"
                />
              </div>
            )}
          </div>
        </div>

        {/* SECTION 4: OPERATIONAL INFORMATION */}
        <div className="bg-white border border-slate-200 rounded-xl p-6 shadow-xs space-y-4">
          <div className="flex items-center gap-2 border-b border-slate-100 pb-3">
            <div className="p-2 rounded-lg bg-purple-50 text-purple-600">
              <Truck className="w-4 h-4" />
            </div>
            <div>
              <h3 className="text-sm font-bold text-slate-900">4. Operational Preferences</h3>
              <p className="text-xs text-slate-500">Regular pickup locations, destinations, and preferred freight modes</p>
            </div>
          </div>

          <div className="space-y-4 text-xs">
            {/* Preferred Modes */}
            <div>
              <label className="block font-bold text-slate-700 uppercase tracking-wider mb-2">
                Preferred Freight Modes
              </label>
              <div className="flex items-center gap-2 flex-wrap">
                {MODE_OPTIONS.map((mode) => {
                  const isSelected = (formData.operations?.preferredModes || []).includes(mode);
                  return (
                    <button
                      key={mode}
                      type="button"
                      onClick={() => handleToggleMode(mode)}
                      className={`px-3 py-1.5 rounded-full text-xs font-semibold border transition-all ${
                        isSelected
                          ? 'bg-setu-600 text-white border-setu-600 shadow-xs'
                          : 'bg-slate-50 text-slate-700 border-slate-300 hover:bg-slate-100'
                      }`}
                    >
                      {isSelected ? '✓ ' : '+ '}
                      {mode}
                    </button>
                  );
                })}
              </div>
            </div>

            {/* Regular Pickups */}
            <div>
              <label className="block font-bold text-slate-700 uppercase tracking-wider mb-1">
                Regular Pickup Locations
              </label>
              <div className="flex items-center gap-2 mb-2">
                <input
                  type="text"
                  value={pickupInput}
                  onChange={(e) => setPickupInput(e.target.value)}
                  onKeyDown={(e) => e.key === 'Enter' && (e.preventDefault(), handleAddPickupLocation())}
                  placeholder="e.g. Bengaluru Hub, Hosur Factory"
                  className="flex-1 p-2 bg-slate-50 border border-slate-300 rounded-md focus:outline-none focus:ring-2 focus:ring-setu-600/20"
                />
                <button
                  type="button"
                  onClick={handleAddPickupLocation}
                  className="px-3 py-2 bg-slate-800 text-white rounded-md font-semibold hover:bg-slate-900"
                >
                  Add Location
                </button>
              </div>

              <div className="flex items-center gap-2 flex-wrap">
                {(formData.operations?.pickupLocations || []).map((loc, idx) => (
                  <span
                    key={idx}
                    className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-md text-xs font-medium bg-blue-50 text-setu-700 border border-blue-200"
                  >
                    <span>{loc}</span>
                    <button
                      type="button"
                      onClick={() => handleRemovePickupLocation(idx)}
                      className="text-setu-400 hover:text-setu-900"
                    >
                      <X className="w-3.5 h-3.5" />
                    </button>
                  </span>
                ))}
              </div>
            </div>

            {/* Regular Destinations */}
            <div>
              <label className="block font-bold text-slate-700 uppercase tracking-wider mb-1">
                Regular Destinations / Delivery Lanes
              </label>
              <div className="flex items-center gap-2 mb-2">
                <input
                  type="text"
                  value={destinationInput}
                  onChange={(e) => setDestinationInput(e.target.value)}
                  onKeyDown={(e) => e.key === 'Enter' && (e.preventDefault(), handleAddDestination())}
                  placeholder="e.g. Pune Hub, Gurugram Plant"
                  className="flex-1 p-2 bg-slate-50 border border-slate-300 rounded-md focus:outline-none focus:ring-2 focus:ring-setu-600/20"
                />
                <button
                  type="button"
                  onClick={handleAddDestination}
                  className="px-3 py-2 bg-slate-800 text-white rounded-md font-semibold hover:bg-slate-900"
                >
                  Add Destination
                </button>
              </div>

              <div className="flex items-center gap-2 flex-wrap">
                {(formData.operations?.destinations || []).map((dest, idx) => (
                  <span
                    key={idx}
                    className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-md text-xs font-medium bg-purple-50 text-purple-700 border border-purple-200"
                  >
                    <span>{dest}</span>
                    <button
                      type="button"
                      onClick={() => handleRemoveDestination(idx)}
                      className="text-purple-400 hover:text-purple-900"
                    >
                      <X className="w-3.5 h-3.5" />
                    </button>
                  </span>
                ))}
              </div>
            </div>
          </div>
        </div>

        {/* BOTTOM FORM ACTIONS */}
        <div className="flex items-center justify-end gap-3 pt-4 border-t border-slate-200">
          <button
            type="button"
            onClick={() => navigate(-1)}
            className="px-4 py-2 text-xs font-semibold text-slate-700 bg-white border border-slate-300 rounded-md hover:bg-slate-50 transition-colors"
          >
            Cancel
          </button>

          {!isEditMode && (
            <button
              type="button"
              disabled={saving}
              onClick={(e) => handleSubmit(e, true)}
              className="px-4 py-2 text-xs font-bold text-setu-700 bg-setu-50 border border-setu-200 rounded-md hover:bg-setu-100 transition-colors"
            >
              Save & Add Another
            </button>
          )}

          <button
            type="submit"
            disabled={saving}
            className="inline-flex items-center gap-2 px-5 py-2 text-xs font-bold text-white bg-setu-600 hover:bg-setu-700 rounded-md shadow-sm transition-colors disabled:opacity-50"
          >
            <Save className="w-4 h-4" />
            <span>{saving ? 'Saving...' : isEditMode ? 'Save Changes' : 'Save Company'}</span>
          </button>
        </div>
      </form>
    </div>
  );
};
