import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { paymentService } from '../services/paymentService';
import { formatINR, formatDate } from '../utils/formatters';
import { PageHeader } from '../components/common/PageHeader';
import { DataTable } from '../components/common/DataTable';
import { StatusBadge } from '../components/common/StatusBadge';
import { SearchBar } from '../components/common/SearchBar';
import { LoadingState } from '../components/common/LoadingState';
import { ErrorState } from '../components/common/ErrorState';
import { RecordPaymentModal } from '../components/payment/RecordPaymentModal';
import { Plus, Eye, ArrowLeft, CheckCircle2 } from 'lucide-react';

export const PaymentsReceivedPage = () => {
  const navigate = useNavigate();
  const [payments, setPayments] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  const [search, setSearch] = useState('');
  const [methodFilter, setMethodFilter] = useState('All');
  const [showRecordModal, setShowRecordModal] = useState(false);

  const fetchPayments = async () => {
    setLoading(true);
    setError(null);
    try {
      const data = await paymentService.getPayments({ search, method: methodFilter });
      setPayments(data);
    } catch (err) {
      setError(err.message || 'Failed to load payments received log.');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchPayments();
  }, [search, methodFilter]);

  const columns = [
    {
      header: 'Payment ID',
      accessor: 'paymentNumber',
      render: (row) => (
        <span
          onClick={() => navigate(`/admin/payments/${row.id}`)}
          className="font-bold text-setu-600 font-mono hover:underline cursor-pointer"
        >
          {row.paymentNumber}
        </span>
      )
    },
    {
      header: 'Payment Date',
      accessor: 'paymentDate',
      render: (row) => <span className="font-mono text-xs text-slate-700">{formatDate(row.paymentDate)}</span>
    },
    {
      header: 'Company Name',
      accessor: 'companyName',
      render: (row) => <span className="font-bold text-slate-900 text-xs">{row.companyName}</span>
    },
    {
      header: 'Related Invoice',
      accessor: 'invoiceNumber',
      render: (row) => (
        <span
          onClick={() => navigate(`/admin/billing/invoices/${row.invoiceId}`)}
          className="font-mono text-xs font-bold text-slate-800 hover:underline cursor-pointer"
        >
          {row.invoiceNumber}
        </span>
      )
    },
    {
      header: 'Amount Paid',
      accessor: 'amount',
      align: 'right',
      render: (row) => <span className="font-mono text-xs font-black text-emerald-700">{formatINR(row.amount)}</span>
    },
    {
      header: 'Method',
      accessor: 'method',
      render: (row) => (
        <span className="px-2 py-0.5 rounded text-[10px] font-bold bg-slate-100 text-slate-800">
          {row.method}
        </span>
      )
    },
    {
      header: 'Reference UTR No',
      accessor: 'referenceNumber',
      render: (row) => <span className="font-mono text-xs text-slate-700">{row.referenceNumber || 'N/A'}</span>
    },
    {
      header: 'Recorded By',
      accessor: 'recordedBy',
      render: (row) => <span className="text-xs text-slate-500">{row.recordedBy}</span>
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
        <button
          onClick={() => navigate(`/admin/payments/${row.id}`)}
          className="p-1.5 text-slate-500 hover:text-setu-600 rounded transition-colors"
          title="View Payment Profile"
        >
          <Eye className="w-4 h-4" />
        </button>
      )
    }
  ];

  return (
    <div className="space-y-6">
      <PageHeader
        title="Payments Received Log"
        description="Master audit log of all customer payment receipts, NEFT/RTGS bank transfers, and reference UTR entries."
        breadcrumbs={['Speed Setu Admin', 'Finance', 'Payments', 'Received Log']}
        actions={
          <div className="flex items-center gap-2">
            <button
              onClick={() => navigate('/admin/payments')}
              className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold text-slate-700 bg-white border border-slate-300 rounded-md hover:bg-slate-50 transition-colors"
            >
              <ArrowLeft className="w-4 h-4" />
              <span>Back to Receivables</span>
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

      <div className="bg-white border border-slate-200 rounded-xl p-4 shadow-xs flex flex-col md:flex-row items-center justify-between gap-3">
        <div className="w-full md:w-96">
          <SearchBar
            value={search}
            onChange={setSearch}
            placeholder="Search payment ID, invoice, company, UTR reference..."
          />
        </div>

        <div className="flex items-center gap-2">
          <select
            value={methodFilter}
            onChange={(e) => setMethodFilter(e.target.value)}
            className="px-3 py-2 text-xs bg-slate-50 border border-slate-200 rounded-md font-medium text-slate-700"
          >
            <option value="All">All Methods</option>
            <option value="NEFT">NEFT</option>
            <option value="RTGS">RTGS</option>
            <option value="IMPS">IMPS</option>
            <option value="UPI">UPI</option>
            <option value="Cheque">Cheque</option>
            <option value="Bank Transfer">Bank Transfer</option>
            <option value="Cash">Cash</option>
          </select>
        </div>
      </div>

      {loading ? (
        <LoadingState message="Loading Payments Received Audit Log..." />
      ) : error ? (
        <ErrorState message={error} onRetry={fetchPayments} />
      ) : (
        <DataTable
          columns={columns}
          data={payments}
          onRowClick={(row) => navigate(`/admin/payments/${row.id}`)}
          emptyMessage="No payment transaction records found"
          emptySubtext="Try adjusting your search criteria or payment method filter."
        />
      )}

      <RecordPaymentModal
        isOpen={showRecordModal}
        onClose={() => setShowRecordModal(false)}
        onSuccess={fetchPayments}
      />
    </div>
  );
};
