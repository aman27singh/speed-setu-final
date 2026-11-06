import React, { useState, useEffect, useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import { partyService } from '../services/partyService';
import { PageHeader } from '../components/common/PageHeader';
import { SearchBar } from '../components/common/SearchBar';
import { LoadingState } from '../components/common/LoadingState';
import { Modal } from '../components/common/Modal';
import {
  Users,
  Plus,
  Building2,
  MapPin,
  Phone,
  Mail,
  Edit,
  Trash2,
  AlertTriangle,
  Check,
  X,
  Sparkles,
  ArrowRight,
  RefreshCw,
  FileText,
  Truck
} from 'lucide-react';

export const PartiesPage = () => {
  const navigate = useNavigate();
  const [parties, setParties] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  // Filter States
  const [search, setSearch] = useState('');
  const [activeTab, setActiveTab] = useState('all'); // 'all', 'consignor', 'consignee', 'duplicates'
  const [cityFilter, setCityFilter] = useState('All');
  const [toastMessage, setToastMessage] = useState('');

  // Modal States
  const [isCreateModalOpen, setIsCreateModalOpen] = useState(false);
  const [editingParty, setEditingParty] = useState(null);
  const [deleteTarget, setDeleteTarget] = useState(null);
  const [mergeCluster, setMergeCluster] = useState(null);
  const [selectedMasterId, setSelectedMasterId] = useState('');
  const [updatePastShipmentsOnMerge, setUpdatePastShipmentsOnMerge] = useState(true);
  const [isSubmitting, setIsSubmitting] = useState(false);

  // Form State for Add / Edit Party
  const initialFormState = {
    name: '',
    type: 'Both',
    address: '',
    city: '',
    state: '',
    pin: '',
    gstin: '',
    contact: '',
    phone: '',
    email: '',
    updatePastShipments: false
  };
  const [formData, setFormData] = useState(initialFormState);

  // Fetch Parties
  const fetchParties = async () => {
    setLoading(true);
    setError(null);
    try {
      const data = await partyService.getParties();
      setParties(data);
    } catch (err) {
      setError(err.message || 'Failed to load parties directory.');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchParties();
  }, []);

  // Compute duplicate clusters
  const duplicateClusters = useMemo(() => {
    return partyService.findDuplicateClusters(parties);
  }, [parties]);

  // Unique list of cities for filter
  const cityOptions = useMemo(() => {
    const set = new Set();
    parties.forEach((p) => {
      if (p.city && p.city.trim()) {
        set.add(p.city.trim());
      }
    });
    return ['All', ...Array.from(set).sort()];
  }, [parties]);

  // Helper to compute search relevance score
  const getSearchScore = (party, query) => {
    const q = query.toLowerCase().trim();
    if (!q) return 1;

    const name = (party.name || '').toLowerCase().trim();
    const city = (party.city || '').toLowerCase().trim();
    const state = (party.state || '').toLowerCase().trim();
    const gstin = (party.gstin || '').toLowerCase().trim();
    const pin = (party.pin || '').toLowerCase().trim();
    const phone = (party.phone || '').toLowerCase().trim();
    const email = (party.email || '').toLowerCase().trim();
    const address = (party.address || '').toLowerCase().trim();

    // 1. Exact match on company name
    if (name === q) return 1000;

    // 2. Company name starts with query (e.g. "sa" -> "SAFE AIR CARGO", "SANSERA...")
    if (name.startsWith(q)) return 800;

    // 3. A word in the company name starts with query (e.g. "CARGO", "ENGINEERING")
    const words = name.split(/[\s,()\-./]+/).filter(Boolean);
    if (words.some((w) => w.startsWith(q))) return 650;

    // 4. Company name contains the query
    if (name.includes(q)) return 450;

    // 5. City starts with query (e.g. "pune", "gurgaon")
    if (city.startsWith(q)) return 350;

    // 6. GSTIN starts with query (e.g. "06", "29")
    if (gstin.startsWith(q)) return 300;

    // 7. Pincode starts with query
    if (pin.startsWith(q)) return 250;

    // 8. Phone or Email starts with query
    if (phone.startsWith(q) || email.startsWith(q)) return 220;

    // 9. For queries >= 3 characters, allow deeper content searching
    if (q.length >= 3) {
      if (city.includes(q)) return 180;
      if (gstin.includes(q)) return 150;
      if (state.includes(q)) return 140;
      if (phone.includes(q) || email.includes(q)) return 120;
      if (address.includes(q)) return 60;
    }

    // 10. Multi-word search token matching (e.g. "sansera 5", "advik 40")
    const tokens = q.split(/\s+/).filter(Boolean);
    if (tokens.length > 1) {
      const allTokensMatch = tokens.every(
        (t) =>
          name.includes(t) ||
          city.includes(t) ||
          gstin.includes(t) ||
          (t.length >= 3 && address.includes(t))
      );
      if (allTokensMatch) return 400;
    }

    return 0; // Not matched
  };

  // Filtered & Relevance-Sorted Parties List
  const filteredParties = useMemo(() => {
    const q = search.trim().toLowerCase();

    const scored = parties
      .map((p) => ({
        party: p,
        score: q ? getSearchScore(p, q) : 1
      }))
      .filter(({ party: p, score }) => {
        // Tab Filter
        if (activeTab === 'consignor' && p.type !== 'Consignor' && p.type !== 'Both') return false;
        if (activeTab === 'consignee' && p.type !== 'Consignee' && p.type !== 'Both') return false;

        // City Filter
        if (cityFilter !== 'All' && (p.city || '').toLowerCase() !== cityFilter.toLowerCase()) return false;

        // Search Filter
        if (q && score <= 0) return false;

        return true;
      });

    // If a search query is active, sort by highest match relevance score first
    if (q) {
      scored.sort((a, b) => {
        if (b.score !== a.score) {
          return b.score - a.score;
        }
        return (a.party.name || '').localeCompare(b.party.name || '');
      });
    }

    return scored.map((item) => item.party);
  }, [parties, activeTab, cityFilter, search]);

  // Open Create Modal
  const handleOpenCreate = () => {
    setEditingParty(null);
    setFormData(initialFormState);
    setIsCreateModalOpen(true);
  };

  // Open Edit Modal
  const handleOpenEdit = (party) => {
    setEditingParty(party);
    const hasExplicitEmail = party.email !== undefined && party.email !== null;
    const existingEmail = hasExplicitEmail ? party.email : (party.contact && party.contact.includes('@') ? party.contact : '');

    const hasExplicitPhone = party.phone !== undefined && party.phone !== null;
    const existingPhone = hasExplicitPhone ? party.phone : (party.contact && !party.contact.includes('@') ? party.contact : '');

    setFormData({
      name: party.name || '',
      type: 'Both',
      address: party.address || '',
      city: party.city || '',
      state: party.state || '',
      pin: party.pin || '',
      gstin: party.gstin || '',
      contact: existingPhone || existingEmail || '',
      phone: existingPhone,
      email: existingEmail,
      updatePastShipments: false
    });
    setIsCreateModalOpen(true);
  };

  // Submit Create or Edit
  const handleSaveParty = async (e) => {
    e.preventDefault();
    if (!formData.name.trim()) return;

    setIsSubmitting(true);
    try {
      const cleanEmail = (formData.email || '').trim();
      const cleanPhone = (formData.phone || '').trim();
      const cleanContact = cleanPhone || cleanEmail || '';

      const payload = {
        ...formData,
        name: formData.name.trim(),
        type: 'Both',
        email: cleanEmail,
        phone: cleanPhone,
        contact: cleanContact
      };

      if (editingParty) {
        const targetId = editingParty.id || editingParty._id;
        await partyService.updateParty(
          targetId,
          payload,
          formData.updatePastShipments,
          editingParty
        );

        // Immediately update React state so the UI reflects the change with zero delay
        setParties((prev) =>
          prev.map((p) => {
            const isMatch =
              (targetId && (p.id == targetId || p._id == targetId)) ||
              (editingParty.id && (p.id == editingParty.id || p._id == editingParty.id)) ||
              (editingParty._id && (p.id == editingParty._id || p._id == editingParty._id)) ||
              (editingParty.name && p.name && p.name.trim().toLowerCase() === editingParty.name.trim().toLowerCase()) ||
              (payload.name && p.name && p.name.trim().toLowerCase() === payload.name.trim().toLowerCase());

            if (isMatch) {
              return {
                ...p,
                ...payload,
                email: cleanEmail,
                phone: cleanPhone,
                contact: cleanContact
              };
            }
            return p;
          })
        );

        showToast(`Party "${formData.name}" updated successfully.`);
      } else {
        const created = await partyService.createParty(payload);
        setParties((prev) => [created, ...prev]);
        showToast(`New party "${formData.name}" added to directory.`);
      }

      setIsCreateModalOpen(false);
      setEditingParty(null);
    } catch (err) {
      alert(err.message || 'Failed to save party.');
    } finally {
      setIsSubmitting(false);
    }
  };

  // Delete Party
  const handleDeleteParty = async () => {
    if (!deleteTarget) return;
    setIsSubmitting(true);
    try {
      await partyService.deleteParty(deleteTarget.id || deleteTarget._id);
      showToast(`Party "${deleteTarget.name}" deleted.`);
      setDeleteTarget(null);
      await fetchParties();
    } catch (err) {
      alert(err.message || 'Failed to delete party.');
    } finally {
      setIsSubmitting(false);
    }
  };

  // Open Merge Modal
  const handleOpenMerge = (cluster) => {
    setMergeCluster(cluster);
    setSelectedMasterId(cluster.records[0]?.id || cluster.records[0]?._id || '');
    setUpdatePastShipmentsOnMerge(true);
  };

  // Execute Merge
  const handleExecuteMerge = async () => {
    if (!mergeCluster || !selectedMasterId) return;

    const duplicateIds = mergeCluster.records
      .map((r) => r.id || r._id)
      .filter((id) => id !== selectedMasterId);

    if (duplicateIds.length === 0) return;

    setIsSubmitting(true);
    try {
      await partyService.mergeParties(selectedMasterId, duplicateIds, updatePastShipmentsOnMerge);
      const masterRecord = mergeCluster.records.find((r) => (r.id || r._id) === selectedMasterId);
      showToast(`Merged ${duplicateIds.length} duplicate(s) into master "${masterRecord?.name}".`);
      setMergeCluster(null);
      await fetchParties();
    } catch (err) {
      alert(err.message || 'Failed to merge duplicates.');
    } finally {
      setIsSubmitting(false);
    }
  };

  const showToast = (msg) => {
    setToastMessage(msg);
    setTimeout(() => setToastMessage(''), 4000);
  };

  const consignorsCount = parties.filter((p) => p.type === 'Consignor' || p.type === 'Both').length;
  const consigneesCount = parties.filter((p) => p.type === 'Consignee' || p.type === 'Both').length;

  return (
    <div className="space-y-6">
      {/* Page Header */}
      <PageHeader
        title="Consignors & Consignees Directory"
        description="Manage master shippers, receivers & companies. Standardize addresses, pincodes & GSTIN, and clean up duplicate records."
        actions={
          <div className="flex flex-wrap items-center gap-2">
            <button
              onClick={() => navigate('/admin/shipments')}
              className="inline-flex items-center gap-1.5 px-3 py-2 text-xs font-semibold text-slate-700 bg-white border border-slate-300 hover:bg-slate-50 rounded-lg shadow-xs transition-colors cursor-pointer"
            >
              <Truck className="w-4 h-4 text-setu-600" />
              <span>Back to Shipments</span>
            </button>
            <button
              onClick={fetchParties}
              disabled={loading}
              className="inline-flex items-center gap-1.5 px-3 py-2 text-xs font-semibold text-slate-700 bg-white border border-slate-300 hover:bg-slate-50 rounded-lg shadow-xs transition-colors disabled:opacity-50 cursor-pointer"
              title="Refresh Directory"
            >
              <RefreshCw className={`w-3.5 h-3.5 ${loading ? 'animate-spin text-setu-600' : 'text-slate-500'}`} />
              <span>Refresh</span>
            </button>
            {duplicateClusters.length > 0 && (
              <button
                onClick={() => setActiveTab('duplicates')}
                className="inline-flex items-center gap-1.5 px-3.5 py-2 text-xs font-bold text-amber-900 bg-amber-100 hover:bg-amber-200 border border-amber-300 rounded-lg shadow-xs transition-all active:scale-95 cursor-pointer"
              >
                <Sparkles className="w-4 h-4 text-amber-700 animate-pulse" />
                <span>Fix Duplicates ({duplicateClusters.length})</span>
              </button>
            )}
            <button
              onClick={handleOpenCreate}
              className="inline-flex items-center gap-1.5 px-4 py-2 text-xs font-bold text-white bg-setu-600 hover:bg-setu-700 rounded-lg shadow-sm transition-all active:scale-95 cursor-pointer"
            >
              <Plus className="w-4 h-4" />
              <span>+ Add Company</span>
            </button>
          </div>
        }
      />

      {/* Toast Notification */}
      {toastMessage && (
        <div className="p-3 bg-slate-900 text-white rounded-lg text-xs font-semibold flex items-center justify-between shadow-lg animate-fade-in border border-slate-700">
          <div className="flex items-center gap-2">
            <Check className="w-4 h-4 text-emerald-400" />
            <span>{toastMessage}</span>
          </div>
          <button onClick={() => setToastMessage('')} className="text-slate-400 hover:text-white font-bold ml-4">
            <X className="w-4 h-4" />
          </button>
        </div>
      )}

      {/* KPI Metric Cards */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 sm:gap-4">
        <div className="bg-white border border-slate-200 rounded-xl p-4 shadow-xs">
          <div className="flex items-center justify-between">
            <span className="text-xs font-bold text-slate-500 uppercase tracking-wider">Total Parties</span>
            <div className="w-8 h-8 rounded-lg bg-blue-50 flex items-center justify-center text-blue-600">
              <Building2 className="w-4 h-4" />
            </div>
          </div>
          <div className="mt-2 text-2xl font-black text-slate-900">{parties.length}</div>
          <div className="text-[11px] text-slate-400 mt-0.5">Master registered companies</div>
        </div>

        <div className="bg-white border border-slate-200 rounded-xl p-4 shadow-xs">
          <div className="flex items-center justify-between">
            <span className="text-xs font-bold text-slate-500 uppercase tracking-wider">Role Type</span>
            <div className="w-8 h-8 rounded-lg bg-emerald-50 flex items-center justify-center text-emerald-600">
              <Users className="w-4 h-4" />
            </div>
          </div>
          <div className="mt-2 text-2xl font-black text-emerald-700">100%</div>
          <div className="text-[11px] text-emerald-600 mt-0.5 font-semibold">Shipper & Receiver (Both)</div>
        </div>

        <div className="bg-white border border-slate-200 rounded-xl p-4 shadow-xs">
          <div className="flex items-center justify-between">
            <span className="text-xs font-bold text-slate-500 uppercase tracking-wider">Locations & Hubs</span>
            <div className="w-8 h-8 rounded-lg bg-indigo-50 flex items-center justify-center text-indigo-600">
              <MapPin className="w-4 h-4" />
            </div>
          </div>
          <div className="mt-2 text-2xl font-black text-slate-900">{cityOptions.length - 1}</div>
          <div className="text-[11px] text-slate-400 mt-0.5">Cities across India</div>
        </div>

        <div
          onClick={() => duplicateClusters.length > 0 && setActiveTab('duplicates')}
          className={`border rounded-xl p-4 shadow-xs transition-all ${
            duplicateClusters.length > 0
              ? 'bg-amber-50/70 border-amber-300 cursor-pointer hover:bg-amber-50'
              : 'bg-white border-slate-200'
          }`}
        >
          <div className="flex items-center justify-between">
            <span className="text-xs font-bold text-amber-800 uppercase tracking-wider">Duplicate Clusters</span>
            <div className="w-8 h-8 rounded-lg bg-amber-100 flex items-center justify-center text-amber-700">
              <AlertTriangle className="w-4 h-4" />
            </div>
          </div>
          <div className="mt-2 text-2xl font-black text-amber-900">{duplicateClusters.length}</div>
          <div className="text-[11px] text-amber-700 mt-0.5 font-medium">
            {duplicateClusters.length > 0 ? 'Click to inspect & merge' : 'Directory is clean'}
          </div>
        </div>
      </div>

      {/* Tabs Row */}
      <div className="flex border-b border-slate-200 overflow-x-auto">
        <button
          onClick={() => setActiveTab('all')}
          className={`px-4 py-2.5 text-xs font-bold border-b-2 whitespace-nowrap transition-colors ${
            activeTab === 'all'
              ? 'border-setu-600 text-setu-600'
              : 'border-transparent text-slate-500 hover:text-slate-800'
          }`}
        >
          All Parties ({parties.length})
        </button>
        <button
          onClick={() => setActiveTab('duplicates')}
          className={`px-4 py-2.5 text-xs font-bold border-b-2 whitespace-nowrap flex items-center gap-1.5 transition-colors ${
            activeTab === 'duplicates'
              ? 'border-amber-500 text-amber-700'
              : 'border-transparent text-slate-500 hover:text-slate-800'
          }`}
        >
          <span>Potential Duplicates</span>
          {duplicateClusters.length > 0 && (
            <span className="px-1.5 py-0.5 rounded-full text-[10px] font-extrabold bg-amber-100 text-amber-800">
              {duplicateClusters.length}
            </span>
          )}
        </button>
      </div>

      {/* DUPLICATE CLUSTERS VIEW */}
      {activeTab === 'duplicates' ? (
        <div className="space-y-4">
          <div className="p-4 bg-amber-50/80 border border-amber-200 rounded-xl text-amber-900 text-xs">
            <div className="font-bold text-sm mb-1 flex items-center gap-2">
              <Sparkles className="w-4 h-4 text-amber-600" />
              <span>Smart Deduplication & Merge Assistant</span>
            </div>
            <p className="text-amber-800 leading-relaxed">
              We analyzed company names and identified party clusters that share similar spelling, branch variations, or matching GSTINs.
              Select <strong>"Review & Merge"</strong> on any cluster to pick the single master record to keep and delete the repeated variations.
            </p>
          </div>

          {duplicateClusters.length === 0 ? (
            <div className="bg-white border border-slate-200 rounded-xl p-12 text-center text-slate-500">
              <Check className="w-12 h-12 text-emerald-500 mx-auto mb-3" />
              <div className="font-bold text-base text-slate-800">No Duplicate Company Clusters Found!</div>
              <div className="text-xs text-slate-500 mt-1">Your consignors and consignees directory is cleanly organized.</div>
            </div>
          ) : (
            <div className="space-y-3">
              {duplicateClusters.map((cluster, idx) => (
                <div key={idx} className="bg-white border border-slate-200 rounded-xl p-4 shadow-xs space-y-3">
                  <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 border-b border-slate-100 pb-3">
                    <div>
                      <div className="flex items-center gap-2">
                        <span className="font-extrabold text-slate-900 text-sm">{cluster.primaryName}</span>
                        <span className="px-2 py-0.5 bg-amber-100 text-amber-800 text-[10px] font-bold rounded-full">
                          {cluster.records.length} variations
                        </span>
                      </div>
                      <span className="text-[11px] text-slate-400">
                        Normalized grouping key: <code className="font-mono bg-slate-100 px-1 py-0.5 rounded">{cluster.normalizedKey}</code>
                      </span>
                    </div>

                    <button
                      onClick={() => handleOpenMerge(cluster)}
                      className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-bold text-white bg-amber-600 hover:bg-amber-700 rounded-lg shadow-xs transition-all active:scale-95 shrink-0"
                    >
                      <Sparkles className="w-3.5 h-3.5" />
                      <span>Review & Merge Duplicates</span>
                    </button>
                  </div>

                  {/* List of Duplicate Records */}
                  <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-2">
                    {cluster.records.map((rec) => (
                      <div key={rec.id || rec._id} className="p-2.5 bg-slate-50 border border-slate-200 rounded-lg text-xs space-y-1">
                        <div className="font-bold text-slate-900 truncate" title={rec.name}>{rec.name}</div>
                        <div className="text-[11px] text-slate-500 flex items-center gap-1">
                          <MapPin className="w-3 h-3 text-slate-400 shrink-0" />
                          <span className="truncate">{rec.city || 'No City'}{rec.pin ? ` - ${rec.pin}` : ''}</span>
                        </div>
                        {rec.address && (
                          <div className="text-[10px] text-slate-400 truncate" title={rec.address}>{rec.address}</div>
                        )}
                        {rec.gstin && (
                          <div className="text-[10px] font-mono text-slate-600">GSTIN: {rec.gstin}</div>
                        )}
                      </div>
                    ))}
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      ) : (
        /* STANDARD DIRECTORY LIST VIEW */
        <div className="space-y-3">
          {/* Search & Filter Bar */}
          <div className="bg-white border border-slate-200 rounded-xl p-3 sm:p-4 shadow-xs flex flex-col sm:flex-row items-center gap-3">
            <div className="w-full sm:flex-1">
              <SearchBar
                value={search}
                onChange={setSearch}
                placeholder="Search party name, city, address, GSTIN, pincode, phone..."
              />
            </div>
            <div className="w-full sm:w-auto flex items-center gap-2">
              <span className="text-xs font-bold text-slate-500 whitespace-nowrap">City:</span>
              <select
                value={cityFilter}
                onChange={(e) => setCityFilter(e.target.value)}
                className="px-3 py-2 text-xs bg-slate-50 border border-slate-200 rounded-lg text-slate-700 font-semibold focus:outline-none focus:ring-2 focus:ring-setu-600/20 w-full sm:w-44"
              >
                {cityOptions.map((c) => (
                  <option key={c} value={c}>{c}</option>
                ))}
              </select>
              <button
                onClick={handleOpenCreate}
                className="inline-flex items-center gap-1.5 px-3.5 py-2 text-xs font-bold text-white bg-setu-600 hover:bg-setu-700 rounded-lg shadow-sm transition-all active:scale-95 whitespace-nowrap cursor-pointer"
              >
                <Plus className="w-3.5 h-3.5" />
                <span>+ Add Company</span>
              </button>
            </div>
          </div>

          {/* Directory Table */}
          {loading ? (
            <div className="p-12 bg-white border border-slate-200 rounded-xl">
              <LoadingState message="Loading Consignors & Consignees directory..." />
            </div>
          ) : error ? (
            <div className="p-6 bg-rose-50 border border-rose-200 rounded-xl text-rose-700 text-xs font-semibold">
              {error}
            </div>
          ) : filteredParties.length === 0 ? (
            <div className="bg-white border border-slate-200 rounded-xl p-12 text-center text-slate-500">
              <Users className="w-12 h-12 text-slate-300 mx-auto mb-3" />
              <div className="font-bold text-base text-slate-800">No Parties Found</div>
              <div className="text-xs text-slate-500 mt-1 mb-4">
                {search ? 'No party matches your search criteria.' : 'No party records in this category.'}
              </div>
              <button
                onClick={handleOpenCreate}
                className="inline-flex items-center gap-1.5 px-4 py-2 text-xs font-bold text-white bg-setu-600 hover:bg-setu-700 rounded-lg shadow-xs"
              >
                <Plus className="w-4 h-4" />
                <span>Add First Party</span>
              </button>
            </div>
          ) : (
            <div className="bg-white border border-slate-200 rounded-xl overflow-hidden shadow-xs">
              <div className="overflow-x-auto">
                <table className="w-full text-left border-collapse">
                  <thead>
                    <tr className="bg-slate-50 border-b border-slate-200 text-[11px] font-bold text-slate-600 uppercase tracking-wider">
                      <th className="py-3 px-4">Party / Company Name</th>
                      <th className="py-3 px-3">Role Type</th>
                      <th className="py-3 px-3">City & Pincode</th>
                      <th className="py-3 px-4">Full Address</th>
                      <th className="py-3 px-3">GSTIN / Contact</th>
                      <th className="py-3 px-4 text-right">Actions</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100 text-xs">
                    {filteredParties.map((party) => {
                      const id = party.id || party._id;
                      return (
                        <tr key={id} className="hover:bg-slate-50/70 transition-colors">
                          {/* Name */}
                          <td className="py-3 px-4 font-bold text-slate-900">
                            <div className="flex items-center gap-1.5">
                              <span className="truncate max-w-[260px]" title={party.name}>
                                {party.name}
                              </span>
                            </div>
                            {party.state && (
                              <span className="text-[10px] text-slate-400 font-normal block">
                                {party.state}
                              </span>
                            )}
                          </td>

                          {/* Role Type */}
                          <td className="py-3 px-3">
                            <span className="inline-block px-2.5 py-0.5 rounded-full text-[10px] font-bold bg-emerald-100 text-emerald-800">
                              Shipper & Receiver
                            </span>
                          </td>

                          {/* City & Pin */}
                          <td className="py-3 px-3">
                            <div className="font-semibold text-slate-800 flex items-center gap-1">
                              <MapPin className="w-3 h-3 text-slate-400 shrink-0" />
                              <span>{party.city || '-'}</span>
                            </div>
                            {party.pin && (
                              <span className="text-[10px] font-mono text-slate-500 font-bold block ml-4">
                                {party.pin}
                              </span>
                            )}
                          </td>

                          {/* Address */}
                          <td className="py-3 px-4 text-slate-600 max-w-[320px]">
                            <span className="line-clamp-2 text-[11px]" title={party.address}>
                              {party.address || <span className="text-slate-300 italic">No address provided</span>}
                            </span>
                          </td>

                          {/* GSTIN / Contact */}
                          <td className="py-3 px-3">
                            {party.gstin ? (
                              <span className="font-mono text-[11px] font-bold text-slate-700 block">
                                {party.gstin}
                              </span>
                            ) : (
                              <span className="text-slate-400 text-[10px] block">-</span>
                            )}
                            {Boolean(party.phone !== undefined ? (party.phone && party.phone.trim()) : (party.contact && !party.contact.includes('@') ? party.contact.trim() : '')) && (
                              <span className="text-[10px] text-slate-500 flex items-center gap-1 mt-0.5">
                                <Phone className="w-2.5 h-2.5 text-slate-400 shrink-0" />
                                <span>{party.phone || party.contact}</span>
                              </span>
                            )}
                            {Boolean(party.email !== undefined ? (party.email && party.email.trim()) : (party.contact && party.contact.includes('@') ? party.contact.trim() : '')) && (
                              <span className="text-[10px] text-slate-500 flex items-center gap-1 mt-0.5" title={party.email || party.contact}>
                                <Mail className="w-2.5 h-2.5 text-slate-400 shrink-0" />
                                <span className="truncate max-w-[170px]">{party.email || party.contact}</span>
                              </span>
                            )}
                          </td>

                          {/* Actions */}
                          <td className="py-3 px-4 text-right">
                            <div className="inline-flex items-center gap-1">
                              <button
                                onClick={() => handleOpenEdit(party)}
                                className="p-1.5 text-slate-500 hover:text-setu-600 hover:bg-setu-50 rounded-md transition-colors"
                                title="Edit Party Details"
                              >
                                <Edit className="w-3.5 h-3.5" />
                              </button>
                              <button
                                onClick={() => setDeleteTarget(party)}
                                className="p-1.5 text-slate-400 hover:text-rose-600 hover:bg-rose-50 rounded-md transition-colors"
                                title="Delete Party Record"
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

              {/* Table Footer Count */}
              <div className="py-2.5 px-4 bg-slate-50 border-t border-slate-200 text-xs text-slate-500 font-medium flex items-center justify-between">
                <span>Showing {filteredParties.length} of {parties.length} parties</span>
                <span className="text-[11px] text-slate-400">Master Shipper & Receiver Database</span>
              </div>
            </div>
          )}
        </div>
      )}

      {/* CREATE / EDIT PARTY MODAL */}
      {isCreateModalOpen && (
        <Modal
          isOpen={isCreateModalOpen}
          onClose={() => setIsCreateModalOpen(false)}
          title={editingParty ? 'Edit Company / Party Details' : 'Add New Company / Party'}
          size="lg"
        >
          <form onSubmit={handleSaveParty} className="space-y-4">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
              {/* Party Name */}
              <div className="md:col-span-2">
                <label className="block text-xs font-bold text-slate-700 mb-1">
                  Company / Party Name <span className="text-rose-500">*</span>
                </label>
                <input
                  type="text"
                  required
                  value={formData.name}
                  onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                  placeholder="e.g. ADVIK AUTOCOMP PVT LTD"
                  className="w-full px-3 py-2 text-xs bg-white border border-slate-300 rounded-lg font-bold text-slate-900 focus:ring-2 focus:ring-setu-600"
                />
              </div>

              {/* Party Role */}
              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1">
                  Party Role
                </label>
                <div className="w-full px-3 py-2 text-xs bg-slate-100 border border-slate-200 rounded-lg font-bold text-emerald-800 flex items-center justify-between">
                  <span>Shipper & Receiver (Both)</span>
                  <span className="text-[10px] text-slate-500 font-normal">Active for origin & destination</span>
                </div>
              </div>

              {/* GSTIN */}
              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1">GSTIN Number</label>
                <input
                  type="text"
                  value={formData.gstin}
                  onChange={(e) => setFormData({ ...formData, gstin: e.target.value.toUpperCase() })}
                  placeholder="e.g. 29AASCA8132C1ZJ"
                  className="w-full px-3 py-2 text-xs font-mono font-bold bg-white border border-slate-300 rounded-lg text-slate-900"
                />
              </div>

              {/* City / Location */}
              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1">
                  City / Location <span className="text-rose-500">*</span>
                </label>
                <input
                  type="text"
                  required
                  value={formData.city}
                  onChange={(e) => setFormData({ ...formData, city: e.target.value })}
                  placeholder="e.g. Hobli, Bangalore, Pune..."
                  className="w-full px-3 py-2 text-xs bg-white border border-slate-300 rounded-lg font-semibold text-slate-900"
                />
              </div>

              {/* State */}
              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1">State</label>
                <input
                  type="text"
                  value={formData.state}
                  onChange={(e) => setFormData({ ...formData, state: e.target.value })}
                  placeholder="e.g. Karnataka, Maharashtra..."
                  className="w-full px-3 py-2 text-xs bg-white border border-slate-300 rounded-lg font-semibold text-slate-900"
                />
              </div>

              {/* Pincode */}
              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1">Pincode</label>
                <input
                  type="text"
                  value={formData.pin}
                  onChange={(e) => setFormData({ ...formData, pin: e.target.value })}
                  placeholder="e.g. 563133"
                  className="w-full px-3 py-2 text-xs font-mono font-bold bg-white border border-slate-300 rounded-lg text-slate-900"
                />
              </div>

              {/* Contact Phone */}
              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1">Phone / Mobile</label>
                <input
                  type="text"
                  value={formData.phone}
                  onChange={(e) => setFormData({ ...formData, phone: e.target.value })}
                  placeholder="e.g. +91 9876543210"
                  className="w-full px-3 py-2 text-xs bg-white border border-slate-300 rounded-lg font-semibold text-slate-900"
                />
              </div>

              {/* Email Address */}
              <div>
                <div className="flex items-center justify-between mb-1">
                  <label className="block text-xs font-bold text-slate-700">
                    Email Address <span className="font-normal text-slate-400 text-[11px]">(Optional)</span>
                  </label>
                  {Boolean(formData.email) && (
                    <button
                      type="button"
                      onClick={() => setFormData({ ...formData, email: '' })}
                      className="text-[10px] font-semibold text-rose-500 hover:text-rose-600 transition-colors"
                    >
                      Clear Email
                    </button>
                  )}
                </div>
                <input
                  type="email"
                  value={formData.email}
                  onChange={(e) => setFormData({ ...formData, email: e.target.value })}
                  placeholder="e.g. accounts@company.com (leave empty if none)"
                  className="w-full px-3 py-2 text-xs bg-white border border-slate-300 rounded-lg font-medium text-slate-900"
                />
              </div>

              {/* Full Address */}
              <div className="md:col-span-2">
                <label className="block text-xs font-bold text-slate-700 mb-1">Full Street Address</label>
                <textarea
                  rows={2}
                  value={formData.address}
                  onChange={(e) => setFormData({ ...formData, address: e.target.value })}
                  placeholder="Street, plot no., industrial area, landmark..."
                  className="w-full px-3 py-2 text-xs bg-white border border-slate-300 rounded-lg font-medium text-slate-900"
                />
              </div>

              {/* Update Past Shipments Checkbox (Only on Edit) */}
              {editingParty && (
                <div className="md:col-span-2 bg-slate-50 p-3 rounded-lg border border-slate-200">
                  <label className="flex items-start gap-2 cursor-pointer">
                    <input
                      type="checkbox"
                      checked={formData.updatePastShipments}
                      onChange={(e) => setFormData({ ...formData, updatePastShipments: e.target.checked })}
                      className="mt-0.5 rounded text-setu-600 focus:ring-setu-600"
                    />
                    <div>
                      <span className="text-xs font-bold text-slate-800 block">
                        Synchronize past shipments with this standardized address
                      </span>
                      <span className="text-[11px] text-slate-500 block">
                        Updates previous Consignment Notes matching "{editingParty.name}" to use this new address and details.
                      </span>
                    </div>
                  </label>
                </div>
              )}
            </div>

            <div className="flex items-center justify-end gap-2 pt-3 border-t border-slate-200">
              <button
                type="button"
                onClick={() => setIsCreateModalOpen(false)}
                className="px-4 py-2 text-xs font-semibold text-slate-700 hover:bg-slate-100 rounded-lg transition-colors"
              >
                Cancel
              </button>
              <button
                type="submit"
                disabled={isSubmitting}
                className="px-4 py-2 text-xs font-bold text-white bg-setu-600 hover:bg-setu-700 rounded-lg shadow-xs transition-all disabled:opacity-50"
              >
                {isSubmitting ? 'Saving...' : editingParty ? 'Save Changes' : 'Add Company to Directory'}
              </button>
            </div>
          </form>
        </Modal>
      )}

      {/* DELETE CONFIRMATION MODAL */}
      {deleteTarget && (
        <Modal
          isOpen={Boolean(deleteTarget)}
          onClose={() => setDeleteTarget(null)}
          title="Delete Party Record"
          size="md"
        >
          <div className="space-y-4">
            <div className="flex items-start gap-3">
              <div className="w-10 h-10 rounded-full bg-rose-100 text-rose-600 flex items-center justify-center shrink-0">
                <Trash2 className="w-5 h-5" />
              </div>
              <div className="space-y-1">
                <div className="font-bold text-sm text-slate-900">
                  Delete "{deleteTarget.name}"?
                </div>
                <p className="text-xs text-slate-500 leading-relaxed">
                  This will remove this company from the Consignor & Consignee autocomplete suggestions. This is safe and helps clean up messy, duplicate records. Past shipments will remain intact.
                </p>
              </div>
            </div>

            <div className="flex items-center justify-end gap-2 pt-3 border-t border-slate-100">
              <button
                type="button"
                onClick={() => setDeleteTarget(null)}
                className="px-4 py-2 text-xs font-semibold text-slate-700 hover:bg-slate-100 rounded-lg transition-colors"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={handleDeleteParty}
                disabled={isSubmitting}
                className="px-4 py-2 text-xs font-bold text-white bg-rose-600 hover:bg-rose-700 rounded-lg shadow-xs transition-all disabled:opacity-50"
              >
                {isSubmitting ? 'Deleting...' : 'Confirm Delete'}
              </button>
            </div>
          </div>
        </Modal>
      )}

      {/* SMART MERGE MODAL */}
      {mergeCluster && (
        <Modal
          isOpen={Boolean(mergeCluster)}
          onClose={() => setMergeCluster(null)}
          title="Merge Duplicate Company Variations"
          size="lg"
        >
          <div className="space-y-4">
            <div className="p-3 bg-amber-50 border border-amber-200 rounded-lg text-amber-900 text-xs">
              <span className="font-bold block mb-0.5">Choose the Master Record to Keep:</span>
              <span>All other duplicate variations in this cluster will be removed. Past shipments referencing any duplicate names will be safely updated to the master name.</span>
            </div>

            <div className="space-y-2">
              {mergeCluster.records.map((rec) => {
                const recId = rec.id || rec._id;
                const isSelected = selectedMasterId === recId;
                return (
                  <div
                    key={recId}
                    onClick={() => setSelectedMasterId(recId)}
                    className={`p-3 rounded-xl border cursor-pointer transition-all flex items-start justify-between gap-3 ${
                      isSelected
                        ? 'bg-setu-50/80 border-setu-600 ring-2 ring-setu-600/20'
                        : 'bg-white border-slate-200 hover:bg-slate-50'
                    }`}
                  >
                    <div className="space-y-1">
                      <div className="flex items-center gap-2">
                        <span className="font-bold text-slate-900 text-sm">{rec.name}</span>
                        {isSelected && (
                          <span className="px-2 py-0.5 rounded-full text-[10px] font-extrabold bg-setu-600 text-white">
                            Master to Keep
                          </span>
                        )}
                      </div>
                      <div className="text-xs text-slate-500 flex items-center gap-2">
                        <span className="font-medium">{rec.city || 'No City'}</span>
                        {rec.pin && <span className="font-mono text-slate-400">({rec.pin})</span>}
                        {rec.gstin && <span className="font-mono text-slate-600">GST: {rec.gstin}</span>}
                      </div>
                      {rec.address && (
                        <div className="text-[11px] text-slate-400 truncate max-w-lg">{rec.address}</div>
                      )}
                    </div>

                    <div className="shrink-0 mt-1">
                      <input
                        type="radio"
                        checked={isSelected}
                        onChange={() => setSelectedMasterId(recId)}
                        className="text-setu-600 focus:ring-setu-600"
                      />
                    </div>
                  </div>
                );
              })}
            </div>

            <div className="bg-slate-50 p-3 rounded-lg border border-slate-200">
              <label className="flex items-center gap-2 cursor-pointer">
                <input
                  type="checkbox"
                  checked={updatePastShipmentsOnMerge}
                  onChange={(e) => setUpdatePastShipmentsOnMerge(e.target.checked)}
                  className="rounded text-setu-600 focus:ring-setu-600"
                />
                <span className="text-xs font-bold text-slate-800">
                  Update past shipments that used duplicate names with master details
                </span>
              </label>
            </div>

            <div className="flex items-center justify-end gap-2 pt-3 border-t border-slate-200">
              <button
                type="button"
                onClick={() => setMergeCluster(null)}
                className="px-4 py-2 text-xs font-semibold text-slate-700 hover:bg-slate-100 rounded-lg transition-colors"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={handleExecuteMerge}
                disabled={isSubmitting || !selectedMasterId}
                className="inline-flex items-center gap-1.5 px-4 py-2 text-xs font-bold text-white bg-amber-600 hover:bg-amber-700 rounded-lg shadow-xs transition-all disabled:opacity-50"
              >
                <Sparkles className="w-3.5 h-3.5" />
                <span>{isSubmitting ? 'Merging...' : 'Merge & Clean Duplicates'}</span>
              </button>
            </div>
          </div>
        </Modal>
      )}
    </div>
  );
};
