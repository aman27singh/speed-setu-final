import React, { useState, useEffect, useMemo } from 'react';
import { consignorConsigneeService } from '../services/consignorConsigneeService';
import { compareCompanyCodes } from '../utils/formatters';
import { PageHeader } from '../components/common/PageHeader';
import { DataTable } from '../components/common/DataTable';
import { LoadingState } from '../components/common/LoadingState';
import { ErrorState } from '../components/common/ErrorState';
import {
  Building,
  Plus,
  Search,
  Filter,
  Eye,
  Edit2,
  Trash2,
  CheckCircle2,
  XCircle,
  MapPin,
  Phone,
  Mail,
  X,
  AlertCircle,
  ShieldAlert,
  Building2
} from 'lucide-react';

const INDIAN_STATES = [
  'Andhra Pradesh', 'Arunachal Pradesh', 'Assam', 'Bihar', 'Chhattisgarh', 'Delhi', 'Goa',
  'Gujarat', 'Haryana', 'Himachal Pradesh', 'Jharkhand', 'Karnataka', 'Kerala', 'Madhya Pradesh',
  'Maharashtra', 'Manipur', 'Meghalaya', 'Mizoram', 'Nagaland', 'Odisha', 'Punjab', 'Rajasthan',
  'Sikkim', 'Tamil Nadu', 'Telangana', 'Tripura', 'Uttar Pradesh', 'Uttarakhand', 'West Bengal'
];

