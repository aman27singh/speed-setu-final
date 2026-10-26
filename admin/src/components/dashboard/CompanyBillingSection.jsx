import React, { useState, useMemo, useRef, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { formatINR, formatNumber } from '../../utils/formatters';
import { StatusBadge } from '../common/StatusBadge';
import {
  Building2,
  Truck,
  CheckCircle2,
  Clock,
  AlertCircle,
  CreditCard,
  DollarSign,
  Search,
  ChevronRight,
  X,
  FileCheck,
  FileText,
  ExternalLink,
  PlusCircle,
  ArrowRight,
  Filter,
  Receipt
} from 'lucide-react';

export const CompanyBillingSection = ({ companies = [] }) => {
  const navigate = useNavigate();
  const detailRef = useRef(null);

  const [companySearch, setCompanySearch] = useState('');
  const [filterType, setFilterType] = useState('all'); // 'all', 'pending_balance', 'unbilled_shipments'
  const [selectedCompanyId, setSelectedCompanyId] = useState(null);

  // Drill-down filter tab: 'all', 'bills_made', 'bills_not_made', 'invoices'
  const [shipmentTab, setShipmentTab] = useState('all');
  const [shipmentSearch, setShipmentSearch] = useState('');

  // Overall totals across all companies
  const overallTotals = useMemo(() => {
    let totalPending = 0;
    let totalShipments = 0;
    let totalBillsMade = 0;
    let totalBillsNotMade = 0;

    companies.forEach((c) => {
      totalPending += c.pendingAmount || 0;
      totalShipments += c.totalShipments || 0;
      totalBillsMade += c.billsMade || 0;
      totalBillsNotMade += c.billsNotMade || 0;
    });

    return { totalPending, totalShipments, totalBillsMade, totalBillsNotMade };
  }, [companies]);

  // Filtered companies list
  const filteredCompanies = useMemo(() => {
    const q = companySearch.toLowerCase().trim();
    return companies.filter((c) => {
      const matchSearch =
        !q ||
        (c.companyName || '').toLowerCase().includes(q) ||
        (c.companyCode || '').toLowerCase().includes(q) ||
        (c.gstin || '').toLowerCase().includes(q);

      if (!matchSearch) return false;

      if (filterType === 'pending_balance') {
        return (c.pendingAmount || 0) > 0;
      }
      if (filterType === 'unbilled_shipments') {
        return (c.billsNotMade || 0) > 0;
      }
      return true;
    });
  }, [companies, companySearch, filterType]);

  // Active selected company object
  const selectedCompany = useMemo(() => {
    if (!selectedCompanyId) return null;
    return companies.find((c) => c.id === selectedCompanyId) || null;
  }, [companies, selectedCompanyId]);

  // Automatically scroll down to the detail panel when a company is selected
  useEffect(() => {
    if (selectedCompanyId && detailRef.current) {
      setTimeout(() => {
        detailRef.current?.scrollIntoView({ behavior: 'smooth', block: 'start' });
      }, 100);
    }
  }, [selectedCompanyId]);

  // Filtered shipments for the selected company
  const filteredCompanyShipments = useMemo(() => {
    if (!selectedCompany) return [];
    let list = selectedCompany.shipments || [];

    if (shipmentTab === 'bills_made') {
      list = list.filter((s) => s.isBillMade);
    } else if (shipmentTab === 'bills_not_made') {
      list = list.filter((s) => !s.isBillMade);
    }

    const sq = shipmentSearch.toLowerCase().trim();
    if (sq) {
      list = list.filter((s) => {
        return (
          (s.cnNumber || '').toLowerCase().includes(sq) ||
          (s.origin || '').toLowerCase().includes(sq) ||
          (s.destination || '').toLowerCase().includes(sq) ||
          (s.invoiceNumber || '').toLowerCase().includes(sq) ||
          (s.status || '').toLowerCase().includes(sq)
        );
      });
    }

    return list;
  }, [selectedCompany, shipmentTab, shipmentSearch]);

  const handleSelectCompany = (companyId) => {
    if (selectedCompanyId === companyId) {
      // Toggle off if already selected
      setSelectedCompanyId(null);
    } else {
      setSelectedCompanyId(companyId);
      setShipmentTab('all');
      setShipmentSearch('');
    }
  };

  return (
    <div className="space-y-4">
      {/* SECTION HEADER & CONTROL BAR */}
      <div className="bg-white border border-slate-200 rounded-xl p-4 sm:p-5 shadow-xs">
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-3 pb-3 border-b border-slate-100">
          <div>
            <div className="flex items-center gap-2">
              <div className="p-2 bg-setu-50 text-setu-600 rounded-lg">
                <Building2 className="w-5 h-5 text-setu-600" />
              </div>
              <div>
                <h2 className="text-base sm:text-lg font-bold text-slate-900 tracking-tight">
                  Client Billing Accounts & Outstanding Receivables
                </h2>
                <p className="text-xs text-slate-500">
                  Select any client company to view its shipment billing breakdown (Bills Made vs Not Made) and pending payment amounts
                </p>
              </div>
            </div>
          </div>

          {/* Quick Stats Pill */}
          <div className="flex flex-wrap items-center gap-2 text-xs">
            <span className="px-2.5 py-1 bg-slate-100 text-slate-700 font-semibold rounded-md border border-slate-200">
              {companies.length} Total Clients
            </span>
            <span className="px-2.5 py-1 bg-emerald-50 text-emerald-700 font-semibold rounded-md border border-emerald-200">
              {overallTotals.totalBillsMade} Bills Made
            </span>
            <span className="px-2.5 py-1 bg-amber-50 text-amber-800 font-semibold rounded-md border border-amber-200">
              {overallTotals.totalBillsNotMade} Bills Not Made
            </span>
            <span className="px-2.5 py-1 bg-rose-50 text-rose-700 font-bold rounded-md border border-rose-200">
              {formatINR(overallTotals.totalPending)} Total Pending
            </span>
          </div>
        </div>

        {/* SEARCH & FILTERS FOR COMPANY BOXES */}
        <div className="pt-3 flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-3">
          <div className="relative flex-1 max-w-md">
            <Search className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2 pointer-events-none" />
            <input
              type="text"
              value={companySearch}
              onChange={(e) => setCompanySearch(e.target.value)}
              placeholder="Search company by name, code or GSTIN..."
              className="w-full pl-9 pr-3 py-1.5 text-xs bg-slate-50 border border-slate-200 rounded-lg focus:outline-hidden focus:ring-2 focus:ring-setu-500 focus:bg-white transition-all text-slate-900 placeholder:text-slate-400"
            />
            {companySearch && (
              <button
                onClick={() => setCompanySearch('')}
                className="absolute right-2.5 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600"
              >
                <X className="w-3.5 h-3.5" />
              </button>
            )}
          </div>

          {/* Filter Type Pills */}
          <div className="flex items-center gap-1.5 text-xs">
            <button
              onClick={() => setFilterType('all')}
              className={`px-3 py-1.5 rounded-lg font-medium transition-colors ${
                filterType === 'all'
                  ? 'bg-setu-600 text-white shadow-xs'
                  : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
              }`}
            >
              All ({companies.length})
            </button>
            <button
              onClick={() => setFilterType('pending_balance')}
              className={`px-3 py-1.5 rounded-lg font-medium transition-colors ${
                filterType === 'pending_balance'
                  ? 'bg-rose-600 text-white shadow-xs'
                  : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
              }`}
            >
              Pending Balance ({companies.filter((c) => (c.pendingAmount || 0) > 0).length})
            </button>
            <button
              onClick={() => setFilterType('unbilled_shipments')}
              className={`px-3 py-1.5 rounded-lg font-medium transition-colors ${
                filterType === 'unbilled_shipments'
                  ? 'bg-amber-600 text-white shadow-xs'
                  : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
              }`}
            >
              Bills Not Made ({companies.filter((c) => (c.billsNotMade || 0) > 0).length})
            </button>
          </div>
        </div>
      </div>

      {/* 1. COMPANY BOXES GRID */}
      {filteredCompanies.length === 0 ? (
        <div className="bg-white border border-slate-200 rounded-xl p-8 text-center">
          <Building2 className="w-10 h-10 text-slate-300 mx-auto mb-2" />
          <p className="text-sm font-semibold text-slate-700">No client companies found</p>
          <p className="text-xs text-slate-400 mt-1">
            {companySearch ? 'Try adjusting your search criteria' : 'Create shipments or invoices to see client billing accounts'}
          </p>
        </div>
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-3.5 sm:gap-4">
          {filteredCompanies.map((comp) => {
            const isSelected = selectedCompanyId === comp.id;
            const billedPercent =
              comp.totalShipments > 0
                ? Math.round((comp.billsMade / comp.totalShipments) * 100)
                : 0;

            return (
              <div
                key={comp.id}
                onClick={() => handleSelectCompany(comp.id)}
                className={`group relative bg-white border rounded-xl p-4 cursor-pointer transition-all duration-200 hover:shadow-md ${
                  isSelected
                    ? 'border-setu-600 ring-2 ring-setu-500/30 bg-blue-50/20 shadow-md'
                    : 'border-slate-200 hover:border-setu-300'
                }`}
              >
                {/* Active Indicator Pin */}
                {isSelected && (
                  <div className="absolute top-2.5 right-2.5 flex items-center gap-1 px-2 py-0.5 bg-setu-600 text-white rounded-full text-[10px] font-bold shadow-xs">
                    <span className="w-1.5 h-1.5 rounded-full bg-white animate-pulse" />
                    Selected
                  </div>
                )}

                {/* Company Name & Code */}
                <div className="pr-16 mb-2.5">
                  <span className="inline-block px-1.5 py-0.5 text-[10px] font-bold uppercase rounded bg-slate-100 text-slate-700 border border-slate-200 mb-1">
                    {comp.companyCode || 'CLIENT'}
                  </span>
                  <h3 className="text-sm font-bold text-slate-900 group-hover:text-setu-600 transition-colors line-clamp-1">
                    {comp.companyName}
                  </h3>
                </div>

                {/* Pending Amount to Pay Box */}
                <div
                  className={`p-2.5 rounded-lg mb-3 border ${
                    comp.pendingAmount > 0
                      ? 'bg-rose-50/80 border-rose-200 text-rose-900'
                      : 'bg-emerald-50/80 border-emerald-200 text-emerald-900'
                  }`}
                >
                  <div className="flex items-center justify-between">
                    <span className="text-[11px] font-semibold text-slate-600 flex items-center gap-1">
                      {comp.pendingAmount > 0 ? (
                        <AlertCircle className="w-3.5 h-3.5 text-rose-600" />
                      ) : (
                        <CheckCircle2 className="w-3.5 h-3.5 text-emerald-600" />
                      )}
                      Pending To Pay:
                    </span>
                    <span
                      className={`text-sm font-bold font-mono ${
                        comp.pendingAmount > 0 ? 'text-rose-700' : 'text-emerald-700'
                      }`}
                    >
                      {formatINR(comp.pendingAmount || 0)}
                    </span>
                  </div>
                  {comp.pendingAmount > 0 ? (
                    <p className="text-[10px] text-rose-600 mt-0.5">
                      Company has to pay this pending balance
                    </p>
                  ) : (
                    <p className="text-[10px] text-emerald-600 mt-0.5">
                      All invoices settled & clear
                    </p>
                  )}
                </div>

                {/* Micro Stats: Total Shipments, Bills Made, Bills Not Made */}
                <div className="grid grid-cols-3 gap-1.5 text-center mb-3">
                  <div className="bg-slate-50 border border-slate-100 rounded-md p-1.5">
                    <span className="block text-[10px] font-medium text-slate-500">Total</span>
                    <span className="block text-xs font-bold text-slate-800">{comp.totalShipments}</span>
                  </div>
                  <div className="bg-emerald-50/60 border border-emerald-100 rounded-md p-1.5">
                    <span className="block text-[10px] font-medium text-emerald-700">Bills Made</span>
                    <span className="block text-xs font-bold text-emerald-800">{comp.billsMade}</span>
                  </div>
                  <div className="bg-amber-50/60 border border-amber-100 rounded-md p-1.5">
                    <span className="block text-[10px] font-medium text-amber-800">Not Made</span>
                    <span className="block text-xs font-bold text-amber-900">{comp.billsNotMade}</span>
                  </div>
                </div>

                {/* Progress bar of bills made */}
                <div className="space-y-1">
                  <div className="flex items-center justify-between text-[10px] text-slate-500 font-medium">
                    <span>Billing Progress</span>
                    <span>{billedPercent}% Billed</span>
                  </div>
                  <div className="w-full bg-slate-100 rounded-full h-1.5 overflow-hidden">
                    <div
                      className={`h-full transition-all duration-300 ${
                        billedPercent === 100
                          ? 'bg-emerald-500'
                          : billedPercent > 0
                          ? 'bg-setu-500'
                          : 'bg-slate-300'
                      }`}
                      style={{ width: `${billedPercent}%` }}
                    />
                  </div>
                </div>

                {/* Card Action Hint Footer */}
                <div className="mt-3 pt-2.5 border-t border-slate-100 flex items-center justify-between text-[11px] font-semibold text-setu-600 group-hover:text-setu-700">
                  <span>{isSelected ? 'Click to close details' : 'Click to show details'}</span>
                  <ChevronRight
                    className={`w-3.5 h-3.5 transition-transform duration-200 ${
                      isSelected ? 'rotate-90 text-setu-600' : 'group-hover:translate-x-0.5'
                    }`}
                  />
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* 2. COMPANY DETAIL DRILL-DOWN WORKSPACE (SHOWS WHEN A COMPANY BOX IS CLICKED) */}
      {selectedCompany && (
        <div
          ref={detailRef}
          className="bg-white border-2 border-setu-500/50 rounded-2xl shadow-lg p-4 sm:p-6 space-y-6 animate-fade-in"
        >
          {/* Header of selected company */}
          <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4 pb-4 border-b border-slate-200">
            <div className="flex items-start gap-3">
              <div className="p-3 bg-setu-600 text-white rounded-xl shadow-xs">
                <Building2 className="w-6 h-6" />
              </div>
              <div>
                <div className="flex flex-wrap items-center gap-2">
                  <h2 className="text-lg sm:text-xl font-bold text-slate-900">
                    {selectedCompany.companyName}
                  </h2>
                  <span className="px-2 py-0.5 text-xs font-bold rounded bg-slate-100 text-slate-700 border border-slate-200">
                    {selectedCompany.companyCode}
                  </span>
                  {selectedCompany.gstin && selectedCompany.gstin !== '-' && (
                    <span className="px-2 py-0.5 text-xs font-mono font-medium rounded bg-blue-50 text-setu-700 border border-blue-200">
                      GSTIN: {selectedCompany.gstin}
                    </span>
                  )}
                </div>
                <p className="text-xs text-slate-500 mt-1">
                  Payment Terms: <span className="font-semibold text-slate-700">{selectedCompany.paymentTerms || 'Net 30'}</span>
                  {selectedCompany.city && selectedCompany.city !== '-' ? ` • Location: ${selectedCompany.city}, ${selectedCompany.state}` : ''}
                </p>
              </div>
            </div>

            {/* Quick Actions */}
            <div className="flex items-center gap-2 self-start lg:self-auto">
              <button
                onClick={() => navigate('/admin/billing/create')}
                className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold bg-setu-600 text-white rounded-lg hover:bg-setu-700 transition-colors shadow-xs"
              >
                <PlusCircle className="w-3.5 h-3.5" />
                <span>Create Invoice</span>
              </button>
              <button
                onClick={() => navigate(`/admin/companies/${selectedCompany.id}`)}
                className="inline-flex items-center gap-1 px-3 py-1.5 text-xs font-semibold bg-white border border-slate-200 text-slate-700 rounded-lg hover:bg-slate-50 transition-colors"
              >
                <span>Full Profile</span>
                <ExternalLink className="w-3.5 h-3.5" />
              </button>
              <button
                onClick={() => setSelectedCompanyId(null)}
                className="p-1.5 text-slate-400 hover:text-slate-600 rounded-lg hover:bg-slate-100 transition-colors"
                title="Close Company Workspace"
              >
                <X className="w-5 h-5" />
              </button>
            </div>
          </div>

          {/* 3. AGAIN BOXES: DETAILED STAT BOXES FOR THIS COMPANY */}
          <div>
            <div className="flex items-center justify-between mb-2.5">
              <h3 className="text-xs font-bold uppercase tracking-wider text-slate-500">
                Company Performance & Billing Stat Boxes
              </h3>
              <span className="text-[11px] text-slate-400">
                Click any box to quickly filter shipments below
              </span>
            </div>

            <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-3">
              {/* Box 1: Total Shipments */}
              <div
                onClick={() => setShipmentTab('all')}
                className={`p-3.5 rounded-xl border cursor-pointer transition-all ${
                  shipmentTab === 'all'
                    ? 'border-slate-800 bg-slate-900 text-white shadow-sm'
                    : 'border-slate-200 bg-slate-50/70 hover:border-slate-300 text-slate-800'
                }`}
              >
                <div className="flex items-center justify-between mb-1">
                  <span className={`text-[11px] font-semibold ${shipmentTab === 'all' ? 'text-slate-300' : 'text-slate-500'}`}>
                    Total Shipments
                  </span>
                  <Truck className={`w-4 h-4 ${shipmentTab === 'all' ? 'text-slate-300' : 'text-slate-400'}`} />
                </div>
                <div className="text-xl sm:text-2xl font-bold font-mono">
                  {selectedCompany.totalShipments}
                </div>
                <p className={`text-[10px] mt-1 ${shipmentTab === 'all' ? 'text-slate-300' : 'text-slate-500'}`}>
                  All consigned LRs
                </p>
              </div>

              {/* Box 2: Bills Made */}
              <div
                onClick={() => setShipmentTab('bills_made')}
                className={`p-3.5 rounded-xl border cursor-pointer transition-all ${
                  shipmentTab === 'bills_made'
                    ? 'border-emerald-600 bg-emerald-600 text-white shadow-sm'
                    : 'border-emerald-200 bg-emerald-50/70 hover:border-emerald-300 text-emerald-950'
                }`}
              >
                <div className="flex items-center justify-between mb-1">
                  <span className={`text-[11px] font-semibold ${shipmentTab === 'bills_made' ? 'text-emerald-100' : 'text-emerald-700'}`}>
                    Bills Made
                  </span>
                  <CheckCircle2 className={`w-4 h-4 ${shipmentTab === 'bills_made' ? 'text-emerald-100' : 'text-emerald-600'}`} />
                </div>
                <div className="text-xl sm:text-2xl font-bold font-mono">
                  {selectedCompany.billsMade}
                </div>
                <p className={`text-[10px] mt-1 ${shipmentTab === 'bills_made' ? 'text-emerald-100' : 'text-emerald-600'}`}>
                  Invoiced shipments
                </p>
              </div>

              {/* Box 3: Bills Not Made */}
              <div
                onClick={() => setShipmentTab('bills_not_made')}
                className={`p-3.5 rounded-xl border cursor-pointer transition-all ${
                  shipmentTab === 'bills_not_made'
                    ? 'border-amber-600 bg-amber-600 text-white shadow-sm'
                    : 'border-amber-200 bg-amber-50/70 hover:border-amber-300 text-amber-950'
                }`}
              >
                <div className="flex items-center justify-between mb-1">
                  <span className={`text-[11px] font-semibold ${shipmentTab === 'bills_not_made' ? 'text-amber-100' : 'text-amber-800'}`}>
                    Bills Not Made
                  </span>
                  <Clock className={`w-4 h-4 ${shipmentTab === 'bills_not_made' ? 'text-amber-100' : 'text-amber-600'}`} />
                </div>
                <div className="text-xl sm:text-2xl font-bold font-mono">
                  {selectedCompany.billsNotMade}
                </div>
                <p className={`text-[10px] mt-1 ${shipmentTab === 'bills_not_made' ? 'text-amber-100' : 'text-amber-700'}`}>
                  Pending bill generation
                </p>
              </div>

              {/* Box 4: Amount Pending (Company Must Pay) */}
              <div
                onClick={() => setShipmentTab('invoices')}
                className={`p-3.5 rounded-xl border cursor-pointer transition-all ${
                  shipmentTab === 'invoices'
                    ? 'border-rose-600 bg-rose-600 text-white shadow-sm'
                    : selectedCompany.pendingAmount > 0
                    ? 'border-rose-300 bg-rose-50 hover:border-rose-400 text-rose-950'
                    : 'border-slate-200 bg-slate-50 text-slate-800'
                }`}
              >
                <div className="flex items-center justify-between mb-1">
                  <span
                    className={`text-[11px] font-bold ${
                      shipmentTab === 'invoices'
                        ? 'text-rose-100'
                        : selectedCompany.pendingAmount > 0
                        ? 'text-rose-700'
                        : 'text-slate-600'
                    }`}
                  >
                    Pending Amount
                  </span>
                  <AlertCircle
                    className={`w-4 h-4 ${
                      shipmentTab === 'invoices'
                        ? 'text-rose-100'
                        : selectedCompany.pendingAmount > 0
                        ? 'text-rose-600'
                        : 'text-slate-400'
                    }`}
                  />
                </div>
                <div className="text-base sm:text-lg font-bold font-mono truncate">
                  {formatINR(selectedCompany.pendingAmount)}
                </div>
                <p
                  className={`text-[10px] mt-1 line-clamp-1 ${
                    shipmentTab === 'invoices'
                      ? 'text-rose-100'
                      : selectedCompany.pendingAmount > 0
                      ? 'text-rose-600 font-semibold'
                      : 'text-slate-400'
                  }`}
                >
                  Amount company must pay
                </p>
              </div>

              {/* Box 5: Total Billed Amount */}
              <div
                onClick={() => setShipmentTab('invoices')}
                className="p-3.5 rounded-xl border border-blue-200 bg-blue-50/70 hover:border-blue-300 text-blue-950 cursor-pointer transition-all"
              >
                <div className="flex items-center justify-between mb-1">
                  <span className="text-[11px] font-semibold text-blue-700">Total Billed</span>
                  <CreditCard className="w-4 h-4 text-blue-600" />
                </div>
                <div className="text-base sm:text-lg font-bold font-mono truncate text-blue-900">
                  {formatINR(selectedCompany.totalBilledAmount)}
                </div>
                <p className="text-[10px] text-blue-600 mt-1">All invoices issued</p>
              </div>

              {/* Box 6: Total Paid / Collected */}
              <div
                onClick={() => setShipmentTab('invoices')}
                className="p-3.5 rounded-xl border border-indigo-200 bg-indigo-50/70 hover:border-indigo-300 text-indigo-950 cursor-pointer transition-all"
              >
                <div className="flex items-center justify-between mb-1">
                  <span className="text-[11px] font-semibold text-indigo-700">Total Paid</span>
                  <DollarSign className="w-4 h-4 text-indigo-600" />
                </div>
                <div className="text-base sm:text-lg font-bold font-mono truncate text-indigo-900">
                  {formatINR(selectedCompany.totalPaidAmount)}
                </div>
                <p className="text-[10px] text-indigo-600 mt-1">Collected revenue</p>
              </div>
            </div>
          </div>

          {/* 4. SHIPMENTS & INVOICES TAB NAVIGATION */}
          <div className="space-y-4 pt-2">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b border-slate-200 pb-2">
              <div className="flex items-center gap-2 overflow-x-auto">
                <button
                  onClick={() => setShipmentTab('all')}
                  className={`px-3 py-1.5 text-xs font-semibold rounded-lg transition-colors shrink-0 ${
                    shipmentTab === 'all'
                      ? 'bg-setu-600 text-white'
                      : 'text-slate-600 hover:bg-slate-100'
                  }`}
                >
                  All Shipments ({selectedCompany.shipments.length})
                </button>
                <button
                  onClick={() => setShipmentTab('bills_made')}
                  className={`px-3 py-1.5 text-xs font-semibold rounded-lg transition-colors shrink-0 ${
                    shipmentTab === 'bills_made'
                      ? 'bg-emerald-600 text-white'
                      : 'text-emerald-700 bg-emerald-50 hover:bg-emerald-100'
                  }`}
                >
                  ✅ Bills Made ({selectedCompany.billsMade})
                </button>
                <button
                  onClick={() => setShipmentTab('bills_not_made')}
                  className={`px-3 py-1.5 text-xs font-semibold rounded-lg transition-colors shrink-0 ${
                    shipmentTab === 'bills_not_made'
                      ? 'bg-amber-600 text-white'
                      : 'text-amber-800 bg-amber-50 hover:bg-amber-100'
                  }`}
                >
                  ⏳ Bills Not Made ({selectedCompany.billsNotMade})
                </button>
                <button
                  onClick={() => setShipmentTab('invoices')}
                  className={`px-3 py-1.5 text-xs font-semibold rounded-lg transition-colors shrink-0 ${
                    shipmentTab === 'invoices'
                      ? 'bg-blue-600 text-white'
                      : 'text-blue-700 bg-blue-50 hover:bg-blue-100'
                  }`}
                >
                  📄 Invoices & Receivables ({selectedCompany.invoices.length})
                </button>
              </div>

              {/* Shipment Search */}
              {shipmentTab !== 'invoices' && (
                <div className="relative w-full sm:w-64">
                  <Search className="w-3.5 h-3.5 text-slate-400 absolute left-2.5 top-1/2 -translate-y-1/2 pointer-events-none" />
                  <input
                    type="text"
                    value={shipmentSearch}
                    onChange={(e) => setShipmentSearch(e.target.value)}
                    placeholder="Search CN, route, status..."
                    className="w-full pl-8 pr-3 py-1 text-xs bg-slate-50 border border-slate-200 rounded-lg focus:outline-hidden focus:ring-1 focus:ring-setu-500 text-slate-900 placeholder:text-slate-400"
                  />
                  {shipmentSearch && (
                    <button
                      onClick={() => setShipmentSearch('')}
                      className="absolute right-2 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600"
                    >
                      <X className="w-3 h-3" />
                    </button>
                  )}
                </div>
              )}
            </div>

            {/* TAB CONTENT A: SHIPMENTS LIST */}
            {shipmentTab !== 'invoices' && (
              <div className="overflow-x-auto border border-slate-200 rounded-xl">
                <table className="w-full text-left text-xs text-slate-600">
                  <thead className="bg-slate-50 border-b border-slate-200 text-[11px] font-bold text-slate-500 uppercase tracking-wider">
                    <tr>
                      <th className="py-2.5 px-3">CN Number</th>
                      <th className="py-2.5 px-3">Date</th>
                      <th className="py-2.5 px-3">Route</th>
                      <th className="py-2.5 px-3 text-right">Packages / Wt</th>
                      <th className="py-2.5 px-3 text-center">Bill Status</th>
                      <th className="py-2.5 px-3 text-right">Freight (₹)</th>
                      <th className="py-2.5 px-3">Status</th>
                      <th className="py-2.5 px-3">POD</th>
                      <th className="py-2.5 px-3 text-right">Action</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100">
                    {filteredCompanyShipments.length === 0 ? (
                      <tr>
                        <td colSpan={9} className="py-8 text-center text-slate-400">
                          No shipments found in this category for {selectedCompany.companyName}
                        </td>
                      </tr>
                    ) : (
                      filteredCompanyShipments.map((s) => (
                        <tr key={s.id} className="hover:bg-slate-50/80 transition-colors">
                          {/* CN Number */}
                          <td className="py-2.5 px-3 font-mono font-bold text-setu-600">
                            <span
                              onClick={() => navigate(`/admin/shipments/${s.cnNumber}`)}
                              className="hover:underline cursor-pointer"
                            >
                              {s.cnNumber}
                            </span>
                          </td>

                          {/* Date */}
                          <td className="py-2.5 px-3 whitespace-nowrap text-slate-500 text-[11px]">
                            {s.cnDate && s.cnDate.includes('T') ? s.cnDate.split('T')[0] : s.cnDate}
                          </td>

                          {/* Route */}
                          <td className="py-2.5 px-3 whitespace-nowrap">
                            <span className="font-medium text-slate-800">{s.origin}</span>
                            <span className="text-slate-400 mx-1">→</span>
                            <span className="font-medium text-slate-800">{s.destination}</span>
                          </td>

                          {/* Packages & Weight */}
                          <td className="py-2.5 px-3 text-right whitespace-nowrap">
                            <span className="font-semibold text-slate-800">{s.packages || 0} pkgs</span>
                            <span className="text-slate-400 ml-1">
                              ({s.chargeableWeight || s.actualWeight || 0} kg)
                            </span>
                          </td>

                          {/* Bill Status Box */}
                          <td className="py-2.5 px-3 text-center whitespace-nowrap">
                            {s.isBillMade ? (
                              <div className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[11px] font-semibold bg-emerald-50 text-emerald-700 border border-emerald-200">
                                <CheckCircle2 className="w-3 h-3 text-emerald-600" />
                                <span>Bill Made</span>
                                {s.invoiceNumber && s.invoiceNumber !== 'Generated' && (
                                  <span
                                    onClick={(e) => {
                                      e.stopPropagation();
                                      if (s.invoiceId) {
                                        navigate(`/admin/billing/invoices/${s.invoiceId}`);
                                      } else {
                                        navigate('/admin/billing');
                                      }
                                    }}
                                    className="ml-0.5 underline font-mono text-[10px] text-emerald-800 cursor-pointer"
                                  >
                                    ({s.invoiceNumber})
                                  </span>
                                )}
                              </div>
                            ) : (
                              <div className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[11px] font-semibold bg-amber-50 text-amber-800 border border-amber-200">
                                <Clock className="w-3 h-3 text-amber-600" />
                                <span>Bill Not Made</span>
                              </div>
                            )}
                          </td>

                          {/* Freight */}
                          <td className="py-2.5 px-3 text-right font-mono font-bold text-slate-900 whitespace-nowrap">
                            {formatINR(s.freightAmount || 0)}
                          </td>

                          {/* Status */}
                          <td className="py-2.5 px-3 whitespace-nowrap">
                            <StatusBadge status={s.status || 'Booked'} />
                          </td>

                          {/* POD Status */}
                          <td className="py-2.5 px-3 whitespace-nowrap">
                            <StatusBadge status={s.podStatus || 'Pending'} />
                          </td>

                          {/* Actions */}
                          <td className="py-2.5 px-3 text-right whitespace-nowrap">
                            <div className="inline-flex items-center gap-1">
                              {!s.isBillMade && (
                                <button
                                  onClick={() => navigate(`/admin/billing/create?cn=${s.cnNumber}`)}
                                  className="px-2 py-0.5 text-[11px] font-semibold bg-setu-50 text-setu-700 border border-setu-200 rounded hover:bg-setu-600 hover:text-white transition-colors"
                                  title="Generate Invoice for this CN"
                                >
                                  + Bill
                                </button>
                              )}
                              <button
                                onClick={() => navigate(`/admin/shipments/${s.cnNumber}`)}
                                className="px-2 py-0.5 text-[11px] font-semibold bg-slate-100 text-slate-700 rounded hover:bg-slate-200 transition-colors"
                              >
                                View
                              </button>
                            </div>
                          </td>
                        </tr>
                      ))
                    )}
                  </tbody>
                </table>
              </div>
            )}

            {/* TAB CONTENT B: INVOICES & RECEIVABLES LIST */}
            {shipmentTab === 'invoices' && (
              <div className="overflow-x-auto border border-slate-200 rounded-xl">
                <table className="w-full text-left text-xs text-slate-600">
                  <thead className="bg-slate-50 border-b border-slate-200 text-[11px] font-bold text-slate-500 uppercase tracking-wider">
                    <tr>
                      <th className="py-2.5 px-3">Invoice #</th>
                      <th className="py-2.5 px-3">Date</th>
                      <th className="py-2.5 px-3">Due Date</th>
                      <th className="py-2.5 px-3 text-right">Invoice Amount</th>
                      <th className="py-2.5 px-3 text-right">Paid Amount</th>
                      <th className="py-2.5 px-3 text-right font-bold text-rose-700">Amount Pending (To Pay)</th>
                      <th className="py-2.5 px-3 text-center">Status</th>
                      <th className="py-2.5 px-3 text-right">Action</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100">
                    {(selectedCompany.invoices || []).length === 0 ? (
                      <tr>
                        <td colSpan={8} className="py-8 text-center text-slate-400">
                          No invoices generated yet for {selectedCompany.companyName}.
                        </td>
                      </tr>
                    ) : (
                      selectedCompany.invoices.map((inv) => {
                        const total = inv.grandTotal || inv.totalAmount || 0;
                        const paid = inv.paidAmount || 0;
                        const balance = typeof inv.balanceAmount === 'number'
                          ? inv.balanceAmount
                          : (inv.balanceDue !== undefined ? inv.balanceDue : Math.max(0, total - paid));

                        return (
                          <tr key={inv.id || inv.invoiceNumber} className="hover:bg-slate-50/80 transition-colors">
                            <td className="py-2.5 px-3 font-mono font-bold text-setu-600">
                              <span
                                onClick={() => navigate(`/admin/billing/invoices/${inv.id || inv.invoiceNumber}`)}
                                className="hover:underline cursor-pointer"
                              >
                                {inv.invoiceNumber || inv.id}
                              </span>
                            </td>
                            <td className="py-2.5 px-3 whitespace-nowrap text-slate-500 text-[11px]">
                              {inv.invoiceDate || inv.date || '-'}
                            </td>
                            <td className="py-2.5 px-3 whitespace-nowrap text-slate-500 text-[11px]">
                              {inv.dueDate || '-'}
                            </td>
                            <td className="py-2.5 px-3 text-right font-mono font-semibold text-slate-900">
                              {formatINR(total)}
                            </td>
                            <td className="py-2.5 px-3 text-right font-mono text-emerald-700 font-semibold">
                              {formatINR(paid)}
                            </td>
                            <td className="py-2.5 px-3 text-right font-mono font-bold text-rose-700">
                              {formatINR(balance)}
                            </td>
                            <td className="py-2.5 px-3 text-center">
                              <StatusBadge status={inv.status || (balance === 0 ? 'Paid' : 'Unpaid')} />
                            </td>
                            <td className="py-2.5 px-3 text-right">
                              <button
                                onClick={() => navigate(`/admin/billing/invoices/${inv.id || inv.invoiceNumber}`)}
                                className="inline-flex items-center gap-1 px-2.5 py-1 text-[11px] font-semibold text-setu-700 bg-setu-50 border border-setu-200 rounded hover:bg-setu-600 hover:text-white transition-colors"
                              >
                                <span>View</span>
                                <ExternalLink className="w-3 h-3" />
                              </button>
                            </td>
                          </tr>
                        );
                      })
                    )}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
};
