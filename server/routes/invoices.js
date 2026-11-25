const express = require('express');
const router = express.Router();
const mongoose = require('mongoose');
const Invoice = require('../models/Invoice');
const {
  syncBilledDockets,
  validateDuplicates,
  claimDocketsForInvoice,
  releaseDocketsForInvoice
} = require('../services/duplicateValidationService');
const {
  calculateFreightAmount,
  getRateBasisMeta,
  resolveShipmentFreightMode,
  calculateShipmentBilling,
  formatFreightDescription
} = require('../services/freightCalculationService');

// Initialize normalized active dockets index once database connection is open
if (mongoose.connection.readyState === 1) {
  syncBilledDockets().catch(e => console.warn('[BilledDocket Notice]:', e.message));
} else {
  mongoose.connection.once('open', () => {
    syncBilledDockets().catch(e => console.warn('[BilledDocket Notice]:', e.message));
  });
}

// POST /api/invoices/validate-duplicates — Real-time duplicate check for invoice and docket numbers
router.post('/validate-duplicates', async (req, res) => {
  try {
    const { currentInvoiceId, currentInvoiceNumber, invoiceNumber, dockets } = req.body;
    const result = await validateDuplicates({
      currentInvoiceId,
      currentInvoiceNumber,
      invoiceNumber,
      dockets: dockets || []
    });
    res.json(result);
  } catch (err) {
    console.error('[Duplicate Validation Route Error]:', err.message);
    res.status(500).json({ error: err.message });
  }
});

// POST /api/invoices/calculate-shipment — Centralized authoritative shipment freight & billing calculation
router.post('/calculate-shipment', async (req, res) => {
  try {
    const Shipment = require('../models/Shipment');
    const { validateShipmentPricing } = require('../services/pricingValidationService');
    const { cnNumber, shipmentId, shipment: rawShipment } = req.body || {};

    let targetShipment = null;
    const lookupKey = cnNumber || shipmentId || rawShipment?.cnNumber || rawShipment?._id || rawShipment?.id;

    if (lookupKey) {
      const keyStr = String(lookupKey).trim();
      const isValidId = mongoose.isValidObjectId(keyStr);
      targetShipment = await Shipment.findOne({
        $or: [
          { cnNumber: new RegExp(`^${keyStr.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}$`, 'i') },
          ...(isValidId ? [{ _id: keyStr }] : [])
        ]
      }).lean();
    }

    if (!targetShipment && rawShipment && typeof rawShipment === 'object') {
      targetShipment = { ...rawShipment };
    }

    if (!targetShipment) {
      return res.status(404).json({ error: 'Shipment not found for billing calculation.' });
    }

    // Preserve historical shipment pricing if already matched at creation;
    // only validate on-the-fly for legacy shipments lacking pricingValidation.
    if (!targetShipment.pricingValidation || !targetShipment.pricingValidation.status) {
      const resolvedPricing = await validateShipmentPricing({
        companyId: targetShipment.companyId,
        companyCode: targetShipment.companyCode,
        companyName: targetShipment.companyName,
        origin: targetShipment.origin,
        destination: targetShipment.destination,
        freightMode: targetShipment.freightMode || targetShipment.mode,
        mode: targetShipment.mode,
        date: targetShipment.bookingDate || targetShipment.cnDate
      }, mongoose.connection);
      targetShipment = { ...targetShipment, pricingValidation: resolvedPricing };
    }

    const calculation = calculateShipmentBilling(targetShipment);
    res.json(calculation);
  } catch (err) {
    console.error('[Invoice Calculate Shipment Error]:', err);
    res.status(500).json({ error: err.message });
  }
});

