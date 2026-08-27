const express = require('express');
const router = express.Router();
const mongoose = require('mongoose');
const Payment = require('../models/Payment');

// GET /api/payments — List payments
router.get('/', async (req, res) => {
  try {
    const list = await Payment.find().sort({ createdAt: -1 });
    res.json(list);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// GET /api/payments/:id — Get single payment
router.get('/:id', async (req, res) => {
  try {
    const param = req.params.id;
    const isValidId = mongoose.isValidObjectId(param);
    const item = await Payment.findOne({
      $or: [
        { paymentNumber: new RegExp(`^${param}$`, 'i') },
        ...(isValidId ? [{ _id: param }] : [])
      ]
    });
    if (!item) return res.status(404).json({ error: 'Payment record not found' });
    res.json(item);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// POST /api/payments — Record payment
router.post('/', async (req, res) => {
  try {
    const count = await Payment.countDocuments();
    const nextNum = count + 101;
    const autoNumber = `PAY-2026-${nextNum}`;
    const paymentNumber = req.body.paymentNumber || autoNumber;

    const newPayment = new Payment({
      ...req.body,
      paymentNumber
    });

    const saved = await newPayment.save();
    console.log(`[MongoDB] New Payment recorded: ${saved.paymentNumber}`);

    // Update corresponding Invoice record directly in MongoDB Atlas
    const invoiceIdentifier = req.body.invoiceNumber || req.body.invoiceId;
    if (invoiceIdentifier) {
      const isValidId = mongoose.isValidObjectId(invoiceIdentifier);
      const Invoice = require('../models/Invoice');

      const inv = await Invoice.findOne({
        $or: [
          { invoiceNumber: new RegExp(`^${invoiceIdentifier}$`, 'i') },
          ...(isValidId ? [{ _id: invoiceIdentifier }] : [])
        ]
      });

      if (inv) {
        const allPayments = await Payment.find({
          $or: [
            { invoiceNumber: inv.invoiceNumber },
            { invoiceId: inv.invoiceNumber },
            { invoiceId: inv._id ? inv._id.toString() : '' }
          ]
        });

        const newPaid = allPayments.reduce((sum, p) => sum + (Number(p.amount) || 0), 0);
        const grandTotal = inv.grandTotal || inv.totalAmount || 0;
        const newBalance = Math.max(0, grandTotal - newPaid);

        let newStatus = inv.status;
        if (newBalance <= 0) {
          newStatus = 'Paid';
        } else if (newPaid > 0) {
          newStatus = 'Partially Paid';
        } else {
          newStatus = 'Draft';
        }

        inv.paidAmount = newPaid;
        inv.balanceAmount = newBalance;
        inv.balanceDue = newBalance;
        inv.status = newStatus;

        inv.markModified('paidAmount');
        inv.markModified('balanceAmount');
        inv.markModified('balanceDue');
        inv.markModified('status');

        await inv.save();
        console.log(`[MongoDB] Updated Invoice ${inv.invoiceNumber}: paidAmount=₹${newPaid}, balanceAmount=₹${newBalance}, status='${newStatus}'`);
      }
    }

    res.status(201).json(saved);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// PUT /api/payments/:id — Update payment
router.put('/:id', async (req, res) => {
  try {
    const param = req.params.id;
    const isValidId = mongoose.isValidObjectId(param);

    const updated = await Payment.findOneAndUpdate(
      {
        $or: [
          { paymentNumber: new RegExp(`^${param}$`, 'i') },
          ...(isValidId ? [{ _id: param }] : [])
        ]
      },
      req.body,
      { new: true }
    );

    if (!updated) return res.status(404).json({ error: 'Payment record not found for update' });
    console.log(`[MongoDB] Payment updated: ${updated.paymentNumber}`);
    res.json(updated);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

module.exports = router;
