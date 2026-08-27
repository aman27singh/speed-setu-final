import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { reportingService } from '../services/reportingService';
import { formatINR } from '../utils/formatters';
import { PageHeader } from '../components/common/PageHeader';
import { DataTable } from '../components/common/DataTable';
import { SearchBar } from '../components/common/SearchBar';
import { LoadingState } from '../components/common/LoadingState';
import { ErrorState } from '../components/common/ErrorState';
import { MapPin, ArrowLeft } from 'lucide-react';

export const RouteAnalysisPage = () => {
  const navigate = useNavigate();
  const [routes, setRoutes] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  const [search, setSearch] = useState('');
  const [modeFilter, setModeFilter] = useState('All');

  const fetchRouteAnalysis = async () => {
    setLoading(true);
    setError(null);
    try {
      const data = await reportingService.getRouteAnalysis({ search, mode: modeFilter });
      setRoutes(data);
    } catch (err) {
      setError(err.message || 'Failed to load route analysis report.');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchRouteAnalysis();
  }, [search, modeFilter]);

  const columns = [
    {
      header: 'Lane / Route',
      accessor: 'route',
      render: (row) => <span className="font-bold text-slate-900 text-xs font-mono">{row.route}</span>
    },
    {
      header: 'Freight Mode',
      accessor: 'mode',
      render: (row) => (
        <span className="px-2 py-0.5 rounded text-[10px] font-bold bg-slate-100 text-slate-800 border border-slate-200">
          {row.mode}
        </span>
      )
    },
    {
      header: 'Shipments',
      accessor: 'shipmentsCount',
      align: 'center',
      render: (row) => <span className="font-mono text-xs font-bold text-slate-700">{row.shipmentsCount} CNs</span>
    },
    {
      header: 'Volume Weight',
      accessor: 'chargeableWeight',
      align: 'right',
      render: (row) => <span className="font-mono text-xs text-slate-700">{row.chargeableWeight} Kg</span>
    },
    {
      header: 'Revenue',
      accessor: 'revenue',
      align: 'right',
      render: (row) => <span className="font-mono text-xs font-bold text-slate-900">{formatINR(row.revenue)}</span>
    },
    {
      header: 'Cost',
      accessor: 'totalCost',
      align: 'right',
      render: (row) => <span className="font-mono text-xs text-slate-700">{formatINR(row.totalCost)}</span>
    },
    {
      header: 'Profit',
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
      header: 'Rev / Kg',
      accessor: 'revenuePerKg',
      align: 'right',
      render: (row) => <span className="font-mono text-xs text-slate-800 font-semibold">₹{row.revenuePerKg}</span>
    },
    {
      header: 'Cost / Kg',
      accessor: 'costPerKg',
      align: 'right',
      render: (row) => <span className="font-mono text-xs text-slate-600">₹{row.costPerKg}</span>
    },
    {
      header: 'Profit / Kg',
      accessor: 'profitPerKg',
      align: 'right',
      render: (row) => <span className="font-mono text-xs font-bold text-emerald-700">₹{row.profitPerKg}</span>
    }
  ];

  return (
    <div className="space-y-6">
      <PageHeader
        title="Route & Freight Mode Profitability Analysis"
        description="Evaluate revenue per kilogram vs cost per kilogram across active transport lanes."
        breadcrumbs={['Speed Setu Admin', 'Reports & MIS', 'Route Analysis']}
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

      <div className="bg-white border border-slate-200 rounded-xl p-4 shadow-xs flex flex-col md:flex-row items-center justify-between gap-3">
        <div className="w-full md:w-96">
          <SearchBar
            value={search}
            onChange={setSearch}
            placeholder="Search origin, destination, route..."
          />
        </div>

        <div className="flex items-center gap-2">
          <select
            value={modeFilter}
            onChange={(e) => setModeFilter(e.target.value)}
            className="px-3 py-2 text-xs bg-slate-50 border border-slate-200 rounded-md font-medium text-slate-700"
          >
            <option value="All">All Modes</option>
            <option value="Road">Road / FTL</option>
            <option value="Air">Air Cargo</option>
            <option value="Train">Express Rail</option>
          </select>
        </div>
      </div>

      {loading ? (
        <LoadingState message="Loading Route & Mode Profitability Metrics..." />
      ) : error ? (
        <ErrorState message={error} onRetry={fetchRouteAnalysis} />
      ) : (
        <DataTable
          columns={columns}
          data={routes}
          emptyMessage="No route profitability records found"
        />
      )}
    </div>
  );
};
