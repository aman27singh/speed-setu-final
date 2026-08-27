const express = require('express');
const router = express.Router();
const mongoose = require('mongoose');
const Trip = require('../models/Trip');

// GET /api/trips — List all trips
router.get('/', async (req, res) => {
  try {
    const { search, status } = req.query;
    let query = {};
    if (status && status !== 'All') query.status = status;

    if (search) {
      const q = search.trim();
      query.$or = [
        { tripNumber: { $regex: q, $options: 'i' } },
        { origin: { $regex: q, $options: 'i' } },
        { destination: { $regex: q, $options: 'i' } },
        { vehicleNumber: { $regex: q, $options: 'i' } },
        { driverName: { $regex: q, $options: 'i' } }
      ];
    }

    const list = await Trip.find(query).sort({ createdAt: -1 });
    res.json(list);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// GET /api/trips/:id — Get single trip
router.get('/:id', async (req, res) => {
  try {
    const param = req.params.id;
    const isValidId = mongoose.isValidObjectId(param);
    const trip = await Trip.findOne({
      $or: [
        { tripNumber: new RegExp(`^${param}$`, 'i') },
        ...(isValidId ? [{ _id: param }] : [])
      ]
    });
    if (!trip) return res.status(404).json({ error: 'Trip not found' });
    res.json(trip);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// POST /api/trips — Create trip
router.post('/', async (req, res) => {
  try {
    const count = await Trip.countDocuments();
    const nextNum = count + 101;
    const autoNumber = `TRP-${nextNum}`;
    const tripNumber = req.body.tripNumber || autoNumber;

    const initialHistory = (req.body.statusHistory && req.body.statusHistory.length > 0)
      ? req.body.statusHistory
      : [{
          status: req.body.status || 'Planned',
          timestamp: new Date().toLocaleString('en-IN', { dateStyle: 'short', timeStyle: 'short' }),
          location: req.body.origin || 'Dispatch Office',
          remarks: `Trip ${tripNumber} created.`
        }];

    const newTrip = new Trip({
      ...req.body,
      tripNumber,
      status: req.body.status || 'Planned',
      statusHistory: initialHistory
    });

    const saved = await newTrip.save();
    console.log(`[MongoDB] New Trip created: ${saved.tripNumber}`);
    res.status(201).json(saved);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// PUT /api/trips/:id — Update trip
router.put('/:id', async (req, res) => {
  try {
    const param = req.params.id;
    const isValidId = mongoose.isValidObjectId(param);

    const updated = await Trip.findOneAndUpdate(
      {
        $or: [
          { tripNumber: new RegExp(`^${param}$`, 'i') },
          ...(isValidId ? [{ _id: param }] : [])
        ]
      },
      req.body,
      { new: true }
    );

    if (!updated) return res.status(404).json({ error: 'Trip not found for update' });
    res.json(updated);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

module.exports = router;
