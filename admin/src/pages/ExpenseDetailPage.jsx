import React, { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { expenseService } from '../services/expenseService';
import { formatDate, formatINR } from '../utils/formatters';
import { StatusBadge } from '../components/common/StatusBadge';
import { PageHeader } from '../components/common/PageHeader';
import { LoadingState } from '../components/common/LoadingState';
import { AllocationPreviewCard } from '../components/expense/AllocationPreviewCard';
import {
  DollarSign,
  ArrowLeft,
  Building2,
  PieChart,
  Truck,
  Package,
  CreditCard
} from 'lucide-react';

export const ExpenseDetailPage = () => {
  const { id } = useParams();
  const navigate = useNavigate();

  const [expense, setExpense] = useState(null);
  const [loading, setLoading] = useState(true);

  const fetchExpenseData = async () => {
    setLoading(true);
    try {
      const data = await expenseService.getExpense(id);
      setExpense(data);
    } catch (err) {
      alert(err.message || 'Failed to load expense profile.');
      navigate('/admin/expenses');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchExpenseData();
  }, [id]);

  if (loading) {
    return <LoadingState message="Loading Expense Transaction Profile..." />;
  }

  if (!expense) return null;

  return (
    <div className="space-y-6 max-w-5xl mx-auto pb-12">
      {/* Top Header & Actions */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div className="flex items-center gap-3">
          <button
            onClick={() => navigate('/admin/expenses')}
            className="p-2 text-slate-600 bg-white border border-slate-200 rounded-lg hover:bg-slate-50 transition-colors shadow-xs"
          >
            <ArrowLeft className="w-4 h-4" />
          </button>

          <div>
            <div className="flex items-center gap-2">
              <span className="text-xs font-bold text-slate-400 uppercase tracking-wider">Operational Expense</span>
              <StatusBadge status={expense.paymentStatus} />
            </div>

            <h1 className="text-2xl font-bold text-slate-900 font-mono tracking-tight flex items-center gap-2">
              <span>{expense.expenseNumber}</span>
              <span className="text-sm font-semibold text-slate-600">— {expense.description}</span>
            </h1>
          </div>
        </div>

        {expense.payableId && (
          <button
            onClick={() => navigate(`/admin/payables/${expense.payableId}`)}
            className="inline-flex items-center gap-1.5 px-3.5 py-1.5 text-xs font-bold text-setu-700 bg-setu-50 border border-setu-200 hover:bg-setu-100 rounded-md transition-colors shadow-xs"
          >
            <CreditCard className="w-4 h-4 text-setu-600" />
            <span>View Vendor Payable ({expense.payableId.toUpperCase()})</span>
          </button>
        )}
      </div>

      {/* SUMMARY METRICS STRIP */}
      <div className="bg-white border border-slate-200 rounded-xl p-4 shadow-xs grid grid-cols-2 sm:grid-cols-4 gap-4 divide-y sm:divide-y-0 sm:divide-x divide-slate-100">
        <div>
          <span className="text-[11px] font-bold text-slate-400 uppercase tracking-wider block">Expense Date</span>
          <span className="text-xs font-bold text-slate-900 font-mono">{formatDate(expense.expenseDate)}</span>
        </div>

        <div className="pt-2 sm:pt-0 sm:pl-4">
          <span className="text-[11px] font-bold text-slate-400 uppercase tracking-wider block">Category</span>
          <span className="text-xs font-bold text-slate-900">{expense.category}</span>
        </div>

        <div className="pt-2 sm:pt-0 sm:pl-4">
          <span className="text-[11px] font-bold text-slate-400 uppercase tracking-wider block">Total Amount</span>
          <span className="text-sm font-black text-slate-900 font-mono">{formatINR(expense.amount)}</span>
        </div>

        <div className="pt-2 sm:pt-0 sm:pl-4">
          <span className="text-[11px] font-bold text-slate-400 uppercase tracking-wider block">Scope / Reference</span>
          <span className="text-xs font-bold text-setu-600 font-mono">
            {expense.scope === 'TRP' ? expense.tripId : expense.scope === 'SHIPMENT' ? expense.cnNumber : 'Overhead'}
          </span>
        </div>
      </div>

      {/* TRIP ALLOCATION PREVIEW CARD */}
      {expense.scope === 'TRP' && expense.allocations && expense.allocations.length > 0 && (
        <AllocationPreviewCard
          allocations={expense.allocations}
          allocationMethod={expense.allocationMethod}
          totalExpenseAmount={expense.amount}
        />
      )}

      {/* PAYEE & AUDIT DETAILS CARD */}
      <div className="bg-white border border-slate-200 rounded-xl p-5 shadow-xs space-y-3 text-xs">
        <div className="flex items-center gap-2 border-b border-slate-100 pb-2">
          <Building2 className="w-4 h-4 text-emerald-600" />
          <h3 className="font-bold text-slate-900 uppercase tracking-wider text-[11px]">Payee Vendor & Audit Details</h3>
        </div>

        <div className="grid grid-cols-2 sm:grid-cols-3 gap-4 text-slate-700">
          <div>
            <span className="text-slate-400 block text-[11px]">Payee Type</span>
            <span className="font-bold text-slate-900">{expense.payeeType}</span>
          </div>

          <div>
            <span className="text-slate-400 block text-[11px]">Payee Name</span>
            <span className="font-bold text-slate-900">{expense.payeeName}</span>
          </div>

          <div>
            <span className="text-slate-400 block text-[11px]">Recorded By</span>
            <span className="font-mono text-slate-600">{expense.createdBy} ({expense.createdAt})</span>
          </div>
        </div>
      </div>
    </div>
  );
};
