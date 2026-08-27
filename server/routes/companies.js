const express = require('express');
const router = express.Router();
const mongoose = require('mongoose');
const Company = require('../models/Company');

// GET /api/companies — List all companies
router.get('/', async (req, res) => {
  try {
    const { search, status } = req.query;
    let query = {};
    if (status && status !== 'All') {
      query.status = status;
    }
    if (search) {
      const q = search.trim();
      query.$or = [
        { companyName: { $regex: q, $options: 'i' } },
        { companyCode: { $regex: q, $options: 'i' } },
        { companyId: { $regex: q, $options: 'i' } },
        { gstin: { $regex: q, $options: 'i' } },
        { 'primaryContact.name': { $regex: q, $options: 'i' } },
        { 'primaryContact.email': { $regex: q, $options: 'i' } }
      ];
    }
    const companies = await Company.find(query).sort({ createdAt: -1 });
    res.json(companies);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// GET /api/companies/:id — Get single company details
router.get('/:id', async (req, res) => {
  try {
    const param = req.params.id;
    const isValidId = mongoose.isValidObjectId(param);
    const company = await Company.findOne({
      $or: [
        { companyId: param },
        { companyCode: new RegExp(`^${param}$`, 'i') },
        ...(isValidId ? [{ _id: param }] : []),
        { companyName: new RegExp(`^${param}$`, 'i') }
      ]
    });
    if (!company) return res.status(404).json({ error: 'Company not found' });
    res.json(company);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// POST /api/companies — Create new company
router.post('/', async (req, res) => {
  try {
    const count = await Company.countDocuments();
    const nextNum = count + 1;
    const autoCode = `COM-${String(nextNum).padStart(3, '0')}`;
    const autoId = `comp-${String(nextNum).padStart(3, '0')}`;

    const companyCode = (req.body.companyCode && !req.body.companyCode.includes('Auto-generated'))
      ? req.body.companyCode
      : autoCode;
    const companyId = req.body.companyId || autoId;

    const newCompany = new Company({
      ...req.body,
      companyCode,
      companyId,
      status: req.body.status || 'Active'
    });

    const saved = await newCompany.save();
    console.log(`[MongoDB] New Company created: ${saved.companyName} (${saved.companyCode})`);
    res.status(201).json(saved);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// PUT /api/companies/:id — Update company
router.put('/:id', async (req, res) => {
  try {
    const param = req.params.id;
    const isValidId = mongoose.isValidObjectId(param);

    const updated = await Company.findOneAndUpdate(
      {
        $or: [
          { companyId: param },
          { companyCode: new RegExp(`^${param}$`, 'i') },
          ...(isValidId ? [{ _id: param }] : [])
        ]
      },
      req.body,
      { new: true }
    );

    if (!updated) return res.status(404).json({ error: 'Company not found for update' });
    res.json(updated);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

module.exports = router;
