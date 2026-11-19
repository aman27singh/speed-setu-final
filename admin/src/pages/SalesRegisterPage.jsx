import React, { useMemo, useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { salesRegisterService } from '../services/salesRegisterService';
import { companyService } from '../services/companyService';
import { PageHeader } from '../components/common/PageHeader';
import { LoadingState } from '../components/common/LoadingState';
import {
  FileSpreadsheet,
  Download,
  Receipt,
  FileText,
  AlertCircle,
  AlertTriangle,
  Info,
  ChevronDown,
  ChevronUp,
  RotateCcw,
  Calendar,
  Building2,
  Filter,
  CheckCircle2,
  ExternalLink
} from 'lucide-react';

const MONTHS = [
  'January', 'February', 'March', 'April', 'May', 'June',
  'July', 'August', 'September', 'October', 'November', 'December'
];

const STATUS_OPTIONS = [
  { label: 'All except draft', value: '' },
  { label: 'Generated', value: 'generated' },
  { label: 'Sent', value: 'sent' },
  { label: 'Paid', value: 'paid' },
  { label: 'Partially Paid', value: 'partially_paid' },
  { label: 'Overdue', value: 'overdue' },
  { label: 'Disputed', value: 'disputed' },
  { label: 'Cancelled', value: 'cancelled' }
];

// Currency formatting with Indian digit grouping and 2 decimal places
const inr = new Intl.NumberFormat('en-IN', {
  minimumFractionDigits: 2,
  maximumFractionDigits: 2
});

const intFmt = new Intl.NumberFormat('en-IN');

// Format date into IST DD-Mon-YYYY (e.g. 01-Oct-2026)
const formatISTDate = (dateVal) => {
  if (!dateVal) return '-';
  const d = new Date(dateVal);
  if (isNaN(d.getTime())) return String(dateVal);
  return d.toLocaleDateString('en-GB', {
    day: '2-digit',
    month: 'short',
    year: 'numeric',
    timeZone: 'Asia/Kolkata'
  }).replace(/ /g, '-');
};

function computeDefaults() {
  const now = new Date();
  // Default to previous completed month
  const prevMonthDate = new Date(now.getFullYear(), now.getMonth() - 1, 1);
  const fyYear = now.getMonth() >= 3 ? now.getFullYear() : now.getFullYear() - 1;
  return {
    month: prevMonthDate.getMonth() + 1,
    year: prevMonthDate.getFullYear(),
    fy: fyYear
  };
}

export const SalesRegisterPage = () => {
  const navigate = useNavigate();
  const d = useMemo(computeDefaults, []);

  // Filter & Period state
  const [type, setType] = useState('monthly'); // 'monthly' | 'yearly' | 'custom'
  const [month, setMonth] = useState(d.month);
  const [year, setYear] = useState(d.year);
  const [fy, setFy] = useState(d.fy);
  const [basis, setBasis] = useState('fy'); // 'fy' | 'calendar'
  const [from, setFrom] = useState('');
  const [to, setTo] = useState('');
  const [companyId, setCompanyId] = useState('');
  const [status, setStatus] = useState('');
  const [includeDrafts, setIncludeDrafts] = useState(false);

  // Companies list
  const [companies, setCompanies] = useState([]);

  // Data & Request state
  const [registerData, setRegisterData] = useState(null);
  const [loading, setLoading] = useState(false);
  const [downloading, setDownloading] = useState(''); // 'xlsx' | 'csv' | ''
  const [error, setError] = useState(null);
  const [showWarnings, setShowWarnings] = useState(true);

  // Year options (6 years)
  const years = useMemo(() => Array.from({ length: 6 }, (_, i) => d.year + 1 - i), [d.year]);
  const fys = useMemo(() => Array.from({ length: 6 }, (_, i) => d.fy + 1 - i), [d.fy]);

  // Load companies for the dropdown
  useEffect(() => {
    let mounted = true;
    companyService.getCompanies()
      .then((data) => {
        if (mounted && Array.isArray(data)) {
          setCompanies(data);
        }
      })
      .catch((err) => {
        console.warn('Failed to load companies dropdown:', err.message);
      });
    return () => { mounted = false; };
  }, []);

  // Build params object
  const buildParams = (extra = {}) => {
    const p = { type };
    if (type === 'monthly') {
      p.year = year;
      p.month = month;
    } else if (type === 'yearly') {
      p.fy = fy;
      p.basis = basis;
    } else if (type === 'custom') {
      p.from = from;
      p.to = to;
    }
    if (companyId) p.companyId = companyId;
    if (status) p.status = status;
    if (includeDrafts) p.includeDrafts = 'true';
    return { ...p, ...extra };
  };

  const customInvalid = type === 'custom' && (!from || !to || to < from);

  // Fetch register data
  const handleGenerate = async () => {
    if (customInvalid) return;
    setLoading(true);
    setError(null);
    try {
      const result = await salesRegisterService.getSalesRegister(buildParams());
      setRegisterData(result);
    } catch (err) {
      setError(err.message || 'Could not generate the sales register');
      setRegisterData(null);
    } finally {
      setLoading(false);
    }
  };

  // Download Excel or CSV
  const handleDownload = async (format) => {
    if (downloading) return;
    setDownloading(format);
    setError(null);
    try {
      await salesRegisterService.downloadSalesRegister(buildParams(), format);
    } catch (err) {
      setError(err.message || `Download failed for ${format.toUpperCase()}`);
    } finally {
      setDownloading('');
    }
  };

  // Warning severity breakdown
  const warningCounts = useMemo(() => {
    const c = { error: 0, warn: 0, info: 0 };
    if (registerData && Array.isArray(registerData.warnings)) {
      registerData.warnings.forEach((w) => {
        if (c[w.severity] !== undefined) c[w.severity] += 1;
      });
    }
    return c;
  }, [registerData]);

  return (
    <div className="space-y-6">
      {/* Page Header */}
      <PageHeader
        title="Sales Register & Tax Ledger"
        description="Audit-ready GST sales register with live formula-linked Excel exports, CA tax summaries, and automated compliance checks."
        breadcrumbs={['Speed Setu Admin', 'Finance', 'Billing', 'Sales Register']}
        actions={
          <div className="flex items-center gap-2">
            <button
              onClick={() => navigate('/admin/billing')}
              className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold text-slate-700 bg-white border border-slate-300 hover:bg-slate-50 rounded-lg shadow-xs transition-colors"
            >
              <Receipt className="w-4 h-4 text-slate-500" />
              <span>Back to Billing</span>
            </button>
          </div>
        }
      />

      {/* Main Billing Navigation Tabs */}
      <div className="flex items-center gap-2 border-b border-slate-200 pb-2">
        <button
          onClick={() => navigate('/admin/billing')}
          className="px-4 py-2 text-xs font-bold rounded-lg transition-colors text-slate-600 hover:bg-slate-100"
        >
          All Invoices
        </button>
        <button
          onClick={() => navigate('/admin/billing')}
          className="px-4 py-2 text-xs font-bold rounded-lg transition-colors text-slate-600 hover:bg-slate-100"
        >
          Ready for Billing Queue
        </button>
        <button
          className="px-4 py-2 text-xs font-bold rounded-lg transition-colors bg-setu-600 text-white shadow-xs flex items-center gap-1.5"
          aria-current="page"
        >
          <FileSpreadsheet className="w-3.5 h-3.5" />
          <span>Sales Register</span>
        </button>
      </div>

      {/* Filter & Period Controls Card */}
      <section className="bg-white border border-slate-200 rounded-xl p-4 sm:p-5 shadow-xs space-y-4">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between border-b border-slate-100 pb-3 gap-3">
          <div>
            <h2 className="text-sm font-bold text-slate-900 uppercase tracking-wider flex items-center gap-2">
              <Calendar className="w-4 h-4 text-setu-600" />
              <span>Select Reporting Period</span>
            </h2>
            <p className="text-xs text-slate-500 mt-0.5">
              Choose monthly, fiscal year, or custom dates to generate outward tax register.
            </p>
          </div>

          {/* Period Tabs */}
          <div className="inline-flex rounded-lg border border-slate-300 p-0.5 bg-slate-50" role="tablist" aria-label="Report period type">
            {[
              ['monthly', 'Monthly'],
              ['yearly', 'Yearly / FY'],
              ['custom', 'Custom Range']
            ].map(([val, labelText]) => (
              <button
                key={val}
                role="tab"
                aria-selected={type === val}
                onClick={() => setType(val)}
                className={`rounded-md px-3.5 py-1.5 text-xs font-bold transition-all ${
                  type === val
                    ? 'bg-setu-600 text-white shadow-xs'
                    : 'text-slate-600 hover:text-slate-900 hover:bg-slate-100'
                }`}
              >
                {labelText}
              </button>
            ))}
          </div>
        </div>

        {/* Inputs Strip */}
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-6 gap-3 items-end">
          {/* Monthly inputs */}
          {type === 'monthly' && (
            <>
              <div className="lg:col-span-1">
                <label htmlFor="sr-month" className="mb-1 block text-xs font-semibold text-slate-600">
                  Month
                </label>
                <select
                  id="sr-month"
                  value={month}
                  onChange={(e) => setMonth(Number(e.target.value))}
                  className="w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-xs font-medium text-slate-800 focus:border-setu-600 focus:outline-hidden focus:ring-2 focus:ring-setu-600/20"
                >
                  {MONTHS.map((m, idx) => (
                    <option key={m} value={idx + 1}>{m}</option>
                  ))}
                </select>
              </div>

              <div className="lg:col-span-1">
                <label htmlFor="sr-year" className="mb-1 block text-xs font-semibold text-slate-600">
                  Year
                </label>
                <select
                  id="sr-year"
                  value={year}
                  onChange={(e) => setYear(Number(e.target.value))}
                  className="w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-xs font-medium text-slate-800 focus:border-setu-600 focus:outline-hidden focus:ring-2 focus:ring-setu-600/20"
                >
                  {years.map((y) => (
                    <option key={y} value={y}>{y}</option>
                  ))}
                </select>
              </div>
            </>
          )}

          {/* Yearly inputs */}
          {type === 'yearly' && (
            <>
              <div className="lg:col-span-1">
                <label htmlFor="sr-basis" className="mb-1 block text-xs font-semibold text-slate-600">
                  Basis
                </label>
                <select
                  id="sr-basis"
                  value={basis}
                  onChange={(e) => setBasis(e.target.value)}
                  className="w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-xs font-medium text-slate-800 focus:border-setu-600 focus:outline-hidden focus:ring-2 focus:ring-setu-600/20"
                >
                  <option value="fy">Financial Year (Apr-Mar)</option>
                  <option value="calendar">Calendar Year (Jan-Dec)</option>
                </select>
              </div>

              <div className="lg:col-span-1">
                <label htmlFor="sr-fy" className="mb-1 block text-xs font-semibold text-slate-600">
                  {basis === 'fy' ? 'Fiscal Period' : 'Calendar Year'}
                </label>
                <select
                  id="sr-fy"
                  value={fy}
                  onChange={(e) => setFy(Number(e.target.value))}
                  className="w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-xs font-medium text-slate-800 focus:border-setu-600 focus:outline-hidden focus:ring-2 focus:ring-setu-600/20"
                >
                  {fys.map((y) => (
                    <option key={y} value={y}>
                      {basis === 'fy' ? `FY ${y}-${String(y + 1).slice(2)}` : y}
                    </option>
                  ))}
                </select>
              </div>
            </>
          )}

          {/* Custom Date inputs */}
          {type === 'custom' && (
            <>
              <div className="lg:col-span-1">
                <label htmlFor="sr-from" className="mb-1 block text-xs font-semibold text-slate-600">
                  From Date
                </label>
                <input
                  id="sr-from"
                  type="date"
                  value={from}
                  onChange={(e) => setFrom(e.target.value)}
                  className="w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-xs font-medium text-slate-800 focus:border-setu-600 focus:outline-hidden focus:ring-2 focus:ring-setu-600/20"
                />
              </div>

              <div className="lg:col-span-1">
                <label htmlFor="sr-to" className="mb-1 block text-xs font-semibold text-slate-600">
                  To Date (Inclusive)
                </label>
                <input
                  id="sr-to"
                  type="date"
                  value={to}
                  min={from || undefined}
                  onChange={(e) => setTo(e.target.value)}
                  className="w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-xs font-medium text-slate-800 focus:border-setu-600 focus:outline-hidden focus:ring-2 focus:ring-setu-600/20"
                />
              </div>
            </>
          )}

          {/* Company filter */}
          <div className="lg:col-span-1">
            <label htmlFor="sr-company" className="mb-1 block text-xs font-semibold text-slate-600">
              Company
            </label>
            <select
              id="sr-company"
              value={companyId}
              onChange={(e) => setCompanyId(e.target.value)}
              className="w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-xs font-medium text-slate-800 focus:border-setu-600 focus:outline-hidden focus:ring-2 focus:ring-setu-600/20 truncate"
            >
              <option value="">All Companies</option>
              {companies.map((c) => {
                const cId = c.id || c.companyId || c._id;
                const cName = c.companyName || c.name || cId;
                return (
                  <option key={cId} value={cId}>{cName}</option>
                );
              })}
            </select>
          </div>

          {/* Status filter */}
          <div className="lg:col-span-1">
            <label htmlFor="sr-status" className="mb-1 block text-xs font-semibold text-slate-600">
              Invoice Status
            </label>
            <select
              id="sr-status"
              value={status}
              onChange={(e) => setStatus(e.target.value)}
              className="w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-xs font-medium text-slate-800 focus:border-setu-600 focus:outline-hidden focus:ring-2 focus:ring-setu-600/20"
            >
              {STATUS_OPTIONS.map((opt) => (
                <option key={opt.value} value={opt.value}>{opt.label}</option>
              ))}
            </select>
          </div>

          {/* Include Drafts Checkbox */}
          <div className="lg:col-span-1 flex items-center h-9">
            <label className="flex items-center gap-2 text-xs font-bold text-slate-700 cursor-pointer select-none">
              <input
                type="checkbox"
                checked={includeDrafts}
                onChange={(e) => setIncludeDrafts(e.target.checked)}
                className="w-4 h-4 rounded-sm border-slate-300 text-setu-600 focus:ring-setu-600/20"
              />
              <span>Include Drafts</span>
            </label>
          </div>

          {/* Action button */}
          <div className="lg:col-span-1">
            <button
              onClick={handleGenerate}
              disabled={loading || customInvalid}
              className="w-full inline-flex items-center justify-center gap-2 px-4 py-2 text-xs font-bold text-white bg-setu-600 hover:bg-setu-700 rounded-lg shadow-xs transition-colors disabled:cursor-not-allowed disabled:opacity-50 cursor-pointer"
            >
              {loading ? (
                <>
                  <div className="w-3.5 h-3.5 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                  <span>Generating…</span>
                </>
              ) : (
                <>
                  <FileSpreadsheet className="w-4 h-4" />
                  <span>Generate</span>
                </>
              )}
            </button>
          </div>
        </div>

        {customInvalid && from && to && (
          <div className="flex items-center gap-2 text-xs font-semibold text-rose-600 bg-rose-50 border border-rose-200 p-2.5 rounded-lg">
            <AlertCircle className="w-4 h-4 shrink-0" />
            <span>The end date must be on or after the start date.</span>
          </div>
        )}
      </section>

      {/* Error Banner */}
      {error && (
        <div role="alert" className="flex items-start gap-3 rounded-xl border border-rose-200 bg-rose-50 p-4 text-xs sm:text-sm text-rose-900 shadow-xs">
          <AlertCircle className="w-5 h-5 text-rose-600 shrink-0 mt-0.5" />
          <div className="flex-1">
            <h3 className="font-bold">Error Generating Sales Register</h3>
            <p className="mt-0.5">{error}</p>
          </div>
          <button
            onClick={() => setError(null)}
            className="text-rose-500 hover:text-rose-700 font-bold"
          >
            Dismiss
          </button>
        </div>
      )}

      {/* Loading state indicator */}
      {loading && !registerData && (
        <div className="bg-white border border-slate-200 rounded-xl p-12 text-center shadow-xs">
          <LoadingState message="Fetching and calculating GST Sales Register..." />
        </div>
      )}

      {/* Empty State */}
      {registerData && registerData.rows && registerData.rows.length === 0 && (
        <div className="bg-white border-2 border-dashed border-slate-200 rounded-xl p-10 text-center shadow-xs space-y-2">
          <FileSpreadsheet className="w-10 h-10 text-slate-300 mx-auto" />
          <h3 className="text-sm font-bold text-slate-700">No Invoices Found</h3>
          <p className="text-xs text-slate-500 max-w-md mx-auto">
            No invoices dated in <span className="font-semibold text-slate-800">{registerData.period?.label}</span>. Try selecting another period or tick &quot;Include Drafts&quot; to inspect provisional bills.
          </p>
        </div>
      )}

      {/* Register Results View */}
      {registerData && registerData.rows && registerData.rows.length > 0 && (
        <div className="space-y-5">
          {/* Summary Strip & Download Actions */}
          <section className="bg-white border border-slate-200 rounded-xl p-4 sm:p-5 shadow-xs space-y-4">
            <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 border-b border-slate-100 pb-3">
              <div>
                <div className="flex items-center gap-2">
                  <h2 className="text-lg font-bold text-slate-900 tracking-tight">
                    {registerData.period?.label} Register
                  </h2>
                  {registerData.includeDrafts && (
                    <span className="px-2 py-0.5 rounded-full text-[10px] font-extrabold bg-amber-100 text-amber-800 border border-amber-200">
                      Drafts Included
                    </span>
                  )}
                </div>
                <p className="text-xs text-slate-500 mt-0.5">
                  Showing <span className="font-bold text-slate-700">{intFmt.format(registerData.totals?.invoices || 0)}</span> invoices with <span className="font-bold text-slate-700">{intFmt.format(registerData.totals?.dockets || 0)}</span> dockets.
                </p>
              </div>

              {/* Download Buttons */}
              <div className="flex flex-wrap items-center gap-2">
                <button
                  onClick={() => handleDownload('xlsx')}
                  disabled={!!downloading}
                  className="inline-flex items-center gap-1.5 px-3.5 py-2 text-xs font-bold text-white bg-emerald-600 hover:bg-emerald-700 rounded-lg shadow-xs transition-colors disabled:opacity-50 cursor-pointer"
                >
                  <Download className="w-4 h-4" />
                  <span>{downloading === 'xlsx' ? 'Preparing Excel…' : 'Download Excel (.xlsx)'}</span>
                </button>
                <button
                  onClick={() => handleDownload('csv')}
                  disabled={!!downloading}
                  className="inline-flex items-center gap-1.5 px-3.5 py-2 text-xs font-bold text-slate-700 bg-white border border-slate-300 hover:bg-slate-50 rounded-lg shadow-xs transition-colors disabled:opacity-50 cursor-pointer"
                >
                  <Download className="w-4 h-4 text-slate-500" />
                  <span>{downloading === 'csv' ? 'Preparing CSV…' : 'Download CSV'}</span>
                </button>
              </div>
            </div>

            {/* KPI Cards Strip */}
            <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-3">
              <div className="bg-slate-50 border border-slate-200 rounded-lg p-3">
                <span className="text-[10px] sm:text-[11px] font-bold text-slate-500 uppercase tracking-wider block">
                  Taxable Value
                </span>
                <span className="text-base sm:text-lg font-bold font-mono text-slate-900 tabular-nums">
                  ₹{inr.format(registerData.totals?.taxable || 0)}
                </span>
              </div>
              <div className="bg-slate-50 border border-slate-200 rounded-lg p-3">
                <span className="text-[10px] sm:text-[11px] font-bold text-slate-500 uppercase tracking-wider block">
                  CGST
                </span>
                <span className="text-base sm:text-lg font-bold font-mono text-slate-900 tabular-nums">
                  ₹{inr.format(registerData.totals?.cgst || 0)}
                </span>
              </div>
              <div className="bg-slate-50 border border-slate-200 rounded-lg p-3">
                <span className="text-[10px] sm:text-[11px] font-bold text-slate-500 uppercase tracking-wider block">
                  SGST
                </span>
                <span className="text-base sm:text-lg font-bold font-mono text-slate-900 tabular-nums">
                  ₹{inr.format(registerData.totals?.sgst || 0)}
                </span>
              </div>
              <div className="bg-slate-50 border border-slate-200 rounded-lg p-3">
                <span className="text-[10px] sm:text-[11px] font-bold text-slate-500 uppercase tracking-wider block">
                  IGST
                </span>
                <span className="text-base sm:text-lg font-bold font-mono text-slate-900 tabular-nums">
                  ₹{inr.format(registerData.totals?.igst || 0)}
                </span>
              </div>
              <div className="bg-setu-50/50 border border-setu-200 rounded-lg p-3 col-span-2 sm:col-span-1">
                <span className="text-[10px] sm:text-[11px] font-bold text-setu-800 uppercase tracking-wider block">
                  Invoice Value (Total)
                </span>
                <span className="text-base sm:text-lg font-bold font-mono text-setu-900 tabular-nums">
                  ₹{inr.format(registerData.totals?.total || 0)}
                </span>
              </div>
            </div>
          </section>

          {/* Checks to Review Collapsible Panel */}
          {registerData.warnings && registerData.warnings.length > 0 && (
            <section className="bg-white border border-slate-200 rounded-xl shadow-xs overflow-hidden">
              <button
                onClick={() => setShowWarnings(!showWarnings)}
                aria-expanded={showWarnings}
                className="w-full flex items-center justify-between p-3.5 sm:p-4 text-left hover:bg-slate-50 transition-colors cursor-pointer"
              >
                <div className="flex items-center gap-2">
                  <AlertCircle className="w-4 h-4 text-amber-500" />
                  <span className="text-xs sm:text-sm font-bold text-slate-900">
                    Audit Checks & Reconciliations
                  </span>
                  <span className="text-xs text-slate-500">
                    ({warningCounts.error} errors, {warningCounts.warn} warnings, {warningCounts.info} notes)
                  </span>
                </div>
                {showWarnings ? (
                  <ChevronUp className="w-4 h-4 text-slate-400" />
                ) : (
                  <ChevronDown className="w-4 h-4 text-slate-400" />
                )}
              </button>

              {showWarnings && (
                <div className="border-t border-slate-100 p-3.5 sm:p-4 bg-slate-50/40 space-y-2">
                  {registerData.warnings.map((w, idx) => {
                    const isError = w.severity === 'error';
                    const isWarn = w.severity === 'warn';
                    const badgeClass = isError
                      ? 'bg-rose-100 text-rose-800 border-rose-200'
                      : isWarn
                      ? 'bg-amber-100 text-amber-800 border-amber-200'
                      : 'bg-slate-100 text-slate-800 border-slate-200';
                    const borderClass = isError
                      ? 'border-rose-200 bg-rose-50/50'
                      : isWarn
                      ? 'border-amber-200 bg-amber-50/40'
                      : 'border-slate-200 bg-white';
                    const prefix = isError ? 'Fix' : isWarn ? 'Check' : 'Note';

                    return (
                      <div
                        key={idx}
                        className={`p-2.5 rounded-lg border text-xs flex items-start gap-2.5 ${borderClass}`}
                      >
                        <span className={`px-2 py-0.5 rounded text-[10px] font-extrabold uppercase shrink-0 border ${badgeClass}`}>
                          {prefix}
                        </span>
                        <div className="flex-1 text-slate-800 leading-relaxed">
                          {w.reference && (
                            <span className="font-mono font-bold text-slate-900 mr-1.5">
                              [{w.reference}]
                            </span>
                          )}
                          <span>{w.message}</span>
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}
            </section>
          )}

          {/* Register Detail Table */}
          <section className="bg-white border border-slate-200 rounded-xl shadow-xs overflow-hidden">
            <div className="overflow-x-auto max-h-[600px] relative">
              <table className="min-w-full text-xs">
                <thead className="sticky top-0 bg-slate-100 text-slate-700 font-bold border-b border-slate-200 z-10 select-none shadow-xs">
                  <tr>
                    <th scope="col" className="whitespace-nowrap px-3 py-2.5 text-left">Invoice No</th>
                    <th scope="col" className="whitespace-nowrap px-3 py-2.5 text-left">Date</th>
                    <th scope="col" className="px-3 py-2.5 text-left min-w-[160px]">Customer</th>
                    <th scope="col" className="whitespace-nowrap px-3 py-2.5 text-left font-mono">GSTIN</th>
                    <th scope="col" className="whitespace-nowrap px-3 py-2.5 text-left">Mode</th>
                    <th scope="col" className="whitespace-nowrap px-3 py-2.5 text-right">Dockets</th>
                    <th scope="col" className="whitespace-nowrap px-3 py-2.5 text-right">Taxable</th>
                    <th scope="col" className="whitespace-nowrap px-3 py-2.5 text-right">CGST</th>
                    <th scope="col" className="whitespace-nowrap px-3 py-2.5 text-right">SGST</th>
                    <th scope="col" className="whitespace-nowrap px-3 py-2.5 text-right">IGST</th>
                    <th scope="col" className="whitespace-nowrap px-3 py-2.5 text-right">Invoice Value</th>
                    <th scope="col" className="px-3 py-2.5 text-left min-w-[180px]">Remarks</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {registerData.rows.map((row) => {
                    const isCancelled = row.status === 'cancelled';
                    return (
                      <tr
                        key={row.number}
                        className={`transition-colors ${
                          isCancelled
                            ? 'bg-slate-50/70 text-slate-400 line-through'
                            : 'hover:bg-slate-50/80 text-slate-800'
                        }`}
                      >
                        <td className="whitespace-nowrap px-3 py-2 font-mono font-bold text-setu-600 no-underline">
                          <button
                            type="button"
                            onClick={() => navigate(`/admin/billing/invoices/${encodeURIComponent(row.number)}`)}
                            className="inline-flex items-center gap-1 hover:underline cursor-pointer text-setu-600 font-bold focus:outline-hidden"
                            title={`Open invoice ${row.number}`}
                          >
                            <span>{row.number}</span>
                            <ExternalLink className="w-3 h-3 text-setu-400 opacity-60" />
                          </button>
                        </td>
                        <td className="whitespace-nowrap px-3 py-2 font-mono text-slate-600">
                          {formatISTDate(row.date)}
                        </td>
                        <td className="px-3 py-2 font-medium text-slate-900">
                          {row.customer}
                        </td>
                        <td className="whitespace-nowrap px-3 py-2 font-mono text-[11px] text-slate-600">
                          {row.gstin || '-'}
                        </td>
                        <td className="whitespace-nowrap px-3 py-2">
                          <span className="px-1.5 py-0.5 rounded text-[10px] font-bold bg-slate-100 text-slate-700">
                            {row.mode || 'ROAD'}
                          </span>
                        </td>
                        <td className="whitespace-nowrap px-3 py-2 text-right tabular-nums font-mono">
                          {row.dockets}
                        </td>
                        <td className="whitespace-nowrap px-3 py-2 text-right tabular-nums font-mono">
                          {inr.format(row.taxable || 0)}
                        </td>
                        <td className="whitespace-nowrap px-3 py-2 text-right tabular-nums font-mono text-slate-600">
                          {inr.format(row.cgst || 0)}
                        </td>
                        <td className="whitespace-nowrap px-3 py-2 text-right tabular-nums font-mono text-slate-600">
                          {inr.format(row.sgst || 0)}
                        </td>
                        <td className="whitespace-nowrap px-3 py-2 text-right tabular-nums font-mono text-slate-600">
                          {inr.format(row.igst || 0)}
                        </td>
                        <td className="whitespace-nowrap px-3 py-2 text-right tabular-nums font-mono font-bold text-slate-900">
                          {inr.format(row.total || 0)}
                        </td>
                        <td className="px-3 py-2 text-slate-500 no-underline text-[11px]">
                          {row.remarks ? (
                            <span className={isCancelled ? 'text-rose-600 font-semibold' : 'text-slate-600'}>
                              {row.remarks}
                            </span>
                          ) : (
                            '-'
                          )}
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
                <tfoot className="sticky bottom-0 bg-setu-50/95 backdrop-blur-xs font-bold text-slate-900 border-t-2 border-setu-300 shadow-xs z-10">
                  <tr>
                    <td colSpan={5} className="px-3 py-2.5 text-left uppercase text-xs tracking-wider">
                      Total ({registerData.totals?.invoices || 0} Invoices)
                    </td>
                    <td className="px-3 py-2.5 text-right tabular-nums font-mono">
                      {intFmt.format(registerData.totals?.dockets || 0)}
                    </td>
                    <td className="px-3 py-2.5 text-right tabular-nums font-mono">
                      {inr.format(registerData.totals?.taxable || 0)}
                    </td>
                    <td className="px-3 py-2.5 text-right tabular-nums font-mono">
                      {inr.format(registerData.totals?.cgst || 0)}
                    </td>
                    <td className="px-3 py-2.5 text-right tabular-nums font-mono">
                      {inr.format(registerData.totals?.sgst || 0)}
                    </td>
                    <td className="px-3 py-2.5 text-right tabular-nums font-mono">
                      {inr.format(registerData.totals?.igst || 0)}
                    </td>
                    <td className="px-3 py-2.5 text-right tabular-nums font-mono text-setu-900 font-extrabold">
                      {inr.format(registerData.totals?.total || 0)}
                    </td>
                    <td className="px-3 py-2.5" />
                  </tr>
                </tfoot>
              </table>
            </div>
          </section>
        </div>
      )}
    </div>
  );
};

export default SalesRegisterPage;
