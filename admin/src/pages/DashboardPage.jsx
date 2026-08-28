import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { dashboardService } from '../services/dashboardService';
import { useSearch } from '../context/SearchContext';
import { formatINR, formatNumber } from '../utils/formatters';
import { PageHeader } from '../components/common/PageHeader';
import { KPICard } from '../components/common/KPICard';
import { DataTable } from '../components/common/DataTable';
import { StatusBadge } from '../components/common/StatusBadge';
import { SearchBar } from '../components/common/SearchBar';
import { LoadingState } from '../components/common/LoadingState';
import { ErrorState } from '../components/common/ErrorState';
import { Modal } from '../components/common/Modal';
import {
  ResponsiveContainer,
  BarChart,
  Bar,
  XAxis,
  YAxis,
  Tooltip,
  Legend,
  CartesianGrid,
  Cell
} from 'recharts';
import {
  Truck,
  MapPin,
  Send,
  CheckCircle2,
  DollarSign,
  TrendingUp,
  TrendingDown,
  FileCheck,
  AlertCircle,
  Bell,
  RefreshCw,
  CreditCard,
  Building2,
  X
} from 'lucide-react';

export const DashboardPage = () => {
  const navigate = useNavigate();
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  // Global search context
  const { searchQuery, setSearchQuery } = useSearch();

  // Interactive Action Modal State
  const [activeModal, setActiveModal] = useState(null);
  const [modalNotification, setModalNotification] = useState('');

  const fetchDashboard = async () => {
    setLoading(true);
    setError(null);
    try {
      const summary = await dashboardService.getDashboardSummary();
      setData(summary);
    } catch (err) {
      setError(err.message || 'Failed to connect to Speed Setu data services.');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchDashboard();
  }, []);

  if (loading) return <LoadingState message="Loading Speed Setu Dashboard Metrics..." />;
  if (error) return <ErrorState message={error} onRetry={fetchDashboard} />;

  const { kpis, companyTurnover = [], companyProfit = [], recentShipments, paymentFollowUps, pendingPayables } = data;

  const q = searchQuery.toLowerCase().trim();

  // Filter recent shipments based on search query
  const filteredShipments = recentShipments.filter((item) => {
    if (!q) return true;
    return (
      item.cnNumber.toLowerCase().includes(q) ||
      item.company.toLowerCase().includes(q) ||
      item.origin.toLowerCase().includes(q) ||
      item.destination.toLowerCase().includes(q) ||
      item.status.toLowerCase().includes(q)
    );
  });

  // Filter payment follow ups based on search query
  const filteredPayments = paymentFollowUps.filter((item) => {
    if (!q) return true;
    return (
      item.company.toLowerCase().includes(q) ||
      item.invoice.toLowerCase().includes(q) ||
      item.status.toLowerCase().includes(q)
    );
  });

  // Filter pending payables based on search query
  const filteredPayables = pendingPayables.filter((item) => {
    if (!q) return true;
    return (
      item.vendor.toLowerCase().includes(q) ||
      item.trip.toLowerCase().includes(q) ||
      item.status.toLowerCase().includes(q)
    );
  });

  // KPI card configs
  const kpiCards = [
    { title: 'Active Shipments', value: formatNumber(kpis.activeShipments), subtext: 'Active booked & transit LRs', icon: Truck, variant: 'accent' },
    { title: 'Active Trips', value: '0', subtext: 'Active dispatched trips', icon: Truck, variant: 'accent' },
    { title: 'In Transit', value: formatNumber(kpis.inTransit), subtext: 'Moving across hubs', icon: MapPin, variant: 'default' },
    { title: 'Out for Delivery', value: formatNumber(kpis.outForDelivery), subtext: 'Scheduled for delivery today', icon: Send, variant: 'default' },
    { title: 'Delivered Today', value: formatNumber(kpis.deliveredToday), subtext: 'Successfully completed', icon: CheckCircle2, variant: 'default' },
    { title: 'POD Pending', value: formatNumber(kpis.podPending), subtext: 'Awaiting signature upload', icon: FileCheck, variant: 'warning', onClick: () => navigate('/admin/pod/pending') },
    { title: 'Customer Outstanding', value: formatINR(kpis.customerOutstanding), subtext: 'Total unpaid client balance', icon: AlertCircle, variant: 'danger' },
    { title: 'Payables', value: formatINR(kpis.payables), subtext: 'Pending vendor payouts', icon: DollarSign, variant: 'default' },
    { title: 'Current Month Revenue', value: formatINR(kpis.currentMonthRevenue), subtext: 'Total billed revenue', icon: TrendingUp },
    { title: 'Current Month Expenses', value: formatINR(kpis.currentMonthExpenses), subtext: 'Fuel, toll, linehaul costs', icon: TrendingDown, variant: 'default' },
    { title: 'Current Month Profit', value: formatINR(kpis.currentMonthProfit), subtext: 'Revenue minus operational costs', icon: CreditCard, variant: 'accent' },
  ];

  // Table Columns
  const shipmentColumns = [
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
      header: 'Company',
      accessor: 'company',
      render: (row) => <span className="font-medium text-slate-900">{row.company || row.companyName || 'Advik Autocomp Pvt Ltd'}</span>
    },
    { header: 'Origin', accessor: 'origin', render: (row) => <span className="capitalize">{row.origin || '-'}</span> },
    { header: 'Destination', accessor: 'destination', render: (row) => <span className="capitalize">{row.destination || '-'}</span> },
    {
      header: 'Mode',
      accessor: 'mode',
      render: (row) => <span className="px-2 py-0.5 rounded text-[11px] font-medium bg-slate-100 text-slate-700">{row.mode || 'Express LTL'}</span>
    },
    { header: 'Packages', accessor: 'packages', render: (row) => <span>{row.packages || row.numberOfBoxes || row.noOfBoxes || 10}</span> },
    { header: 'Weight', accessor: 'weight', render: (row) => <span className="font-mono">{row.weight || row.chargeableWeight || row.actualWeight || 300} Kg</span> },
    {
      header: 'Status',
      accessor: 'status',
      render: (row) => <StatusBadge status={row.status || 'Booked'} />
    },
    {
      header: 'POD',
      accessor: 'podStatus',
      render: (row) => <StatusBadge status={row.podStatus || 'Pending'} />
    },
    {
      header: 'Billing Status',
      accessor: 'billingStatus',
      render: (row) => <StatusBadge status={row.billingStatus || 'Not Ready'} showDot={false} />
    }
  ];

  const paymentColumns = [
    {
      header: 'Company',
      accessor: 'company',
      render: (row) => <span className="font-semibold text-slate-900">{row.company}</span>
    },
    {
      header: 'Invoice #',
      accessor: 'invoice',
      render: (row) => <span className="font-mono text-slate-600 text-xs">{row.invoice}</span>
    },
    {
      header: 'Amount',
      accessor: 'amount',
      align: 'right',
      render: (row) => <span className="font-bold text-slate-900">{formatINR(row.amount)}</span>
    },
    { header: 'Due Date', accessor: 'dueDate' },
    {
      header: 'Days Overdue',
      accessor: 'daysOverdue',
      render: (row) => (
        <span className="font-semibold text-rose-600 bg-rose-50 px-2 py-0.5 rounded text-xs">
          {row.daysOverdue} Days
        </span>
      )
    },
    {
      header: 'Status',
      accessor: 'status',
      render: (row) => <StatusBadge status={row.status} />
    },
    {
      header: 'Action',
      key: 'action',
      render: (row) => (
        <button
          onClick={(e) => {
            e.stopPropagation();
            setActiveModal({
              type: 'reminder',
              title: `Send Payment Reminder to ${row.company}`,
              data: row,
            });
          }}
          className="inline-flex items-center gap-1 px-2.5 py-1 text-xs font-semibold text-setu-600 bg-setu-50 border border-setu-200 rounded hover:bg-setu-600 hover:text-white transition-colors"
        >
          <Bell className="w-3 h-3" />
          <span>Remind</span>
        </button>
      )
    }
  ];

  const payablesColumns = [
    {
      header: 'Transporter / Vendor',
      accessor: 'vendor',
      render: (row) => <span className="font-semibold text-slate-900">{row.vendor}</span>
    },
    {
      header: 'Trip Details',
      accessor: 'trip',
      render: (row) => <span className="text-slate-600 text-xs font-mono">{row.trip}</span>
    },
    {
      header: 'Amount',
      accessor: 'amount',
      align: 'right',
      render: (row) => <span className="font-bold text-slate-900">{formatINR(row.amount)}</span>
    },
    { header: 'Due Date', accessor: 'dueDate' },
    {
      header: 'Status',
      accessor: 'status',
      render: (row) => <StatusBadge status={row.status} />
    },
    {
      header: 'Action',
      key: 'action',
      render: (row) => (
        <button
          onClick={(e) => {
            e.stopPropagation();
            setActiveModal({
              type: 'payout',
              title: `Process Payout for ${row.vendor}`,
              data: row,
            });
          }}
          className="inline-flex items-center gap-1 px-2.5 py-1 text-xs font-semibold text-emerald-700 bg-emerald-50 border border-emerald-200 rounded hover:bg-emerald-600 hover:text-white transition-colors"
        >
          <DollarSign className="w-3 h-3" />
          <span>Pay Out</span>
        </button>
      )
    }
  ];

  return (
    <div className="space-y-8">
      {/* Top Header Controls */}
      <PageHeader
        title="Operations & Financial Dashboard"
        description="Speed Setu Logistics Real-Time Enterprise Command Center"
        breadcrumbs={['Speed Setu Admin', 'Dashboard']}
        actions={
          <button
            onClick={fetchDashboard}
            className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold bg-white border border-slate-200 text-slate-700 rounded-md hover:bg-slate-50 transition-colors shadow-xs"
          >
            <RefreshCw className="w-3.5 h-3.5" />
            <span>Refresh Metrics</span>
          </button>
        }
      />

      {/* Active Search Banner Indicator */}
      {searchQuery && (
        <div className="p-3 bg-blue-50 border border-blue-200 text-setu-700 rounded-lg text-xs font-semibold flex items-center justify-between animate-fade-in">
          <span>Filtering dashboard records matching: "<strong>{searchQuery}</strong>"</span>
          <button
            onClick={() => setSearchQuery('')}
            className="text-setu-600 font-bold hover:underline flex items-center gap-1"
          >
            <X className="w-3.5 h-3.5" />
            <span>Clear Search Filter</span>
          </button>
        </div>
      )}

      {/* Toast Notification Banner */}
      {modalNotification && (
        <div className="p-3 bg-emerald-50 border border-emerald-200 text-emerald-800 rounded-lg text-xs font-semibold flex items-center justify-between animate-fade-in">
          <span>{modalNotification}</span>
          <button onClick={() => setModalNotification('')} className="text-emerald-600 font-bold hover:underline">
            Dismiss
          </button>
        </div>
      )}

      {/* 1. KPI CARDS GRID */}
      <div>
        <h3 className="text-[11px] sm:text-xs font-bold text-slate-500 uppercase tracking-wider mb-2.5 sm:mb-3">
          Key Performance Indicators (KPIs)
        </h3>
        <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 gap-2.5 sm:gap-4">
          {kpiCards.map((card, idx) => (
            <KPICard key={idx} {...card} />
          ))}
        </div>
      </div>

      {/* 2. CHARTS SECTION */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4 sm:gap-6">
        {/* Company Monthly Turnover Chart */}
        <div className="bg-white border border-slate-200 rounded-xl p-3.5 sm:p-5 shadow-xs">
          <div className="flex flex-col xs:flex-row xs:items-center justify-between gap-2 mb-3 sm:mb-4">
            <div>
              <h3 className="text-xs sm:text-sm font-bold text-slate-900">Company Monthly Turnover</h3>
              <p className="text-[11px] sm:text-xs text-slate-500">Client turnover breakdown for current billing period</p>
            </div>
            <span className="self-start xs:self-auto text-[11px] sm:text-xs font-semibold px-2 py-0.5 rounded bg-blue-50 text-setu-600 border border-blue-100 shrink-0">
              {formatINR(kpis.currentMonthRevenue || 0)} Total Turnover
            </span>
          </div>

          <div className="h-56 sm:h-64 w-full">
            {companyTurnover && companyTurnover.length > 0 ? (
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={companyTurnover} margin={{ top: 10, right: 10, left: -10, bottom: 25 }}>
                  <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#f1f5f9" />
                  <XAxis dataKey="name" tick={{ fontSize: 9, fill: '#64748b' }} interval={0} angle={-25} textAnchor="end" />
                  <YAxis tick={{ fontSize: 9, fill: '#64748b' }} tickFormatter={(v) => `₹${(v / 1000).toFixed(0)}k`} />
                  <Tooltip
                    formatter={(value) => [formatINR(value), 'Monthly Turnover']}
                    contentStyle={{ backgroundColor: '#ffffff', borderRadius: '8px', border: '1px solid #e2e8f0', fontSize: '11px' }}
                  />
                  <Bar dataKey="turnover" name="Turnover (₹)" fill="#0052cc" radius={[4, 4, 0, 0]} />
                </BarChart>
              </ResponsiveContainer>
            ) : (
              <div className="h-full flex flex-col items-center justify-center text-center p-4">
                <Building2 className="w-8 h-8 text-slate-300 mb-2" />
                <p className="text-xs font-semibold text-slate-600">No Company Turnover Recorded</p>
                <p className="text-[11px] text-slate-400 mt-1">Company turnover will calculate automatically as client shipments & invoices are recorded.</p>
              </div>
            )}
          </div>
        </div>

        {/* Company Monthly Profit Chart */}
        <div className="bg-white border border-slate-200 rounded-xl p-3.5 sm:p-5 shadow-xs">
          <div className="flex flex-col xs:flex-row xs:items-center justify-between gap-2 mb-3 sm:mb-4">
            <div>
              <h3 className="text-xs sm:text-sm font-bold text-slate-900">Company Monthly Profit</h3>
              <p className="text-[11px] sm:text-xs text-slate-500">Net profit breakdown per client company</p>
            </div>
            <span className="self-start xs:self-auto text-[11px] sm:text-xs font-semibold px-2 py-0.5 rounded bg-emerald-50 text-emerald-700 border border-emerald-100 shrink-0">
              {formatINR(kpis.currentMonthProfit || 0)} Total Profit
            </span>
          </div>

          <div className="h-56 sm:h-64 w-full">
            {companyProfit && companyProfit.length > 0 ? (
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={companyProfit} margin={{ top: 10, right: 10, left: -10, bottom: 25 }}>
                  <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#f1f5f9" />
                  <XAxis dataKey="name" tick={{ fontSize: 9, fill: '#64748b' }} interval={0} angle={-25} textAnchor="end" />
                  <YAxis tick={{ fontSize: 9, fill: '#64748b' }} tickFormatter={(v) => `₹${(v / 1000).toFixed(0)}k`} />
                  <Tooltip
                    formatter={(value) => [formatINR(value), 'Net Profit']}
                    contentStyle={{ backgroundColor: '#ffffff', borderRadius: '8px', border: '1px solid #e2e8f0', fontSize: '11px' }}
                  />
                  <Bar dataKey="profit" name="Profit (₹)" fill="#10b981" radius={[4, 4, 0, 0]} />
                </BarChart>
              </ResponsiveContainer>
            ) : (
              <div className="h-full flex flex-col items-center justify-center text-center p-4">
                <TrendingUp className="w-8 h-8 text-slate-300 mb-2" />
                <p className="text-xs font-semibold text-slate-600">No Company Profit Recorded</p>
                <p className="text-[11px] text-slate-400 mt-1">Net profit per company will calculate automatically as invoices & operational expenses are recorded.</p>
              </div>
            )}
          </div>
        </div>
      </div>

      {/* 3. RECENT SHIPMENTS TABLE */}
      <div className="space-y-3">
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
          <div>
            <h3 className="text-xs sm:text-sm font-bold text-slate-900">Recent Shipments & Consignment Notes</h3>
            <p className="text-[11px] sm:text-xs text-slate-500">Click any shipment row to view full A-to-Z detail page</p>
          </div>

          <div className="w-full sm:w-64">
            <SearchBar
              value={searchQuery}
              onChange={setSearchQuery}
              placeholder="Filter CN #, company..."
            />
          </div>
        </div>

        <DataTable
          columns={shipmentColumns}
          data={filteredShipments}
          onRowClick={(row) => navigate(`/admin/shipments/${row.cnNumber}`)}
          emptyMessage="No shipments found"
          emptySubtext="Try clearing your search query or entering another keyword."
        />
      </div>

      {/* 4. FINANCIAL FOLLOW-UPS & PAYABLES GRID */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4 sm:gap-6">
        {/* Payment Follow-up Section */}
        <div className="space-y-3">
          <div className="flex flex-col xs:flex-row xs:items-center justify-between gap-2">
            <div>
              <h3 className="text-xs sm:text-sm font-bold text-slate-900">Payment Follow-up</h3>
              <p className="text-[11px] sm:text-xs text-slate-500">Customers with outstanding & overdue invoices</p>
            </div>
            <span className="self-start xs:self-auto text-[11px] sm:text-xs font-semibold px-2 py-0.5 rounded bg-rose-50 text-rose-700 shrink-0">
              {formatINR(kpis.customerOutstanding || 0)} Outstanding
            </span>
          </div>

          <DataTable columns={paymentColumns} data={filteredPayments} />
        </div>

        {/* Pending Payables Section */}
        <div className="space-y-3">
          <div className="flex flex-col xs:flex-row xs:items-center justify-between gap-2">
            <div>
              <h3 className="text-xs sm:text-sm font-bold text-slate-900">Pending Payables</h3>
              <p className="text-[11px] sm:text-xs text-slate-500">Transporter, driver & linehaul vendor payouts</p>
            </div>
            <span className="self-start xs:self-auto text-[11px] sm:text-xs font-semibold px-2 py-0.5 rounded bg-slate-100 text-slate-700 shrink-0">
              {formatINR(kpis.payables || 0)} Due
            </span>
          </div>

          <DataTable columns={payablesColumns} data={filteredPayables} />
        </div>
      </div>

      {/* REUSABLE ACTION MODAL */}
      <Modal
        isOpen={!!activeModal}
        onClose={() => setActiveModal(null)}
        title={activeModal?.title || 'System Action'}
        footer={
          <>
            <button
              onClick={() => setActiveModal(null)}
              className="px-3 py-1.5 text-xs font-semibold text-slate-700 bg-white border border-slate-300 rounded hover:bg-slate-50"
            >
              Cancel
            </button>
            <button
              onClick={() => {
                if (activeModal?.type === 'reminder') {
                  setModalNotification(`Payment reminder notification sent to ${activeModal.data.company} for invoice ${activeModal.data.invoice}!`);
                } else if (activeModal?.type === 'payout') {
                  setModalNotification(`Payout request of ${formatINR(activeModal.data.amount)} approved for ${activeModal.data.vendor}!`);
                }
                setActiveModal(null);
                setTimeout(() => setModalNotification(''), 4000);
              }}
              className="px-3 py-1.5 text-xs font-semibold text-white bg-setu-600 rounded hover:bg-setu-700 shadow-sm"
            >
              Confirm Action
            </button>
          </>
        }
      >
        {activeModal && (
          <div className="text-xs space-y-3">
            <p className="text-slate-600">
              {activeModal.type === 'reminder'
                ? `Send an automated WhatsApp and Email payment reminder to the accounts team at ${activeModal.data.company} for invoice ${activeModal.data.invoice} (${formatINR(activeModal.data.amount)})?`
                : `Authorize payout batch of ${formatINR(activeModal.data.amount)} to ${activeModal.data.vendor} for trip ${activeModal.data.trip}?`}
            </p>

            <div className="p-3 bg-slate-50 border border-slate-200 rounded-lg space-y-1">
              <div className="flex justify-between font-medium">
                <span className="text-slate-500">Record Reference:</span>
                <span className="text-slate-900 font-mono">{activeModal.data.invoice || activeModal.data.trip}</span>
              </div>
              <div className="flex justify-between font-medium">
                <span className="text-slate-500">Total Amount:</span>
                <span className="text-slate-900 font-bold">{formatINR(activeModal.data.amount)}</span>
              </div>
            </div>
          </div>
        )}
      </Modal>
    </div>
  );
};
