const express = require('express');
const router = express.Router();
const mongoose = require('mongoose');
const ConsignorConsignee = require('../models/ConsignorConsignee');
const Shipment = require('../models/Shipment');
const { getNextPartyCode, previewNextPartyCode, normalizeAddress, findExistingParty } = require('../services/consignorConsigneeService');

/**
 * Speed Setu - Consignors & Consignees Shared Company Master API
 * 
 * CORE BUSINESS RULE:
 * One company = One master record = One company code (COM-XXX).
 * Every company is stored only once and can be used interchangeably as both Consignor and Consignee.
 */

// GET /api/consignor-consignee/stats — Summary Counts
router.get('/stats', async (req, res) => {
  try {
    const [total, active] = await Promise.all([
      ConsignorConsignee.countDocuments(),
      ConsignorConsignee.countDocuments({ isActive: true })
    ]);

    res.json({
      total,
      active,
      inactive: total - active,
      // Backward compatibility fields
      consignors: total,
      consignees: total
    });
  } catch (err) {
    console.error('[ConsignorConsignee Stats Error]:', err);
    res.status(500).json({ error: err.message });
  }
});

// GET /api/consignor-consignee/next-code — Read-only preview of next auto-generated company code (does not increment counter)
router.get('/next-code', async (req, res) => {
  try {
    const nextCode = await previewNextPartyCode(mongoose.connection);
    res.json({ nextCode });
  } catch (err) {
    console.error('[ConsignorConsignee Next Code Error]:', err);
    res.status(500).json({ error: err.message });
  }
});

// GET /api/consignor-consignee/search — Quick Autocomplete Endpoint (Strictly active saved master records)
router.get('/search', async (req, res) => {
  try {
    const q = (req.query.q || req.query.query || req.query.search || '').trim();
    const query = { isActive: true };

    if (q) {
      const escaped = q.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
      query.$or = [
        { companyName: { $regex: escaped, $options: 'i' } },
        { companyCode: { $regex: escaped, $options: 'i' } },
        { gstNumber: { $regex: escaped, $options: 'i' } },
        { 'address.city': { $regex: escaped, $options: 'i' } },
        { pickupDeliveryLocation: { $regex: escaped, $options: 'i' } }
      ];
    }

    const items = await ConsignorConsignee.find(query)
      .sort({ companyName: 1 })
      .limit(100)
      .lean();

    res.json(items.map(p => ({
      ...p,
      id: p._id.toString()
    })));
  } catch (err) {
    console.error('[ConsignorConsignee Search Error]:', err);
    res.status(500).json({ error: err.message });
  }
});

// GET /api/consignor-consignee — List & Filter Companies
router.get('/', async (req, res) => {
  try {
    const {
      search,
      city,
      state,
      status,
      isActive,
      page = 1,
      limit = 50,
      all,
      autocomplete
    } = req.query;

    const filter = {};

    // 1. Status / Active Filter
    if (isActive !== undefined && isActive !== '') {
      filter.isActive = String(isActive).toLowerCase() === 'true';
    } else if (status && status !== 'All') {
      filter.isActive = status.toLowerCase() === 'active';
    }

    // 2. Location Filters
    if (city && city !== 'All') {
      filter['address.city'] = new RegExp(`^${city.trim().replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}$`, 'i');
    }
    if (state && state !== 'All') {
      filter['address.state'] = new RegExp(`^${state.trim().replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}$`, 'i');
    }

    // 3. Search Filter
    if (search && search.trim()) {
      const q = search.trim();
      const escaped = q.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
      filter.$or = [
        { companyName: { $regex: escaped, $options: 'i' } },
        { companyCode: { $regex: escaped, $options: 'i' } },
        { gstNumber: { $regex: escaped, $options: 'i' } },
        { 'address.city': { $regex: escaped, $options: 'i' } },
        { 'address.state': { $regex: escaped, $options: 'i' } },
        { 'address.pinCode': { $regex: escaped, $options: 'i' } },
        { contactPerson: { $regex: escaped, $options: 'i' } },
        { mobileNumber: { $regex: escaped, $options: 'i' } },
        { email: { $regex: escaped, $options: 'i' } }
      ];
    }

    // 4. Autocomplete / Unpaginated Fetch (Strictly active records for autocomplete)
    if (all === 'true' || autocomplete === 'true') {
      if (autocomplete === 'true') {
        filter.isActive = true;
      }
      const items = await ConsignorConsignee.find(filter)
        .sort({ companyName: 1 })
        .lean();

      return res.json(items.map(p => ({
        ...p,
        id: p._id.toString()
      })));
    }

    // 5. Paginated Result
    const pageNum = Math.max(1, parseInt(page, 10) || 1);
    const limitNum = Math.min(200, Math.max(1, parseInt(limit, 10) || 50));
    const skip = (pageNum - 1) * limitNum;

    const [items, totalCount] = await Promise.all([
      ConsignorConsignee.find(filter)
        .sort({ createdAt: -1 })
        .skip(skip)
        .limit(limitNum)
        .lean(),
      ConsignorConsignee.countDocuments(filter)
    ]);

    res.json({
      items: items.map(p => ({ ...p, id: p._id.toString() })),
      total: totalCount,
      page: pageNum,
      totalPages: Math.ceil(totalCount / limitNum),
      limit: limitNum
    });
  } catch (err) {
    console.error('[ConsignorConsignee List Error]:', err);
    res.status(500).json({ error: err.message });
  }
});

