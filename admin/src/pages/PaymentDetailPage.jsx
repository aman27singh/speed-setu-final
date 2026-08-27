import React, { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { paymentService } from '../services/paymentService';
import { billingService } from '../services/billingService';
import { formatDate, formatINR } from '../utils/formatters';
import { StatusBadge } from '../components/common/StatusBadge';
import { PageHeader } from '../components/common/PageHeader';
import { LoadingState } from '../components/common/LoadingState';
import { Modal } from '../components/common/Modal';
import {
  DollarSign,
  ArrowLeft,
  Building2,
  FileText,
  RotateCcw,
  CheckCircle2,
  XCircle,
  AlertCircle,
  CreditCard
} from 'lucide-react';

export const PaymentDetailPage = () => {
  const { id } = useParams();
  const navigate = useNavigate();

  const [payment, setPayment] = useState(null);
  const [invoice, setInvoice] = useState(null);
  const [loading, setLoading] = useState(true);

  // Reversal Modal
  const [showReverseModal, setShowReverseModal] = useState(false);
  const [reversalReason, setReversalReason] = useState('');
  const [reversing, setReversing] = useState(false);

  const fetchPaymentData = async () => {
    setLoading(true);
    try {
      const pData = await paymentService.getPayment(id);
      setPayment(pData);

      if (pData.invoiceId) {
        const invData = await billingService.getInvoice(pData.invoiceId).catch(() => null);
        setInvoice(invData);
      }
    } catch (err) {
      alert(err.message || 'Failed to load payment profile.');
      navigate('/admin/payments');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchPaymentData();
  }, [id]);

  const handleReverseSubmit = async (e) => {
    e.preventDefault();
    if (!reversalReason.trim()) {
      alert('Please state a reversal reason.');
      return;
    }

    setReversing(true);
    try {
      await paymentService.reversePayment(payment.id, reversalReason);
      alert(`Payment ${payment.paymentNumber} has been reversed.`);
      setShowReverseModal(false);
      fetchPaymentData();
    } catch (err) {
      alert(err.message || 'Failed to reverse payment.');
    } finally {
      setReversing(false);
    }
  };

  if (loading) {
    return <LoadingState message="Loading Payment Transaction Profile..." />;
  }

  if (!payment) return null;

  return (
    <div className="space-y-6 max-w-5xl mx-auto pb-12">
      {/* Top Header & Actions */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div className="flex items-center gap-3">
          <button
            onClick={() => navigate(-1)}
            className="p-2 text-slate-600 bg-white border border-slate-200 rounded-lg hover:bg-slate-50 transition-colors shadow-xs"
          >
            <ArrowLeft className="w-4 h-4" />
          </button>

          <div>
            <div className="flex items-center gap-2">
              <span className="text-xs font-bold text-slate-400 uppercase tracking-wider">Payment Transaction</span>
              <StatusBadge status={payment.status} />
            </div>

            <h1 className="text-2xl font-bold text-slate-900 font-mono tracking-tight flex items-center gap-2">
              <span>{payment.paymentNumber}</span>
              <span className="text-sm font-semibold text-slate-600">— {payment.companyName}</span>
            </h1>
          </div>
        </div>

        {payment.status !== 'Reversed' && (
          <button
            onClick={() => setShowReverseModal(true)}
            className="inline-flex items-center gap-1.5 px-3.5 py-1.5 text-xs font-bold text-rose-700 bg-rose-50 border border-rose-200 rounded-md hover:bg-rose-100 transition-colors"
          >
            <RotateCcw className="w-3.5 h-3.5" />
            <span>Reverse Payment</span>
          </button>
        )}
      </div>

      {/* SUMMARY METRICS STRIP */}
      <div className="bg-white border border-slate-200 rounded-xl p-4 shadow-xs grid grid-cols-2 sm:grid-cols-4 gap-4 divide-y sm:divide-y-0 sm:divide-x divide-slate-100">
        <div>
          <span className="text-[11px] font-bold text-slate-400 uppercase tracking-wider block">Payment Date</span>
          <span className="text-xs font-bold text-slate-900 font-mono">{formatDate(payment.paymentDate)}</span>
        </div>

        <div className="pt-2 sm:pt-0 sm:pl-4">
          <span className="text-[11px] font-bold text-slate-400 uppercase tracking-wider block">Payment Amount</span>
          <span className="text-sm font-black text-emerald-700 font-mono">{formatINR(payment.amount)}</span>
        </div>

        <div className="pt-2 sm:pt-0 sm:pl-4">
          <span className="text-[11px] font-bold text-slate-400 uppercase tracking-wider block">Method & Reference</span>
          <span className="text-xs font-bold text-slate-900 font-mono">{payment.method} ({payment.referenceNumber})</span>
        </div>

        <div className="pt-2 sm:pt-0 sm:pl-4">
          <span className="text-[11px] font-bold text-slate-400 uppercase tracking-wider block">Target Invoice</span>
          <span
            onClick={() => navigate(`/admin/billing/invoices/${payment.invoiceId}`)}
            className="text-xs font-bold text-setu-600 font-mono hover:underline cursor-pointer"
          >
            {payment.invoiceNumber}
          </span>
        </div>
      </div>

      {/* THREE CARDS LAYOUT */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        {/* Card 1: Payment Specs */}
        <div className="bg-white border border-slate-200 rounded-xl p-5 shadow-xs space-y-3 text-xs">
          <div className="flex items-center gap-2 border-b border-slate-100 pb-2">
            <CreditCard className="w-4 h-4 text-emerald-600" />
            <h3 className="font-bold text-slate-900 uppercase tracking-wider text-[11px]">Payment Transaction Specs</h3>
          </div>
          <div className="space-y-2">
            <div>
              <span className="text-slate-400 block text-[11px]">Remittance Bank Account</span>
              <span className="font-bold text-slate-900">{payment.bankAccount || 'HDFC Bank'}</span>
            </div>
            <div>
              <span className="text-slate-400 block text-[11px]">Recorded By</span>
              <span className="font-bold text-slate-900">{payment.recordedBy} ({payment.createdAt})</span>
            </div>
            <div>
              <span className="text-slate-400 block text-[11px]">Remarks</span>
              <p className="text-slate-700 font-medium">{payment.remarks || 'No remarks recorded.'}</p>
            </div>
          </div>
        </div>

        {/* Card 2: Related Invoice */}
        <div className="bg-white border border-slate-200 rounded-xl p-5 shadow-xs space-y-3 text-xs">
          <div className="flex items-center gap-2 border-b border-slate-100 pb-2">
            <FileText className="w-4 h-4 text-setu-600" />
            <h3 className="font-bold text-slate-900 uppercase tracking-wider text-[11px]">Related GST Invoice</h3>
          </div>
          {invoice ? (
            <div className="space-y-2">
              <div>
                <span className="text-slate-400 block text-[11px]">Invoice Number</span>
                <span
                  onClick={() => navigate(`/admin/billing/invoices/${invoice.id}`)}
                  className="font-bold font-mono text-setu-600 hover:underline cursor-pointer text-sm"
                >
                  {invoice.invoiceNumber}
                </span>
              </div>
              <div className="grid grid-cols-2 gap-2">
                <div>
                  <span className="text-slate-400 block text-[11px]">Invoice Total</span>
                  <span className="font-mono font-bold text-slate-900">{formatINR(invoice.grandTotal)}</span>
                </div>
                <div>
                  <span className="text-slate-400 block text-[11px]">Remaining Balance</span>
                  <span className="font-mono font-bold text-setu-700">{formatINR(invoice.balanceAmount || 0)}</span>
                </div>
              </div>
            </div>
          ) : (
            <span className="text-slate-400">Invoice details unavailable</span>
          )}
        </div>

        {/* Card 3: Related Company */}
        <div className="bg-white border border-slate-200 rounded-xl p-5 shadow-xs space-y-3 text-xs">
          <div className="flex items-center gap-2 border-b border-slate-100 pb-2">
            <Building2 className="w-4 h-4 text-setu-600" />
            <h3 className="font-bold text-slate-900 uppercase tracking-wider text-[11px]">Corporate Customer</h3>
          </div>
          <div>
            <span className="font-bold text-slate-900 text-sm block">{payment.companyName}</span>
            <button
              onClick={() => navigate(`/admin/companies/${payment.companyId}`)}
              className="mt-2 text-setu-600 font-bold hover:underline text-[11px] block"
            >
              View Company Profile →
            </button>
          </div>
        </div>
      </div>

      {/* REVERSAL MODAL */}
      <Modal
        isOpen={showReverseModal}
        onClose={() => setShowReverseModal(false)}
        title={`Reverse Payment — ${payment.paymentNumber}`}
        footer={
          <>
            <button
              onClick={() => setShowReverseModal(false)}
              className="px-3 py-1.5 text-xs font-semibold text-slate-700 bg-white border border-slate-300 rounded"
            >
              Cancel
            </button>
            <button
              onClick={handleReverseSubmit}
              disabled={reversing}
              className="px-4 py-1.5 text-xs font-bold text-white bg-rose-600 hover:bg-rose-700 rounded shadow-sm"
            >
              Confirm Payment Reversal
            </button>
          </>
        }
      >
        <form onSubmit={handleReverseSubmit} className="space-y-4 text-xs">
          <div className="p-3 bg-rose-50 border border-rose-200 rounded text-rose-800 text-xs font-medium">
            Reversing this payment of <strong>{formatINR(payment.amount)}</strong> will restore the outstanding balance on Invoice <strong>{payment.invoiceNumber}</strong>. The audit history will preserve this transaction.
          </div>

          <div>
            <label className="block font-bold text-slate-700 uppercase tracking-wider mb-1">
              Reversal Reason <span className="text-rose-500">*</span>
            </label>
            <textarea
              rows={3}
              value={reversalReason}
              onChange={(e) => setReversalReason(e.target.value)}
              placeholder="e.g. Payment recorded against wrong invoice / Cheque bounced..."
              className="w-full p-2.5 bg-slate-50 border border-slate-300 rounded font-medium"
            />
          </div>
        </form>
      </Modal>
    </div>
  );
};
