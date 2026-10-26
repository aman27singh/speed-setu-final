import React, { useState, useEffect, useMemo } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { dashboardService } from '../services/dashboardService';
import { formatINR, formatNumber } from '../utils/formatters';
import { PageHeader } from '../components/common/PageHeader';
import { StatusBadge } from '../components/common/StatusBadge';
import { LoadingState } from '../components/common/LoadingState';
import { ErrorState } from '../components/common/ErrorState';
import {
  Building2,
  Truck,
  CheckCircle2,
  Clock,
  AlertCircle,
  CreditCard,
  DollarSign,
  Search,
  ArrowLeft,
  ExternalLink,
  PlusCircle,
  X,
  FileCheck,
  Receipt,
  MapPin,
  Calendar
} from 'lucide-react';

export const CompanyBillingDetailPage = () => {
  const { id } = useParams();
  const navigate = useNavigate();

  const [company, setCompany] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  // Filter tabs: 'all', 'bills_made', 'bills_not_made', 'invoices'
  const [shipmentTab, setShipmentTab] = useState('all');
  const [searchQuery, setSearchQuery] = useState('');

  const fetchCompanyDetails = async () => {
    setLoading(true);
    setError(null);
    try {
      const data = await dashboardService.getCompanyBillingAccount(id);
      if (!data) {
        throw new Error(`Company billing account for '${id}' could not be found.`);
      }
      setCompany(data);
    } catch (err) {
      setError(err.message || 'Failed to load company billing records.');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchCompanyDetails();
  }, [id]);

  // Filtered shipments
  const filteredShipments = useMemo(() => {
    if (!company) return [];
    let list = company.shipments || [];

    if (shipmentTab === 'bills_made') {
      list = list.filter((s) => s.isBillMade);
    } else if (shipmentTab === 'bills_not_made') {
      list = list.filter((s) => !s.isBillMade);
    }

    const q = searchQuery.toLowerCase().trim();
    if (q) {
      list = list.filter((s) => {
        return (
          (s.cnNumber || '').toLowerCase().includes(q) ||
          (s.origin || '').toLowerCase().includes(q) ||
          (s.destination || '').toLowerCase().includes(q) ||
          (s.invoiceNumber || '').toLowerCase().includes(q) ||
          (s.status || '').toLowerCase().includes(q)
        );
      });
    }

    return list;
  }, [company, shipmentTab, searchQuery]);

  if (loading) {
    return <LoadingState message="Loading company billing accounts & shipment records..." />;
  }

  if (error || !company) {
    return (
      <div className="space-y-4">
        <button
          onClick={() => navigate('/admin/dashboard')}
          className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold bg-white border border-slate-200 text-slate-700 rounded-lg hover:bg-slate-50 transition-colors shadow-xs"
        >
          <ArrowLeft className="w-3.5 h-3.5" />
          <span>Back to Dashboard</span>
        </button>
        <ErrorState message={error || 'Company not found'} onRetry={fetchCompanyDetails} />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* 1. TOP HEADER & BREADCRUMBS */}
      <PageHeader
        title={company.companyName}
        description={`Client Billing Account (${company.companyCode}) — Shipment Billing Status & Pending Receivables`}
        breadcrumbs={['Speed Setu Admin', 'Dashboard', 'Company Billing', company.companyName]}
        actions={
          <div className="flex items-center gap-2">
            <button
              onClick={() => navigate('/admin/dashboard')}
              className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold bg-white border border-slate-200 text-slate-700 rounded-lg hover:bg-slate-50 transition-colors shadow-xs"
            >
              <ArrowLeft className="w-3.5 h-3.5" />
              <span>Back to Dashboard</span>
            </button>
            <button
              onClick={() => navigate(`/admin/billing/create?company=${encodeURIComponent(company.companyName)}`)}
              className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold bg-setu-600 text-white rounded-lg hover:bg-setu-700 transition-colors shadow-xs"
            >
              <PlusCircle className="w-3.5 h-3.5" />
              <span>Generate Invoice</span>
            </button>
            {company.id && (
              <button
                onClick={() => navigate(`/admin/companies/${company.id}`)}
                className="inline-flex items-center gap-1 px-3 py-1.5 text-xs font-semibold bg-slate-100 text-slate-700 rounded-lg hover:bg-slate-200 transition-colors"
              >
                <span>Full Profile</span>
                <ExternalLink className="w-3.5 h-3.5" />
              </button>
            )}
          </div>
        }
      />

      {/* 2. COMPANY PROFILE METADATA BANNER */}
      <div className="bg-white border border-slate-200 rounded-xl p-4 sm:p-5 shadow-xs flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div className="flex items-start gap-3.5">
          <div className="p-3 bg-setu-50 text-setu-600 rounded-xl border border-setu-100 shrink-0">
            <Building2 className="w-6 h-6 text-setu-600" />
          </div>
          <div>
            <div className="flex flex-wrap items-center gap-2">
              <h2 className="text-base sm:text-lg font-bold text-slate-900">
                {company.companyName}
              </h2>
              <span className="px-2 py-0.5 text-xs font-bold rounded bg-slate-100 text-slate-700 border border-slate-200">
                {company.companyCode}
              </span>
              {company.gstin && company.gstin !== '-' && (
                <span className="px-2 py-0.5 text-xs font-mono font-medium rounded bg-blue-50 text-setu-700 border border-blue-200">
                  GSTIN: {company.gstin}
                </span>
              )}
            </div>
            <p className="text-xs text-slate-500 mt-1 flex flex-wrap items-center gap-3">
              <span>Payment Terms: <strong className="text-slate-800">{company.paymentTerms || 'Net 30'}</strong></span>
              {company.city && company.city !== '-' && (
                <span className="flex items-center gap-1">
                  <MapPin className="w-3 h-3 text-slate-400" />
                  {company.city}, {company.state}
                </span>
              )}
            </p>
          </div>
        </div>

        {/* Quick Outstanding Highlight */}
        <div className="p-3 bg-slate-50 border border-slate-200 rounded-xl shrink-0 text-right">
          <span className="text-[11px] font-semibold text-slate-500 block">Total Outstanding to Pay</span>
          <span className={`text-lg sm:text-xl font-bold font-mono ${company.pendingAmount > 0 ? 'text-rose-600' : 'text-emerald-600'}`}>
            {formatINR(company.pendingAmount || 0)}
          </span>
        </div>
      </div>

      {/* 3. AGAIN BOXES: THE 6 DETAILED PERFORMANCE & BILLING STAT BOXES */}
      <div>
        <div className="flex items-center justify-between mb-3">
          <h3 className="text-xs font-bold text-slate-500 uppercase tracking-wider">
            Billing Accounts Overview & Stat Boxes
          </h3>
          <span className="text-[11px] text-slate-400">
            Click any box to filter the shipments or invoices list below
          </span>
        </div>

        <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-3 sm:gap-4">
          {/* Box 1: Total Shipments */}
          <div
            onClick={() => setShipmentTab('all')}
            className={`p-4 rounded-xl border cursor-pointer transition-all ${
              shipmentTab === 'all'
                ? 'border-slate-800 bg-slate-900 text-white shadow-md'
                : 'border-slate-200 bg-white hover:border-slate-300 text-slate-900 shadow-xs'
            }`}
          >
            <div className="flex items-center justify-between mb-1.5">
              <span className={`text-xs font-semibold ${shipmentTab === 'all' ? 'text-slate-300' : 'text-slate-500'}`}>
                Total Shipments
              </span>
              <Truck className={`w-4 h-4 ${shipmentTab === 'all' ? 'text-slate-300' : 'text-slate-400'}`} />
            </div>
            <div className="text-2xl font-bold font-mono">
              {company.totalShipments}
            </div>
            <p className={`text-[10px] mt-1 ${shipmentTab === 'all' ? 'text-slate-300' : 'text-slate-500'}`}>
              All booked LRs
            </p>
          </div>

          {/* Box 2: Bills Made */}
          <div
            onClick={() => setShipmentTab('bills_made')}
            className={`p-4 rounded-xl border cursor-pointer transition-all ${
              shipmentTab === 'bills_made'
                ? 'border-emerald-600 bg-emerald-600 text-white shadow-md'
                : 'border-emerald-200 bg-emerald-50/70 hover:border-emerald-300 text-emerald-950 shadow-xs'
            }`}
          >
            <div className="flex items-center justify-between mb-1.5">
              <span className={`text-xs font-semibold ${shipmentTab === 'bills_made' ? 'text-emerald-100' : 'text-emerald-700'}`}>
                Bills Made
              </span>
              <CheckCircle2 className={`w-4 h-4 ${shipmentTab === 'bills_made' ? 'text-emerald-100' : 'text-emerald-600'}`} />
            </div>
            <div className="text-2xl font-bold font-mono">
              {company.billsMade}
            </div>
            <p className={`text-[10px] mt-1 ${shipmentTab === 'bills_made' ? 'text-emerald-100' : 'text-emerald-600'}`}>
              Invoiced shipments
            </p>
          </div>

          {/* Box 3: Bills Not Made */}
          <div
            onClick={() => setShipmentTab('bills_not_made')}
            className={`p-4 rounded-xl border cursor-pointer transition-all ${
              shipmentTab === 'bills_not_made'
                ? 'border-amber-600 bg-amber-600 text-white shadow-md'
                : 'border-amber-200 bg-amber-50/70 hover:border-amber-300 text-amber-950 shadow-xs'
            }`}
          >
            <div className="flex items-center justify-between mb-1.5">
              <span className={`text-xs font-semibold ${shipmentTab === 'bills_not_made' ? 'text-amber-100' : 'text-amber-800'}`}>
                Bills Not Made
              </span>
              <Clock className={`w-4 h-4 ${shipmentTab === 'bills_not_made' ? 'text-amber-100' : 'text-amber-600'}`} />
            </div>
            <div className="text-2xl font-bold font-mono">
              {company.billsNotMade}
            </div>
            <p className={`text-[10px] mt-1 ${shipmentTab === 'bills_not_made' ? 'text-amber-100' : 'text-amber-700'}`}>
              Pending bill generation
            </p>
          </div>

          {/* Box 4: Pending Amount That Company Must Pay */}
          <div
            onClick={() => setShipmentTab('invoices')}
            className={`p-4 rounded-xl border cursor-pointer transition-all ${
              shipmentTab === 'invoices'
                ? 'border-rose-600 bg-rose-600 text-white shadow-md'
                : company.pendingAmount > 0
                ? 'border-rose-300 bg-rose-50 hover:border-rose-400 text-rose-950 shadow-xs'
                : 'border-slate-200 bg-white text-slate-800 shadow-xs'
            }`}
          >
            <div className="flex items-center justify-between mb-1.5">
              <span
                className={`text-xs font-bold ${
                  shipmentTab === 'invoices'
                    ? 'text-rose-100'
                    : company.pendingAmount > 0
                    ? 'text-rose-700'
                    : 'text-slate-600'
                }`}
              >
                Pending To Pay
              </span>
              <AlertCircle
                className={`w-4 h-4 ${
                  shipmentTab === 'invoices'
                    ? 'text-rose-100'
                    : company.pendingAmount > 0
                    ? 'text-rose-600'
                    : 'text-slate-400'
                }`}
              />
            </div>
            <div className="text-lg sm:text-xl font-bold font-mono truncate">
              {formatINR(company.pendingAmount || 0)}
            </div>
            <p
              className={`text-[10px] mt-1 line-clamp-1 ${
                shipmentTab === 'invoices'
                  ? 'text-rose-100'
                  : company.pendingAmount > 0
                  ? 'text-rose-600 font-semibold'
                  : 'text-slate-400'
              }`}
            >
              Company must pay
            </p>
          </div>

          {/* Box 5: Total Billed Amount */}
          <div
            onClick={() => setShipmentTab('invoices')}
            className="p-4 rounded-xl border border-blue-200 bg-blue-50/70 hover:border-blue-300 text-blue-950 cursor-pointer transition-all shadow-xs"
          >
            <div className="flex items-center justify-between mb-1.5">
              <span className="text-xs font-semibold text-blue-700">Total Billed</span>
              <CreditCard className="w-4 h-4 text-blue-600" />
            </div>
            <div className="text-lg sm:text-xl font-bold font-mono truncate text-blue-900">
              {formatINR(company.totalBilledAmount || 0)}
            </div>
            <p className="text-[10px] text-blue-600 mt-1">All invoices issued</p>
          </div>

          {/* Box 6: Total Paid / Collected */}
          <div
            onClick={() => setShipmentTab('invoices')}
            className="p-4 rounded-xl border border-indigo-200 bg-indigo-50/70 hover:border-indigo-300 text-indigo-950 cursor-pointer transition-all shadow-xs"
          >
            <div className="flex items-center justify-between mb-1.5">
              <span className="text-xs font-semibold text-indigo-700">Total Paid</span>
              <DollarSign className="w-4 h-4 text-indigo-600" />
            </div>
            <div className="text-lg sm:text-xl font-bold font-mono truncate text-indigo-900">
              {formatINR(company.totalPaidAmount || 0)}
            </div>
            <p className="text-[10px] text-indigo-600 mt-1">Collected revenue</p>
          </div>
        </div>
      </div>

      {/* 4. WORKSPACE TABS & CONTENT */}
      <div className="bg-white border border-slate-200 rounded-2xl p-4 sm:p-6 shadow-xs space-y-4">
        {/* TAB CONTROLS & SEARCH */}
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b border-slate-200 pb-3">
          <div className="flex items-center gap-2 overflow-x-auto">
            <button
              onClick={() => setShipmentTab('all')}
              className={`px-3.5 py-1.5 text-xs font-semibold rounded-lg transition-colors shrink-0 ${
                shipmentTab === 'all'
                  ? 'bg-setu-600 text-white shadow-xs'
                  : 'text-slate-600 hover:bg-slate-100'
              }`}
            >
              All Shipments ({company.shipments.length})
            </button>
            <button
              onClick={() => setShipmentTab('bills_made')}
              className={`px-3.5 py-1.5 text-xs font-semibold rounded-lg transition-colors shrink-0 ${
                shipmentTab === 'bills_made'
                  ? 'bg-emerald-600 text-white shadow-xs'
                  : 'text-emerald-700 bg-emerald-50 hover:bg-emerald-100'
              }`}
            >
              ✅ Bills Made ({company.billsMade})
            </button>
            <button
              onClick={() => setShipmentTab('bills_not_made')}
              className={`px-3.5 py-1.5 text-xs font-semibold rounded-lg transition-colors shrink-0 ${
                shipmentTab === 'bills_not_made'
                  ? 'bg-amber-600 text-white shadow-xs'
                  : 'text-amber-800 bg-amber-50 hover:bg-amber-100'
              }`}
            >
              ⏳ Bills Not Made ({company.billsNotMade})
            </button>
            <button
              onClick={() => setShipmentTab('invoices')}
              className={`px-3.5 py-1.5 text-xs font-semibold rounded-lg transition-colors shrink-0 ${
                shipmentTab === 'invoices'
                  ? 'bg-blue-600 text-white shadow-xs'
                  : 'text-blue-700 bg-blue-50 hover:bg-blue-100'
              }`}
            >
              📄 Invoices & Receivables ({company.invoices.length})
            </button>
          </div>

          {/* Shipment Search */}
          {shipmentTab !== 'invoices' && (
            <div className="relative w-full sm:w-72">
              <Search className="w-3.5 h-3.5 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2 pointer-events-none" />
              <input
                type="text"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                placeholder="Search CN, date, route..."
                className="w-full pl-9 pr-3 py-1.5 text-xs bg-slate-50 border border-slate-200 rounded-lg focus:outline-hidden focus:ring-2 focus:ring-setu-500 focus:bg-white text-slate-900 placeholder:text-slate-400 transition-all"
              />
              {searchQuery && (
                <button
                  onClick={() => setSearchQuery('')}
                  className="absolute right-2.5 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600"
                >
                  <X className="w-3 h-3" />
                </button>
              )}
            </div>
          )}
        </div>

        {/* TAB CONTENT: SHIPMENTS LIST */}
        {shipmentTab !== 'invoices' && (
          <div className="overflow-x-auto border border-slate-200 rounded-xl">
            <table className="w-full text-left text-xs text-slate-600">
              <thead className="bg-slate-50 border-b border-slate-200 text-[11px] font-bold text-slate-500 uppercase tracking-wider">
                <tr>
                  <th className="py-3 px-3.5">CN Number</th>
                  <th className="py-3 px-3.5">Date</th>
                  <th className="py-3 px-3.5">Route</th>
                  <th className="py-3 px-3.5 text-right">Packages / Wt</th>
                  <th className="py-3 px-3.5 text-center">Bill Status</th>
                  <th className="py-3 px-3.5 text-right">Freight (₹)</th>
                  <th className="py-3 px-3.5">Status</th>
                  <th className="py-3 px-3.5">POD</th>
                  <th className="py-3 px-3.5 text-right">Action</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {filteredShipments.length === 0 ? (
                  <tr>
                    <td colSpan={9} className="py-10 text-center text-slate-400">
                      No shipments found for {company.companyName} matching the current filter.
                    </td>
                  </tr>
                ) : (
                  filteredShipments.map((s) => (
                    <tr key={s.id || s.cnNumber} className="hover:bg-slate-50/80 transition-colors">
                      {/* CN Number */}
                      <td className="py-3 px-3.5 font-mono font-bold text-setu-600">
                        <span
                          onClick={() => navigate(`/admin/shipments/${s.cnNumber}`)}
                          className="hover:underline cursor-pointer"
                        >
                          {s.cnNumber}
                        </span>
                      </td>

                      {/* Date */}
                      <td className="py-3 px-3.5 whitespace-nowrap text-slate-500 text-[11px]">
                        {s.cnDate && s.cnDate.includes('T') ? s.cnDate.split('T')[0] : s.cnDate}
                      </td>

                      {/* Route */}
                      <td className="py-3 px-3.5 whitespace-nowrap">
                        <span className="font-semibold text-slate-800">{s.origin}</span>
                        <span className="text-slate-400 mx-1">→</span>
                        <span className="font-semibold text-slate-800">{s.destination}</span>
                      </td>

                      {/* Packages & Weight */}
                      <td className="py-3 px-3.5 text-right whitespace-nowrap">
                        <span className="font-semibold text-slate-800">{s.packages || 0} pkgs</span>
                        <span className="text-slate-400 ml-1">
                          ({s.chargeableWeight || s.actualWeight || 0} kg)
                        </span>
                      </td>

                      {/* Bill Status Box */}
                      <td className="py-3 px-3.5 text-center whitespace-nowrap">
                        {s.isBillMade ? (
                          <div className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-[11px] font-semibold bg-emerald-50 text-emerald-700 border border-emerald-200">
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
                          <div className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-[11px] font-semibold bg-amber-50 text-amber-800 border border-amber-200">
                            <Clock className="w-3 h-3 text-amber-600" />
                            <span>Bill Not Made</span>
                          </div>
                        )}
                      </td>

                      {/* Freight */}
                      <td className="py-3 px-3.5 text-right font-mono font-bold text-slate-900 whitespace-nowrap">
                        {formatINR(s.freightAmount || 0)}
                      </td>

                      {/* Status */}
                      <td className="py-3 px-3.5 whitespace-nowrap">
                        <StatusBadge status={s.status || 'Booked'} />
                      </td>

                      {/* POD Status */}
                      <td className="py-3 px-3.5 whitespace-nowrap">
                        <StatusBadge status={s.podStatus || 'Pending'} />
                      </td>

                      {/* Actions */}
                      <td className="py-3 px-3.5 text-right whitespace-nowrap">
                        <div className="inline-flex items-center gap-1.5">
                          {!s.isBillMade && (
                            <button
                              onClick={() => navigate(`/admin/billing/create?cn=${s.cnNumber}`)}
                              className="px-2.5 py-1 text-[11px] font-semibold bg-setu-50 text-setu-700 border border-setu-200 rounded-md hover:bg-setu-600 hover:text-white transition-colors"
                              title="Generate Invoice for this CN"
                            >
                              + Bill
                            </button>
                          )}
                          <button
                            onClick={() => navigate(`/admin/shipments/${s.cnNumber}`)}
                            className="px-2.5 py-1 text-[11px] font-semibold bg-slate-100 text-slate-700 rounded-md hover:bg-slate-200 transition-colors"
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

        {/* TAB CONTENT: INVOICES & RECEIVABLES LIST */}
        {shipmentTab === 'invoices' && (
          <div className="overflow-x-auto border border-slate-200 rounded-xl">
            <table className="w-full text-left text-xs text-slate-600">
              <thead className="bg-slate-50 border-b border-slate-200 text-[11px] font-bold text-slate-500 uppercase tracking-wider">
                <tr>
                  <th className="py-3 px-3.5">Invoice #</th>
                  <th className="py-3 px-3.5">Date</th>
                  <th className="py-3 px-3.5">Due Date</th>
                  <th className="py-3 px-3.5 text-right">Invoice Amount</th>
                  <th className="py-3 px-3.5 text-right">Paid Amount</th>
                  <th className="py-3 px-3.5 text-right font-bold text-rose-700">Amount Pending (To Pay)</th>
                  <th className="py-3 px-3.5 text-center">Status</th>
                  <th className="py-3 px-3.5 text-right">Action</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {(company.invoices || []).length === 0 ? (
                  <tr>
                    <td colSpan={8} className="py-10 text-center text-slate-400">
                      No invoices generated yet for {company.companyName}.
                    </td>
                  </tr>
                ) : (
                  company.invoices.map((inv) => {
                    const total = inv.grandTotal || inv.totalAmount || 0;
                    const paid = inv.paidAmount || 0;
                    const balance = typeof inv.balanceAmount === 'number'
                      ? inv.balanceAmount
                      : (inv.balanceDue !== undefined ? inv.balanceDue : Math.max(0, total - paid));

                    return (
                      <tr key={inv.id || inv.invoiceNumber} className="hover:bg-slate-50/80 transition-colors">
                        <td className="py-3 px-3.5 font-mono font-bold text-setu-600">
                          <span
                            onClick={() => navigate(`/admin/billing/invoices/${inv.id || inv.invoiceNumber}`)}
                            className="hover:underline cursor-pointer"
                          >
                            {inv.invoiceNumber || inv.id}
                          </span>
                        </td>
                        <td className="py-3 px-3.5 whitespace-nowrap text-slate-500 text-[11px]">
                          {inv.invoiceDate || inv.date || '-'}
                        </td>
                        <td className="py-3 px-3.5 whitespace-nowrap text-slate-500 text-[11px]">
                          {inv.dueDate || '-'}
                        </td>
                        <td className="py-3 px-3.5 text-right font-mono font-semibold text-slate-900">
                          {formatINR(total)}
                        </td>
                        <td className="py-3 px-3.5 text-right font-mono text-emerald-700 font-semibold">
                          {formatINR(paid)}
                        </td>
                        <td className="py-3 px-3.5 text-right font-mono font-bold text-rose-700">
                          {formatINR(balance)}
                        </td>
                        <td className="py-3 px-3.5 text-center">
                          <StatusBadge status={inv.status || (balance === 0 ? 'Paid' : 'Unpaid')} />
                        </td>
                        <td className="py-3 px-3.5 text-right">
                          <button
                            onClick={() => navigate(`/admin/billing/invoices/${inv.id || inv.invoiceNumber}`)}
                            className="inline-flex items-center gap-1 px-2.5 py-1 text-[11px] font-semibold text-setu-700 bg-setu-50 border border-setu-200 rounded-md hover:bg-setu-600 hover:text-white transition-colors"
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
  );
};
