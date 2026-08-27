import React from 'react';
import { Modal } from '../common/Modal';
import { formatINR } from '../../utils/formatters';
import { StatusBadge } from '../common/StatusBadge';
import { DollarSign, AlertTriangle } from 'lucide-react';

export const CostBreakdownModal = ({ isOpen, onClose, shipmentProfitability }) => {
  if (!shipmentProfitability) return null;

  const sp = shipmentProfitability;
  const isLoss = sp.profit < 0;

  return (
    <Modal
      isOpen={isOpen}
      onClose={onClose}
      title={`Shipment Profitability & Cost Breakdown — ${sp.cnNumber}`}
      footer={
        <button
          type="button"
          onClick={onClose}
          className="px-4 py-1.5 text-xs font-bold text-slate-700 bg-white border border-slate-300 rounded hover:bg-slate-50"
        >
          Close
        </button>
      }
    >
      <div className="space-y-4 text-xs">
        {/* LOSS WARNING CALLOUT */}
        {isLoss && (
          <div className="p-3 bg-rose-50 border border-rose-300 rounded-lg text-rose-900 font-bold flex items-center gap-2">
            <AlertTriangle className="w-4 h-4 text-rose-600 shrink-0" />
            <span>⚠ Loss-Making Shipment: Operational costs exceed billed customer revenue by {formatINR(Math.abs(sp.profit))}!</span>
          </div>
        )}

        <div className="p-3 bg-slate-50 border border-slate-200 rounded-lg grid grid-cols-3 gap-2 text-center">
          <div>
            <span className="text-[10px] font-bold text-slate-400 uppercase block">Company Customer</span>
            <strong className="text-slate-900">{sp.companyName}</strong>
          </div>
          <div>
            <span className="text-[10px] font-bold text-slate-400 uppercase block">Route</span>
            <strong className="text-slate-900 font-mono">{sp.origin} → {sp.destination}</strong>
          </div>
          <div>
            <span className="text-[10px] font-bold text-slate-400 uppercase block">Status</span>
            <StatusBadge status={sp.status} />
          </div>
        </div>

        {/* FINANCIAL SUMMARY TABLE */}
        <div className="border border-slate-200 rounded-lg p-4 bg-white space-y-2 font-mono">
          <div className="flex justify-between border-b border-slate-100 pb-1.5 font-bold">
            <span className="text-slate-700 font-sans uppercase text-[11px]">Billed Freight Revenue</span>
            <span className="text-slate-900 text-sm">{formatINR(sp.revenue)}</span>
          </div>

          <div className="space-y-1.5 pt-1">
            <span className="text-[10px] font-bold text-slate-400 uppercase font-sans block">Costs & Expenses</span>

            <div className="flex justify-between text-slate-600">
              <span className="font-sans">Direct Pickup / Delivery Expenses:</span>
              <span>{formatINR(sp.directCost)}</span>
            </div>

            <div className="flex justify-between text-slate-600">
              <span className="font-sans">Allocated Linehaul Trip Transporter Cost:</span>
              <span>{formatINR(sp.allocatedTripCost)}</span>
            </div>

            <div className="flex justify-between font-bold pt-1 border-t border-slate-100 text-slate-900">
              <span className="font-sans">Total Cost Burden:</span>
              <span>{formatINR(sp.totalCost)}</span>
            </div>
          </div>

          <div className={`flex justify-between items-center pt-3 border-t border-slate-200 font-bold text-sm ${
            isLoss ? 'text-rose-700' : 'text-emerald-700'
          }`}>
            <span className="font-sans uppercase">Gross Profit (Margin: {sp.margin}%)</span>
            <span>{formatINR(sp.profit)}</span>
          </div>
        </div>
      </div>
    </Modal>
  );
};
