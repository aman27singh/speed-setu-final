import React, { useState } from 'react';
import { Modal } from '../common/Modal';
import { vehicleService } from '../../services/vehicleService';
import { validateVehicleForm } from '../../utils/tripValidation';

export const VehicleFormModal = ({ isOpen, onClose, transporters = [], onSuccess }) => {
  const [formData, setFormData] = useState({
    vehicleNumber: '',
    vehicleType: '32ft MX Container Truck (14 Ton)',
    transporterId: transporters[0]?.id || '',
    transporterName: transporters[0]?.name || '',
    registrationNumber: '',
    model: '',
    registrationDate: new Date().toISOString().split('T')[0],
    insuranceExpiry: new Date().toISOString().split('T')[0],
    permitExpiry: new Date().toISOString().split('T')[0],
    fitnessExpiry: new Date().toISOString().split('T')[0],
    status: 'Available',
    remarks: ''
  });

  const [errors, setErrors] = useState({});
  const [saving, setSaving] = useState(false);

  const handleSubmit = async (e) => {
    e.preventDefault();
    const errs = validateVehicleForm(formData);
    if (Object.keys(errs).length > 0) {
      setErrors(errs);
      return;
    }

    setSaving(true);
    try {
      const created = await vehicleService.createVehicle(formData);
      alert(`Vehicle '${created.vehicleNumber}' added successfully!`);
      if (onSuccess) onSuccess(created);
      onClose();
    } catch (err) {
      alert(err.message || 'Failed to add vehicle.');
    } finally {
      setSaving(false);
    }
  };

  return (
    <Modal
      isOpen={isOpen}
      onClose={onClose}
      title="Add New Fleet Vehicle"
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
            {saving ? 'Saving...' : 'Save Vehicle'}
          </button>
        </>
      }
    >
      <form onSubmit={handleSubmit} className="space-y-4 text-xs">
        <div>
          <label className="block font-bold text-slate-700 uppercase tracking-wider mb-1">
            Vehicle Registration Number <span className="text-rose-500">*</span>
          </label>
          <input
            type="text"
            value={formData.vehicleNumber}
            onChange={(e) => setFormData({ ...formData, vehicleNumber: e.target.value.toUpperCase() })}
            placeholder="e.g. MH-04-JK-9821"
            className="w-full p-2 bg-slate-50 border border-slate-300 rounded font-mono font-bold text-slate-900"
          />
          {errors.vehicleNumber && <span className="text-rose-600 text-[10px]">{errors.vehicleNumber}</span>}
        </div>

        <div className="grid grid-cols-2 gap-3">
          <div>
            <label className="block font-bold text-slate-700 uppercase tracking-wider mb-1">Vehicle Type <span className="text-rose-500">*</span></label>
            <input
              type="text"
              value={formData.vehicleType}
              onChange={(e) => setFormData({ ...formData, vehicleType: e.target.value })}
              placeholder="32ft MX Container Truck"
              className="w-full p-2 bg-slate-50 border border-slate-300 rounded font-semibold"
            />
          </div>

          <div>
            <label className="block font-bold text-slate-700 uppercase tracking-wider mb-1">Transporter / Owner</label>
            <select
              value={formData.transporterId}
              onChange={(e) => {
                const t = transporters.find((x) => x.id === e.target.value);
                setFormData({
                  ...formData,
                  transporterId: e.target.value,
                  transporterName: t ? t.name : ''
                });
              }}
              className="w-full p-2 bg-slate-50 border border-slate-300 rounded font-semibold"
            >
              {transporters.map((t) => (
                <option key={t.id} value={t.id}>{t.name}</option>
              ))}
            </select>
          </div>
        </div>

        <div className="grid grid-cols-3 gap-2 pt-2 border-t border-slate-100">
          <div>
            <label className="block font-bold text-slate-700 uppercase tracking-wider mb-1">Insurance Expiry</label>
            <input
              type="date"
              value={formData.insuranceExpiry}
              onChange={(e) => setFormData({ ...formData, insuranceExpiry: e.target.value })}
              className="w-full p-2 bg-slate-50 border border-slate-300 rounded font-mono"
            />
          </div>
          <div>
            <label className="block font-bold text-slate-700 uppercase tracking-wider mb-1">Permit Expiry</label>
            <input
              type="date"
              value={formData.permitExpiry}
              onChange={(e) => setFormData({ ...formData, permitExpiry: e.target.value })}
              className="w-full p-2 bg-slate-50 border border-slate-300 rounded font-mono"
            />
          </div>
          <div>
            <label className="block font-bold text-slate-700 uppercase tracking-wider mb-1">Fitness Expiry</label>
            <input
              type="date"
              value={formData.fitnessExpiry}
              onChange={(e) => setFormData({ ...formData, fitnessExpiry: e.target.value })}
              className="w-full p-2 bg-slate-50 border border-slate-300 rounded font-mono"
            />
          </div>
        </div>
      </form>
    </Modal>
  );
};
