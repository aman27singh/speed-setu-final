import React, { useState, useEffect } from 'react';
import { Modal } from '../common/Modal';
import { billingService } from '../../services/billingService';
import { paymentService } from '../../services/paymentService';
import { validatePaymentForm } from '../../utils/paymentValidation';
import { formatINR } from '../../utils/formatters';
import { DollarSign, AlertTriangle, UploadCloud } from 'lucide-react';

const METHOD_OPTIONS = [
  'NEFT',
  'RTGS',
  'IMPS',
  'UPI',
  'Cheque',
  'Bank Transfer',
  'Cash',
  'Other'
];

export const RecordPaymentModal = ({ isOpen, onClose, preSelectedInvoiceId, onSuccess }) => {
  const [invoices, setInvoices] = useState([]);
  const [selectedInvoice, setSelectedInvoice] = useState(null);

  const [formData, setFormData] = useState({
    paymentDate: new Date().toISOString().split('T')[0],
    amount: '',
    method: 'NEFT',
    referenceNumber: '',
    bankAccount: 'HDFC Bank (Electronic City Branch)',
    remarks: ''
  });

  const [errors, setErrors] = useState({});
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (isOpen) {
      loadInvoices();
    }
  }, [isOpen, preSelectedInvoiceId]);

  const loadInvoices = async () => {
    try {
      const allInvoices = await billingService.getInvoices();
      const unpaidInvoices = allInvoices.filter((i) => i.status !== 'Paid' && i.status !== 'Cancelled');
      setInvoices(unpaidInvoices);

      if (preSelectedInvoiceId) {
        const found = allInvoices.find(
          (i) => i.id.toLowerCase() === preSelectedInvoiceId.toLowerCase() || i.invoiceNumber.toLowerCase() === preSelectedInvoiceId.toLowerCase()
        );
        if (found) {
          setSelectedInvoice(found);
          setFormData((prev) => ({ ...prev, amount: found.balanceAmount || found.grandTotal }));
          return;
        }
      }

      if (unpaidInvoices.length > 0) {
        setSelectedInvoice(unpaidInvoices[0]);
        setFormData((prev) => ({ ...prev, amount: unpaidInvoices[0].balanceAmount || unpaidInvoices[0].grandTotal }));
      }
    } catch (err) {
      console.error('Failed to load invoices for payment:', err);
    }
  };

  const handleInvoiceChange = (invId) => {
    const inv = invoices.find((i) => i.id === invId);
    if (inv) {
      setSelectedInvoice(inv);
      setFormData((prev) => ({ ...prev, amount: inv.balanceAmount || inv.grandTotal }));
    }
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!selectedInvoice) return;

    const validationErrors = validatePaymentForm(formData, selectedInvoice.balanceAmount || selectedInvoice.grandTotal);
    if (validationErrors.paymentDate || validationErrors.amount || validationErrors.method) {
      setErrors(validationErrors);
      return;
    }

    setSaving(true);
    try {
      const recorded = await paymentService.recordPayment({
        ...formData,
        companyId: selectedInvoice.companyId,
        companyName: selectedInvoice.companyName,
        invoiceId: selectedInvoice.id,
        invoiceNumber: selectedInvoice.invoiceNumber
      });

      alert(`Payment ${recorded.paymentNumber} of ${formatINR(recorded.amount)} recorded successfully!`);
      if (onSuccess) onSuccess(recorded);
      onClose();
    } catch (err) {
      alert(err.message || 'Failed to record payment.');
    } finally {
      setSaving(false);
    }
  };

  return (
    <Modal
      isOpen={isOpen}
      onClose={onClose}
      title="Record Customer Payment Receipt"
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
            disabled={saving || !selectedInvoice}
            onClick={handleSubmit}
            className="px-4 py-1.5 text-xs font-bold text-white bg-setu-600 hover:bg-setu-700 rounded shadow-sm disabled:opacity-50"
          >
            {saving ? 'Saving Payment...' : 'Record Payment Receipt'}
          </button>
        </>
      }
    >
      <form onSubmit={handleSubmit} className="space-y-4 text-xs">
        {/* SELECT INVOICE */}
        <div>
          <label className="block font-bold text-slate-700 uppercase tracking-wider mb-1">
            Target Invoice <span className="text-rose-500">*</span>
          </label>
          <select
            value={selectedInvoice?.id || ''}
            onChange={(e) => handleInvoiceChange(e.target.value)}
            className="w-full p-2.5 bg-slate-50 border border-slate-300 rounded font-mono font-bold text-slate-900"
          >
            {invoices.map((inv) => (
              <option key={inv.id} value={inv.id}>
                {inv.invoiceNumber} — {inv.companyName} (Outstanding: ₹{inv.balanceAmount || inv.grandTotal})
              </option>
            ))}
          </select>
        </div>

        {/* INVOICE BALANCE SUMMARY */}
        {selectedInvoice && (
          <div className="p-3 bg-setu-50/70 border border-setu-200 rounded-lg grid grid-cols-3 gap-2 text-center text-xs">
            <div>
              <span className="text-[10px] font-bold text-slate-400 uppercase block">Invoice Total</span>
              <span className="font-mono font-bold text-slate-900">{formatINR(selectedInvoice.grandTotal)}</span>
            </div>

            <div>
              <span className="text-[10px] font-bold text-slate-400 uppercase block">Already Paid</span>
              <span className="font-mono font-bold text-emerald-700">{formatINR(selectedInvoice.paidAmount || 0)}</span>
            </div>

            <div>
              <span className="text-[10px] font-bold text-slate-400 uppercase block">Outstanding</span>
              <span className="font-mono font-black text-setu-700">{formatINR(selectedInvoice.balanceAmount || selectedInvoice.grandTotal)}</span>
            </div>
          </div>
        )}

        {/* OVERPAYMENT WARNING BANNER */}
        {errors.amountWarning && (
          <div className="p-3 bg-amber-50 border border-amber-300 rounded text-amber-900 text-xs font-bold flex items-center gap-2">
            <AlertTriangle className="w-4 h-4 text-amber-600 shrink-0" />
            <span>{errors.amountWarning}</span>
          </div>
        )}

        <div className="grid grid-cols-2 gap-3">
          <div>
            <label className="block font-bold text-slate-700 uppercase tracking-wider mb-1">
              Payment Date <span className="text-rose-500">*</span>
            </label>
            <input
              type="date"
              value={formData.paymentDate}
              onChange={(e) => setFormData({ ...formData, paymentDate: e.target.value })}
              className="w-full p-2.5 bg-slate-50 border border-slate-300 rounded font-mono font-bold text-slate-900"
            />
            {errors.paymentDate && <span className="text-rose-600 text-[10px]">{errors.paymentDate}</span>}
          </div>

          <div>
            <label className="block font-bold text-slate-700 uppercase tracking-wider mb-1">
              Payment Amount (₹) <span className="text-rose-500">*</span>
            </label>
            <input
              type="number"
              value={formData.amount}
              onChange={(e) => {
                setFormData({ ...formData, amount: e.target.value });
                setErrors({});
              }}
              placeholder="e.g. 10000"
              className="w-full p-2.5 bg-slate-50 border border-slate-300 rounded font-mono font-bold text-setu-700"
            />
            {errors.amount && <span className="text-rose-600 text-[10px]">{errors.amount}</span>}
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
            <label className="block font-bold text-slate-700 uppercase tracking-wider mb-1">Reference UTR / Transaction No</label>
            <input
              type="text"
              value={formData.referenceNumber}
              onChange={(e) => setFormData({ ...formData, referenceNumber: e.target.value })}
              placeholder="e.g. UTR98220194821"
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
          <label className="block font-bold text-slate-700 uppercase tracking-wider mb-1">Payment Remarks</label>
          <textarea
            rows={2}
            value={formData.remarks}
            onChange={(e) => setFormData({ ...formData, remarks: e.target.value })}
            placeholder="Partial payment notes, TDS deductions..."
            className="w-full p-2.5 bg-slate-50 border border-slate-300 rounded font-medium"
          />
        </div>
      </form>
    </Modal>
  );
};
