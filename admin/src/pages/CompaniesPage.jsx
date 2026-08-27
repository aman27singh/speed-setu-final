import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { companyService } from '../services/companyService';
import { formatINR } from '../utils/formatters';
import { PageHeader } from '../components/common/PageHeader';
import { DataTable } from '../components/common/DataTable';
import { StatusBadge } from '../components/common/StatusBadge';
import { SearchBar } from '../components/common/SearchBar';
import { FilterBar } from '../components/common/FilterBar';
import { LoadingState } from '../components/common/LoadingState';
import { ErrorState } from '../components/common/ErrorState';
import { Modal } from '../components/common/Modal';
import {
  Plus,
  Building2,
  Phone,
  Mail,
  Edit,
  Eye,
  Trash2,
  AlertTriangle,
  RefreshCw,
  X
} from 'lucide-react';

export const CompaniesPage = () => {
  const navigate = useNavigate();
  const [companies, setCompanies] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  // Filter States
  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState('All');
  const [paymentTermsFilter, setPaymentTermsFilter] = useState('All');
  const [stateFilter, setStateFilter] = useState('All');

  // Deactivation Modal State
  const [deactivateTarget, setDeactivateTarget] = useState(null);
  const [toastMessage, setToastMessage] = useState('');

  const fetchCompanies = async () => {
    setLoading(true);
    setError(null);
    try {
      const data = await companyService.getCompanies({
        search,
        status: statusFilter,
        state: stateFilter,
        paymentTerms: paymentTermsFilter,
      });
      setCompanies(data);
    } catch (err) {
      setError(err.message || 'Failed to load company records.');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchCompanies();
  }, [search, statusFilter, stateFilter, paymentTermsFilter]);

  const handleConfirmDeactivate = async () => {
    if (!deactivateTarget) return;
    try {
      await companyService.deactivateCompany(deactivateTarget.id);
      setToastMessage(`Company '${deactivateTarget.companyName}' has been deactivated. Historical records preserved.`);
      setDeactivateTarget(null);
      fetchCompanies();
      setTimeout(() => setToastMessage(''), 4000);
    } catch (err) {
      alert(err.message || 'Failed to deactivate company.');
    }
  };

  const statusFilterOptions = [
    { label: 'All Statuses', value: 'All' },
    { label: 'Active', value: 'Active' },
    { label: 'Inactive', value: 'Inactive' },
  ];

  const paymentTermsOptions = ['All', 'Due on Receipt', '7 Days', '15 Days', '30 Days', '45 Days', '60 Days'];
  const stateOptions = ['All', 'Karnataka', 'Haryana', 'Jharkhand', 'Delhi', 'Maharashtra', 'Gujarat', 'Uttar Pradesh'];

  const columns = [
    {
      header: 'Company Code',
      accessor: 'companyCode',
      render: (row) => (
        <span
          onClick={() => navigate(`/admin/companies/${row.id}`)}
          className="font-bold text-setu-600 font-mono hover:underline cursor-pointer"
        >
          {row.companyCode}
        </span>
      )
    },
    {
      header: 'Company Name',
      accessor: 'companyName',
      render: (row) => (
        <div>
          <span
            onClick={() => navigate(`/admin/companies/${row.id}`)}
            className="font-bold text-slate-900 hover:text-setu-600 cursor-pointer block"
          >
            {row.companyName}
          </span>
          <span className="text-[10px] text-slate-400 font-mono">{row.companyType}</span>
        </div>
      )
    },
    {
      header: 'GSTIN',
      accessor: 'gstin',
      render: (row) => <span className="font-mono text-slate-600 text-xs">{row.gstin || '-'}</span>
    },
    {
      header: 'Primary Contact',
      accessor: 'primaryContact',
      render: (row) => (
        <div>
          <span className="font-medium text-slate-900 block">{row.primaryContact?.name || '-'}</span>
          <span className="text-[11px] text-slate-500">{row.primaryContact?.designation || ''}</span>
        </div>
      )
    },
    {
      header: 'Phone',
      accessor: 'primaryContact',
      render: (row) => <span className="font-mono text-slate-700 text-xs">{row.primaryContact?.phone || '-'}</span>
    },
    {
      header: 'Email',
      accessor: 'primaryContact',
      render: (row) => <span className="text-slate-600 text-xs font-mono">{row.primaryContact?.email || '-'}</span>
    },
    {
      header: 'Payment Terms',
      accessor: 'billing',
      render: (row) => (
        <span className="px-2 py-0.5 rounded text-[11px] font-semibold bg-slate-100 text-slate-700">
          {row.billing?.paymentTerms || '30 Days'}
        </span>
      )
    },
    {
      header: 'Shipments',
      accessor: 'totalShipments',
      align: 'center',
      render: (row) => <span className="font-bold text-slate-800">{row.totalShipments ?? row.kpis?.totalShipments ?? 0}</span>
    },
    {
      header: 'Outstanding',
      accessor: 'outstandingAmount',
      align: 'right',
      render: (row) => {
        const val = row.outstandingAmount ?? row.outstanding ?? row.kpis?.outstandingAmount ?? row.kpis?.outstanding ?? 0;
        return (
          <span className={`font-bold ${val > 0 ? 'text-rose-600' : 'text-slate-700'}`}>
            {formatINR(val)}
          </span>
        );
      }
    },
    {
      header: 'Status',
      accessor: 'status',
      render: (row) => <StatusBadge status={row.status} />
    },
    {
      header: 'Actions',
      key: 'actions',
      render: (row) => (
        <div className="flex items-center gap-1.5" onClick={(e) => e.stopPropagation()}>
          <button
            onClick={() => navigate(`/admin/companies/${row.id}`)}
            className="p-1.5 text-slate-500 hover:text-setu-600 hover:bg-slate-100 rounded transition-colors"
            title="View Company Profile"
          >
            <Eye className="w-4 h-4" />
          </button>

          <button
            onClick={() => navigate(`/admin/companies/${row.id}/edit`)}
            className="p-1.5 text-slate-500 hover:text-blue-600 hover:bg-slate-100 rounded transition-colors"
            title="Edit Company"
          >
            <Edit className="w-4 h-4" />
          </button>

          {row.status === 'Active' && (
            <button
              onClick={() => setDeactivateTarget(row)}
              className="p-1.5 text-slate-400 hover:text-rose-600 hover:bg-rose-50 rounded transition-colors"
              title="Deactivate Company"
            >
              <Trash2 className="w-4 h-4" />
            </button>
          )}
        </div>
      )
    }
  ];

  return (
    <div className="space-y-6">
      {/* Header */}
      <PageHeader
        title="Companies Master Directory"
        description="Manage corporate customers, billing GSTINs, and credit terms for Speed Setu logistics."
        breadcrumbs={['Speed Setu Admin', 'Commercial', 'Companies']}
        actions={
          <button
            onClick={() => navigate('/admin/companies/new')}
            className="inline-flex items-center gap-2 px-4 py-2 text-xs font-bold text-white bg-setu-600 hover:bg-setu-700 rounded-md shadow-sm transition-colors"
          >
            <Plus className="w-4 h-4" />
            <span>Add Company</span>
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

      {/* Filter Controls Bar */}
      <div className="bg-white border border-slate-200 rounded-xl p-4 shadow-xs space-y-3">
        <div className="flex flex-col md:flex-row items-center gap-3">
          <div className="w-full md:flex-1">
            <SearchBar
              value={search}
              onChange={setSearch}
              placeholder="Search company name, GSTIN, code, contact, phone, email..."
            />
          </div>

          <div className="flex items-center gap-2 w-full md:w-auto overflow-x-auto">
            {/* Payment Terms Select */}
            <select
              value={paymentTermsFilter}
              onChange={(e) => setPaymentTermsFilter(e.target.value)}
              className="px-3 py-2 text-xs bg-slate-50 border border-slate-200 rounded-md text-slate-700 font-medium focus:outline-none focus:ring-2 focus:ring-setu-600/20"
            >
              <option value="All">All Payment Terms</option>
              {paymentTermsOptions.slice(1).map((term) => (
                <option key={term} value={term}>{term}</option>
              ))}
            </select>

            {/* State Select */}
            <select
              value={stateFilter}
              onChange={(e) => setStateFilter(e.target.value)}
              className="px-3 py-2 text-xs bg-slate-50 border border-slate-200 rounded-md text-slate-700 font-medium focus:outline-none focus:ring-2 focus:ring-setu-600/20"
            >
              <option value="All">All States</option>
              {stateOptions.slice(1).map((st) => (
                <option key={st} value={st}>{st}</option>
              ))}
            </select>

            <button
              onClick={() => {
                setSearch('');
                setStatusFilter('All');
                setPaymentTermsFilter('All');
                setStateFilter('All');
              }}
              className="px-3 py-2 text-xs font-semibold text-slate-600 hover:text-slate-900 bg-slate-100 rounded-md transition-colors"
            >
              Reset
            </button>
          </div>
        </div>

        <div className="pt-2 border-t border-slate-100 flex items-center justify-between text-xs">
          <FilterBar
            options={statusFilterOptions}
            activeFilter={statusFilter}
            onSelectFilter={setStatusFilter}
          />
          <span className="text-slate-500 font-medium">
            Showing <strong>{companies.length}</strong> Corporate Clients
          </span>
        </div>
      </div>

      {/* Main Companies Table */}
      {loading ? (
        <LoadingState message="Loading Corporate Companies Directory..." />
      ) : error ? (
        <ErrorState message={error} onRetry={fetchCompanies} />
      ) : (
        <DataTable
          columns={columns}
          data={companies}
          onRowClick={(row) => navigate(`/admin/companies/${row.id}`)}
          emptyMessage="No companies found"
          emptySubtext="Try adjusting your search query, status, or state filters."
        />
      )}

      {/* DEACTIVATION SAFEGUARD MODAL */}
      <Modal
        isOpen={!!deactivateTarget}
        onClose={() => setDeactivateTarget(null)}
        title="Confirm Company Deactivation"
        footer={
          <>
            <button
              onClick={() => setDeactivateTarget(null)}
              className="px-3 py-1.5 text-xs font-semibold text-slate-700 bg-white border border-slate-300 rounded"
            >
              Cancel
            </button>
            <button
              onClick={handleConfirmDeactivate}
              className="px-3.5 py-1.5 text-xs font-bold text-white bg-rose-600 hover:bg-rose-700 rounded shadow-sm"
            >
              Deactivate Company
            </button>
          </>
        }
      >
        {deactivateTarget && (
          <div className="space-y-3 text-xs">
            <div className="p-3 bg-rose-50 border border-rose-200 rounded-lg text-rose-800 flex items-start gap-2.5">
              <AlertTriangle className="w-5 h-5 text-rose-600 shrink-0 mt-0.5" />
              <div>
                <p className="font-bold text-rose-900 text-sm">
                  Are you sure you want to deactivate {deactivateTarget.companyName}?
                </p>
                <p className="text-rose-700 mt-1">
                  Historical shipments, invoices, and payments for <strong>{deactivateTarget.companyCode}</strong> will remain permanently available for accounting and legal audit logs.
                </p>
              </div>
            </div>

            <p className="text-slate-600">
              Deactivating a company prevents dispatchers from selecting it for new operational bookings and rate cards, but preserves all historical data intact.
            </p>

            <div className="p-3 bg-slate-50 rounded-lg border border-slate-200 space-y-1 font-mono text-[11px]">
              <div><strong>Company Code:</strong> {deactivateTarget.companyCode}</div>
              <div><strong>GSTIN:</strong> {deactivateTarget.gstin || 'N/A'}</div>
              <div><strong>Total Historical Shipments:</strong> {deactivateTarget.kpis?.totalShipments || 0}</div>
            </div>
          </div>
        )}
      </Modal>
    </div>
  );
};
