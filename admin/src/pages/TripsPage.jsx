import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { tripService } from '../services/tripService';
import { transporterService } from '../services/transporterService';
import { formatDate } from '../utils/formatters';
import { PageHeader } from '../components/common/PageHeader';
import { DataTable } from '../components/common/DataTable';
import { StatusBadge } from '../components/common/StatusBadge';
import { SearchBar } from '../components/common/SearchBar';
import { FilterBar } from '../components/common/FilterBar';
import { LoadingState } from '../components/common/LoadingState';
import { ErrorState } from '../components/common/ErrorState';
import { Plus, Eye, Edit, Truck, MapPin, Package } from 'lucide-react';

export const TripsPage = () => {
  const navigate = useNavigate();
  const [trips, setTrips] = useState([]);
  const [transporters, setTransporters] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState('All');
  const [modeFilter, setModeFilter] = useState('All');
  const [transporterFilter, setTransporterFilter] = useState('All');

  const fetchTripsData = async () => {
    setLoading(true);
    setError(null);
    try {
      const [tData, vData] = await Promise.all([
        tripService.getTrips({
          search,
          status: statusFilter,
          mode: modeFilter,
          transporterId: transporterFilter
        }),
        transporterService.getTransporters()
      ]);
      setTrips(tData);
      setTransporters(vData);
    } catch (err) {
      setError(err.message || 'Failed to load trip records.');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchTripsData();
  }, [search, statusFilter, modeFilter, transporterFilter]);

  const statusOptions = [
    { label: 'All Trips', value: 'All' },
    { label: 'Planned', value: 'Planned' },
    { label: 'Ready for Dispatch', value: 'Ready for Dispatch' },
    { label: 'In Transit', value: 'In Transit' },
    { label: 'Reached Destination', value: 'Reached Destination' },
    { label: 'Completed', value: 'Completed' },
    { label: 'Cancelled', value: 'Cancelled' }
  ];

  const columns = [
    {
      header: 'Trip ID',
      accessor: 'tripNumber',
      render: (row) => (
        <span
          onClick={() => navigate(`/admin/trips/${row.id}`)}
          className="font-bold text-setu-600 font-mono hover:underline cursor-pointer"
        >
          {row.tripNumber}
        </span>
      )
    },
    {
      header: 'Trip Date',
      accessor: 'tripDate',
      render: (row) => <span className="font-mono text-slate-700 text-xs">{formatDate(row.tripDate)}</span>
    },
    {
      header: 'Route (Origin → Dest)',
      accessor: 'origin',
      render: (row) => (
        <div className="text-xs">
          <span className="font-semibold text-slate-900 block">{row.origin}</span>
          <span className="text-slate-400 block text-[10px]">→ {row.destination}</span>
        </div>
      )
    },
    {
      header: 'Mode',
      accessor: 'mode',
      render: (row) => (
        <span className="px-2 py-0.5 rounded text-[11px] font-semibold bg-slate-100 text-slate-700">
          {row.mode}
        </span>
      )
    },
    {
      header: 'Transporter',
      accessor: 'transporterName',
      render: (row) => <span className="text-xs font-semibold text-slate-800">{row.transporterName}</span>
    },
    {
      header: 'Vehicle',
      accessor: 'vehicleNumber',
      render: (row) => <span className="font-mono text-xs font-bold text-slate-800">{row.vehicleNumber || 'Pending'}</span>
    },
    {
      header: 'Driver',
      accessor: 'driverName',
      render: (row) => <span className="text-xs font-medium text-slate-700">{row.driverName || 'Unassigned'}</span>
    },
    {
      header: 'Shipments',
      accessor: 'shipmentIds',
      align: 'center',
      render: (row) => (
        <span className="px-2.5 py-1 rounded-full text-xs font-bold bg-setu-50 text-setu-700 border border-setu-100">
          {(row.shipmentIds || []).length} CNs
        </span>
      )
    },
    {
      header: 'Status',
      accessor: 'status',
      render: (row) => <StatusBadge status={row.status} />
    },
    {
      header: 'Actions',
      key: 'actions',
      render: (row) => (
        <div className="flex items-center gap-1" onClick={(e) => e.stopPropagation()}>
          <button
            onClick={() => navigate(`/admin/trips/${row.id}`)}
            className="p-1.5 text-slate-500 hover:text-setu-600 hover:bg-slate-100 rounded transition-colors"
            title="View Trip Details"
          >
            <Eye className="w-4 h-4" />
          </button>
          <button
            onClick={() => navigate(`/admin/trips/${row.id}/edit`)}
            className="p-1.5 text-slate-500 hover:text-blue-600 hover:bg-slate-100 rounded transition-colors"
            title="Edit Trip"
          >
            <Edit className="w-4 h-4" />
          </button>
        </div>
      )
    }
  ];

  return (
    <div className="space-y-6">
      <PageHeader
        title="Trips & Dispatch Movements"
        description="Manage linehaul transport movements, driver assignments, and assigned consignment notes."
        breadcrumbs={['Speed Setu Admin', 'Operations', 'Trips']}
        actions={
          <button
            onClick={() => navigate('/admin/trips/new')}
            className="w-full sm:w-auto inline-flex items-center justify-center gap-2 px-4 py-2 text-xs font-bold text-white bg-setu-600 hover:bg-setu-700 rounded-md shadow-sm transition-colors"
          >
            <Plus className="w-4 h-4" />
            <span>Create Trip</span>
          </button>
        }
      />

      <div className="bg-white border border-slate-200 rounded-xl p-3.5 sm:p-4 shadow-xs space-y-3">
        <div className="flex flex-col md:flex-row items-center gap-3">
          <div className="w-full md:flex-1">
            <SearchBar
              value={search}
              onChange={setSearch}
              placeholder="Search Trip ID, route, transporter, vehicle, driver..."
            />
          </div>

          <div className="grid grid-cols-2 sm:grid-cols-3 md:flex md:items-center gap-2 w-full md:w-auto">
            <select
              value={transporterFilter}
              onChange={(e) => setTransporterFilter(e.target.value)}
              className="px-2.5 sm:px-3 py-2 text-xs bg-slate-50 border border-slate-200 rounded-md text-slate-700 font-medium focus:outline-none focus:ring-2 focus:ring-setu-600/20 w-full md:w-auto truncate"
            >
              <option value="All">All Transporters</option>
              {transporters.map((t) => (
                <option key={t.id} value={t.id}>{t.name}</option>
              ))}
            </select>

            <button
              onClick={() => {
                setSearch('');
                setStatusFilter('All');
                setModeFilter('All');
                setTransporterFilter('All');
              }}
              className="col-span-2 sm:col-span-1 px-3 py-2 text-xs font-semibold text-slate-600 hover:text-slate-900 bg-slate-100 rounded-md transition-colors text-center shrink-0"
            >
              Reset
            </button>
          </div>
        </div>

        <div className="pt-2.5 border-t border-slate-100 flex flex-col sm:flex-row sm:items-center justify-between gap-2 text-xs">
          <div className="overflow-x-auto max-w-full pb-1">
            <FilterBar
              options={statusOptions}
              activeFilter={statusFilter}
              onSelectFilter={setStatusFilter}
            />
          </div>
          <span className="text-slate-500 font-medium shrink-0 text-[11px] sm:text-xs">
            Showing <strong>{trips.length}</strong> Dispatch Trips
          </span>
        </div>
      </div>

      {loading ? (
        <LoadingState message="Loading Linehaul Trips..." />
      ) : error ? (
        <ErrorState message={error} onRetry={fetchTripsData} />
      ) : (
        <DataTable
          columns={columns}
          data={trips}
          onRowClick={(row) => navigate(`/admin/trips/${row.id}`)}
          emptyMessage="No trips found"
          emptySubtext="Try adjusting your search query or status filters."
        />
      )}
    </div>
  );
};
