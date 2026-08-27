import React, { useState, useEffect } from 'react';
import { vehicleService } from '../services/vehicleService';
import { transporterService } from '../services/transporterService';
import { PageHeader } from '../components/common/PageHeader';
import { DataTable } from '../components/common/DataTable';
import { StatusBadge } from '../components/common/StatusBadge';
import { SearchBar } from '../components/common/SearchBar';
import { LoadingState } from '../components/common/LoadingState';
import { ErrorState } from '../components/common/ErrorState';
import { ExpiryBadge } from '../components/trip/ExpiryBadge';
import { VehicleFormModal } from '../components/vehicle/VehicleFormModal';
import { Plus, Truck, ShieldCheck, Wrench } from 'lucide-react';

export const VehiclesPage = () => {
  const [vehicles, setVehicles] = useState([]);
  const [transporters, setTransporters] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState('All');
  const [showModal, setShowModal] = useState(false);

  const fetchData = async () => {
    setLoading(true);
    setError(null);
    try {
      const [vData, tData] = await Promise.all([
        vehicleService.getVehicles(search, statusFilter),
        transporterService.getTransporters()
      ]);
      setVehicles(vData);
      setTransporters(tData);
    } catch (err) {
      setError(err.message || 'Failed to load vehicle master records.');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchData();
  }, [search, statusFilter]);

  const columns = [
    {
      header: 'Vehicle Number',
      accessor: 'vehicleNumber',
      render: (row) => (
        <div>
          <span className="font-bold font-mono text-xs text-setu-600 block">{row.vehicleNumber}</span>
          <span className="text-[10px] text-slate-400 font-mono">{row.model || 'Commercial Vehicle'}</span>
        </div>
      )
    },
    {
      header: 'Vehicle Type / Capacity',
      accessor: 'vehicleType',
      render: (row) => <span className="font-semibold text-xs text-slate-800">{row.vehicleType}</span>
    },
    {
      header: 'Transporter / Owner',
      accessor: 'transporterName',
      render: (row) => <span className="text-xs font-medium text-slate-700">{row.transporterName}</span>
    },
    {
      header: 'Insurance Expiry',
      accessor: 'insuranceExpiry',
      render: (row) => <ExpiryBadge dateString={row.insuranceExpiry} />
    },
    {
      header: 'Permit Expiry',
      accessor: 'permitExpiry',
      render: (row) => <ExpiryBadge dateString={row.permitExpiry} />
    },
    {
      header: 'Fitness Expiry',
      accessor: 'fitnessExpiry',
      render: (row) => <ExpiryBadge dateString={row.fitnessExpiry} />
    },
    {
      header: 'Status',
      accessor: 'status',
      render: (row) => <StatusBadge status={row.status} />
    }
  ];

  return (
    <div className="space-y-6">
      <PageHeader
        title="Vehicles Registry & Document Validity"
        description="Manage commercial linehaul trucks, container fleets and track insurance, permit & fitness expiry."
        breadcrumbs={['Speed Setu Admin', 'Operations', 'Vehicles']}
        actions={
          <button
            onClick={() => setShowModal(true)}
            className="inline-flex items-center gap-2 px-4 py-2 text-xs font-bold text-white bg-setu-600 hover:bg-setu-700 rounded-md shadow-sm transition-colors"
          >
            <Plus className="w-4 h-4" />
            <span>Add Vehicle</span>
          </button>
        }
      />

      <div className="bg-white border border-slate-200 rounded-xl p-4 shadow-xs flex flex-col md:flex-row items-center justify-between gap-3">
        <div className="w-full md:w-96">
          <SearchBar
            value={search}
            onChange={setSearch}
            placeholder="Search vehicle number, type, transporter..."
          />
        </div>

        <div className="flex items-center gap-2">
          <select
            value={statusFilter}
            onChange={(e) => setStatusFilter(e.target.value)}
            className="px-3 py-2 text-xs bg-slate-50 border border-slate-200 rounded-md font-medium text-slate-700"
          >
            <option value="All">All Statuses</option>
            <option value="Available">Available</option>
            <option value="Assigned">Assigned</option>
            <option value="In Maintenance">In Maintenance</option>
            <option value="Inactive">Inactive</option>
          </select>
        </div>
      </div>

      {loading ? (
        <LoadingState message="Loading Fleet Vehicles..." />
      ) : error ? (
        <ErrorState message={error} onRetry={fetchData} />
      ) : (
        <DataTable
          columns={columns}
          data={vehicles}
          emptyMessage="No vehicles found"
          emptySubtext="Try adjusting your search criteria."
        />
      )}

      <VehicleFormModal
        isOpen={showModal}
        onClose={() => setShowModal(false)}
        transporters={transporters}
        onSuccess={fetchData}
      />
    </div>
  );
};
