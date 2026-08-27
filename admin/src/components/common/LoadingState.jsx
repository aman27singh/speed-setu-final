import React from 'react';
import { Loader2 } from 'lucide-react';

export const LoadingState = ({ message = 'Loading Speed Setu data...' }) => {
  return (
    <div className="min-h-[250px] flex flex-col items-center justify-center p-8 text-center">
      <Loader2 className="w-8 h-8 text-setu-600 animate-spin mb-3" />
      <p className="text-sm font-medium text-slate-600">{message}</p>
    </div>
  );
};
