import React from 'react';
import { validatePackageCountMatch } from '../../utils/podValidation';
import { CheckCircle2, AlertTriangle } from 'lucide-react';

export const PackageMismatchBanner = ({ shipmentPackages = 0, deliveredPackages = 0 }) => {
  const { matched, message, status } = validatePackageCountMatch(shipmentPackages, deliveredPackages);

  if (matched) {
    return (
      <div className="p-3 bg-emerald-50 border border-emerald-200 rounded-lg flex items-center gap-2 text-emerald-900 text-xs font-bold">
        <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0" />
        <span>{message}</span>
      </div>
    );
  }

  return (
    <div className="p-3 bg-amber-50 border border-amber-300 rounded-lg flex items-center gap-2 text-amber-900 text-xs font-bold">
      <AlertTriangle className="w-4 h-4 text-amber-600 shrink-0" />
      <span>{message}</span>
    </div>
  );
};
