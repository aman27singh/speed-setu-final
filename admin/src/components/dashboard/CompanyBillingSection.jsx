import React, { useState, useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import { formatINR } from '../../utils/formatters';
import {
  Building2,
  CheckCircle2,
  AlertCircle,
  Search,
  ExternalLink,
  X
} from 'lucide-react';

export const CompanyBillingSection = ({ companies = [] }) => {
  const navigate = useNavigate();

  const [companySearch, setCompanySearch] = useState('');
  const [filterType, setFilterType] = useState('all'); // 'all', 'pending_balance', 'unbilled_shipments'

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

  const handleOpenCompanyPage = (companyId) => {
    navigate(`/admin/company-billing/${encodeURIComponent(companyId)}`);
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
                  Click any client company card to open its full billing page with shipment breakdown (Bills Made vs Not Made) and pending payments
                </p>
              </div>
            </div>
          </div>

          {/* Quick Stats Pill */}
          <div className="flex flex-wrap items-center gap-2 text-xs">
            <span className="px-2.5 py-1 bg-slate-100 text-slate-700 font-semibold rounded-md border border-slate-200">
              {companies.length} Companies
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

      {/* COMPANY BOXES GRID */}
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
            const billedPercent =
              comp.totalShipments > 0
                ? Math.round((comp.billsMade / comp.totalShipments) * 100)
                : 0;

            return (
              <div
                key={comp.id}
                onClick={() => handleOpenCompanyPage(comp.id)}
                className="group relative bg-white border border-slate-200 hover:border-setu-400 rounded-xl p-4 cursor-pointer transition-all duration-200 hover:shadow-lg hover:-translate-y-0.5"
              >
                {/* Header: Company Name & Code */}
                <div className="flex items-start justify-between gap-2 mb-2.5">
                  <div className="flex-1 min-w-0">
                    <span className="inline-block px-1.5 py-0.5 text-[10px] font-bold uppercase rounded bg-slate-100 text-slate-700 border border-slate-200 mb-1">
                      {comp.companyCode || 'CLIENT'}
                    </span>
                    <h3 className="text-sm font-bold text-slate-900 group-hover:text-setu-600 transition-colors truncate">
                      {comp.companyName}
                    </h3>
                  </div>
                  <div className="p-1 rounded-md text-slate-400 group-hover:text-setu-600 group-hover:bg-blue-50 transition-colors shrink-0">
                    <ExternalLink className="w-4 h-4" />
                  </div>
                </div>

                {/* Pending Amount to Pay Box */}
                <div
                  className={`p-2.5 rounded-lg mb-3 border transition-colors ${
                    comp.pendingAmount > 0
                      ? 'bg-rose-50/80 border-rose-200 text-rose-900 group-hover:bg-rose-50'
                      : 'bg-emerald-50/80 border-emerald-200 text-emerald-900 group-hover:bg-emerald-50'
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
                    <span className="block text-[10px] font-medium text-slate-500">Shipments</span>
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

                {/* Card Action Link Footer */}
                <div className="mt-3 pt-2.5 border-t border-slate-100 flex items-center justify-between text-[11px] font-semibold text-setu-600 group-hover:text-setu-700">
                  <span>Open Company Billing Page</span>
                  <ExternalLink className="w-3.5 h-3.5 transition-transform duration-200 group-hover:translate-x-0.5" />
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
};
