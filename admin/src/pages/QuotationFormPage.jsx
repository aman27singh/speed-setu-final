import React, { useState, useEffect } from 'react';
import { useNavigate, useParams, useLocation } from 'react-router-dom';
import { quotationService } from '../services/quotationService';
import { companyService } from '../services/companyService';
import { validateQuotationForm } from '../utils/quotationValidation';
import { PageHeader } from '../components/common/PageHeader';
import { LoadingState } from '../components/common/LoadingState';
import {
  FileSpreadsheet,
  Building2,
  Plus,
  Trash2,
  Save,
  ArrowLeft,
  ChevronDown,
  ChevronUp,
  AlertCircle,
  Percent,
  Layers,
  GitBranch,
  X
} from 'lucide-react';

const MODE_OPTIONS = ['Air', 'Air Express', 'Road', 'Train', 'FTL', 'Other'];
const RATE_BASIS_OPTIONS = ['Per KG', 'Per Shipment', 'Per Box', 'Per KM', 'Flat Rate'];
const CHARGE_BASIS_OPTIONS = ['Fixed per shipment', 'Per KG', 'Per Box', 'Percentage', 'Other'];

const INITIAL_RATE_RULE = {
  origin: 'Pune Hub',
  destination: 'Bengaluru Hub (KA-BLR-01)',
  mode: 'Air',
  rateBasis: 'Per KG',
  freightRate: 74,
  minimumChargeableWeight: 50,

  additionalCharges: [
    { name: 'Docket Charge', amount: 150, basis: 'Fixed per shipment', taxable: true },
    { name: 'Pickup Charge', amount: 2000, basis: 'Fixed per shipment', taxable: true },
    { name: 'Delivery Charge', amount: 2000, basis: 'Fixed per shipment', taxable: true }
  ],

  taxConfiguration: {
    applicable: true,
    gstRate: 18,
    cgst: 9,
    sgst: 9,
    igst: 18,
    notes: 'GST 18% freight tax applicable under RCM'
  }
};

const INITIAL_FORM_STATE = {
  quotationNumber: 'Auto-generated on Save',
  version: 1,
  companyId: '',
  companyName: '',
  companyCode: '',
  quotationDate: new Date().toISOString().split('T')[0],
  effectiveFrom: new Date().toISOString().split('T')[0],
  effectiveUntil: '',
  status: 'Active',
  notes: 'Commercial freight pricing agreement.',
  rateRules: [{ ...INITIAL_RATE_RULE }]
};

