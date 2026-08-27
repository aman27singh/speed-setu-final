import React, { useState, useEffect } from 'react';
import { driverService } from '../services/driverService';
import { PageHeader } from '../components/common/PageHeader';
import { DataTable } from '../components/common/DataTable';
import { StatusBadge } from '../components/common/StatusBadge';
import { SearchBar } from '../components/common/SearchBar';
import { LoadingState } from '../components/common/LoadingState';
import { ErrorState } from '../components/common/ErrorState';
import { ExpiryBadge } from '../components/trip/ExpiryBadge';
import { DriverFormModal } from '../components/driver/DriverFormModal';
import { Plus, UserCheck, Phone, ShieldAlert, CreditCard } from 'lucide-react';

export const DriversPage = () => {
  const [drivers, setDrivers] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState('All');
  const [showModal, setShowModal] = useState(false);

  const fetchDrivers = async () => {
    setLoading(true);
    setError(null);
    try {
      const data = await driverService.getDrivers(search, statusFilter);
      setDrivers(data);
    } catch (err) {
      setError(err.message || 'Failed to load driver records.');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchDrivers();
  }, [search, statusFilter]);

  const columns = [
    {
      header: 'Driver Name',
      accessor: 'name',
      render: (row) => (
        <div>
          <span className="font-bold text-slate-900 block text-xs">{row.name}</span>
          <span className="text-[10px] text-slate-400 font-mono">{row.remarks || 'Linehaul Driver'}</span>
        </div>
      )
    },
    {
      header: 'Contact Phone',
      accessor: 'phone',
      render: (row) => <span className="font-mono text-xs text-slate-800 font-semibold">{row.phone}</span>
    },
    {
      header: 'License Number',
      accessor: 'licenseNumber',
      render: (row) => <span className="font-mono text-xs font-bold text-setu-600">{row.licenseNumber}</span>
    },
    {
      header: 'License Expiry & Compliance',
      accessor: 'licenseExpiry',
      render: (row) => <ExpiryBadge dateString={row.licenseExpiry} />
    },
    {
      header: 'Emergency Contact',
      accessor: 'emergencyContact',
      render: (row) => <span className="text-xs text-slate-600">{row.emergencyContact || 'N/A'}</span>
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
        title="Drivers Registry & KYC Compliance"
        description="Manage linehaul truck drivers, license validity monitoring and emergency contact records."
        breadcrumbs={['Speed Setu Admin', 'Operations', 'Drivers']}
        actions={
          <button
            onClick={() => setShowModal(true)}
            className="inline-flex items-center gap-2 px-4 py-2 text-xs font-bold text-white bg-setu-600 hover:bg-setu-700 rounded-md shadow-sm transition-colors"
          >
            <Plus className="w-4 h-4" />
            <span>Add Driver</span>
          </button>
        }
      />

      <div className="bg-white border border-slate-200 rounded-xl p-4 shadow-xs flex flex-col md:flex-row items-center justify-between gap-3">
        <div className="w-full md:w-96">
          <SearchBar
            value={search}
            onChange={setSearch}
            placeholder="Search driver name, phone, license number..."
          />
        </div>

        <div className="flex items-center gap-2">
          <select
            value={statusFilter}
            onChange={(e) => setStatusFilter(e.target.value)}
            className="px-3 py-2 text-xs bg-slate-50 border border-slate-200 rounded-md font-medium text-slate-700"
          >
            <option value="All">All Statuses</option>
            <option value="Active">Active</option>
            <option value="Inactive">Inactive</option>
          </select>
        </div>
      </div>

      {loading ? (
        <LoadingState message="Loading Drivers Master..." />
      ) : error ? (
        <ErrorState message={error} onRetry={fetchDrivers} />
      ) : (
        <DataTable
          columns={columns}
          data={drivers}
          emptyMessage="No drivers found"
          emptySubtext="Try adjusting your search criteria."
        />
      )}

      <DriverFormModal
        isOpen={showModal}
        onClose={() => setShowModal(false)}
        onSuccess={fetchDrivers}
      />
    </div>
  );
};
