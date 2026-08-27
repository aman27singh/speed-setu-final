import React, { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { payableService } from '../services/payableService';
import { formatDate, formatINR } from '../utils/formatters';
import { StatusBadge } from '../components/common/StatusBadge';
import { PageHeader } from '../components/common/PageHeader';
import { LoadingState } from '../components/common/LoadingState';
import { RecordPayoutModal } from '../components/expense/RecordPayoutModal';
import { Modal } from '../components/common/Modal';
import {
  CreditCard,
  ArrowLeft,
  Building2,
  FileText,
  RotateCcw,
  Plus,
  CheckCircle2,
  DollarSign
} from 'lucide-react';

export const PayableDetailPage = () => {
  const { id } = useParams();
  const navigate = useNavigate();

  const [payable, setPayable] = useState(null);
  const [loading, setLoading] = useState(true);

  // Modals
  const [showPayoutModal, setShowPayoutModal] = useState(false);
  const [showReverseModal, setShowReverseModal] = useState(false);
  const [targetPayoutId, setTargetPayoutId] = useState('');
  const [reversalReason, setReversalReason] = useState('');
  const [reversing, setReversing] = useState(false);

  const fetchPayableData = async () => {
    setLoading(true);
    try {
      const data = await payableService.getPayable(id);
      setPayable(data);
    } catch (err) {
      alert(err.message || 'Failed to load payable profile.');
      navigate('/admin/payables');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchPayableData();
  }, [id]);

  const handleReverseSubmit = async (e) => {
    e.preventDefault();
    if (!reversalReason.trim()) {
      alert('Please state a reversal reason.');
      return;
    }

    setReversing(true);
    try {
      await payableService.reversePayout(payable.id, targetPayoutId, reversalReason);
      alert('Payout transaction reversed successfully!');
      setShowReverseModal(false);
      fetchPayableData();
    } catch (err) {
      alert(err.message || 'Failed to reverse payout.');
    } finally {
      setReversing(false);
    }
  };

  if (loading) {
    return <LoadingState message="Loading Accounts Payable Detail Profile..." />;
  }

  if (!payable) return null;

  return (
    <div className="space-y-6 max-w-5xl mx-auto pb-12">
      {/* Top Header & Actions */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div className="flex items-center gap-3">
          <button
            onClick={() => navigate('/admin/payables')}
            className="p-2 text-slate-600 bg-white border border-slate-200 rounded-lg hover:bg-slate-50 transition-colors shadow-xs"
          >
            <ArrowLeft className="w-4 h-4" />
          </button>

          <div>
            <div className="flex items-center gap-2">
              <span className="text-xs font-bold text-slate-400 uppercase tracking-wider">Accounts Payable</span>
              <StatusBadge status={payable.status} />
            </div>

            <h1 className="text-2xl font-bold text-slate-900 font-mono tracking-tight flex items-center gap-2">
              <span>{payable.payableNumber}</span>
              <span className="text-sm font-semibold text-slate-600">— {payable.payeeName}</span>
            </h1>
          </div>
        </div>

        {payable.status !== 'Paid' && (
          <button
            onClick={() => setShowPayoutModal(true)}
            className="inline-flex items-center gap-1.5 px-4 py-2 text-xs font-bold text-white bg-setu-600 hover:bg-setu-700 rounded-md shadow-sm transition-colors"
          >
            <Plus className="w-4 h-4" />
            <span>Record Vendor Payout</span>
          </button>
        )}
      </div>

      {/* SUMMARY METRICS STRIP */}
      <div className="bg-white border border-slate-200 rounded-xl p-4 shadow-xs grid grid-cols-2 sm:grid-cols-4 gap-4 divide-y sm:divide-y-0 sm:divide-x divide-slate-100">
        <div>
          <span className="text-[11px] font-bold text-slate-400 uppercase tracking-wider block">Total Payable</span>
          <span className="text-xs font-bold text-slate-900 font-mono">{formatINR(payable.amount)}</span>
        </div>

        <div className="pt-2 sm:pt-0 sm:pl-4">
          <span className="text-[11px] font-bold text-slate-400 uppercase tracking-wider block">Paid Amount</span>
          <span className="text-xs font-bold text-emerald-700 font-mono">{formatINR(payable.paidAmount || 0)}</span>
        </div>

        <div className="pt-2 sm:pt-0 sm:pl-4">
          <span className="text-[11px] font-bold text-slate-400 uppercase tracking-wider block">Outstanding Balance</span>
          <span className="text-sm font-black text-rose-700 font-mono">{formatINR(payable.outstandingAmount)}</span>
        </div>

        <div className="pt-2 sm:pt-0 sm:pl-4">
          <span className="text-[11px] font-bold text-slate-400 uppercase tracking-wider block">Due Date & Terms</span>
          <span className="text-xs font-bold text-slate-900 font-mono">{formatDate(payable.dueDate)} ({payable.paymentTerms})</span>
        </div>
      </div>

      {/* LINKED EXPENSE & PAYEE CARD */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        <div className="bg-white border border-slate-200 rounded-xl p-5 shadow-xs space-y-3 text-xs">
          <div className="flex items-center gap-2 border-b border-slate-100 pb-2">
            <FileText className="w-4 h-4 text-setu-600" />
            <h3 className="font-bold text-slate-900 uppercase tracking-wider text-[11px]">Linked Operational Expense</h3>
          </div>
          <div className="space-y-2">
            <div>
              <span className="text-slate-400 block text-[11px]">Expense Number</span>
              <span
                onClick={() => navigate(`/admin/expenses/${payable.expenseId}`)}
                className="font-bold font-mono text-setu-600 hover:underline cursor-pointer text-sm"
              >
                {payable.expenseNumber}
              </span>
            </div>
            <div>
              <span className="text-slate-400 block text-[11px]">Trip / CN Scope</span>
              <span className="font-mono font-bold text-slate-900">{payable.tripId || payable.cnNumber || 'Overhead'}</span>
            </div>
          </div>
        </div>

        <div className="bg-white border border-slate-200 rounded-xl p-5 shadow-xs space-y-3 text-xs">
          <div className="flex items-center gap-2 border-b border-slate-100 pb-2">
            <Building2 className="w-4 h-4 text-emerald-600" />
            <h3 className="font-bold text-slate-900 uppercase tracking-wider text-[11px]">Payee Information</h3>
          </div>
          <div className="space-y-2">
            <div>
              <span className="text-slate-400 block text-[11px]">Payee Name</span>
              <span className="font-bold text-slate-900 text-sm">{payable.payeeName}</span>
            </div>
            <div>
              <span className="text-slate-400 block text-[11px]">Payee Type</span>
              <span className="font-semibold text-slate-700">{payable.payeeType}</span>
            </div>
          </div>
        </div>
      </div>

      {/* PAYOUT SETTLEMENT HISTORY TABLE */}
      <div className="bg-white border border-slate-200 rounded-xl p-5 shadow-xs space-y-4 text-xs">
        <div className="flex items-center justify-between border-b border-slate-100 pb-2">
          <div className="flex items-center gap-2">
            <CheckCircle2 className="w-4 h-4 text-emerald-600" />
            <h3 className="font-bold text-slate-900 uppercase tracking-wider text-[11px]">Payout Settlement Audit Log</h3>
          </div>
          <span className="font-mono font-bold text-slate-500">{(payable.payouts || []).length} Settlements</span>
        </div>

        {payable.payouts && payable.payouts.length > 0 ? (
          <div className="border border-slate-200 rounded-lg overflow-hidden">
            <table className="w-full text-left border-collapse">
              <thead className="bg-slate-100 text-slate-600 uppercase font-bold text-[10px] border-b border-slate-200">
                <tr>
                  <th className="p-2.5">Date</th>
                  <th className="p-2.5">Amount Paid</th>
                  <th className="p-2.5">Method</th>
                  <th className="p-2.5">Reference UTR</th>
                  <th className="p-2.5">Remittance Bank</th>
                  <th className="p-2.5">Recorded By</th>
                  <th className="p-2.5 text-right">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 font-medium">
                {payable.payouts.map((po) => (
                  <tr key={po.payoutId}>
                    <td className="p-2.5 font-mono">{formatDate(po.payoutDate)}</td>
                    <td className="p-2.5 font-mono font-bold text-emerald-700">{formatINR(po.amount)}</td>
                    <td className="p-2.5">{po.method}</td>
                    <td className="p-2.5 font-mono">{po.referenceNumber}</td>
                    <td className="p-2.5">{po.bankAccount}</td>
                    <td className="p-2.5 text-slate-500">{po.recordedBy}</td>
                    <td className="p-2.5 text-right">
                      <button
                        onClick={() => {
                          setTargetPayoutId(po.payoutId);
                          setShowReverseModal(true);
                        }}
                        className="p-1 text-slate-400 hover:text-rose-600 rounded"
                        title="Reverse Payout"
                      >
                        <RotateCcw className="w-4 h-4" />
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        ) : (
          <p className="text-slate-400 italic">No payout settlements recorded yet.</p>
        )}
      </div>

      {/* RECORD PAYOUT MODAL */}
      <RecordPayoutModal
        isOpen={showPayoutModal}
        onClose={() => setShowPayoutModal(false)}
        payable={payable}
        onSuccess={fetchPayableData}
      />

      {/* REVERSAL MODAL */}
      <Modal
        isOpen={showReverseModal}
        onClose={() => setShowReverseModal(false)}
        title="Reverse Payout Settlement"
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
              Confirm Payout Reversal
            </button>
          </>
        }
      >
        <form onSubmit={handleReverseSubmit} className="space-y-4 text-xs">
          <div className="p-3 bg-rose-50 border border-rose-200 rounded text-rose-800 text-xs font-medium">
            Reversing this payout will restore the outstanding balance on Payable <strong>{payable.payableNumber}</strong>.
          </div>

          <div>
            <label className="block font-bold text-slate-700 uppercase tracking-wider mb-1">
              Reversal Reason <span className="text-rose-500">*</span>
            </label>
            <textarea
              rows={3}
              value={reversalReason}
              onChange={(e) => setReversalReason(e.target.value)}
              placeholder="e.g. Payment entered against wrong transporter..."
              className="w-full p-2.5 bg-slate-50 border border-slate-300 rounded font-medium"
            />
          </div>
        </form>
      </Modal>
    </div>
  );
};
