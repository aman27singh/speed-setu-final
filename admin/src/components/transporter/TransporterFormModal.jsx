import React, { useState } from 'react';
import { Modal } from '../common/Modal';
import { transporterService } from '../../services/transporterService';
import { validateTransporterForm } from '../../utils/tripValidation';

export const TransporterFormModal = ({ isOpen, onClose, onSuccess }) => {
  const [formData, setFormData] = useState({
    name: '',
    gstin: '',
    contactPerson: '',
    phone: '',
    email: '',
    address: '',
    state: 'Karnataka',
    paymentTerms: 'Net 30 Days',
    status: 'Active',
    remarks: ''
  });

  const [errors, setErrors] = useState({});
  const [saving, setSaving] = useState(false);

  const handleSubmit = async (e) => {
    e.preventDefault();
    const errs = validateTransporterForm(formData);
    if (Object.keys(errs).length > 0) {
      setErrors(errs);
      return;
    }

    setSaving(true);
    try {
      const created = await transporterService.createTransporter(formData);
      alert(`Transporter '${created.name}' created successfully!`);
      if (onSuccess) onSuccess(created);
      onClose();
    } catch (err) {
      alert(err.message || 'Failed to create transporter.');
    } finally {
      setSaving(false);
    }
  };

  return (
    <Modal
      isOpen={isOpen}
      onClose={onClose}
      title="Add New Transporter Vendor"
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
            {saving ? 'Saving...' : 'Save Transporter'}
          </button>
        </>
      }
    >
      <form onSubmit={handleSubmit} className="space-y-4 text-xs">
        <div>
          <label className="block font-bold text-slate-700 uppercase tracking-wider mb-1">
            Transporter Name <span className="text-rose-500">*</span>
          </label>
          <input
            type="text"
            value={formData.name}
            onChange={(e) => setFormData({ ...formData, name: e.target.value })}
            placeholder="e.g. National Express Freight Carriers"
            className="w-full p-2 bg-slate-50 border border-slate-300 rounded font-semibold"
          />
          {errors.name && <span className="text-rose-600 text-[10px]">{errors.name}</span>}
        </div>

        <div className="grid grid-cols-2 gap-3">
          <div>
            <label className="block font-bold text-slate-700 uppercase tracking-wider mb-1">Contact Person <span className="text-rose-500">*</span></label>
            <input
              type="text"
              value={formData.contactPerson}
              onChange={(e) => setFormData({ ...formData, contactPerson: e.target.value })}
              placeholder="Harpreet Singh"
              className="w-full p-2 bg-slate-50 border border-slate-300 rounded"
            />
            {errors.contactPerson && <span className="text-rose-600 text-[10px]">{errors.contactPerson}</span>}
          </div>

          <div>
            <label className="block font-bold text-slate-700 uppercase tracking-wider mb-1">Phone <span className="text-rose-500">*</span></label>
            <input
              type="text"
              value={formData.phone}
              onChange={(e) => setFormData({ ...formData, phone: e.target.value })}
              placeholder="+91 98140 88776"
              className="w-full p-2 bg-slate-50 border border-slate-300 rounded font-mono"
            />
            {errors.phone && <span className="text-rose-600 text-[10px]">{errors.phone}</span>}
          </div>
        </div>

        <div className="grid grid-cols-2 gap-3">
          <div>
            <label className="block font-bold text-slate-700 uppercase tracking-wider mb-1">GSTIN</label>
            <input
              type="text"
              value={formData.gstin}
              onChange={(e) => setFormData({ ...formData, gstin: e.target.value.toUpperCase() })}
              className="w-full p-2 bg-slate-50 border border-slate-300 rounded font-mono"
            />
          </div>

          <div>
            <label className="block font-bold text-slate-700 uppercase tracking-wider mb-1">Payment Terms</label>
            <select
              value={formData.paymentTerms}
              onChange={(e) => setFormData({ ...formData, paymentTerms: e.target.value })}
              className="w-full p-2 bg-slate-50 border border-slate-300 rounded"
            >
              <option value="Immediate">Immediate / Advance</option>
              <option value="Net 15 Days">Net 15 Days</option>
              <option value="Net 30 Days">Net 30 Days</option>
              <option value="Net 45 Days">Net 45 Days</option>
            </select>
          </div>
        </div>
      </form>
    </Modal>
  );
};
