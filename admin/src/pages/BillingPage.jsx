import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { billingService } from '../services/billingService';
import { companyService } from '../services/companyService';
import { formatINR, formatDate } from '../utils/formatters';
import { PageHeader } from '../components/common/PageHeader';
import { KPICard } from '../components/common/KPICard';
import { DataTable } from '../components/common/DataTable';
import { StatusBadge } from '../components/common/StatusBadge';
import { SearchBar } from '../components/common/SearchBar';
import { FilterBar } from '../components/common/FilterBar';
import { LoadingState } from '../components/common/LoadingState';
import { ErrorState } from '../components/common/ErrorState';
import { DateRangeBillingModal } from '../components/billing/DateRangeBillingModal';
import {
  FileText,
  Clock,
  DollarSign,
  Send,
  AlertCircle,
  Plus,
  Eye,
  Trash2,
  CheckCircle2,
  AlertTriangle,
  ArrowRight,
  Printer,
  Sparkles
} from 'lucide-react';

export const BillingPage = () => {
  const navigate = useNavigate();
  const [activeTab, setActiveTab] = useState('invoices'); // 'invoices' | 'ready'
  const [showDateRangeModal, setShowDateRangeModal] = useState(false);
  const [dashboardMetrics, setDashboardMetrics] = useState({});
  const [invoices, setInvoices] = useState([]);
  const [readyShipments, setReadyShipments] = useState([]);
  const [companies, setCompanies] = useState([]);

  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState('All');
  const [companyFilter, setCompanyFilter] = useState('All');

  const fetchBillingData = async () => {
    setLoading(true);
    setError(null);
    try {
      const [metrics, invData, readyData, compData] = await Promise.all([
        billingService.getBillingDashboard(),
        billingService.getInvoices({ search, status: statusFilter, companyId: companyFilter }),
        billingService.getReadyForBillingShipments(),
        companyService.getCompanies()
      ]);

      setDashboardMetrics(metrics);
      setInvoices(invData);
      setReadyShipments(readyData);
      setCompanies(compData);
    } catch (err) {
      setError(err.message || 'Failed to load billing dashboard data.');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchBillingData();
  }, [search, statusFilter, companyFilter]);

  const statusOptions = [
    { label: 'All Invoices', value: 'All' },
    { label: 'Generated', value: 'Generated' },
    { label: 'Sent', value: 'Sent' },
    { label: 'Paid', value: 'Paid' },
    { label: 'Partially Paid', value: 'Partially Paid' },
    { label: 'Overdue', value: 'Overdue' },
    { label: 'Disputed', value: 'Disputed' },
    { label: 'Cancelled', value: 'Cancelled' }
  ];

  const invoiceColumns = [
    {
      header: 'Invoice Number',
      accessor: 'invoiceNumber',
      render: (row) => (
        <span
          onClick={() => navigate(`/admin/billing/invoices/${row.id}`)}
          className="font-bold text-setu-600 font-mono hover:underline cursor-pointer"
        >
          {row.invoiceNumber}
        </span>
      )
    },
    {
      header: 'Invoice Date',
      accessor: 'invoiceDate',
      render: (row) => <span className="font-mono text-xs text-slate-700">{formatDate(row.invoiceDate)}</span>
    },
    {
      header: 'Company',
      accessor: 'companyName',
      render: (row) => <span className="font-bold text-slate-900 text-xs">{row.companyName}</span>
    },
    {
      header: 'CN Numbers',
      accessor: 'cns',
      render: (row) => {
        const cnList = (Array.isArray(row.cns) && row.cns.length > 0)
          ? row.cns
          : (Array.isArray(row.shipmentIds) && row.shipmentIds.length > 0)
          ? row.shipmentIds
          : (Array.isArray(row.dockets) && row.dockets.length > 0)
          ? row.dockets.map(d => d.docketNo || d.cnNumber).filter(Boolean)
          : (row.cnNumber ? [row.cnNumber] : (row.shipment?.cnNumber ? [row.shipment.cnNumber] : []));

        return (
          <span className="font-mono text-xs font-semibold text-slate-800">
            {cnList.length > 0 ? cnList.join(', ') : '-'}
          </span>
        );
      }
    },
    {
      header: 'Taxable Amount',
      accessor: 'taxableAmount',
      align: 'right',
      render: (row) => <span className="font-mono text-xs text-slate-700">{formatINR(row.taxableAmount)}</span>
    },
    {
      header: 'GST',
      accessor: 'gstAmount',
      align: 'right',
      render: (row) => <span className="font-mono text-xs text-slate-700">{formatINR(row.gstAmount)}</span>
    },
    {
      header: 'Grand Total',
      accessor: 'grandTotal',
      align: 'right',
      render: (row) => <span className="font-mono text-xs font-bold text-slate-900">{formatINR(row.grandTotal)}</span>
    },
    {
      header: 'Status',
      accessor: 'status',
      render: (row) => <StatusBadge status={row.status} />
    },
    {
      header: 'Due Date',
      accessor: 'dueDate',
      render: (row) => <span className="font-mono text-xs text-slate-600">{formatDate(row.dueDate)}</span>
    },
    {
      header: 'Actions',
      key: 'actions',
      render: (row) => (
        <div className="flex items-center gap-1" onClick={(e) => e.stopPropagation()}>
          <button
            onClick={() => navigate(`/admin/billing/invoices/${row.id}`)}
            className="p-1.5 text-slate-500 hover:text-setu-600 hover:bg-slate-100 rounded transition-colors"
            title="View Invoice Profile"
          >
            <Eye className="w-4 h-4" />
          </button>

          <button
            onClick={async (e) => {
              e.stopPropagation();
              const invNum = row.invoiceNumber || row.id;
              if (window.confirm(`Are you sure you want to delete Invoice ${invNum}? This action cannot be undone.`)) {
                try {
                  await billingService.deleteInvoice(row.id || invNum);
                  fetchBillingData();
                } catch (err) {
                  alert(`Failed to delete invoice ${invNum}: ${err.message}`);
                }
              }
            }}
            className="p-1.5 text-slate-400 hover:text-rose-600 hover:bg-rose-50 rounded transition-colors"
            title="Delete Invoice"
          >
            <Trash2 className="w-4 h-4" />
          </button>
        </div>
      )
    }
  ];

  const readyColumns = [
    {
      header: 'CN Number',
      accessor: 'cnNumber',
      render: (row) => <span className="font-bold text-setu-600 font-mono">{row.cnNumber}</span>
    },
    {
      header: 'Company',
      accessor: 'companyName',
      render: (row) => <span className="font-bold text-slate-900 text-xs">{row.companyName}</span>
    },
    {
      header: 'Route & Mode',
      accessor: 'origin',
      render: (row) => (
        <span className="text-xs text-slate-700 font-medium">
          {row.origin} → {row.destination} ({row.mode})
        </span>
      )
    },
    {
      header: 'Chargeable Weight',
      accessor: 'chargeableWeight',
      align: 'center',
      render: (row) => <span className="font-mono text-xs font-bold">{row.chargeableWeight} Kg</span>
    },
    {
      header: 'Applicable Rate Card',
      accessor: 'matchedQuotation',
      render: (row) => (
        <span className="px-2 py-0.5 rounded text-[10px] font-bold bg-blue-50 text-setu-700 border border-blue-100">
          {row.matchedQuotation}
        </span>
      )
    },
    {
      header: 'Estimated Total',
      accessor: 'estimatedTotal',
      align: 'right',
      render: (row) => <span className="font-mono font-bold text-slate-900 text-xs">{formatINR(row.estimatedTotal)}</span>
    },
    {
      header: 'Action',
      key: 'actions',
      render: (row) => (
        <button
          onClick={() => navigate(`/admin/billing/create?shipmentId=${row.cnNumber}`)}
          className="inline-flex items-center gap-1 px-3 py-1 text-xs font-bold text-white bg-setu-600 hover:bg-setu-700 rounded transition-colors shadow-xs"
        >
          <span>Review Bill</span>
          <ArrowRight className="w-3.5 h-3.5" />
        </button>
      )
    }
  ];

  const validInvoices = invoices.filter(
    (i) => (i.status || '').toLowerCase() !== 'cancelled' && (i.status || '').toLowerCase() !== 'void'
  );

  const liveReadyCount = readyShipments.length;
  const liveDraftCount = validInvoices.filter((i) => i.status === 'Draft').length;
  const liveGeneratedTotal = validInvoices.reduce((acc, i) => acc + (i.grandTotal || i.totalAmount || 0), 0);
  const liveSentAmount = validInvoices.filter((i) => i.status === 'Sent').reduce((acc, i) => acc + (i.grandTotal || i.totalAmount || 0), 0);
  const liveOutstandingAmount = validInvoices.reduce((acc, i) => acc + (i.balanceAmount ?? i.balanceDue ?? (i.grandTotal || 0)), 0);
  const liveDisputedCount = validInvoices.filter((i) => i.status === 'Disputed').length;

  return (
    <div className="space-y-6">
      <PageHeader
        title="Billing & Automatic Invoicing"
        description="CN-Based & Trip-Based On-Demand Billing Engine. Generate invoices per Consignment Note or select multiple CNs by Date Range without date-cycle restrictions."
        breadcrumbs={['Speed Setu Admin', 'Finance', 'Billing']}
        actions={
          <button
            onClick={() => setShowDateRangeModal(true)}
            className="inline-flex items-center justify-center gap-2 px-3.5 sm:px-4 py-2 text-xs font-bold text-white bg-setu-600 hover:bg-setu-700 rounded-md shadow-sm transition-colors cursor-pointer w-full sm:w-auto"
          >
            <Plus className="w-4 h-4" />
            <span>Generate New Invoice</span>
          </button>
        }
      />

      {/* TOP KPI CARDS STRIP */}
      <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-2.5 sm:gap-3">
        <KPICard title="Ready for Billing" value={dashboardMetrics.readyForBillingCount ?? liveReadyCount} subtext="Un-invoiced shipments" icon={Clock} variant="warning" />
        <KPICard title="Draft Invoices" value={dashboardMetrics.draftCount ?? liveDraftCount} subtext="Awaiting review" icon={FileText} variant="default" />
        <KPICard title="Generated Total" value={formatINR(dashboardMetrics.generatedThisMonth ?? liveGeneratedTotal)} subtext="Total freight billed" icon={DollarSign} variant="accent" />
        <KPICard title="Sent Invoices" value={formatINR(dashboardMetrics.sentAmount ?? liveSentAmount)} subtext="Dispatched to customer" icon={Send} variant="default" />
        <KPICard title="Outstanding" value={formatINR(dashboardMetrics.outstandingAmount ?? liveOutstandingAmount)} subtext="Balance due" icon={AlertCircle} variant="default" />
        <KPICard title="Disputed" value={dashboardMetrics.disputedCount ?? liveDisputedCount} subtext="Under customer review" icon={AlertTriangle} variant="danger" />
      </div>

      {/* MAIN TABS: INVOICES MASTER vs READY FOR BILLING QUEUE */}
      <div className="bg-white border border-slate-200 rounded-xl p-3.5 sm:p-4 shadow-xs space-y-4">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between border-b border-slate-100 pb-3 gap-3">
          <div className="flex items-center gap-2">
            <button
              onClick={() => setActiveTab('invoices')}
              className={`px-4 py-2 text-xs font-bold rounded-lg transition-colors ${
                activeTab === 'invoices' ? 'bg-setu-600 text-white shadow-xs' : 'text-slate-600 hover:bg-slate-100'
              }`}
            >
              All Invoices ({invoices.length})
            </button>
            <button
              onClick={() => setActiveTab('ready')}
              className={`px-4 py-2 text-xs font-bold rounded-lg transition-colors flex items-center gap-1.5 ${
                activeTab === 'ready' ? 'bg-setu-600 text-white shadow-xs' : 'text-slate-600 hover:bg-slate-100'
              }`}
            >
              <span>Ready for Billing Queue</span>
              <span className="px-1.5 py-0.2 rounded-full text-[10px] bg-amber-100 text-amber-800 font-extrabold">
                {readyShipments.length}
              </span>
            </button>
          </div>

          {activeTab === 'invoices' && (
            <div className="flex items-center gap-2">
              <select
                value={companyFilter}
                onChange={(e) => setCompanyFilter(e.target.value)}
                className="px-3 py-1.5 text-xs bg-slate-50 border border-slate-200 rounded-md font-medium text-slate-700"
              >
                <option value="All">All Companies</option>
                {companies.map((c) => (
                  <option key={c.id} value={c.companyName}>{c.companyName}</option>
                ))}
              </select>
            </div>
          )}
        </div>

        {activeTab === 'invoices' && (
          <div className="space-y-3">
            <SearchBar
              value={search}
              onChange={setSearch}
              placeholder="Search invoice number, CN number, company name..."
            />

            <div className="pt-2 border-t border-slate-100 flex items-center justify-between text-xs">
              <FilterBar
                options={statusOptions}
                activeFilter={statusFilter}
                onSelectFilter={setStatusFilter}
              />
              <span className="text-slate-500 font-medium">
                Showing <strong>{invoices.length}</strong> Freight Invoices
              </span>
            </div>
          </div>
        )}
      </div>

      {/* DATA TABLES */}
      {loading ? (
        <LoadingState message="Loading Billing & Invoicing Workspace..." />
      ) : error ? (
        <ErrorState message={error} onRetry={fetchBillingData} />
      ) : activeTab === 'invoices' ? (
        <DataTable
          columns={invoiceColumns}
          data={invoices}
          onRowClick={(row) => navigate(`/admin/billing/invoices/${row.id}`)}
          emptyMessage="No invoices found"
          emptySubtext="Try adjusting your search criteria or generate a new invoice."
        />
      ) : (
        <DataTable
          columns={readyColumns}
          data={readyShipments}
          emptyMessage="No shipments currently ready for billing"
          emptySubtext="All valid shipments have been invoiced."
        />
      )}

      {/* DATE RANGE MULTI-CN BILLING BUILDER MODAL */}
      <DateRangeBillingModal
        isOpen={showDateRangeModal}
        onClose={() => setShowDateRangeModal(false)}
        companies={companies}
      />
    </div>
  );
};