// GET /api/invoices — List all invoices
router.get('/', async (req, res) => {
  try {
    const { search, status } = req.query;
    let query = {};
    if (status && status !== 'All') query.status = status;

    if (search) {
      const q = search.trim();
      query.$or = [
        { invoiceNumber: { $regex: q, $options: 'i' } },
        { companyName: { $regex: q, $options: 'i' } }
      ];
    }

    const list = await Invoice.find(query).sort({ createdAt: -1 });
    res.json(list);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// GET /api/invoices/:id — Get single invoice
router.get('/:id', async (req, res) => {
  try {
    const param = req.params.id;
    const isValidId = mongoose.isValidObjectId(param);
    const inv = await Invoice.findOne({
      $or: [
        { invoiceNumber: new RegExp(`^${param}$`, 'i') },
        ...(isValidId ? [{ _id: param }] : [])
      ]
    });
    if (!inv) return res.status(404).json({ error: 'Invoice not found' });
    res.json(inv);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// POST /api/invoices — Create invoice
router.post('/', async (req, res) => {
  try {
    let invoiceNumber = req.body.invoiceNumber;

    if (!invoiceNumber) {
      const allInvoices = await Invoice.find({}, { invoiceNumber: 1 });
      let maxNum = 100;
      allInvoices.forEach((inv) => {
        if (inv.invoiceNumber) {
          const match = inv.invoiceNumber.match(/SS\d*-?(\d+)/i);
          if (match && match[1]) {
            const num = parseInt(match[1], 10);
            if (num > maxNum) maxNum = num;
          }
        }
      });
      invoiceNumber = `SS2026-${maxNum + 1}`;
    }

    const associatedCNs = Array.from(new Set([
      ...(req.body.cns || []),
      ...(req.body.shipmentIds || []),
      req.body.cnNumber,
      ...(req.body.dockets || []).map((d) => d.docketNo || d.cnNumber)
    ].filter(Boolean)));

    // Strict duplicate validation before invoice creation
    const validation = await validateDuplicates({
      invoiceNumber,
      dockets: (req.body.dockets && req.body.dockets.length > 0) ? req.body.dockets : associatedCNs
    });

    if (!validation.isValid) {
      return res.status(409).json({
        error: 'Validation failed',
        message: validation.invoiceNumberError || validation.docketErrors[0]?.error || 'Duplicate detected',
        invoiceNumberError: validation.invoiceNumberError,
        conflictingInvoice: validation.conflictingInvoice,
        docketErrors: validation.docketErrors
      });
    }

    // -------------------------------------------------------------
    // Section 6: Mandatory Pricing Validation Before Invoicing
    // Every selected CN must have valid pricing coverage (Quotation or Rate Card).
    // A shipment with pricingValidation.status = MISSING must not be billed.
    // -------------------------------------------------------------
    const Shipment = require('../models/Shipment');
    const { validateShipmentPricing } = require('../services/pricingValidationService');

    const unpricedShipments = [];
    let shipmentsInInvoice = [];

    if (associatedCNs.length > 0) {
      shipmentsInInvoice = await Shipment.find({
        cnNumber: { $in: associatedCNs.map(c => new RegExp(`^${String(c).trim().replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}$`, 'i')) }
      });

      for (const cn of associatedCNs) {
        const found = shipmentsInInvoice.find(s => s.cnNumber?.toLowerCase() === String(cn).toLowerCase());
        if (!found) {
          unpricedShipments.push({
            cnNumber: cn,
            company: req.body.companyName || 'Unknown',
            route: 'Unknown',
            issue: 'Shipment record not found in MongoDB'
          });
          continue;
        }

        // Check if shipment has valid pricingValidation
        let pricing = found.pricingValidation;

        // If legacy shipment has no pricingValidation, run validateShipmentPricing on-the-fly
        if (!pricing || !pricing.status) {
          pricing = await validateShipmentPricing({
            companyId: found.companyId,
            companyCode: found.companyCode,
            companyName: found.companyName,
            origin: found.origin,
            destination: found.destination,
            freightMode: found.freightMode || found.mode,
            mode: found.mode,
            date: found.bookingDate || found.cnDate
          }, mongoose.connection);
        }

        if (pricing.status === 'MISSING' || pricing.source === 'NONE') {
          unpricedShipments.push({
            cnNumber: found.cnNumber,
            company: found.companyName || req.body.companyName || 'Unknown',
            route: `${found.origin || '-'} → ${found.destination || '-'}`,
            issue: 'No quotation / rate card'
          });
        }
      }
    }

    if (unpricedShipments.length > 0) {
      console.warn(`[Invoice Blocked] Invoice generation blocked due to ${unpricedShipments.length} unpriced shipment(s):`, unpricedShipments);
      return res.status(400).json({
        error: 'Pricing Validation Failed',
        message: 'Cannot Generate Tax Invoice – Some selected shipments do not have an applicable quotation or rate card.',
        unpricedShipments
      });
    }

    // Resolve authoritative freight mode from actual shipment record(s), never hardcoding 'TRAIN'
    const shipmentModesSeen = new Map();
    for (const cn of associatedCNs) {
      const matchingShipment = shipmentsInInvoice.find(s => s.cnNumber?.toLowerCase() === String(cn).toLowerCase());
      const m = resolveShipmentFreightMode(matchingShipment);
      if (m) {
        const key = m.toUpperCase();
        if (!shipmentModesSeen.has(key)) shipmentModesSeen.set(key, m);
      }
    }
    const uniqueShipmentModes = Array.from(shipmentModesSeen.values());
    const authoritativeMode = uniqueShipmentModes.length > 0
      ? uniqueShipmentModes.join(' / ')
      : String(req.body.transportDetails?.mode || req.body.mode || req.body.billingSnapshot?.mode || '').trim();

    let finalDockets = req.body.dockets || [];
    let docketsFreightCorrected = false;
    const isGstExemptReq = req.body.isGstExempt === true || req.body.taxMode === 'no_gst' || req.body.gstRate === 0;
    const invoiceGstRate = isGstExemptReq ? 0 : (typeof req.body.gstRate === 'number' ? req.body.gstRate : 18);

    if (Array.isArray(finalDockets) && finalDockets.length > 0 && shipmentsInInvoice) {
      finalDockets = finalDockets.map(d => {
        const matchingShipment = shipmentsInInvoice.find(s => s.cnNumber?.toLowerCase() === (d.docketNo || d.cnNumber)?.toLowerCase());
        const pv = matchingShipment?.pricingValidation;
        const snap = pv?.pricingSnapshot || {};
        const rule = pv?.appliedRuleSnapshot || {};
        const version = pv?.quotationVersion || pv?.rateCardVersion || pv?.agreementVersion || 1;
        const agreementNum = pv?.quotationNumber || pv?.rateCardNumber || d.agreementNumber || 'Agreed Rate';
        const rateBasisRaw = d.rateBasis || pv?.rateBasis || snap.rateBasis || rule.rateBasis || 'Per KG';
        const basisMeta = getRateBasisMeta(rateBasisRaw);
        const appliedRate = (d.rate !== undefined && d.rate > 0) ? d.rate : (pv?.appliedRate || snap.baseFreightRate || 0);
        const shipMode = resolveShipmentFreightMode(matchingShipment) || authoritativeMode;

        let nextFreight = d.freight;
        let nextTaxable = d.taxableAmount;
        let nextCgst = d.cgst || 0;
        let nextSgst = d.sgst || 0;
        let nextIgst = d.igst || 0;
        let nextTotal = d.totalInvoiceValue;

        const isGodownOnly = d.isGodownOnly || matchingShipment?.isGodownOnlyBilling;
        if (!isGodownOnly && matchingShipment && pv?.status === 'MATCHED') {
          const calc = calculateFreightAmount({
            rateBasis: rateBasisRaw,
            baseRate: appliedRate,
            actualWeight: matchingShipment.actualWeight,
            chargeableWeight: (d.weight !== undefined && d.weight > 0) ? d.weight : matchingShipment.chargeableWeight,
            minimumWeight: pv.minimumChargeableWeight || snap.minimumWeight || 50,
            packages: d.noPack || matchingShipment.packages || 1
          });

          if (calc.normalizedBasis === 'PER_SHIPMENT' && Number(nextFreight) !== calc.freightAmount) {
            docketsFreightCorrected = true;
            nextFreight = calc.freightAmount;
            nextTaxable =
              nextFreight +
              (Number(d.docketCharges) || 0) +
              (Number(d.pickupCharges) || 0) +
              (Number(d.deliveryCharges) || 0) +
              (Number(d.packingCharges) || 0) +
              (Number(d.laborCharges) || 0) +
              (Number(d.godownCharges) || 0);
            if (isGstExemptReq || invoiceGstRate === 0) {
              nextCgst = 0;
              nextSgst = 0;
              nextIgst = 0;
            } else if ((Number(d.cgst) || 0) > 0 || (Number(d.sgst) || 0) > 0) {
              nextCgst = Math.round(nextTaxable * (invoiceGstRate / 200));
              nextSgst = Math.round(nextTaxable * (invoiceGstRate / 200));
              nextIgst = 0;
            } else {
              nextIgst = Math.round(nextTaxable * (invoiceGstRate / 100));
              nextCgst = 0;
              nextSgst = 0;
            }
            nextTotal = nextTaxable + nextCgst + nextSgst + nextIgst;
          }
        }

        return {
          ...d,
          rate: appliedRate,
          rateBasis: basisMeta.label,
          rateUnit: basisMeta.unit,
          freightMode: shipMode,
          freight: nextFreight,
          taxableAmount: nextTaxable,
          cgst: nextCgst,
          sgst: nextSgst,
          igst: nextIgst,
          totalInvoiceValue: nextTotal,
          agreementNumber: agreementNum,
          agreementVersion: version,
          pricingSource: pv?.source || d.pricingSource
        };
      });
    }

    let finalTaxableAmount = req.body.taxableAmount;
    let finalSubTotal = req.body.subTotal ?? req.body.subtotal;
    let finalGstAmount = req.body.gstAmount;
    let finalGrandTotal = req.body.grandTotal;
    let finalBalanceAmount = req.body.balanceAmount;
    let finalBalanceDue = req.body.balanceDue;

    if (docketsFreightCorrected && Array.isArray(finalDockets) && finalDockets.length > 0) {
      finalTaxableAmount = finalDockets.reduce((sum, d) => sum + (Number(d.taxableAmount) || 0), 0);
      finalSubTotal = finalTaxableAmount;
      finalGstAmount = isGstExemptReq
        ? 0
        : finalDockets.reduce((sum, d) => sum + (Number(d.cgst) || 0) + (Number(d.sgst) || 0) + (Number(d.igst) || 0), 0);
      finalGrandTotal = finalTaxableAmount + finalGstAmount;
      finalBalanceAmount = finalGrandTotal - (Number(req.body.paidAmount) || 0);
      finalBalanceDue = finalBalanceAmount;
    }

    // Normalize freight line item descriptions if provided
    let finalLineItems = req.body.lineItems;
    if (Array.isArray(finalLineItems) && finalLineItems.length > 0 && finalDockets.length > 0) {
      const primaryDocket = finalDockets[0];
      finalLineItems = finalLineItems.map((item) => {
        if ((item.name || '').toLowerCase().includes('freight') && primaryDocket.rateBasis) {
          const norm = getRateBasisMeta(primaryDocket.rateBasis);
          const correctedAmt = norm.normalizedBasis === 'PER_SHIPMENT' ? Math.round(primaryDocket.rate || item.rate || 0) : item.amount;
          return {
            ...item,
            rateBasis: norm.label,
            unit: norm.unit,
            quantity: norm.normalizedBasis === 'PER_SHIPMENT' ? 1 : item.quantity,
            amount: correctedAmt,
            description: formatFreightDescription({
              rateBasis: norm.label,
              rate: primaryDocket.rate || item.rate || 0,
              source: primaryDocket.pricingSource,
              agreementNumber: primaryDocket.agreementNumber,
              version: primaryDocket.agreementVersion
            })
          };
        }
        return item;
      });
    }

    const newInvoice = new Invoice({
      ...req.body,
      mode: authoritativeMode,
      transportDetails: {
        ...(req.body.transportDetails || {}),
        mode: authoritativeMode
      },
      billingSnapshot: {
        ...(req.body.billingSnapshot || {}),
        mode: authoritativeMode
      },
      ...(finalLineItems ? { lineItems: finalLineItems } : {}),
      ...(finalTaxableAmount !== undefined ? { taxableAmount: finalTaxableAmount, subtotal: finalSubTotal } : {}),
      ...(finalGstAmount !== undefined ? { gstAmount: finalGstAmount, taxAmount: finalGstAmount } : {}),
      ...(finalGrandTotal !== undefined ? { grandTotal: finalGrandTotal, totalAmount: finalGrandTotal } : {}),
      ...(finalBalanceAmount !== undefined ? { balanceAmount: finalBalanceAmount, balanceDue: finalBalanceDue } : {}),
      dockets: finalDockets,
      cns: associatedCNs,
      shipmentIds: associatedCNs,
      cnNumber: associatedCNs[0] || req.body.cnNumber,
      invoiceNumber,
      status: req.body.status || 'Draft'
    });

    const saved = await newInvoice.save();
    console.log(`[MongoDB] New Invoice created: ${saved.invoiceNumber}`);

    // Atomically claim dockets in BilledDocket collection
    await claimDocketsForInvoice({
      invoiceNumber: saved.invoiceNumber,
      invoiceId: saved._id,
      dockets: (saved.dockets && saved.dockets.length > 0) ? saved.dockets : associatedCNs,
      status: saved.status
    });

    // Clean up any old single draft invoices that contained these CNs to prevent double-counting revenue
    try {
      const associatedCNs = [
        ...(req.body.cns || []),
        ...(req.body.shipmentIds || []),
        ...(req.body.dockets || []).map((d) => d.docketNo).filter(Boolean)
      ];

      if (associatedCNs.length > 0) {
        const delRes = await Invoice.deleteMany({
          _id: { $ne: saved._id },
          $or: [
            { cns: { $in: associatedCNs } },
            { shipmentIds: { $in: associatedCNs } },
            { 'dockets.docketNo': { $in: associatedCNs } },
            { cnNumber: { $in: associatedCNs } }
          ]
        });
        if (delRes.deletedCount > 0) {
          console.log(`[MongoDB] Deleted ${delRes.deletedCount} old draft invoices superseded by ${saved.invoiceNumber}`);
        }
      }
    } catch (cleanErr) {
      console.warn(`[MongoDB Warning] Could not cleanup superseded invoices:`, cleanErr.message);
    }

    res.status(201).json(saved);
  } catch (err) {
    console.error(`[MongoDB Error] Create Invoice failed:`, err.message);
    res.status(500).json({ error: err.message });
  }
});

// PUT /api/invoices/:id — Update invoice
router.put('/:id', async (req, res) => {
  try {
    const param = req.params.id;
    const isValidId = mongoose.isValidObjectId(param);

    const existing = await Invoice.findOne({
      $or: [
        { invoiceNumber: new RegExp(`^${param}$`, 'i') },
        ...(isValidId ? [{ _id: param }] : [])
      ]
    });

    if (!existing) return res.status(404).json({ error: 'Invoice not found for update' });

    // Strict duplicate validation before update (excluding current invoice)
    const targetInvoiceNumber = (req.body.invoiceNumber || existing.invoiceNumber).trim();
    const incomingDockets = (req.body.dockets && Array.isArray(req.body.dockets))
      ? req.body.dockets
      : (req.body.cns || existing.dockets || []);

    const validation = await validateDuplicates({
      currentInvoiceId: existing._id,
      currentInvoiceNumber: existing.invoiceNumber,
      invoiceNumber: targetInvoiceNumber,
      dockets: incomingDockets
    });

    if (!validation.isValid) {
      return res.status(409).json({
        error: 'Validation failed',
        message: validation.invoiceNumberError || validation.docketErrors[0]?.error || 'Duplicate detected',
        invoiceNumberError: validation.invoiceNumberError,
        conflictingInvoice: validation.conflictingInvoice,
        docketErrors: validation.docketErrors
      });
    }

    // Calculate normalized totals
    const grandTotal = typeof req.body.grandTotal === 'number'
      ? req.body.grandTotal
      : (typeof req.body.totals?.grandTotal === 'number'
          ? req.body.totals.grandTotal
          : (typeof req.body.totalAmount === 'number' ? req.body.totalAmount : (existing.grandTotal || existing.totalAmount || 0)));

    const taxableAmount = typeof req.body.taxableAmount === 'number'
      ? req.body.taxableAmount
      : (typeof req.body.totals?.totalTaxableAmount === 'number'
          ? req.body.totals.totalTaxableAmount
          : (typeof req.body.subtotal === 'number' ? req.body.subtotal : (existing.taxableAmount || existing.subtotal || 0)));

    const gstAmount = typeof req.body.gstAmount === 'number'
      ? req.body.gstAmount
      : (typeof req.body.taxAmount === 'number'
          ? req.body.taxAmount
          : ((req.body.totals?.totalCgst || 0) + (req.body.totals?.totalSgst || 0) + (req.body.totals?.totalIgst || 0)));

    req.body.grandTotal = grandTotal;
    req.body.totalAmount = grandTotal;
    req.body.taxableAmount = taxableAmount;
    req.body.subtotal = taxableAmount;
    req.body.taxAmount = gstAmount;
    req.body.gstAmount = gstAmount;

    // Balance recalculation honoring any existing payments
    const paidAmount = typeof existing.paidAmount === 'number' ? existing.paidAmount : (req.body.paidAmount || 0);
    const balanceDue = Math.max(0, grandTotal - paidAmount);

    req.body.paidAmount = paidAmount;
    req.body.balanceDue = balanceDue;
    req.body.balanceAmount = balanceDue;

    if (balanceDue === 0 && paidAmount > 0) {
      req.body.status = 'Paid';
    } else if (paidAmount > 0 && balanceDue > 0 && (!req.body.status || req.body.status === 'Draft' || req.body.status === 'Paid')) {
      req.body.status = 'Partially Paid';
    }

    // Sync docket numbers with CNs list
    if (req.body.dockets && Array.isArray(req.body.dockets)) {
      const docketNumbers = req.body.dockets.map((d) => d.docketNo).filter(Boolean);
      if (docketNumbers.length > 0) {
        const uniqueCNs = Array.from(new Set([...(req.body.cns || []), ...docketNumbers]));
        req.body.cns = uniqueCNs;
        req.body.shipmentIds = uniqueCNs;
        req.body.cnNumber = uniqueCNs[0];
      }
    }

    // Record audit history entry
    const auditEntry = {
      modifiedAt: new Date(),
      modifiedBy: req.body.modifiedBy || 'Admin',
      action: req.body.action || 'Invoice Edited',
      previousTotals: {
        taxableAmount: existing.taxableAmount || existing.subtotal || 0,
        gstAmount: existing.gstAmount || existing.taxAmount || 0,
        grandTotal: existing.grandTotal || existing.totalAmount || 0,
        status: existing.status
      },
      newTotals: {
        taxableAmount,
        gstAmount,
        grandTotal,
        status: req.body.status || existing.status
      },
      summary: req.body.changeSummary || 'Full invoice details updated via Invoice Editor'
    };

    const existingHistory = Array.isArray(existing.auditHistory) ? existing.auditHistory : [];
    req.body.auditHistory = [...existingHistory, auditEntry];

    // SANITIZE UPDATE PAYLOAD:
    // Strip immutable MongoDB paths (_id, id, __v) so MongoDB never rejects with
    // "Performing an update on the path '_id' would modify the immutable field '_id'"
    const updatePayload = { ...req.body };
    delete updatePayload._id;
    delete updatePayload.id;
    delete updatePayload.__v;
    delete updatePayload.createdAt;
    delete updatePayload.updatedAt;

    if (updatePayload.invoiceNumber) {
      updatePayload.invoiceNumberNormalized = updatePayload.invoiceNumber.trim().toLowerCase();
    }

    const updated = await Invoice.findByIdAndUpdate(
      existing._id,
      { $set: updatePayload },
      { new: true, runValidators: false }
    );

    console.log(`[MongoDB] Invoice ${updated.invoiceNumber} updated successfully. GrandTotal: ₹${grandTotal}, Balance: ₹${balanceDue}`);

    // Atomically claim or update dockets in BilledDocket collection
    await claimDocketsForInvoice({
      invoiceNumber: updated.invoiceNumber,
      invoiceId: updated._id,
      dockets: (updated.dockets && updated.dockets.length > 0) ? updated.dockets : (updated.cns || []),
      status: updated.status
    });

    // Update Company KPIs if company is linked
    try {
      const compId = req.body.companyId || existing.companyId;
      const compName = req.body.companyName || existing.companyName;
      if (compId || compName) {
        const Company = require('../models/Company');
        const companyInvoices = await Invoice.find({
          $or: [
            ...(compId ? [{ companyId: compId }] : []),
            ...(compName ? [{ companyName: compName }] : [])
          ],
          status: { $nin: ['Cancelled', 'Void'] }
        });

        const totalBilling = companyInvoices.reduce((sum, inv) => sum + (inv.grandTotal || inv.totalAmount || 0), 0);
        const outstandingAmount = companyInvoices.reduce((sum, inv) => sum + (inv.balanceAmount ?? inv.balanceDue ?? inv.grandTotal ?? 0), 0);

        await Company.updateMany(
          {
            $or: [
              ...(compId ? [
                ...(mongoose.isValidObjectId(compId) ? [{ _id: compId }] : []),
                { companyId: compId },
                { companyCode: compId }
              ] : []),
              ...(compName ? [{ companyName: compName }] : [])
            ]
          },
          {
            $set: {
              'kpis.totalBilling': totalBilling,
              'kpis.outstandingAmount': outstandingAmount
            }
          }
        );
      }
    } catch (kpiErr) {
      console.warn(`[MongoDB Warning] Could not update company KPIs:`, kpiErr.message);
    }

    res.json(updated);
  } catch (err) {
    console.error(`[MongoDB Error] Update Invoice failed:`, err.message);
    res.status(500).json({
      error: err.message,
      message: 'Unable to Update Invoice. The changes could not be saved. Please try again.'
    });
  }
});

// DELETE /api/invoices/:id — Delete invoice by ID or invoiceNumber
router.delete('/:id', async (req, res) => {
  try {
    const param = req.params.id;
    const isValidId = mongoose.isValidObjectId(param);

    const deleted = await Invoice.findOneAndDelete({
      $or: [
        { invoiceNumber: new RegExp(`^${param}$`, 'i') },
        ...(isValidId ? [{ _id: param }] : [])
      ]
    });

    if (!deleted) return res.status(404).json({ error: 'Invoice not found for deletion' });
    console.log(`[MongoDB] Invoice deleted: ${deleted.invoiceNumber}`);

    // Release dockets from BilledDocket collection
    await releaseDocketsForInvoice({
      invoiceNumber: deleted.invoiceNumber,
      invoiceId: deleted._id
    });

    try {
      const Shipment = require('../models/Shipment');
      const associatedCNs = [
        ...(deleted.cns || []),
        ...(deleted.shipmentIds || []),
        ...(deleted.dockets || []).map((d) => d.docketNo).filter(Boolean)
      ];
      if (associatedCNs.length > 0) {
        await Shipment.updateMany(
          {
            $or: [
              { cnNumber: { $in: associatedCNs } },
              { _id: { $in: associatedCNs.filter((id) => mongoose.isValidObjectId(id)) } }
            ]
          },
          { $set: { billingStatus: 'Not Ready', invoiceId: '' } }
        );
        console.log(`[MongoDB] Reset billingStatus to 'Not Ready' for CNs:`, associatedCNs);
      }
    } catch (e) {
      console.warn(`[MongoDB Warning] Could not reset shipment billing status:`, e.message);
    }

    res.json({ message: `Invoice ${deleted.invoiceNumber} deleted successfully`, invoiceNumber: deleted.invoiceNumber });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

module.exports = router;
