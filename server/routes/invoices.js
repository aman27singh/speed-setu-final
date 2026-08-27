const express = require('express');
const router = express.Router();
const mongoose = require('mongoose');
const Invoice = require('../models/Invoice');

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

    const updated = await Invoice.findOneAndUpdate(
      {
        $or: [
          { invoiceNumber: new RegExp(`^${param}$`, 'i') },
          ...(isValidId ? [{ _id: param }] : [])
        ]
      },
      req.body,
      { new: true }
    );

    if (!updated) return res.status(404).json({ error: 'Invoice not found for update' });
    res.json(updated);
  } catch (err) {
    res.status(500).json({ error: err.message });
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
