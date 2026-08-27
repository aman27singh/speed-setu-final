import React from 'react';
import { CheckCircle2, Clock, MapPin, AlertCircle } from 'lucide-react';

const MILESTONES = [
  'Booked',
  'Picked Up',
  'In Transit',
  'Reached Destination',
  'Out for Delivery',
  'Delivered'
];

export const StatusTimeline = ({ currentStatus = 'Booked', statusHistory = [] }) => {
  const isDelayed = currentStatus === 'Delayed';
  const isCancelled = currentStatus === 'Cancelled';

  // Determine highest completed step index
  const getCurrentIndex = () => {
    if (isCancelled) return -1;
    const norm = currentStatus.toLowerCase();
    if (norm === 'delivered') return 5;
    if (norm === 'out for delivery') return 4;
    if (norm === 'reached destination') return 3;
    if (norm === 'in transit') return 2;
    if (norm === 'picked up') return 1;
    return 0; // Booked
  };

  const currentIndex = getCurrentIndex();

  const getHistoryItemForMilestone = (milestoneName) => {
    return (statusHistory || []).find(
      (h) => h.status.toLowerCase() === milestoneName.toLowerCase()
    );
  };

  return (
    <div className="bg-white border border-slate-200 rounded-xl p-5 shadow-xs space-y-6">
      <div className="flex items-center justify-between border-b border-slate-100 pb-3">
        <div>
          <h3 className="text-xs font-bold text-slate-400 uppercase tracking-wider">
            Shipment Operational Timeline
          </h3>
          <p className="text-xs font-semibold text-slate-900 mt-0.5">
            Current Status: <span className="text-setu-600 font-bold">{currentStatus}</span>
          </p>
        </div>

        {isDelayed && (
          <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded bg-amber-50 text-amber-700 text-xs font-bold border border-amber-200">
            <AlertCircle className="w-3.5 h-3.5" /> Delayed SLA
          </span>
        )}

        {isCancelled && (
          <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded bg-rose-50 text-rose-700 text-xs font-bold border border-rose-200">
            <AlertCircle className="w-3.5 h-3.5" /> Shipment Cancelled
          </span>
        )}
      </div>

      {/* Visual Step Bar */}
      <div className="relative">
        <div className="hidden sm:block absolute top-4 left-6 right-6 h-0.5 bg-slate-200 z-0" />

        <div className="grid grid-cols-2 sm:grid-cols-6 gap-4 relative z-10">
          {MILESTONES.map((m, idx) => {
            const isPassed = idx <= currentIndex;
            const isCurrent = idx === currentIndex;
            const historyObj = getHistoryItemForMilestone(m);

            return (
              <div key={m} className="flex flex-col items-center text-center">
                <div
                  className={`w-8 h-8 rounded-full flex items-center justify-center font-bold text-xs shadow-xs transition-all ${
                    isCurrent
                      ? 'bg-setu-600 text-white ring-4 ring-setu-600/20 font-extrabold scale-110'
                      : isPassed
                      ? 'bg-emerald-600 text-white'
                      : 'bg-slate-100 text-slate-400 border border-slate-300'
                  }`}
                >
                  {isPassed ? <CheckCircle2 className="w-4 h-4" /> : idx + 1}
                </div>

                <span
                  className={`text-xs mt-2 font-bold ${
                    isCurrent ? 'text-setu-600' : isPassed ? 'text-slate-900' : 'text-slate-400'
                  }`}
                >
                  {m}
                </span>

                {historyObj ? (
                  <div className="mt-1 space-y-0.5">
                    <span className="text-[10px] font-mono text-slate-500 block">
                      {historyObj.timestamp}
                    </span>
                    {historyObj.location && (
                      <span className="text-[10px] text-slate-600 block flex items-center justify-center gap-0.5">
                        <MapPin className="w-2.5 h-2.5 text-slate-400" />
                        {historyObj.location}
                      </span>
                    )}
                  </div>
                ) : (
                  <span className="text-[10px] text-slate-300 block mt-1">Pending</span>
                )}
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
};