export const QuotationFormPage = () => {
  const navigate = useNavigate();
  const { id } = useParams();
  const location = useLocation();

  const isNewVersionMode = location.pathname.includes('/new-version');
  const isEditMode = !!id && !isNewVersionMode;

  const [formData, setFormData] = useState(INITIAL_FORM_STATE);
  const [companies, setCompanies] = useState([]);
  const [errors, setErrors] = useState({});
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  // Active accordion index for rate rules
  const [expandedRuleIndex, setExpandedRuleIndex] = useState(0);

  useEffect(() => {
    const loadInitialData = async () => {
      setLoading(true);
      try {
        const compList = await companyService.getCompanies();
        setCompanies(compList);

        const searchParams = new URLSearchParams(location.search);
        const queryCompanyId = searchParams.get('companyId');

        if (id) {
          const existing = await quotationService.getQuotation(id);
          if (isNewVersionMode) {
            // New Version Mode: copy data and bump version
            setFormData({
              ...existing,
              version: existing.version + 1,
              effectiveFrom: new Date().toISOString().split('T')[0],
              effectiveUntil: '',
              status: 'Active',
              notes: `Version ${existing.version + 1} updated rate agreement.`
            });
          } else {
            // Edit Mode
            setFormData(existing);
          }
        } else {
          // New Quotation Mode
          const selectedCompany = compList.find((c) => c.id === queryCompanyId) || compList[0];
          if (selectedCompany) {
            setFormData((prev) => ({
              ...prev,
              companyId: selectedCompany.id,
              companyName: selectedCompany.companyName,
              companyCode: selectedCompany.companyCode
            }));
          }
        }
      } catch (err) {
        alert(err.message || 'Failed to load form data.');
        navigate('/admin/quotations');
      } finally {
        setLoading(false);
      }
    };

    loadInitialData();
  }, [id, isNewVersionMode, location.search, navigate]);

  const handleSelectCompany = (compObj) => {
    setFormData((prev) => ({
      ...prev,
      companyId: compObj.id,
      companyName: compObj.companyName,
      companyCode: compObj.companyCode
    }));
  };

  const handleAddRateRule = () => {
    setFormData((prev) => ({
      ...prev,
      rateRules: [...prev.rateRules, { ...INITIAL_RATE_RULE, origin: '', destination: '' }]
    }));
    setExpandedRuleIndex(formData.rateRules.length);
  };

  const handleRemoveRateRule = (index) => {
    if (formData.rateRules.length === 1) {
      alert('A quotation must contain at least one Rate Rule.');
      return;
    }
    setFormData((prev) => ({
      ...prev,
      rateRules: prev.rateRules.filter((_, i) => i !== index)
    }));
    setExpandedRuleIndex(Math.max(0, index - 1));
  };

  const handleRateRuleChange = (ruleIdx, field, value) => {
    setFormData((prev) => {
      const updatedRules = [...prev.rateRules];
      updatedRules[ruleIdx] = {
        ...updatedRules[ruleIdx],
        [field]: value
      };
      return { ...prev, rateRules: updatedRules };
    });
  };

  // Additional Charges Handlers
  const handleAddAdditionalCharge = (ruleIdx) => {
    setFormData((prev) => {
      const updatedRules = [...prev.rateRules];
      const charges = updatedRules[ruleIdx].additionalCharges || [];
      updatedRules[ruleIdx].additionalCharges = [
        ...charges,
        { name: 'Custom Charge', amount: 200, basis: 'Fixed per shipment', taxable: true }
      ];
      return { ...prev, rateRules: updatedRules };
    });
  };

  const handleRemoveAdditionalCharge = (ruleIdx, chargeIdx) => {
    setFormData((prev) => {
      const updatedRules = [...prev.rateRules];
      updatedRules[ruleIdx].additionalCharges = updatedRules[ruleIdx].additionalCharges.filter((_, i) => i !== chargeIdx);
      return { ...prev, rateRules: updatedRules };
    });
  };

  const handleChargeChange = (ruleIdx, chargeIdx, field, value) => {
    setFormData((prev) => {
      const updatedRules = [...prev.rateRules];
      const charges = [...updatedRules[ruleIdx].additionalCharges];
      charges[chargeIdx] = { ...charges[chargeIdx], [field]: value };
      updatedRules[ruleIdx].additionalCharges = charges;
      return { ...prev, rateRules: updatedRules };
    });
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    const validationErrors = validateQuotationForm(formData);
    if (Object.keys(validationErrors).length > 0) {
      setErrors(validationErrors);
      window.scrollTo({ top: 0, behavior: 'smooth' });
      return;
    }

    setSaving(true);
    try {
      if (isNewVersionMode) {
        const createdVersion = await quotationService.createQuotationVersion(id, formData);
        const targetId = createdVersion._id || createdVersion.id || createdVersion.quotationNumber;
        navigate(`/admin/quotations/${targetId}`);
      } else if (isEditMode) {
        const updated = await quotationService.updateQuotation(id, formData);
        const targetId = updated._id || updated.id || id;
        navigate(`/admin/quotations/${targetId}`);
      } else {
        const created = await quotationService.createQuotation(formData);
        const targetId = created._id || created.id || created.quotationNumber;
        navigate(`/admin/quotations/${targetId}`);
      }
    } catch (err) {
      alert(err.message || 'Failed to save quotation.');
    } finally {
      setSaving(false);
    }
  };

  if (loading) {
    return <LoadingState message="Loading Rate Card Builder..." />;
  }

  return (
    <div className="space-y-6 max-w-5xl mx-auto pb-12">
      <PageHeader
        title={
          isNewVersionMode
            ? `Create New Version — ${formData.quotationNumber} (v${formData.version})`
            : isEditMode
            ? `Edit Quotation — ${formData.quotationNumber} (v${formData.version})`
            : 'Build New Rate Card & Quotation'
        }
        description="Configure lane freight rates, weight slabs, additional charges, and tax configuration."
        breadcrumbs={['Speed Setu Admin', 'Commercial', 'Quotations', isNewVersionMode ? 'New Version' : isEditMode ? 'Edit' : 'New']}
        actions={
          <button
            type="button"
            onClick={() => navigate(-1)}
            className="w-full sm:w-auto inline-flex items-center justify-center gap-1.5 px-3 py-1.5 text-xs font-semibold text-slate-700 bg-white border border-slate-300 rounded-md hover:bg-slate-50 transition-colors"
          >
            <ArrowLeft className="w-4 h-4" />
            <span>Cancel</span>
          </button>
        }
      />

      {/* Global Errors Banner */}
      {Object.keys(errors).length > 0 && (
        <div className="p-4 bg-rose-50 border border-rose-200 rounded-xl text-rose-800 text-xs font-medium space-y-1">
          <div className="flex items-center gap-2 font-bold text-rose-900 text-sm mb-1">
            <AlertCircle className="w-4 h-4 text-rose-600" />
            <span>Please resolve form errors before saving rate card:</span>
          </div>
          <ul className="list-disc list-inside space-y-0.5 text-rose-700">
            {Object.values(errors).map((err, idx) => (
              <li key={idx}>{err}</li>
            ))}
          </ul>
        </div>
      )}

      <form onSubmit={handleSubmit} className="space-y-6">
        {/* SECTION A: BASIC INFORMATION */}
        <div className="bg-white border border-slate-200 rounded-xl p-4 sm:p-6 shadow-xs space-y-4">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 border-b border-slate-100 pb-3">
            <div className="flex items-center gap-2">
              <div className="p-2 rounded-lg bg-blue-50 text-setu-600 shrink-0">
                <Building2 className="w-4 h-4" />
              </div>
              <div>
                <h3 className="text-sm font-bold text-slate-900">Section A — Basic Contract Details</h3>
                <p className="text-xs text-slate-500">Corporate client reference, versioning, and effective dates</p>
              </div>
            </div>

            <div className="self-start sm:self-auto flex items-center gap-2">
              <span className="px-2.5 py-1 rounded bg-setu-50 font-mono text-setu-700 font-bold text-xs border border-setu-100">
                Version {formData.version}
              </span>
            </div>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-3 sm:gap-4 text-xs">
            <div>
              <label className="block font-bold text-slate-700 uppercase tracking-wider mb-1">
                Corporate Client <span className="text-rose-500">*</span>
              </label>
              <select
                value={formData.companyId}
                disabled={isEditMode || isNewVersionMode}
                onChange={(e) => {
                  const comp = companies.find((c) => c.id === e.target.value);
                  if (comp) handleSelectCompany(comp);
                }}
                className="w-full p-2.5 bg-slate-50 border border-slate-300 rounded-md focus:outline-none focus:ring-2 focus:ring-setu-600/20 font-bold text-slate-900"
              >
                {companies.map((comp) => (
                  <option key={comp.id} value={comp.id}>
                    {comp.companyName} ({comp.companyCode})
                  </option>
                ))}
              </select>
            </div>

            <div>
              <label className="block font-bold text-slate-700 uppercase tracking-wider mb-1">
                Quotation Number
              </label>
              <input
                type="text"
                disabled
                value={formData.quotationNumber}
                className="w-full p-2.5 bg-slate-100 border border-slate-200 rounded-md font-mono text-slate-600 font-bold"
              />
            </div>

            <div>
              <label className="block font-bold text-slate-700 uppercase tracking-wider mb-1">
                Contract Status
              </label>
              <select
                value={formData.status}
                onChange={(e) => setFormData((prev) => ({ ...prev, status: e.target.value }))}
                className="w-full p-2.5 bg-slate-50 border border-slate-300 rounded-md focus:outline-none focus:ring-2 focus:ring-setu-600/20 font-bold"
              >
                <option value="Draft">Draft (Pending Approval)</option>
                <option value="Active">Active (Applicable for Billing)</option>
                <option value="Expired">Expired (Historical Only)</option>
                <option value="Cancelled">Cancelled</option>
              </select>
            </div>

            <div>
              <label className="block font-bold text-slate-700 uppercase tracking-wider mb-1">
                Effective From <span className="text-rose-500">*</span>
              </label>
              <input
                type="date"
                value={formData.effectiveFrom}
                onChange={(e) => setFormData((prev) => ({ ...prev, effectiveFrom: e.target.value }))}
                className="w-full p-2.5 bg-slate-50 border border-slate-300 rounded-md font-mono font-bold text-slate-900"
              />
            </div>

            <div>
              <label className="block font-bold text-slate-700 uppercase tracking-wider mb-1">
                Effective Until
              </label>
              <input
                type="date"
                value={formData.effectiveUntil || ''}
                onChange={(e) => setFormData((prev) => ({ ...prev, effectiveUntil: e.target.value }))}
                className="w-full p-2.5 bg-slate-50 border border-slate-300 rounded-md font-mono text-slate-900"
              />
            </div>

            <div>
              <label className="block font-bold text-slate-700 uppercase tracking-wider mb-1">
                Quotation Date
              </label>
              <input
                type="date"
                value={formData.quotationDate}
                onChange={(e) => setFormData((prev) => ({ ...prev, quotationDate: e.target.value }))}
                className="w-full p-2.5 bg-slate-50 border border-slate-300 rounded-md font-mono text-slate-900"
              />
            </div>
          </div>
        </div>

        {/* SECTION B: RATE RULES (EXPANDABLE ROUTE CARDS) */}
        <div className="space-y-4">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
            <div>
              <h3 className="text-sm font-bold text-slate-900">Section B — Lane Rate Rules ({formData.rateRules.length})</h3>
              <p className="text-xs text-slate-500">Configure origin, destination, mode, base rates, weight slabs and charges</p>
            </div>

            <button
              type="button"
              onClick={handleAddRateRule}
              className="self-start sm:self-auto inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-bold text-setu-700 bg-setu-50 border border-setu-200 rounded-md hover:bg-setu-100 transition-colors shrink-0"
            >
              <Plus className="w-4 h-4" />
              <span>Add Rate Rule</span>
            </button>
          </div>

          {formData.rateRules.map((rule, ruleIdx) => {
            const isExpanded = expandedRuleIndex === ruleIdx;
            return (
              <div
                key={ruleIdx}
                className="bg-white border border-slate-200 rounded-xl overflow-hidden shadow-xs transition-all"
              >
                {/* Route Card Header */}
                <div
                  onClick={() => setExpandedRuleIndex(isExpanded ? -1 : ruleIdx)}
                  className="p-3.5 sm:p-4 bg-slate-50 border-b border-slate-200 flex flex-col sm:flex-row sm:items-center justify-between gap-2 cursor-pointer hover:bg-slate-100/80 transition-colors"
                >
                  <div className="flex items-center gap-3">
                    <span className="w-6 h-6 rounded-full bg-slate-800 text-white font-bold text-xs flex items-center justify-center shrink-0">
                      {ruleIdx + 1}
                    </span>
                    <div>
                      <span className="font-bold text-slate-900 text-sm">
                        {rule.origin || 'Origin City'} → {rule.destination || 'Destination City'}
                      </span>
                      <div className="flex items-center gap-2 mt-0.5 flex-wrap">
                        <span className="px-2 py-0.2 rounded text-[10px] font-semibold bg-setu-600 text-white">
                          {rule.mode}
                        </span>
                        <span className="text-xs font-bold text-slate-700">
                          ₹{rule.freightRate} / {rule.rateBasis}
                        </span>
                        {rule.weightSlabs?.length > 0 && (
                          <span className="text-[10px] text-slate-500">({rule.weightSlabs.length} Slabs)</span>
                        )}
                      </div>
                    </div>
                  </div>

                  <div className="flex items-center gap-2 self-end sm:self-auto">
                    <button
                      type="button"
                      onClick={(e) => {
                        e.stopPropagation();
                        handleRemoveRateRule(ruleIdx);
                      }}
                      className="p-1 text-slate-400 hover:text-rose-600 rounded"
                      title="Remove Route"
                    >
                      <Trash2 className="w-4 h-4" />
                    </button>
                    {isExpanded ? <ChevronUp className="w-5 h-5 text-slate-400" /> : <ChevronDown className="w-5 h-5 text-slate-400" />}
                  </div>
                </div>

                {/* Expanded Card Body */}
                {isExpanded && (
                  <div className="p-4 sm:p-5 space-y-6">
                    {/* Basic Route Specs */}
                    <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-3.5 text-xs items-end">
                      {/* Origin City / Hub */}
                      <div>
                        <label className="block text-[11px] font-bold text-slate-700 uppercase tracking-wider mb-1.5 whitespace-nowrap">
                          Origin City / Hub <span className="text-rose-500">*</span>
                        </label>
                        <input
                          type="text"
                          value={rule.origin}
                          onChange={(e) => handleRateRuleChange(ruleIdx, 'origin', e.target.value)}
                          placeholder="e.g. Pune Hub"
                          className="w-full h-10 px-3 bg-slate-50 border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-setu-600/20 font-semibold text-slate-900 text-xs"
                        />
                      </div>

                      {/* Destination City / Hub */}
                      <div>
                        <label className="block text-[11px] font-bold text-slate-700 uppercase tracking-wider mb-1.5 whitespace-nowrap">
                          Destination City / Hub <span className="text-rose-500">*</span>
                        </label>
                        <input
                          type="text"
                          value={rule.destination}
                          onChange={(e) => handleRateRuleChange(ruleIdx, 'destination', e.target.value)}
                          placeholder="e.g. Bengaluru Hub"
                          className="w-full h-10 px-3 bg-slate-50 border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-setu-600/20 font-semibold text-slate-900 text-xs"
                        />
                      </div>

                      {/* Freight Mode */}
                      <div>
                        <label className="block text-[11px] font-bold text-slate-700 uppercase tracking-wider mb-1.5 whitespace-nowrap">
                          Freight Mode
                        </label>
                        <select
                          value={rule.mode}
                          onChange={(e) => handleRateRuleChange(ruleIdx, 'mode', e.target.value)}
                          className="w-full h-10 px-3 bg-slate-50 border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-setu-600/20 font-bold text-slate-900 text-xs cursor-pointer"
                        >
                          {MODE_OPTIONS.map((m) => (
                            <option key={m} value={m}>{m}</option>
                          ))}
                        </select>
                      </div>

                      {/* Rate Basis */}
                      <div>
                        <label className="block text-[11px] font-bold text-slate-700 uppercase tracking-wider mb-1.5 whitespace-nowrap">
                          Rate Basis
                        </label>
                        <select
                          value={rule.rateBasis}
                          onChange={(e) => handleRateRuleChange(ruleIdx, 'rateBasis', e.target.value)}
                          className="w-full h-10 px-3 bg-slate-50 border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-setu-600/20 font-bold text-slate-900 text-xs cursor-pointer"
                        >
                          {RATE_BASIS_OPTIONS.map((rb) => (
                            <option key={rb} value={rb}>{rb}</option>
                          ))}
                        </select>
                      </div>

                      {/* Base Freight Rate (₹) */}
                      <div>
                        <label className="block text-[11px] font-bold text-slate-700 uppercase tracking-wider mb-1.5 whitespace-nowrap">
                          Base Freight Rate (₹) <span className="text-rose-500">*</span>
                        </label>
                        <input
                          type="number"
                          step="0.01"
                          value={rule.freightRate}
                          onChange={(e) => handleRateRuleChange(ruleIdx, 'freightRate', parseFloat(e.target.value) || 0)}
                          className="w-full h-10 px-3 bg-slate-50 border border-slate-300 rounded-lg font-bold font-mono focus:outline-none focus:ring-2 focus:ring-setu-600/20 text-setu-700 text-xs"
                        />
                      </div>
                    </div>

                    {/* Additional Charges Sub-Section */}
                    <div className="p-4 bg-slate-50 rounded-lg border border-slate-200 space-y-3">
                      <div className="flex items-center justify-between">
                        <div>
                          <h4 className="text-xs font-bold text-slate-900">Additional Configurable Charges</h4>
                          <p className="text-[11px] text-slate-500">Docket, pickup, delivery, handling, and unloading fees</p>
                        </div>
                        <button
                          type="button"
                          onClick={() => handleAddAdditionalCharge(ruleIdx)}
                          className="px-2.5 py-1 text-xs font-semibold text-slate-700 bg-white border border-slate-300 rounded hover:bg-slate-100"
                        >
                          + Add Charge
                        </button>
                      </div>

                      {(rule.additionalCharges || []).map((ch, cIdx) => (
                        <div key={cIdx} className="flex items-center gap-3 text-xs bg-white p-2.5 rounded border border-slate-200">
                          <div className="flex-1 grid grid-cols-4 gap-2">
                            <div>
                              <span className="text-[10px] text-slate-400 block font-bold">Charge Name</span>
                              <input
                                type="text"
                                value={ch.name}
                                onChange={(e) => handleChargeChange(ruleIdx, cIdx, 'name', e.target.value)}
                                className="w-full p-1 bg-slate-50 border border-slate-300 rounded font-medium text-slate-900"
                              />
                            </div>
                            <div>
                              <span className="text-[10px] text-slate-400 block font-bold">Amount (₹)</span>
                              <input
                                type="number"
                                step="0.01"
                                value={ch.amount}
                                onChange={(e) => handleChargeChange(ruleIdx, cIdx, 'amount', parseFloat(e.target.value) || 0)}
                                className="w-full p-1 bg-slate-50 border border-slate-300 rounded font-mono font-bold text-slate-900"
                              />
                            </div>
                            <div>
                              <span className="text-[10px] text-slate-400 block font-bold">Charge Basis</span>
                              <select
                                value={ch.basis}
                                onChange={(e) => handleChargeChange(ruleIdx, cIdx, 'basis', e.target.value)}
                                className="w-full p-1 bg-slate-50 border border-slate-300 rounded text-slate-900 font-medium"
                              >
                                {CHARGE_BASIS_OPTIONS.map((cb) => (
                                  <option key={cb} value={cb}>{cb}</option>
                                ))}
                              </select>
                            </div>
                            <div className="flex items-center gap-2 pt-4">
                              <label className="flex items-center font-semibold text-slate-700 cursor-pointer">
                                <input
                                  type="checkbox"
                                  checked={ch.taxable}
                                  onChange={(e) => handleChargeChange(ruleIdx, cIdx, 'taxable', e.target.checked)}
                                  className="mr-1 rounded text-setu-600"
                                />
                                Taxable
                              </label>
                            </div>
                          </div>

                          <button
                            type="button"
                            onClick={() => handleRemoveAdditionalCharge(ruleIdx, cIdx)}
                            className="p-1 text-slate-400 hover:text-rose-600 rounded"
                          >
                            <X className="w-4 h-4" />
                          </button>
                        </div>
                      ))}
                    </div>
                  </div>
                )}
              </div>
            );
          })}
        </div>

        {/* BOTTOM SUBMISSION CONTROLS */}
        <div className="flex flex-col-reverse sm:flex-row sm:items-center sm:justify-end gap-2.5 pt-4 border-t border-slate-200">
          <button
            type="button"
            onClick={() => navigate(-1)}
            className="w-full sm:w-auto px-4 py-2 text-xs font-semibold text-slate-700 bg-white border border-slate-300 rounded-md hover:bg-slate-50 transition-colors text-center"
          >
            Cancel
          </button>

          <button
            type="submit"
            disabled={saving}
            className="w-full sm:w-auto inline-flex items-center justify-center gap-2 px-5 py-2 text-xs font-bold text-white bg-setu-600 hover:bg-setu-700 rounded-md shadow-sm transition-colors disabled:opacity-50"
          >
            <Save className="w-4 h-4" />
            <span>
              {saving
                ? 'Saving...'
                : isNewVersionMode
                ? `Publish Version ${formData.version}`
                : isEditMode
                ? 'Save Changes'
                : 'Publish Quotation'}
            </span>
          </button>
        </div>
      </form>
    </div>
  );
};
