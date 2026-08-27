const express = require('express');
const router = express.Router();
const mongoose = require('mongoose');
const Transporter = require('../models/Transporter');

router.get('/', async (req, res) => {
  try {
    const list = await Transporter.find().sort({ createdAt: -1 });
    res.json(list);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

router.get('/:id', async (req, res) => {
  try {
    const param = req.params.id;
    const isValidId = mongoose.isValidObjectId(param);
    const item = await Transporter.findOne({
      $or: [
        { transporterId: param },
        { code: new RegExp(`^${param}$`, 'i') },
        ...(isValidId ? [{ _id: param }] : []),
        { name: new RegExp(`^${param}$`, 'i') }
      ]
    });
    if (!item) return res.status(404).json({ error: 'Transporter not found' });
    res.json(item);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

router.post('/', async (req, res) => {
  try {
    const count = await Transporter.countDocuments();
    const nextNum = count + 1;
    const autoId = `TRP-VEND-${String(nextNum).padStart(3, '0')}`;
    const transporterId = req.body.transporterId || autoId;

    const newItem = new Transporter({
      ...req.body,
      transporterId
    });

    const saved = await newItem.save();
    res.status(201).json(saved);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

router.put('/:id', async (req, res) => {
  try {
    const param = req.params.id;
    const isValidId = mongoose.isValidObjectId(param);

    const updated = await Transporter.findOneAndUpdate(
      {
        $or: [
          { transporterId: param },
          { code: new RegExp(`^${param}$`, 'i') },
          ...(isValidId ? [{ _id: param }] : [])
        ]
      },
      req.body,
      { new: true }
    );

    if (!updated) return res.status(404).json({ error: 'Transporter not found for update' });
    res.json(updated);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

module.exports = router;
