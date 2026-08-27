import React, { useState } from 'react';
import { Modal } from '../common/Modal';
import { payableService } from '../../services/payableService';
import { formatINR } from '../../utils/formatters';
import { DollarSign, AlertTriangle } from 'lucide-react';

const METHOD_OPTIONS = ['NEFT', 'RTGS', 'IMPS', 'UPI', 'Cheque', 'Bank Transfer', 'Cash', 'Other'];

export const RecordPayoutModal = ({ isOpen, onClose, payable, onSuccess }) => {
  const [formData, setFormData] = useState({
    payoutDate: new Date().toISOString().split('T')[0],
    amount: payable?.outstandingAmount || payable?.amount || 0,
    method: 'NEFT',
    referenceNumber: '',
    bankAccount: 'HDFC Bank Corporate Outflow Account',
    remarks: ''
  });

  const [saving, setSaving] = useState(false);

  const handleSubmit = async (e) => {
    e.preventDefault();
    const amt = parseFloat(formData.amount);
    if (!amt || amt <= 0) {
      alert('Payout amount must be greater than 0.');
      return;
    }

    setSaving(true);
    try {
      await payableService.recordPayout({
        ...formData,
        payableId: payable.id
      });

      alert(`Vendor Payout of ${formatINR(amt)} recorded successfully!`);
      if (onSuccess) onSuccess();
      onClose();
    } catch (err) {
      alert(err.message || 'Failed to record vendor payout.');
    } finally {
      setSaving(false);
    }
  };

  if (!payable) return null;

  return (
    <Modal
      isOpen={isOpen}
      onClose={onClose}
      title={`Record Vendor Payout — ${payable.payableNumber}`}
      footer={
        <>
          <button
            type="button"
            onClick={onClose}
            className="px-3 py-1.5 text-xs font-semibold text-slate-700 bg-white border border-slate-300 rounded"
          >
            Cancel
          </button>
          <button
            type="button"
            disabled={saving}
            onClick={handleSubmit}
            className="px-4 py-1.5 text-xs font-bold text-white bg-setu-600 hover:bg-setu-700 rounded shadow-sm disabled:opacity-50"
          >
            {saving ? 'Saving Payout...' : 'Record Payout'}
          </button>
        </>
      }
    >
      <form onSubmit={handleSubmit} className="space-y-4 text-xs">
        <div className="p-3 bg-setu-50/70 border border-setu-200 rounded-lg space-y-1">
          <div className="flex justify-between">
            <span className="text-slate-600">Payee Name:</span>
            <strong className="text-slate-900">{payable.payeeName}</strong>
          </div>
          <div className="flex justify-between">
            <span className="text-slate-600">Total Payable:</span>
            <span className="font-mono font-bold text-slate-900">{formatINR(payable.amount)}</span>
          </div>
          <div className="flex justify-between pt-1 border-t border-setu-200">
            <span className="font-bold text-slate-900">Outstanding Balance:</span>
            <span className="font-mono font-black text-setu-700">{formatINR(payable.outstandingAmount)}</span>
          </div>
        </div>

        <div className="grid grid-cols-2 gap-3">
          <div>
            <label className="block font-bold text-slate-700 uppercase tracking-wider mb-1">
              Payout Date <span className="text-rose-500">*</span>
            </label>
            <input
              type="date"
              value={formData.payoutDate}
              onChange={(e) => setFormData({ ...formData, payoutDate: e.target.value })}
              className="w-full p-2.5 bg-slate-50 border border-slate-300 rounded font-mono font-bold text-slate-900"
            />
          </div>

          <div>
            <label className="block font-bold text-slate-700 uppercase tracking-wider mb-1">
              Payout Amount (₹) <span className="text-rose-500">*</span>
            </label>
            <input
              type="number"
              value={formData.amount}
              onChange={(e) => setFormData({ ...formData, amount: e.target.value })}
              className="w-full p-2.5 bg-slate-50 border border-slate-300 rounded font-mono font-bold text-setu-700"
            />
          </div>

          <div>
            <label className="block font-bold text-slate-700 uppercase tracking-wider mb-1">
              Payment Method <span className="text-rose-500">*</span>
            </label>
            <select
              value={formData.method}
              onChange={(e) => setFormData({ ...formData, method: e.target.value })}
              className="w-full p-2.5 bg-slate-50 border border-slate-300 rounded font-bold text-slate-900"
            >
              {METHOD_OPTIONS.map((m) => (
                <option key={m} value={m}>{m}</option>
              ))}
            </select>
          </div>

          <div>
            <label className="block font-bold text-slate-700 uppercase tracking-wider mb-1">Reference UTR / Cheque No</label>
            <input
              type="text"
              value={formData.referenceNumber}
              onChange={(e) => setFormData({ ...formData, referenceNumber: e.target.value })}
              placeholder="e.g. UTR9988776612"
              className="w-full p-2.5 bg-slate-50 border border-slate-300 rounded font-mono"
            />
          </div>
        </div>

        <div>
          <label className="block font-bold text-slate-700 uppercase tracking-wider mb-1">Remittance Bank Account</label>
          <input
            type="text"
            value={formData.bankAccount}
            onChange={(e) => setFormData({ ...formData, bankAccount: e.target.value })}
            className="w-full p-2.5 bg-slate-50 border border-slate-300 rounded font-medium"
          />
        </div>

        <div>
          <label className="block font-bold text-slate-700 uppercase tracking-wider mb-1">Payout Remarks</label>
          <textarea
            rows={2}
            value={formData.remarks}
            onChange={(e) => setFormData({ ...formData, remarks: e.target.value })}
            placeholder="Settlement notes..."
            className="w-full p-2.5 bg-slate-50 border border-slate-300 rounded font-medium"
          />
        </div>
      </form>
    </Modal>
  );
};