// GET /api/consignor-consignee/:id — Single Company
router.get('/:id', async (req, res) => {
  try {
    const { id } = req.params;
    let party = null;

    if (mongoose.Types.ObjectId.isValid(id)) {
      party = await ConsignorConsignee.findById(id).lean();
    }
    if (!party) {
      party = await ConsignorConsignee.findOne({ companyCode: id.toUpperCase() }).lean();
    }

    if (!party) {
      return res.status(404).json({ error: `Company '${id}' not found.` });
    }

    res.json({ ...party, id: party._id.toString() });
  } catch (err) {
    console.error('[ConsignorConsignee Get Single Error]:', err);
    res.status(500).json({ error: err.message });
  }
});

// POST /api/consignor-consignee — Create New Company
router.post('/', async (req, res) => {
  try {
    const {
      companyName,
      address,
      fullAddress,
      gstNumber,
      contactPerson,
      mobileNumber,
      email,
      isActive = true,
      pickupDeliveryLocation,
      pickupDelivery
    } = req.body;

    // Validate Required Fields
    if (!companyName || !companyName.trim()) {
      return res.status(400).json({ error: 'Company Name is required.' });
    }

    const addrObj = normalizeAddress(address || fullAddress);
    const cleanName = companyName.trim().toUpperCase();
    const cleanGst = (gstNumber || '').trim().toUpperCase();
    const cleanPickupDelivery = (pickupDeliveryLocation || pickupDelivery || '').trim().toUpperCase();

    // 1. Check for Duplicate Company Record (Same Company Name + Same Normalized Complete Address)
    // Multiple locations for the same company (e.g., Bangalore, Chennai) are explicitly allowed!
    const existingDuplicate = await findExistingParty({
      companyName: cleanName,
      address: addrObj,
      fullAddress
    }, mongoose.connection);

    if (existingDuplicate) {
      return res.status(409).json({
        error: `A record for "${cleanName}" at this location (${addrObj.city || addrObj.addressLine1 || 'specified address'}) already exists (${existingDuplicate.companyCode}). To update details, please edit the existing record.`,
        existingParty: {
          id: existingDuplicate._id.toString(),
          companyName: existingDuplicate.companyName,
          companyCode: existingDuplicate.companyCode,
          city: existingDuplicate.address?.city,
          pinCode: existingDuplicate.address?.pinCode
        }
      });
    }

    // 2. Note: GST number is intentionally NOT restricted to a single record,
    // as multiple business locations may share the same GSTIN.

    // 3. Atomically generate Unique Company Code strictly upon saving (CC101, CC102...)
    const companyCode = await getNextPartyCode(mongoose.connection);

    const fullAddr = fullAddress || [
      addrObj.addressLine1,
      addrObj.addressLine2,
      addrObj.city,
      addrObj.state,
      addrObj.pinCode ? `PIN: ${addrObj.pinCode}` : ''
    ].filter(Boolean).join(', ');

    const newParty = new ConsignorConsignee({
      companyName: cleanName,
      companyCode,
      address: addrObj,
      fullAddress: fullAddr,
      gstNumber: cleanGst,
      pickupDeliveryLocation: cleanPickupDelivery,
      contactPerson: (contactPerson || '').trim(),
      mobileNumber: (mobileNumber || '').trim(),
      email: (email || '').trim().toLowerCase(),
      isActive: Boolean(isActive),
      partyType: 'SHARED'
    });

    const saved = await newParty.save();
    res.status(201).json({ ...saved.toObject(), id: saved._id.toString() });
  } catch (err) {
    console.error('[ConsignorConsignee Create Error]:', err);
    if (err.code === 11000) {
      return res.status(409).json({ error: 'Duplicate company code or GST number detected.' });
    }
    res.status(500).json({ error: err.message });
  }
});

