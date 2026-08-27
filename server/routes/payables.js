const express = require('express');
const router = express.Router();
const mongoose = require('mongoose');
const Payable = require('../models/Payable');

// GET /api/payables — List payables
router.get('/', async (req, res) => {
  try {
    const list = await Payable.find().sort({ createdAt: -1 });
    res.json(list);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// GET /api/payables/:id — Get single payable
router.get('/:id', async (req, res) => {
  try {
    const param = req.params.id;
    const isValidId = mongoose.isValidObjectId(param);
    const item = await Payable.findOne({
      $or: [
        { payableId: new RegExp(`^${param}$`, 'i') },
        { payableNumber: new RegExp(`^${param}$`, 'i') },
        ...(isValidId ? [{ _id: param }] : [])
      ]
    });
    if (!item) return res.status(404).json({ error: 'Payable record not found' });
    res.json(item);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// POST /api/payables — Record payable
router.post('/', async (req, res) => {
  try {
    const count = await Payable.countDocuments();
    const nextNum = count + 101;
    const autoId = `PAYABLE-${nextNum}`;
    const payableId = req.body.payableId || req.body.payableNumber || autoId;

    const newPayable = new Payable({
      ...req.body,
      payableId,
      payableNumber: payableId,
      vendorName: req.body.vendorName || req.body.payeeName || 'Transporter / Vendor'
    });

    const saved = await newPayable.save();
    console.log(`[MongoDB] New Payable recorded: ${saved.payableId}`);
    res.status(201).json(saved);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// PUT /api/payables/:id — Update payable (e.g. record payout / settlement)
router.put('/:id', async (req, res) => {
  try {
    const param = req.params.id;
    const isValidId = mongoose.isValidObjectId(param);

    const updated = await Payable.findOneAndUpdate(
      {
        $or: [
          { payableId: new RegExp(`^${param}$`, 'i') },
          { payableNumber: new RegExp(`^${param}$`, 'i') },
          ...(isValidId ? [{ _id: param }] : [])
        ]
      },
      req.body,
      { new: true }
    );

    if (!updated) return res.status(404).json({ error: 'Payable record not found for update' });
    console.log(`[MongoDB] Payable updated: ${updated.payableId} (Status: ${updated.status})`);
    res.json(updated);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

module.exports = router;
