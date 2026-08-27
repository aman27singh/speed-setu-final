import React, { useState, useEffect } from 'react';
import { Modal } from '../common/Modal';
import { shipmentService } from '../../services/shipmentService';
import { SearchBar } from '../common/SearchBar';
import { Check, AlertCircle, Package } from 'lucide-react';

export const ShipmentAssignmentModal = ({ isOpen, onClose, assignedShipmentIds = [], onAssign }) => {
  const [shipments, setShipments] = useState([]);
  const [search, setSearch] = useState('');
  const [selectedIds, setSelectedIds] = useState(assignedShipmentIds);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (isOpen) {
      setSelectedIds(assignedShipmentIds);
      loadEligibleShipments();
    }
  }, [isOpen, assignedShipmentIds]);

  const loadEligibleShipments = async () => {
    setLoading(true);
    try {
      const allShipments = await shipmentService.getShipments();
      setShipments(allShipments);
    } catch (err) {
      console.error('Failed to load shipments:', err);
    } finally {
      setLoading(false);
    }
  };

  const filteredShipments = shipments.filter((s) => {
    if (!search.trim()) return true;
    const q = search.toLowerCase().trim();
    return (
      s.cnNumber.toLowerCase().includes(q) ||
      s.companyName.toLowerCase().includes(q) ||
      s.origin.toLowerCase().includes(q) ||
      s.destination.toLowerCase().includes(q)
    );
  });

  const toggleSelect = (sId, isAlreadyAssignedElsewhere) => {
    if (isAlreadyAssignedElsewhere) {
      alert('This shipment is already assigned to another active trip and cannot be re-assigned.');
      return;
    }
    setSelectedIds((prev) =>
      prev.includes(sId) ? prev.filter((id) => id !== sId) : [...prev, sId]
    );
  };

  const handleSave = () => {
    onAssign(selectedIds);
    onClose();
  };

  return (
    <Modal
      isOpen={isOpen}
      onClose={onClose}
      title="Assign Consignment Notes (Shipments) to Trip"
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
            onClick={handleSave}
            className="px-4 py-1.5 text-xs font-bold text-white bg-setu-600 hover:bg-setu-700 rounded shadow-sm"
          >
            Save Selected Shipments ({selectedIds.length})
          </button>
        </>
      }
    >
      <div className="space-y-4 text-xs">
        <SearchBar
          value={search}
          onChange={setSearch}
          placeholder="Search CN number, company name, origin, destination..."
        />

        {loading ? (
          <div className="p-8 text-center text-slate-400">Loading shipments...</div>
        ) : (
          <div className="max-h-80 overflow-y-auto border border-slate-200 rounded-lg divide-y divide-slate-100">
            {filteredShipments.map((s) => {
              const isSelected = selectedIds.includes(s.id);
              const isAssignedElsewhere = s.operational?.tripId && !assignedShipmentIds.includes(s.id);
              const isDelivered = s.status === 'Delivered';

              return (
                <div
                  key={s.id}
                  onClick={() => toggleSelect(s.id, isAssignedElsewhere || isDelivered)}
                  className={`p-3 flex items-center justify-between transition-colors cursor-pointer ${
                    isSelected
                      ? 'bg-blue-50/60'
                      : isAssignedElsewhere || isDelivered
                      ? 'bg-slate-50 opacity-60 cursor-not-allowed'
                      : 'hover:bg-slate-50'
                  }`}
                >
                  <div className="flex items-center gap-3">
                    <input
                      type="checkbox"
                      checked={isSelected}
                      disabled={isAssignedElsewhere || isDelivered}
                      onChange={() => {}}
                      className="rounded border-slate-300 text-setu-600 focus:ring-setu-600"
                    />

                    <div>
                      <div className="flex items-center gap-2">
                        <span className="font-bold font-mono text-setu-600">{s.cnNumber}</span>
                        <span className="font-semibold text-slate-900">{s.companyName}</span>
                      </div>
                      <span className="text-[11px] text-slate-500 block">
                        {s.origin} → {s.destination} • {s.packages} Boxes • {s.actualWeight} Kg
                      </span>
                    </div>
                  </div>

                  {isAssignedElsewhere ? (
                    <span className="inline-flex items-center gap-1 text-[10px] font-bold text-amber-700 bg-amber-50 px-2 py-0.5 rounded border border-amber-200">
                      <AlertCircle className="w-3 h-3" /> Assigned to {s.operational.tripId}
                    </span>
                  ) : isDelivered ? (
                    <span className="text-[10px] font-bold text-slate-400 bg-slate-100 px-2 py-0.5 rounded">
                      Completed
                    </span>
                  ) : (
                    <span className="text-[11px] font-semibold text-slate-600">{s.status}</span>
                  )}
                </div>
              );
            })}
          </div>
        )}
      </div>
    </Modal>
  );
};