// PUT /api/consignor-consignee/:id — Update Existing Company
router.put('/:id', async (req, res) => {
  try {
    const { id } = req.params;
    const party = await ConsignorConsignee.findById(id);

    if (!party) {
      return res.status(404).json({ error: `Company '${id}' not found.` });
    }

    const {
      companyName,
      address,
      fullAddress,
      gstNumber,
      contactPerson,
      mobileNumber,
      email,
      isActive,
      pickupDeliveryLocation,
      pickupDelivery
    } = req.body;

    if (companyName && !companyName.trim()) {
      return res.status(400).json({ error: 'Company Name cannot be empty.' });
    }

    const cleanGst = (gstNumber !== undefined ? gstNumber : party.gstNumber).trim().toUpperCase();

    const targetName = (companyName || party.companyName).trim().toUpperCase();
    const targetAddr = address ? normalizeAddress(address) : party.address;

    // Check duplicate Company Name + Complete Address excluding self
    const existingDuplicate = await findExistingParty({
      companyName: targetName,
      address: targetAddr,
      fullAddress
    }, mongoose.connection);

    if (existingDuplicate && existingDuplicate._id.toString() !== party._id.toString()) {
      return res.status(409).json({
        error: `Another record for "${targetName}" at this location (${targetAddr.city || targetAddr.addressLine1 || 'specified address'}) already exists (${existingDuplicate.companyCode}).`,
        existingParty: {
          id: existingDuplicate._id.toString(),
          companyName: existingDuplicate.companyName,
          companyCode: existingDuplicate.companyCode
        }
      });
    }

    // Apply updates
    if (companyName) party.companyName = targetName;
    if (address) party.address = targetAddr;
    if (gstNumber !== undefined) party.gstNumber = cleanGst;
    if (pickupDeliveryLocation !== undefined || pickupDelivery !== undefined) {
      party.pickupDeliveryLocation = (pickupDeliveryLocation !== undefined ? pickupDeliveryLocation : pickupDelivery).trim().toUpperCase();
    }
    if (contactPerson !== undefined) party.contactPerson = (contactPerson || '').trim();
    if (mobileNumber !== undefined) party.mobileNumber = (mobileNumber || '').trim();
    if (email !== undefined) party.email = (email || '').trim().toLowerCase();
    if (isActive !== undefined) party.isActive = Boolean(isActive);

    if (fullAddress) {
      party.fullAddress = fullAddress;
    } else {
      const parts = [
        party.address.addressLine1,
        party.address.addressLine2,
        party.address.city,
        party.address.state,
        party.address.pinCode ? `PIN: ${party.address.pinCode}` : ''
      ].filter(Boolean);
      party.fullAddress = parts.join(', ');
    }

    const saved = await party.save();
    res.json({ ...saved.toObject(), id: saved._id.toString() });
  } catch (err) {
    console.error('[ConsignorConsignee Update Error]:', err);
    res.status(500).json({ error: err.message });
  }
});

// PATCH /api/consignor-consignee/:id/status — Toggle Active Status
router.patch('/:id/status', async (req, res) => {
  try {
    const { id } = req.params;
    const party = await ConsignorConsignee.findById(id);

    if (!party) {
      return res.status(404).json({ error: `Company '${id}' not found.` });
    }

    party.isActive = req.body.isActive !== undefined ? Boolean(req.body.isActive) : !party.isActive;
    const saved = await party.save();

    res.json({
      success: true,
      id: saved._id.toString(),
      isActive: saved.isActive,
      message: `Company "${saved.companyName}" is now ${saved.isActive ? 'Active' : 'Inactive'}.`
    });
  } catch (err) {
    console.error('[ConsignorConsignee Status Toggle Error]:', err);
    res.status(500).json({ error: err.message });
  }
});

// DELETE /api/consignor-consignee/:id — Delete Company Record with Shipment Reference Guard
router.delete('/:id', async (req, res) => {
  try {
    const { id } = req.params;
    const party = await ConsignorConsignee.findById(id);

    if (!party) {
      return res.status(404).json({ error: `Company '${id}' not found.` });
    }

    // Check if company is referenced in any existing shipment
    const partyIdStr = party._id.toString();
    const partyCode = party.companyCode;

    const shipmentReference = await Shipment.findOne({
      $or: [
        { consignorId: partyIdStr },
        { consigneeId: partyIdStr },
        { 'consignor.code': partyCode },
        { 'consignee.code': partyCode },
        { 'consignorSnapshot.companyCode': partyCode },
        { 'consigneeSnapshot.companyCode': partyCode }
      ]
    }).select('cnNumber').lean();

    if (shipmentReference) {
      return res.status(409).json({
        error: `Cannot delete company "${party.companyName}" because it is linked to existing shipment(s) (e.g. CN: ${shipmentReference.cnNumber}). Please set status to Inactive instead.`,
        isReferenced: true,
        companyId: partyIdStr,
        companyName: party.companyName,
        referencedCn: shipmentReference.cnNumber
      });
    }

    await ConsignorConsignee.findByIdAndDelete(id);

    res.json({
      success: true,
      message: `Company "${party.companyName}" (${party.companyCode}) successfully deleted.`
    });
  } catch (err) {
    console.error('[ConsignorConsignee Delete Error]:', err);
    res.status(500).json({ error: err.message });
  }
});

module.exports = router;
