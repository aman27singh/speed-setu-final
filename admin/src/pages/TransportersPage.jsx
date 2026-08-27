import React, { useState, useEffect } from 'react';
import { transporterService } from '../services/transporterService';
import { PageHeader } from '../components/common/PageHeader';
import { DataTable } from '../components/common/DataTable';
import { StatusBadge } from '../components/common/StatusBadge';
import { SearchBar } from '../components/common/SearchBar';
import { LoadingState } from '../components/common/LoadingState';
import { ErrorState } from '../components/common/ErrorState';
import { TransporterFormModal } from '../components/transporter/TransporterFormModal';
import { Plus, Building2, Phone, Mail, MapPin, Edit, ShieldAlert } from 'lucide-react';

export const TransportersPage = () => {
  const [transporters, setTransporters] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState('All');
  const [showModal, setShowModal] = useState(false);

  const fetchTransporters = async () => {
    setLoading(true);
    setError(null);
    try {
      const data = await transporterService.getTransporters(search, statusFilter);
      setTransporters(data);
    } catch (err) {
      setError(err.message || 'Failed to load transporters.');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchTransporters();
  }, [search, statusFilter]);

  const columns = [
    {
      header: 'Transporter Code',
      accessor: 'transporterCode',
      render: (row) => <span className="font-bold font-mono text-setu-600">{row.transporterCode}</span>
    },
    {
      header: 'Transporter Name',
      accessor: 'name',
      render: (row) => (
        <div>
          <span className="font-bold text-slate-900 block text-xs">{row.name}</span>
          <span className="text-[10px] text-slate-400 font-mono">GST: {row.gstin || 'N/A'}</span>
        </div>
      )
    },
    {
      header: 'Primary Contact',
      accessor: 'contactPerson',
      render: (row) => (
        <div className="text-xs">
          <span className="font-semibold text-slate-800 block">{row.contactPerson}</span>
          <span className="text-[10px] font-mono text-slate-500">{row.phone}</span>
        </div>
      )
    },
    {
      header: 'Location / State',
      accessor: 'city',
      render: (row) => (
        <span className="text-xs text-slate-700 font-medium">
          {row.city}, {row.state}
        </span>
      )
    },
    {
      header: 'Payment Terms',
      accessor: 'paymentTerms',
      render: (row) => (
        <span className="px-2 py-0.5 rounded text-[10px] font-bold bg-blue-50 text-setu-700 border border-blue-100">
          {row.paymentTerms}
        </span>
      )
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
        title="Transporters Registry"
        description="Manage logistics vendor fleet partners, contact channels and payment terms."
        breadcrumbs={['Speed Setu Admin', 'Operations', 'Transporters']}
        actions={
          <button
            onClick={() => setShowModal(true)}
            className="inline-flex items-center gap-2 px-4 py-2 text-xs font-bold text-white bg-setu-600 hover:bg-setu-700 rounded-md shadow-sm transition-colors"
          >
            <Plus className="w-4 h-4" />
            <span>Add Transporter</span>
          </button>
        }
      />

      <div className="bg-white border border-slate-200 rounded-xl p-4 shadow-xs flex flex-col md:flex-row items-center justify-between gap-3">
        <div className="w-full md:w-96">
          <SearchBar
            value={search}
            onChange={setSearch}
            placeholder="Search vendor code, transporter name, GSTIN, phone..."
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
        <LoadingState message="Loading Transporter Vendors..." />
      ) : error ? (
        <ErrorState message={error} onRetry={fetchTransporters} />
      ) : (
        <DataTable
          columns={columns}
          data={transporters}
          emptyMessage="No transporters found"
          emptySubtext="Try adjusting your search criteria."
        />
      )}

      <TransporterFormModal
        isOpen={showModal}
        onClose={() => setShowModal(false)}
        onSuccess={fetchTransporters}
      />
    </div>
  );
};
