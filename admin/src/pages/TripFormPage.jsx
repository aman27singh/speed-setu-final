import React, { useState, useEffect } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { tripService } from '../services/tripService';
import { transporterService } from '../services/transporterService';
import { driverService } from '../services/driverService';
import { vehicleService } from '../services/vehicleService';
import { shipmentService } from '../services/shipmentService';
import { validateTripForm } from '../utils/tripValidation';
import { PageHeader } from '../components/common/PageHeader';
import { LoadingState } from '../components/common/LoadingState';
import { ExpiryBadge } from '../components/trip/ExpiryBadge';
import { ShipmentAssignmentModal } from '../components/trip/ShipmentAssignmentModal';
import { TransporterFormModal } from '../components/transporter/TransporterFormModal';
import { DriverFormModal } from '../components/driver/DriverFormModal';
import { VehicleFormModal } from '../components/vehicle/VehicleFormModal';
import {
  Truck,
  Building2,
  User,
  Package,
  Save,
  ArrowLeft,
  AlertCircle,
  Plus,
  Calendar,
  MapPin,
  CheckCircle2
} from 'lucide-react';

const MODE_OPTIONS = ['Air', 'Air Express', 'Road', 'Train', 'FTL', 'Express LTL', 'Other'];

export const TripFormPage = () => {
  const navigate = useNavigate();
  const { id } = useParams();
  const isEditMode = !!id;

  const [formData, setFormData] = useState({
    tripNumber: 'Auto-generating...',
    tripDate: new Date().toISOString().split('T')[0],
    origin: '',
    destination: '',
    mode: 'Express LTL',
    expectedDeparture: '',
    expectedArrival: '',
    transporterId: '',
    transporterName: '',
    driverId: '',
    driverName: '',
    driverPhone: '',
    vehicleId: '',
    vehicleNumber: '',
    vehicleType: '',
    shipmentIds: [],
    status: 'Planned',
    remarks: ''
  });

  const [transporters, setTransporters] = useState([]);
  const [drivers, setDrivers] = useState([]);
  const [vehicles, setVehicles] = useState([]);
  const [availableShipments, setAvailableShipments] = useState([]);

  const [errors, setErrors] = useState({});
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  // Modal triggers
  const [showShipmentModal, setShowShipmentModal] = useState(false);
  const [showTransporterModal, setShowTransporterModal] = useState(false);
  const [showDriverModal, setShowDriverModal] = useState(false);
  const [showVehicleModal, setShowVehicleModal] = useState(false);

  const fetchMasterData = async () => {
    setLoading(true);
    try {
      const [tList, dList, vList, sList] = await Promise.all([
        transporterService.getTransporters(),
        driverService.getDrivers(),
        vehicleService.getVehicles(),
        shipmentService.getShipments()
      ]);

      setTransporters(tList);
      setDrivers(dList);
      setVehicles(vList);
      setAvailableShipments(sList);

      if (isEditMode) {
        const existing = await tripService.getTrip(id);
        setFormData(existing);
      } else {
        const nextID = await tripService.generateNextTripID();
        const defaultTransporter = tList[0];
        const defaultDriver = dList[0];
        const defaultVehicle = vList[0];

        setFormData((prev) => ({
          ...prev,
          tripNumber: nextID,
          transporterId: defaultTransporter ? defaultTransporter.id : '',
          transporterName: defaultTransporter ? defaultTransporter.name : '',
          driverId: defaultDriver ? defaultDriver.id : '',
          driverName: defaultDriver ? defaultDriver.name : '',
          driverPhone: defaultDriver ? defaultDriver.phone : '',
          vehicleId: defaultVehicle ? defaultVehicle.id : '',
          vehicleNumber: defaultVehicle ? defaultVehicle.vehicleNumber : '',
          vehicleType: defaultVehicle ? defaultVehicle.vehicleType : '',
          origin: 'Bengaluru Hub',
          destination: 'Pune Hub',
          shipmentIds: sList.length > 0 ? [sList[0].id] : []
        }));
      }
    } catch (err) {
      alert(err.message || 'Failed to load form initialization data.');
      navigate('/admin/trips');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchMasterData();
  }, [id, isEditMode]);

  // Compute live trip metrics for selected shipments
  const selectedShipmentObjects = availableShipments.filter((s) =>
    (formData.shipmentIds || []).includes(s.id)
  );

  const totalPackages = selectedShipmentObjects.reduce((acc, s) => acc + (s.packages || 0), 0);
  const totalWeight = selectedShipmentObjects.reduce((acc, s) => acc + (s.actualWeight || 0), 0);

  const handleSubmit = async (e, createAnother = false) => {
    if (e) e.preventDefault();
    const validationErrors = validateTripForm(formData);
    if (Object.keys(validationErrors).length > 0) {
      setErrors(validationErrors);
      window.scrollTo({ top: 0, behavior: 'smooth' });
      return;
    }

    setSaving(true);
    try {
      if (isEditMode) {
        await tripService.updateTrip(id, formData);
        navigate(`/admin/trips/${id}`);
      } else {
        const created = await tripService.createTrip(formData);
        if (createAnother) {
          const nextID = await tripService.generateNextTripID();
          setFormData({
            ...formData,
            tripNumber: nextID,
            shipmentIds: []
          });
          setErrors({});
          window.scrollTo({ top: 0, behavior: 'smooth' });
          alert(`Trip ${created.tripNumber} created successfully!`);
        } else {
          alert(`Trip ${created.tripNumber} created successfully with ${created.shipmentIds.length} assigned shipments!`);
          navigate(`/admin/trips/${created.id}`);
        }
      }
    } catch (err) {
      alert(err.message || 'Failed to save trip.');
    } finally {
      setSaving(false);
    }
  };

  if (loading) {
    return <LoadingState message="Initializing Linehaul Dispatch Builder..." />;
  }

  return (
    <div className="space-y-6 max-w-5xl mx-auto pb-12">
      <PageHeader
        title={isEditMode ? `Edit Trip — ${formData.tripNumber}` : `Create New Trip — ${formData.tripNumber}`}
        description="Schedule a linehaul trip movement, assign transporter, vehicle, driver and attach shipments."
        breadcrumbs={['Speed Setu Admin', 'Operations', 'Trips', isEditMode ? 'Edit' : 'New']}
        actions={
          <button
            type="button"
            onClick={() => navigate(-1)}
            className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold text-slate-700 bg-white border border-slate-300 rounded-md hover:bg-slate-50 transition-colors"
          >
            <ArrowLeft className="w-4 h-4" />
            <span>Cancel</span>
          </button>
        }
      />

      {/* Form Validation Errors Banner */}
      {Object.keys(errors).length > 0 && (
        <div className="p-4 bg-rose-50 border border-rose-200 rounded-xl text-rose-800 text-xs font-medium space-y-1">
          <div className="flex items-center gap-2 font-bold text-rose-900 text-sm mb-1">
            <AlertCircle className="w-4 h-4 text-rose-600" />
            <span>Please resolve errors before saving trip:</span>
          </div>
          <ul className="list-disc list-inside space-y-0.5 text-rose-700">
            {Object.values(errors).map((err, idx) => (
              <li key={idx}>{err}</li>
            ))}
          </ul>
        </div>
      )}

      <form onSubmit={(e) => handleSubmit(e, false)} className="space-y-6">
        {/* SECTION A: TRIP ROUTE & SPECS */}
        <div className="bg-white border border-slate-200 rounded-xl p-4 sm:p-6 shadow-xs space-y-4">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 border-b border-slate-100 pb-3">
            <div className="flex items-center gap-2">
              <div className="p-2 rounded-lg bg-blue-50 text-setu-600 shrink-0">
                <Truck className="w-4 h-4" />
              </div>
              <div>
                <h3 className="text-sm font-bold text-slate-900">Section A — Trip Route & Dispatch Information</h3>
                <p className="text-xs text-slate-500">Origin, destination, freight mode and departure dates</p>
              </div>
            </div>

            <div className="self-start sm:self-auto px-3 py-1 bg-setu-50 text-setu-700 rounded font-mono font-bold text-xs border border-setu-100 whitespace-nowrap">
              Trip ID: {formData.tripNumber}
            </div>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-3 sm:gap-4 text-xs">
            <div>
              <label className="block font-bold text-slate-700 uppercase tracking-wider mb-1">
                Origin City / Hub <span className="text-rose-500">*</span>
              </label>
              <input
                type="text"
                value={formData.origin}
                onChange={(e) => setFormData({ ...formData, origin: e.target.value })}
                placeholder="e.g. Bengaluru Hub"
                className="w-full p-2.5 bg-slate-50 border border-slate-300 rounded-md font-semibold text-slate-900"
              />
            </div>

            <div>
              <label className="block font-bold text-slate-700 uppercase tracking-wider mb-1">
                Destination City / Hub <span className="text-rose-500">*</span>
              </label>
              <input
                type="text"
                value={formData.destination}
                onChange={(e) => setFormData({ ...formData, destination: e.target.value })}
                placeholder="e.g. Pune Hub"
                className="w-full p-2.5 bg-slate-50 border border-slate-300 rounded-md font-semibold text-slate-900"
              />
            </div>

            <div>
              <label className="block font-bold text-slate-700 uppercase tracking-wider mb-1">
                Freight Mode <span className="text-rose-500">*</span>
              </label>
              <select
                value={formData.mode}
                onChange={(e) => setFormData({ ...formData, mode: e.target.value })}
                className="w-full p-2.5 bg-slate-50 border border-slate-300 rounded-md font-bold text-slate-900"
              >
                {MODE_OPTIONS.map((m) => (
                  <option key={m} value={m}>{m}</option>
                ))}
              </select>
            </div>

            <div>
              <label className="block font-bold text-slate-700 uppercase tracking-wider mb-1">
                Trip Date <span className="text-rose-500">*</span>
              </label>
              <input
                type="date"
                value={formData.tripDate}
                onChange={(e) => setFormData({ ...formData, tripDate: e.target.value })}
                className="w-full p-2.5 bg-slate-50 border border-slate-300 rounded-md font-mono font-bold"
              />
            </div>

            <div>
              <label className="block font-bold text-slate-700 uppercase tracking-wider mb-1">Expected Departure</label>
              <input
                type="text"
                value={formData.expectedDeparture || ''}
                onChange={(e) => setFormData({ ...formData, expectedDeparture: e.target.value })}
                placeholder="2026-02-14 16:00"
                className="w-full p-2.5 bg-slate-50 border border-slate-300 rounded-md font-mono"
              />
            </div>

            <div>
              <label className="block font-bold text-slate-700 uppercase tracking-wider mb-1">Expected Arrival</label>
              <input
                type="text"
                value={formData.expectedArrival || ''}
                onChange={(e) => setFormData({ ...formData, expectedArrival: e.target.value })}
                placeholder="2026-02-16 06:00"
                className="w-full p-2.5 bg-slate-50 border border-slate-300 rounded-md font-mono"
              />
            </div>
          </div>
        </div>

        {/* SECTIONS B, C, D: TRANSPORTER, DRIVER, VEHICLE */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4 sm:gap-6">
          {/* Section B: Transporter */}
          <div className="bg-white border border-slate-200 rounded-xl p-4 sm:p-5 shadow-xs space-y-3 text-xs">
            <div className="flex items-center justify-between border-b border-slate-100 pb-2">
              <span className="font-bold text-slate-900 uppercase tracking-wider text-[11px] flex items-center gap-1.5">
                <Building2 className="w-3.5 h-3.5 text-setu-600 shrink-0" />
                Transporter Vendor <span className="text-rose-500">*</span>
              </span>
              <button
                type="button"
                onClick={() => setShowTransporterModal(true)}
                className="text-[10px] text-setu-600 font-bold hover:underline shrink-0"
              >
                + Add New
              </button>
            </div>

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
              className="w-full p-2 bg-slate-50 border border-slate-300 rounded font-bold text-slate-900"
            >
              {transporters.map((t) => (
                <option key={t.id} value={t.id}>{t.name}</option>
              ))}
            </select>
          </div>

          {/* Section C: Driver */}
          <div className="bg-white border border-slate-200 rounded-xl p-4 sm:p-5 shadow-xs space-y-3 text-xs">
            <div className="flex items-center justify-between border-b border-slate-100 pb-2">
              <span className="font-bold text-slate-900 uppercase tracking-wider text-[11px] flex items-center gap-1.5">
                <User className="w-3.5 h-3.5 text-emerald-600 shrink-0" />
                Assigned Driver
              </span>
              <button
                type="button"
                onClick={() => setShowDriverModal(true)}
                className="text-[10px] text-setu-600 font-bold hover:underline shrink-0"
              >
                + Add New
              </button>
            </div>

            <select
              value={formData.driverId}
              onChange={(e) => {
                const d = drivers.find((x) => x.id === e.target.value);
                setFormData({
                  ...formData,
                  driverId: e.target.value,
                  driverName: d ? d.name : '',
                  driverPhone: d ? d.phone : ''
                });
              }}
              className="w-full p-2 bg-slate-50 border border-slate-300 rounded font-semibold text-slate-900"
            >
              {drivers.map((d) => (
                <option key={d.id} value={d.id}>{d.name} ({d.phone})</option>
              ))}
            </select>

            {formData.driverId && (
              <div className="pt-1">
                <ExpiryBadge dateString={drivers.find((d) => d.id === formData.driverId)?.licenseExpiry} />
              </div>
            )}
          </div>

          {/* Section D: Vehicle */}
          <div className="bg-white border border-slate-200 rounded-xl p-4 sm:p-5 shadow-xs space-y-3 text-xs">
            <div className="flex items-center justify-between border-b border-slate-100 pb-2">
              <span className="font-bold text-slate-900 uppercase tracking-wider text-[11px] flex items-center gap-1.5">
                <Truck className="w-3.5 h-3.5 text-amber-600 shrink-0" />
                Assigned Vehicle
              </span>
              <button
                type="button"
                onClick={() => setShowVehicleModal(true)}
                className="text-[10px] text-setu-600 font-bold hover:underline shrink-0"
              >
                + Add New
              </button>
            </div>

            <select
              value={formData.vehicleId}
              onChange={(e) => {
                const v = vehicles.find((x) => x.id === e.target.value);
                setFormData({
                  ...formData,
                  vehicleId: e.target.value,
                  vehicleNumber: v ? v.vehicleNumber : '',
                  vehicleType: v ? v.vehicleType : ''
                });
              }}
              className="w-full p-2 bg-slate-50 border border-slate-300 rounded font-mono font-bold text-slate-900"
            >
              {vehicles.map((v) => (
                <option key={v.id} value={v.id}>{v.vehicleNumber} ({v.vehicleType})</option>
              ))}
            </select>

            {formData.vehicleId && (
              <div className="pt-1 flex items-center gap-1 flex-wrap">
                <ExpiryBadge dateString={vehicles.find((v) => v.id === formData.vehicleId)?.insuranceExpiry} />
              </div>
            )}
          </div>
        </div>

        {/* SECTION E: ASSIGN SHIPMENTS & LIVE SUMMARY METRICS */}
        <div className="bg-white border border-slate-200 rounded-xl p-4 sm:p-6 shadow-xs space-y-4">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 border-b border-slate-100 pb-3">
            <div className="flex items-center gap-2">
              <div className="p-2 rounded-lg bg-purple-50 text-purple-600 shrink-0">
                <Package className="w-4 h-4" />
              </div>
              <div>
                <h3 className="text-sm font-bold text-slate-900">Section E — Assigned Consignment Notes (Shipments)</h3>
                <p className="text-xs text-slate-500">Select unassigned shipments for linehaul movement</p>
              </div>
            </div>

            <button
              type="button"
              onClick={() => setShowShipmentModal(true)}
              className="self-start sm:self-auto inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-bold text-white bg-setu-600 hover:bg-setu-700 rounded transition-colors shadow-xs shrink-0 whitespace-nowrap"
            >
              <Plus className="w-3.5 h-3.5" />
              <span>Select Shipments</span>
            </button>
          </div>

          {/* DYNAMIC LIVE METRICS SUMMARY BAR */}
          <div className="p-3.5 sm:p-4 bg-setu-50/50 border border-setu-200 rounded-xl grid grid-cols-2 sm:grid-cols-4 gap-3 sm:gap-4 text-xs text-slate-800">
            <div>
              <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider block">Assigned Shipments</span>
              <span className="text-sm font-black text-setu-700 font-mono">{selectedShipmentObjects.length} CNs</span>
            </div>
            <div>
              <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider block">Total Packages</span>
              <span className="text-sm font-black text-slate-900 font-mono">{totalPackages} Boxes</span>
            </div>
            <div>
              <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider block">Total Gross Weight</span>
              <span className="text-sm font-black text-slate-900 font-mono">{totalWeight} Kg</span>
            </div>
            <div>
              <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider block">Route</span>
              <span className="text-xs sm:text-sm font-bold text-slate-900 truncate block">{formData.origin || 'Origin'} → {formData.destination || 'Destination'}</span>
            </div>
          </div>

          {/* SELECTED SHIPMENTS TABLE */}
          {selectedShipmentObjects.length > 0 ? (
            <div className="border border-slate-200 rounded-lg overflow-x-auto text-xs">
              <table className="w-full text-left border-collapse">
                <thead className="bg-slate-50 text-slate-600 border-b border-slate-200 uppercase font-bold text-[10px]">
                  <tr>
                    <th className="p-2.5">CN Number</th>
                    <th className="p-2.5">Company</th>
                    <th className="p-2.5">Route</th>
                    <th className="p-2.5 text-center">Packages</th>
                    <th className="p-2.5 text-right">Weight</th>
                    <th className="p-2.5 text-right">Action</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100 font-medium">
                  {selectedShipmentObjects.map((s) => (
                    <tr key={s.id}>
                      <td className="p-2.5 font-bold font-mono text-setu-600">{s.cnNumber}</td>
                      <td className="p-2.5 font-semibold text-slate-900">{s.companyName}</td>
                      <td className="p-2.5 text-slate-700">{s.origin} → {s.destination}</td>
                      <td className="p-2.5 text-center font-mono">{s.packages} Boxes</td>
                      <td className="p-2.5 text-right font-mono font-bold">{s.actualWeight} Kg</td>
                      <td className="p-2.5 text-right">
                        <button
                          type="button"
                          onClick={() => {
                            setFormData((prev) => ({
                              ...prev,
                              shipmentIds: prev.shipmentIds.filter((id) => id !== s.id)
                            }));
                          }}
                          className="text-rose-600 hover:underline font-semibold text-[11px]"
                        >
                          Remove
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          ) : (
            <div className="p-6 border-2 border-dashed border-slate-200 rounded-xl text-center text-xs text-slate-400">
              No shipments attached to this trip yet. Click <strong>Select Shipments</strong> above.
            </div>
          )}
        </div>

        {/* BOTTOM FORM ACTIONS */}
        <div className="flex flex-col-reverse sm:flex-row sm:items-center sm:justify-end gap-2.5 pt-4 border-t border-slate-200">
          <button
            type="button"
            onClick={() => navigate(-1)}
            className="w-full sm:w-auto px-4 py-2 text-xs font-semibold text-slate-700 bg-white border border-slate-300 rounded-md hover:bg-slate-50 transition-colors text-center"
          >
            Cancel
          </button>

          {!isEditMode && (
            <button
              type="button"
              disabled={saving}
              onClick={(e) => handleSubmit(e, true)}
              className="w-full sm:w-auto px-4 py-2 text-xs font-bold text-setu-700 bg-setu-50 border border-setu-200 rounded-md hover:bg-setu-100 transition-colors text-center"
            >
              Create & Add Another
            </button>
          )}

          <button
            type="submit"
            disabled={saving}
            className="w-full sm:w-auto inline-flex items-center justify-center gap-2 px-5 py-2 text-xs font-bold text-white bg-setu-600 hover:bg-setu-700 rounded-md shadow-sm transition-colors disabled:opacity-50"
          >
            <Save className="w-4 h-4" />
            <span>{saving ? 'Saving...' : isEditMode ? 'Save Trip Changes' : 'Create Trip'}</span>
          </button>
        </div>
      </form>

      {/* MODALS */}
      <ShipmentAssignmentModal
        isOpen={showShipmentModal}
        onClose={() => setShowShipmentModal(false)}
        assignedShipmentIds={formData.shipmentIds}
        onAssign={(ids) => setFormData((prev) => ({ ...prev, shipmentIds: ids }))}
      />

      <TransporterFormModal
        isOpen={showTransporterModal}
        onClose={() => setShowTransporterModal(false)}
        onSuccess={fetchMasterData}
      />

      <DriverFormModal
        isOpen={showDriverModal}
        onClose={() => setShowDriverModal(false)}
        onSuccess={fetchMasterData}
      />

      <VehicleFormModal
        isOpen={showVehicleModal}
        onClose={() => setShowVehicleModal(false)}
        transporters={transporters}
        onSuccess={fetchMasterData}
      />
    </div>
  );
};
