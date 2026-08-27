import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { reportingService } from '../services/reportingService';
import { formatINR } from '../utils/formatters';
import { PageHeader } from '../components/common/PageHeader';
import { DataTable } from '../components/common/DataTable';
import { SearchBar } from '../components/common/SearchBar';
import { LoadingState } from '../components/common/LoadingState';
import { ErrorState } from '../components/common/ErrorState';
import { Building2, ArrowLeft, Eye } from 'lucide-react';

export const CustomerProfitabilityPage = () => {
  const navigate = useNavigate();
  const [customers, setCustomers] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [search, setSearch] = useState('');

  const fetchCustomerProfitability = async () => {
    setLoading(true);
    setError(null);
    try {
      const data = await reportingService.getCustomerProfitability({ search });
      setCustomers(data);
    } catch (err) {
      setError(err.message || 'Failed to load customer profitability report.');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchCustomerProfitability();
  }, [search]);

  const columns = [
    {
      header: 'Company Name',
      accessor: 'companyName',
      render: (row) => (
        <span
          onClick={() => navigate(`/admin/companies/${row.companyId}`)}
          className="font-bold text-slate-900 text-xs hover:underline cursor-pointer"
        >
          {row.companyName}
        </span>
      )
    },
    {
      header: 'Total Shipments',
      accessor: 'shipmentsCount',
      align: 'center',
      render: (row) => <span className="font-mono text-xs font-bold text-slate-700">{row.shipmentsCount} CNs</span>
    },
    {
      header: 'Total Billed Revenue',
      accessor: 'revenue',
      align: 'right',
      render: (row) => <span className="font-mono text-xs font-bold text-slate-900">{formatINR(row.revenue)}</span>
    },
    {
      header: 'Total Cost Burden',
      accessor: 'totalCost',
      align: 'right',
      render: (row) => <span className="font-mono text-xs text-slate-700">{formatINR(row.totalCost)}</span>
    },
    {
      header: 'Net Profit',
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
      header: 'Outstanding Balance',
      accessor: 'outstanding',
      align: 'right',
      render: (row) => (
        <span className={`font-mono text-xs font-bold ${row.outstanding > 0 ? 'text-setu-700' : 'text-slate-400'}`}>
          {formatINR(row.outstanding)}
        </span>
      )
    },
    {
      header: 'Avg Rev / CN',
      accessor: 'avgRevenuePerShipment',
      align: 'right',
      render: (row) => <span className="font-mono text-xs text-slate-600">{formatINR(row.avgRevenuePerShipment)}</span>
    },
    {
      header: 'Actions',
      key: 'actions',
      render: (row) => (
        <button
          onClick={() => navigate(`/admin/companies/${row.companyId}`)}
          className="p-1.5 text-slate-500 hover:text-setu-600 rounded transition-colors"
          title="View Company Profile"
        >
          <Eye className="w-4 h-4" />
        </button>
      )
    }
  ];

  return (
    <div className="space-y-6">
      <PageHeader
        title="Customer Profitability Matrix"
        description="Analyze revenue contribution, operational cost burdens, net profits, and outstanding receivables per corporate customer."
        breadcrumbs={['Speed Setu Admin', 'Reports & MIS', 'Customer Profitability']}
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
          placeholder="Search company name..."
        />
      </div>

      {loading ? (
        <LoadingState message="Loading Customer Profitability Matrix..." />
      ) : error ? (
        <ErrorState message={error} onRetry={fetchCustomerProfitability} />
      ) : (
        <DataTable
          columns={columns}
          data={customers}
          onRowClick={(row) => navigate(`/admin/companies/${row.companyId}`)}
          emptyMessage="No customer profitability records found"
        />
      )}
    </div>
  );
};
