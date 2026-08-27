import { apiRequest, simulateDelay } from './apiClient';
import { shipmentService } from './shipmentService';
import { quotationService } from './quotationService';

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
              matchedQuotation: calc.matchedQuotation || (calc.hasValidRateCard ? 'Matched Rate Card' : 'Standard Rate Card'),
              estimatedTotal: estTotal,
              billingCalculation: calc
            };
          } catch (e) {
            const wt = s.chargeableWeight || Math.max(s.actualWeight || 0, s.volumetricWeight || 0, 1);
            const modeLower = (s.mode || s.freightMode || '').toLowerCase();
            const estRate = modeLower.includes('air') ? 45 : 12;
            const fallbackEst = Math.round((wt * estRate + 100 + 500 + 500) * 1.18);
            return {
              ...s,
              chargeableWeight: wt,
              matchedQuotation: 'Standard Rate Card',
              estimatedTotal: fallbackEst
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

    const rawShipmentWeight = shipment.chargeableWeight || Math.max(shipment.actualWeight || 0, shipment.volumetricWeight || 0, 1);

    let ratePerKg = 0;
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
      const companyQueries = [
        shipment.companyId,
        shipment.companyCode,
        shipment.companyName
      ].filter(Boolean);

      let quotations = [];
      for (const queryVal of companyQueries) {
        try {
          const list = await quotationService.getQuotations({ companyId: queryVal });
          if (list && list.length > 0) {
            quotations = list;
            break;
          }
        } catch (e) {
          // continue loop
        }
      }

      if (quotations.length === 0) {
        const allQuotations = await quotationService.getQuotations();
        const compNameLower = (shipment.companyName || '').toLowerCase().trim();
        quotations = allQuotations.filter((q) => {
          const qComp = (q.companyName || '').toLowerCase().trim();
          return qComp && (qComp.includes(compNameLower) || compNameLower.includes(qComp));
        });
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

      const matchingRule =
        rulesList.find((r) => isRouteMatch(r) && isExactMode(r)) ||
        rulesList.find((r) => isRouteMatch(r) && isLooseMode(r)) ||
        rulesList.find((r) => isRouteMatch(r)) ||
        rulesList[0];

      if (matchingRule) {
        matchedRuleInfo = matchingRule;
        minChargeableWeight = matchingRule.minimumChargeableWeight || matchingRule.minChargeableWeight || matchingRule.minWeight || 0;

        if (matchingRule.weightSlabs && Array.isArray(matchingRule.weightSlabs) && matchingRule.weightSlabs.length > 0) {
          const matchedSlab = matchingRule.weightSlabs.find((slab) => {
            const minW = slab.minWeight ?? 0;
            const maxW = slab.maxWeight ? slab.maxWeight : Infinity;
            return rawShipmentWeight >= minW && rawShipmentWeight <= maxW;
          });

          if (matchedSlab && typeof matchedSlab.rate === 'number') {
            ratePerKg = matchedSlab.rate;
          } else {
            ratePerKg = matchingRule.freightRate || matchingRule.ratePerKg || matchingRule.rate || 0;
          }
        } else {
          ratePerKg = matchingRule.freightRate || matchingRule.ratePerKg || matchingRule.rate || 0;
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

    // Override with custom pickup/delivery charges ONLY if explicitly entered as positive values on the shipment (> 0)
    if (typeof shipment.pickupCharges === 'number' && !isNaN(shipment.pickupCharges) && shipment.pickupCharges > 0) {
      pickupCharge = shipment.pickupCharges;
    }
    if (typeof shipment.deliveryCharges === 'number' && !isNaN(shipment.deliveryCharges) && shipment.deliveryCharges > 0) {
      deliveryCharge = shipment.deliveryCharges;
    }

    if (gstRate === 0 || shipment.isGstExempt) {
      docketCharge = 0;
    }

    // Fallback rate detection if ratePerKg is 0
    if (!ratePerKg || ratePerKg === 0) {
      if (shipment.ratePerKg > 0 || shipment.rate > 0) {
        ratePerKg = shipment.ratePerKg || shipment.rate;
      } else {
        const modeLower = (shipment.mode || shipment.freightMode || '').toLowerCase();
        ratePerKg = modeLower.includes('air') ? 45 : 12;
      }
    }

    const hasRateCard = !!matchedRuleInfo || !!activeQuotation;
    if (docketCharge === 0 && !shipment.isGstExempt && !hasRateCard) docketCharge = 100;
    if (pickupCharge === 0 && !hasRateCard) pickupCharge = 500;
    if (deliveryCharge === 0 && !hasRateCard) deliveryCharge = 500;

    const effectiveWeight = Math.max(rawShipmentWeight, minChargeableWeight);
    const freightAmount = effectiveWeight * ratePerKg;

    const lineItems = [];
    if (freightAmount > 0) {
      lineItems.push({
        name: `Freight (${shipment.origin} → ${shipment.destination})`,
        description: `Freight (${shipment.origin} → ${shipment.destination}) [${effectiveWeight} Kg Chargeable Wt @ ₹${ratePerKg}/Kg]`,
        cnNumber: shipment.cnNumber,
        weight: effectiveWeight,
        quantity: effectiveWeight,
        unit: 'Kg',
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
      numberOfBoxes,
      noOfBoxes: numberOfBoxes,
      boxes: numberOfBoxes,
      noPack: numberOfBoxes,
      rawShipmentWeight,
      minChargeableWeight,
      weight: effectiveWeight,
      ratePerKg,
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
      grandTotal
    };
  },

  async getInvoice(id) {
    if (!id || id === 'undefined') throw new Error('Invalid Invoice identifier.');

    try {
      const response = await apiRequest(`/invoices/${encodeURIComponent(id)}`);
      if (response && (response.invoiceNumber || response._id)) {
        return {
          ...response,
          id: response.id || response.invoiceNumber || response._id
        };
      }
    } catch (err) {
      console.warn('[MongoDB Client] Single invoice fetch fallback:', err.message);
    }

    await simulateDelay(120);
    const target = id.toLowerCase();
    const found = invoicesStore.find(
      (inv) => (inv.id && inv.id.toLowerCase() === target) || (inv.invoiceNumber && inv.invoiceNumber.toLowerCase() === target)
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
          id: response.id || response.invoiceNumber || response._id
        };
        const index = invoicesStore.findIndex((inv) => inv.invoiceNumber === formatted.invoiceNumber);
        if (index !== -1) invoicesStore[index] = formatted;
        else invoicesStore.unshift(formatted);
        return formatted;
      }
    } catch (err) {
      console.warn('[MongoDB Client] Update invoice fallback:', err.message);
    }

    await simulateDelay(200);
    const target = id.toLowerCase();
    const index = invoicesStore.findIndex(
      (inv) => (inv.id && inv.id.toLowerCase() === target) || (inv.invoiceNumber && inv.invoiceNumber.toLowerCase() === target)
    );

    if (index === -1) throw new Error(`Invoice '${id}' not found for update.`);

    const updatedInvoice = {
      ...invoicesStore[index],
      ...updateData,
      updatedAt: new Date().toISOString().split('T')[0]
    };

    invoicesStore[index] = updatedInvoice;
    return { ...updatedInvoice };
  },

  async cancelInvoice(id, cancellationReason = 'Cancelled by Admin') {
    return billingService.updateInvoice(id, {
      status: 'Cancelled',
      cancellationReason,
      balanceAmount: 0,
      balanceDue: 0
    });
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
