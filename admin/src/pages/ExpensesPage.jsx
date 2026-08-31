import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { expenseService } from '../services/expenseService';
import { formatINR, formatDate } from '../utils/formatters';
import { PageHeader } from '../components/common/PageHeader';
import { KPICard } from '../components/common/KPICard';
import { DataTable } from '../components/common/DataTable';
import { StatusBadge } from '../components/common/StatusBadge';
import { SearchBar } from '../components/common/SearchBar';
import { FilterBar } from '../components/common/FilterBar';
import { LoadingState } from '../components/common/LoadingState';
import { ErrorState } from '../components/common/ErrorState';
import {
  DollarSign,
  Truck,
  Package,
  Building2,
  Clock,
  CheckCircle2,
  Plus,
  Eye,
  PieChart
} from 'lucide-react';

export const ExpensesPage = () => {
  const navigate = useNavigate();
  const [metrics, setMetrics] = useState({});
  const [expenses, setExpenses] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  const [search, setSearch] = useState('');
  const [categoryFilter, setCategoryFilter] = useState('All');
  const [scopeFilter, setScopeFilter] = useState('All');

  const fetchExpensesData = async () => {
    setLoading(true);
    setError(null);
    try {
      const [mProps, eData] = await Promise.all([
        expenseService.getExpenseDashboard(),
        expenseService.getExpenses({ search, category: categoryFilter, scope: scopeFilter })
      ]);
      setMetrics(mProps);
      setExpenses(eData);
    } catch (err) {
      setError(err.message || 'Failed to load expense management data.');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchExpensesData();
  }, [search, categoryFilter, scopeFilter]);

  const [viewMode, setViewMode] = useState('all'); // 'all' | 'driverwise'
  const [selectedDriverForStatement, setSelectedDriverForStatement] = useState(null);

  const categoryOptions = [
    { label: 'All Categories', value: 'All' },
    { label: 'Transporter', value: 'Transporter' },
    { label: 'Flight Charges', value: 'Flight Charges' },
    { label: 'Driver', value: 'Driver' },
    { label: 'Toll', value: 'Toll' },
    { label: 'Fuel', value: 'Fuel' },
    { label: 'Pickup', value: 'Pickup' },
    { label: 'Delivery', value: 'Delivery' },
    { label: 'Handling', value: 'Handling' }
  ];

  // Group Expenses Driverwise
  const driverwiseSummary = React.useMemo(() => {
    const map = new Map();

    expenses.forEach((e) => {
      const name = (e.vendorName || e.payeeName || 'Market Driver / Unassigned').trim();
      const key = name.toLowerCase();

      if (!map.has(key)) {
        map.set(key, {
          driverName: name,
          category: e.category || 'Market Driver',
          shipmentsCount: 0,
          totalAmount: 0,
          paidAmount: 0,
          pendingAmount: 0,
          records: []
        });
      }

      const item = map.get(key);
      item.shipmentsCount += 1;
      item.totalAmount += (e.amount || 0);

      const st = (e.paymentStatus || '').toLowerCase();
      if (st === 'paid') {
        item.paidAmount += (e.amount || 0);
      } else {
        item.pendingAmount += (e.amount || 0);
      }

      item.records.push(e);
    });

    return Array.from(map.values());
  }, [expenses]);

  const columns = [
    {
      header: 'Expense ID',
      accessor: 'expenseId',
      render: (row) => (
        <span
          onClick={() => navigate(`/admin/expenses/${row.id || row.expenseId}`)}
          className="font-bold text-setu-600 font-mono hover:underline cursor-pointer"
        >
          {row.expenseId || row.expenseNumber || row.id}
        </span>
      )
    },
    {
      header: 'Date',
      accessor: 'expenseDate',
      render: (row) => <span className="font-mono text-xs text-slate-700">{formatDate(row.expenseDate || row.createdAt)}</span>
    },
    {
      header: 'Category',
      accessor: 'category',
      render: (row) => (
        <span className="px-2 py-0.5 rounded text-[10px] font-bold bg-slate-100 text-slate-800 border border-slate-200">
          {row.category || 'Operational'}
        </span>
      )
    },
    {
      header: 'Title / Description',
      accessor: 'title',
      render: (row) => <span className="font-semibold text-slate-900 text-xs block truncate max-w-[220px]">{row.title || row.description}</span>
    },
    {
      header: 'Trip / CN Reference',
      accessor: 'shipmentId',
      render: (row) => {
        const isAir = row.scope === 'AIR' || row.category === 'Flight Charges' || row.payeeType === 'Air Cargo';
        if (isAir && !row.tripId) {
          return (
            <span className="px-2 py-0.5 rounded text-[10px] font-bold bg-sky-100 text-sky-800 border border-sky-200">
              {row.shipmentId || row.cnNumber ? `AIR CN: ${row.shipmentId || row.cnNumber}` : 'AIR CARGO'}
            </span>
          );
        }
        if (row.tripId) {
          return <span className="font-mono text-xs font-bold text-setu-700">TRIP: {row.tripId}</span>;
        }
        if (row.shipmentId || row.cnNumber) {
          return <span className="font-mono text-xs font-bold text-slate-700">CN: {row.shipmentId || row.cnNumber}</span>;
        }
        return <span className="text-xs text-slate-400 font-medium">Overhead / Direct</span>;
      }
    },
    {
      header: 'Payee / Driver',
      accessor: 'vendorName',
      render: (row) => (
        <span className="text-xs text-slate-900 font-semibold">
          {row.vendorName || row.payeeName || row.title || row.description || 'N/A'}
        </span>
      )
    },
    {
      header: 'Amount',
      accessor: 'amount',
      align: 'right',
      render: (row) => <span className="font-mono text-xs font-bold text-slate-900">{formatINR(row.amount)}</span>
    },
    {
      header: 'Status',
      accessor: 'paymentStatus',
      render: (row) => <StatusBadge status={row.paymentStatus || row.status || 'Pending'} />
    }
  ];

  const handlePrintStatement = (driverGroup) => {
    const win = window.open('', '_blank');
    if (!win) return;

    const rowsHtml = driverGroup.records.map((r, i) => `
      <tr>
        <td style="padding: 8px; border-bottom: 1px solid #e2e8f0; font-family: monospace;">${i + 1}</td>
        <td style="padding: 8px; border-bottom: 1px solid #e2e8f0; font-family: monospace;">${r.expenseId || r.id}</td>
        <td style="padding: 8px; border-bottom: 1px solid #e2e8f0;">${r.expenseDate || '-'}</td>
        <td style="padding: 8px; border-bottom: 1px solid #e2e8f0; font-family: monospace; font-weight: bold;">${r.shipmentId || r.cnNumber || r.tripId || '-'}</td>
        <td style="padding: 8px; border-bottom: 1px solid #e2e8f0;">${r.title || r.description || 'Pickup Freight'}</td>
        <td style="padding: 8px; border-bottom: 1px solid #e2e8f0; text-align: right; font-family: monospace; font-weight: bold;">₹${(r.amount || 0).toLocaleString('en-IN')}</td>
        <td style="padding: 8px; border-bottom: 1px solid #e2e8f0; text-align: center;">${r.paymentStatus || 'Pending'}</td>
      </tr>
    `).join('');

    win.document.write(`
      <!DOCTYPE html>
      <html>
      <head>
        <title>Driver Billing Statement — ${driverGroup.driverName}</title>
        <style>
          body { font-family: system-ui, -apple-system, sans-serif; padding: 30px; color: #0f172a; }
          .header { display: flex; justify-content: space-between; border-bottom: 2px solid #2563eb; padding-bottom: 15px; margin-bottom: 20px; }
          .title { font-size: 20px; font-weight: bold; color: #1e3a8a; }
          .meta { font-size: 12px; color: #64748b; margin-top: 5px; }
          table { width: 100%; border-collapse: collapse; margin-top: 15px; font-size: 13px; }
          th { background: #f8fafc; text-align: left; padding: 8px; border-bottom: 2px solid #cbd5e1; font-size: 11px; text-transform: uppercase; }
          .summary-box { display: flex; gap: 20px; background: #f1f5f9; padding: 15px; border-radius: 8px; margin-top: 20px; font-size: 13px; }
          .sum-item { flex: 1; }
          .sum-val { font-size: 16px; font-weight: bold; font-family: monospace; margin-top: 4px; }
        </style>
      </head>
      <body>
        <div class="header">
          <div>
            <div class="title">SPEED SETU LOGISTICS</div>
            <div class="meta">Driver Billing & Payout Statement</div>
          </div>
          <div style="text-align: right;">
            <div style="font-weight: bold; font-size: 14px;">DRIVER: ${driverGroup.driverName}</div>
            <div class="meta">Statement Date: ${new Date().toLocaleDateString('en-IN')}</div>
          </div>
        </div>

        <div class="summary-box">
          <div class="sum-item">
            <div>Total Incurred Freight</div>
            <div class="sum-val" style="color: #0f172a;">₹${driverGroup.totalAmount.toLocaleString('en-IN')}</div>
          </div>
          <div class="sum-item">
            <div>Total Paid Payouts</div>
            <div class="sum-val" style="color: #16a34a;">₹${driverGroup.paidAmount.toLocaleString('en-IN')}</div>
          </div>
          <div class="sum-item">
            <div>Net Balance Payable</div>
            <div class="sum-val" style="color: #dc2626;">₹${driverGroup.pendingAmount.toLocaleString('en-IN')}</div>
          </div>
        </div>

        <table>
          <thead>
            <tr>
              <th>#</th>
              <th>Expense ID</th>
              <th>Date</th>
              <th>CN / Trip</th>
              <th>Description</th>
              <th style="text-align: right;">Freight Amount</th>
              <th style="text-align: center;">Payout Status</th>
            </tr>
          </thead>
          <tbody>
            ${rowsHtml}
          </tbody>
        </table>

        <div style="margin-top: 40px; border-top: 1px solid #e2e8f0; padding-top: 15px; font-size: 11px; color: #94a3b8; text-align: center;">
          This statement is computer generated for driver freight settlement by Speed Setu Logistics Private Limited.
        </div>
        <script>
          window.onload = function() { window.print(); }
        </script>
      </body>
      </html>
    `);
    win.document.close();
  };

  return (
    <div className="space-y-6">
      <PageHeader
        title="Expense Management"
        description="Monitor linehaul expenses, trip cost allocations, and driverwise operational billing."
        breadcrumbs={['Speed Setu Admin', 'Finance', 'Expenses']}
        actions={
          <button
            onClick={() => navigate('/admin/expenses/new')}
            className="inline-flex items-center gap-2 px-4 py-2 text-xs font-bold text-white bg-setu-600 hover:bg-setu-700 rounded-md shadow-sm transition-colors"
          >
            <Plus className="w-4 h-4" />
            <span>Add Expense</span>
          </button>
        }
      />

      {/* TOP KPI CARDS STRIP */}
      <div className="grid grid-cols-2 sm:grid-cols-6 gap-3">
        <KPICard title="Total Expenses" value={formatINR(metrics.totalExpenses || metrics.totalThisMonth || 0)} subtext="Expenses incurred this month" icon={DollarSign} variant="accent" />
        <KPICard title="Trip Expenses" value={formatINR(metrics.tripExpenses || 0)} subtext="Linehaul freight & toll" icon={Truck} variant="default" />
        <KPICard title="Shipment Expenses" value={formatINR(metrics.shipmentExpenses || 0)} subtext="Pickup & delivery charges" icon={Package} variant="default" />
        <KPICard title="Company Overhead" value={formatINR(metrics.companyOverheads || metrics.companyOverhead || 0)} subtext="Rent, salaries & software" icon={Building2} variant="default" />
        <KPICard title="Pending Payables" value={formatINR(metrics.pendingPayouts || metrics.pendingPayables || 0)} subtext="Owed to transporters/vendors" icon={Clock} variant="warning" />
        <KPICard title="Paid This Month" value={formatINR(metrics.paidThisMonth || 0)} subtext="Total vendor payouts" icon={CheckCircle2} variant="default" />
      </div>

      {/* VIEW MODE SELECTOR & SEARCH BAR */}
      <div className="bg-white border border-slate-200 rounded-xl p-4 shadow-xs space-y-3">
        <div className="flex flex-col md:flex-row items-center justify-between gap-3">
          <div className="w-full md:flex-1">
            <SearchBar
              value={search}
              onChange={setSearch}
              placeholder="Search expense ID, description, payee, trip ID, CN..."
            />
          </div>

          {/* VIEW MODE TOGGLE BUTTONS */}
          <div className="flex items-center gap-1 p-1 bg-slate-100 border border-slate-200 rounded-lg text-xs">
            <button
              onClick={() => setViewMode('all')}
              className={`px-3 py-1.5 font-bold rounded-md transition-all ${
                viewMode === 'all'
                  ? 'bg-white text-setu-700 shadow-xs'
                  : 'text-slate-600 hover:text-slate-900'
              }`}
            >
              All Expense Logs
            </button>
            <button
              onClick={() => setViewMode('driverwise')}
              className={`px-3 py-1.5 font-bold rounded-md transition-all flex items-center gap-1.5 ${
                viewMode === 'driverwise'
                  ? 'bg-setu-600 text-white shadow-xs'
                  : 'text-slate-600 hover:text-slate-900'
              }`}
            >
              <Truck className="w-3.5 h-3.5" />
              <span>Driverwise Billing Ledger</span>
            </button>
          </div>
        </div>

        {viewMode === 'all' && (
          <div className="pt-2 border-t border-slate-100 flex items-center justify-between text-xs">
            <FilterBar
              options={categoryOptions}
              activeFilter={categoryFilter}
              onSelectFilter={setCategoryFilter}
            />
            <span className="text-slate-500 font-medium">
              Showing <strong>{expenses.length}</strong> Expense Records
            </span>
          </div>
        )}
      </div>

      {/* CONTENT: ALL LOGS VS DRIVERWISE BILLING LEDGER */}
      {loading ? (
        <LoadingState message="Loading Expense Management Master Table..." />
      ) : error ? (
        <ErrorState message={error} onRetry={fetchExpensesData} />
      ) : viewMode === 'driverwise' ? (
        <div className="space-y-4">
          <div className="bg-white border border-slate-200 rounded-xl overflow-hidden shadow-xs">
            <div className="p-4 bg-slate-50 border-b border-slate-200 flex items-center justify-between">
              <div>
                <h3 className="font-bold text-slate-900 text-sm flex items-center gap-2">
                  <Truck className="w-4 h-4 text-setu-600" />
                  <span>Driverwise Operational Billing & Hire Ledger</span>
                </h3>
                <p className="text-xs text-slate-500">
                  Detailed cost breakdown, paid amounts, and net pending freight owed per driver / vehicle.
                </p>
              </div>
              <span className="text-xs font-bold text-slate-600 bg-white px-3 py-1 border border-slate-200 rounded-full">
                {driverwiseSummary.length} Active Drivers / Vehicles
              </span>
            </div>

            <div className="overflow-x-auto">
              <table className="w-full text-xs text-left border-collapse">
                <thead>
                  <tr className="bg-slate-100/70 border-b border-slate-200 text-slate-500 uppercase tracking-wider font-bold text-[11px]">
                    <th className="py-3 px-4">Driver / Vendor Name</th>
                    <th className="py-3 px-4 text-center">Pickups / Trips</th>
                    <th className="py-3 px-4 text-right">Total Incurred Cost</th>
                    <th className="py-3 px-4 text-right">Paid Amount</th>
                    <th className="py-3 px-4 text-right">Owed Balance</th>
                    <th className="py-3 px-4 text-center">Payout Status</th>
                    <th className="py-3 px-4 text-right">Actions</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-200 font-medium">
                  {driverwiseSummary.length === 0 ? (
                    <tr>
                      <td colSpan={7} className="py-8 text-center text-slate-500 font-normal">
                        No driverwise expenses recorded yet.
                      </td>
                    </tr>
                  ) : (
                    driverwiseSummary.map((group, idx) => (
                      <tr key={idx} className="hover:bg-slate-50/80 transition-colors">
                        <td className="py-3 px-4">
                          <div className="font-bold text-slate-900 text-xs">{group.driverName}</div>
                          <span className="text-[10px] text-slate-500 font-mono">Category: {group.category}</span>
                        </td>
                        <td className="py-3 px-4 text-center font-bold text-slate-700">
                          {group.shipmentsCount} CN / Pickup
                        </td>
                        <td className="py-3 px-4 text-right font-mono font-bold text-slate-900">
                          {formatINR(group.totalAmount)}
                        </td>
                        <td className="py-3 px-4 text-right font-mono font-bold text-emerald-700">
                          {formatINR(group.paidAmount)}
                        </td>
                        <td className="py-3 px-4 text-right font-mono font-bold text-rose-600">
                          {formatINR(group.pendingAmount)}
                        </td>
                        <td className="py-3 px-4 text-center">
                          <span
                            className={`px-2.5 py-1 rounded-full text-[10px] font-bold ${
                              group.pendingAmount === 0
                                ? 'bg-emerald-50 text-emerald-700 border border-emerald-200'
                                : 'bg-amber-50 text-amber-800 border border-amber-200'
                            }`}
                          >
                            {group.pendingAmount === 0 ? 'Settled' : 'Pending Payout'}
                          </span>
                        </td>
                        <td className="py-3 px-4 text-right space-x-1.5">
                          <button
                            onClick={() => handlePrintStatement(group)}
                            className="px-2.5 py-1 text-[11px] font-bold text-setu-700 bg-setu-50 border border-setu-200 hover:bg-setu-100 rounded transition-colors"
                            title="Print Driver Billing Statement"
                          >
                            Statement
                          </button>
                          <button
                            onClick={() => navigate('/admin/payables')}
                            className="px-2.5 py-1 text-[11px] font-bold text-white bg-setu-600 hover:bg-setu-700 rounded transition-colors"
                            title="Go to Payables to Record Payment"
                          >
                            Pay Payout
                          </button>
                        </td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      ) : (
        <DataTable
          columns={columns}
          data={expenses}
          onRowClick={(row) => navigate(`/admin/expenses/${row.id}`)}
          emptyMessage="No expense records found"
          emptySubtext="Try adjusting your search criteria or category filter."
        />
      )}
    </div>
  );
};
