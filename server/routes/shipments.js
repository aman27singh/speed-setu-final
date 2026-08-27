const express = require('express');
const router = express.Router();
const mongoose = require('mongoose');
const Shipment = require('../models/Shipment');
const Counter = require('../models/Counter');

// GET /api/shipments — List all shipments
router.get('/', async (req, res) => {
  try {
    const { search, status } = req.query;
    let query = {};
    if (status && status !== 'All') {
      query.status = status;
    }
    if (search && search.trim()) {
      const q = search.trim();
      query.$or = [
        { cnNumber: { $regex: q, $options: 'i' } },
        { companyName: { $regex: q, $options: 'i' } },
        { companyCode: { $regex: q, $options: 'i' } },
        { origin: { $regex: q, $options: 'i' } },
        { destination: { $regex: q, $options: 'i' } },
        { ewayBillNumber: { $regex: q, $options: 'i' } },
        { awbNumber: { $regex: q, $options: 'i' } },
        { 'consignor.name': { $regex: q, $options: 'i' } },
        { 'consignee.name': { $regex: q, $options: 'i' } },
        { 'invoiceDetails.invoiceNumber': { $regex: q, $options: 'i' } },
        { 'commercialInvoices.invoiceNumber': { $regex: q, $options: 'i' } },
        { 'commercialInvoices.ewayBillNumber': { $regex: q, $options: 'i' } },
        { 'commercialInvoices.awbNumber': { $regex: q, $options: 'i' } }
      ];
    }
    const list = await Shipment.find(query).sort({ createdAt: -1 });
    res.json(list);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// GET /api/shipments/:idOrCN — Get single shipment details
router.get('/:idOrCN', async (req, res) => {
  try {
    const param = req.params.idOrCN;
    const isValidId = mongoose.isValidObjectId(param);
    const shipment = await Shipment.findOne({
      $or: [
        { cnNumber: new RegExp(`^${param}$`, 'i') },
        ...(isValidId ? [{ _id: param }] : [])
      ]
    });
    if (!shipment) return res.status(404).json({ error: 'Shipment not found' });
    res.json(shipment);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// POST /api/shipments — Create shipment
router.post('/', async (req, res) => {
  try {
    let finalCN = req.body.cnNumber && req.body.cnNumber.trim();
    if (!finalCN || finalCN.startsWith('Auto-generating')) {
      const counter = await Counter.findByIdAndUpdate(
        'cn_seq',
        { $inc: { seq: 1 } },
        { new: true, upsert: true }
      );
      finalCN = `SS${counter.seq}`;
    }

    const cnDate = req.body.cnDate || req.body.bookingDate || new Date().toISOString().split('T')[0];
    const bookingDate = req.body.bookingDate || cnDate;
    const mode = req.body.mode || req.body.freightMode || 'Express LTL';
    const freightMode = req.body.freightMode || mode;

    const consignor = req.body.consignor || req.body.shipper || {};
    const shipper = req.body.shipper || consignor;
    const consignee = req.body.consignee || {};

    const initialHistory = (req.body.statusHistory && req.body.statusHistory.length > 0)
      ? req.body.statusHistory
      : [{
          status: req.body.status || 'Booked',
          timestamp: new Date().toLocaleString('en-IN', { dateStyle: 'short', timeStyle: 'short' }),
          location: req.body.origin || 'Booking Branch Hub',
          remarks: `Shipment created. Consignment Note ${finalCN} issued.`
        }];

    const newShipment = new Shipment({
      ...req.body,
      cnNumber: finalCN,
      cnDate,
      bookingDate,
      mode,
      freightMode,
      consignor,
      shipper,
      consignee,
      chargeableWeight: req.body.chargeableWeight || req.body.volumetricWeight || req.body.actualWeight || 0,
      volumetricWeight: req.body.volumetricWeight || req.body.chargeableWeight || 0,
      billingStatus: req.body.billingStatus || 'Not Ready',
      podStatus: req.body.podStatus || 'Pending',
      statusHistory: initialHistory,
      documents: req.body.documents || []
    });

    const saved = await newShipment.save();
    console.log(`[MongoDB] New Shipment created with CN: ${saved.cnNumber}`);
    res.status(201).json(saved);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// PUT /api/shipments/:idOrCN — Update shipment (by ObjectId or CN Number)
router.put('/:idOrCN', async (req, res) => {
  try {
    const param = req.params.idOrCN;
    const isValidId = mongoose.isValidObjectId(param);

    const updated = await Shipment.findOneAndUpdate(
      {
        $or: [
          { cnNumber: new RegExp(`^${param}$`, 'i') },
          ...(isValidId ? [{ _id: param }] : [])
        ]
      },
      req.body,
      { new: true }
    );

    if (!updated) return res.status(404).json({ error: 'Shipment not found for update' });
    console.log(`[MongoDB] Shipment updated: ${updated.cnNumber} (Docs: ${updated.documents?.length || 0})`);
    res.json(updated);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// DELETE shipment by ID or cnNumber
router.delete('/:id', async (req, res) => {
  try {
    const targetId = req.params.id;
    let deleted = null;

    if (targetId.match(/^[0-9a-fA-F]{24}$/)) {
      deleted = await Shipment.findByIdAndDelete(targetId);
    }
    if (!deleted) {
      deleted = await Shipment.findOneAndDelete({ cnNumber: targetId });
    }

    if (!deleted) {
      return res.status(404).json({ error: 'Shipment not found' });
    }

    console.log(`[MongoDB] Shipment deleted: ${deleted.cnNumber}`);
    res.json({ message: `Shipment ${deleted.cnNumber} deleted successfully`, cnNumber: deleted.cnNumber });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

module.exports = router;
