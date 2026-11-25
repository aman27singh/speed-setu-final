import React, { useState, useEffect, useCallback } from "react";
import { useParams, useNavigate } from "react-router-dom";
import { billingService } from "../services/billingService";
import { formatINR } from "../utils/formatters";
import { StatusBadge } from "../components/common/StatusBadge";
import { LoadingState } from "../components/common/LoadingState";
import { ErrorState } from "../components/common/ErrorState";
import { InvoiceEditor } from "../components/billing/InvoiceEditor";
import { ArrowLeft } from "lucide-react";

export const InvoiceEditPage = () => {
  const { id: paramId, invoiceId } = useParams();
  const targetId = paramId || invoiceId;
  const navigate = useNavigate();

  const [invoice, setInvoice] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  const isInvalidParam =
    !targetId ||
    targetId === "undefined" ||
    targetId === "null" ||
    !String(targetId).trim();

  const fetchInvoiceData = useCallback(async () => {
    if (isInvalidParam) {
      setError("Invalid or missing invoice identifier.");
      setLoading(false);
      return;
    }

    setLoading(true);
    setError(null);
    try {
      const data = await billingService.getInvoice(String(targetId).trim());
      if (!data) {
        setError(`Invoice '${targetId}' could not be found.`);
      } else {
        setInvoice(data);
      }
    } catch (err) {
      setError(err.message || `Failed to load invoice '${targetId}'.`);
    } finally {
      setLoading(false);
    }
  }, [targetId, isInvalidParam]);

  useEffect(() => {
    fetchInvoiceData();
  }, [fetchInvoiceData]);

  const getDetailRoute = (inv) => {
    const detailId = inv?.id || inv?.invoiceNumber || inv?._id || targetId;
    return `/admin/billing/invoices/${encodeURIComponent(detailId)}`;
  };

  const handleSaveInvoiceEdits = async (updatedInvoiceData) => {
    const updateKey = invoice._id || invoice.id || invoice.invoiceNumber;
    const saved = await billingService.updateInvoice(updateKey, updatedInvoiceData);
    navigate(getDetailRoute(saved), {
      replace: true,
      state: {
        toastMessage:
          "Invoice Updated Successfully! All invoice details have been saved.",
      },
    });
    return saved;
  };

  const handleCancel = () => {
    navigate(getDetailRoute(invoice));
  };

  if (loading) {
    return <LoadingState message="Loading Invoice for Editing..." />;
  }

  if (error || !invoice) {
    return (
      <div className="space-y-4 max-w-2xl mx-auto py-8">
        <ErrorState
          title="Unable to Open Invoice Editor"
          message={
            error ||
            "The requested invoice could not be found or the invoice ID is invalid."
          }
          onRetry={!isInvalidParam ? fetchInvoiceData : undefined}
        />
        <div className="flex justify-center">
          <button
            type="button"
            onClick={() => navigate("/admin/billing")}
            className="inline-flex items-center gap-2 px-4 py-2 text-xs font-bold text-slate-700 bg-white border border-slate-300 rounded-lg hover:bg-slate-50 transition-colors shadow-xs"
          >
            <ArrowLeft className="w-4 h-4" />
            <span>Back to Billing & Invoices</span>
          </button>
        </div>
      </div>
    );
  }

  const grandTotal = invoice.grandTotal || invoice.totalAmount || 0;
  const paidAmount = invoice.paidAmount || 0;
  const balanceDue =
    invoice.balanceAmount ??
    invoice.balanceDue ??
    Math.max(0, grandTotal - paidAmount);

  return (
    <div className="space-y-5 pb-12">
      {/* Top Breadcrumb & Context Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 no-print">
        <div className="flex items-center gap-3">
          <button
            type="button"
            onClick={handleCancel}
            className="p-2 text-slate-600 bg-white border border-slate-200 rounded-lg hover:bg-slate-50 transition-colors shadow-xs"
            title="Back to Invoice Details"
          >
            <ArrowLeft className="w-4 h-4" />
          </button>

          <div>
            <div className="flex items-center gap-2 flex-wrap">
              <span className="text-xs font-bold text-slate-400 uppercase tracking-wider">
                Edit GST Freight Invoice
              </span>
              <StatusBadge status={invoice.status} />
              <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-amber-50 text-amber-700 border border-amber-300">
                Editing Mode Active
              </span>
            </div>

            <h1 className="text-2xl font-bold text-slate-900 font-mono tracking-tight flex items-center gap-2 flex-wrap">
              <span>{invoice.invoiceNumber}</span>
              <span className="text-sm font-semibold text-slate-600">
                — {invoice.companyName || invoice.billToDetails?.companyName}
              </span>
            </h1>
          </div>
        </div>

        <div className="flex items-center gap-4 bg-white border border-slate-200 rounded-lg px-3.5 py-2 text-xs shadow-xs">
          <div>
            <span className="text-[10px] font-bold text-slate-400 uppercase block">
              Paid
            </span>
            <span className="font-mono font-bold text-emerald-700">
              {formatINR(paidAmount)}
            </span>
          </div>
          <div className="h-6 w-px bg-slate-200" />
          <div>
            <span className="text-[10px] font-bold text-slate-400 uppercase block">
              Balance Due
            </span>
            <span className="font-mono font-bold text-slate-900">
              {formatINR(balanceDue)}
            </span>
          </div>
        </div>
      </div>

      <InvoiceEditor
        key={invoice._id || invoice.id || invoice.invoiceNumber}
        initialInvoice={invoice}
        onSave={handleSaveInvoiceEdits}
        onCancel={handleCancel}
      />
    </div>
  );
};
