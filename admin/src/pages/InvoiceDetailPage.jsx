import React, { useState, useEffect } from "react";
import {
  useParams,
  useNavigate,
  useSearchParams,
  useLocation,
} from "react-router-dom";
import { billingService } from "../services/billingService";
import { apiRequest } from "../services/apiClient";
import { formatDate, formatINR } from "../utils/formatters";
import { StatusBadge } from "../components/common/StatusBadge";
import { LoadingState } from "../components/common/LoadingState";
import { ErrorState } from "../components/common/ErrorState";
import { BillingSnapshotCard } from "../components/billing/BillingSnapshotCard";
import { InvoicePrintView } from "../components/billing/InvoicePrintView";
import { InvoiceEditor } from "../components/billing/InvoiceEditor";
import { Modal } from "../components/common/Modal";
import {
  FileText,
  Printer,
  Download,
  Send,
  XCircle,
  Trash2,
  ArrowLeft,
  History,
  CheckCircle2,
  AlertCircle,
  DollarSign,
  Edit3,
  RotateCcw,
} from "lucide-react";

export const InvoiceDetailPage = () => {
  const { id: paramId, invoiceId } = useParams();
  const id = paramId || invoiceId;
  const navigate = useNavigate();
  const location = useLocation();
  const [searchParams] = useSearchParams();

  const [invoice, setInvoice] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [activeTab, setActiveTab] = useState("preview"); // 'preview' | 'snapshot' | 'history'
  const [isEditing, setIsEditing] = useState(false);

  // Cancellation Modal State
  const [showCancelModal, setShowCancelModal] = useState(false);
  const [cancellationReason, setCancellationReason] = useState("");
  const [cancelling, setCancelling] = useState(false);

  // Payment Recording Modal State
  const [showRecordModal, setShowRecordModal] = useState(false);
  const [paymentAmount, setPaymentAmount] = useState("");
  const [paymentMode, setPaymentMode] = useState("NEFT/RTGS");
  const [referenceNumber, setReferenceNumber] = useState("");
  const [paymentRemarks, setPaymentRemarks] = useState("");
  const [recordingPayment, setRecordingPayment] = useState(false);

  const [toastMessage, setToastMessage] = useState("");

  useEffect(() => {
    if (location.state?.toastMessage) {
      setToastMessage(location.state.toastMessage);
      navigate(location.pathname + location.search, { replace: true, state: {} });
      const timer = setTimeout(() => setToastMessage(""), 5000);
      return () => clearTimeout(timer);
    }
  }, [location.state, location.pathname, location.search, navigate]);

  const fetchInvoiceData = async () => {
    if (!id || id === "undefined" || id === "null" || !String(id).trim()) {
      setError("Invalid or missing invoice identifier.");
      setLoading(false);
      return;
    }

    setLoading(true);
    setError(null);
    try {
      const data = await billingService.getInvoice(id);
      setInvoice(data);
      if (data) {
        const bal =
          data.balanceAmount ??
          data.balanceDue ??
          data.grandTotal ??
          data.totalAmount ??
          0;
        setPaymentAmount(String(bal > 0 ? bal : ""));
      }
    } catch (err) {
      setError(err.message || "Failed to load invoice profile.");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (searchParams.get("edit") === "true" && id) {
      navigate(`/admin/billing/invoices/${encodeURIComponent(id)}/edit`, {
        replace: true,
      });
      return;
    }
    fetchInvoiceData();
  }, [id, searchParams]);

  const handleCancelSubmit = async (e) => {
    e.preventDefault();
    if (!cancellationReason.trim()) {
      alert("Please specify a cancellation reason.");
      return;
    }

    setCancelling(true);
    try {
      await billingService.cancelInvoice(
        invoice.id || invoice.invoiceNumber,
        cancellationReason,
      );
      setToastMessage(`Invoice ${invoice.invoiceNumber} cancelled.`);
      setShowCancelModal(false);
      fetchInvoiceData();
      setTimeout(() => setToastMessage(""), 4000);
    } catch (err) {
      alert(err.message || "Failed to cancel invoice.");
    } finally {
      setCancelling(false);
    }
  };

  const handleRecordPaymentSubmit = async (e) => {
    e.preventDefault();
    const amountNum = parseFloat(paymentAmount);
    if (isNaN(amountNum) || amountNum <= 0) {
      alert("Please enter a valid positive payment amount.");
      return;
    }

    setRecordingPayment(true);
    try {
      await apiRequest("/payments", {
        method: "POST",
        body: JSON.stringify({
          invoiceNumber: invoice.invoiceNumber,
          invoiceId: invoice.id || invoice._id || invoice.invoiceNumber,
          companyId: invoice.companyId || invoice.billToDetails?.companyId,
          companyName:
            invoice.companyName || invoice.billToDetails?.companyName,
          amount: amountNum,
          paymentMode,
          referenceNumber:
            referenceNumber.trim() || `REF-${Date.now().toString().slice(-6)}`,
          remarks: paymentRemarks.trim() || "Recorded from Invoice Details",
        }),
      });

      setToastMessage(
        `Payment of ${formatINR(amountNum)} recorded for ${invoice.invoiceNumber}.`,
      );
      setShowRecordModal(false);
      setPaymentRemarks("");
      setReferenceNumber("");
      fetchInvoiceData();
      setTimeout(() => setToastMessage(""), 4000);
    } catch (err) {
      alert(err.message || "Failed to record payment.");
    } finally {
      setRecordingPayment(false);
    }
  };

  const handleSaveInvoiceEdits = async (updatedInvoiceData) => {
    try {
      const saved = await billingService.updateInvoice(
        invoice.id || invoice.invoiceNumber,
        updatedInvoiceData,
      );
      setInvoice(saved);
      setIsEditing(false);
      setToastMessage(
        "Invoice Updated Successfully! All invoice details have been saved.",
      );

      // If the invoice number changed during editing, update URL to match the new invoice number
      if (saved.invoiceNumber && saved.invoiceNumber !== id) {
        navigate(
          `/admin/billing/invoices/${encodeURIComponent(saved.invoiceNumber)}`,
          { replace: true },
        );
      } else {
        await fetchInvoiceData();
      }

      setTimeout(() => setToastMessage(""), 5000);
      return saved;
    } catch (err) {
      throw err;
    }
  };

  if (loading) {
    return <LoadingState message="Loading Freight Invoice Profile..." />;
  }

  if (error || !invoice) {
    return (
      <div className="space-y-4 max-w-2xl mx-auto py-8">
        <ErrorState
          title="Unable to Load Invoice"
          message={
            error ||
            "The requested invoice could not be found or the invoice ID is invalid."
          }
          onRetry={
            id && id !== "undefined" && id !== "null"
              ? fetchInvoiceData
              : undefined
          }
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

  return (
    <div className="space-y-6 pb-12">
      {/* Top Header & Actions - Hidden during print */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 no-print">
        <div className="flex items-center gap-3">
          <button
            onClick={() => navigate("/admin/billing")}
            className="p-2 text-slate-600 bg-white border border-slate-200 rounded-lg hover:bg-slate-50 transition-colors shadow-xs"
          >
            <ArrowLeft className="w-4 h-4" />
          </button>

          <div>
            <div className="flex items-center gap-2">
              <span className="text-xs font-bold text-slate-400 uppercase tracking-wider">
                GST Freight Invoice
              </span>
              <StatusBadge status={invoice.status} />
              {isEditing && (
                <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-amber-50 text-amber-700 border border-amber-300">
                  Editing Mode Active
                </span>
              )}
            </div>

            <h1 className="text-2xl font-bold text-slate-900 font-mono tracking-tight flex items-center gap-2">
              <span>{invoice.invoiceNumber}</span>
              <span className="text-sm font-semibold text-slate-600">
                — {invoice.companyName || invoice.billToDetails?.companyName}
              </span>
            </h1>
          </div>
        </div>

        <div className="flex items-center gap-2 flex-wrap no-print">
          {/* PROMINENT EDIT INVOICE BUTTON - NAVIGATES TO DEDICATED EDIT ROUTE */}
          <button
            onClick={() =>
              navigate(
                `/admin/billing/invoices/${encodeURIComponent(invoice._id || invoice.id || invoice.invoiceNumber)}/edit`,
              )
            }
            className="inline-flex items-center gap-1.5 px-4 py-2 text-xs font-bold rounded-lg shadow-sm transition-colors bg-indigo-600 hover:bg-indigo-700 text-white shadow-indigo-200"
            title="Edit Full Invoice Form"
          >
            <Edit3 className="w-4 h-4" />
            <span>Edit Invoice</span>
          </button>

          {!isEditing && (
            <>
              <button
                onClick={() => window.print()}
                className="inline-flex items-center gap-1.5 px-3.5 py-2 text-xs font-bold text-white bg-setu-600 hover:bg-setu-700 rounded-lg shadow-xs transition-colors"
              >
                <Printer className="w-3.5 h-3.5" />
                <span>Print Invoice</span>
              </button>

              <button
                onClick={() =>
                  alert(
                    `Sending invoice ${invoice.invoiceNumber} to customer email...`,
                  )
                }
                className="inline-flex items-center gap-1.5 px-3 py-2 text-xs font-bold text-slate-700 bg-white border border-slate-300 rounded-lg hover:bg-slate-50 transition-colors"
              >
                <Send className="w-3.5 h-3.5 text-setu-600" />
                <span>Send Invoice</span>
              </button>

              {invoice.status !== "Paid" && invoice.status !== "Cancelled" && (
                <button
                  onClick={() => setShowRecordModal(true)}
                  className="inline-flex items-center gap-1.5 px-3.5 py-2 text-xs font-bold text-white bg-emerald-600 hover:bg-emerald-700 rounded-lg shadow-xs transition-colors"
                >
                  <DollarSign className="w-3.5 h-3.5" />
                  <span>Record Payment</span>
                </button>
              )}

              {invoice.status !== "Cancelled" && (
                <button
                  onClick={() => setShowCancelModal(true)}
                  className="inline-flex items-center gap-1.5 px-3 py-2 text-xs font-bold text-rose-700 bg-rose-50 border border-rose-200 rounded-lg hover:bg-rose-100 transition-colors"
                >
                  <XCircle className="w-3.5 h-3.5" />
                  <span>Cancel Invoice</span>
                </button>
              )}

              <button
                onClick={async () => {
                  const invNum = invoice.invoiceNumber || invoice.id;
                  if (
                    window.confirm(
                      `Are you sure you want to delete Invoice ${invNum}? This action cannot be undone.`,
                    )
                  ) {
                    try {
                      await billingService.deleteInvoice(invoice.id || invNum);
                      alert(`Invoice ${invNum} deleted successfully.`);
                      navigate("/admin/billing");
                    } catch (err) {
                      alert(
                        `Failed to delete invoice ${invNum}: ${err.message}`,
                      );
                    }
                  }
                }}
                className="inline-flex items-center gap-1.5 px-3 py-2 text-xs font-bold text-rose-700 bg-rose-50 border border-rose-200 rounded-lg hover:bg-rose-100 transition-colors"
              >
                <Trash2 className="w-3.5 h-3.5" />
                <span>Delete</span>
              </button>
            </>
          )}
        </div>
      </div>

      {/* Toast Notification */}
      {toastMessage && (
        <div className="p-3 bg-slate-900 text-white rounded-lg text-xs font-semibold shadow-lg flex items-center gap-2">
          <CheckCircle2 className="w-4 h-4 text-emerald-400" />
          <span>{toastMessage}</span>
        </div>
      )}

      {/* FULL INVOICE EDITING MODE */}
      {isEditing ? (
        <InvoiceEditor
          initialInvoice={invoice}
          onSave={handleSaveInvoiceEdits}
          onCancel={() => setIsEditing(false)}
        />
      ) : (
        /* STANDARD VIEW MODE */
        <>
          {/* SUMMARY METRICS & PAYMENT PROGRESS CARD - Hidden during print */}
          <div className="space-y-4 no-print">
            <div className="bg-white border border-slate-200 rounded-xl p-4 shadow-xs grid grid-cols-2 sm:grid-cols-4 gap-4 divide-y sm:divide-y-0 sm:divide-x divide-slate-100">
              <div>
                <span className="text-[11px] font-bold text-slate-400 uppercase tracking-wider block">
                  Invoice Date
                </span>
                <span className="text-xs font-bold text-slate-900 font-mono">
                  {formatDate(invoice.invoiceDate)}
                </span>
              </div>

              <div className="pt-2 sm:pt-0 sm:pl-4">
                <span className="text-[11px] font-bold text-slate-400 uppercase tracking-wider block">
                  Due Date
                </span>
                <span className="text-xs font-bold text-slate-900 font-mono">
                  {formatDate(invoice.dueDate)}
                </span>
              </div>

              <div className="pt-2 sm:pt-0 sm:pl-4">
                <span className="text-[11px] font-bold text-slate-400 uppercase tracking-wider block">
                  Consignment Notes
                </span>
                <span className="text-xs font-bold text-setu-600 font-mono">
                  {(invoice.cns || []).join(", ") || invoice.cnNumber || "-"}
                </span>
              </div>

              <div className="pt-2 sm:pt-0 sm:pl-4">
                <span className="text-[11px] font-bold text-slate-400 uppercase tracking-wider block">
                  Grand Total
                </span>
                <span className="text-sm font-black text-slate-900 font-mono">
                  {formatINR(invoice.grandTotal || invoice.totalAmount)}
                </span>
              </div>
            </div>

            {/* PAYMENT SUMMARY & PROGRESS BAR CARD */}
            <div className="bg-white border border-slate-200 rounded-xl p-4 shadow-xs space-y-3 text-xs">
              <div className="flex items-center justify-between">
                <span className="font-bold text-slate-900 uppercase tracking-wider text-[11px]">
                  Payment Summary & Customer Progress
                </span>
                <span className="font-mono font-bold text-emerald-700">
                  {Math.round(
                    ((invoice.paidAmount || 0) /
                      (invoice.grandTotal || invoice.totalAmount || 1)) *
                      100,
                  )}
                  % Paid
                </span>
              </div>

              {/* Progress Bar */}
              <div className="w-full bg-slate-100 h-2.5 rounded-full overflow-hidden flex">
                <div
                  style={{
                    width: `${Math.min(100, Math.round(((invoice.paidAmount || 0) / (invoice.grandTotal || invoice.totalAmount || 1)) * 100))}%`,
                  }}
                  className="bg-emerald-500 h-full transition-all duration-500"
                />
              </div>

              <div className="flex items-center justify-between text-slate-700 font-mono text-xs pt-1">
                <span>
                  Paid:{" "}
                  <strong className="text-emerald-700">
                    {formatINR(invoice.paidAmount || 0)}
                  </strong>
                </span>
                <span>
                  Outstanding:{" "}
                  <strong className="text-setu-700">
                    {formatINR(
                      invoice.balanceAmount ??
                        invoice.balanceDue ??
                        (invoice.grandTotal || invoice.totalAmount),
                    )}
                  </strong>
                </span>
              </div>
            </div>
          </div>

          {/* MAIN CONTENT TABS */}
          <div className="space-y-4">
            <div className="bg-white border border-slate-200 rounded-xl p-2 shadow-xs flex items-center gap-2 text-xs no-print">
              <button
                onClick={() => setActiveTab("preview")}
                className={`px-4 py-2 font-bold rounded-lg transition-colors ${
                  activeTab === "preview"
                    ? "bg-setu-600 text-white shadow-xs"
                    : "text-slate-600 hover:bg-slate-100"
                }`}
              >
                Invoice Print Preview
              </button>
              <button
                onClick={() => setActiveTab("snapshot")}
                className={`px-4 py-2 font-bold rounded-lg transition-colors ${
                  activeTab === "snapshot"
                    ? "bg-setu-600 text-white shadow-xs"
                    : "text-slate-600 hover:bg-slate-100"
                }`}
              >
                Rate Card Snapshot
              </button>
              <button
                onClick={() => setActiveTab("history")}
                className={`px-4 py-2 font-bold rounded-lg transition-colors ${
                  activeTab === "history"
                    ? "bg-setu-600 text-white shadow-xs"
                    : "text-slate-600 hover:bg-slate-100"
                }`}
              >
                Audit History ({invoice.auditHistory?.length || 0})
              </button>
            </div>

            {activeTab === "preview" && <InvoicePrintView invoice={invoice} />}

            {activeTab === "snapshot" && (
              <BillingSnapshotCard snapshot={invoice.billingSnapshot} />
            )}

            {activeTab === "history" && (
              <div className="bg-white border border-slate-200 rounded-xl p-5 shadow-xs space-y-4 text-xs">
                <div className="flex items-center justify-between border-b border-slate-100 pb-2">
                  <h3 className="font-bold text-slate-900 text-sm">
                    Invoice Audit & Modification History
                  </h3>
                  <span className="text-[11px] font-bold text-slate-500">
                    Immutable Ledger
                  </span>
                </div>

                <div className="space-y-3">
                  {/* Initial creation entry */}
                  <div className="p-3 bg-slate-50 border border-slate-200 rounded-lg flex items-start justify-between">
                    <div className="space-y-1">
                      <strong className="block text-slate-900 font-semibold">
                        Initial Invoice Generation
                      </strong>
                      <div className="text-slate-600 text-xs">
                        Created under Company:{" "}
                        <strong>{invoice.companyName}</strong> | Applied Rate
                        Card:{" "}
                        <strong>
                          {invoice.billingSnapshot?.quotationId ||
                            "Standard Rate Card"}
                        </strong>
                      </div>
                      <div className="text-slate-500 text-[11px]">
                        Initial Subtotal:{" "}
                        {formatINR(
                          invoice.subtotal || invoice.taxableAmount || 0,
                        )}{" "}
                        | Initial Grand Total:{" "}
                        {formatINR(
                          invoice.totalAmount || invoice.grandTotal || 0,
                        )}
                      </div>
                    </div>
                    <span className="font-mono text-slate-500 text-[11px] whitespace-nowrap">
                      {formatDate(invoice.createdAt)}
                    </span>
                  </div>

                  {/* Render any recorded audit history entries */}
                  {Array.isArray(invoice.auditHistory) &&
                  invoice.auditHistory.length > 0
                    ? invoice.auditHistory.map((entry, idx) => (
                        <div
                          key={idx}
                          className="p-3 bg-indigo-50/50 border border-indigo-100 rounded-lg space-y-2"
                        >
                          <div className="flex items-center justify-between">
                            <div className="flex items-center gap-2">
                              <span className="px-2 py-0.5 rounded text-[10px] font-bold bg-indigo-600 text-white">
                                {entry.action || "Invoice Edited"}
                              </span>
                              <span className="font-bold text-slate-800">
                                By {entry.modifiedBy || "Admin"}
                              </span>
                            </div>
                            <span className="font-mono text-slate-500 text-[11px]">
                              {entry.modifiedAt
                                ? new Date(entry.modifiedAt).toLocaleString(
                                    "en-IN",
                                  )
                                : "-"}
                            </span>
                          </div>

                          {entry.summary && (
                            <div className="text-slate-700 italic text-xs">
                              "{entry.summary}"
                            </div>
                          )}

                          {entry.previousTotals && entry.newTotals && (
                            <div className="grid grid-cols-2 sm:grid-cols-3 gap-2 pt-1 border-t border-indigo-100 text-[11px]">
                              <div>
                                <span className="text-slate-500 block">
                                  Taxable Subtotal:
                                </span>
                                <span className="font-mono line-through text-slate-400 mr-1.5">
                                  {formatINR(
                                    entry.previousTotals.taxableAmount,
                                  )}
                                </span>
                                <span className="font-mono font-bold text-slate-900">
                                  {formatINR(entry.newTotals.taxableAmount)}
                                </span>
                              </div>
                              <div>
                                <span className="text-slate-500 block">
                                  Grand Total:
                                </span>
                                <span className="font-mono line-through text-slate-400 mr-1.5">
                                  {formatINR(entry.previousTotals.grandTotal)}
                                </span>
                                <span className="font-mono font-bold text-emerald-700">
                                  {formatINR(entry.newTotals.grandTotal)}
                                </span>
                              </div>
                              <div>
                                <span className="text-slate-500 block">
                                  Status:
                                </span>
                                <span className="line-through text-slate-400 mr-1.5">
                                  {entry.previousTotals.status}
                                </span>
                                <span className="font-bold text-slate-900">
                                  {entry.newTotals.status}
                                </span>
                              </div>
                            </div>
                          )}
                        </div>
                      ))
                    : null}

                  {invoice.status === "Cancelled" && (
                    <div className="p-3 bg-rose-50 border border-rose-200 rounded-lg text-rose-900 space-y-0.5">
                      <strong className="block font-bold">
                        Invoice Cancelled
                      </strong>
                      <span className="text-xs">
                        Reason: {invoice.cancellationReason || "Admin request"}
                      </span>
                    </div>
                  )}
                </div>
              </div>
            )}
          </div>
        </>
      )}

      {/* RECORD PAYMENT MODAL */}
      <Modal
        isOpen={showRecordModal}
        onClose={() => setShowRecordModal(false)}
        title={`Record Payment for ${invoice.invoiceNumber}`}
        footer={
          <>
            <button
              onClick={() => setShowRecordModal(false)}
              className="px-3 py-1.5 text-xs font-semibold text-slate-700 bg-white border border-slate-300 rounded"
            >
              Cancel
            </button>
            <button
              onClick={handleRecordPaymentSubmit}
              disabled={recordingPayment}
              className="px-4 py-1.5 text-xs font-bold text-white bg-emerald-600 hover:bg-emerald-700 rounded shadow-sm"
            >
              {recordingPayment ? "Recording..." : "Confirm Payment"}
            </button>
          </>
        }
      >
        <form
          onSubmit={handleRecordPaymentSubmit}
          className="space-y-4 text-xs"
        >
          <div className="p-3 bg-emerald-50 border border-emerald-200 rounded text-emerald-900 text-xs">
            <div>
              Customer: <strong>{invoice.companyName}</strong>
            </div>
            <div>
              Invoice Grand Total:{" "}
              <strong className="font-mono">
                {formatINR(invoice.grandTotal || invoice.totalAmount)}
              </strong>
            </div>
            <div>
              Outstanding Balance:{" "}
              <strong className="font-mono text-emerald-800">
                {formatINR(
                  invoice.balanceAmount ??
                    invoice.balanceDue ??
                    (invoice.grandTotal || invoice.totalAmount),
                )}
              </strong>
            </div>
          </div>

          <div>
            <label className="block font-bold text-slate-700 uppercase tracking-wider mb-1">
              Payment Amount (₹) <span className="text-rose-500">*</span>
            </label>
            <input
              type="number"
              step="0.01"
              value={paymentAmount}
              onChange={(e) => setPaymentAmount(e.target.value)}
              className="w-full p-2.5 bg-slate-50 border border-slate-300 rounded font-mono font-bold text-slate-900 text-sm"
              placeholder="Enter amount in ₹"
            />
          </div>

          <div>
            <label className="block font-bold text-slate-700 uppercase tracking-wider mb-1">
              Payment Mode <span className="text-rose-500">*</span>
            </label>
            <select
              value={paymentMode}
              onChange={(e) => setPaymentMode(e.target.value)}
              className="w-full p-2.5 bg-slate-50 border border-slate-300 rounded font-semibold text-slate-900"
            >
              <option value="NEFT/RTGS">NEFT / RTGS</option>
              <option value="IMPS">IMPS</option>
              <option value="UPI">UPI</option>
              <option value="Cheque">Cheque</option>
              <option value="Cash">Cash</option>
              <option value="Demand Draft">Demand Draft</option>
            </select>
          </div>

          <div>
            <label className="block font-bold text-slate-700 uppercase tracking-wider mb-1">
              UTR / Transaction / Cheque Reference Number
            </label>
            <input
              type="text"
              value={referenceNumber}
              onChange={(e) => setReferenceNumber(e.target.value)}
              placeholder="e.g. UTR19827364521"
              className="w-full p-2.5 bg-slate-50 border border-slate-300 rounded font-mono text-slate-900"
            />
          </div>

          <div>
            <label className="block font-bold text-slate-700 uppercase tracking-wider mb-1">
              Payment Remarks
            </label>
            <input
              type="text"
              value={paymentRemarks}
              onChange={(e) => setPaymentRemarks(e.target.value)}
              placeholder="e.g. Received via HDFC corporate banking"
              className="w-full p-2.5 bg-slate-50 border border-slate-300 rounded text-slate-900"
            />
          </div>
        </form>
      </Modal>

      {/* INVOICE CANCELLATION MODAL */}
      <Modal
        isOpen={showCancelModal}
        onClose={() => setShowCancelModal(false)}
        title={`Cancel Freight Invoice — ${invoice.invoiceNumber}`}
        footer={
          <>
            <button
              onClick={() => setShowCancelModal(false)}
              className="px-3 py-1.5 text-xs font-semibold text-slate-700 bg-white border border-slate-300 rounded"
            >
              Cancel
            </button>
            <button
              onClick={handleCancelSubmit}
              disabled={cancelling}
              className="px-4 py-1.5 text-xs font-bold text-white bg-rose-600 hover:bg-rose-700 rounded shadow-sm"
            >
              Confirm Cancellation
            </button>
          </>
        }
      >
        <form onSubmit={handleCancelSubmit} className="space-y-4 text-xs">
          <div className="p-3 bg-rose-50 border border-rose-200 rounded text-rose-800 text-xs font-medium">
            Cancelling this invoice will set status to{" "}
            <strong>Cancelled</strong>. The historical record and billing
            snapshot will remain preserved for audit logs.
          </div>

          <div>
            <label className="block font-bold text-slate-700 uppercase tracking-wider mb-1">
              Cancellation Reason <span className="text-rose-500">*</span>
            </label>
            <select
              value={cancellationReason}
              onChange={(e) => setCancellationReason(e.target.value)}
              className="w-full p-2.5 bg-slate-50 border border-slate-300 rounded font-semibold text-slate-900"
            >
              <option value="">Select Reason...</option>
              <option value="Incorrect rate card applied">
                Incorrect rate card applied
              </option>
              <option value="Chargeable weight error">
                Chargeable weight error
              </option>
              <option value="Customer billing detail error">
                Customer billing detail error
              </option>
              <option value="Duplicate invoice created">
                Duplicate invoice created
              </option>
              <option value="Customer requested re-invoice">
                Customer requested re-invoice
              </option>
            </select>
          </div>
        </form>
      </Modal>
    </div>
  );
};
