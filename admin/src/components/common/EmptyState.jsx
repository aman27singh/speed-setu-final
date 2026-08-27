import React from 'react';
import { PackageSearch } from 'lucide-react';

export const EmptyState = ({
  title = 'No records found',
  description = 'There are no items matching your current filters or selection.',
  icon: Icon = PackageSearch,
  action,
}) => {
  return (
    <div className="py-10 px-4 text-center flex flex-col items-center justify-center">
      <div className="w-12 h-12 rounded-full bg-slate-100 flex items-center justify-center text-slate-400 mb-3">
        <Icon className="w-6 h-6" />
      </div>
      <h3 className="text-sm font-semibold text-slate-800">{title}</h3>
      <p className="text-xs text-slate-500 max-w-sm mt-1 mb-4">{description}</p>
      {action && <div>{action}</div>}
    </div>
  );
};
