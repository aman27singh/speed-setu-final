import React from 'react';
import { History, ShieldCheck, FileText } from 'lucide-react';

export const BillingSnapshotCard = ({ snapshot }) => {
  if (!snapshot) return null;

  return (
    <div className="bg-slate-50 border border-slate-200 rounded-xl p-5 shadow-xs space-y-3 text-xs">
      <div className="flex items-center justify-between border-b border-slate-200 pb-2">
        <div className="flex items-center gap-2">
          <History className="w-4 h-4 text-setu-600" />
          <h3 className="font-bold text-slate-900 uppercase tracking-wider text-[11px]">
            Historical Rate Card Billing Snapshot
          </h3>
        </div>
        <span className="inline-flex items-center gap-1 text-[10px] font-bold text-emerald-700 bg-emerald-50 px-2 py-0.5 rounded border border-emerald-200">
          <ShieldCheck className="w-3.5 h-3.5" /> Immutable Historical Rate Lock
        </span>
      </div>

      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 text-slate-700">
        <div>
          <span className="text-[10px] font-bold text-slate-400 uppercase block">Quotation Reference</span>
          <span className="font-mono font-bold text-slate-900">{snapshot.quotationId || 'QT-2026-002'} (Version {snapshot.quotationVersion || 1})</span>
        </div>

        <div>
          <span className="text-[10px] font-bold text-slate-400 uppercase block">Applied Rate & Basis</span>
          <span className="font-mono font-bold text-setu-700">₹{snapshot.appliedRate} ({snapshot.rateBasis || 'Per KG'})</span>
        </div>

        <div>
          <span className="text-[10px] font-bold text-slate-400 uppercase block">Chargeable Weight</span>
          <span className="font-mono font-bold text-slate-900">{snapshot.chargeableWeight} Kg (Actual: {snapshot.actualWeight} Kg)</span>
        </div>

        <div>
          <span className="text-[10px] font-bold text-slate-400 uppercase block">Calculation Timestamp</span>
          <span className="font-mono text-slate-600">{snapshot.calculatedAt || 'N/A'}</span>
        </div>
      </div>
    </div>
  );
};
