import React, { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { quotationService } from '../services/quotationService';
import { formatDate, formatINR } from '../utils/formatters';
import { StatusBadge } from '../components/common/StatusBadge';
import { PageHeader } from '../components/common/PageHeader';
import { LoadingState } from '../components/common/LoadingState';
import {
  FileSpreadsheet,
  Building2,
  GitBranch,
  Edit,
  Copy,
  Printer,
  Download,
  ArrowLeft,
  ChevronDown,
  ChevronUp,
  X,
  CheckCircle2,
  Layers,
  MapPin,
  Truck,
  Percent,
  Calendar
} from 'lucide-react';

export const QuotationDetailPage = () => {
  const { id } = useParams();
  const navigate = useNavigate();

  const [quotation, setQuotation] = useState(null);
  const [loading, setLoading] = useState(true);
  const [toastMessage, setToastMessage] = useState('');
  const [expandedRuleIndex, setExpandedRuleIndex] = useState(0);

  const fetchQuotation = async () => {
    setLoading(true);
    try {
      const data = await quotationService.getQuotation(id);
      setQuotation(data);
    } catch (err) {
      alert(err.message || 'Failed to load quotation details.');
      navigate('/admin/quotations');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchQuotation();
  }, [id]);

  const handleDuplicate = async () => {
    try {
      const duplicated = await quotationService.duplicateQuotation(id);
      setToastMessage(`Quotation ${quotation.quotationNumber} duplicated into draft ${duplicated.quotationNumber}!`);
      setTimeout(() => navigate(`/admin/quotations/${duplicated.id}`), 1000);
    } catch (err) {
      alert(err.message || 'Failed to duplicate quotation.');
    }
  };

  const handleDeactivate = async () => {
    if (window.confirm(`Are you sure you want to cancel quotation ${quotation.quotationNumber} (v${quotation.version})?`)) {
      try {
        await quotationService.deactivateQuotation(id);
        setToastMessage(`Quotation ${quotation.quotationNumber} has been cancelled.`);
        fetchQuotation();
        setTimeout(() => setToastMessage(''), 4000);
      } catch (err) {
        alert(err.message || 'Failed to cancel quotation.');
      }
    }
  };

  if (loading) {
    return <LoadingState message="Loading Rate Card Agreement profile..." />;
  }

  if (!quotation) return null;

  const totalRoutesCount = (quotation.rateRules || []).length;
  const uniqueModes = Array.from(new Set((quotation.rateRules || []).map((r) => r.mode)));

  return (
    <div className="space-y-6 pb-12">
      {/* Top Header & Actions */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div className="flex items-start sm:items-center gap-3">
          <button
            onClick={() => navigate('/admin/quotations')}
            className="p-2 text-slate-600 bg-white border border-slate-200 rounded-lg hover:bg-slate-50 transition-colors shadow-xs shrink-0 mt-1 sm:mt-0"
            title="Back to Quotations List"
          >
            <ArrowLeft className="w-4 h-4" />
          </button>

          <div className="space-y-1">
            <div className="flex flex-wrap items-center gap-2">
              <span className="text-[11px] font-bold text-slate-400 uppercase tracking-wider">
                Rate Card Agreement
              </span>
              <span className="text-[10px] px-1.5 py-0.2 rounded bg-setu-50 font-mono text-setu-700 font-bold border border-setu-100 whitespace-nowrap">
                Version {quotation.version}
              </span>
            </div>
            <div className="flex flex-wrap items-center gap-2 sm:gap-3">
              <h1 className="text-xl sm:text-2xl font-bold text-slate-900 font-mono tracking-tight">
                {quotation.quotationNumber}
              </h1>
              <span
                onClick={() => navigate(`/admin/companies/${quotation.companyId}`)}
                className="text-xs sm:text-sm font-semibold text-slate-700 hover:text-setu-600 cursor-pointer truncate max-w-[180px] sm:max-w-xs"
              >
                {quotation.companyName}
              </span>
              <StatusBadge status={quotation.status} />
            </div>
          </div>
        </div>

        {/* Actions Bar */}
        <div className="flex items-center gap-2 flex-wrap w-full sm:w-auto">
          <button
            onClick={() => navigate(`/admin/quotations/${quotation.id}/new-version`)}
            className="inline-flex items-center justify-center gap-1.5 px-3 py-1.5 text-xs font-bold text-emerald-700 bg-emerald-50 border border-emerald-200 rounded-md hover:bg-emerald-600 hover:text-white transition-colors flex-1 sm:flex-initial"
          >
            <GitBranch className="w-3.5 h-3.5" />
            <span>New Version (V+1)</span>
          </button>

          <button
            onClick={() => navigate(`/admin/quotations/${quotation.id}/edit`)}
            className="inline-flex items-center justify-center gap-1.5 px-3 py-1.5 text-xs font-semibold text-slate-700 bg-white border border-slate-300 rounded-md hover:bg-slate-50 transition-colors flex-1 sm:flex-initial"
          >
            <Edit className="w-3.5 h-3.5" />
            <span>Edit</span>
          </button>

          <button
            onClick={handleDuplicate}
            className="inline-flex items-center justify-center gap-1.5 px-3 py-1.5 text-xs font-semibold text-slate-700 bg-white border border-slate-300 rounded-md hover:bg-slate-50 transition-colors flex-1 sm:flex-initial"
          >
            <Copy className="w-3.5 h-3.5" />
            <span>Duplicate</span>
          </button>

          <button
            onClick={() => window.print()}
            className="inline-flex items-center justify-center gap-1.5 px-3 py-1.5 text-xs font-semibold text-slate-700 bg-white border border-slate-300 rounded-md hover:bg-slate-50 transition-colors flex-1 sm:flex-initial"
          >
            <Printer className="w-3.5 h-3.5" />
            <span>Print</span>
          </button>

          {quotation.status === 'Active' && (
            <button
              onClick={handleDeactivate}
              className="inline-flex items-center justify-center gap-1.5 px-3 py-1.5 text-xs font-semibold text-rose-700 bg-rose-50 border border-rose-200 rounded-md hover:bg-rose-600 hover:text-white transition-colors flex-1 sm:flex-initial"
            >
              <span>Cancel</span>
            </button>
          )}
        </div>
      </div>

      {/* Toast Notification */}
      {toastMessage && (
        <div className="p-3 bg-slate-900 text-white rounded-lg text-xs font-semibold flex items-center justify-between shadow-lg animate-fade-in">
          <span>{toastMessage}</span>
          <button onClick={() => setToastMessage('')} className="text-slate-400 hover:text-white font-bold">
            <X className="w-4 h-4" />
          </button>
        </div>
      )}

      {/* SUMMARY METRICS STRIP */}
      <div className="bg-white border border-slate-200 rounded-xl p-3.5 sm:p-4 shadow-xs grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-2.5 sm:gap-4 font-sans">
        <div>
          <span className="text-[10px] sm:text-[11px] font-bold text-slate-400 uppercase tracking-wider block">Company Code</span>
          <span className="text-xs font-bold text-slate-900 font-mono">{quotation.companyCode}</span>
        </div>

        <div>
          <span className="text-[10px] sm:text-[11px] font-bold text-slate-400 uppercase tracking-wider block">Agreement Version</span>
          <span className="text-xs font-bold text-setu-600 font-mono">Version {quotation.version}</span>
        </div>

        <div>
          <span className="text-[10px] sm:text-[11px] font-bold text-slate-400 uppercase tracking-wider block">Effective From</span>
          <span className="text-xs font-bold text-slate-900 font-mono">{formatDate(quotation.effectiveFrom)}</span>
        </div>

        <div>
          <span className="text-[10px] sm:text-[11px] font-bold text-slate-400 uppercase tracking-wider block">Effective Until</span>
          <span className="text-xs font-bold text-slate-900 font-mono">
            {quotation.effectiveUntil ? formatDate(quotation.effectiveUntil) : 'Ongoing'}
          </span>
        </div>

        <div>
          <span className="text-[10px] sm:text-[11px] font-bold text-slate-400 uppercase tracking-wider block">Total Routes</span>
          <span className="text-xs font-bold text-slate-900">{totalRoutesCount} Lanes</span>
        </div>

        <div>
          <span className="text-[10px] sm:text-[11px] font-bold text-slate-400 uppercase tracking-wider block">Modes Included</span>
          <span className="text-xs font-bold text-slate-900">{uniqueModes.join(', ')}</span>
        </div>
      </div>

      {/* RATE RULES MATRIX */}
      <div className="space-y-4">
        <div className="flex items-center justify-between">
          <div>
            <h3 className="text-sm font-bold text-slate-900">Agreed Lane Rate Rules ({totalRoutesCount})</h3>
            <p className="text-xs text-slate-500">Route-wise pricing matrix, weight slabs, additional charges and GST configuration</p>
          </div>
        </div>

        {quotation.rateRules.map((rule, ruleIdx) => {
          const isExpanded = expandedRuleIndex === ruleIdx;
          return (
            <div
              key={ruleIdx}
              className="bg-white border border-slate-200 rounded-xl overflow-hidden shadow-xs transition-all"
            >
              {/* Card Header */}
              <div
                onClick={() => setExpandedRuleIndex(isExpanded ? -1 : ruleIdx)}
                className="p-3.5 sm:p-4 bg-slate-50 border-b border-slate-200 flex flex-col sm:flex-row sm:items-center justify-between gap-2 cursor-pointer hover:bg-slate-100/80 transition-colors"
              >
                <div className="flex items-center gap-3">
                  <div className="w-8 h-8 rounded-lg bg-setu-600 text-white font-bold text-xs flex items-center justify-center shadow-xs shrink-0">
                    R{ruleIdx + 1}
                  </div>

                  <div>
                    <div className="flex flex-wrap items-center gap-2">
                      <span className="font-bold text-slate-900 text-sm sm:text-base">
                        {rule.origin} → {rule.destination}
                      </span>
                      <span className="px-2 py-0.5 rounded text-[10px] sm:text-xs font-bold bg-setu-50 text-setu-700 border border-setu-100">
                        {rule.mode}
                      </span>
                    </div>

                    <div className="flex items-center gap-3 text-xs text-slate-600 mt-0.5 flex-wrap">
                      <span>Base Freight: <strong className="text-slate-900 font-mono">₹{rule.freightRate} / {rule.rateBasis}</strong></span>
                      <span>Min Weight: <strong className="text-slate-900 font-mono">{rule.minimumChargeableWeight} kg</strong></span>
                    </div>
                  </div>
                </div>

                <div className="flex items-center gap-2">
                  <span className="text-xs font-semibold text-slate-500">
                    {isExpanded ? 'Hide Details' : 'View Full Rule Details'}
                  </span>
                  {isExpanded ? <ChevronUp className="w-5 h-5 text-slate-400" /> : <ChevronDown className="w-5 h-5 text-slate-400" />}
                </div>
              </div>

              {/* Card Details */}
              {isExpanded && (
                <div className="p-5 space-y-6">
                  {/* Freight Specs */}
                  <div className="grid grid-cols-2 sm:grid-cols-4 gap-4 text-xs bg-slate-50 p-4 rounded-lg border border-slate-200">
                    <div>
                      <span className="text-slate-400 block text-[11px]">Origin Hub</span>
                      <span className="font-bold text-slate-900">{rule.origin}</span>
                    </div>
                    <div>
                      <span className="text-slate-400 block text-[11px]">Destination Hub</span>
                      <span className="font-bold text-slate-900">{rule.destination}</span>
                    </div>
                    <div>
                      <span className="text-slate-400 block text-[11px]">Freight Rate & Basis</span>
                      <span className="font-bold text-setu-600 text-sm font-mono">₹{rule.freightRate} / {rule.rateBasis}</span>
                    </div>
                    <div>
                      <span className="text-slate-400 block text-[11px]">Minimum Weight</span>
                      <span className="font-bold text-slate-900 font-mono">{rule.minimumChargeableWeight} kg</span>
                    </div>
                  </div>

                  {/* Agreed Additional Charges */}
                  <div className="space-y-2">
                    <h4 className="text-xs font-bold text-slate-700 uppercase tracking-wider">
                      Agreed Additional Charges
                    </h4>
                    {rule.additionalCharges && rule.additionalCharges.length > 0 ? (
                      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 text-xs">

                        {rule.additionalCharges.map((ch, idx) => (
                          <div key={idx} className="p-3 bg-white border border-slate-200 rounded-lg flex items-center justify-between">
                            <div>
                              <span className="font-bold text-slate-900 block">{ch.name}</span>
                              <span className="text-[10px] text-slate-500">{ch.basis}</span>
                            </div>
                            <div className="text-right">
                              <span className="font-bold text-slate-900 font-mono text-sm">{formatINR(ch.amount)}</span>
                              {ch.taxable && <span className="text-[10px] text-emerald-600 block font-semibold">+ Taxable</span>}
                            </div>
                          </div>
                        ))}
                      </div>
                    ) : (
                      <p className="text-xs text-slate-400 italic">No additional charges configured.</p>
                    )}
                  </div>

                  {/* Tax Configuration */}
                  <div className="p-3 bg-blue-50/60 border border-blue-200 rounded-lg text-xs flex items-center justify-between">
                    <div>
                      <span className="font-bold text-slate-900 block">GST / Tax Configuration:</span>
                      <span className="text-slate-600">{rule.taxConfiguration?.notes || 'Standard GST'}</span>
                    </div>
                    <span className="px-3 py-1 bg-setu-600 text-white font-bold text-xs rounded">
                      GST Rate: {rule.taxConfiguration?.gstRate || 12}%
                    </span>
                  </div>
                </div>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
};
