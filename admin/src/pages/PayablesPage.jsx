import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { payableService } from '../services/payableService';
import { formatINR, formatDate } from '../utils/formatters';
import { PageHeader } from '../components/common/PageHeader';
import { KPICard } from '../components/common/KPICard';
import { DataTable } from '../components/common/DataTable';
import { StatusBadge } from '../components/common/StatusBadge';
import { SearchBar } from '../components/common/SearchBar';
import { FilterBar } from '../components/common/FilterBar';
import { LoadingState } from '../components/common/LoadingState';
import { ErrorState } from '../components/common/ErrorState';
import { PayableAgingBar } from '../components/expense/PayableAgingBar';
import { RecordPayoutModal } from '../components/expense/RecordPayoutModal';
import {
  CreditCard,
  Clock,
  CheckCircle2,
  DollarSign,
  Truck,
  User,
  Plus,
  Eye
} from 'lucide-react';

export const PayablesPage = () => {
  const navigate = useNavigate();
  const [metrics, setMetrics] = useState({});
  const [payables, setPayables] = useState([]);
  const [aging, setAging] = useState({});
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  const [search, setSearch] = useState('');
  const [payeeTypeFilter, setPayeeTypeFilter] = useState('All');
  const [statusFilter, setStatusFilter] = useState('All');

  // Payout Modal
  const [showPayoutModal, setShowPayoutModal] = useState(false);
  const [selectedPayable, setSelectedPayable] = useState(null);

  const fetchPayablesData = async () => {
    setLoading(true);
    setError(null);
    try {
      const [mProps, pData, aData] = await Promise.all([
        payableService.getPayablesDashboard(),
        payableService.getPayables({ search, payeeType: payeeTypeFilter, status: statusFilter }),
        payableService.getPayableAging()
      ]);
      setMetrics(mProps);
      setPayables(pData);
      setAging(aData);
    } catch (err) {
      setError(err.message || 'Failed to load payables dashboard data.');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchPayablesData();
  }, [search, payeeTypeFilter, statusFilter]);

  const payeeTypeOptions = [
    { label: 'All Payees', value: 'All' },
    { label: 'Market Driver', value: 'Market Driver' },
    { label: 'Transporter', value: 'Transporter' },
    { label: 'Driver', value: 'Driver' },
    { label: 'Vendor', value: 'Vendor' }
  ];

  const columns = [
    {
      header: 'Payable ID',
      accessor: 'payableNumber',
      render: (row) => (
        <span
          onClick={() => navigate(`/admin/payables/${row.id}`)}
          className="font-bold text-setu-600 font-mono hover:underline cursor-pointer"
        >
          {row.payableNumber}
        </span>
      )
    },
    {
      header: 'Payee Name',
      accessor: 'payeeName',
      render: (row) => (
        <div>
          <span className="font-bold text-slate-900 block text-xs">{row.payeeName}</span>
          <span className="text-[10px] text-slate-400 font-mono">Type: {row.payeeType}</span>
        </div>
      )
    },
    {
      header: 'Expense ID',
      accessor: 'expenseNumber',
      render: (row) => (
        <span
          onClick={() => navigate(`/admin/expenses/${row.expenseId}`)}
          className="font-mono text-xs font-semibold text-slate-800 hover:underline cursor-pointer"
        >
          {row.expenseNumber}
        </span>
      )
    },
    {
      header: 'Trip / CN',
      accessor: 'tripId',
      render: (row) => <span className="font-mono text-xs text-setu-700 font-bold">{row.tripId || row.cnNumber || 'N/A'}</span>
    },
    {
      header: 'Total Payable',
      accessor: 'amount',
      align: 'right',
      render: (row) => <span className="font-mono text-xs text-slate-700">{formatINR(row.amount)}</span>
    },
    {
      header: 'Paid',
      accessor: 'paidAmount',
      align: 'right',
      render: (row) => <span className="font-mono text-xs text-emerald-700 font-semibold">{formatINR(row.paidAmount || 0)}</span>
    },
    {
      header: 'Outstanding Balance',
      accessor: 'outstandingAmount',
      align: 'right',
      render: (row) => (
        <span className={`font-mono text-xs font-bold ${row.outstandingAmount > 0 ? 'text-rose-700' : 'text-slate-500'}`}>
          {formatINR(row.outstandingAmount || 0)}
        </span>
      )
    },
    {
      header: 'Due Date',
      accessor: 'dueDate',
      render: (row) => <span className="font-mono text-xs text-slate-600">{formatDate(row.dueDate)}</span>
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
                setSelectedPayable(row);
                setShowPayoutModal(true);
              }}
              className="px-2.5 py-1 text-xs font-bold text-white bg-setu-600 hover:bg-setu-700 rounded shadow-xs"
            >
              + Payout
            </button>
          )}
          <button
            onClick={() => navigate(`/admin/payables/${row.id}`)}
            className="p-1 text-slate-400 hover:text-slate-700 rounded"
          >
            <Eye className="w-4 h-4" />
          </button>
        </div>
      )
    }
  ];

  return (
    <div className="space-y-6">
      <PageHeader
        title="Accounts Payable & Vendor Settlements"
        description="Manage vendor amounts payable, linehaul transporter freight payouts, and driver advances."
        breadcrumbs={['Speed Setu Admin', 'Finance', 'Payables']}
      />

      {/* TOP KPI CARDS STRIP */}
      <div className="grid grid-cols-2 sm:grid-cols-6 gap-3">
        <KPICard title="Total Payables" value={formatINR(metrics.totalPayables || 0)} subtext="Total unpaid balance" icon={CreditCard} variant="warning" />
        <KPICard title="Transporter Owed" value={formatINR(metrics.transporterPayables || 0)} subtext="Fleet freight payouts" icon={Truck} variant="default" />
        <KPICard title="Driver Payables" value={formatINR(metrics.driverPayables || 0)} subtext="Driver linehaul payouts" icon={User} variant="default" />
        <KPICard title="Vendor Payables" value={formatINR(metrics.vendorPayables || 0)} subtext="Maintenance & crane vendors" icon={CreditCard} variant="default" />
        <KPICard title="Paid This Month" value={formatINR(metrics.paidThisMonth || 0)} subtext="Confirmed vendor payouts" icon={CheckCircle2} variant="default" />
        <KPICard title="Due This Week" value={metrics.dueThisWeekCount || '0'} subtext="Approaching payment terms" icon={Clock} variant="accent" />
      </div>

      {/* ACCOUNTS PAYABLE AGING SUMMARY */}
      <PayableAgingBar aging={aging} />

      {/* FILTER & SEARCH */}
      <div className="bg-white border border-slate-200 rounded-xl p-4 shadow-xs space-y-3">
        <div className="flex flex-col md:flex-row items-center gap-3">
          <div className="w-full md:flex-1">
            <SearchBar
              value={search}
              onChange={setSearch}
              placeholder="Search payable ID, payee name, expense ID, trip ID..."
            />
          </div>

          <div className="flex items-center gap-2 w-full md:w-auto">
            <select
              value={statusFilter}
              onChange={(e) => setStatusFilter(e.target.value)}
              className="px-3 py-2 text-xs bg-slate-50 border border-slate-200 rounded-md font-medium text-slate-700"
            >
              <option value="All">All Statuses</option>
              <option value="Pending">Pending</option>
              <option value="Partially Paid">Partially Paid</option>
              <option value="Paid">Paid</option>
              <option value="Overdue">Overdue</option>
            </select>
          </div>
        </div>

        <div className="pt-2 border-t border-slate-100 flex items-center justify-between text-xs">
          <FilterBar
            options={payeeTypeOptions}
            activeFilter={payeeTypeFilter}
            onSelectFilter={setPayeeTypeFilter}
          />
          <span className="text-slate-500 font-medium">
            Showing <strong>{payables.length}</strong> Payable Records
          </span>
        </div>
      </div>

      {/* MASTER PAYABLES TABLE */}
      {loading ? (
        <LoadingState message="Loading Accounts Payable Workspace..." />
      ) : error ? (
        <ErrorState message={error} onRetry={fetchPayablesData} />
      ) : (
        <DataTable
          columns={columns}
          data={payables}
          onRowClick={(row) => navigate(`/admin/payables/${row.id}`)}
          emptyMessage="No accounts payable records found"
          emptySubtext="Try adjusting your search criteria or payee filter."
        />
      )}

      {/* RECORD PAYOUT MODAL */}
      <RecordPayoutModal
        isOpen={showPayoutModal}
        onClose={() => setShowPayoutModal(false)}
        payable={selectedPayable}
        onSuccess={fetchPayablesData}
      />
    </div>
  );
};