export const ConsignorConsigneePage = () => {
  const [parties, setParties] = useState([]);
  const [stats, setStats] = useState({ total: 0, active: 0, inactive: 0 });
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  // Filters
  const [searchTerm, setSearchTerm] = useState('');
  const [statusFilter, setStatusFilter] = useState('All'); // 'All' | 'Active' | 'Inactive'
  const [stateFilter, setStateFilter] = useState('All');

  // Modals state
  const [showAddEditModal, setShowAddEditModal] = useState(false);
  const [editingParty, setEditingParty] = useState(null);
  const [viewingParty, setViewingParty] = useState(null);
  const [deleteCandidate, setDeleteCandidate] = useState(null);
  const [deleteError, setDeleteError] = useState(null);

  // Form State
  const initialForm = {
    companyName: '',
    companyCode: '',
    addressLine1: '',
    addressLine2: '',
    city: '',
    state: '',
    pinCode: '',
    gstNumber: '',
    pickupDeliveryLocation: '',
    contactPerson: '',
    mobileNumber: '',
    email: '',
    isActive: true
  };
  const [formData, setFormData] = useState(initialForm);
  const [formErrors, setFormErrors] = useState({});
  const [formSubmitting, setFormSubmitting] = useState(false);
  const [previewCode, setPreviewCode] = useState('');

  // Fetch Parties and Stats
  const fetchData = async () => {
    setLoading(true);
    setError(null);
    try {
      const [partiesRes, statsRes] = await Promise.all([
        consignorConsigneeService.getParties({
          search: searchTerm,
          status: statusFilter,
          state: stateFilter === 'All' ? undefined : stateFilter,
          all: true
        }),
        consignorConsigneeService.getStats()
      ]);

      const items = Array.isArray(partiesRes) ? partiesRes : (partiesRes?.items || []);
      setParties(items);
      if (statsRes) setStats(statsRes);
    } catch (err) {
      console.error('Failed to load consignor/consignee directory:', err);
      setError(err.message || 'Failed to fetch party directory.');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchData();
  }, [searchTerm, statusFilter, stateFilter]);

  // Handle open add modal (Single unified entry point)
  const handleOpenAdd = async () => {
    setEditingParty(null);
    setFormErrors({});
    setFormData(initialForm);

    try {
      const nextCodeRes = await consignorConsigneeService.getNextCode();
      if (nextCodeRes?.nextCode) {
        setPreviewCode(nextCodeRes.nextCode);
      } else {
        setPreviewCode('Auto-generated (CC101)');
      }
    } catch (e) {
      setPreviewCode('Auto-generated (CC101)');
    }

    setShowAddEditModal(true);
  };

  // Handle open edit modal
  const handleOpenEdit = (party) => {
    setEditingParty(party);
    setFormErrors({});
    setPreviewCode(party.companyCode);
    setFormData({
      companyName: (party.companyName || '').toUpperCase(),
      companyCode: party.companyCode || '',
      addressLine1: party.address?.addressLine1 || '',
      addressLine2: party.address?.addressLine2 || '',
      city: party.address?.city || '',
      state: party.address?.state || '',
      pinCode: party.address?.pinCode || '',
      gstNumber: (party.gstNumber || '').toUpperCase(),
      pickupDeliveryLocation: party.pickupDeliveryLocation || '',
      contactPerson: party.contactPerson || '',
      mobileNumber: party.mobileNumber || '',
      email: party.email || '',
      isActive: party.isActive !== undefined ? party.isActive : true
    });
    setShowAddEditModal(true);
  };

  // Form Validation
  const validateForm = () => {
    const errors = {};
    if (!formData.companyName.trim()) {
      errors.companyName = 'Company Name is required.';
    }
    if (!formData.addressLine1.trim()) {
      errors.addressLine1 = 'Address Line 1 is required.';
    }
    if (!formData.city.trim()) {
      errors.city = 'City is required.';
    }
    if (!formData.state.trim()) {
      errors.state = 'State is required.';
    }
    if (!formData.pinCode.trim()) {
      errors.pinCode = 'PIN Code is required.';
    } else if (!/^\d{6}$/.test(formData.pinCode.trim())) {
      errors.pinCode = 'PIN Code must be exactly 6 digits.';
    }
    if (formData.gstNumber.trim()) {
      const gstRegex = /^[0-9]{2}[A-Z]{5}[0-9]{4}[A-Z]{1}[1-9A-Z]{1}Z[0-9A-Z]{1}$/;
      if (!gstRegex.test(formData.gstNumber.trim().toUpperCase())) {
        errors.gstNumber = 'Invalid Indian GSTIN format (15 characters e.g. 06ABCDE1234F1Z5).';
      }
    }
    if (formData.email.trim() && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(formData.email.trim())) {
      errors.email = 'Please enter a valid email address.';
    }
    if (formData.mobileNumber.trim() && !/^\+?[0-9]{10,13}$/.test(formData.mobileNumber.trim().replace(/[\s-]/g, ''))) {
      errors.mobileNumber = 'Please enter a valid 10-digit mobile number.';
    }
    setFormErrors(errors);
    return Object.keys(errors).length === 0;
  };

  // Form Submit
  const handleFormSubmit = async (e) => {
    e.preventDefault();
    if (!validateForm()) return;

    setFormSubmitting(true);
    setFormErrors({});

    const payload = {
      companyName: formData.companyName.trim().toUpperCase(),
      address: {
        addressLine1: formData.addressLine1.trim(),
        addressLine2: formData.addressLine2.trim(),
        city: formData.city.trim(),
        state: formData.state.trim(),
        pinCode: formData.pinCode.trim()
      },
      gstNumber: formData.gstNumber.trim().toUpperCase(),
      pickupDeliveryLocation: (formData.pickupDeliveryLocation || '').trim().toUpperCase(),
      contactPerson: formData.contactPerson.trim(),
      mobileNumber: formData.mobileNumber.trim(),
      email: formData.email.trim().toLowerCase(),
      isActive: formData.isActive
    };

    try {
      if (editingParty) {
        await consignorConsigneeService.updateParty(editingParty.id || editingParty._id, payload);
      } else {
        await consignorConsigneeService.createParty(payload);
      }
      setShowAddEditModal(false);
      fetchData();
    } catch (err) {
      console.error('Error saving company:', err);
      setFormErrors({ submit: err.message || 'Failed to save company record.' });
    } finally {
      setFormSubmitting(false);
    }
  };

  // Toggle Active Status
  const handleToggleStatus = async (party) => {
    const id = party.id || party._id;
    try {
      await consignorConsigneeService.togglePartyStatus(id, !party.isActive);
      fetchData();
    } catch (err) {
      alert(`Error toggling company status: ${err.message}`);
    }
  };

  // Attempt Delete
  const handleDeleteParty = async () => {
    if (!deleteCandidate) return;
    setDeleteError(null);
    const id = deleteCandidate.id || deleteCandidate._id;
    try {
      await consignorConsigneeService.deleteParty(id);
      setDeleteCandidate(null);
      fetchData();
    } catch (err) {
      console.warn('Delete prevented:', err.message);
      setDeleteError(err.message || 'Cannot delete company.');
    }
  };

  // Deactivate candidate instead of delete
  const handleDeactivateInstead = async () => {
    if (!deleteCandidate) return;
    const id = deleteCandidate.id || deleteCandidate._id;
    try {
      await consignorConsigneeService.togglePartyStatus(id, false);
      setDeleteCandidate(null);
      setDeleteError(null);
      fetchData();
    } catch (err) {
      alert(`Error deactivating company: ${err.message}`);
    }
  };

  // Sort parties dynamically by Company Code ascending (lowest to highest: CC101 -> CC102 -> ... -> CC111)
  const sortedParties = useMemo(() => {
    return [...parties].sort((a, b) => compareCompanyCodes(a.companyCode, b.companyCode));
  }, [parties]);

  // Table Columns Definition
  const columns = [
    {
      header: 'Company Name',
      accessor: 'companyName',
      render: (row) => (
        <div className="space-y-0.5">
          <div className="font-bold text-slate-900 text-xs flex items-center gap-1.5">
            <Building2 className="w-3.5 h-3.5 text-setu-600 shrink-0" />
            <span className="uppercase">{row.companyName}</span>
          </div>
          {(row.contactPerson || row.email || row.mobileNumber) && (
            <div className="text-[11px] text-slate-500 flex flex-wrap items-center gap-x-2">
              {row.contactPerson && <span className="font-medium text-slate-600">{row.contactPerson}</span>}
              {row.mobileNumber && <span>{row.mobileNumber}</span>}
              {row.email && <span className="text-slate-400">{row.email}</span>}
            </div>
          )}
        </div>
      )
    },
    {
      header: 'Company Code',
      accessor: 'companyCode',
      render: (row) => (
        <span className="font-mono text-xs font-extrabold px-2.5 py-1 rounded-md bg-slate-100 text-setu-700 border border-slate-200">
          {row.companyCode}
        </span>
      )
    },
    {
      header: 'GST Number',
      accessor: 'gstNumber',
      render: (row) => (
        row.gstNumber ? (
          <span className="font-mono text-xs text-slate-800 font-semibold uppercase">{row.gstNumber}</span>
        ) : (
          <span className="text-[11px] text-slate-400 italic">Not Provided</span>
        )
      )
    },
    {
      header: 'Location / Full Address',
      accessor: 'city',
      render: (row) => (
        <div className="text-xs">
          <span className="font-semibold text-slate-800">{row.address?.city || '—'}</span>
          {row.address?.state && <span className="text-slate-500">, {row.address.state}</span>}
          {row.pickupDeliveryLocation && (
            <p className="text-[10px] font-semibold text-amber-700 bg-amber-50 rounded px-1.5 py-0.5 mt-0.5 inline-block border border-amber-200">
              📍 Pickup/Delivery: {row.pickupDeliveryLocation}
            </p>
          )}
          {row.address?.addressLine1 && (
            <p className="text-[10px] text-slate-400 truncate max-w-xs">{row.address.addressLine1}</p>
          )}
        </div>
      )
    },
    {
      header: 'PIN Code',
      accessor: 'pinCode',
      render: (row) => (
        <span className="font-mono text-xs font-semibold text-slate-700">
          {row.address?.pinCode || '—'}
        </span>
      )
    },
    {
      header: 'Status',
      accessor: 'isActive',
      render: (row) => (
        <button
          onClick={() => handleToggleStatus(row)}
          className="cursor-pointer group flex items-center gap-1.5 focus:outline-none"
          title={`Click to set ${row.isActive ? 'Inactive' : 'Active'}`}
        >
          <span
            className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-md text-[10px] font-bold transition-colors ${
              row.isActive
                ? 'bg-emerald-50 text-emerald-700 border border-emerald-200 group-hover:bg-emerald-100'
                : 'bg-slate-100 text-slate-500 border border-slate-200 group-hover:bg-slate-200'
            }`}
          >
            {row.isActive ? <CheckCircle2 className="w-3 h-3 text-emerald-600" /> : <XCircle className="w-3 h-3 text-slate-400" />}
            {row.isActive ? 'Active' : 'Inactive'}
          </span>
        </button>
      )
    },
    {
      header: 'Actions',
      accessor: 'actions',
      render: (row) => (
        <div className="flex items-center space-x-1">
          <button
            onClick={() => setViewingParty(row)}
            className="p-1.5 text-slate-400 hover:text-setu-600 hover:bg-slate-100 rounded transition-colors cursor-pointer"
            title="View Details"
          >
            <Eye className="w-4 h-4" />
          </button>
          <button
            onClick={() => handleOpenEdit(row)}
            className="p-1.5 text-slate-400 hover:text-amber-600 hover:bg-slate-100 rounded transition-colors cursor-pointer"
            title="Edit Company Details"
          >
            <Edit2 className="w-4 h-4" />
          </button>
          <button
            onClick={() => {
              setDeleteCandidate(row);
              setDeleteError(null);
            }}
            className="p-1.5 text-slate-400 hover:text-rose-600 hover:bg-slate-100 rounded transition-colors cursor-pointer"
            title="Delete Company"
          >
            <Trash2 className="w-4 h-4" />
          </button>
        </div>
      )
    }
  ];

  return (
    <div className="space-y-6 pb-12">
      {/* 1. Header with Breadcrumbs & Action Button */}
      <PageHeader
        title="Consignors & Consignees"
        description="Manage your consignor and consignee companies from one centralized database."
        breadcrumbs={['Speed Setu Admin', 'Operations', 'Consignors & Consignees']}
        actions={
          <div className="flex items-center gap-2">
            <button
              onClick={handleOpenAdd}
              className="inline-flex items-center gap-1.5 px-4 py-2 text-xs font-bold text-white bg-setu-600 hover:bg-setu-700 rounded-lg shadow-sm transition-all cursor-pointer active:scale-95"
            >
              <Plus className="w-4 h-4" />
              <span>+ Add Consignor / Consignee</span>
            </button>
          </div>
        }
      />

      {/* 2. Top Summary KPI Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        <div className="bg-white border border-slate-200 rounded-xl p-4 shadow-xs">
          <div className="flex items-center justify-between text-slate-500 mb-1">
            <span className="text-xs font-semibold uppercase tracking-wider">Total Companies</span>
            <Building className="w-4 h-4 text-slate-400" />
          </div>
          <div className="text-2xl font-black text-slate-900">{stats.total}</div>
          <span className="text-[11px] text-slate-400">Available as both Shipper & Receiver</span>
        </div>

        <div className="bg-white border border-emerald-100 rounded-xl p-4 shadow-xs">
          <div className="flex items-center justify-between text-emerald-600 mb-1">
            <span className="text-xs font-semibold uppercase tracking-wider">Active Companies</span>
            <CheckCircle2 className="w-4 h-4 text-emerald-500" />
          </div>
          <div className="text-2xl font-black text-emerald-900">{stats.active}</div>
          <span className="text-[11px] text-emerald-600 font-medium">Available in Shipment CN Autocomplete</span>
        </div>

        <div className="bg-white border border-slate-200 rounded-xl p-4 shadow-xs">
          <div className="flex items-center justify-between text-slate-500 mb-1">
            <span className="text-xs font-semibold uppercase tracking-wider">Inactive Companies</span>
            <XCircle className="w-4 h-4 text-slate-400" />
          </div>
          <div className="text-2xl font-black text-slate-600">{stats.inactive}</div>
          <span className="text-[11px] text-slate-400">Hidden from new shipment creation</span>
        </div>
      </div>

      {/* 3. Search Bar and Filters */}
      <div className="bg-white border border-slate-200 rounded-xl p-4 shadow-xs space-y-3">
        <div className="grid grid-cols-1 sm:grid-cols-12 gap-3">
          {/* Live Search Bar */}
          <div className="sm:col-span-6 relative">
            <Search className="w-4 h-4 text-slate-400 absolute left-3.5 top-1/2 -translate-y-1/2" />
            <input
              type="text"
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              placeholder="Search by company name, COM code, GSTIN, city..."
              className="w-full pl-9 pr-4 py-2 text-xs bg-slate-50 border border-slate-200 rounded-lg text-slate-900 placeholder-slate-400 focus:bg-white focus:ring-2 focus:ring-setu-600 focus:border-transparent transition-all"
            />
            {searchTerm && (
              <button
                onClick={() => setSearchTerm('')}
                className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600 cursor-pointer"
              >
                <X className="w-3.5 h-3.5" />
              </button>
            )}
          </div>

          {/* State Filter */}
          <div className="sm:col-span-3">
            <select
              value={stateFilter}
              onChange={(e) => setStateFilter(e.target.value)}
              className="w-full text-xs font-semibold bg-slate-50 border border-slate-200 rounded-lg px-2.5 py-2 text-slate-700 focus:bg-white focus:ring-2 focus:ring-setu-600 cursor-pointer"
            >
              <option value="All">All States</option>
              {INDIAN_STATES.map((s) => (
                <option key={s} value={s}>{s}</option>
              ))}
            </select>
          </div>

          {/* Status Dropdown */}
          <div className="sm:col-span-3">
            <select
              value={statusFilter}
              onChange={(e) => setStatusFilter(e.target.value)}
              className="w-full text-xs font-semibold bg-slate-50 border border-slate-200 rounded-lg px-2.5 py-2 text-slate-700 focus:bg-white focus:ring-2 focus:ring-setu-600 cursor-pointer"
            >
              <option value="All">All Statuses</option>
              <option value="Active">Active Only</option>
              <option value="Inactive">Inactive Only</option>
            </select>
          </div>
        </div>
      </div>

      {/* 4. Unified Data Table */}
      {loading ? (
        <LoadingState message="Loading Consignors & Consignees Directory..." />
      ) : error ? (
        <ErrorState message={error} onRetry={fetchData} />
      ) : (
        <div className="bg-white border border-slate-200 rounded-xl overflow-hidden shadow-xs">
          <DataTable
            columns={columns}
            data={sortedParties}
            emptyMessage={
              searchTerm
                ? `No companies found matching "${searchTerm}". Try a different search term or add a new company.`
                : 'No companies found in the centralized directory.'
            }
          />
        </div>
      )}

      {/* 5. ADD / EDIT COMPANY MODAL */}
      {showAddEditModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/70 backdrop-blur-xs animate-fade-in">
          <div className="bg-white rounded-2xl border border-slate-200 shadow-2xl w-full max-w-2xl overflow-hidden flex flex-col max-h-[92vh]">
            {/* Modal Header */}
            <div className="flex items-center justify-between px-6 py-4 border-b border-slate-200 bg-slate-50">
              <div className="flex items-center space-x-2">
                <div className="w-8 h-8 rounded-lg flex items-center justify-center font-bold text-white bg-setu-600">
                  <Building2 className="w-4 h-4" />
                </div>
                <div>
                  <h3 className="text-base font-bold text-slate-900">
                    {editingParty ? 'Edit Company Details' : 'Add New Consignor / Consignee'}
                  </h3>
                  <p className="text-xs text-slate-500">
                    {editingParty ? `Company Code: ${editingParty.companyCode}` : `Code assigned only after save (Estimated: ${previewCode})`}
                  </p>
                </div>
              </div>
              <button
                onClick={() => setShowAddEditModal(false)}
                className="p-1 rounded-md text-slate-400 hover:text-slate-600 hover:bg-slate-200 transition-colors cursor-pointer"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {/* Modal Form */}
            <form onSubmit={handleFormSubmit} className="flex-1 overflow-y-auto p-6 space-y-4">
              {formErrors.submit && (
                <div className="p-3 rounded-lg bg-rose-50 border border-rose-200 text-rose-700 text-xs flex items-center gap-2">
                  <AlertCircle className="w-4 h-4 shrink-0" />
                  <span>{formErrors.submit}</span>
                </div>
              )}

              {/* Notice Banner */}
              <div className="p-3 bg-blue-50 border border-blue-200 rounded-lg text-xs text-blue-800 leading-relaxed">
                💡 <strong>Location-Based Master:</strong> A company can have multiple locations (e.g. Bangalore, Chennai, Hyderabad) if its address is different. Each unique company-location receives its own unique CC code (starting from CC100) and can be used as both Consignor (Shipper) and Consignee (Receiver).
              </div>

              {/* Company Name & Company Code */}
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                <div className="sm:col-span-2 space-y-1">
                  <label className="block text-xs font-bold text-slate-700">
                    Company Name <span className="text-rose-500">*</span>
                  </label>
                  <input
                    type="text"
                    required
                    value={formData.companyName}
                    onChange={(e) => setFormData({ ...formData, companyName: e.target.value.toUpperCase() })}
                    placeholder="e.g. ADVIK AUTO PVT LTD, SANSERA ENGINEERING..."
                    className="w-full p-2.5 text-xs bg-white border border-slate-300 rounded-lg font-semibold text-slate-900 focus:ring-2 focus:ring-setu-600 focus:border-transparent uppercase"
                  />
                  {formErrors.companyName && <p className="text-[11px] text-rose-600">{formErrors.companyName}</p>}
                </div>

                <div className="space-y-1">
                  <label className="block text-xs font-bold text-slate-700">Company Code</label>
                  <input
                    type="text"
                    disabled
                    value={editingParty ? formData.companyCode : (previewCode ? `${previewCode} (Assigned on save)` : 'Assigned on save')}
                    className="w-full p-2.5 text-xs bg-slate-100 border border-slate-300 rounded-lg font-mono font-bold text-slate-700 cursor-not-allowed"
                  />
                  <p className="text-[10px] text-slate-400">Assigned sequentially only after clicking "Save Company"</p>
                </div>
              </div>

              {/* GST Number */}
              <div className="space-y-1">
                <label className="block text-xs font-bold text-slate-700">GST Number (Optional)</label>
                <input
                  type="text"
                  maxLength={15}
                  value={formData.gstNumber}
                  onChange={(e) => setFormData({ ...formData, gstNumber: e.target.value.toUpperCase() })}
                  placeholder="15-character GSTIN (e.g. 06ABCDE1234F1Z5)"
                  className="w-full p-2.5 text-xs font-mono font-semibold bg-white border border-slate-300 rounded-lg text-slate-900 focus:ring-2 focus:ring-setu-600 focus:border-transparent uppercase"
                />
                {formErrors.gstNumber && <p className="text-[11px] text-rose-600">{formErrors.gstNumber}</p>}
              </div>

              {/* Street Address */}
              <div className="space-y-1">
                <label className="block text-xs font-bold text-slate-700">
                  Address Line 1 <span className="text-rose-500">*</span>
                </label>
                <input
                  type="text"
                  required
                  value={formData.addressLine1}
                  onChange={(e) => setFormData({ ...formData, addressLine1: e.target.value })}
                  placeholder="Plot No., Industrial Area, Street Name..."
                  className="w-full p-2.5 text-xs bg-white border border-slate-300 rounded-lg text-slate-900 focus:ring-2 focus:ring-setu-600 focus:border-transparent"
                />
                {formErrors.addressLine1 && <p className="text-[11px] text-rose-600">{formErrors.addressLine1}</p>}
              </div>

              <div className="space-y-1">
                <label className="block text-xs font-bold text-slate-700">Address Line 2 (Optional)</label>
                <input
                  type="text"
                  value={formData.addressLine2}
                  onChange={(e) => setFormData({ ...formData, addressLine2: e.target.value })}
                  placeholder="Landmark, Phase, Floor, Unit..."
                  className="w-full p-2.5 text-xs bg-white border border-slate-300 rounded-lg text-slate-900 focus:ring-2 focus:ring-setu-600 focus:border-transparent"
                />
              </div>

              {/* City, State, PIN */}
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                <div className="space-y-1">
                  <label className="block text-xs font-bold text-slate-700">
                    City <span className="text-rose-500">*</span>
                  </label>
                  <input
                    type="text"
                    required
                    value={formData.city}
                    onChange={(e) => setFormData({ ...formData, city: e.target.value })}
                    placeholder="e.g. Pune, Bhiwani, Delhi..."
                    className="w-full p-2.5 text-xs bg-white border border-slate-300 rounded-lg font-semibold text-slate-900 focus:ring-2 focus:ring-setu-600 focus:border-transparent"
                  />
                  {formErrors.city && <p className="text-[11px] text-rose-600">{formErrors.city}</p>}
                </div>

                <div className="space-y-1">
                  <label className="block text-xs font-bold text-slate-700">
                    State <span className="text-rose-500">*</span>
                  </label>
                  <select
                    value={formData.state}
                    onChange={(e) => setFormData({ ...formData, state: e.target.value })}
                    className="w-full p-2.5 text-xs bg-white border border-slate-300 rounded-lg font-semibold text-slate-900 focus:ring-2 focus:ring-setu-600 focus:border-transparent cursor-pointer"
                  >
                    <option value="">Select State</option>
                    {INDIAN_STATES.map((s) => (
                      <option key={s} value={s}>{s}</option>
                    ))}
                  </select>
                  {formErrors.state && <p className="text-[11px] text-rose-600">{formErrors.state}</p>}
                </div>

                <div className="space-y-1">
                  <label className="block text-xs font-bold text-slate-700">
                    PIN Code <span className="text-rose-500">*</span>
                  </label>
                  <input
                    type="text"
                    required
                    maxLength={6}
                    value={formData.pinCode}
                    onChange={(e) => setFormData({ ...formData, pinCode: e.target.value.replace(/\D/g, '') })}
                    placeholder="6-digit PIN"
                    className="w-full p-2.5 text-xs font-mono font-bold bg-white border border-slate-300 rounded-lg text-slate-900 focus:ring-2 focus:ring-setu-600 focus:border-transparent"
                  />
                  {formErrors.pinCode && <p className="text-[11px] text-rose-600">{formErrors.pinCode}</p>}
                </div>
              </div>

              {/* Pickup / Delivery (Text input used in Pickup & Delivery section) */}
              <div className="space-y-1">
                <div className="flex items-center justify-between">
                  <label className="block text-xs font-bold text-slate-700">
                    Pickup / Delivery <span className="text-[11px] text-slate-400 font-normal">(Used at Pickup and Delivery section)</span>
                  </label>
                  <span className="text-[10px] text-setu-600 font-semibold bg-setu-50 px-2 py-0.5 rounded border border-setu-200">
                    Auto-fills Origin / Destination
                  </span>
                </div>
                <input
                  type="text"
                  value={formData.pickupDeliveryLocation}
                  onChange={(e) => setFormData({ ...formData, pickupDeliveryLocation: e.target.value.toUpperCase() })}
                  placeholder="e.g. Pune Hub, Chakan MIDC, Peenya, Bhiwadi Industrial Area..."
                  className="w-full p-2.5 text-xs bg-white border border-slate-300 rounded-lg text-slate-900 font-bold focus:ring-2 focus:ring-setu-600 focus:border-transparent uppercase"
                />
                <p className="text-[10px] text-slate-400">
                  This location will automatically populate "Pickup From (Origin)" or "Deliver To (Destination)" when selected in a shipment.
                </p>
              </div>

              {/* Contact Person, Mobile, Email */}
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                <div className="space-y-1">
                  <label className="block text-xs font-bold text-slate-700">Contact Person</label>
                  <input
                    type="text"
                    value={formData.contactPerson}
                    onChange={(e) => setFormData({ ...formData, contactPerson: e.target.value })}
                    placeholder="Name of POC"
                    className="w-full p-2.5 text-xs bg-white border border-slate-300 rounded-lg text-slate-900 focus:ring-2 focus:ring-setu-600 focus:border-transparent"
                  />
                </div>

                <div className="space-y-1">
                  <label className="block text-xs font-bold text-slate-700">Mobile Number</label>
                  <input
                    type="tel"
                    value={formData.mobileNumber}
                    onChange={(e) => setFormData({ ...formData, mobileNumber: e.target.value })}
                    placeholder="10-digit mobile"
                    className="w-full p-2.5 text-xs font-mono bg-white border border-slate-300 rounded-lg text-slate-900 focus:ring-2 focus:ring-setu-600 focus:border-transparent"
                  />
                  {formErrors.mobileNumber && <p className="text-[11px] text-rose-600">{formErrors.mobileNumber}</p>}
                </div>

                <div className="space-y-1">
                  <label className="block text-xs font-bold text-slate-700">Email Address</label>
                  <input
                    type="email"
                    value={formData.email}
                    onChange={(e) => setFormData({ ...formData, email: e.target.value })}
                    placeholder="contact@company.com"
                    className="w-full p-2.5 text-xs bg-white border border-slate-300 rounded-lg text-slate-900 focus:ring-2 focus:ring-setu-600 focus:border-transparent"
                  />
                  {formErrors.email && <p className="text-[11px] text-rose-600">{formErrors.email}</p>}
                </div>
              </div>

              {/* Active Toggle */}
              <div className="pt-2 flex items-center space-x-2">
                <input
                  type="checkbox"
                  id="isActive"
                  checked={formData.isActive}
                  onChange={(e) => setFormData({ ...formData, isActive: e.target.checked })}
                  className="w-4 h-4 rounded text-setu-600 focus:ring-setu-500 border-slate-300 cursor-pointer"
                />
                <label htmlFor="isActive" className="text-xs font-bold text-slate-700 cursor-pointer select-none">
                  Active (Display in Shipment Consignor & Consignee autocomplete suggestions)
                </label>
              </div>

              {/* Modal Actions */}
              <div className="pt-4 border-t border-slate-200 flex items-center justify-end space-x-2">
                <button
                  type="button"
                  onClick={() => setShowAddEditModal(false)}
                  className="px-4 py-2 text-xs font-bold text-slate-700 bg-white border border-slate-300 rounded-lg hover:bg-slate-50 transition-colors cursor-pointer"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={formSubmitting}
                  className="px-5 py-2 text-xs font-bold text-white bg-setu-600 hover:bg-setu-700 disabled:opacity-50 rounded-lg shadow-sm transition-all cursor-pointer"
                >
                  {formSubmitting ? 'Saving...' : (editingParty ? 'Update Company' : 'Save Company')}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* 6. VIEW DETAILS MODAL */}
      {viewingParty && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/70 backdrop-blur-xs animate-fade-in">
          <div className="bg-white rounded-2xl border border-slate-200 shadow-2xl w-full max-w-lg overflow-hidden flex flex-col">
            <div className="flex items-center justify-between px-6 py-4 border-b border-slate-200 bg-slate-50">
              <div className="flex items-center space-x-2">
                <span className="font-mono text-xs font-extrabold px-2.5 py-1 rounded bg-slate-200 text-slate-800">
                  {viewingParty.companyCode}
                </span>
                <h3 className="text-sm font-bold text-slate-900 uppercase">{viewingParty.companyName}</h3>
              </div>
              <button
                onClick={() => setViewingParty(null)}
                className="p-1 rounded-md text-slate-400 hover:text-slate-600 hover:bg-slate-200 transition-colors cursor-pointer"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="p-6 space-y-4 text-xs">
              <div className="flex items-center justify-between pb-3 border-b border-slate-100">
                <span className="text-slate-500 font-medium">Availability</span>
                <span className="font-bold px-2 py-0.5 rounded text-[11px] bg-blue-50 text-blue-700 border border-blue-200">
                  Consignor & Consignee
                </span>
              </div>

              <div className="space-y-1 pb-3 border-b border-slate-100">
                <span className="text-slate-500 font-medium block">Full Address</span>
                <p className="font-semibold text-slate-900 text-xs leading-relaxed">
                  {viewingParty.fullAddress || viewingParty.address?.addressLine1 || '—'}
                </p>
                <div className="grid grid-cols-3 gap-2 pt-1 font-mono text-[11px] text-slate-600">
                  <div>City: <span className="font-bold text-slate-900">{viewingParty.address?.city || '—'}</span></div>
                  <div>State: <span className="font-bold text-slate-900">{viewingParty.address?.state || '—'}</span></div>
                  <div>PIN: <span className="font-bold text-slate-900">{viewingParty.address?.pinCode || '—'}</span></div>
                </div>
              </div>

              <div className="space-y-2 pb-3 border-b border-slate-100">
                <div className="flex items-center justify-between">
                  <span className="text-slate-500 font-medium">Pickup / Delivery</span>
                  <span className="font-bold text-slate-900 uppercase">{viewingParty.pickupDeliveryLocation || 'Not Specified (Uses City)'}</span>
                </div>
                <div className="flex items-center justify-between">
                  <span className="text-slate-500 font-medium">GSTIN</span>
                  <span className="font-mono font-bold text-slate-900 uppercase">{viewingParty.gstNumber || 'Not Registered'}</span>
                </div>
                <div className="flex items-center justify-between">
                  <span className="text-slate-500 font-medium">Contact Person</span>
                  <span className="font-semibold text-slate-900">{viewingParty.contactPerson || '—'}</span>
                </div>
                <div className="flex items-center justify-between">
                  <span className="text-slate-500 font-medium">Mobile Number</span>
                  <span className="font-mono font-semibold text-slate-900">{viewingParty.mobileNumber || '—'}</span>
                </div>
                <div className="flex items-center justify-between">
                  <span className="text-slate-500 font-medium">Email Address</span>
                  <span className="font-medium text-slate-900">{viewingParty.email || '—'}</span>
                </div>
              </div>

              <div className="flex items-center justify-between text-[11px] text-slate-400 pt-1">
                <span>Status: <strong className={viewingParty.isActive ? 'text-emerald-600' : 'text-slate-500'}>{viewingParty.isActive ? 'Active' : 'Inactive'}</strong></span>
                <span>Created: {new Date(viewingParty.createdAt).toLocaleDateString('en-IN')}</span>
              </div>
            </div>

            <div className="px-6 py-3 bg-slate-50 border-t border-slate-200 flex items-center justify-end space-x-2">
              <button
                onClick={() => {
                  const target = viewingParty;
                  setViewingParty(null);
                  handleOpenEdit(target);
                }}
                className="px-3.5 py-1.5 text-xs font-bold text-amber-700 bg-amber-50 hover:bg-amber-100 border border-amber-200 rounded-lg transition-colors cursor-pointer"
              >
                Edit Details
              </button>
              <button
                onClick={() => setViewingParty(null)}
                className="px-4 py-1.5 text-xs font-bold text-slate-700 bg-white border border-slate-300 rounded-lg hover:bg-slate-100 transition-colors cursor-pointer"
              >
                Close
              </button>
            </div>
          </div>
        </div>
      )}

      {/* 7. DELETE CONFIRMATION DIALOG (WITH SHIPMENT LINKAGE PROTECTION) */}
      {deleteCandidate && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/70 backdrop-blur-xs animate-fade-in">
          <div className="bg-white rounded-2xl border border-slate-200 shadow-2xl w-full max-w-md p-6 space-y-4">
            <div className="flex items-center space-x-3 text-rose-600">
              <div className="w-10 h-10 rounded-full bg-rose-50 flex items-center justify-center shrink-0">
                {deleteError ? <ShieldAlert className="w-6 h-6 text-amber-600" /> : <AlertCircle className="w-6 h-6 text-rose-600" />}
              </div>
              <div>
                <h3 className="text-sm font-bold text-slate-900">
                  {deleteError ? 'Cannot Delete Company' : 'Delete Company Record?'}
                </h3>
                <p className="text-xs text-slate-500">
                  {deleteError ? 'Protected by Shipment History' : 'This action cannot be undone.'}
                </p>
              </div>
            </div>

            {deleteError ? (
              <div className="space-y-3">
                <div className="p-3 bg-amber-50 border border-amber-200 rounded-lg text-xs text-amber-800 leading-relaxed">
                  ⚠️ {deleteError}
                </div>
                <p className="text-xs text-slate-600">
                  To prevent breaking historical audit records, deactivating the company will hide it from future shipments while preserving all existing shipments.
                </p>
                <div className="flex items-center justify-end space-x-2 pt-2">
                  <button
                    onClick={() => {
                      setDeleteCandidate(null);
                      setDeleteError(null);
                    }}
                    className="px-4 py-2 text-xs font-bold text-slate-700 bg-white border border-slate-300 rounded-lg hover:bg-slate-50 transition-colors cursor-pointer"
                  >
                    Cancel
                  </button>
                  <button
                    onClick={handleDeactivateInstead}
                    className="px-4 py-2 text-xs font-bold text-white bg-amber-600 hover:bg-amber-700 rounded-lg shadow-sm transition-all cursor-pointer"
                  >
                    Deactivate Instead
                  </button>
                </div>
              </div>
            ) : (
              <div>
                <p className="text-xs text-slate-600 leading-relaxed">
                  Are you sure you want to delete <strong className="text-slate-900">{deleteCandidate.companyName}</strong> ({deleteCandidate.companyCode})?
                </p>
                <div className="flex items-center justify-end space-x-2 pt-4">
                  <button
                    onClick={() => setDeleteCandidate(null)}
                    className="px-4 py-2 text-xs font-bold text-slate-700 bg-white border border-slate-300 rounded-lg hover:bg-slate-50 transition-colors cursor-pointer"
                  >
                    Cancel
                  </button>
                  <button
                    onClick={handleDeleteParty}
                    className="px-4 py-2 text-xs font-bold text-white bg-rose-600 hover:bg-rose-700 rounded-lg shadow-sm transition-all cursor-pointer"
                  >
                    Yes, Delete Record
                  </button>
                </div>
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
};
