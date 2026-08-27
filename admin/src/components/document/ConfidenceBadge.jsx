import React from 'react';
import { getConfidenceLevel } from '../../utils/extractionValidation';

export const ConfidenceBadge = ({ score }) => {
  const { level, label, color } = getConfidenceLevel(score);

  const styleMap = {
    green: 'bg-emerald-50 text-emerald-700 border-emerald-200',
    yellow: 'bg-amber-50 text-amber-700 border-amber-200',
    red: 'bg-rose-50 text-rose-700 border-rose-200 shadow-xs animate-pulse'
  };

  const dotMap = {
    green: 'bg-emerald-500',
    yellow: 'bg-amber-500',
    red: 'bg-rose-500'
  };

  return (
    <span
      className={`inline-flex items-center gap-1.5 px-2 py-0.5 rounded text-[10px] font-bold border font-mono ${
        styleMap[color] || styleMap.green
      }`}
    >
      <span className={`w-1.5 h-1.5 rounded-full ${dotMap[color] || dotMap.green}`} />
      <span>{label}</span>
    </span>
  );
};
