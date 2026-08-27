import React from 'react';
import clsx from 'clsx';

export const FilterBar = ({ options = [], activeFilter, onSelectFilter }) => {
  return (
    <div className="flex items-center gap-1 overflow-x-auto pb-1 max-w-full">
      {options.map((opt) => {
        const isActive = activeFilter === opt.value;
        return (
          <button
            key={opt.value}
            onClick={() => onSelectFilter(opt.value)}
            className={clsx(
              'px-3 py-1.5 rounded-md text-xs font-medium whitespace-nowrap transition-all duration-150',
              isActive
                ? 'bg-setu-600 text-white shadow-sm'
                : 'bg-white border border-slate-200 text-slate-600 hover:bg-slate-50 hover:text-slate-900'
            )}
          >
            {opt.label}
            {opt.count !== undefined && (
              <span
                className={clsx(
                  'ml-1.5 px-1.5 py-0.2 rounded-full text-[10px]',
                  isActive ? 'bg-white/20 text-white' : 'bg-slate-100 text-slate-500'
                )}
              >
                {opt.count}
              </span>
            )}
          </button>
        );
      })}
    </div>
  );
};
