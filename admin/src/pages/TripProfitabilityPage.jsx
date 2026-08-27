import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { reportingService } from '../services/reportingService';
import { formatINR, formatDate } from '../utils/formatters';
import { PageHeader } from '../components/common/PageHeader';
import { DataTable } from '../components/common/DataTable';
import { StatusBadge } from '../components/common/StatusBadge';
import { SearchBar } from '../components/common/SearchBar';
import { LoadingState } from '../components/common/LoadingState';
import { ErrorState } from '../components/common/ErrorState';
import { Truck, ArrowLeft, Eye } from 'lucide-react';

export const TripProfitabilityPage = () => {
  const navigate = useNavigate();
  const [trips, setTrips] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [search, setSearch] = useState('');

  const fetchTripProfitability = async () => {
    setLoading(true);
    setError(null);
    try {
      const data = await reportingService.getTripProfitability({ search });
      setTrips(data);
    } catch (err) {
      setError(err.message || 'Failed to load trip profitability report.');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchTripProfitability();
  }, [search]);

  const columns = [
    {
      header: 'Trip ID',
      accessor: 'tripId',
      render: (row) => (
        <span
          onClick={() => navigate(`/admin/trips/${row.tripId}`)}
          className="font-bold text-setu-600 font-mono hover:underline cursor-pointer"
        >
          {row.tripId}
        </span>
      )
    },
    {
      header: 'Trip Date',
      accessor: 'date',
      render: (row) => <span className="font-mono text-xs text-slate-700">{formatDate(row.date)}</span>
    },
    {
      header: 'Route & Volume',
      accessor: 'route',
      render: (row) => (
        <div>
          <span className="font-bold text-slate-900 text-xs block">{row.route}</span>
          <span className="text-[10px] text-slate-500 font-mono">{row.shipmentsCount} CNs Assigned</span>
        </div>
      )
    },
    {
      header: 'Total Trip Revenue',
      accessor: 'revenue',
      align: 'right',
      render: (row) => <span className="font-mono text-xs font-bold text-slate-900">{formatINR(row.revenue)}</span>
    },
    {
      header: 'Trip Expenses (Transporter + Toll)',
      accessor: 'tripExpenses',
      align: 'right',
      render: (row) => <span className="font-mono text-xs text-slate-700">{formatINR(row.tripExpenses)}</span>
    },
    {
      header: 'Net Trip Profit',
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
        <span className="font-mono text-xs font-bold px-2 py-0.5 rounded bg-emerald-50 text-emerald-800 border border-emerald-200">
          {row.margin}%
        </span>
      )
    },
    {
      header: 'Actions',
      key: 'actions',
      render: (row) => (
        <button
          onClick={() => navigate(`/admin/trips/${row.tripId}`)}
          className="p-1.5 text-slate-500 hover:text-setu-600 rounded transition-colors"
          title="View Trip Details"
        >
          <Eye className="w-4 h-4" />
        </button>
      )
    }
  ];

  return (
    <div className="space-y-6">
      <PageHeader
        title="Trip Profitability Analysis"
        description="Evaluate trip freight revenues derived from assigned shipments versus linehaul transporter expenses."
        breadcrumbs={['Speed Setu Admin', 'Reports & MIS', 'Trip Profitability']}
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

      <div className="bg-white border border-slate-200 rounded-xl p-4 shadow-xs">
        <SearchBar
          value={search}
          onChange={setSearch}
          placeholder="Search trip ID, origin, destination..."
        />
      </div>

      {loading ? (
        <LoadingState message="Loading Trip Profitability Metrics..." />
      ) : error ? (
        <ErrorState message={error} onRetry={fetchTripProfitability} />
      ) : (
        <DataTable
          columns={columns}
          data={trips}
          onRowClick={(row) => navigate(`/admin/trips/${row.tripId}`)}
          emptyMessage="No trip profitability records found"
        />
      )}
    </div>
  );
};
