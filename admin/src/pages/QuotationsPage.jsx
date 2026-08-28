import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { quotationService } from '../services/quotationService';
import { companyService } from '../services/companyService';
import { formatDate } from '../utils/formatters';
import { PageHeader } from '../components/common/PageHeader';
import { DataTable } from '../components/common/DataTable';
import { StatusBadge } from '../components/common/StatusBadge';
import { SearchBar } from '../components/common/SearchBar';
import { FilterBar } from '../components/common/FilterBar';
import { LoadingState } from '../components/common/LoadingState';
import { ErrorState } from '../components/common/ErrorState';
import {
  Plus,
  FileSpreadsheet,
  Edit,
  Eye,
  Copy,
  GitBranch,
  X,
  Calendar,
  Layers
} from 'lucide-react';

export const QuotationsPage = () => {
  const navigate = useNavigate();
  const [quotations, setQuotations] = useState([]);
  const [companies, setCompanies] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  // Filters
  const [search, setSearch] = useState('');
  const [companyFilter, setCompanyFilter] = useState('All');
  const [statusFilter, setStatusFilter] = useState('All');
  const [modeFilter, setModeFilter] = useState('All');

  const [toastMessage, setToastMessage] = useState('');

  const fetchData = async () => {
    setLoading(true);
    setError(null);
    try {
      const [quotesData, compData] = await Promise.all([
        quotationService.getQuotations({
          search,
          companyId: companyFilter,
          status: statusFilter,
          mode: modeFilter,
        }),
        companyService.getCompanies()
      ]);

      setQuotations(quotesData);
      setCompanies(compData);
    } catch (err) {
      setError(err.message || 'Failed to load quotations data.');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchData();
  }, [search, companyFilter, statusFilter, modeFilter]);

  const handleDuplicate = async (id, qNum) => {
    try {
      const duplicated = await quotationService.duplicateQuotation(id);
      setToastMessage(`Quotation ${qNum} duplicated into draft ${duplicated.quotationNumber}!`);
      fetchData();
      setTimeout(() => setToastMessage(''), 4000);
    } catch (err) {
      alert(err.message || 'Failed to duplicate quotation.');
    }
  };

  const statusFilterOptions = [
    { label: 'All Statuses', value: 'All' },
    { label: 'Active', value: 'Active' },
    { label: 'Draft', value: 'Draft' },
    { label: 'Expired', value: 'Expired' },
    { label: 'Cancelled', value: 'Cancelled' },
  ];

  const modeOptions = ['All', 'Air', 'Air Express', 'Road', 'Train', 'FTL', 'Other'];

  const columns = [
    {
      header: 'Quotation No.',
      accessor: 'quotationNumber',
      render: (row) => (
        <div className="flex items-center gap-1.5">
          <span
            onClick={() => navigate(`/admin/quotations/${row.id}`)}
            className="font-bold text-setu-600 font-mono hover:underline cursor-pointer"
          >
            {row.quotationNumber}
          </span>
          <span className="px-1.5 py-0.2 text-[10px] font-bold rounded bg-slate-100 text-slate-600 border border-slate-200">
            v{row.version}
          </span>
        </div>
      )
    },
    {
      header: 'Company',
      accessor: 'companyName',
      render: (row) => (
        <div>
          <span
            onClick={() => navigate(`/admin/companies/${row.companyId}`)}
            className="font-bold text-slate-900 hover:text-setu-600 cursor-pointer block"
          >
            {row.companyName}
          </span>
          <span className="text-[10px] text-slate-400 font-mono">{row.companyCode}</span>
        </div>
      )
    },
    {
      header: 'Effective From',
      accessor: 'effectiveFrom',
      render: (row) => <span className="font-mono text-slate-700 text-xs">{formatDate(row.effectiveFrom)}</span>
    },
    {
      header: 'Effective Until',
      accessor: 'effectiveUntil',
      render: (row) => (
        <span className="font-mono text-slate-700 text-xs">
          {row.effectiveUntil ? formatDate(row.effectiveUntil) : 'Ongoing'}
        </span>
      )
    },
    {
      header: 'Routes',
      accessor: 'rateRules',
      align: 'center',
      render: (row) => (
        <span className="px-2 py-0.5 rounded text-xs font-semibold bg-blue-50 text-setu-700 border border-blue-100">
          {(row.rateRules || []).length} Routes
        </span>
      )
    },
    {
      header: 'Modes',
      accessor: 'rateRules',
      render: (row) => {
        const modes = Array.from(new Set((row.rateRules || []).map((r) => r.mode)));
        return (
          <div className="flex items-center gap-1 flex-wrap">
            {modes.map((m) => (
              <span key={m} className="px-1.5 py-0.2 text-[10px] font-medium bg-slate-100 text-slate-700 rounded">
                {m}
              </span>
            ))}
          </div>
        );
      }
    },
    {
      header: 'Status',
      accessor: 'status',
      render: (row) => <StatusBadge status={row.status} />
    },
    {
      header: 'Created Date',
      accessor: 'createdAt',
      render: (row) => <span className="text-slate-500 text-xs">{formatDate(row.createdAt)}</span>
    },
    {
      header: 'Actions',
      key: 'actions',
      render: (row) => (
        <div className="flex items-center gap-1" onClick={(e) => e.stopPropagation()}>
          <button
            onClick={() => navigate(`/admin/quotations/${row.id}`)}
            className="p-1.5 text-slate-500 hover:text-setu-600 hover:bg-slate-100 rounded transition-colors"
            title="View Quotation Profile"
          >
            <Eye className="w-4 h-4" />
          </button>

          <button
            onClick={() => navigate(`/admin/quotations/${row.id}/new-version`)}
            className="p-1.5 text-slate-500 hover:text-emerald-600 hover:bg-slate-100 rounded transition-colors"
            title="Create New Version (V+1)"
          >
            <GitBranch className="w-4 h-4" />
          </button>

          <button
            onClick={() => handleDuplicate(row.id, row.quotationNumber)}
            className="p-1.5 text-slate-500 hover:text-purple-600 hover:bg-slate-100 rounded transition-colors"
            title="Duplicate Quotation"
          >
            <Copy className="w-4 h-4" />
          </button>
        </div>
      )
    }
  ];

  return (
    <div className="space-y-6">
      {/* Header */}
      <PageHeader
        title="Quotations & Rate Cards Engine"
        description="Manage customer quotations, pricing rules, weight slabs and effective rate versions."
        breadcrumbs={['Speed Setu Admin', 'Commercial', 'Quotations & Rate Cards']}
        actions={
          <button
            onClick={() => navigate('/admin/quotations/new')}
            className="w-full sm:w-auto inline-flex items-center justify-center gap-2 px-4 py-2 text-xs font-bold text-white bg-setu-600 hover:bg-setu-700 rounded-md shadow-sm transition-colors"
          >
            <Plus className="w-4 h-4" />
            <span>New Quotation</span>
          </button>
        }
      />

      {/* Toast Notification */}
      {toastMessage && (
        <div className="p-3 bg-slate-900 text-white rounded-lg text-xs font-semibold flex items-center justify-between shadow-lg animate-fade-in">
          <span>{toastMessage}</span>
          <button onClick={() => setToastMessage('')} className="text-slate-400 hover:text-white font-bold">
            <X className="w-4 h-4" />
          </button>
        </div>
      )}

      {/* Search & Filter Controls Bar */}
      <div className="bg-white border border-slate-200 rounded-xl p-3.5 sm:p-4 shadow-xs space-y-3">
        <div className="flex flex-col md:flex-row items-center gap-3">
          <div className="w-full md:flex-1">
            <SearchBar
              value={search}
              onChange={setSearch}
              placeholder="Search company, quotation number, origin, destination route..."
            />
          </div>

          <div className="grid grid-cols-2 sm:grid-cols-3 md:flex md:items-center gap-2 w-full md:w-auto">
            {/* Company Select */}
            <select
              value={companyFilter}
              onChange={(e) => setCompanyFilter(e.target.value)}
              className="px-2.5 sm:px-3 py-2 text-xs bg-slate-50 border border-slate-200 rounded-md text-slate-700 font-medium focus:outline-none focus:ring-2 focus:ring-setu-600/20 w-full md:w-auto truncate"
            >
              <option value="All">All Companies</option>
              {companies.map((comp) => (
                <option key={comp.id} value={comp.id}>
                  {comp.companyName} ({comp.companyCode})
                </option>
              ))}
            </select>

            {/* Mode Select */}
            <select
              value={modeFilter}
              onChange={(e) => setModeFilter(e.target.value)}
              className="px-2.5 sm:px-3 py-2 text-xs bg-slate-50 border border-slate-200 rounded-md text-slate-700 font-medium focus:outline-none focus:ring-2 focus:ring-setu-600/20 w-full md:w-auto truncate"
            >
              <option value="All">All Freight Modes</option>
              {modeOptions.slice(1).map((m) => (
                <option key={m} value={m}>{m}</option>
              ))}
            </select>

            <button
              onClick={() => {
                setSearch('');
                setCompanyFilter('All');
                setStatusFilter('All');
                setModeFilter('All');
              }}
              className="col-span-2 sm:col-span-1 px-3 py-2 text-xs font-semibold text-slate-600 hover:text-slate-900 bg-slate-100 rounded-md transition-colors text-center shrink-0"
            >
              Reset
            </button>
          </div>
        </div>

        <div className="pt-2 border-t border-slate-100 flex flex-col sm:flex-row sm:items-center justify-between gap-2 text-xs">
          <div className="overflow-x-auto max-w-full pb-1">
            <FilterBar
              options={statusFilterOptions}
              activeFilter={statusFilter}
              onSelectFilter={setStatusFilter}
            />
          </div>
          <span className="text-slate-500 font-medium shrink-0 text-[11px] sm:text-xs">
            Showing <strong>{quotations.length}</strong> Rate Card Agreements
          </span>
        </div>
      </div>

      {/* Main Quotations Table */}
      {loading ? (
        <LoadingState message="Loading Rate Cards and Quotations Master..." />
      ) : error ? (
        <ErrorState message={error} onRetry={fetchData} />
      ) : (
        <DataTable
          columns={columns}
          data={quotations}
          onRowClick={(row) => navigate(`/admin/quotations/${row.id}`)}
          emptyMessage="No quotations found"
          emptySubtext="Try adjusting your company, status, or search filters."
        />
      )}
    </div>
  );
};
