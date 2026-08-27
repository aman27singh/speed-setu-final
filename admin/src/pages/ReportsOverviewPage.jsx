import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { reportingService } from '../services/reportingService';
import { formatINR } from '../utils/formatters';
import { PageHeader } from '../components/common/PageHeader';
import { KPICard } from '../components/common/KPICard';
import { LoadingState } from '../components/common/LoadingState';
import { ErrorState } from '../components/common/ErrorState';
import { ManagementAlertsCard } from '../components/reports/ManagementAlertsCard';
import { TopPerformersWidget } from '../components/reports/TopPerformersWidget';
import {
  DollarSign,
  CheckCircle2,
  TrendingUp,
  CreditCard,
  PieChart,
  Calendar,
  FileText,
  Truck,
  MapPin,
  Users
} from 'lucide-react';

export const ReportsOverviewPage = () => {
  const navigate = useNavigate();
  const [dateRange, setDateRange] = useState('This Month');

  const [metrics, setMetrics] = useState({});
  const [customers, setCustomers] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  const fetchOverviewData = async () => {
    setLoading(true);
    setError(null);
    try {
      const [mProps, cList] = await Promise.all([
        reportingService.getOverview(dateRange),
        reportingService.getCustomerProfitability()
      ]);
      setMetrics(mProps);
      setCustomers(cList);
    } catch (err) {
      setError(err.message || 'Failed to load MIS overview reporting data.');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchOverviewData();
  }, [dateRange]);

  const datePresets = [
    'Today',
    'This Week',
    'This Month',
    'Last Month',
    'This Quarter',
    'This Year'
  ];

  return (
    <div className="space-y-6 pb-12">
      <PageHeader
        title="MIS & Business Overview"
        description="Monitor billed freight revenue, collected cash, operational cost burdens, and net profit margins."
        breadcrumbs={['Speed Setu Admin', 'Reports & MIS', 'Overview']}
        actions={
          <div className="flex items-center gap-2">
            <button
              onClick={() => navigate('/admin/reports/monthly-mis')}
              className="inline-flex items-center gap-1.5 px-3 py-2 text-xs font-bold text-slate-700 bg-white border border-slate-300 hover:bg-slate-50 rounded-md transition-colors shadow-xs"
            >
              <FileText className="w-4 h-4 text-setu-600" />
              <span>Monthly MIS Report</span>
            </button>
          </div>
        }
      />

      {/* DATE RANGE PRESETS BAR */}
      <div className="bg-white border border-slate-200 rounded-xl p-3 shadow-xs flex items-center justify-between text-xs">
        <div className="flex items-center gap-2">
          <Calendar className="w-4 h-4 text-setu-600" />
          <span className="font-bold text-slate-700 uppercase tracking-wider text-[11px]">Reporting Date Period:</span>
        </div>

        <div className="flex items-center gap-1.5 flex-wrap">
          {datePresets.map((preset) => (
            <button
              key={preset}
              onClick={() => setDateRange(preset)}
              className={`px-3 py-1 rounded font-bold transition-colors ${
                dateRange === preset
                  ? 'bg-setu-600 text-white shadow-xs'
                  : 'bg-slate-100 text-slate-700 hover:bg-slate-200'
              }`}
            >
              {preset}
            </button>
          ))}
        </div>
      </div>

      {/* MAIN FINANCIAL KPI CARDS STRIP */}
      {loading ? (
        <LoadingState message="Calculating Profitability & Financial Metrics..." />
      ) : error ? (
        <ErrorState message={error} onRetry={fetchOverviewData} />
      ) : (
        <>
          <div className="grid grid-cols-2 sm:grid-cols-7 gap-3">
            <KPICard title="Total Revenue" value={formatINR(metrics.totalRevenue || 0)} subtext="Billed invoice revenue" icon={DollarSign} variant="accent" />
            <KPICard title="Collected Revenue" value={formatINR(metrics.collectedRevenue || 0)} subtext="Confirmed cash received" icon={CheckCircle2} variant="default" />
            <KPICard title="Total Expenses" value={formatINR(metrics.totalExpenses || 0)} subtext="Operational cost burden" icon={CreditCard} variant="default" />
            <KPICard title="Receivables" value={formatINR(metrics.outstandingReceivables || 0)} subtext="Unpaid customer balance" icon={DollarSign} variant="warning" />
            <KPICard title="Pending Payables" value={formatINR(metrics.pendingPayables || 0)} subtext="Owed to transporters" icon={CreditCard} variant="warning" />
            <KPICard title="Gross Operating Profit" value={formatINR(metrics.grossProfit || 0)} subtext="Revenue minus costs" icon={TrendingUp} variant="accent" />
            <KPICard title="Profit Margin" value={`${metrics.profitMargin || 0}%`} subtext="Operating profit %" icon={PieChart} variant="accent" />
          </div>

          {/* MANAGEMENT ALERTS CARD */}
          <ManagementAlertsCard alerts={metrics.alerts} />

          {/* SUB-REPORTS SHORTCUT GRID */}
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-4 text-xs">
            <button
              onClick={() => navigate('/admin/reports/shipments')}
              className="p-4 bg-white border border-slate-200 hover:border-setu-400 rounded-xl shadow-xs text-left space-y-1 transition-all group"
            >
              <div className="flex items-center justify-between">
                <span className="font-bold text-slate-900 group-hover:text-setu-600">Shipment Profitability</span>
                <DollarSign className="w-4 h-4 text-slate-400 group-hover:text-setu-600" />
              </div>
              <p className="text-[11px] text-slate-500">View CN revenue vs direct & allocated trip costs.</p>
            </button>

            <button
              onClick={() => navigate('/admin/reports/trips')}
              className="p-4 bg-white border border-slate-200 hover:border-setu-400 rounded-xl shadow-xs text-left space-y-1 transition-all group"
            >
              <div className="flex items-center justify-between">
                <span className="font-bold text-slate-900 group-hover:text-setu-600">Trip Profitability</span>
                <Truck className="w-4 h-4 text-slate-400 group-hover:text-setu-600" />
              </div>
              <p className="text-[11px] text-slate-500">Analyze linehaul revenue vs driver/transporter expenses.</p>
            </button>

            <button
              onClick={() => navigate('/admin/reports/customers')}
              className="p-4 bg-white border border-slate-200 hover:border-setu-400 rounded-xl shadow-xs text-left space-y-1 transition-all group"
            >
              <div className="flex items-center justify-between">
                <span className="font-bold text-slate-900 group-hover:text-setu-600">Customer Profitability</span>
                <Users className="w-4 h-4 text-slate-400 group-hover:text-setu-600" />
              </div>
              <p className="text-[11px] text-slate-500">Customer margin ranking & receivables balance.</p>
            </button>

            <button
              onClick={() => navigate('/admin/reports/routes')}
              className="p-4 bg-white border border-slate-200 hover:border-setu-400 rounded-xl shadow-xs text-left space-y-1 transition-all group"
            >
              <div className="flex items-center justify-between">
                <span className="font-bold text-slate-900 group-hover:text-setu-600">Route & Mode Analysis</span>
                <MapPin className="w-4 h-4 text-slate-400 group-hover:text-setu-600" />
              </div>
              <p className="text-[11px] text-slate-500">Evaluate Revenue/kg vs Cost/kg across lanes.</p>
            </button>
          </div>

          {/* TOP / BOTTOM PERFORMING CUSTOMERS WIDGET */}
          <TopPerformersWidget customers={customers} />
        </>
      )}
    </div>
  );
};
