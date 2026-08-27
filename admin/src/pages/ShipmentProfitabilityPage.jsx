import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { reportingService } from '../services/reportingService';
import { formatINR, formatDate } from '../utils/formatters';
import { PageHeader } from '../components/common/PageHeader';
import { DataTable } from '../components/common/DataTable';
import { StatusBadge } from '../components/common/StatusBadge';
import { SearchBar } from '../components/common/SearchBar';
import { FilterBar } from '../components/common/FilterBar';
import { LoadingState } from '../components/common/LoadingState';
import { ErrorState } from '../components/common/ErrorState';
import { CostBreakdownModal } from '../components/reports/CostBreakdownModal';
import { Plus, Eye, ArrowLeft, AlertTriangle, PieChart } from 'lucide-react';

export const ShipmentProfitabilityPage = () => {
  const navigate = useNavigate();
  const [shipments, setShipments] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState('All');

  // Breakdown modal
  const [selectedShipment, setSelectedShipment] = useState(null);
  const [showModal, setShowModal] = useState(false);

  const fetchShipmentProfitability = async () => {
    setLoading(true);
    setError(null);
    try {
      const data = await reportingService.getShipmentProfitability({ search, statusFilter });
      setShipments(data);
    } catch (err) {
      setError(err.message || 'Failed to load shipment profitability report.');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchShipmentProfitability();
  }, [search, statusFilter]);

  const statusOptions = [
    { label: 'All Shipments', value: 'All' },
    { label: 'Profitable', value: 'Profitable' },
    { label: 'Loss-Making', value: 'Loss' }
  ];

  const columns = [
    {
      header: 'CN Number',
      accessor: 'cnNumber',
      render: (row) => (
        <span
          onClick={() => navigate(`/admin/shipments/${row.cnNumber}`)}
          className="font-bold text-setu-600 font-mono hover:underline cursor-pointer"
        >
          {row.cnNumber}
        </span>
      )
    },
    {
      header: 'Company Name',
      accessor: 'companyName',
      render: (row) => <span className="font-bold text-slate-900 text-xs">{row.companyName}</span>
    },
    {
      header: 'Date & Route',
      accessor: 'date',
      render: (row) => (
        <div>
          <span className="font-mono text-xs font-bold text-slate-800 block">{row.origin} → {row.destination}</span>
          <span className="text-[10px] text-slate-400 font-mono">{formatDate(row.date)}</span>
        </div>
      )
    },
    {
      header: 'Billed Revenue',
      accessor: 'revenue',
      align: 'right',
      render: (row) => <span className="font-mono text-xs font-bold text-slate-900">{formatINR(row.revenue)}</span>
    },
    {
      header: 'Direct Cost',
      accessor: 'directCost',
      align: 'right',
      render: (row) => <span className="font-mono text-xs text-slate-600">{formatINR(row.directCost)}</span>
    },
    {
      header: 'Allocated Trip Cost',
      accessor: 'allocatedTripCost',
      align: 'right',
      render: (row) => <span className="font-mono text-xs text-slate-600">{formatINR(row.allocatedTripCost)}</span>
    },
    {
      header: 'Total Cost Burden',
      accessor: 'totalCost',
      align: 'right',
      render: (row) => <span className="font-mono text-xs font-semibold text-slate-900">{formatINR(row.totalCost)}</span>
    },
    {
      header: 'Gross Profit',
      accessor: 'profit',
      align: 'right',
      render: (row) => (
        <span className={`font-mono text-xs font-black ${row.profit < 0 ? 'text-rose-700' : 'text-emerald-700'}`}>
          {formatINR(row.profit)}
        </span>
      )
    },
    {
      header: 'Margin %',
      accessor: 'margin',
      align: 'center',
      render: (row) => (
        <span className={`font-mono text-xs font-bold px-2 py-0.5 rounded ${
          row.margin < 0 ? 'bg-rose-50 text-rose-700 border border-rose-200' : 'bg-emerald-50 text-emerald-800 border border-emerald-200'
        }`}>
          {row.margin}%
        </span>
      )
    },
    {
      header: 'Actions',
      key: 'actions',
      render: (row) => (
        <button
          onClick={(e) => {
            e.stopPropagation();
            setSelectedShipment(row);
            setShowModal(true);
          }}
          className="p-1.5 text-slate-500 hover:text-setu-600 rounded transition-colors"
          title="View Cost Breakdown"
        >
          <PieChart className="w-4 h-4" />
        </button>
      )
    }
  ];

  return (
    <div className="space-y-6">
      <PageHeader
        title="Shipment Profitability Analysis"
        description="Track CN revenue against direct pickup/delivery expenses and allocated linehaul trip cost burdens."
        breadcrumbs={['Speed Setu Admin', 'Reports & MIS', 'Shipment Profitability']}
        actions={
          <button
            onClick={() => navigate('/admin/reports')}
            className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold text-slate-700 bg-white border border-slate-300 rounded-md hover:bg-slate-50 transition-colors"
          >
            <ArrowLeft className="w-4 h-4" />
            <span>Back to MIS Overview</span>
          </button>
        }
      />

      {statusFilter === 'Loss' && (
        <div className="p-3 bg-rose-50 border border-rose-300 rounded-lg text-rose-900 text-xs font-bold flex items-center gap-2">
          <AlertTriangle className="w-4 h-4 text-rose-600 shrink-0" />
          <span>⚠ Displaying loss-making shipments where operational costs exceed billed customer revenue.</span>
        </div>
      )}

      <div className="bg-white border border-slate-200 rounded-xl p-4 shadow-xs space-y-3">
        <SearchBar
          value={search}
          onChange={setSearch}
          placeholder="Search CN number, company name, origin, destination..."
        />

        <div className="pt-2 border-t border-slate-100 flex items-center justify-between text-xs">
          <FilterBar
            options={statusOptions}
            activeFilter={statusFilter}
            onSelectFilter={setStatusFilter}
          />
          <span className="text-slate-500 font-medium">
            Showing <strong>{shipments.length}</strong> Shipment Records
          </span>
        </div>
      </div>

      {loading ? (
        <LoadingState message="Loading Shipment Profitability Analytics..." />
      ) : error ? (
        <ErrorState message={error} onRetry={fetchShipmentProfitability} />
      ) : (
        <DataTable
          columns={columns}
          data={shipments}
          onRowClick={(row) => {
            setSelectedShipment(row);
            setShowModal(true);
          }}
          emptyMessage="No shipment profitability records found"
          emptySubtext="Try adjusting your search criteria or status filter."
        />
      )}

      <CostBreakdownModal
        isOpen={showModal}
        onClose={() => setShowModal(false)}
        shipmentProfitability={selectedShipment}
      />
    </div>
  );
};
