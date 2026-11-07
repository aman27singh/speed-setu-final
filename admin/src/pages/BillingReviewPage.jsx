import React, { useState, useEffect } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { billingService } from '../services/billingService';
import { shipmentService } from '../services/shipmentService';
import { companyService } from '../services/companyService';
import { formatINR, formatDate } from '../utils/formatters';
import { PageHeader } from '../components/common/PageHeader';
import { LoadingState } from '../components/common/LoadingState';
import { BillingSnapshotCard } from '../components/billing/BillingSnapshotCard';
import {
  FileText,
  Save,
  ArrowLeft,
  AlertTriangle,
  Plus,
  Trash2,
  CheckCircle2,
  DollarSign,
  ShieldCheck,
  Package
} from 'lucide-react';

export const BillingReviewPage = () => {
  const navigate = useNavigate();
  const [searchParams, setSearchParams] = useSearchParams();
  const [availableShipments, setAvailableShipments] = useState([]);
  const [selectedCN, setSelectedCN] = useState(searchParams.get('shipmentId') || '');
  const [calculation, setCalculation] = useState(null);

  const [adjustments, setAdjustments] = useState([]);
  const [newAdjType, setNewAdjType] = useState('Discount');
  const [newAdjAmount, setNewAdjAmount] = useState('');
  const [newAdjReason, setNewAdjReason] = useState('');
  const [isGstExempt, setIsGstExempt] = useState(false);
  const [hsnCode, setHsnCode] = useState('996531');

  const [loading, setLoading] = useState(true);
  const [generating, setGenerating] = useState(false);

  const fetchCalculation = async (cn) => {
    setLoading(true);
    try {
      const allShipments = await shipmentService.getShipments().catch(() => []);
      setAvailableShipments(allShipments);

      if (allShipments.length === 0) {
        setCalculation(null);
        setLoading(false);
        return;
      }

      let targetCN = cn || searchParams.get('shipmentId') || (allShipments[0] && (allShipments[0].cnNumber || allShipments[0].id));
      const found = allShipments.find(
        (s) =>
          (s.cnNumber || '').toLowerCase() === (targetCN || '').toLowerCase() ||
          (s.id || '').toLowerCase() === (targetCN || '').toLowerCase()
      );

      if (found) {
        targetCN = found.cnNumber || found.id;
      } else {
        targetCN = allShipments[0].cnNumber || allShipments[0].id;
      }

      if (targetCN !== selectedCN) {
        setSelectedCN(targetCN);
      }

      const calc = await billingService.calculateShipmentBill(targetCN);
      setCalculation(calc);
    } catch (err) {
      console.warn('[Billing Review] Calculation error:', err.message);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchCalculation(selectedCN);
  }, [selectedCN]);

  const handleCNChange = (cn) => {
    setSelectedCN(cn);
    setSearchParams({ shipmentId: cn });
  };

  const handleAddAdjustment = (e) => {
    e.preventDefault();
    const amt = parseFloat(newAdjAmount);
    if (!amt || amt <= 0 || !newAdjReason.trim()) {
      alert('Please enter a valid positive adjustment amount and reason.');
      return;
    }

    setAdjustments([
      ...adjustments,
      {
        id: `adj-${Date.now()}`,
        type: newAdjType,
        amount: newAdjType === 'Discount' ? -amt : amt,
        reason: newAdjReason,
        createdBy: 'Finance Admin',
        createdAt: new Date().toLocaleTimeString('en-IN', { timeStyle: 'short' })
      }
    ]);

    setNewAdjAmount('');
    setNewAdjReason('');
  };

  const handleRemoveAdjustment = (id) => {
    setAdjustments(adjustments.filter((a) => a.id !== id));
  };

  useEffect(() => {
    if (calculation) {
      setIsGstExempt(!!calculation.shipment?.isGstExempt || calculation.gstRate === 0);
    }
  }, [calculation]);

  const totalAdjustments = adjustments.reduce((acc, a) => acc + a.amount, 0);
  const finalTaxable = Math.max(0, (calculation?.taxableAmount || calculation?.subTotal || 0) + totalAdjustments);
  const effectiveGstRate = isGstExempt ? 0 : (calculation?.gstRate || 18);
  const finalGST = isGstExempt ? 0 : Math.round((finalTaxable * effectiveGstRate) / 100);
  const finalGrandTotal = finalTaxable + finalGST;

  const handleGenerateInvoice = async () => {
    if (!calculation) return;

    setGenerating(true);
    try {
      let companyAddress = calculation.shipment?.consignor?.address || '';
      let city = calculation.shipment?.consignor?.city || '';
      let state = calculation.shipment?.consignor?.state || '';
      let pinCode = calculation.shipment?.consignor?.pin || '';
      let companyGstin = calculation.shipment?.consignor?.gstin || '';

      try {
        const companies = await companyService.getCompanies();
        const comp = companies.find(
          (c) =>
            c.companyName === calculation.companyName ||
            c.companyId === calculation.shipment?.companyId ||
            c.id === calculation.shipment?.companyId ||
            c.companyCode === calculation.shipment?.companyCode
        );
        if (comp) {
          if (comp.billing?.address || comp.address) companyAddress = comp.billing?.address || comp.address;
          if (comp.billing?.city || comp.city) city = comp.billing?.city || comp.city;
          if (comp.billing?.state || comp.state) state = comp.billing?.state || comp.state;
          if (comp.billing?.pinCode || comp.pinCode) pinCode = comp.billing?.pinCode || comp.pinCode;
          companyGstin = comp.billing?.gstin || comp.gstin || companyGstin || '';
        }
      } catch (e) {
        // ignore error
      }

      const isGodownOnly = calculation.shipment?.isGodownOnlyBilling || (calculation.lineItems || []).some(i => (i.name || '').toLowerCase().includes('godown') && calculation.lineItems.length === 1);
      const freightItem = (calculation.lineItems || []).find((i) => (i.name || '').toLowerCase().includes('freight'));
      const docketItem = (calculation.lineItems || []).find((i) => (i.name || '').toLowerCase().includes('docket'));
      const pickupItem = (calculation.lineItems || []).find((i) => (i.name || '').toLowerCase().includes('pickup'));
      const deliveryItem = (calculation.lineItems || []).find((i) => (i.name || '').toLowerCase().includes('delivery'));
      const packingItem = (calculation.lineItems || []).find((i) => (i.name || '').toLowerCase().includes('packing'));
      const laborItem = (calculation.lineItems || []).find((i) => (i.name || '').toLowerCase().includes('labor') || (i.name || '').toLowerCase().includes('loading'));
      const godownItem = (calculation.lineItems || []).find((i) => (i.name || '').toLowerCase().includes('godown') || (i.name || '').toLowerCase().includes('storage'));

      const addedDeliveryAdj = adjustments.filter(a => a.type === 'Delivery Charge').reduce((s, a) => s + Math.abs(a.amount), 0);
      const addedPickupAdj = adjustments.filter(a => a.type === 'Pickup Charge').reduce((s, a) => s + Math.abs(a.amount), 0);
      const addedPackingAdj = adjustments.filter(a => a.type === 'Packing Charge').reduce((s, a) => s + Math.abs(a.amount), 0);
      const addedLaborAdj = adjustments.filter(a => a.type === 'Labor Charge').reduce((s, a) => s + Math.abs(a.amount), 0);

      const wt = isGodownOnly ? 1 : (calculation.weight || calculation.shipment?.chargeableWeight || calculation.shipment?.actualWeight || 0);
      const rate = freightItem ? freightItem.rate : (isGodownOnly ? godownItem?.rate || calculation.shipment?.godownCharges || 0 : 0);
      const freightAmt = freightItem ? freightItem.amount : 0;
      const docketAmt = isGstExempt ? 0 : (docketItem ? docketItem.amount : 0);
      const pickupAmt = ((typeof calculation.shipment?.pickupCharges === 'number' && !isNaN(calculation.shipment.pickupCharges) && calculation.shipment.pickupCharges > 0) ? calculation.shipment.pickupCharges : (pickupItem ? pickupItem.amount : 0)) + addedPickupAdj;
      const deliveryAmt = ((typeof calculation.shipment?.deliveryCharges === 'number' && !isNaN(calculation.shipment.deliveryCharges) && calculation.shipment.deliveryCharges > 0) ? calculation.shipment.deliveryCharges : (deliveryItem ? deliveryItem.amount : 0)) + addedDeliveryAdj;
      const packingAmt = (packingItem ? packingItem.amount : (calculation.shipment?.packingCharges || 0)) + addedPackingAdj;
      const laborAmt = (laborItem ? laborItem.amount : (calculation.shipment?.laborCharges || 0)) + addedLaborAdj;
      const godownAmt = godownItem ? godownItem.amount : (calculation.shipment?.godownCharges || 0);

      const dockets = [
        {
          slNo: 1,
          docketNo: calculation.cnNumber || calculation.shipment?.cnNumber,
          docketDate: formatDate(calculation.shipment?.cnDate || calculation.shipment?.bookingDate),
          origin: calculation.shipment?.origin || 'Origin',
          destination: calculation.shipment?.destination || 'Destination',
          noPack: calculation.shipment?.packages || calculation.shipment?.noPack || 1,
          weight: wt,
          rate: rate,
          freight: freightAmt,
          docketCharges: docketAmt,
          pickupCharges: pickupAmt,
          deliveryCharges: deliveryAmt,
          packingCharges: packingAmt,
          laborCharges: laborAmt,
          godownCharges: godownAmt,
          godownMonths: calculation.shipment?.godownMonths || (calculation.shipment?.godownRatePerMonth > 0 ? Math.round(godownAmt / calculation.shipment.godownRatePerMonth) : 0),
          godownRatePerMonth: calculation.shipment?.godownRatePerMonth || (calculation.shipment?.godownMonths > 0 ? Math.round(godownAmt / calculation.shipment.godownMonths) : godownAmt),
          otherCharges: 0,
          taxableAmount: finalTaxable,
          cgst: 0,
          sgst: 0,
          igst: isGstExempt ? 0 : finalGST,
          totalInvoiceValue: finalGrandTotal
        }
      ];

      const associatedCNs = Array.from(new Set([
        ...(calculation.cns || []),
        ...(calculation.shipmentIds || []),
        calculation.cnNumber,
        calculation.shipment?.cnNumber,
        ...(dockets || []).map(d => d.docketNo || d.cnNumber)
      ].filter(Boolean)));

      const created = await billingService.createInvoice({
        ...calculation,
        cns: associatedCNs,
        shipmentIds: associatedCNs,
        cnNumber: associatedCNs[0] || calculation.cnNumber,
        hsnCode: hsnCode || '996531',
        companyAddress,
        city,
        state,
        pinCode,
        companyGstin,
        gstRate: effectiveGstRate,
        gstAmount: finalGST,
        taxableAmount: finalTaxable,
        grandTotal: finalGrandTotal,
        dockets,
        adjustments
      });

      alert(`Invoice ${created.invoiceNumber} generated successfully!`);
      navigate(`/admin/billing/invoices/${created.id}`);
    } catch (err) {
      alert(err.message || 'Failed to generate invoice.');
    } finally {
      setGenerating(false);
    }
  };

  if (loading) {
    return <LoadingState message="Running Deterministic Billing & Rate Card Matching Engine..." />;
  }

  if (!calculation) {
    return (
      <div className="space-y-6 max-w-4xl mx-auto pb-12">
        <PageHeader
          title="Billing Review & Invoice Generator"
          description="Generate invoice per Consignment Note"
          breadcrumbs={['Speed Setu Admin', 'Finance', 'Billing', 'Review']}
        />

        <div className="p-8 text-center bg-white border border-slate-200 rounded-xl space-y-3 shadow-xs">
          <Package className="w-10 h-10 text-slate-400 mx-auto" />
          <h3 className="text-base font-bold text-slate-900">No Shipments Available for Billing</h3>
          <p className="text-xs text-slate-500 max-w-md mx-auto">
            There are currently no active shipments ready for invoice generation in MongoDB. Create a shipment first to generate an invoice.
          </p>
          <button
            onClick={() => navigate('/admin/shipments/new')}
            className="inline-flex items-center gap-1.5 px-4 py-2 text-xs font-bold text-white bg-setu-600 hover:bg-setu-700 rounded-md shadow-xs transition-colors mt-2"
          >
            <Plus className="w-4 h-4" />
            <span>Create New Booking</span>
          </button>
        </div>
      </div>
    );
  }

  if (!calculation) return null;

  return (
    <div className="space-y-6 max-w-5xl mx-auto pb-12">
      <PageHeader
        title={`Billing Review & Invoice Generator — ${selectedCN}`}
        description="Review automated freight calculations, applied rate card rules, and generate GST invoice."
        breadcrumbs={['Speed Setu Admin', 'Finance', 'Billing', 'Review & Generate']}
        actions={
          <button
            type="button"
            onClick={() => navigate('/admin/billing')}
            className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold text-slate-700 bg-white border border-slate-300 rounded-md hover:bg-slate-50 transition-colors"
          >
            <ArrowLeft className="w-4 h-4" />
            <span>Back to Billing</span>
          </button>
        }
      />

      {/* ON-DEMAND CN BILLING NOTICE BANNER */}
      <div className="p-3.5 bg-setu-50/70 border border-setu-200 rounded-xl text-xs text-setu-900 font-medium flex items-center justify-between">
        <div className="flex items-center gap-2">
          <ShieldCheck className="w-4 h-4 text-setu-600 shrink-0" />
          <span><strong>CN-Based On-Demand Billing Engine:</strong> Invoices are generated per Consignment Note / Selected CNs on demand without any 15-day date-cycle restrictions.</span>
        </div>
      </div>

      {/* SHIPMENT SELECTOR STRIP */}
      <div className="bg-white border border-slate-200 rounded-xl p-4 shadow-xs flex flex-col md:flex-row items-center justify-between gap-4 text-xs">
        <div className="flex items-center gap-2">
          <Package className="w-4 h-4 text-setu-600" />
          <span className="font-bold text-slate-700 uppercase tracking-wider">Select Consignment Note:</span>
        </div>

        <select
          value={selectedCN}
          onChange={(e) => handleCNChange(e.target.value)}
          className="w-full md:w-80 p-2 bg-slate-50 border border-slate-300 rounded font-mono font-bold text-slate-900"
        >
          {availableShipments.map((s) => (
            <option key={s.id} value={s.cnNumber}>
              {s.cnNumber} — {s.companyName} ({s.origin} → {s.destination})
            </option>
          ))}
        </select>
      </div>

      {/* BILLING WARNINGS BANNER */}
      {calculation.warnings && calculation.warnings.length > 0 && (
        <div className="p-4 bg-amber-50 border border-amber-200 rounded-xl space-y-1 text-xs text-amber-900 font-medium">
          <div className="flex items-center gap-2 font-bold text-amber-950 text-sm mb-1">
            <AlertTriangle className="w-4 h-4 text-amber-600" />
            <span>Billing Engine Audit Warnings:</span>
          </div>
          <ul className="list-disc list-inside space-y-0.5 text-amber-800">
            {calculation.warnings.map((w, idx) => (
              <li key={idx}>{w}</li>
            ))}
          </ul>
        </div>
      )}

      {/* HISTORICAL RATE SNAPSHOT PREVIEW CARD */}
      <BillingSnapshotCard snapshot={calculation.billingSnapshot} />

      {/* CHARGES CALCULATION PREVIEW TABLE */}
      <div className="bg-white border border-slate-200 rounded-xl p-6 shadow-xs space-y-4">
        <div className="flex items-center justify-between border-b border-slate-100 pb-3">
          <div>
            <h3 className="text-sm font-bold text-slate-900">Calculated Line Items & Freight Charges</h3>
            <p className="text-xs text-slate-500">Automatically matched from Quotation {calculation.matchedQuotation} (V{calculation.quotationVersion})</p>
          </div>

          <span className="px-3 py-1 bg-emerald-50 text-emerald-700 rounded-full text-xs font-bold border border-emerald-200 flex items-center gap-1">
            <ShieldCheck className="w-3.5 h-3.5" /> Rate Matched
          </span>
        </div>

        <div className="border border-slate-200 rounded-lg overflow-hidden text-xs">
          <table className="w-full text-left border-collapse">
            <thead className="bg-slate-50 text-slate-600 uppercase font-bold text-[10px] border-b border-slate-200">
              <tr>
                <th className="p-3">Description</th>
                <th className="p-3 text-center">Quantity / Weight</th>
                <th className="p-3 text-right">Unit Rate</th>
                <th className="p-3 text-right">Amount</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100 font-medium">
              {(calculation.lineItems || []).map((item, idx) => (
                <tr key={idx}>
                  <td className="p-3 font-bold text-slate-900">{item.description || item.name}</td>
                  <td className="p-3 text-center font-mono">
                    {item.weight ? `${item.weight} Kg` : (item.quantity ? `${item.quantity} ${item.unit || ''}` : '1 Job')}
                  </td>
                  <td className="p-3 text-right font-mono">₹{item.rate}</td>
                  <td className="p-3 text-right font-mono font-bold text-slate-900">{formatINR(item.amount)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        {/* AUDITABLE MANUAL ADJUSTMENTS AREA */}
        <div className="pt-4 border-t border-slate-100 space-y-3 text-xs">
          <h4 className="font-bold text-slate-800 uppercase tracking-wider text-[11px]">Auditable Manual Adjustments</h4>

          {adjustments.length > 0 && (
            <div className="space-y-1.5">
              {adjustments.map((a) => (
                <div key={a.id} className="p-2 bg-slate-50 border border-slate-200 rounded flex items-center justify-between font-mono text-xs">
                  <div>
                    <span className="font-bold text-slate-900">{a.type}: </span>
                    <span className="text-slate-600">"{a.reason}"</span>
                  </div>
                  <div className="flex items-center gap-3">
                    <span className={`font-bold ${a.amount < 0 ? 'text-emerald-700' : 'text-slate-900'}`}>
                      {formatINR(a.amount)}
                    </span>
                    <button
                      onClick={() => handleRemoveAdjustment(a.id)}
                      className="text-rose-600 hover:text-rose-800"
                    >
                      <Trash2 className="w-3.5 h-3.5" />
                    </button>
                  </div>
                </div>
              ))}
            </div>
          )}

          {/* Add Adjustment Form Inline */}
          <div className="flex flex-col sm:flex-row items-center gap-2 pt-1">
            <select
              value={newAdjType}
              onChange={(e) => setNewAdjType(e.target.value)}
              className="p-2 bg-slate-50 border border-slate-300 rounded font-semibold text-slate-900 text-xs"
            >
              <option value="Delivery Charge">Delivery Charge (+)</option>
              <option value="Pickup Charge">Pickup Charge (+)</option>
              <option value="Packing Charge">Packing Charge (+)</option>
              <option value="Labor Charge">Labor Charge (+)</option>
              <option value="Extra Charge">Extra Charge (+)</option>
              <option value="Discount">Discount (-)</option>
            </select>

            <input
              type="number"
              value={newAdjAmount}
              onChange={(e) => setNewAdjAmount(e.target.value)}
              placeholder="Amount (₹)"
              className="w-28 p-2 bg-slate-50 border border-slate-300 rounded font-mono text-xs"
            />

            <input
              type="text"
              value={newAdjReason}
              onChange={(e) => setNewAdjReason(e.target.value)}
              placeholder="Adjustment Reason..."
              className="flex-1 p-2 bg-slate-50 border border-slate-300 rounded text-xs"
            />

            <button
              type="button"
              onClick={handleAddAdjustment}
              className="px-3 py-2 text-xs font-bold text-slate-700 bg-slate-100 hover:bg-slate-200 rounded shrink-0"
            >
              + Add Adjustment
            </button>
          </div>
        </div>

        {/* CALCULATION SUMMARY CARD */}
        <div className="pt-4 border-t border-slate-200 grid grid-cols-1 md:grid-cols-2 gap-6 items-end text-xs">
          <div className="space-y-2 bg-slate-50 p-3.5 rounded-xl border border-slate-200">
            <label className="block font-bold text-slate-800 uppercase tracking-wider text-[11px]">
              GST Tax Treatment For This Bill:
            </label>
            <div className="flex items-center gap-2">
              <button
                type="button"
                onClick={() => setIsGstExempt(false)}
                className={`flex-1 py-2 px-3 rounded-lg border text-xs font-bold transition-all ${
                  !isGstExempt
                    ? 'bg-setu-600 text-white border-setu-600 shadow-xs'
                    : 'bg-white text-slate-700 border-slate-300 hover:bg-slate-100'
                }`}
              >
                18% IGST Tax
              </button>
              <button
                type="button"
                onClick={() => setIsGstExempt(true)}
                className={`flex-1 py-2 px-3 rounded-lg border text-xs font-bold transition-all ${
                  isGstExempt
                    ? 'bg-emerald-600 text-white border-emerald-600 shadow-xs'
                    : 'bg-white text-slate-700 border-slate-300 hover:bg-slate-100'
                }`}
              >
                0% Exempt / RCM (No GST)
              </button>
            </div>
            <p className="text-[11px] text-slate-500 font-medium pt-0.5">
              {isGstExempt
                ? '✅ GST Exempt selected. No tax will be added to the invoice.'
                : `⚡ Standard 18% GST selected (${formatINR(finalGST)} tax will be added).`}
            </p>

            <div className="pt-2 border-t border-slate-200/80 space-y-1">
              <label className="block font-bold text-slate-800 uppercase tracking-wider text-[11px]">
                HSN / SAC Services Code:
              </label>
              <input
                type="text"
                value={hsnCode}
                onChange={(e) => setHsnCode(e.target.value)}
                placeholder="e.g. 996531"
                className="w-full px-3 py-1.5 text-xs font-mono font-bold bg-white border border-slate-300 rounded-md focus:ring-2 focus:ring-setu-500 focus:border-setu-500"
              />
              <span className="text-[10px] text-slate-500 block">
                Default HSN: 996531 (Goods Transport Agency / Freight Services)
              </span>
            </div>
          </div>

          <div className="space-y-2 text-xs border-l border-slate-100 pl-0 md:pl-6">
            <div className="flex justify-between text-slate-600">
              <span>Subtotal Taxable Amount:</span>
              <span className="font-mono font-bold text-slate-900">{formatINR(finalTaxable)}</span>
            </div>

            <div className="flex justify-between text-slate-600 font-mono">
              <span>GST (Integrated IGST @ {effectiveGstRate}%):</span>
              <span className={`font-bold ${isGstExempt ? 'text-emerald-700' : 'text-slate-900'}`}>
                {isGstExempt ? '₹0 (Exempt)' : formatINR(finalGST)}
              </span>
            </div>

            <div className="flex justify-between text-base font-black text-slate-900 pt-2 border-t-2 border-slate-900">
              <span>Final Grand Total:</span>
              <span className="font-mono text-setu-700">{formatINR(finalGrandTotal)}</span>
            </div>
          </div>
        </div>
      </div>

      {/* BOTTOM ACTIONS */}
      <div className="flex items-center justify-end gap-3 pt-4 border-t border-slate-200">
        <button
          type="button"
          onClick={() => navigate('/admin/billing')}
          className="px-4 py-2 text-xs font-semibold text-slate-700 bg-white border border-slate-300 rounded-md hover:bg-slate-50 transition-colors"
        >
          Cancel
        </button>

        <button
          type="button"
          disabled={generating}
          onClick={handleGenerateInvoice}
          className="inline-flex items-center gap-2 px-6 py-2.5 text-xs font-bold text-white bg-setu-600 hover:bg-setu-700 rounded-md shadow-md transition-colors disabled:opacity-50"
        >
          <CheckCircle2 className="w-4 h-4" />
          <span>{generating ? 'Generating Invoice...' : 'Generate GST Invoice'}</span>
        </button>
      </div>
    </div>
  );
};
