import React from 'react';
import { AlertTriangle, ShieldAlert, ArrowRight } from 'lucide-react';

export const ManagementAlertsCard = ({ alerts = [], onActionClick }) => {
  if (!alerts || alerts.length === 0) return null;

  return (
    <div className="bg-amber-50/70 border border-amber-300 rounded-xl p-5 shadow-xs space-y-3 text-xs">
      <div className="flex items-center gap-2 border-b border-amber-200 pb-2">
        <ShieldAlert className="w-4.5 h-4.5 text-amber-700 shrink-0" />
        <h3 className="font-bold text-amber-950 uppercase tracking-wider text-[11px]">
          Management Attention Required (Operational & Financial Alerts)
        </h3>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
        {alerts.map((a) => (
          <div
            key={a.id}
            className="p-3 bg-white border border-amber-200 rounded-lg flex items-start justify-between gap-3 shadow-2xs"
          >
            <div className="flex items-start gap-2">
              <AlertTriangle className={`w-4 h-4 mt-0.5 shrink-0 ${
                a.type === 'danger' ? 'text-rose-600' : a.type === 'warning' ? 'text-amber-600' : 'text-blue-600'
              }`} />
              <span className="font-semibold text-slate-900">{a.message}</span>
            </div>

            {onActionClick && (
              <button
                onClick={() => onActionClick(a)}
                className="p-1 text-slate-400 hover:text-setu-600 rounded shrink-0"
              >
                <ArrowRight className="w-4 h-4" />
              </button>
            )}
          </div>
        ))}
      </div>
    </div>
  );
};
