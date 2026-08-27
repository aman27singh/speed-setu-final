import React from 'react';
import { PageHeader } from '../components/common/PageHeader';
import { Layers, ArrowRight, CheckCircle2, Clock } from 'lucide-react';

export const PlaceholderPage = ({ title, moduleName, description, upcomingFeatures = [] }) => {
  return (
    <div>
      <PageHeader
        title={title}
        description={description || `Speed Setu ERP System — ${moduleName} Workspace`}
        breadcrumbs={['Speed Setu Admin', moduleName]}
      />

      <div className="bg-white border border-slate-200 rounded-xl p-8 shadow-sm text-center max-w-3xl mx-auto my-8">
        <div className="w-16 h-16 rounded-2xl bg-setu-50 border border-setu-100 text-setu-600 flex items-center justify-center mx-auto mb-4 shadow-xs">
          <Layers className="w-8 h-8" />
        </div>

        <div className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-semibold bg-amber-50 text-amber-700 border border-amber-200 mb-3">
          <Clock className="w-3.5 h-3.5" />
          <span>Coming in Next Module</span>
        </div>

        <h2 className="text-xl font-bold text-slate-900 tracking-tight mb-2">
          {moduleName} Module Foundation Built
        </h2>

        <p className="text-sm text-slate-600 max-w-xl mx-auto mb-6">
          The application shell, navigation routing, security guards, and service architecture for{' '}
          <strong className="text-slate-800">{moduleName}</strong> are fully configured. Full CRUD operations, FastAPI backend models, and MongoDB schemas will connect in subsequent chunks.
        </p>

        {upcomingFeatures.length > 0 && (
          <div className="bg-slate-50 border border-slate-200 rounded-lg p-5 text-left mb-6 max-w-lg mx-auto">
            <h4 className="text-xs font-bold text-slate-700 uppercase tracking-wider mb-3">
              Planned Scope for {moduleName}
            </h4>
            <ul className="space-y-2">
              {upcomingFeatures.map((feat, idx) => (
                <li key={idx} className="flex items-start gap-2 text-xs text-slate-600">
                  <CheckCircle2 className="w-4 h-4 text-setu-600 shrink-0 mt-0.5" />
                  <span>{feat}</span>
                </li>
              ))}
            </ul>
          </div>
        )}

        <div className="flex items-center justify-center gap-3">
          <button
            onClick={() => window.history.back()}
            className="px-4 py-2 text-xs font-semibold text-slate-700 bg-white border border-slate-300 rounded-md hover:bg-slate-50 transition-colors shadow-xs"
          >
            Go Back
          </button>
          <a
            href="/admin/dashboard"
            className="px-4 py-2 text-xs font-semibold text-white bg-setu-600 rounded-md hover:bg-setu-700 transition-colors shadow-sm inline-flex items-center gap-1.5"
          >
            <span>Return to Dashboard</span>
            <ArrowRight className="w-3.5 h-3.5" />
          </a>
        </div>
      </div>
    </div>
  );
};
