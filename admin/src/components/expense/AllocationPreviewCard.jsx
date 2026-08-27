import React from 'react';
import { formatINR } from '../../utils/formatters';
import { PieChart, CheckCircle2 } from 'lucide-react';

export const AllocationPreviewCard = ({ allocations = [], allocationMethod = 'Weight', totalExpenseAmount = 0 }) => {
  if (!allocations || allocations.length === 0) return null;

  const allocatedSum = allocations.reduce((acc, a) => acc + (a.allocatedAmount || 0), 0);
  const isComplete = Math.abs(allocatedSum - totalExpenseAmount) < 1;

  return (
    <div className="bg-slate-50 border border-slate-200 rounded-xl p-5 shadow-xs space-y-3 text-xs">
      <div className="flex items-center justify-between border-b border-slate-200 pb-2">
        <div className="flex items-center gap-2">
          <PieChart className="w-4 h-4 text-setu-600" />
          <h3 className="font-bold text-slate-900 uppercase tracking-wider text-[11px]">
            Trip Expense Allocation Preview ({allocationMethod}-Based Split)
          </h3>
        </div>

        <span className={`inline-flex items-center gap-1 text-[10px] font-bold px-2 py-0.5 rounded border ${
          isComplete ? 'bg-emerald-50 text-emerald-700 border-emerald-200' : 'bg-amber-50 text-amber-800 border-amber-200'
        }`}>
          <CheckCircle2 className="w-3.5 h-3.5" />
          {isComplete ? '100% Allocated' : `Unallocated: ${formatINR(totalExpenseAmount - allocatedSum)}`}
        </span>
      </div>

      <div className="border border-slate-200 rounded-lg overflow-hidden bg-white">
        <table className="w-full text-left border-collapse">
          <thead className="bg-slate-100 text-slate-600 uppercase font-bold text-[10px] border-b border-slate-200">
            <tr>
              <th className="p-2.5">CN Number</th>
              <th className="p-2.5">Company Name</th>
              <th className="p-2.5 text-center">{allocationMethod === 'Weight' ? 'Weight (Kg)' : 'Revenue (₹)'}</th>
              <th className="p-2.5 text-center">Allocation %</th>
              <th className="p-2.5 text-right">Allocated Expense</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100 font-medium text-xs">
            {allocations.map((a) => (
              <tr key={a.cnNumber}>
                <td className="p-2.5 font-bold font-mono text-setu-600">{a.cnNumber}</td>
                <td className="p-2.5 font-semibold text-slate-900">{a.companyName}</td>
                <td className="p-2.5 text-center font-mono">{allocationMethod === 'Weight' ? `${a.weight} Kg` : formatINR(a.revenue || 0)}</td>
                <td className="p-2.5 text-center font-mono font-bold text-slate-700">{a.percentage}%</td>
                <td className="p-2.5 text-right font-mono font-bold text-slate-900">{formatINR(a.allocatedAmount)}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
};
