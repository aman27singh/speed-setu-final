import React from 'react';
import { formatINR } from '../../utils/formatters';
import { Clock } from 'lucide-react';

export const PayableAgingBar = ({ aging = {} }) => {
  return (
    <div className="bg-white border border-slate-200 rounded-xl p-5 shadow-xs space-y-3">
      <div className="flex items-center justify-between border-b border-slate-100 pb-2">
        <div className="flex items-center gap-2">
          <Clock className="w-4 h-4 text-setu-600" />
          <h3 className="text-xs font-bold text-slate-900 uppercase tracking-wider">
            Accounts Payable Aging Analysis
          </h3>
        </div>
        <span className="text-xs font-mono font-bold text-slate-900">
          Total Payables: <span className="text-rose-700">{formatINR(aging.totalOutstandingPayable || 0)}</span>
        </span>
      </div>

      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 text-xs">
        <div className="p-3 bg-emerald-50/60 border border-emerald-200 rounded-lg">
          <span className="text-[10px] font-bold text-emerald-800 uppercase tracking-wider block">Current (Not Due)</span>
          <span className="text-sm font-bold text-emerald-950 font-mono">{formatINR(aging.current || 0)}</span>
        </div>

        <div className="p-3 bg-blue-50/60 border border-blue-200 rounded-lg">
          <span className="text-[10px] font-bold text-blue-800 uppercase tracking-wider block">1–15 Days Overdue</span>
          <span className="text-sm font-bold text-blue-950 font-mono">{formatINR(aging.days1to15 || 0)}</span>
        </div>

        <div className="p-3 bg-amber-50/60 border border-amber-200 rounded-lg">
          <span className="text-[10px] font-bold text-amber-800 uppercase tracking-wider block">16–30 Days Overdue</span>
          <span className="text-sm font-bold text-amber-950 font-mono">{formatINR(aging.days16to30 || 0)}</span>
        </div>

        <div className="p-3 bg-rose-50/60 border border-rose-200 rounded-lg">
          <span className="text-[10px] font-bold text-rose-800 uppercase tracking-wider block">31+ Days Overdue</span>
          <span className="text-sm font-bold text-rose-950 font-mono">{formatINR(aging.days31Plus || 0)}</span>
        </div>
      </div>
    </div>
  );
};
