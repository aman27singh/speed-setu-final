import React, { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { billingService } from '../services/billingService';
import { formatDate, formatINR } from '../utils/formatters';
import { StatusBadge } from '../components/common/StatusBadge';
import { PageHeader } from '../components/common/PageHeader';
import { LoadingState } from '../components/common/LoadingState';
import { BillingSnapshotCard } from '../components/billing/BillingSnapshotCard';
import { InvoicePrintView } from '../components/billing/InvoicePrintView';
import { Modal } from '../components/common/Modal';
import {
  FileText,
  Printer,
  Download,
  Send,
  XCircle,
  Trash2,
  ArrowLeft,
  History,
  CheckCircle2,
  AlertCircle,
  DollarSign
} from 'lucide-react';

export const InvoiceDetailPage = () => {
  const { id } = useParams();
  const navigate = useNavigate();

  const [invoice, setInvoice] = useState(null);
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState('preview'); // 'preview' | 'snapshot' | 'history'

  const [showCancelModal, setShowCancelModal] = useState(false);
  const [cancellationReason, setCancellationReason] = useState('');
  const [cancelling, setCancelling] = useState(false);
  const [toastMessage, setToastMessage] = useState('');

  const fetchInvoiceData = async () => {
    setLoading(true);
    try {
      const data = await billingService.getInvoice(id);
      setInvoice(data);
    } catch (err) {
      alert(err.message || 'Failed to load invoice profile.');
      navigate('/admin/billing');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchInvoiceData();
  }, [id]);

  const handleCancelSubmit = async (e) => {
    e.preventDefault();
    if (!cancellationReason.trim()) {
      alert('Please specify a cancellation reason.');
      return;
    }

    setCancelling(true);
    try {
      await billingService.cancelInvoice(invoice.id, cancellationReason);
      setToastMessage(`Invoice ${invoice.invoiceNumber} cancelled.`);
      setShowCancelModal(false);
      fetchInvoiceData();
      setTimeout(() => setToastMessage(''), 4000);
    } catch (err) {
      alert(err.message || 'Failed to cancel invoice.');
    } finally {
      setCancelling(false);
    }
  };

  if (loading) {
    return <LoadingState message="Loading Freight Invoice Profile..." />;
  }

  if (!invoice) return null;

  return (
    <div className="space-y-6 pb-12">
      {/* Top Header & Actions - Hidden during print */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 no-print">
        <div className="flex items-center gap-3">
          <button
            onClick={() => navigate('/admin/billing')}
            className="p-2 text-slate-600 bg-white border border-slate-200 rounded-lg hover:bg-slate-50 transition-colors shadow-xs"
          >
            <ArrowLeft className="w-4 h-4" />
          </button>

          <div>
            <div className="flex items-center gap-2">
              <span className="text-xs font-bold text-slate-400 uppercase tracking-wider">GST Freight Invoice</span>
              <StatusBadge status={invoice.status} />
            </div>

            <h1 className="text-2xl font-bold text-slate-900 font-mono tracking-tight flex items-center gap-2">
              <span>{invoice.invoiceNumber}</span>
              <span className="text-sm font-semibold text-slate-600">— {invoice.companyName}</span>
            </h1>
          </div>
        </div>

        <div className="flex items-center gap-2 flex-wrap no-print">
          <button
            onClick={() => window.print()}
            className="inline-flex items-center gap-1.5 px-3.5 py-1.5 text-xs font-bold text-white bg-setu-600 hover:bg-setu-700 rounded-md shadow-xs transition-colors"
          >
            <Printer className="w-3.5 h-3.5" />
            <span>Print Invoice</span>
          </button>

          <button
            onClick={() => alert(`Sending invoice ${invoice.invoiceNumber} to customer email...`)}
            className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-bold text-slate-700 bg-white border border-slate-300 rounded-md hover:bg-slate-50 transition-colors"
          >
            <Send className="w-3.5 h-3.5 text-setu-600" />
            <span>Send Invoice</span>
          </button>

          {invoice.status !== 'Paid' && invoice.status !== 'Cancelled' && (
            <button
              onClick={() => setShowRecordModal(true)}
              className="inline-flex items-center gap-1.5 px-3.5 py-1.5 text-xs font-bold text-white bg-emerald-600 hover:bg-emerald-700 rounded-md shadow-xs transition-colors"
            >
              <DollarSign className="w-3.5 h-3.5" />
              <span>Record Payment</span>
            </button>
          )}

          {invoice.status !== 'Cancelled' && (
            <button
              onClick={() => setShowCancelModal(true)}
              className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-bold text-rose-700 bg-rose-50 border border-rose-200 rounded-md hover:bg-rose-100 transition-colors"
            >
              <XCircle className="w-3.5 h-3.5" />
              <span>Cancel Invoice</span>
            </button>
          )}

          <button
            onClick={async () => {
              const invNum = invoice.invoiceNumber || invoice.id;
              if (window.confirm(`Are you sure you want to delete Invoice ${invNum}? This action cannot be undone.`)) {
                try {
                  await billingService.deleteInvoice(invoice.id || invNum);
                  alert(`Invoice ${invNum} deleted successfully.`);
                  navigate('/admin/billing');
                } catch (err) {
                  alert(`Failed to delete invoice ${invNum}: ${err.message}`);
                }
              }
            }}
            className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-bold text-rose-700 bg-rose-50 border border-rose-200 rounded-md hover:bg-rose-100 transition-colors"
          >
            <Trash2 className="w-3.5 h-3.5" />
            <span>Delete Invoice</span>
          </button>
        </div>
      </div>

      {/* Toast Notification */}
      {toastMessage && (
        <div className="p-3 bg-slate-900 text-white rounded-lg text-xs font-semibold shadow-lg">
          {toastMessage}
        </div>
      )}

      {/* SUMMARY METRICS & PAYMENT PROGRESS CARD - Hidden during print */}
      <div className="space-y-4 no-print">
        <div className="bg-white border border-slate-200 rounded-xl p-4 shadow-xs grid grid-cols-2 sm:grid-cols-4 gap-4 divide-y sm:divide-y-0 sm:divide-x divide-slate-100">
          <div>
            <span className="text-[11px] font-bold text-slate-400 uppercase tracking-wider block">Invoice Date</span>
            <span className="text-xs font-bold text-slate-900 font-mono">{formatDate(invoice.invoiceDate)}</span>
          </div>

          <div className="pt-2 sm:pt-0 sm:pl-4">
            <span className="text-[11px] font-bold text-slate-400 uppercase tracking-wider block">Due Date</span>
            <span className="text-xs font-bold text-slate-900 font-mono">{formatDate(invoice.dueDate)}</span>
          </div>

          <div className="pt-2 sm:pt-0 sm:pl-4">
            <span className="text-[11px] font-bold text-slate-400 uppercase tracking-wider block">Consignment Notes</span>
            <span className="text-xs font-bold text-setu-600 font-mono">{(invoice.cns || []).join(', ')}</span>
          </div>

          <div className="pt-2 sm:pt-0 sm:pl-4">
            <span className="text-[11px] font-bold text-slate-400 uppercase tracking-wider block">Grand Total</span>
            <span className="text-sm font-black text-slate-900 font-mono">{formatINR(invoice.grandTotal)}</span>
          </div>
        </div>

        {/* PAYMENT SUMMARY & PROGRESS BAR CARD */}
        <div className="bg-white border border-slate-200 rounded-xl p-4 shadow-xs space-y-3 text-xs">
          <div className="flex items-center justify-between">
            <span className="font-bold text-slate-900 uppercase tracking-wider text-[11px]">Payment Summary & Customer Progress</span>
            <span className="font-mono font-bold text-emerald-700">
              {Math.round(((invoice.paidAmount || 0) / invoice.grandTotal) * 100)}% Paid
            </span>
          </div>

          {/* Progress Bar */}
          <div className="w-full bg-slate-100 h-2.5 rounded-full overflow-hidden flex">
            <div
              style={{ width: `${Math.min(100, Math.round(((invoice.paidAmount || 0) / invoice.grandTotal) * 100))}%` }}
              className="bg-emerald-500 h-full transition-all duration-500"
            />
          </div>

          <div className="flex items-center justify-between text-slate-700 font-mono text-xs pt-1">
            <span>Paid: <strong className="text-emerald-700">{formatINR(invoice.paidAmount || 0)}</strong></span>
            <span>Outstanding: <strong className="text-setu-700">{formatINR(invoice.balanceAmount || invoice.grandTotal)}</strong></span>
          </div>
        </div>
      </div>

      {/* MAIN CONTENT TABS */}
      <div className="space-y-4">
        <div className="bg-white border border-slate-200 rounded-xl p-2 shadow-xs flex items-center gap-2 text-xs">
          <button
            onClick={() => setActiveTab('preview')}
            className={`px-4 py-2 font-bold rounded-lg transition-colors ${
              activeTab === 'preview' ? 'bg-setu-600 text-white shadow-xs' : 'text-slate-600 hover:bg-slate-100'
            }`}
          >
            Invoice Print Preview
          </button>
          <button
            onClick={() => setActiveTab('snapshot')}
            className={`px-4 py-2 font-bold rounded-lg transition-colors ${
              activeTab === 'snapshot' ? 'bg-setu-600 text-white shadow-xs' : 'text-slate-600 hover:bg-slate-100'
            }`}
          >
            Rate Card Snapshot
          </button>
          <button
            onClick={() => setActiveTab('history')}
            className={`px-4 py-2 font-bold rounded-lg transition-colors ${
              activeTab === 'history' ? 'bg-setu-600 text-white shadow-xs' : 'text-slate-600 hover:bg-slate-100'
            }`}
          >
            Audit History
          </button>
        </div>

        {activeTab === 'preview' && (
          <InvoicePrintView invoice={invoice} />
        )}

        {activeTab === 'snapshot' && (
          <BillingSnapshotCard snapshot={invoice.billingSnapshot} />
        )}

        {activeTab === 'history' && (
          <div className="bg-white border border-slate-200 rounded-xl p-5 shadow-xs space-y-3 text-xs">
            <h3 className="font-bold text-slate-900 border-b border-slate-100 pb-2">Invoice Audit Events History</h3>
            <div className="space-y-2 text-slate-700">
              <div className="p-2.5 bg-slate-50 border border-slate-200 rounded flex justify-between">
                <div>
                  <strong className="block text-slate-900">Invoice Created & Calculated</strong>
                  <span className="text-slate-500 text-[11px]">Applied Rate Card {invoice.billingSnapshot?.quotationId} V{invoice.billingSnapshot?.quotationVersion}</span>
                </div>
                <span className="font-mono text-slate-500 text-[11px]">{invoice.createdAt}</span>
              </div>

              {invoice.status === 'Cancelled' && (
                <div className="p-2.5 bg-rose-50 border border-rose-200 rounded text-rose-900">
                  <strong className="block">Invoice Cancelled</strong>
                  <span className="text-[11px]">Reason: {invoice.cancellationReason || 'Admin request'}</span>
                </div>
              )}
            </div>
          </div>
        )}
      </div>

      {/* INVOICE CANCELLATION MODAL */}
      <Modal
        isOpen={showCancelModal}
        onClose={() => setShowCancelModal(false)}
        title={`Cancel Freight Invoice — ${invoice.invoiceNumber}`}
        footer={
          <>
            <button
              onClick={() => setShowCancelModal(false)}
              className="px-3 py-1.5 text-xs font-semibold text-slate-700 bg-white border border-slate-300 rounded"
            >
              Cancel
            </button>
            <button
              onClick={handleCancelSubmit}
              disabled={cancelling}
              className="px-4 py-1.5 text-xs font-bold text-white bg-rose-600 hover:bg-rose-700 rounded shadow-sm"
            >
              Confirm Cancellation
            </button>
          </>
        }
      >
        <form onSubmit={handleCancelSubmit} className="space-y-4 text-xs">
          <div className="p-3 bg-rose-50 border border-rose-200 rounded text-rose-800 text-xs font-medium">
            Cancelling this invoice will set status to <strong>Cancelled</strong>. The historical record and billing snapshot will remain preserved for audit logs.
          </div>

          <div>
            <label className="block font-bold text-slate-700 uppercase tracking-wider mb-1">
              Cancellation Reason <span className="text-rose-500">*</span>
            </label>
            <select
              value={cancellationReason}
              onChange={(e) => setCancellationReason(e.target.value)}
              className="w-full p-2.5 bg-slate-50 border border-slate-300 rounded font-semibold text-slate-900"
            >
              <option value="">Select Reason...</option>
              <option value="Incorrect rate card applied">Incorrect rate card applied</option>
              <option value="Chargeable weight error">Chargeable weight error</option>
              <option value="Customer billing detail error">Customer billing detail error</option>
              <option value="Duplicate invoice created">Duplicate invoice created</option>
            </select>
          </div>
        </form>
      </Modal>
    </div>
  );
};
