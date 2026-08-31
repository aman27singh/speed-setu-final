const express = require('express');
const router = express.Router();
const mongoose = require('mongoose');
const Expense = require('../models/Expense');

// GET /api/expenses — List expenses
router.get('/', async (req, res) => {
  try {
    const list = await Expense.find().sort({ createdAt: -1 });
    res.json(list);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// GET /api/expenses/:id — Get single expense
router.get('/:id', async (req, res) => {
  try {
    const param = req.params.id;
    const isValidId = mongoose.isValidObjectId(param);
    const item = await Expense.findOne({
      $or: [
        { expenseId: new RegExp(`^${param}$`, 'i') },
        { expenseNumber: new RegExp(`^${param}$`, 'i') },
        ...(isValidId ? [{ _id: param }] : [])
      ]
    });
    if (!item) return res.status(404).json({ error: 'Expense record not found' });
    res.json(item);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// POST /api/expenses — Record expense
router.post('/', async (req, res) => {
  try {
    let expenseId = req.body.expenseId || req.body.expenseNumber;
    const exists = expenseId ? await Expense.findOne({ expenseId }) : null;

    if (!expenseId || exists) {
      const count = await Expense.countDocuments();
      const nextNum = count + 101;
      const timestamp = Date.now().toString().slice(-4);
      expenseId = `EXP-${nextNum}-${timestamp}`;
    }

    const payload = { ...req.body };
    delete payload._id;
    delete payload.id;

    const newExpense = new Expense({
      ...payload,
      expenseId: expenseId,
      expenseNumber: expenseId
    });

    const saved = await newExpense.save();
    console.log(`[MongoDB Atlas] New Expense recorded: ${saved.expenseId}`);
    res.status(201).json(saved);
  } catch (err) {
    console.error(`[MongoDB Error] Record expense failed: ${err.message}`);
    res.status(500).json({ error: err.message });
  }
});

// PUT /api/expenses/:id — Update expense
router.put('/:id', async (req, res) => {
  try {
    const param = req.params.id;
    const isValidId = mongoose.isValidObjectId(param);

    const updated = await Expense.findOneAndUpdate(
      {
        $or: [
          { expenseId: new RegExp(`^${param}$`, 'i') },
          { expenseNumber: new RegExp(`^${param}$`, 'i') },
          ...(isValidId ? [{ _id: param }] : [])
        ]
      },
      req.body,
      { new: true }
    );

    if (!updated) return res.status(404).json({ error: 'Expense record not found for update' });
    console.log(`[MongoDB] Expense updated: ${updated.expenseId}`);
    res.json(updated);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

module.exports = router;
