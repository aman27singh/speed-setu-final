import React from 'react';
import { formatINR } from '../../utils/formatters';
import { TrendingUp, TrendingDown, Building2 } from 'lucide-react';

export const TopPerformersWidget = ({ customers = [] }) => {
  if (!customers || customers.length === 0) return null;

  const sortedTop = [...customers].sort((a, b) => b.profit - a.profit);
  const sortedBottom = [...customers].sort((a, b) => a.profit - b.profit);

  return (
    <div className="grid grid-cols-1 md:grid-cols-2 gap-6 text-xs">
      {/* TOP PERFORMING CUSTOMERS */}
      <div className="bg-white border border-slate-200 rounded-xl p-5 shadow-xs space-y-3">
        <div className="flex items-center gap-2 border-b border-slate-100 pb-2">
          <TrendingUp className="w-4 h-4 text-emerald-600" />
          <h3 className="font-bold text-slate-900 uppercase tracking-wider text-[11px]">
            Top Profitable Customers
          </h3>
        </div>

        <div className="space-y-2">
          {sortedTop.map((c, idx) => (
            <div key={c.companyId || idx} className="p-2.5 bg-emerald-50/50 border border-emerald-100 rounded-lg flex items-center justify-between">
              <div className="flex items-center gap-2">
                <span className="w-5 h-5 rounded-full bg-emerald-600 text-white font-mono font-bold text-[10px] flex items-center justify-center">
                  #{idx + 1}
                </span>
                <div>
                  <strong className="text-slate-900 block">{c.companyName}</strong>
                  <span className="text-[10px] text-slate-500 font-mono">{c.shipmentsCount} Shipments | Rev: {formatINR(c.revenue)}</span>
                </div>
              </div>

              <div className="text-right font-mono">
                <span className="font-bold text-emerald-700 block">{formatINR(c.profit)}</span>
                <span className="text-[10px] text-emerald-800 font-semibold">{c.margin}% Margin</span>
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* LOWEST MARGIN / LOSS CUSTOMERS */}
      <div className="bg-white border border-slate-200 rounded-xl p-5 shadow-xs space-y-3">
        <div className="flex items-center gap-2 border-b border-slate-100 pb-2">
          <TrendingDown className="w-4 h-4 text-rose-600" />
          <h3 className="font-bold text-slate-900 uppercase tracking-wider text-[11px]">
            Lowest Margin / Loss Customers
          </h3>
        </div>

        <div className="space-y-2">
          {sortedBottom.map((c, idx) => (
            <div key={c.companyId || idx} className="p-2.5 bg-rose-50/50 border border-rose-100 rounded-lg flex items-center justify-between">
              <div className="flex items-center gap-2">
                <span className="w-5 h-5 rounded-full bg-rose-600 text-white font-mono font-bold text-[10px] flex items-center justify-center">
                  #{idx + 1}
                </span>
                <div>
                  <strong className="text-slate-900 block">{c.companyName}</strong>
                  <span className="text-[10px] text-slate-500 font-mono">{c.shipmentsCount} Shipments | Rev: {formatINR(c.revenue)}</span>
                </div>
              </div>

              <div className="text-right font-mono">
                <span className={`font-bold block ${c.profit < 0 ? 'text-rose-700' : 'text-slate-900'}`}>{formatINR(c.profit)}</span>
                <span className="text-[10px] text-rose-700 font-semibold">{c.margin}% Margin</span>
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
};
