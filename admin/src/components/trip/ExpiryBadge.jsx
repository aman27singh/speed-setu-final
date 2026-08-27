import React from 'react';
import { getExpiryStatus } from '../../utils/expiryHelpers';
import { AlertCircle, CheckCircle2, Clock } from 'lucide-react';

export const ExpiryBadge = ({ dateString }) => {
  const { status, label, color } = getExpiryStatus(dateString);

  const styleMap = {
    green: 'bg-emerald-50 text-emerald-700 border-emerald-200',
    yellow: 'bg-amber-50 text-amber-800 border-amber-300 font-bold animate-pulse',
    red: 'bg-rose-50 text-rose-700 border-rose-200 font-bold',
    gray: 'bg-slate-100 text-slate-500 border-slate-200'
  };

  return (
    <span
      className={`inline-flex items-center gap-1 px-2 py-0.5 rounded text-[10px] border font-mono ${
        styleMap[color] || styleMap.green
      }`}
    >
      {color === 'green' && <CheckCircle2 className="w-3 h-3 text-emerald-600" />}
      {color === 'yellow' && <Clock className="w-3 h-3 text-amber-600" />}
      {color === 'red' && <AlertCircle className="w-3 h-3 text-rose-600" />}
      <span>{label}</span>
    </span>
  );
};
