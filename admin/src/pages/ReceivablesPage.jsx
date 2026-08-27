import React, { useState, useEffect } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { paymentService } from '../services/paymentService';
import { formatINR, formatDate } from '../utils/formatters';
import { PageHeader } from '../components/common/PageHeader';
import { DataTable } from '../components/common/DataTable';
import { StatusBadge } from '../components/common/StatusBadge';
import { SearchBar } from '../components/common/SearchBar';
import { FilterBar } from '../components/common/FilterBar';
import { LoadingState } from '../components/common/LoadingState';
import { ErrorState } from '../components/common/ErrorState';
import { RecordPaymentModal } from '../components/payment/RecordPaymentModal';
import { CollectionFollowupModal } from '../components/payment/CollectionFollowupModal';
import { Plus, Eye, PhoneCall, ArrowLeft, Clock } from 'lucide-react';

export const ReceivablesPage = () => {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const initialStatusFilter = searchParams.get('status') || 'All';

  const [receivables, setReceivables] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState(initialStatusFilter);

  // Modals
  const [showRecordModal, setShowRecordModal] = useState(false);
  const [showFollowupModal, setShowFollowupModal] = useState(false);
  const [targetInvoiceNumber, setTargetInvoiceNumber] = useState('');
  const [targetCompany, setTargetCompany] = useState('');

  const fetchReceivables = async () => {
    setLoading(true);
    setError(null);
    try {
      const data = await paymentService.getReceivables({ search, status: statusFilter });
      setReceivables(data);
    } catch (err) {
      setError(err.message || 'Failed to load customer receivables.');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchReceivables();
  }, [search, statusFilter]);

  const statusOptions = [
    { label: 'All Receivables', value: 'All' },
    { label: 'Unpaid', value: 'Unpaid' },
    { label: 'Partially Paid', value: 'Partially Paid' },
    { label: 'Overdue', value: 'Overdue' },
    { label: 'Paid', value: 'Paid' }
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
      header: 'Invoice Amount',
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
              className="px-2.5 py-1 text-xs font-bold text-white bg-setu-600 hover:bg-setu-700 rounded shadow-xs"
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
              className="p-1 text-slate-500 hover:text-amber-600 rounded"
              title="Log Collection Follow-up"
            >
              <PhoneCall className="w-4 h-4" />
            </button>
          )}
          <button
            onClick={() => navigate(`/admin/billing/invoices/${row.id}`)}
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
        title="Customer Receivables Master Table"
        description="Detailed list of customer invoice balances, payment terms compliance, and overdue accounts."
        breadcrumbs={['Speed Setu Admin', 'Finance', 'Payments', 'Receivables']}
        actions={
          <div className="flex items-center gap-2">
            <button
              onClick={() => navigate('/admin/payments')}
              className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold text-slate-700 bg-white border border-slate-300 rounded-md hover:bg-slate-50 transition-colors"
            >
              <ArrowLeft className="w-4 h-4" />
              <span>Back to Overview</span>
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

      <div className="bg-white border border-slate-200 rounded-xl p-4 shadow-xs space-y-3">
        <SearchBar
          value={search}
          onChange={setSearch}
          placeholder="Search company name, invoice number, CN..."
        />

        <div className="pt-2 border-t border-slate-100 flex items-center justify-between text-xs">
          <FilterBar
            options={statusOptions}
            activeFilter={statusFilter}
            onSelectFilter={setStatusFilter}
          />
          <span className="text-slate-500 font-medium">
            Showing <strong>{receivables.length}</strong> Records
          </span>
        </div>
      </div>

      {loading ? (
        <LoadingState message="Loading Customer Receivables Master Table..." />
      ) : error ? (
        <ErrorState message={error} onRetry={fetchReceivables} />
      ) : (
        <DataTable
          columns={columns}
          data={receivables}
          onRowClick={(row) => navigate(`/admin/billing/invoices/${row.id}`)}
          emptyMessage="No receivables found"
          emptySubtext="Try adjusting your search criteria or status filter."
        />
      )}

      <RecordPaymentModal
        isOpen={showRecordModal}
        onClose={() => setShowRecordModal(false)}
        preSelectedInvoiceId={targetInvoiceNumber}
        onSuccess={fetchReceivables}
      />

      <CollectionFollowupModal
        isOpen={showFollowupModal}
        onClose={() => setShowFollowupModal(false)}
        invoiceNumber={targetInvoiceNumber}
        companyName={targetCompany}
        onSuccess={fetchReceivables}
      />
    </div>
  );
};
