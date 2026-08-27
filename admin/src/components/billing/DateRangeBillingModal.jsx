import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { shipmentService } from '../../services/shipmentService';
import { companyService } from '../../services/companyService';
import { billingService } from '../../services/billingService';
import { formatINR, formatDate } from '../../utils/formatters';
import {
  Calendar,
  Building2,
  CheckSquare,
  Square,
  FileText,
  X,
  Sparkles,
  ArrowRight,
  ShieldCheck,
  Package,
  Loader2
} from 'lucide-react';

export const DateRangeBillingModal = ({ isOpen, onClose, companies = [] }) => {
  const navigate = useNavigate();

  const [availableCompanies, setAvailableCompanies] = useState([]);
  const [selectedCompanyId, setSelectedCompanyId] = useState('');
  const [fromDate, setFromDate] = useState('2026-08-01');
  const [toDate, setToDate] = useState('2026-08-31');
  const [billingFilter, setBillingFilter] = useState('unbilled'); // 'unbilled' | 'all'

  const [fetchedCNs, setFetchedCNs] = useState([]);
  const [selectedCNIds, setSelectedCNIds] = useState([]);
  const [hasQueried, setHasQueried] = useState(false);
  const [querying, setQuerying] = useState(false);
  const [generating, setGenerating] = useState(false);
  const [isGstExempt, setIsGstExempt] = useState(false);
  const [hsnCode, setHsnCode] = useState('996531');

  useEffect(() => {
    if (isOpen) {
      const loadInitialCompanies = async () => {
        try {
          const comps = await companyService.getCompanies();
          setAvailableCompanies(comps);
          if (comps.length > 0) {
            setSelectedCompanyId(comps[0].id || comps[0].companyId || comps[0].companyName);
          }
        } catch (e) {
          console.warn('Failed to load companies for billing modal:', e.message);
        }
      };

      const now = new Date();
      const firstDay = new Date(now.getFullYear(), now.getMonth(), 1).toISOString().split('T')[0];
      const today = now.toISOString().split('T')[0];
      setFromDate(firstDay);
      setToDate(today);

      loadInitialCompanies();
    }
  }, [isOpen]);

  if (!isOpen) return null;

  const handleFetchCNs = async (e) => {
    e?.preventDefault();
    if (!selectedCompanyId) {
      alert('Please select a customer company.');
      return;
    }

    setQuerying(true);
    try {
      const allShipments = await shipmentService.getShipments();

      const targetCompany = availableCompanies.find(
        (c) =>
          c.id === selectedCompanyId ||
          c.companyId === selectedCompanyId ||
          c.companyCode === selectedCompanyId ||
          c.companyName === selectedCompanyId
      );

      const targetCompName = (targetCompany?.companyName || selectedCompanyId).toLowerCase().trim();
      const targetCompCode = (targetCompany?.companyCode || targetCompany?.companyId || '').toLowerCase().trim();

      const matchingShipments = allShipments.filter((s) => {
        const sCompId = (s.companyId || s.companyCode || '').toLowerCase().trim();
        const sCompName = (s.companyName || '').toLowerCase().trim();

        const matchesCompany =
          !selectedCompanyId ||
          (sCompId && (sCompId === targetCompCode || sCompId === selectedCompanyId.toLowerCase())) ||
          (sCompName && targetCompName && (sCompName.includes(targetCompName) || targetCompName.includes(sCompName)));

        if (!matchesCompany) return false;

        const d = s.cnDate || s.bookingDate || (s.createdAt ? s.createdAt.split('T')[0] : '');
        const isAfterFrom = !fromDate || d >= fromDate;
        const isBeforeTo = !toDate || d <= toDate;

        const isNotBilled = billingFilter === 'all' || (s.billingStatus || '').toLowerCase() !== 'invoiced';

        return isAfterFrom && isBeforeTo && isNotBilled;
      });

      const evaluatedDockets = [];
      for (const s of matchingShipments) {
        try {
          const calc = await billingService.calculateShipmentBill(s);
          const isGodownOnly = s.isGodownOnlyBilling || (calc.lineItems || []).some(i => (i.name || '').toLowerCase().includes('godown') && calc.lineItems.length === 1);

          const freightItem = (calc.lineItems || []).find((i) => (i.name || '').toLowerCase().includes('freight'));
          const docketItem = (calc.lineItems || []).find((i) => (i.name || '').toLowerCase().includes('docket'));
          const pickupItem = (calc.lineItems || []).find((i) => (i.name || '').toLowerCase().includes('pickup'));
          const deliveryItem = (calc.lineItems || []).find((i) => (i.name || '').toLowerCase().includes('delivery'));
          const packingItem = (calc.lineItems || []).find((i) => (i.name || '').toLowerCase().includes('packing'));
          const laborItem = (calc.lineItems || []).find((i) => (i.name || '').toLowerCase().includes('labor') || (i.name || '').toLowerCase().includes('loading'));
          const godownItem = (calc.lineItems || []).find((i) => (i.name || '').toLowerCase().includes('godown') || (i.name || '').toLowerCase().includes('storage'));

          const wt = isGodownOnly ? 1 : (calc.weight || s.chargeableWeight || s.actualWeight || 0);
          const rate = freightItem ? freightItem.rate : (isGodownOnly ? godownItem?.rate || s.godownCharges || 0 : 0);
          const freightAmt = freightItem ? freightItem.amount : 0;
          const effectiveGstRate = (isGstExempt || calc.gstRate === 0 || s.isGstExempt) ? 0 : (calc.gstRate || 18);
          const docketAmt = effectiveGstRate === 0 ? 0 : (docketItem ? docketItem.amount : 0);
          const pickupAmt = (typeof s.pickupCharges === 'number' && !isNaN(s.pickupCharges)) ? s.pickupCharges : (pickupItem ? pickupItem.amount : 0);
          const deliveryAmt = (typeof s.deliveryCharges === 'number' && !isNaN(s.deliveryCharges)) ? s.deliveryCharges : (deliveryItem ? deliveryItem.amount : 0);
          const packingAmt = packingItem ? packingItem.amount : (s.packingCharges || 0);
          const laborAmt = laborItem ? laborItem.amount : (s.laborCharges || 0);
          const godownAmt = godownItem ? godownItem.amount : (s.godownCharges || 0);

          const taxable = calc.taxableAmount ?? calc.subTotal ?? (freightAmt + docketAmt + pickupAmt + deliveryAmt + packingAmt + laborAmt + godownAmt);
          const gstAmt = effectiveGstRate === 0 ? 0 : (calc.gstAmount ?? Math.round(taxable * (effectiveGstRate / 100)));
          const grandTotal = taxable + gstAmt;

          evaluatedDockets.push({
            id: s.id || s.cnNumber,
            shipment: s,
            cnNumber: s.cnNumber,
            cnDate: s.cnDate || s.bookingDate || '-',
            origin: s.origin || (s.consignor && s.consignor.city) || 'Origin',
            destination: s.destination || (s.consignee && s.consignee.city) || 'Destination',
            mode: s.mode || s.freightMode || 'Express LTL',
            noPack: s.packages || s.numberOfBoxes || s.noOfBoxes || 10,
            chargeableWeight: wt,
            rate: rate,
            freightAmount: freightAmt,
            docketCharges: docketAmt,
            pickupCharges: pickupAmt,
            deliveryCharges: deliveryAmt,
            packingCharges: packingAmt,
            laborCharges: laborAmt,
            godownCharges: godownAmt,
            taxableAmount: taxable,
            gstAmount: gstAmt,
            totalInvoiceValue: grandTotal
          });
        } catch (e) {
          console.warn(`Calculation failed for ${s.cnNumber}:`, e.message);
        }
      }

      // Sort dockets chronologically by date (earliest date first)
      const parseDateVal = (dStr) => {
        if (!dStr) return 0;
        const t = Date.parse(dStr);
        if (!isNaN(t)) return t;
        const parts = String(dStr).trim().split(/[\s\-\/]+/);
        if (parts.length === 3) {
          const months = { jan:0, feb:1, mar:2, apr:3, may:4, jun:5, jul:6, aug:7, sep:8, oct:9, nov:10, dec:11 };
          if (parts[0].length === 4) {
            return new Date(parseInt(parts[0]), parseInt(parts[1]) - 1, parseInt(parts[2])).getTime();
          }
          const day = parseInt(parts[0], 10);
          const month = isNaN(parts[1]) ? months[parts[1].toLowerCase().slice(0, 3)] : parseInt(parts[1], 10) - 1;
          const year = parseInt(parts[2], 10);
          if (!isNaN(day) && month !== undefined && !isNaN(year)) {
            return new Date(year, month, day).getTime();
          }
        }
        return 0;
      };

      evaluatedDockets.sort((a, b) => {
        const timeA = parseDateVal(a.cnDate || a.docketDate);
        const timeB = parseDateVal(b.cnDate || b.docketDate);
        return timeA - timeB;
      });

      setFetchedCNs(evaluatedDockets);
      setSelectedCNIds(evaluatedDockets.map((d) => d.id));
      setHasQueried(true);
    } catch (err) {
      alert('Failed to query consignment notes: ' + err.message);
    } finally {
      setQuerying(false);
    }
  };

  const handleToggleCN = (id) => {
    if (selectedCNIds.includes(id)) {
      setSelectedCNIds(selectedCNIds.filter((item) => item !== id));
    } else {
      setSelectedCNIds([...selectedCNIds, id]);
    }
  };

  const handleToggleSelectAll = () => {
    if (selectedCNIds.length === fetchedCNs.length) {
      setSelectedCNIds([]);
    } else {
      setSelectedCNIds(fetchedCNs.map((f) => f.id));
    }
  };

  const selectedCNsList = fetchedCNs.filter((f) => selectedCNIds.includes(f.id));

  const totalPacks = selectedCNsList.reduce((sum, item) => sum + (item.noPack || 1), 0);
  const totalWeight = selectedCNsList.reduce((sum, item) => sum + (item.chargeableWeight || 0), 0);
  const totalFreight = selectedCNsList.reduce((sum, item) => sum + (item.freightAmount || 0), 0);
  const totalDocketCharges = selectedCNsList.reduce((sum, item) => sum + (item.docketCharges || 0), 0);
  const totalPickupCharges = selectedCNsList.reduce((sum, item) => sum + (item.pickupCharges || 0), 0);
  const totalDeliveryCharges = selectedCNsList.reduce((sum, item) => sum + (item.deliveryCharges || 0), 0);
  const totalPackingCharges = selectedCNsList.reduce((sum, item) => sum + (item.packingCharges || 0), 0);
  const totalLaborCharges = selectedCNsList.reduce((sum, item) => sum + (item.laborCharges || 0), 0);
  const totalGodownCharges = selectedCNsList.reduce((sum, item) => sum + (item.godownCharges || 0), 0);

  const totalTaxable = selectedCNsList.reduce((sum, item) => sum + (item.taxableAmount || 0), 0);
  const totalIGST = isGstExempt ? 0 : Math.round(totalTaxable * 0.18);
  const grandTotalValue = totalTaxable + totalIGST;

  const handleGenerateConsolidatedInvoice = async () => {
    if (selectedCNsList.length === 0) {
      alert('Please select at least one Consignment Note to generate an invoice.');
      return;
    }

    setGenerating(true);
    try {
      const targetComp = availableCompanies.find(
        (c) =>
          c.id === selectedCompanyId ||
          c.companyId === selectedCompanyId ||
          c.companyCode === selectedCompanyId ||
          c.companyName === selectedCompanyId
      ) || {};

      const compName = targetComp.companyName || selectedCompanyId;
      const compAddress = targetComp.billing?.address || targetComp.address || selectedCNsList[0]?.shipment?.consignor?.address || '';
      const compCity = targetComp.billing?.city || targetComp.city || selectedCNsList[0]?.shipment?.consignor?.city || '';
      const compState = targetComp.billing?.state || targetComp.state || selectedCNsList[0]?.shipment?.consignor?.state || '';
      const compPin = targetComp.billing?.pinCode || targetComp.pinCode || selectedCNsList[0]?.shipment?.consignor?.pin || '';
      const compGstin = targetComp.billing?.gstin || targetComp.gstin || selectedCNsList[0]?.shipment?.consignor?.gstin || '';

      const dockets = selectedCNsList.map((item, idx) => {
        const itemTaxable = item.taxableAmount;
        const isInterState = item.origin && item.destination && item.origin.toLowerCase().trim() !== item.destination.toLowerCase().trim();
        let itemCgst = 0;
        let itemSgst = 0;
        let itemIgst = 0;

        if (!isGstExempt) {
          if (isInterState) {
            itemIgst = item.gstAmount || Math.round(itemTaxable * 0.18);
          } else {
            itemCgst = Math.round(itemTaxable * 0.09);
            itemSgst = Math.round(itemTaxable * 0.09);
          }
        }

        const itemTotal = itemTaxable + itemCgst + itemSgst + itemIgst;

        return {
          slNo: idx + 1,
          docketNo: item.cnNumber,
          docketDate: formatDate(item.cnDate),
          origin: item.origin,
          destination: item.destination,
          noPack: item.noPack || 10,
          weight: item.chargeableWeight,
          rate: item.rate,
          freight: item.freightAmount,
          docketCharges: item.docketCharges,
          pickupCharges: item.pickupCharges,
          deliveryCharges: item.deliveryCharges,
          packingCharges: item.packingCharges,
          laborCharges: item.laborCharges,
          godownCharges: item.godownCharges,
          godownMonths: item.shipment?.godownMonths || (item.shipment?.godownRatePerMonth > 0 ? Math.round(item.godownCharges / item.shipment.godownRatePerMonth) : 0),
          godownRatePerMonth: item.shipment?.godownRatePerMonth || (item.shipment?.godownMonths > 0 ? Math.round(item.godownCharges / item.shipment.godownMonths) : item.godownCharges),
          otherCharges: (item.packingCharges || 0) + (item.laborCharges || 0) + (item.godownCharges || 0),
          taxableAmount: itemTaxable,
          cgst: itemCgst,
          sgst: itemSgst,
          igst: itemIgst,
          totalInvoiceValue: itemTotal
        };
      });

      const newInvoicePayload = {
        invoiceDate: new Date().toISOString().split('T')[0],
        dueDate: new Date(Date.now() + 30 * 86400000).toISOString().split('T')[0],
        hsnCode: hsnCode || '996531',
        chargingGst: !isGstExempt,
        isGstExempt: isGstExempt,
        companyId: targetComp.id || targetComp.companyId || 'comp-001',
        companyCode: targetComp.companyCode || 'COM-001',
        companyName: compName,
        companyAddress: compAddress,
        city: compCity,
        state: compState,
        pinCode: compPin,
        companyGstin: compGstin,
        cns: selectedCNsList.map((s) => s.cnNumber),
        shipmentIds: selectedCNsList.map((s) => s.cnNumber),
        dockets: dockets,
        taxableAmount: totalTaxable,
        subTotal: totalTaxable,
        gstRate: isGstExempt ? 0 : 18,
        gstAmount: isGstExempt ? 0 : totalIGST,
        grandTotal: isGstExempt ? totalTaxable : grandTotalValue,
        balanceAmount: isGstExempt ? totalTaxable : grandTotalValue,
        balanceDue: isGstExempt ? totalTaxable : grandTotalValue,
        paidAmount: 0,
        status: 'Draft',
        billingSnapshot: {
          mode: selectedCNsList[0]?.mode || 'Express LTL',
          chargeableWeight: totalWeight,
          ratePerKg: selectedCNsList[0]?.rate || 18
        }
      };

      const created = await billingService.createInvoice(newInvoicePayload);

      for (const item of selectedCNsList) {
        try {
          await shipmentService.updateShipment(item.cnNumber, {
            billingStatus: 'Invoiced',
            invoiceId: created.invoiceNumber
          });
        } catch (e) {
          console.warn(`Could not update billingStatus for shipment ${item.cnNumber}:`, e.message);
        }
      }

      alert(`Consolidated Tax Invoice ${created.invoiceNumber} generated successfully in MongoDB!`);
      onClose();
      navigate(`/admin/billing/invoices/${created.id}`);
    } catch (err) {
      alert(err.message || 'Failed to generate consolidated tax invoice.');
    } finally {
      setGenerating(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 bg-slate-900/60 backdrop-blur-xs flex items-center justify-center p-4">
      <div className="bg-white border border-slate-200 rounded-xl shadow-2xl max-w-4xl w-full max-h-[90vh] flex flex-col text-xs overflow-hidden">
        
        {/* MODAL HEADER */}
        <div className="p-4 bg-slate-900 text-white flex items-center justify-between">
          <div className="flex items-center gap-2">
            <div className="p-1.5 rounded-lg bg-setu-600">
              <FileText className="w-4 h-4 text-white" />
            </div>
            <div>
              <h2 className="text-sm font-bold">Date-Range Multi-CN Tax Invoice Builder</h2>
              <p className="text-[11px] text-slate-400">Select company & date range to consolidate all delivered CNs into a single Tax Invoice.</p>
            </div>
          </div>

          <button
            onClick={onClose}
            className="p-1 text-slate-400 hover:text-white rounded transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* MODAL BODY */}
        <div className="p-5 overflow-y-auto space-y-5 flex-1">
          
          {/* STEP 1: COMPANY & DATE RANGE FILTERS */}
          <form onSubmit={handleFetchCNs} className="bg-slate-50 border border-slate-200 rounded-xl p-4 space-y-3">
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-3 text-xs">
              <div>
                <label className="block font-bold text-slate-700 uppercase tracking-wider mb-1">
                  1. Customer / Company
                </label>
                <select
                  value={selectedCompanyId}
                  onChange={(e) => setSelectedCompanyId(e.target.value)}
                  className="w-full p-2 bg-white border border-slate-300 rounded font-bold text-slate-900 cursor-pointer focus:ring-2 focus:ring-setu-600/20"
                >
                  <option value="">-- All Customer Companies --</option>
                  {availableCompanies.map((c) => (
                    <option key={c.id || c.companyId || c.companyName} value={c.id || c.companyId || c.companyName}>
                      {c.companyName} ({c.companyCode || c.companyId || 'Client'})
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <label className="block font-bold text-slate-700 uppercase tracking-wider mb-1">
                  2. From Date
                </label>
                <input
                  type="date"
                  value={fromDate}
                  onChange={(e) => setFromDate(e.target.value)}
                  className="w-full p-2 bg-white border border-slate-300 rounded font-mono font-bold text-slate-900"
                />
              </div>

              <div>
                <label className="block font-bold text-slate-700 uppercase tracking-wider mb-1">
                  3. To Date
                </label>
                <input
                  type="date"
                  value={toDate}
                  onChange={(e) => setToDate(e.target.value)}
                  className="w-full p-2 bg-white border border-slate-300 rounded font-mono font-bold text-slate-900"
                />
              </div>

              <div>
                <label className="block font-bold text-slate-700 uppercase tracking-wider mb-1">
                  4. Billing Filter
                </label>
                <select
                  value={billingFilter}
                  onChange={(e) => setBillingFilter(e.target.value)}
                  className="w-full p-2 bg-white border border-slate-300 rounded font-bold text-slate-900 cursor-pointer focus:ring-2 focus:ring-setu-600/20"
                >
                  <option value="unbilled">Un-Billed CNs Only</option>
                  <option value="all">All CNs (Invoiced & Un-Billed)</option>
                </select>
              </div>

              <div>
                <label className="block font-bold text-slate-700 uppercase tracking-wider mb-1">
                  5. GST Tax Format
                </label>
                <select
                  value={isGstExempt ? 'exempt' : 'gst'}
                  onChange={(e) => setIsGstExempt(e.target.value === 'exempt')}
                  className="w-full p-2 bg-white border border-slate-300 rounded font-bold text-slate-900 cursor-pointer focus:ring-2 focus:ring-setu-600/20"
                >
                  <option value="exempt">No GST / Exempt (Image 1 Format)</option>
                  <option value="gst">18% Charging GST (Image 2 Format)</option>
                </select>
              </div>
            </div>

            <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-2 pt-1">
              <span className="text-[11px] text-slate-500">
                {billingFilter === 'all'
                  ? 'System will fetch all Consignment Notes (both invoiced & un-billed) booked/delivered between selected dates from MongoDB.'
                  : 'System will fetch all un-billed Consignment Notes booked/delivered between selected dates from MongoDB.'}
              </span>
              <button
                type="submit"
                disabled={querying}
                className="px-4 py-2 text-xs font-bold text-white bg-slate-900 hover:bg-black rounded-lg transition-colors shadow-xs inline-flex items-center gap-1.5 shrink-0"
              >
                {querying && <Loader2 className="w-3.5 h-3.5 animate-spin" />}
                <span>{billingFilter === 'all' ? 'Fetch All CNs (Including Invoiced)' : 'Fetch Un-Billed CNs'}</span>
              </button>
            </div>
          </form>

          {/* STEP 2: MATCHING CNS SELECTION WORKSPACE */}
          {hasQueried && (
            <div className="space-y-3">
              <div className="flex items-center justify-between">
                <h3 className="font-bold text-slate-900 text-xs flex items-center gap-1.5">
                  <span>Available Consignment Notes ({fetchedCNs.length})</span>
                  <span className="text-slate-400 text-[11px] font-normal">
                    Between {fromDate} and {toDate}
                  </span>
                </h3>

                {fetchedCNs.length > 0 && (
                  <button
                    type="button"
                    onClick={handleToggleSelectAll}
                    className="text-setu-600 hover:underline font-bold text-[11px]"
                  >
                    {selectedCNIds.length === fetchedCNs.length ? 'Deselect All' : 'Select All CNs'}
                  </button>
                )}
              </div>

              {fetchedCNs.length === 0 ? (
                <div className="p-8 text-center bg-slate-50 border border-slate-200 rounded-xl text-slate-500 text-xs">
                  No un-billed shipments found for <strong>{availableCompanies.find(c => c.id === selectedCompanyId || c.companyId === selectedCompanyId || c.companyName === selectedCompanyId)?.companyName || selectedCompanyId}</strong> between <strong>{fromDate}</strong> and <strong>{toDate}</strong>.
                </div>
              ) : (
                <div className="border border-slate-200 rounded-xl overflow-hidden shadow-xs max-h-56 overflow-y-auto">
                  <table className="w-full text-left border-collapse text-xs">
                    <thead className="bg-slate-100 font-bold text-[10px] uppercase text-slate-700 sticky top-0">
                      <tr>
                        <th className="p-2 w-8 text-center">
                          <input
                            type="checkbox"
                            checked={selectedCNIds.length === fetchedCNs.length && fetchedCNs.length > 0}
                            onChange={handleToggleSelectAll}
                            className="rounded text-setu-600 focus:ring-0"
                          />
                        </th>
                        <th className="p-2">Docket No</th>
                        <th className="p-2">Docket Date</th>
                        <th className="p-2">Route</th>
                        <th className="p-2 text-center">Packs</th>
                        <th className="p-2 text-right">Weight</th>
                        <th className="p-2 text-right">Rate</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-100 font-medium">
                      {fetchedCNs.map((cn) => {
                        const isSelected = selectedCNIds.includes(cn.id);
                        return (
                          <tr
                            key={cn.id}
                            onClick={() => handleToggleCN(cn.id)}
                            className={`cursor-pointer transition-colors ${
                              isSelected ? 'bg-setu-50/50' : 'hover:bg-slate-50'
                            }`}
                          >
                            <td className="p-2 text-center" onClick={(e) => e.stopPropagation()}>
                              <input
                                type="checkbox"
                                checked={isSelected}
                                onChange={() => handleToggleCN(cn.id)}
                                className="rounded text-setu-600 focus:ring-0"
                              />
                            </td>
                            <td className="p-2 font-bold font-mono text-setu-700">{cn.cnNumber}</td>
                            <td className="p-2 font-mono text-slate-600">{cn.cnDate}</td>
                            <td className="p-2 text-slate-700">{cn.origin} → {cn.destination}</td>
                            <td className="p-2 text-center font-mono">{cn.noPack || 1}</td>
                            <td className="p-2 text-right font-mono font-bold">{cn.chargeableWeight} Kg</td>
                            <td className="p-2 text-right font-mono">₹{cn.rate || 65}</td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                  {/* GST TAX TREATMENT SELECTOR & HSN CODE INPUT */}
                  <div className="p-3.5 bg-slate-50 border border-slate-200 rounded-xl space-y-3 text-xs">
                    <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
                      <div>
                        <span className="font-bold text-slate-800 uppercase tracking-wider block text-[11px]">GST Tax Treatment For Bill:</span>
                        <span className="text-slate-500 text-[11px]">
                          {isGstExempt ? '0% GST Exempt / RCM (No Tax charged)' : `Standard 18% IGST Tax (₹${totalIGST.toLocaleString('en-IN')} tax added)`}
                        </span>
                      </div>

                      <div className="flex items-center gap-2">
                        <button
                          type="button"
                          onClick={() => setIsGstExempt(false)}
                          className={`px-3 py-1.5 rounded-lg border font-bold text-xs transition-all ${
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
                          className={`px-3 py-1.5 rounded-lg border font-bold text-xs transition-all ${
                            isGstExempt
                              ? 'bg-emerald-600 text-white border-emerald-600 shadow-xs'
                              : 'bg-white text-slate-700 border-slate-300 hover:bg-slate-100'
                          }`}
                        >
                          0% Exempt (No GST)
                        </button>
                      </div>
                    </div>

                    <div className="pt-2 border-t border-slate-200/80 flex items-center justify-between gap-3">
                      <div>
                        <label className="font-bold text-slate-800 uppercase tracking-wider block text-[11px]">
                          HSN / SAC Services Code:
                        </label>
                        <span className="text-[10px] text-slate-500">
                          Default: 996531 (GTA Freight Road Services)
                        </span>
                      </div>

                      <input
                        type="text"
                        value={hsnCode}
                        onChange={(e) => setHsnCode(e.target.value)}
                        placeholder="e.g. 996531"
                        className="w-40 px-3 py-1 text-xs font-mono font-bold bg-white border border-slate-300 rounded-md focus:ring-2 focus:ring-setu-500 focus:border-setu-500 text-right"
                      />
                    </div>
                  </div>
                </div>
              )}
            </div>
          )}

        </div>

        {/* MODAL FOOTER */}
        <div className="p-4 bg-slate-50 border-t border-slate-200 flex items-center justify-between">
          <button
            onClick={onClose}
            className="px-4 py-2 font-bold text-slate-700 bg-white border border-slate-300 hover:bg-slate-100 rounded-md transition-colors"
          >
            Cancel
          </button>

          <button
            onClick={handleGenerateConsolidatedInvoice}
            disabled={generating || selectedCNsList.length === 0}
            className={`inline-flex items-center gap-2 px-5 py-2 text-xs font-extrabold text-white rounded-md shadow-md transition-all ${
              generating || selectedCNsList.length === 0
                ? 'bg-slate-400 cursor-not-allowed'
                : 'bg-setu-600 hover:bg-setu-700'
            }`}
          >
            <span>Generate Multi-Docket Tax Invoice ({selectedCNsList.length} CNs)</span>
            <ArrowRight className="w-4 h-4" />
          </button>
        </div>

      </div>
    </div>
  );
};
