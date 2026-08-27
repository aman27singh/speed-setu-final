import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { paymentService } from '../services/paymentService';
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
import { AgingSummaryBar } from '../components/payment/AgingSummaryBar';
import { RecordPaymentModal } from '../components/payment/RecordPaymentModal';
import { CollectionFollowupModal } from '../components/payment/CollectionFollowupModal';
import {
  DollarSign,
  Clock,
  AlertCircle,
  CheckCircle2,
  AlertTriangle,
  Plus,
  Eye,
  PhoneCall,
  FileText
} from 'lucide-react';

export const PaymentsPage = () => {
  const navigate = useNavigate();
  const [metrics, setMetrics] = useState({});
  const [receivables, setReceivables] = useState([]);
  const [aging, setAging] = useState({});
  const [companies, setCompanies] = useState([]);

  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState('All');
  const [companyFilter, setCompanyFilter] = useState('All');

  // Modal triggers
  const [showRecordModal, setShowRecordModal] = useState(false);
  const [showFollowupModal, setShowFollowupModal] = useState(false);
  const [targetInvoiceNumber, setTargetInvoiceNumber] = useState('');
  const [targetCompany, setTargetCompany] = useState('');

  const fetchPaymentsData = async () => {
    setLoading(true);
    setError(null);
    try {
      const [mProps, rData, aData, cData] = await Promise.all([
        paymentService.getReceivablesDashboard(),
        paymentService.getReceivables({ search, status: statusFilter, companyId: companyFilter }),
        paymentService.getReceivableAging(),
        companyService.getCompanies()
      ]);

      setMetrics(mProps);
      setReceivables(rData);
      setAging(aData);
      setCompanies(cData);
    } catch (err) {
      setError(err.message || 'Failed to load payments dashboard data.');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchPaymentsData();
  }, [search, statusFilter, companyFilter]);

  const statusOptions = [
    { label: 'All Receivables', value: 'All' },
    { label: 'Unpaid', value: 'Unpaid' },
    { label: 'Partially Paid', value: 'Partially Paid' },
    { label: 'Overdue', value: 'Overdue' },
    { label: 'Paid', value: 'Paid' },
    { label: 'Disputed', value: 'Disputed' }
  ];

  const columns = [
    {
      header: 'Company',
      accessor: 'companyName',
      render: (row) => <span className="font-bold text-slate-900 text-xs">{row.companyName}</span>
    },
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
      header: 'Due Date',
      accessor: 'dueDate',
      render: (row) => <span className="font-mono text-xs text-slate-700">{formatDate(row.dueDate)}</span>
    },
    {
      header: 'Invoice Total',
      accessor: 'grandTotal',
      align: 'right',
      render: (row) => <span className="font-mono text-xs text-slate-700">{formatINR(row.grandTotal)}</span>
    },
    {
      header: 'Paid Amount',
      accessor: 'paidAmount',
      align: 'right',
      render: (row) => <span className="font-mono text-xs text-emerald-700 font-semibold">{formatINR(row.paidAmount || 0)}</span>
    },
    {
      header: 'Outstanding Balance',
      accessor: 'balanceAmount',
      align: 'right',
      render: (row) => (
        <span className={`font-mono text-xs font-bold ${row.balanceAmount > 0 ? 'text-setu-700' : 'text-slate-500'}`}>
          {formatINR(row.balanceAmount || 0)}
        </span>
      )
    },
    {
      header: 'Days Overdue',
      accessor: 'daysOverdue',
      align: 'center',
      render: (row) => (
        row.daysOverdue > 0 ? (
          <span className="px-2 py-0.5 rounded text-[10px] font-bold bg-rose-50 text-rose-700 border border-rose-200">
            {row.daysOverdue} days
          </span>
        ) : (
          <span className="text-[10px] text-slate-400 font-mono">Current</span>
        )
      )
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
          {row.status !== 'Paid' && (
            <button
              onClick={() => {
                setTargetInvoiceNumber(row.invoiceNumber);
                setShowRecordModal(true);
              }}
              className="px-2.5 py-1 text-xs font-bold text-white bg-setu-600 hover:bg-setu-700 rounded transition-colors shadow-xs"
              title="Record Payment Receipt"
            >
              + Pay
            </button>
          )}
          {row.daysOverdue > 0 && (
            <button
              onClick={() => {
                setTargetInvoiceNumber(row.invoiceNumber);
                setTargetCompany(row.companyName);
                setShowFollowupModal(true);
              }}
              className="p-1 text-slate-500 hover:text-amber-600 rounded transition-colors"
              title="Log Collection Follow-up"
            >
              <PhoneCall className="w-4 h-4" />
            </button>
          )}
          <button
            onClick={() => navigate(`/admin/billing/invoices/${row.id}`)}
            className="p-1 text-slate-400 hover:text-slate-700 rounded transition-colors"
            title="View Invoice"
          >
            <Eye className="w-4 h-4" />
          </button>
        </div>
      )
    }
  ];

  const validReceivables = receivables.filter(
    (r) => (r.status || '').toLowerCase() !== 'cancelled' && (r.status || '').toLowerCase() !== 'void'
  );

  const liveTotalReceivables = validReceivables.reduce((acc, r) => acc + (r.balanceAmount ?? Math.max(0, (r.grandTotal || 0) - (r.paidAmount || 0))), 0);
  const liveOverdueReceivables = validReceivables
    .filter((r) => {
      const dueMs = new Date(r.dueDate || r.invoiceDate).getTime();
      const todayMs = new Date(new Date().toISOString().split('T')[0]).getTime();
      const bal = r.balanceAmount ?? Math.max(0, (r.grandTotal || 0) - (r.paidAmount || 0));
      return dueMs < todayMs && bal > 0;
    })
    .reduce((acc, r) => acc + (r.balanceAmount ?? Math.max(0, (r.grandTotal || 0) - (r.paidAmount || 0))), 0);
  const liveCollectedThisMonth = validReceivables.reduce((acc, r) => acc + (r.paidAmount || 0), 0);
  const livePartiallyPaidCount = validReceivables.filter((r) => r.status === 'Partially Paid' || (r.paidAmount > 0 && r.balanceAmount > 0)).length;
  const liveDisputedCount = validReceivables.filter((r) => r.status === 'Disputed').length;

  const resolvedAging = {
    currentNotDue: (aging.currentNotDue && aging.currentNotDue > 0) ? aging.currentNotDue : liveTotalReceivables,
    days1to30: aging.days1to30 || 0,
    days31to60: aging.days31to60 || 0,
    days61to90: aging.days61to90 || 0,
    days90Plus: aging.days90Plus || 0,
    totalReceivables: (aging.totalReceivables && aging.totalReceivables > 0) ? aging.totalReceivables : liveTotalReceivables
  };

  return (
    <div className="space-y-6">
      <PageHeader
        title="Payments & Customer Receivables"
        description="Track customer invoice payments, outstanding balances, accounts aging, and collection follow-ups."
        breadcrumbs={['Speed Setu Admin', 'Finance', 'Payments']}
        actions={
          <div className="flex items-center gap-2">
            <button
              onClick={() => navigate('/admin/payments/received')}
              className="inline-flex items-center gap-1.5 px-3 py-2 text-xs font-bold text-slate-700 bg-white border border-slate-300 hover:bg-slate-50 rounded-md transition-colors"
            >
              <FileText className="w-4 h-4 text-setu-600" />
              <span>Payments Received Log</span>
            </button>

            <button
              onClick={() => setShowRecordModal(true)}
              className="inline-flex items-center gap-2 px-4 py-2 text-xs font-bold text-white bg-setu-600 hover:bg-setu-700 rounded-md shadow-sm transition-colors"
            >
              <Plus className="w-4 h-4" />
              <span>Record Payment</span>
            </button>
          </div>
        }
      />

      {/* TOP FINANCIAL KPI CARDS STRIP */}
      <div className="grid grid-cols-2 sm:grid-cols-6 gap-3">
        <KPICard title="Total Receivables" value={formatINR(metrics.totalReceivables || liveTotalReceivables)} subtext="Total unpaid balance" icon={DollarSign} variant="accent" />
        <KPICard title="Overdue Balance" value={formatINR(metrics.overdueReceivables || liveOverdueReceivables)} subtext="Past due date" icon={AlertCircle} variant="danger" />
        <KPICard title="Collected This Month" value={formatINR(metrics.collectedThisMonth || liveCollectedThisMonth)} subtext="Confirmed payment receipts" icon={CheckCircle2} variant="default" />
        <KPICard title="Partially Paid" value={metrics.partiallyPaidCount || livePartiallyPaidCount || '0'} subtext="Invoices with partial payments" icon={Clock} variant="warning" />
        <KPICard title="Due Soon" value={metrics.dueSoonCount || '0'} subtext="Approaching due date" icon={Clock} variant="default" />
        <KPICard title="Disputed" value={metrics.disputedCount || liveDisputedCount || '0'} subtext="Under customer review" icon={AlertTriangle} variant="default" />
      </div>

      {/* ACCOUNTS RECEIVABLE AGING BAR */}
      <AgingSummaryBar aging={resolvedAging} />

      {/* RECEIVABLES FILTER & SEARCH */}
      <div className="bg-white border border-slate-200 rounded-xl p-4 shadow-xs space-y-3">
        <div className="flex flex-col md:flex-row items-center gap-3">
          <div className="w-full md:flex-1">
            <SearchBar
              value={search}
              onChange={setSearch}
              placeholder="Search company name, invoice number, CN..."
            />
          </div>

          <div className="flex items-center gap-2 w-full md:w-auto">
            <select
              value={companyFilter}
              onChange={(e) => setCompanyFilter(e.target.value)}
              className="px-3 py-2 text-xs bg-slate-50 border border-slate-200 rounded-md font-medium text-slate-700"
            >
              <option value="All">All Companies</option>
              {companies.map((c) => (
                <option key={c.id} value={c.companyName}>{c.companyName}</option>
              ))}
            </select>
          </div>
        </div>

        <div className="pt-2 border-t border-slate-100 flex items-center justify-between text-xs">
          <FilterBar
            options={statusOptions}
            activeFilter={statusFilter}
            onSelectFilter={setStatusFilter}
          />
          <span className="text-slate-500 font-medium">
            Showing <strong>{receivables.length}</strong> Receivable Records
          </span>
        </div>
      </div>

      {/* MASTER RECEIVABLES TABLE */}
      {loading ? (
        <LoadingState message="Loading Customer Receivables & Payment Balances..." />
      ) : error ? (
        <ErrorState message={error} onRetry={fetchPaymentsData} />
      ) : (
        <DataTable
          columns={columns}
          data={receivables}
          onRowClick={(row) => navigate(`/admin/billing/invoices/${row.id}`)}
          emptyMessage="No customer receivables found"
          emptySubtext="Try adjusting your search criteria or filter options."
        />
      )}

      {/* MODALS */}
      <RecordPaymentModal
        isOpen={showRecordModal}
        onClose={() => setShowRecordModal(false)}
        preSelectedInvoiceId={targetInvoiceNumber}
        onSuccess={fetchPaymentsData}
      />

      <CollectionFollowupModal
        isOpen={showFollowupModal}
        onClose={() => setShowFollowupModal(false)}
        invoiceNumber={targetInvoiceNumber}
        companyName={targetCompany}
        onSuccess={fetchPaymentsData}
      />
    </div>
  );
};
