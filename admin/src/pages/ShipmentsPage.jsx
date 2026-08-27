import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useSearch } from '../context/SearchContext';
import { shipmentService } from '../services/shipmentService';
import { companyService } from '../services/companyService';
import { formatDate } from '../utils/formatters';
import { PageHeader } from '../components/common/PageHeader';
import { DataTable } from '../components/common/DataTable';
import { StatusBadge } from '../components/common/StatusBadge';
import { SearchBar } from '../components/common/SearchBar';
import { FilterBar } from '../components/common/FilterBar';
import { LoadingState } from '../components/common/LoadingState';
import { ErrorState } from '../components/common/ErrorState';
import { DocumentUploadModal } from '../components/shipment/DocumentUploadModal';
import {
  Plus,
  Upload,
  Eye,
  Edit,
  Trash2,
  Truck,
  Package,
  X,
  FileText
} from 'lucide-react';

export const ShipmentsPage = () => {
  const navigate = useNavigate();
  const { searchQuery, setSearchQuery } = useSearch();
  const [shipments, setShipments] = useState([]);
  const [companies, setCompanies] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  // Filters
  const [search, setSearch] = useState(searchQuery || '');
  const [companyFilter, setCompanyFilter] = useState('All');
  const [statusFilter, setStatusFilter] = useState('All');
  const [modeFilter, setModeFilter] = useState('All');
  const [podStatusFilter, setPodStatusFilter] = useState('All');
  const [billingStatusFilter, setBillingStatusFilter] = useState('All');
  const [paymentStatusFilter, setPaymentStatusFilter] = useState('All');

  // Modal State
  const [showUploadModal, setShowUploadModal] = useState(false);
  const [toastMessage, setToastMessage] = useState('');

  // Keep local search synced with global header search query
  useEffect(() => {
    setSearch(searchQuery);
  }, [searchQuery]);

  const handleSearchChange = (val) => {
    setSearch(val);
    setSearchQuery(val);
  };

  const fetchData = async () => {
    setLoading(true);
    setError(null);
    try {
      const activeSearch = search || searchQuery || '';
      const [shipmentsData, compData] = await Promise.all([
        shipmentService.getShipments({
          search: activeSearch,
          companyId: companyFilter,
          status: statusFilter,
          mode: modeFilter,
          podStatus: podStatusFilter,
          billingStatus: billingStatusFilter,
          paymentStatus: paymentStatusFilter
        }),
        companyService.getCompanies()
      ]);

      setShipments(shipmentsData);
      setCompanies(compData);
    } catch (err) {
      setError(err.message || 'Failed to load shipments records.');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchData();
  }, [search, searchQuery, companyFilter, statusFilter, modeFilter, podStatusFilter, billingStatusFilter, paymentStatusFilter]);

  const statusFilterOptions = [
    { label: 'All Statuses', value: 'All' },
    { label: 'Booked', value: 'Booked' },
    { label: 'Picked Up', value: 'Picked Up' },
    { label: 'In Transit', value: 'In Transit' },
    { label: 'Reached Destination', value: 'Reached Destination' },
    { label: 'Out for Delivery', value: 'Out for Delivery' },
    { label: 'Delivered', value: 'Delivered' },
    { label: 'Delayed', value: 'Delayed' },
  ];

  const modeOptions = ['All', 'Air', 'Air Express', 'Road', 'Train', 'FTL', 'Express LTL', 'Other'];
  const podOptions = ['All', 'Pending', 'Uploaded', 'Verified', 'Missing'];
  const billingOptions = ['All', 'Not Ready', 'Ready for Billing', 'Draft', 'Generated', 'Sent', 'Billed', 'Paid', 'Overdue'];
  const paymentOptions = ['All', 'Paid', 'Partially Paid', 'Unpaid', 'Unbilled'];

  const columns = [
    {
      header: 'CN Number',
      accessor: 'cnNumber',
      render: (row) => (
        <div>
          <span
            onClick={() => navigate(`/admin/shipments/${row.id}`)}
            className="font-bold text-setu-600 font-mono hover:underline cursor-pointer block"
          >
            {row.cnNumber}
          </span>
          {row.awbNumber && (
            <span className="text-[10px] text-slate-500 font-mono block">AWB: {row.awbNumber}</span>
          )}
        </div>
      )
    },
    {
      header: 'CN Date',
      accessor: 'cnDate',
      render: (row) => <span className="font-mono text-slate-700 text-xs">{formatDate(row.cnDate)}</span>
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
      header: 'Consignor',
      accessor: 'consignor',
      render: (row) => (
        <div>
          <span className="font-semibold text-slate-800 block text-xs truncate max-w-[140px]">{row.consignor?.name}</span>
          <span className="text-[10px] text-slate-400">{row.consignor?.city}</span>
        </div>
      )
    },
    {
      header: 'Consignee',
      accessor: 'consignee',
      render: (row) => (
        <div>
          <span className="font-semibold text-slate-800 block text-xs truncate max-w-[140px]">{row.consignee?.name}</span>
          <span className="text-[10px] text-slate-400">{row.consignee?.city}</span>
        </div>
      )
    },
    {
      header: 'Origin → Dest',
      accessor: 'origin',
      render: (row) => (
        <div className="text-xs">
          <span className="font-semibold text-slate-900">{row.origin}</span>
          <span className="text-slate-400 block text-[10px]">→ {row.destination}</span>
        </div>
      )
    },
    {
      header: 'Mode',
      accessor: 'mode',
      render: (row) => (
        <span className="px-2 py-0.5 rounded text-[11px] font-semibold bg-slate-100 text-slate-700">
          {row.mode}
        </span>
      )
    },
    {
      header: 'Packages',
      accessor: 'packages',
      align: 'center',
      render: (row) => {
        const pkg = row.packages;
        if (!pkg) return <span className="font-bold text-slate-800">1 Box</span>;
        const str = String(pkg).trim();
        const display = /^\d+$/.test(str) ? `${str} ${parseInt(str, 10) === 1 ? 'Box' : 'Boxes'}` : str;
        return <span className="font-bold text-slate-800">{display}</span>;
      }
    },
    {
      header: 'Weight (Act / Chg)',
      accessor: 'actualWeight',
      align: 'right',
      render: (row) => (
        <div className="text-xs text-right font-mono">
          <span className="font-bold text-slate-900">{row.actualWeight} Kg</span>
          <span className="text-[10px] text-slate-500 block">Chg: {row.chargeableWeight} Kg</span>
        </div>
      )
    },
    {
      header: 'Status',
      accessor: 'status',
      render: (row) => <StatusBadge status={row.status} />
    },
    {
      header: 'POD',
      accessor: 'podStatus',
      render: (row) => <StatusBadge status={row.podStatus} />
    },
    {
      header: 'Billing',
      accessor: 'billingStatus',
      render: (row) => <StatusBadge status={row.billingStatus} />
    },
    {
      header: 'Payment Status',
      accessor: 'paymentStatus',
      render: (row) => {
        const st = row.paymentStatus || 'Unbilled';
        if (st === 'Paid') {
          return (
            <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[11px] font-bold bg-emerald-100 text-emerald-800 border border-emerald-300">
              <span className="w-1.5 h-1.5 rounded-full bg-emerald-500"></span>
              Paid
            </span>
          );
        } else if (st === 'Partially Paid') {
          return (
            <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[11px] font-bold bg-amber-100 text-amber-800 border border-amber-300">
              <span className="w-1.5 h-1.5 rounded-full bg-amber-500"></span>
              Partially Paid
            </span>
          );
        } else if (st === 'Unpaid') {
          return (
            <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[11px] font-bold bg-rose-100 text-rose-800 border border-rose-300">
              <span className="w-1.5 h-1.5 rounded-full bg-rose-500"></span>
              Unpaid
            </span>
          );
        } else {
          return (
            <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[11px] font-bold bg-slate-100 text-slate-600 border border-slate-300">
              <span className="w-1.5 h-1.5 rounded-full bg-slate-400"></span>
              Unbilled
            </span>
          );
        }
      }
    },
    {
      header: 'Actions',
      key: 'actions',
      render: (row) => (
        <div className="flex items-center gap-1" onClick={(e) => e.stopPropagation()}>
          <button
            onClick={() => navigate(`/admin/shipments/${row.id}`)}
            className="p-1.5 text-slate-500 hover:text-setu-600 hover:bg-slate-100 rounded transition-colors"
            title="View Full Shipment Details"
          >
            <Eye className="w-4 h-4" />
          </button>

          <button
            onClick={() => navigate(`/admin/shipments/${row.id}/edit`)}
            className="p-1.5 text-slate-500 hover:text-blue-600 hover:bg-slate-100 rounded transition-colors"
            title="Edit Shipment"
          >
            <Edit className="w-4 h-4" />
          </button>

          <button
            onClick={async (e) => {
              e.stopPropagation();
              const cn = row.cnNumber || row.id;
              if (window.confirm(`Are you sure you want to delete Consignment Note ${cn}? This action cannot be undone.`)) {
                try {
                  await shipmentService.deleteShipment(row.id || cn);
                  setToastMessage(`Consignment Note ${cn} deleted successfully.`);
                  fetchData();
                } catch (err) {
                  alert(`Failed to delete shipment ${cn}: ${err.message}`);
                }
              }
            }}
            className="p-1.5 text-slate-400 hover:text-rose-600 hover:bg-rose-50 rounded transition-colors"
            title="Delete Consignment Note (CN)"
          >
            <Trash2 className="w-4 h-4" />
          </button>
        </div>
      )
    }
  ];

  return (
    <div className="space-y-6">
      {/* Header */}
      <PageHeader
        title="Shipments Management"
        description="Manage Consignment Notes (CN), track dispatch status, and monitor linehaul movements."
        breadcrumbs={['Speed Setu Admin', 'Operations', 'Shipments']}
        actions={
          <div className="flex flex-wrap items-center gap-2 w-full sm:w-auto">
            <button
              onClick={() => setShowUploadModal(true)}
              className="inline-flex items-center justify-center gap-2 px-3.5 py-2 text-xs font-bold text-slate-700 bg-white border border-slate-300 hover:bg-slate-50 rounded-md shadow-xs transition-colors flex-1 sm:flex-initial"
            >
              <Upload className="w-4 h-4 text-setu-600" />
              <span>Upload Document</span>
            </button>

            <button
              onClick={() => navigate('/admin/shipments/new')}
              className="inline-flex items-center justify-center gap-2 px-4 py-2 text-xs font-bold text-white bg-setu-600 hover:bg-setu-700 rounded-md shadow-sm transition-colors flex-1 sm:flex-initial"
            >
              <Plus className="w-4 h-4" />
              <span>New Shipment</span>
            </button>
          </div>
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

      {/* Search & Multi-Filter Controls Bar */}
      <div className="bg-white border border-slate-200 rounded-xl p-3.5 sm:p-4 shadow-xs space-y-3">
        <div className="flex flex-col md:flex-row items-center gap-3">
          <div className="w-full md:flex-1">
            <SearchBar
              value={search}
              onChange={handleSearchChange}
              placeholder="Search CN number, company, consignor, consignee, origin, destination, invoice..."
            />
          </div>

          <div className="grid grid-cols-2 sm:flex sm:items-center gap-2 w-full md:w-auto">
            {/* Company Filter */}
            <select
              value={companyFilter}
              onChange={(e) => setCompanyFilter(e.target.value)}
              className="px-2.5 sm:px-3 py-2 text-xs bg-slate-50 border border-slate-200 rounded-md text-slate-700 font-medium focus:outline-none focus:ring-2 focus:ring-setu-600/20 w-full sm:w-auto"
            >
              <option value="All">All Companies</option>
              {companies.map((c) => (
                <option key={c.id} value={c.id}>{c.companyName} ({c.companyCode})</option>
              ))}
            </select>

            {/* Mode Filter */}
            <select
              value={modeFilter}
              onChange={(e) => setModeFilter(e.target.value)}
              className="px-2.5 sm:px-3 py-2 text-xs bg-slate-50 border border-slate-200 rounded-md text-slate-700 font-medium focus:outline-none focus:ring-2 focus:ring-setu-600/20 w-full sm:w-auto"
            >
              <option value="All">All Modes</option>
              {modeOptions.slice(1).map((m) => (
                <option key={m} value={m}>{m}</option>
              ))}
            </select>

            {/* POD Status Filter */}
            <select
              value={podStatusFilter}
              onChange={(e) => setPodStatusFilter(e.target.value)}
              className="px-2.5 sm:px-3 py-2 text-xs bg-slate-50 border border-slate-200 rounded-md text-slate-700 font-medium focus:outline-none focus:ring-2 focus:ring-setu-600/20 w-full sm:w-auto"
            >
              <option value="All">POD Status</option>
              {podOptions.slice(1).map((p) => (
                <option key={p} value={p}>{p}</option>
              ))}
            </select>

            {/* Payment Status Filter */}
            <select
              value={paymentStatusFilter}
              onChange={(e) => setPaymentStatusFilter(e.target.value)}
              className="px-2.5 sm:px-3 py-2 text-xs bg-slate-50 border border-slate-200 rounded-md text-slate-700 font-medium focus:outline-none focus:ring-2 focus:ring-setu-600/20 w-full sm:w-auto truncate"
            >
              <option value="All">Payment Status</option>
              {paymentOptions.slice(1).map((p) => (
                <option key={p} value={p}>{p}</option>
              ))}
            </select>

            <button
              onClick={() => {
                setSearch('');
                setCompanyFilter('All');
                setStatusFilter('All');
                setModeFilter('All');
                setPodStatusFilter('All');
                setBillingStatusFilter('All');
                setPaymentStatusFilter('All');
              }}
              className="col-span-2 sm:col-span-1 px-3 py-2 text-xs font-semibold text-slate-600 hover:text-slate-900 bg-slate-100 rounded-md transition-colors text-center"
            >
              Reset
            </button>
          </div>
        </div>

        <div className="pt-2.5 border-t border-slate-100 flex flex-col sm:flex-row sm:items-center justify-between gap-2 text-xs">
          <div className="overflow-x-auto min-w-0 w-full sm:w-auto">
            <FilterBar
              options={statusFilterOptions}
              activeFilter={statusFilter}
              onSelectFilter={setStatusFilter}
            />
          </div>
          <span className="text-slate-500 font-medium shrink-0 text-[11px] sm:text-xs">
            Showing <strong>{shipments.length}</strong> Consignment Notes
          </span>
        </div>
      </div>

      {/* Main Shipments Table */}
      {loading ? (
        <LoadingState message="Loading Speed Setu Consignment Notes..." />
      ) : error ? (
        <ErrorState message={error} onRetry={fetchData} />
      ) : (
        <DataTable
          columns={columns}
          data={shipments}
          onRowClick={(row) => navigate(`/admin/shipments/${row.id}`)}
          emptyMessage="No shipments found"
          emptySubtext="Try adjusting your search query, status, or date filters."
        />
      )}

      {/* Document Upload Modal */}
      <DocumentUploadModal
        isOpen={showUploadModal}
        onClose={() => setShowUploadModal(false)}
        onUploadSuccess={() => {
          setToastMessage('Document uploaded successfully!');
          fetchData();
          setTimeout(() => setToastMessage(''), 4000);
        }}
      />
    </div>
  );
};
