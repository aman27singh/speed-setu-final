import React from 'react';
import { ChevronRight } from 'lucide-react';

export const PageHeader = ({ title, description, breadcrumbs = [], actions }) => {
  return (
    <div className="mb-4 sm:mb-6 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 sm:gap-4 border-b border-slate-200/80 pb-4 sm:pb-5">
      <div>
        {breadcrumbs.length > 0 && (
          <nav className="flex items-center gap-1.5 text-[11px] sm:text-xs text-slate-500 mb-1">
            {breadcrumbs.map((crumb, idx) => (
              <React.Fragment key={idx}>
                {idx > 0 && <ChevronRight className="w-3 h-3 text-slate-400" />}
                <span className={idx === breadcrumbs.length - 1 ? 'font-medium text-slate-700' : ''}>
                  {crumb}
                </span>
              </React.Fragment>
            ))}
          </nav>
        )}
        <h1 className="text-xl sm:text-2xl font-bold text-slate-900 tracking-tight">{title}</h1>
        {description && <p className="text-xs sm:text-sm text-slate-500 mt-0.5 sm:mt-1">{description}</p>}
      </div>

      {actions && <div className="flex flex-wrap items-center gap-2 sm:gap-3 shrink-0">{actions}</div>}
    </div>
  );
};
