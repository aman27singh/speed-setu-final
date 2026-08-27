import React from 'react';
import clsx from 'clsx';

export const KPICard = ({
  title,
  value,
  subtext,
  icon: Icon,
  trend,
  trendType = 'neutral', // 'positive' | 'negative' | 'neutral'
  variant = 'default', // 'default' | 'accent' | 'warning' | 'danger'
  onClick,
}) => {
  const variantStyles = {
    default: 'border-slate-200 hover:border-slate-300',
    accent: 'border-blue-200 bg-blue-50/20 hover:border-blue-300',
    warning: 'border-amber-200 bg-amber-50/20 hover:border-amber-300',
    danger: 'border-rose-200 bg-rose-50/20 hover:border-rose-300',
  };

  const trendColor = {
    positive: 'text-emerald-600 bg-emerald-50',
    negative: 'text-rose-600 bg-rose-50',
    neutral: 'text-slate-600 bg-slate-100',
  };

  return (
    <div
      onClick={onClick}
      className={clsx(
        'bg-white border rounded-lg p-3.5 sm:p-4 shadow-xs transition-all duration-200 flex flex-col justify-between',
        variantStyles[variant],
        onClick && 'cursor-pointer hover:shadow-sm'
      )}
    >
      <div>
        <div className="flex items-center justify-between gap-2 mb-1.5 sm:mb-2">
          <span className="text-[11px] sm:text-xs font-semibold text-slate-500 uppercase tracking-wider truncate">
            {title}
          </span>
          {Icon && (
            <div className="p-1.5 sm:p-2 rounded-md bg-slate-100 text-setu-600 shrink-0">
              <Icon className="w-3.5 h-3.5 sm:w-4 sm:h-4" />
            </div>
          )}
        </div>
        <div className="text-xl sm:text-2xl font-bold text-slate-900 tracking-tight">
          {value}
        </div>
      </div>

      {(subtext || trend) && (
        <div className="mt-3 pt-2 border-t border-slate-100 flex items-center justify-between text-xs">
          {subtext && <span className="text-slate-500">{subtext}</span>}
          {trend && (
            <span
              className={clsx(
                'px-1.5 py-0.5 rounded font-medium text-[11px]',
                trendColor[trendType]
              )}
            >
              {trend}
            </span>
          )}
        </div>
      )}
    </div>
  );
};
