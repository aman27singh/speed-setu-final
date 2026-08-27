import React, { useState } from 'react';
import { Modal } from '../common/Modal';

export const CollectionFollowupModal = ({ isOpen, onClose, invoiceNumber, companyName, onSuccess }) => {
  const [formData, setFormData] = useState({
    followupDate: new Date().toISOString().split('T')[0],
    contactPerson: 'Accounts Officer',
    note: '',
    status: 'Contacted' // Pending, Contacted, Promised, Resolved
  });

  const [saving, setSaving] = useState(false);

  const handleSubmit = (e) => {
    e.preventDefault();
    if (!formData.note.trim()) {
      alert('Please enter a follow-up note.');
      return;
    }

    setSaving(true);
    setTimeout(() => {
      alert(`Collection follow-up note recorded for Invoice ${invoiceNumber}!`);
      setSaving(false);
      if (onSuccess) onSuccess(formData);
      onClose();
    }, 200);
  };

  return (
    <Modal
      isOpen={isOpen}
      onClose={onClose}
      title={`Log Collection Follow-up — ${invoiceNumber}`}
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
            {saving ? 'Saving...' : 'Save Follow-up Note'}
          </button>
        </>
      }
    >
      <form onSubmit={handleSubmit} className="space-y-4 text-xs">
        <div className="p-3 bg-slate-50 border border-slate-200 rounded font-semibold text-slate-700">
          Company: <strong className="text-slate-900">{companyName}</strong> | Invoice: <strong className="font-mono text-setu-600">{invoiceNumber}</strong>
        </div>

        <div className="grid grid-cols-2 gap-3">
          <div>
            <label className="block font-bold text-slate-700 uppercase tracking-wider mb-1">Follow-up Date</label>
            <input
              type="date"
              value={formData.followupDate}
              onChange={(e) => setFormData({ ...formData, followupDate: e.target.value })}
              className="w-full p-2.5 bg-slate-50 border border-slate-300 rounded font-mono font-bold text-slate-900"
            />
          </div>

          <div>
            <label className="block font-bold text-slate-700 uppercase tracking-wider mb-1">Follow-up Status</label>
            <select
              value={formData.status}
              onChange={(e) => setFormData({ ...formData, status: e.target.value })}
              className="w-full p-2.5 bg-slate-50 border border-slate-300 rounded font-bold text-slate-900"
            >
              <option value="Pending">Pending</option>
              <option value="Contacted">Contacted</option>
              <option value="Promised">Payment Promised</option>
              <option value="Resolved">Resolved</option>
            </select>
          </div>
        </div>

        <div>
          <label className="block font-bold text-slate-700 uppercase tracking-wider mb-1">Contacted Person</label>
          <input
            type="text"
            value={formData.contactPerson}
            onChange={(e) => setFormData({ ...formData, contactPerson: e.target.value })}
            placeholder="e.g. Accounts Manager (Sanjay Kumar)"
            className="w-full p-2.5 bg-slate-50 border border-slate-300 rounded font-medium"
          />
        </div>

        <div>
          <label className="block font-bold text-slate-700 uppercase tracking-wider mb-1">Follow-up Call Notes / Remarks</label>
          <textarea
            rows={3}
            value={formData.note}
            onChange={(e) => setFormData({ ...formData, note: e.target.value })}
            placeholder="e.g. Called accounts department. Confirmed payment will be processed by Friday."
            className="w-full p-2.5 bg-slate-50 border border-slate-300 rounded font-medium"
          />
        </div>
      </form>
    </Modal>
  );
};
