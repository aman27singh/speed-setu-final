import React, { useState } from 'react';
import { Modal } from '../common/Modal';
import { driverService } from '../../services/driverService';
import { validateDriverForm } from '../../utils/tripValidation';

export const DriverFormModal = ({ isOpen, onClose, onSuccess }) => {
  const [formData, setFormData] = useState({
    name: '',
    phone: '',
    alternatePhone: '',
    licenseNumber: '',
    licenseExpiry: new Date().toISOString().split('T')[0],
    address: '',
    emergencyContact: '',
    status: 'Active',
    remarks: ''
  });

  const [errors, setErrors] = useState({});
  const [saving, setSaving] = useState(false);

  const handleSubmit = async (e) => {
    e.preventDefault();
    const errs = validateDriverForm(formData);
    if (Object.keys(errs).length > 0) {
      setErrors(errs);
      return;
    }

    setSaving(true);
    try {
      const created = await driverService.createDriver(formData);
      alert(`Driver '${created.name}' added successfully!`);
      if (onSuccess) onSuccess(created);
      onClose();
    } catch (err) {
      alert(err.message || 'Failed to add driver.');
    } finally {
      setSaving(false);
    }
  };

  return (
    <Modal
      isOpen={isOpen}
      onClose={onClose}
      title="Add New Linehaul Driver"
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
            {saving ? 'Saving...' : 'Save Driver'}
          </button>
        </>
      }
    >
      <form onSubmit={handleSubmit} className="space-y-4 text-xs">
        <div>
          <label className="block font-bold text-slate-700 uppercase tracking-wider mb-1">
            Driver Full Name <span className="text-rose-500">*</span>
          </label>
          <input
            type="text"
            value={formData.name}
            onChange={(e) => setFormData({ ...formData, name: e.target.value })}
            placeholder="e.g. Ramesh Chandra Singh"
            className="w-full p-2 bg-slate-50 border border-slate-300 rounded font-semibold text-slate-900"
          />
          {errors.name && <span className="text-rose-600 text-[10px]">{errors.name}</span>}
        </div>

        <div className="grid grid-cols-2 gap-3">
          <div>
            <label className="block font-bold text-slate-700 uppercase tracking-wider mb-1">Mobile Phone <span className="text-rose-500">*</span></label>
            <input
              type="text"
              value={formData.phone}
              onChange={(e) => setFormData({ ...formData, phone: e.target.value })}
              placeholder="+91 98765 43210"
              className="w-full p-2 bg-slate-50 border border-slate-300 rounded font-mono"
            />
            {errors.phone && <span className="text-rose-600 text-[10px]">{errors.phone}</span>}
          </div>

          <div>
            <label className="block font-bold text-slate-700 uppercase tracking-wider mb-1">Alternate Phone</label>
            <input
              type="text"
              value={formData.alternatePhone}
              onChange={(e) => setFormData({ ...formData, alternatePhone: e.target.value })}
              className="w-full p-2 bg-slate-50 border border-slate-300 rounded font-mono"
            />
          </div>
        </div>

        <div className="grid grid-cols-2 gap-3">
          <div>
            <label className="block font-bold text-slate-700 uppercase tracking-wider mb-1">Driving License No <span className="text-rose-500">*</span></label>
            <input
              type="text"
              value={formData.licenseNumber}
              onChange={(e) => setFormData({ ...formData, licenseNumber: e.target.value.toUpperCase() })}
              placeholder="KA-01-20180094821"
              className="w-full p-2 bg-slate-50 border border-slate-300 rounded font-mono font-bold"
            />
            {errors.licenseNumber && <span className="text-rose-600 text-[10px]">{errors.licenseNumber}</span>}
          </div>

          <div>
            <label className="block font-bold text-slate-700 uppercase tracking-wider mb-1">License Expiry Date <span className="text-rose-500">*</span></label>
            <input
              type="date"
              value={formData.licenseExpiry}
              onChange={(e) => setFormData({ ...formData, licenseExpiry: e.target.value })}
              className="w-full p-2 bg-slate-50 border border-slate-300 rounded font-mono font-bold"
            />
            {errors.licenseExpiry && <span className="text-rose-600 text-[10px]">{errors.licenseExpiry}</span>}
          </div>
        </div>
      </form>
    </Modal>
  );
};
