
import { apiRequest, simulateDelay } from './apiClient';
import { shipmentService } from './shipmentService';
import { quotationService } from './quotationService';
import {
  calculateFreightAmount,
  resolveShipmentFreightMode,
  formatFreightDescription
} from '../utils/pricingValidation';

let invoicesStore = [];

export const billingService = {
  async getInvoices({ search = '', status = 'All', companyId = 'All' } = {}) {
    try {
      const queryParams = new URLSearchParams();
      if (search) queryParams.append('search', search);
      if (status && status !== 'All') queryParams.append('status', status);

      const remoteData = await apiRequest(`/invoices?${queryParams.toString()}`);
      if (Array.isArray(remoteData)) {
        invoicesStore = remoteData.map((inv) => ({
          ...inv,
          id: inv.id || inv.invoiceNumber || inv._id
        }));

        return invoicesStore.filter((inv) => {
          if (companyId !== 'All' && inv.companyId !== companyId) return false;
          if (status !== 'All' && inv.status?.toLowerCase() !== status.toLowerCase()) return false;
          return true;
        });
      }
    } catch (err) {
      console.warn('[MongoDB Client] Invoices list fetch fallback:', err.message);
    }

    await simulateDelay(150);

    return invoicesStore.filter((inv) => {
      if (companyId !== 'All' && inv.companyId !== companyId) return false;
      if (status !== 'All' && inv.status?.toLowerCase() !== status.toLowerCase()) return false;

      if (search.trim()) {
        const q = search.toLowerCase().trim();
        return (
          (inv.invoiceNumber && inv.invoiceNumber.toLowerCase().includes(q)) ||
          (inv.companyName && inv.companyName.toLowerCase().includes(q))
        );
      }
      return true;
    });
  },

  async getBillingDashboard() {
    try {
      const [invoices, shipments] = await Promise.all([
        billingService.getInvoices().catch(() => []),
        shipmentService.getShipments().catch(() => [])
      ]);

      const validInvoices = invoices.filter((i) => (i.status || '').toLowerCase() !== 'cancelled' && (i.status || '').toLowerCase() !== 'void');

      const readyForBilling = shipments.filter(
        (s) => s.billingStatus === 'Ready' || (s.status === 'Delivered' && !s.invoiceId)
      ).length;
      const draftInvoices = invoices.filter((i) => i.status === 'Draft').length;
      const generatedTotal = validInvoices.reduce((acc, i) => acc + (i.grandTotal || i.totalAmount || 0), 0);
      const sentInvoices = validInvoices
        .filter((i) => i.status === 'Sent')
        .reduce((acc, i) => acc + (i.grandTotal || i.totalAmount || 0), 0);
      const outstandingTotal = validInvoices.reduce(
        (acc, i) => acc + (i.balanceAmount ?? i.balanceDue ?? (i.grandTotal || 0)),
        0
      );
      const disputedInvoices = validInvoices.filter((i) => i.status === 'Disputed').length;

      return {
        readyForBillingCount: readyForBilling,
        readyForBilling,
        draftCount: draftInvoices,
        draftInvoices,
        generatedThisMonth: generatedTotal,
        generatedTotal,
        sentAmount: sentInvoices,
        sentInvoices,
        outstandingAmount: outstandingTotal,
        outstandingTotal,
        disputedCount: disputedInvoices,
        disputedInvoices
      };
    } catch (err) {
      console.warn('[MongoDB Client] Billing dashboard metrics fallback:', err.message);
    }

    await simulateDelay(100);
    return {
      readyForBillingCount: 0,
      readyForBilling: 0,
      draftCount: 0,
      draftInvoices: 0,
      generatedThisMonth: 0,
      generatedTotal: 0,
      sentAmount: 0,
      disputedCount: 0,
      disputedInvoices: 0
    };
  },

  async getReadyForBillingShipments() {
    try {
      const shipments = await shipmentService.getShipments();
      const readyList = shipments.filter((s) => s.billingStatus === 'Ready' || (s.status === 'Delivered' && !s.invoiceId));

      const processed = await Promise.all(
        readyList.map(async (s) => {
          try {
            const calc = await billingService.calculateShipmentBill(s);
            const estTotal = calc.grandTotal || calc.taxableAmount || 0;
            return {
              ...s,
              chargeableWeight: calc.weight || s.chargeableWeight || Math.max(s.actualWeight || 0, s.volumetricWeight || 0, 1),
              matchedQuotation: calc.matchedQuotation || (calc.hasValidRateCard ? 'Matched Rate Card' : 'Missing Quotation / Rate Card'),
              estimatedTotal: estTotal,
              billingCalculation: calc,
              isPricingMissing: !calc.hasValidRateCard || calc.isUnpriced
            };
          } catch (e) {
            const wt = s.chargeableWeight || Math.max(s.actualWeight || 0, s.volumetricWeight || 0, 1);
            return {
              ...s,
              chargeableWeight: wt,
              matchedQuotation: 'Missing Quotation / Rate Card',
              estimatedTotal: 0,
              isPricingMissing: true
            };
          }
        })
      );

      return processed;
    } catch (err) {
      console.warn('[MongoDB Client] Ready shipments fallback:', err.message);
    }

    await simulateDelay(100);
    return [];
  },

  /**
   * MongoDB Rate Card Billing Engine:
   * Minimum Chargeable Weight Rule:
   * If minimumChargeableWeight is specified on the Rate Card (e.g., 50kg) and shipment weight is 20kg,
   * billing is calculated for 50kg. If shipment weight is greater (e.g. 250kg), 250kg is used.
   */
  async calculateShipmentBill(shipmentIdOrCN) {
    let shipment;
    try {
      if (typeof shipmentIdOrCN === 'object' && shipmentIdOrCN !== null) {
        shipment = shipmentIdOrCN;
      } else {
        shipment = await shipmentService.getShipment(shipmentIdOrCN);
      }
    } catch (err) {
      return {
        hasValidRateCard: false,
        error: `Shipment '${shipmentIdOrCN}' not found.`,
        warnings: [`Shipment '${shipmentIdOrCN}' not found in MongoDB.`],
        lineItems: [],
        taxableAmount: 0,
        subTotal: 0,
        gstRate: 18,
        gstAmount: 0,
        grandTotal: 0
      };
    }

    if (!shipment) {
      return {
        hasValidRateCard: false,
        error: 'Shipment data not provided.',
        warnings: ['No shipment record available for billing calculation.'],
        lineItems: [],
        taxableAmount: 0,
        subTotal: 0,
        gstRate: 18,
        gstAmount: 0,
        grandTotal: 0
      };
    }

    const rawShipmentWeight = shipment.chargeableWeight || Math.max(shipment.actualWeight || 0, shipment.volumetricWeight || 0, 0);
    const shipmentMode = resolveShipmentFreightMode(shipment);

    // Authoritative Backend Freight Calculation Endpoint (Single Source of Truth)
    try {
      const backendCalc = await apiRequest('/invoices/calculate-shipment', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          cnNumber: shipment.cnNumber,
          shipmentId: shipment._id || shipment.id,
          shipment
        })
      });
      if (backendCalc && (backendCalc.hasValidRateCard !== undefined || backendCalc.lineItems)) {
        return backendCalc;
      }
    } catch (calcErr) {
      console.warn('[Billing Engine] Backend calculate-shipment fallback triggered:', calcErr.message);
    }

    // If shipment was confirmed with missing pricing, block agreed rate calculation
    if (shipment.pricingValidation?.status === 'MISSING' || shipment.pricingValidation?.source === 'NONE') {
      const numberOfBoxes = shipment.packages || shipment.numberOfBoxes || shipment.noOfBoxes || shipment.boxes || 1;
      return {
        shipment,
        cnNumber: shipment.cnNumber,
        companyName: shipment.companyName,
        freightMode: shipmentMode,
        numberOfBoxes,
        noOfBoxes: numberOfBoxes,
        boxes: numberOfBoxes,
        noPack: numberOfBoxes,
        rawShipmentWeight,
        minChargeableWeight: 0,
        weight: rawShipmentWeight,
        ratePerKg: 0,
        hasValidRateCard: false,
        isUnpriced: true,
        pricingStatus: 'MISSING',
        error: `Pricing Agreement Missing: ${shipment.companyName || 'This company'} does not have an agreed quotation or rate card for route ${shipment.origin} → ${shipment.destination}.`,
        warnings: [`This shipment has missing pricing coverage and cannot be billed until a valid agreement is established.`],
        matchedQuotation: 'No Quotation / Rate Card',
        quotationVersion: 0,
        matchedRule: null,
        lineItems: [],
        taxableAmount: 0,
        subTotal: 0,
        gstRate: 18,
        gstAmount: 0,
        grandTotal: 0
      };
    }

    // =========================================================================
    // IMMUTABLE PRICING PROTECTION: USE SHIPMENT'S SAVED PRICING SNAPSHOT
    // =========================================================================
    if (shipment.pricingValidation && shipment.pricingValidation.status === 'MATCHED') {
      const pv = shipment.pricingValidation;
      const snap = pv.pricingSnapshot || {};
      const appliedRule = pv.appliedRuleSnapshot || {};

      const ratePerKg = typeof pv.appliedRate === 'number' && pv.appliedRate > 0
        ? pv.appliedRate
        : (snap.baseFreightRate || appliedRule.freightRate || 0);

      const rateBasis = pv.rateBasis || snap.rateBasis || appliedRule.rateBasis || 'Per KG';

      const minChargeableWeight = typeof pv.minimumChargeableWeight === 'number' && pv.minimumChargeableWeight > 0
        ? pv.minimumChargeableWeight
        : (snap.minimumWeight || appliedRule.minimumChargeableWeight || 50);

      const quotationVersion = pv.quotationVersion || pv.rateCardVersion || pv.agreementVersion || snap.agreementVersion || appliedRule.version || 1;
      const matchedQuotationNum = pv.quotationNumber || pv.rateCardNumber || snap.agreementNumber || appliedRule.rateCardNumber || appliedRule.quotationNumber || 'Agreed Rate';

      const numberOfBoxes = shipment.packages || shipment.numberOfBoxes || shipment.noOfBoxes || shipment.boxes || 1;
      const freightCalc = calculateFreightAmount({
        rateBasis,
        baseRate: ratePerKg,
        actualWeight: shipment.actualWeight,
        chargeableWeight: rawShipmentWeight,
        minimumWeight: minChargeableWeight,
        packages: numberOfBoxes
      });
      const effectiveWeight = freightCalc.normalizedBasis === 'PER_KG' ? freightCalc.effectiveWeight : (rawShipmentWeight || minChargeableWeight);
      const freightAmount = freightCalc.freightAmount;

      // Determine additional charges from saved snapshot / shipment
      let docketCharge = 0;
      let pickupCharge = 0;
      let deliveryCharge = 0;

      if (snap.docketCharges !== undefined && snap.docketCharges > 0) {
        docketCharge = snap.docketCharges;
      } else if (appliedRule.additionalCharges && Array.isArray(appliedRule.additionalCharges)) {
        const dItem = appliedRule.additionalCharges.find(c => (c.name || '').toLowerCase().includes('docket'));
        if (dItem) docketCharge = typeof dItem.amount === 'number' ? dItem.amount : (parseFloat(dItem.amount) || 0);
      }

      const chargesOverridden = Boolean(snap.shipmentChargesOverride || shipment.shipmentChargesOverride);

      if (chargesOverridden) {
        pickupCharge = Number(shipment.pickupCharges) || 0;
      } else if (typeof shipment.pickupCharges === 'number' && !isNaN(shipment.pickupCharges) && shipment.pickupCharges > 0) {
        pickupCharge = shipment.pickupCharges;
      } else if (snap.pickupCharges) {
        pickupCharge = snap.pickupCharges;
      }

      if (chargesOverridden) {
        deliveryCharge = Number(shipment.deliveryCharges) || 0;
      } else if (typeof shipment.deliveryCharges === 'number' && !isNaN(shipment.deliveryCharges) && shipment.deliveryCharges > 0) {
        deliveryCharge = shipment.deliveryCharges;
      } else if (snap.deliveryCharges) {
        deliveryCharge = snap.deliveryCharges;
      }

      const packingCharge = Number(shipment.packingCharges) || 0;
      const laborCharge = Number(shipment.laborCharges) || 0;
      const godownAmt = Number(shipment.godownCharges) || 0;

      const gstRateVal = shipment.isGstExempt
        ? 0
        : (chargesOverridden && typeof shipment.gstRate === 'number' && !isNaN(shipment.gstRate))
          ? shipment.gstRate
          : (snap.gstPercentage === 0)
            ? 0
            : (snap.gstPercentage || shipment.gstRate || 18);

      const lineItems = [
        {
          name: 'Freight Charges',
          description: formatFreightDescription({
            rateBasis,
            rate: ratePerKg,
            source: pv.source,
            agreementNumber: matchedQuotationNum,
            version: quotationVersion
          }),
          cnNumber: shipment.cnNumber,
          rateBasis: freightCalc.rateBasisLabel,
          rateBasisNormalized: freightCalc.normalizedBasis,
          weight: freightCalc.normalizedBasis === 'PER_KG' ? effectiveWeight : 0,
          quantity: freightCalc.quantity,
          unit: freightCalc.unit,
          rate: ratePerKg,
          amount: freightAmount
        }
      ];

      if (docketCharge > 0) {
        lineItems.push({
          name: 'Docket / Documentation Charge',
          description: 'Standard CN Docket Documentation Fee',
          cnNumber: shipment.cnNumber,
          weight: 0,
          quantity: 1,
          rate: docketCharge,
          amount: docketCharge
        });
      }

      if (pickupCharge > 0) {
        lineItems.push({
          name: 'Pickup / First-Mile Charge',
          description: 'Origin Pickup & Local Transportation Charge',
          cnNumber: shipment.cnNumber,
          weight: 0,
          quantity: 1,
          rate: pickupCharge,
          amount: pickupCharge
        });
      }

      if (deliveryCharge > 0) {
        lineItems.push({
          name: 'Delivery / Last-Mile Charge',
          description: 'Destination Door Delivery Charge',
          cnNumber: shipment.cnNumber,
          weight: 0,
          quantity: 1,
          rate: deliveryCharge,
          amount: deliveryCharge
        });
      }

      if (packingCharge > 0) {
        lineItems.push({
          name: 'Packing / Material Charge',
          description: 'Protective Packaging & Crating',
          cnNumber: shipment.cnNumber,
          weight: 0,
          quantity: 1,
          rate: packingCharge,
          amount: packingCharge
        });
      }

      if (laborCharge > 0) {
        lineItems.push({
          name: 'Labor / Handling Charge',
          description: 'Cargo Loading & Unloading Labor',
          cnNumber: shipment.cnNumber,
          weight: 0,
          quantity: 1,
          rate: laborCharge,
          amount: laborCharge
        });
      }

      if (godownAmt > 0) {
        lineItems.push({
          name: 'Godown / Storage Charges',
          description: 'Warehouse & Godown Storage Charges',
          cnNumber: shipment.cnNumber,
          weight: 0,
          quantity: 1,
          rate: godownAmt,
          amount: godownAmt
        });
      }

      const taxableAmount = lineItems.reduce((sum, item) => sum + (item.amount || 0), 0);
      const gstAmount = Math.round(taxableAmount * (gstRateVal / 100));
      const grandTotal = taxableAmount + gstAmount;

      return {
        shipment,
        cnNumber: shipment.cnNumber,
        companyName: shipment.companyName,
        freightMode: shipmentMode,
        numberOfBoxes,
        noOfBoxes: numberOfBoxes,
        boxes: numberOfBoxes,
        noPack: numberOfBoxes,
        rawShipmentWeight,
        minChargeableWeight,
        weight: effectiveWeight,
        ratePerKg,
        appliedRate: ratePerKg,
        rateBasis: freightCalc.rateBasisLabel,
        rateBasisNormalized: freightCalc.normalizedBasis,
        rateUnit: freightCalc.unit,
        rateDisplay: freightCalc.rateDisplay,
        freightAmount,
        hasValidRateCard: true,
        matchedQuotation: matchedQuotationNum,
        quotationVersion,
        pricingSource: pv.source,
        pricingStatus: 'MATCHED',
        isImmutableSnapshotUsed: true,
        matchedRule: appliedRule,
        pricingSnapshot: snap,
        lineItems,
        taxableAmount,
        subTotal: taxableAmount,
        gstRate: gstRateVal,
        gstAmount,
        grandTotal,
        billingSnapshot: {
          mode: shipmentMode,
          chargeableWeight: effectiveWeight,
          ratePerKg,
          appliedRate: ratePerKg,
          rateBasis: freightCalc.rateBasisLabel,
          rateBasisNormalized: freightCalc.normalizedBasis,
          quotationNumber: matchedQuotationNum,
          version: quotationVersion,
          pricingSource: pv.source
        }
      };
    }

    let ratePerKg = 0;
    let isRateFoundFromCard = false;
    let minChargeableWeight = 0;
    let docketCharge = 0;
    let pickupCharge = 0;
    let deliveryCharge = 0;
    let fovPercentage = 0;
    let gstRate = 18;
    let matchedQuotationNum = null;
    let quotationVersion = 0;
    let matchedRuleInfo = null;
    const extraCharges = [];
    const warnings = [];

    const godownAmt = typeof shipment.godownCharges === 'number' ? shipment.godownCharges : parseFloat(shipment.godownCharges || 0);

    if (shipment.isGodownOnlyBilling && godownAmt > 0) {
      const numberOfBoxes = shipment.packages || shipment.numberOfBoxes || shipment.noOfBoxes || shipment.boxes || 1;
      const gRate = (shipment.isGstExempt || shipment.gstRate === 0) ? 0 : (shipment.gstRate || 18);
      const godownLineItems = [
        {
          name: 'Godown / Storage Charges',
          description: `Warehouse & Godown Demurrage Storage Charges (${shipment.godownDays || 1} Days @ Hub)`,
          cnNumber: shipment.cnNumber,
          weight: 0,
          quantity: shipment.godownDays || 1,
          unit: 'Day',
          rate: godownAmt,
          amount: godownAmt
        }
      ];
      const subTotal = godownAmt;
      const gstAmount = Math.round(subTotal * (gRate / 100));
      const grandTotal = subTotal + gstAmount;

      return {
        shipment,
        cnNumber: shipment.cnNumber,
        companyName: shipment.companyName,
        numberOfBoxes,
        noOfBoxes: numberOfBoxes,
        boxes: numberOfBoxes,
        noPack: numberOfBoxes,
        rawShipmentWeight,
        minChargeableWeight: 0,
        weight: rawShipmentWeight,
        ratePerKg: 0,
        hasValidRateCard: true,
        matchedQuotation: 'Godown Demurrage Storage Billing',
        quotationVersion: 1,
        matchedRule: null,
        lineItems: godownLineItems,
        taxableAmount: subTotal,
        subTotal: subTotal,
        gstRate: gRate,
        gstAmount: gstAmount,
        grandTotal: grandTotal
      };
    }

    try {
      const allQuotations = await quotationService.getQuotations();

      const sCompName = (shipment.companyName || '').toLowerCase().trim();
      const sCompCode = (shipment.companyCode || '').toLowerCase().trim();
      const sCompId = (shipment.companyId || '').toLowerCase().trim();

      const shipWords = sCompName
        .replace(/[^a-z0-9]/g, ' ')
        .split(/\s+/)
        .filter((w) => w.length > 2 && !['pvt', 'ltd', 'private', 'limited', 'inc', 'corp', 'india'].includes(w));

      let quotations = allQuotations.filter((q) => {
        const qCompName = (q.companyName || '').toLowerCase().trim();
        const qCompCode = (q.companyCode || '').toLowerCase().trim();
        const qCompId = (q.companyId || q.id || '').toLowerCase().trim();

        // 1. Exact Name match or Code/ID match
        if (sCompName && qCompName && (sCompName === qCompName || sCompName.includes(qCompName) || qCompName.includes(sCompName))) return true;
        if (sCompCode && (qCompCode === sCompCode || qCompId === sCompCode)) return true;

        // 2. Token word match (e.g. "techniques surfaces" in "TECHNIQUES SURFACES INDIA PVT LTD.")
        if (shipWords.length > 0) {
          const combinedText = `${qCompName} ${qCompCode} ${qCompId}`;
          const matchedCount = shipWords.filter((w) => combinedText.includes(w)).length;
          if (matchedCount >= Math.min(2, shipWords.length)) return true;
        }

        return false;
      });

      if (quotations.length === 0 && sCompId) {
        quotations = allQuotations.filter((q) => (q.companyId || '').toLowerCase().trim() === sCompId);
      }

      const activeQuotation = quotations.find((q) => q.status === 'Active' || (q.status || '').toLowerCase() === 'approved') || quotations[0];

      if (!activeQuotation) {
        const numberOfBoxes = shipment.packages || shipment.numberOfBoxes || shipment.noOfBoxes || shipment.boxes || 1;
        if (godownAmt > 0) {
          const gRate = (shipment.isGstExempt || shipment.gstRate === 0) ? 0 : (shipment.gstRate || 18);
          let godownDesc = 'Warehouse & Godown Storage Charges';
          let godownQty = 1;
          let godownUnit = 'Job';
          let godownRate = godownAmt;

          if (shipment.godownMonths && shipment.godownRatePerMonth) {
            godownDesc = `Godown Storage Charges (${shipment.godownMonths} Month${shipment.godownMonths > 1 ? 's' : ''} @ ₹${shipment.godownRatePerMonth}/Month)`;
            godownQty = shipment.godownMonths;
            godownUnit = 'Month';
            godownRate = shipment.godownRatePerMonth;
          } else if (shipment.godownDays && shipment.godownRatePerDay) {
            godownDesc = `Godown Storage Charges (${shipment.godownDays} Day${shipment.godownDays > 1 ? 's' : ''} @ ₹${shipment.godownRatePerDay}/Day)`;
            godownQty = shipment.godownDays;
            godownUnit = 'Day';
            godownRate = shipment.godownRatePerDay;
          } else if (shipment.godownMonths) {
            godownDesc = `Godown Storage Charges (${shipment.godownMonths} Month${shipment.godownMonths > 1 ? 's' : ''})`;
            godownQty = shipment.godownMonths;
            godownUnit = 'Month';
          }

          const godownLineItems = [
            {
              name: 'Godown / Storage Charges',
              description: godownDesc,
              cnNumber: shipment.cnNumber,
              weight: 0,
              quantity: godownQty,
              unit: godownUnit,
              rate: godownRate,
              amount: godownAmt
            }
          ];
          const subTotal = godownAmt;
          const gstAmount = Math.round(subTotal * (gRate / 100));
          const grandTotal = subTotal + gstAmount;

          return {
            shipment,
            cnNumber: shipment.cnNumber,
            companyName: shipment.companyName,
            numberOfBoxes,
            noOfBoxes: numberOfBoxes,
            boxes: numberOfBoxes,
            noPack: numberOfBoxes,
            rawShipmentWeight,
            minChargeableWeight: 0,
            weight: rawShipmentWeight,
            ratePerKg: 0,
            hasValidRateCard: true,
            matchedQuotation: 'Godown Demurrage Storage Billing',
            quotationVersion: 1,
            matchedRule: null,
            lineItems: godownLineItems,
            taxableAmount: subTotal,
            subTotal: subTotal,
            gstRate: gRate,
            gstAmount: gstAmount,
            grandTotal: grandTotal
          };
        }

        return {
          shipment,
          cnNumber: shipment.cnNumber,
          companyName: shipment.companyName,
          numberOfBoxes,
          noOfBoxes: numberOfBoxes,
          boxes: numberOfBoxes,
          noPack: numberOfBoxes,
          rawShipmentWeight,
          minChargeableWeight: 0,
          weight: rawShipmentWeight,
          ratePerKg: 0,
          hasValidRateCard: false,
          error: `No active Quotation found for ${shipment.companyName}`,
          warnings: [`No active Quotation or Rate Card found in MongoDB for '${shipment.companyName || 'this company'}'. Please create a Quotation first before generating an invoice.`],
          matchedQuotation: null,
          quotationVersion: 0,
          matchedRule: null,
          lineItems: [],
          taxableAmount: 0,
          subTotal: 0,
          gstRate: 18,
          gstAmount: 0,
          grandTotal: 0
        };
      }

      matchedQuotationNum = activeQuotation.quotationNumber || activeQuotation.id;
      quotationVersion = activeQuotation.version || 1;

      const rulesList = [
        ...(activeQuotation.rateRules || []),
        ...(activeQuotation.routes || [])
      ];

      const cleanHub = (s) => (s || '').replace(/\s*\([^)]*\)/g, '').toLowerCase().trim();
      const sOrigin = cleanHub(shipment.origin);
      const sDest = cleanHub(shipment.destination);
      const sMode = (shipment.mode || shipment.freightMode || '').toLowerCase().trim();

      const isRouteMatch = (r) => {
        const rOrigin = cleanHub(r.origin);
        const rDest = cleanHub(r.destination);
        return (rOrigin === sOrigin && rDest === sDest) ||
               ((rOrigin.includes(sOrigin) || sOrigin.includes(rOrigin)) &&
                (rDest.includes(sDest) || sDest.includes(rDest)));
      };

      const isExactMode = (r) => {
        const rMode = (r.mode || r.freightMode || '').toLowerCase().trim();
        return rMode === sMode;
      };

      const isLooseMode = (r) => {
        const rMode = (r.mode || r.freightMode || '').toLowerCase().trim();
        return !rMode || !sMode || rMode.includes(sMode) || sMode.includes(rMode);
      };

      // Exact route matching — Do NOT use partial or approximate route matching to silently apply agreed prices
      let matchingRule = null;
      if (shipment.pricingValidation?.status === 'MATCHED' && shipment.pricingValidation?.appliedRuleSnapshot) {
        matchingRule = shipment.pricingValidation.appliedRuleSnapshot;
      } else {
        matchingRule =
          rulesList.find((r) => isRouteMatch(r) && isExactMode(r)) ||
          rulesList.find((r) => isRouteMatch(r) && isLooseMode(r)) ||
          rulesList.find((r) => isRouteMatch(r));
      }

      if (matchingRule) {
        matchedRuleInfo = matchingRule;
        minChargeableWeight = matchingRule.minimumChargeableWeight || matchingRule.minChargeableWeight || matchingRule.minWeight || 0;

        if (matchingRule.weightSlabs && Array.isArray(matchingRule.weightSlabs) && matchingRule.weightSlabs.length > 0) {
          const matchedSlab = matchingRule.weightSlabs.find((slab) => {
            const minW = slab.minWeight ?? 0;
            const maxW = slab.maxWeight ? slab.maxWeight : Infinity;
            return rawShipmentWeight >= minW && rawShipmentWeight <= maxW;
          });

          if (matchedSlab && (typeof matchedSlab.rate === 'number' || (typeof matchedSlab.rate === 'string' && matchedSlab.rate !== ''))) {
            ratePerKg = parseFloat(matchedSlab.rate) || 0;
            isRateFoundFromCard = true;
          } else {
            const ruleVal = matchingRule.freightRate ?? matchingRule.ratePerKg ?? matchingRule.rate;
            if (typeof ruleVal === 'number' || (typeof ruleVal === 'string' && ruleVal !== '')) {
              ratePerKg = parseFloat(ruleVal) || 0;
              isRateFoundFromCard = true;
            }
          }
        } else {
          const ruleVal = matchingRule.freightRate ?? matchingRule.ratePerKg ?? matchingRule.rate;
          if (typeof ruleVal === 'number' || (typeof ruleVal === 'string' && ruleVal !== '')) {
            ratePerKg = parseFloat(ruleVal) || 0;
            isRateFoundFromCard = true;
          }
        }

        if (matchingRule.additionalCharges && Array.isArray(matchingRule.additionalCharges)) {
          matchingRule.additionalCharges.forEach((chg) => {
            const chgName = (chg.name || '').toLowerCase();
            const chgAmt = typeof chg.amount === 'number' ? chg.amount : parseFloat(chg.amount || 0);
            if (chgName.includes('docket')) docketCharge = chgAmt;
            else if (chgName.includes('pickup')) pickupCharge = chgAmt;
            else if (chgName.includes('delivery')) deliveryCharge = chgAmt;
            else if (chgName.includes('fov') || chgName.includes('risk')) {
              if ((chg.basis || '').toLowerCase().includes('percentage')) fovPercentage = chgAmt;
              else extraCharges.push({ name: chg.name, amount: chgAmt });
            } else if (chgAmt > 0) {
              extraCharges.push({ name: chg.name, amount: chgAmt });
            }
          });
        }

        if (matchingRule.taxConfiguration && typeof matchingRule.taxConfiguration.gstRate === 'number') {
          gstRate = matchingRule.taxConfiguration.gstRate;
        }
      }

      if (shipment.isGstExempt || shipment.gstRate === 0) {
        gstRate = 0;
        docketCharge = 0;
      } else if (typeof shipment.gstRate === 'number') {
        gstRate = shipment.gstRate;
      }

      if (activeQuotation.additionalCharges && !Array.isArray(activeQuotation.additionalCharges)) {
        const add = activeQuotation.additionalCharges;
        if (typeof add.docketCharge === 'number' && gstRate > 0) docketCharge = add.docketCharge;
        if (typeof add.pickupCharge === 'number') pickupCharge = add.pickupCharge;
        if (typeof add.deliveryCharge === 'number') deliveryCharge = add.deliveryCharge;
        if (typeof add.fovPercentage === 'number') fovPercentage = add.fovPercentage;
      }
    } catch (err) {
      console.warn('[Billing Engine] Rate card lookup error:', err.message);
    }

    const hasRateCard = !!matchedRuleInfo || !!activeQuotation;

    // Shipment-level entered pickup/delivery charges ALWAYS hold higher priority than quotation/rate-card rates
    const shipChargesOverridden = Boolean(shipment.shipmentChargesOverride || shipment.pricingValidation?.pricingSnapshot?.shipmentChargesOverride);
    if (shipChargesOverridden) {
      pickupCharge = Number(shipment.pickupCharges) || 0;
      deliveryCharge = Number(shipment.deliveryCharges) || 0;
    } else {
      if (typeof shipment.pickupCharges === 'number' && !isNaN(shipment.pickupCharges) && shipment.pickupCharges > 0) {
        pickupCharge = shipment.pickupCharges;
      }
      if (typeof shipment.deliveryCharges === 'number' && !isNaN(shipment.deliveryCharges) && shipment.deliveryCharges > 0) {
        deliveryCharge = shipment.deliveryCharges;
      }
    }

    if (gstRate === 0 || shipment.isGstExempt) {
      docketCharge = 0;
    }

    // Fallback rate detection ONLY if no rate card or explicit rate was found
    if (!isRateFoundFromCard) {
      if (typeof shipment.ratePerKg === 'number' && !isNaN(shipment.ratePerKg) && shipment.ratePerKg > 0) {
        ratePerKg = shipment.ratePerKg;
      } else if (typeof shipment.rate === 'number' && !isNaN(shipment.rate) && shipment.rate > 0) {
        ratePerKg = shipment.rate;
      } else if (!activeQuotation) {
        const modeLower = (shipment.mode || shipment.freightMode || '').toLowerCase();
        ratePerKg = modeLower.includes('air') ? 45 : 12;
      }
    }

    if (docketCharge === 0 && !shipment.isGstExempt && !hasRateCard) docketCharge = 100;
    if (pickupCharge === 0 && !hasRateCard) pickupCharge = 500;
    if (deliveryCharge === 0 && !hasRateCard) deliveryCharge = 500;

    const legacyRateBasis = matchedRuleInfo?.rateBasis || 'Per KG';
    const legacyPkgCount = shipment.packages || shipment.numberOfBoxes || shipment.noOfBoxes || shipment.boxes || 1;
    const actualRawWeight = shipment.chargeableWeight || shipment.actualWeight || shipment.volumetricWeight || 0;
    const legacyFreightCalc = calculateFreightAmount({
      rateBasis: legacyRateBasis,
      baseRate: ratePerKg,
      actualWeight: shipment.actualWeight,
      chargeableWeight: actualRawWeight,
      minimumWeight: hasRateCard ? minChargeableWeight : 0,
      packages: legacyPkgCount
    });
    const effectiveWeight = legacyFreightCalc.normalizedBasis === 'PER_KG'
      ? ((hasRateCard && minChargeableWeight > 0) ? Math.max(actualRawWeight, minChargeableWeight) : (actualRawWeight > 0 ? actualRawWeight : 0))
      : (actualRawWeight || minChargeableWeight || 0);

    const freightAmount = legacyFreightCalc.normalizedBasis === 'PER_KG'
      ? Math.round(effectiveWeight * ratePerKg)
      : legacyFreightCalc.freightAmount;

    const lineItems = [];
    if (effectiveWeight > 0 || freightAmount > 0 || (isRateFoundFromCard && ratePerKg > 0)) {
      lineItems.push({
        name: `Freight (${shipment.origin} → ${shipment.destination})`,
        description: formatFreightDescription({
          rateBasis: legacyFreightCalc.rateBasisLabel,
          rate: ratePerKg,
          source: 'QUOTATION',
          agreementNumber: matchedQuotationNum,
          version: quotationVersion
        }),
        cnNumber: shipment.cnNumber,
        rateBasis: legacyFreightCalc.rateBasisLabel,
        rateBasisNormalized: legacyFreightCalc.normalizedBasis,
        weight: legacyFreightCalc.normalizedBasis === 'PER_KG' ? effectiveWeight : 0,
        quantity: legacyFreightCalc.quantity,
        unit: legacyFreightCalc.unit,
        rate: ratePerKg,
        amount: freightAmount
      });
    }

    if (docketCharge > 0) {
      lineItems.push({
        name: 'Docket Charge (Rate Card)',
        description: 'Docket Charge (Rate Card)',
        cnNumber: shipment.cnNumber,
        weight: 0,
        quantity: 1,
        unit: 'Job',
        rate: docketCharge,
        amount: docketCharge
      });
    }

    if (pickupCharge > 0) {
      lineItems.push({
        name: 'Pickup Charge (Rate Card)',
        description: 'Pickup Charge (Rate Card)',
        cnNumber: shipment.cnNumber,
        weight: 0,
        quantity: 1,
        unit: 'Job',
        rate: pickupCharge,
        amount: pickupCharge
      });
    }

    if (deliveryCharge > 0) {
      lineItems.push({
        name: 'Delivery Charge (Rate Card)',
        description: 'Delivery Charge (Rate Card)',
        cnNumber: shipment.cnNumber,
        weight: 0,
        quantity: 1,
        unit: 'Job',
        rate: deliveryCharge,
        amount: deliveryCharge
      });
    }

    extraCharges.forEach((e) => {
      lineItems.push({
        name: `${e.name} (Rate Card)`,
        description: `${e.name} (Rate Card)`,
        cnNumber: shipment.cnNumber,
        weight: 0,
        quantity: 1,
        unit: 'Job',
        rate: e.amount,
        amount: e.amount
      });
    });

    const packingAmt = typeof shipment.packingCharges === 'number' ? shipment.packingCharges : parseFloat(shipment.packingCharges || 0);
    if (packingAmt > 0) {
      lineItems.push({
        name: 'Packing Charges',
        description: 'Special Cargo Packing & Protection Charges',
        cnNumber: shipment.cnNumber,
        weight: 0,
        quantity: 1,
        unit: 'Job',
        rate: packingAmt,
        amount: packingAmt
      });
    }

    const laborAmt = typeof shipment.laborCharges === 'number' ? shipment.laborCharges : parseFloat(shipment.laborCharges || 0);
    if (laborAmt > 0) {
      lineItems.push({
        name: 'Labor & Loading Charges',
        description: 'Labor & Manual Cargo Handling Charges',
        cnNumber: shipment.cnNumber,
        weight: 0,
        quantity: 1,
        unit: 'Job',
        rate: laborAmt,
        amount: laborAmt
      });
    }

    if (godownAmt > 0) {
      let godownDesc = 'Warehouse & Godown Storage Charges';
      let godownQty = 1;
      let godownUnit = 'Job';
      let godownRate = godownAmt;

      if (shipment.godownMonths && shipment.godownRatePerMonth) {
        godownDesc = `Godown Storage Charges (${shipment.godownMonths} Month${shipment.godownMonths > 1 ? 's' : ''} @ ₹${shipment.godownRatePerMonth}/Month)`;
        godownQty = shipment.godownMonths;
        godownUnit = 'Month';
        godownRate = shipment.godownRatePerMonth;
      } else if (shipment.godownDays && shipment.godownRatePerDay) {
        godownDesc = `Godown Storage Charges (${shipment.godownDays} Day${shipment.godownDays > 1 ? 's' : ''} @ ₹${shipment.godownRatePerDay}/Day)`;
        godownQty = shipment.godownDays;
        godownUnit = 'Day';
        godownRate = shipment.godownRatePerDay;
      } else if (shipment.godownMonths) {
        godownDesc = `Godown Storage Charges (${shipment.godownMonths} Month${shipment.godownMonths > 1 ? 's' : ''})`;
        godownQty = shipment.godownMonths;
        godownUnit = 'Month';
      }

      lineItems.push({
        name: 'Godown / Storage Charges',
        description: godownDesc,
        cnNumber: shipment.cnNumber,
        weight: 0,
        quantity: godownQty,
        unit: godownUnit,
        rate: godownRate,
        amount: godownAmt
      });
    }

    if (shipment.isGodownOnlyBilling) {
      const godownItems = lineItems.filter(i => (i.name || '').toLowerCase().includes('godown') || (i.name || '').toLowerCase().includes('storage'));
      lineItems.length = 0;
      if (godownItems.length > 0) {
        lineItems.push(...godownItems);
      }
    }

    const subTotal = lineItems.reduce((acc, item) => acc + item.amount, 0);
    const gstAmount = Math.round(subTotal * (gstRate / 100));
    const grandTotal = subTotal + gstAmount;

    const numberOfBoxes = shipment.packages || shipment.numberOfBoxes || shipment.noOfBoxes || shipment.boxes || 1;

    return {
      shipment,
      cnNumber: shipment.cnNumber,
      companyName: shipment.companyName,
      freightMode: shipmentMode,
      numberOfBoxes,
      noOfBoxes: numberOfBoxes,
      boxes: numberOfBoxes,
      noPack: numberOfBoxes,
      rawShipmentWeight,
      minChargeableWeight,
      weight: effectiveWeight,
      ratePerKg,
      appliedRate: ratePerKg,
      rateBasis: legacyFreightCalc.rateBasisLabel,
      rateBasisNormalized: legacyFreightCalc.normalizedBasis,
      rateUnit: legacyFreightCalc.unit,
      rateDisplay: legacyFreightCalc.rateDisplay,
      freightAmount,
      hasValidRateCard: lineItems.length > 0,
      warnings,
      matchedQuotation: matchedQuotationNum,
      quotationVersion,
      matchedRule: matchedRuleInfo,
      lineItems,
      taxableAmount: subTotal,
      subTotal,
      gstRate,
      gstAmount,
      grandTotal,
      billingSnapshot: {
        mode: shipmentMode,
        chargeableWeight: effectiveWeight,
        ratePerKg,
        appliedRate: ratePerKg,
        rateBasis: legacyFreightCalc.rateBasisLabel,
        rateBasisNormalized: legacyFreightCalc.normalizedBasis,
        quotationNumber: matchedQuotationNum,
        version: quotationVersion
      }
    };
  },

  async getInvoice(id) {
    if (!id || id === 'undefined' || id === 'null' || !String(id).trim()) {
      throw new Error('Invalid Invoice identifier.');
    }

    try {
      const response = await apiRequest(`/invoices/${encodeURIComponent(id)}`);
      if (response && (response.invoiceNumber || response._id)) {
        const formatted = {
          ...response,
          id: response.invoiceNumber || response._id
        };
        const idx = invoicesStore.findIndex(i =>
          i.invoiceNumber === formatted.invoiceNumber ||
          i._id === formatted._id ||
          i.id === formatted.id ||
          i.id === id
        );
        if (idx !== -1) invoicesStore[idx] = formatted;
        else invoicesStore.unshift(formatted);
        return formatted;
      }
    } catch (err) {
      console.warn('[MongoDB Client] Single invoice fetch fallback:', err.message);
    }

    await simulateDelay(120);
    const target = id.toLowerCase();
    const found = invoicesStore.find(
      (inv) => (inv.invoiceNumber && inv.invoiceNumber.toLowerCase() === target) ||
               (inv.id && inv.id.toLowerCase() === target) ||
               (inv._id && inv._id.toString().toLowerCase() === target)
    );
    if (!found) throw new Error(`Invoice '${id}' not found.`);
    return { ...found };
  },

  async createInvoice(invoiceData) {
    try {
      const response = await apiRequest('/invoices', {
        method: 'POST',
        body: JSON.stringify(invoiceData)
      });

      if (response && (response.invoiceNumber || response._id)) {
        const formatted = {
          ...response,
          id: response.id || response.invoiceNumber || response._id
        };
        invoicesStore = [formatted, ...invoicesStore];

        if (invoiceData.cns && Array.isArray(invoiceData.cns)) {
          for (const cn of invoiceData.cns) {
            try {
              await shipmentService.updateShipment(cn, {
                billingStatus: 'Invoiced',
                invoiceId: formatted.invoiceNumber
              });
            } catch (e) {
              console.warn(`Could not update billingStatus for shipment ${cn}:`, e.message);
            }
          }
        }
        return formatted;
      }
    } catch (err) {
      console.warn('[MongoDB Client] Create invoice fallback:', err.message);
    }

    await simulateDelay(250);
    let maxNum = 100;
    invoicesStore.forEach((inv) => {
      if (inv.invoiceNumber) {
        const match = inv.invoiceNumber.match(/SS\d*-?(\d+)/i);
        if (match && match[1]) {
          const num = parseInt(match[1], 10);
          if (num > maxNum) maxNum = num;
        }
      }
    });
    const invoiceNumber = invoiceData.invoiceNumber || `SS2026-${maxNum + 1}`;
    const id = invoiceNumber;

    const newInvoice = {
      ...invoiceData,
      id,
      invoiceNumber,
      status: invoiceData.status || 'Draft',
      createdAt: new Date().toISOString().split('T')[0],
      updatedAt: new Date().toISOString().split('T')[0]
    };

    invoicesStore = [newInvoice, ...invoicesStore];
    return { ...newInvoice };
  },

  async updateInvoice(id, updateData) {
    try {
      const response = await apiRequest(`/invoices/${encodeURIComponent(id)}`, {
        method: 'PUT',
        body: JSON.stringify(updateData)
      });

      if (response && (response.invoiceNumber || response._id)) {
        const formatted = {
          ...response,
          id: response.invoiceNumber || response._id
        };
        const index = invoicesStore.findIndex((inv) =>
          inv.invoiceNumber === formatted.invoiceNumber ||
          inv._id === formatted._id ||
          inv.id === formatted.id ||
          inv.invoiceNumber === id ||
          inv._id === id ||
          inv.id === id
        );
        if (index !== -1) invoicesStore[index] = formatted;
        else invoicesStore.unshift(formatted);
        return formatted;
      }
    } catch (err) {
      console.error('[BillingService] Update invoice failed in MongoDB Atlas:', err);
      // Strictly propagate error to prevent silent in-memory fallback
      throw err;
    }

    throw new Error('Unable to Update Invoice. The changes could not be saved. Please try again.');
  },

  async cancelInvoice(id, cancellationReason = 'Cancelled by Admin') {
    return billingService.updateInvoice(id, {
      status: 'Cancelled',
      cancellationReason,
      balanceAmount: 0,
      balanceDue: 0
    });
  },

  async validateDuplicates({ currentInvoiceId, currentInvoiceNumber, invoiceNumber, dockets }) {
    try {
      const response = await apiRequest('/invoices/validate-duplicates', {
        method: 'POST',
        body: JSON.stringify({
          currentInvoiceId,
          currentInvoiceNumber,
          invoiceNumber,
          dockets
        })
      });
      return response;
    } catch (err) {
      console.warn('[BillingService] validateDuplicates fallback:', err.message);
      // Fallback in-memory validation against invoicesStore
      const normInvNum = (invoiceNumber || '').trim().toLowerCase();
      let invoiceNumberError = null;
      let conflictingInvoice = null;

      if (normInvNum) {
        const found = invoicesStore.find(inv => {
          const invNum = (inv.invoiceNumber || '').trim().toLowerCase();
          const isSame = (currentInvoiceId && (inv.id === currentInvoiceId || inv._id === currentInvoiceId || inv.invoiceNumber === currentInvoiceId)) ||
                         (currentInvoiceNumber && invNum === currentInvoiceNumber.trim().toLowerCase());
          return invNum === normInvNum && !isSame;
        });
        if (found) {
          invoiceNumberError = 'This invoice number already exists. Please enter a unique invoice number.';
          conflictingInvoice = found.invoiceNumber;
        }
      }

      const docketErrors = [];
      const seen = new Map();
      (dockets || []).forEach((d, idx) => {
        const raw = typeof d === 'string' ? d.trim() : (d?.docketNo || d?.cnNumber || '').trim();
        if (!raw) return;
        const norm = raw.toLowerCase();
        if (seen.has(norm)) {
          docketErrors.push({
            index: idx,
            docketNo: raw,
            error: `Duplicate docket number in this invoice (row ${seen.get(norm) + 1} and row ${idx + 1}).`,
            type: 'internal_duplicate'
          });
          return;
        }
        seen.set(norm, idx);

        const conflict = invoicesStore.find(inv => {
          if ((inv.status || '').toLowerCase() === 'cancelled') return false;
          const isSame = (currentInvoiceId && (inv.id === currentInvoiceId || inv._id === currentInvoiceId || inv.invoiceNumber === currentInvoiceId)) ||
                         (currentInvoiceNumber && (inv.invoiceNumber || '').trim().toLowerCase() === currentInvoiceNumber.trim().toLowerCase());
          if (isSame) return false;
          const cns = [
            ...(inv.cns || []),
            ...(inv.shipmentIds || []),
            ...(inv.dockets || []).map(x => x.docketNo || x.cnNumber)
          ].map(x => String(x).trim().toLowerCase());
          return cns.includes(norm);
        });

        if (conflict) {
          docketErrors.push({
            index: idx,
            docketNo: raw,
            error: `This docket number has already been used in invoice ${conflict.invoiceNumber}.`,
            conflictingInvoice: conflict.invoiceNumber,
            type: 'external_duplicate'
          });
        }
      });

      return {
        isValid: !invoiceNumberError && docketErrors.length === 0,
        invoiceNumberError,
        conflictingInvoice,
        docketErrors
      };
    }
  },

  async deleteInvoice(id) {
    try {
      const response = await apiRequest(`/invoices/${encodeURIComponent(id)}`, {
        method: 'DELETE'
      });
      invoicesStore = invoicesStore.filter(
        (inv) => inv.id !== id && inv.invoiceNumber !== id && inv._id !== id
      );
      return response;
    } catch (err) {
      console.warn('[MongoDB Client] Delete invoice fallback:', err.message);
      invoicesStore = invoicesStore.filter(
        (inv) => inv.id !== id && inv.invoiceNumber !== id && inv._id !== id
      );
      return { success: true, message: `Invoice ${id} deleted` };
    }
  }
};
