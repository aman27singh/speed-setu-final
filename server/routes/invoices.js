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

    const newInvoice = new Invoice({
      ...req.body,
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
