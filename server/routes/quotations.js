const express = require('express');
const router = express.Router();
const mongoose = require('mongoose');
const Quotation = require('../models/Quotation');

// GET /api/quotations — List all quotations (with flexible company matching)
router.get('/', async (req, res) => {
  try {
    const { search, status, companyId } = req.query;
    let query = {};
    if (status && status !== 'All') query.status = status;

    if (companyId && companyId !== 'All') {
      const compRegex = new RegExp(`^${companyId.trim()}$`, 'i');
      const compContainsRegex = new RegExp(companyId.trim(), 'i');
      query.$or = [
        { companyId: companyId },
        { companyId: compRegex },
        { companyCode: compRegex },
        { companyName: compContainsRegex }
      ];
    }

    if (search) {
      const q = search.trim();
      const searchConditions = [
        { quotationNumber: { $regex: q, $options: 'i' } },
        { companyName: { $regex: q, $options: 'i' } },
        { companyCode: { $regex: q, $options: 'i' } }
      ];
      if (query.$or) {
        query.$and = [{ $or: query.$or }, { $or: searchConditions }];
        delete query.$or;
      } else {
        query.$or = searchConditions;
      }
    }

    const list = await Quotation.find(query).sort({ createdAt: -1 });
    res.json(list);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// GET /api/quotations/:id — Get single quotation
router.get('/:id', async (req, res) => {
  try {
    const param = req.params.id;
    const isValidId = mongoose.isValidObjectId(param);
    const q = await Quotation.findOne({
      $or: [
        ...(isValidId ? [{ _id: param }] : []),
        { quotationNumber: new RegExp(`^${param}$`, 'i') }
      ]
    });
    if (!q) return res.status(404).json({ error: 'Quotation not found' });
    res.json(q);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// POST /api/quotations — Create new quotation
router.post('/', async (req, res) => {
  try {
    const payload = { ...req.body };
    delete payload._id;
    delete payload.id;

    if (!payload.quotationNumber || payload.quotationNumber === 'Auto-generated on Save') {
      const count = await Quotation.countDocuments();
      const nextNum = count + 1;
      payload.quotationNumber = `QT-2026-${String(nextNum).padStart(3, '0')}`;
    }

    const newQuotation = new Quotation({
      ...payload,
      version: payload.version || 1,
      status: payload.status || 'Active'
    });

    const saved = await newQuotation.save();
    console.log(`[MongoDB] New Quotation created: ${saved.quotationNumber} (v${saved.version}) ID: ${saved._id}`);
    res.status(201).json(saved);
  } catch (err) {
    console.error('[MongoDB Error] Quotation creation error:', err.message);
    res.status(500).json({ error: err.message });
  }
});

// PUT /api/quotations/:id — Update quotation
router.put('/:id', async (req, res) => {
  try {
    const param = req.params.id;
    const isValidId = mongoose.isValidObjectId(param);

    const updated = await Quotation.findOneAndUpdate(
      {
        $or: [
          { quotationNumber: new RegExp(`^${param}$`, 'i') },
          ...(isValidId ? [{ _id: param }] : [])
        ]
      },
      req.body,
      { new: true }
    );

    if (!updated) return res.status(404).json({ error: 'Quotation not found for update' });
    res.json(updated);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

module.exports = router;
