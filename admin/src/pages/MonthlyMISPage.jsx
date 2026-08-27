import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { reportingService } from '../services/reportingService';
import { formatINR } from '../utils/formatters';
import { PageHeader } from '../components/common/PageHeader';
import { LoadingState } from '../components/common/LoadingState';
import { ErrorState } from '../components/common/ErrorState';
import {
  FileText,
  Download,
  ArrowUpRight,
  ArrowDownRight,
  ArrowLeft,
  Printer
} from 'lucide-react';

export const MonthlyMISPage = () => {
  const navigate = useNavigate();
  const [misData, setMisData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  const fetchMISReport = async () => {
    setLoading(true);
    setError(null);
    try {
      const data = await reportingService.getMonthlyMIS();
      setMisData(data);
    } catch (err) {
      setError(err.message || 'Failed to load monthly MIS executive report.');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchMISReport();
  }, []);

  const handleExportCSV = () => {
    alert('Exporting Monthly MIS Executive Report to CSV file...');
  };

  const handleExportPDF = () => {
    window.print();
  };

  if (loading) {
    return <LoadingState message="Generating Executive Monthly MIS Report..." />;
  }

  if (error) {
    return <ErrorState message={error} onRetry={fetchMISReport} />;
  }

  return (
    <div className="space-y-6 max-w-5xl mx-auto pb-12">
      <PageHeader
        title="Monthly Executive MIS Report"
        description="Consolidated monthly operational & financial summary with Month-over-Month (% Growth) comparison."
        breadcrumbs={['Speed Setu Admin', 'Reports & MIS', 'Monthly MIS']}
        actions={
          <div className="flex items-center gap-2">
            <button
              onClick={() => navigate('/admin/reports')}
              className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold text-slate-700 bg-white border border-slate-300 rounded-md hover:bg-slate-50 transition-colors"
            >
              <ArrowLeft className="w-4 h-4" />
              <span>Back to Overview</span>
            </button>

            <button
              onClick={handleExportCSV}
              className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-bold text-slate-700 bg-white border border-slate-300 hover:bg-slate-50 rounded-md transition-colors shadow-xs"
            >
              <Download className="w-4 h-4 text-setu-600" />
              <span>Export CSV</span>
            </button>

            <button
              onClick={handleExportPDF}
              className="inline-flex items-center gap-1.5 px-4 py-2 text-xs font-bold text-white bg-setu-600 hover:bg-setu-700 rounded-md shadow-sm transition-colors"
            >
              <Printer className="w-4 h-4" />
              <span>Print / Save PDF</span>
            </button>
          </div>
        }
      />

      {/* EXECUTIVE MONTHLY MIS TABLE CARD */}
      <div className="bg-white border border-slate-200 rounded-xl p-6 shadow-xs space-y-4 text-xs">
        <div className="flex items-center justify-between border-b border-slate-100 pb-3">
          <div>
            <h2 className="text-base font-bold text-slate-900">
              Speed Setu Logistics — Executive MIS Report
            </h2>
            <p className="text-xs text-slate-500 font-mono">
              Comparative Performance: {misData.currentMonth} vs {misData.previousMonth}
            </p>
          </div>

          <span className="px-3 py-1 bg-setu-50 text-setu-700 font-bold font-mono rounded border border-setu-200 text-xs">
            Status: AUDITED
          </span>
        </div>

        <div className="border border-slate-200 rounded-lg overflow-hidden">
          <table className="w-full text-left border-collapse">
            <thead className="bg-slate-100 text-slate-700 uppercase font-bold text-[11px] border-b border-slate-200">
              <tr>
                <th className="p-3">Key Performance Indicator (KPI)</th>
                <th className="p-3 text-right">{misData.currentMonth}</th>
                <th className="p-3 text-right">{misData.previousMonth}</th>
                <th className="p-3 text-right">MoM Growth (%)</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100 font-medium text-xs">
              {(misData.metrics || []).map((m) => {
                const isCurrency = typeof m.current === 'number' && m.current > 100 && m.metric !== 'Shipments Booked';
                const isPositive = m.growth > 0;

                return (
                  <tr key={m.metric} className="hover:bg-slate-50">
                    <td className="p-3 font-bold text-slate-900">{m.metric}</td>
                    <td className="p-3 text-right font-mono font-bold text-slate-900">
                      {isCurrency ? formatINR(m.current) : m.current}
                    </td>
                    <td className="p-3 text-right font-mono text-slate-600">
                      {isCurrency ? formatINR(m.previous) : m.previous}
                    </td>
                    <td className="p-3 text-right font-mono">
                      <span className={`inline-flex items-center gap-1 font-bold ${
                        isPositive ? 'text-emerald-700' : 'text-rose-700'
                      }`}>
                        {isPositive ? <ArrowUpRight className="w-3.5 h-3.5" /> : <ArrowDownRight className="w-3.5 h-3.5" />}
                        {isPositive ? `+${m.growth}%` : `${m.growth}%`}
                      </span>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
};
