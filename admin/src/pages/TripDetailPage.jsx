import React, { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { tripService } from '../services/tripService';
import { shipmentService } from '../services/shipmentService';
import { formatDate } from '../utils/formatters';
import { StatusBadge } from '../components/common/StatusBadge';
import { PageHeader } from '../components/common/PageHeader';
import { LoadingState } from '../components/common/LoadingState';
import { EmptyState } from '../components/common/EmptyState';
import { Modal } from '../components/common/Modal';
import { TripStatusTimeline } from '../components/trip/TripStatusTimeline';
import { ExpiryBadge } from '../components/trip/ExpiryBadge';
import { ShipmentAssignmentModal } from '../components/trip/ShipmentAssignmentModal';
import {
  Truck,
  Building2,
  User,
  Package,
  Edit,
  ArrowLeft,
  RefreshCw,
  Plus,
  Trash2,
  FileText,
  Printer,
  DollarSign,
  AlertCircle,
  X
} from 'lucide-react';

export const TripDetailPage = () => {
  const { id } = useParams();
  const navigate = useNavigate();

  const [trip, setTrip] = useState(null);
  const [assignedShipments, setAssignedShipments] = useState([]);
  const [loading, setLoading] = useState(true);

  // Modal States
  const [showStatusModal, setShowStatusModal] = useState(false);
  const [showShipmentModal, setShowShipmentModal] = useState(false);
  const [newStatus, setNewStatus] = useState('');
  const [statusLocation, setStatusLocation] = useState('');
  const [statusRemarks, setStatusRemarks] = useState('');

  const [toastMessage, setToastMessage] = useState('');

  const fetchTripData = async () => {
    setLoading(true);
    try {
      const data = await tripService.getTrip(id);
      setTrip(data);
      setNewStatus(data.status);
      setStatusLocation(data.origin);

      // Fetch assigned shipment details
      if (data.shipmentIds && data.shipmentIds.length > 0) {
        const shipmentPromises = data.shipmentIds.map((sId) =>
          shipmentService.getShipment(sId).catch(() => null)
        );
        const resolved = await Promise.all(shipmentPromises);
        setAssignedShipments(resolved.filter(Boolean));
      } else {
        setAssignedShipments([]);
      }
    } catch (err) {
      alert(err.message || 'Failed to load trip profile.');
      navigate('/admin/trips');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchTripData();
  }, [id]);

  const handleStatusUpdateSubmit = async (e) => {
    e.preventDefault();
    try {
      await tripService.updateTripStatus(trip.id, newStatus, statusLocation, statusRemarks);
      setToastMessage(`Trip status updated to '${newStatus}' successfully!`);
      setShowStatusModal(false);
      setStatusRemarks('');
      fetchTripData();
      setTimeout(() => setToastMessage(''), 4000);
    } catch (err) {
      alert(err.message || 'Failed to update trip status.');
    }
  };

  const handleRemoveShipment = async (shipmentId) => {
    if (!window.confirm('Remove this consignment note from the trip?')) return;
    try {
      await tripService.removeShipmentFromTrip(trip.id, shipmentId);
      setToastMessage('Shipment removed from trip.');
      fetchTripData();
      setTimeout(() => setToastMessage(''), 4000);
    } catch (err) {
      alert(err.message || 'Failed to remove shipment.');
    }
  };

  const handleSaveAssignedShipments = async (newShipmentIds) => {
    try {
      await tripService.updateTrip(trip.id, { shipmentIds: newShipmentIds });
      setToastMessage('Trip shipments updated successfully!');
      fetchTripData();
      setTimeout(() => setToastMessage(''), 4000);
    } catch (err) {
      alert(err.message || 'Failed to update assigned shipments.');
    }
  };

  if (loading) {
    return <LoadingState message="Loading Linehaul Trip Profile..." />;
  }

  if (!trip) return null;

  const totalPackages = assignedShipments.reduce((acc, s) => acc + (s.packages || 0), 0);
  const totalWeight = assignedShipments.reduce((acc, s) => acc + (s.actualWeight || 0), 0);

  return (
    <div className="space-y-6 pb-12">
      {/* Top Header & Actions */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div className="flex items-center gap-3">
          <button
            onClick={() => navigate('/admin/trips')}
            className="p-2 text-slate-600 bg-white border border-slate-200 rounded-lg hover:bg-slate-50 transition-colors shadow-xs"
          >
            <ArrowLeft className="w-4 h-4" />
          </button>

          <div>
            <div className="flex items-center gap-2">
              <span className="text-xs font-bold text-slate-400 uppercase tracking-wider">Linehaul Dispatch Trip</span>
              <span className="text-[10px] px-1.5 py-0.2 rounded bg-setu-50 font-mono text-setu-700 font-bold border border-setu-100">
                Mode: {trip.mode}
              </span>
            </div>

            <div className="flex items-center gap-3">
              <h1 className="text-2xl font-bold text-slate-900 font-mono tracking-tight flex items-center gap-2">
                <span>{trip.tripNumber}</span>
              </h1>

              <span className="text-sm font-semibold text-slate-700">
                {trip.origin} → {trip.destination}
              </span>

              <StatusBadge status={trip.status} />
            </div>
          </div>
        </div>

        <div className="flex items-center gap-2 flex-wrap">
          <button
            onClick={() => setShowStatusModal(true)}
            className="inline-flex items-center gap-1.5 px-3.5 py-1.5 text-xs font-bold text-white bg-setu-600 hover:bg-setu-700 rounded-md shadow-xs transition-colors"
          >
            <RefreshCw className="w-3.5 h-3.5" />
            <span>Update Trip Status</span>
          </button>

          <button
            onClick={() => setShowShipmentModal(true)}
            className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-bold text-slate-700 bg-white border border-slate-300 rounded-md hover:bg-slate-50 transition-colors"
          >
            <Plus className="w-3.5 h-3.5 text-setu-600" />
            <span>Add Shipment</span>
          </button>

          <button
            onClick={() => navigate(`/admin/trips/${trip.id}/edit`)}
            className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold text-slate-700 bg-white border border-slate-300 rounded-md hover:bg-slate-50 transition-colors"
          >
            <Edit className="w-3.5 h-3.5" />
            <span>Edit</span>
          </button>

          <button
            onClick={() => window.print()}
            className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold text-slate-700 bg-white border border-slate-300 rounded-md hover:bg-slate-50 transition-colors"
          >
            <Printer className="w-3.5 h-3.5" />
            <span>Print Manifest</span>
          </button>
        </div>
      </div>

      {/* Toast Notification */}
      {toastMessage && (
        <div className="p-3 bg-slate-900 text-white rounded-lg text-xs font-semibold flex items-center justify-between shadow-lg animate-fade-in">
          <span>{toastMessage}</span>
          <button onClick={() => setToastMessage('')} className="text-slate-400 hover:text-white font-bold">
            <X className="w-4 h-4" />
          </button>
        </div>
      )}

      {/* VISUAL TRIP DISPATCH TIMELINE */}
      <TripStatusTimeline currentStatus={trip.status} statusHistory={trip.statusHistory} />

      {/* SUMMARY METRICS STRIP */}
      <div className="bg-white border border-slate-200 rounded-xl p-4 shadow-xs grid grid-cols-2 sm:grid-cols-4 gap-4 divide-y sm:divide-y-0 sm:divide-x divide-slate-100">
        <div>
          <span className="text-[11px] font-bold text-slate-400 uppercase tracking-wider block">Trip Date</span>
          <span className="text-xs font-bold text-slate-900 font-mono">{formatDate(trip.tripDate)}</span>
        </div>

        <div className="pt-2 sm:pt-0 sm:pl-4">
          <span className="text-[11px] font-bold text-slate-400 uppercase tracking-wider block">Assigned Shipments</span>
          <span className="text-xs font-bold text-setu-600 font-mono">{assignedShipments.length} CNs</span>
        </div>

        <div className="pt-2 sm:pt-0 sm:pl-4">
          <span className="text-[11px] font-bold text-slate-400 uppercase tracking-wider block">Total Freight Volume</span>
          <span className="text-xs font-bold text-slate-900">{totalPackages} Packages ({totalWeight} Kg)</span>
        </div>

        <div className="pt-2 sm:pt-0 sm:pl-4">
          <span className="text-[11px] font-bold text-slate-400 uppercase tracking-wider block">Vehicle</span>
          <span className="text-xs font-bold text-slate-900 font-mono">{trip.vehicleNumber || 'Unassigned'}</span>
        </div>
      </div>

      {/* TRIP EXPENSES & PAYABLES BREAKDOWN CARD */}
      <div className="bg-white border border-slate-200 rounded-xl p-5 shadow-xs space-y-3 text-xs">
        <div className="flex items-center justify-between border-b border-slate-100 pb-2">
          <div className="flex items-center gap-2">
            <DollarSign className="w-4 h-4 text-emerald-600" />
            <h3 className="font-bold text-slate-900 uppercase tracking-wider text-[11px]">Trip Expenses & Transporter Payable Summary</h3>
          </div>
          <span className="font-mono font-bold text-slate-900 text-sm">Total Trip Expense: {formatINR(21000)}</span>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 font-mono">
          <div className="p-3 bg-slate-50 border border-slate-200 rounded flex justify-between items-center">
            <span className="text-slate-600 font-sans">Transporter Freight:</span>
            <strong className="text-slate-900">{formatINR(18000)}</strong>
          </div>
          <div className="p-3 bg-slate-50 border border-slate-200 rounded flex justify-between items-center">
            <span className="text-slate-600 font-sans">NH-48 Toll:</span>
            <strong className="text-slate-900">{formatINR(3000)}</strong>
          </div>
          <div className="p-3 bg-setu-50/70 border border-setu-200 rounded flex justify-between items-center">
            <span className="text-setu-800 font-sans font-bold">Transporter Payable:</span>
            <strong className="text-setu-700">{formatINR(8000)} (Partially Paid)</strong>
          </div>
        </div>
      </div>

      {/* THREE ENTITY CARDS: TRANSPORTER, DRIVER, VEHICLE */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        {/* Transporter Card */}
        <div className="bg-white border border-slate-200 rounded-xl p-5 shadow-xs space-y-3 text-xs">
          <div className="flex items-center gap-2 border-b border-slate-100 pb-2">
            <Building2 className="w-4 h-4 text-setu-600" />
            <h3 className="font-bold text-slate-900 uppercase tracking-wider text-[11px]">Transporter Vendor</h3>
          </div>
          <div>
            <span className="font-bold text-slate-900 text-sm block">{trip.transporterName}</span>
            <span className="text-[10px] text-slate-400 font-mono block mt-0.5">Vendor ID: {trip.transporterId}</span>
          </div>
        </div>

        {/* Driver Card */}
        <div className="bg-white border border-slate-200 rounded-xl p-5 shadow-xs space-y-3 text-xs">
          <div className="flex items-center gap-2 border-b border-slate-100 pb-2">
            <User className="w-4 h-4 text-emerald-600" />
            <h3 className="font-bold text-slate-900 uppercase tracking-wider text-[11px]">Linehaul Driver</h3>
          </div>
          <div>
            <span className="font-bold text-slate-900 text-sm block">{trip.driverName || 'Unassigned'}</span>
            <span className="text-xs font-mono text-slate-600 block mt-0.5">{trip.driverPhone}</span>
          </div>
        </div>

        {/* Vehicle Card */}
        <div className="bg-white border border-slate-200 rounded-xl p-5 shadow-xs space-y-3 text-xs">
          <div className="flex items-center gap-2 border-b border-slate-100 pb-2">
            <Truck className="w-4 h-4 text-amber-600" />
            <h3 className="font-bold text-slate-900 uppercase tracking-wider text-[11px]">Assigned Vehicle</h3>
          </div>
          <div>
            <span className="font-bold text-slate-900 font-mono text-sm block">{trip.vehicleNumber || 'Unassigned'}</span>
            <span className="text-xs text-slate-600 block mt-0.5">{trip.vehicleType}</span>
          </div>
        </div>
      </div>

      {/* ASSIGNED SHIPMENTS MASTER TABLE */}
      <div className="bg-white border border-slate-200 rounded-xl p-5 shadow-xs space-y-4">
        <div className="flex items-center justify-between border-b border-slate-100 pb-3">
          <div>
            <h3 className="text-sm font-bold text-slate-900">Assigned Consignment Notes (Shipments)</h3>
            <p className="text-xs text-slate-500">All shipments loaded for linehaul movement on {trip.tripNumber}</p>
          </div>

          <button
            onClick={() => setShowShipmentModal(true)}
            className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-bold text-white bg-setu-600 hover:bg-setu-700 rounded transition-colors"
          >
            <Plus className="w-3.5 h-3.5" />
            <span>Manage Shipments</span>
          </button>
        </div>

        {assignedShipments.length > 0 ? (
          <div className="overflow-x-auto text-xs">
            <table className="w-full text-left border-collapse">
              <thead className="bg-slate-50 text-slate-600 uppercase font-bold text-[10px] border-b border-slate-200">
                <tr>
                  <th className="p-3">CN Number</th>
                  <th className="p-3">Company</th>
                  <th className="p-3">Consignor → Consignee</th>
                  <th className="p-3 text-center">Packages</th>
                  <th className="p-3 text-right">Actual Weight</th>
                  <th className="p-3">Status</th>
                  <th className="p-3">POD</th>
                  <th className="p-3 text-right">Action</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 font-medium">
                {assignedShipments.map((s) => (
                  <tr key={s.id} className="hover:bg-slate-50">
                    <td className="p-3">
                      <span
                        onClick={() => navigate(`/admin/shipments/${s.id}`)}
                        className="font-bold font-mono text-setu-600 hover:underline cursor-pointer"
                      >
                        {s.cnNumber}
                      </span>
                    </td>
                    <td className="p-3 font-semibold text-slate-900">{s.companyName}</td>
                    <td className="p-3 text-slate-700">
                      <span>{s.consignor?.city}</span> → <span className="font-semibold">{s.consignee?.city}</span>
                    </td>
                    <td className="p-3 text-center font-mono">{s.packages} Boxes</td>
                    <td className="p-3 text-right font-mono font-bold text-slate-900">{s.actualWeight} Kg</td>
                    <td className="p-3"><StatusBadge status={s.status} /></td>
                    <td className="p-3"><StatusBadge status={s.podStatus} /></td>
                    <td className="p-3 text-right">
                      <button
                        onClick={() => handleRemoveShipment(s.id)}
                        className="p-1 text-slate-400 hover:text-rose-600 rounded transition-colors"
                        title="Remove Shipment from Trip"
                      >
                        <Trash2 className="w-4 h-4" />
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        ) : (
          <EmptyState
            icon={Package}
            title="No shipments assigned to this trip"
            description="Click 'Manage Shipments' to select Consignment Notes for this route."
          />
        )}
      </div>

      {/* FINANCIAL SUMMARY RESERVED UI */}
      <div className="bg-white border border-slate-200 rounded-xl p-5 shadow-xs space-y-3">
        <div className="flex items-center justify-between border-b border-slate-100 pb-2">
          <div className="flex items-center gap-2">
            <DollarSign className="w-4 h-4 text-emerald-600" />
            <h3 className="text-sm font-bold text-slate-900">Trip Financial Summary</h3>
          </div>
          <span className="px-2.5 py-0.5 text-[10px] font-bold bg-amber-50 text-amber-800 border border-amber-200 rounded">
            Available in Finance Module (Chunk 8 & 9)
          </span>
        </div>

        <div className="grid grid-cols-2 sm:grid-cols-5 gap-4 text-xs text-slate-500 pt-1">
          <div>
            <span className="block text-[11px] font-bold text-slate-400 uppercase">Trip Revenue</span>
            <span className="font-mono text-sm font-bold text-slate-400">TBD</span>
          </div>
          <div>
            <span className="block text-[11px] font-bold text-slate-400 uppercase">Linehaul Expenses</span>
            <span className="font-mono text-sm font-bold text-slate-400">TBD</span>
          </div>
          <div>
            <span className="block text-[11px] font-bold text-slate-400 uppercase">Transporter Payable</span>
            <span className="font-mono text-sm font-bold text-slate-400">TBD</span>
          </div>
          <div>
            <span className="block text-[11px] font-bold text-slate-400 uppercase">Other Payables</span>
            <span className="font-mono text-sm font-bold text-slate-400">TBD</span>
          </div>
          <div>
            <span className="block text-[11px] font-bold text-slate-400 uppercase">Net Margin</span>
            <span className="font-mono text-sm font-bold text-slate-400">TBD</span>
          </div>
        </div>
      </div>

      {/* UPDATE TRIP STATUS MODAL */}
      <Modal
        isOpen={showStatusModal}
        onClose={() => setShowStatusModal(false)}
        title={`Update Trip Status — ${trip.tripNumber}`}
        footer={
          <>
            <button
              onClick={() => setShowStatusModal(false)}
              className="px-3 py-1.5 text-xs font-semibold text-slate-700 bg-white border border-slate-300 rounded"
            >
              Cancel
            </button>
            <button
              onClick={handleStatusUpdateSubmit}
              className="px-4 py-1.5 text-xs font-bold text-white bg-setu-600 hover:bg-setu-700 rounded shadow-sm"
            >
              Save Trip Status Update
            </button>
          </>
        }
      >
        <form onSubmit={handleStatusUpdateSubmit} className="space-y-4 text-xs">
          <div>
            <label className="block font-bold text-slate-700 uppercase tracking-wider mb-1">
              New Operational Status <span className="text-rose-500">*</span>
            </label>
            <select
              value={newStatus}
              onChange={(e) => setNewStatus(e.target.value)}
              className="w-full p-2.5 bg-slate-50 border border-slate-300 rounded-md font-bold text-slate-900"
            >
              <option value="Planned">Planned</option>
              <option value="Ready for Dispatch">Ready for Dispatch</option>
              <option value="In Transit">In Transit</option>
              <option value="Reached Destination">Reached Destination</option>
              <option value="Completed">Completed</option>
              <option value="Cancelled">Cancelled</option>
            </select>
          </div>

          <div>
            <label className="block font-bold text-slate-700 uppercase tracking-wider mb-1">
              Current Location Tag
            </label>
            <input
              type="text"
              value={statusLocation}
              onChange={(e) => setStatusLocation(e.target.value)}
              placeholder="e.g. NH-48 Expressway Toll"
              className="w-full p-2.5 bg-slate-50 border border-slate-300 rounded-md font-medium"
            />
          </div>

          <div>
            <label className="block font-bold text-slate-700 uppercase tracking-wider mb-1">
              Status Update Remarks
            </label>
            <textarea
              rows={3}
              value={statusRemarks}
              onChange={(e) => setStatusRemarks(e.target.value)}
              placeholder="Dispatch notes..."
              className="w-full p-2.5 bg-slate-50 border border-slate-300 rounded-md font-medium"
            />
          </div>
        </form>
      </Modal>

      {/* SHIPMENT ASSIGNMENT MODAL */}
      <ShipmentAssignmentModal
        isOpen={showShipmentModal}
        onClose={() => setShowShipmentModal(false)}
        assignedShipmentIds={trip.shipmentIds || []}
        onAssign={handleSaveAssignedShipments}
      />
    </div>
  );
};
