const express = require('express');
const router = express.Router();
const mongoose = require('mongoose');
const Party = require('../models/Party');
const Shipment = require('../models/Shipment');
const Company = require('../models/Company');

// GET /api/parties — List all parties with optional search & filters
router.get('/', async (req, res) => {
  try {
    const { search, type, city, status } = req.query;
    let query = {};

    // Ensure all parties have type 'Both' (Shipper and Receiver both)
    await Party.updateMany({ type: { $ne: 'Both' } }, { $set: { type: 'Both' } }).catch(() => null);

    if (city && city !== 'All') {
      query.city = new RegExp(`^${city.trim()}$`, 'i');
    }

    if (status && status !== 'All') {
      query.status = status;
    }

    if (search && search.trim()) {
      const q = search.trim();
      const escaped = q.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
      query.$or = [
        { name: { $regex: escaped, $options: 'i' } },
        { city: { $regex: escaped, $options: 'i' } },
        { state: { $regex: escaped, $options: 'i' } },
        { pin: { $regex: escaped, $options: 'i' } },
        { gstin: { $regex: escaped, $options: 'i' } },
        { address: { $regex: escaped, $options: 'i' } },
        { contact: { $regex: escaped, $options: 'i' } },
        { phone: { $regex: escaped, $options: 'i' } }
      ];
    }

    const parties = await Party.find(query).sort({ name: 1 });
    res.json(parties);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// GET /api/parties/:id — Get single party
router.get('/:id', async (req, res) => {
  try {
    const { id } = req.params;
    const isValidId = mongoose.isValidObjectId(id);
    const party = await Party.findOne({
      $or: [
        ...(isValidId ? [{ _id: id }] : []),
        { name: new RegExp(`^${id.trim()}$`, 'i') }
      ]
    });
    if (!party) return res.status(404).json({ error: 'Party not found' });
    res.json(party);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// POST /api/parties — Create a new party
router.post('/', async (req, res) => {
  try {
    const { name, type = 'Both', address, city, state, pin, gstin, contact, phone, email, notes } = req.body;
    if (!name || !name.trim()) {
      return res.status(400).json({ error: 'Party name is required' });
    }

    const trimmedName = name.trim();

    // Check for existing party with exact same name
    const existing = await Party.findOne({ name: new RegExp(`^${trimmedName}$`, 'i') });
    if (existing) {
      return res.status(409).json({
        error: `A party named "${trimmedName}" already exists. You can edit the existing party instead of creating a duplicate.`,
        existingParty: existing
      });
    }

    const newParty = new Party({
      name: trimmedName,
      type: 'Both',
      address: (address || '').trim(),
      city: (city || '').trim(),
      state: (state || '').trim(),
      pin: (pin || '').trim(),
      gstin: (gstin || '').trim(),
      contact: (contact || '').trim(),
      phone: (phone || '').trim(),
      email: (email || '').trim(),
      notes: (notes || '').trim()
    });

    const saved = await newParty.save();
    res.status(201).json(saved);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// PUT /api/parties/:id — Update party details
router.put('/:id', async (req, res) => {
  try {
    const { id } = req.params;
    const { updatePastShipments = false, ...updateFields } = req.body;

    const oldParty = await Party.findById(id);
    if (!oldParty) {
      return res.status(404).json({ error: 'Party not found' });
    }

    const oldName = oldParty.name;
    const updated = await Party.findByIdAndUpdate(id, updateFields, { new: true });

    // Optionally update past shipments if party name or address was standardized
    if (updatePastShipments && oldName && updated.name) {
      const cleanContact = {
        name: updated.name,
        address: updated.address || '',
        city: updated.city || '',
        state: updated.state || '',
        pin: updated.pin || '',
        gstin: updated.gstin || '',
        contact: updated.contact || updated.phone || ''
      };

      await Shipment.updateMany(
        { 'consignor.name': oldName },
        { $set: { consignor: cleanContact } }
      );
      await Shipment.updateMany(
        { 'consignee.name': oldName },
        { $set: { consignee: cleanContact } }
      );
    }

    res.json(updated);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// DELETE /api/parties/:id — Delete a party (e.g. to remove dirty duplicated data)
router.delete('/:id', async (req, res) => {
  try {
    const { id } = req.params;
    const deleted = await Party.findByIdAndDelete(id);
    if (!deleted) {
      return res.status(404).json({ error: 'Party not found' });
    }
    res.json({ success: true, message: `Party "${deleted.name}" deleted successfully.` });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// POST /api/parties/merge — Merge duplicate parties into one master record
router.post('/merge', async (req, res) => {
  try {
    const { masterPartyId, duplicatePartyIds = [], updatePastShipments = true } = req.body;

    if (!masterPartyId || !Array.isArray(duplicatePartyIds) || duplicatePartyIds.length === 0) {
      return res.status(400).json({ error: 'masterPartyId and an array of duplicatePartyIds are required' });
    }

    const masterParty = await Party.findById(masterPartyId);
    if (!masterParty) {
      return res.status(404).json({ error: 'Master party record not found' });
    }

    const duplicateParties = await Party.find({ _id: { $in: duplicatePartyIds } });
    const duplicateNames = duplicateParties.map(p => p.name).filter(Boolean);

    // Optionally update past shipments that referenced any of the duplicate names
    if (updatePastShipments && duplicateNames.length > 0) {
      const masterContact = {
        name: masterParty.name,
        address: masterParty.address || '',
        city: masterParty.city || '',
        state: masterParty.state || '',
        pin: masterParty.pin || '',
        gstin: masterParty.gstin || '',
        contact: masterParty.contact || masterParty.phone || ''
      };

      await Shipment.updateMany(
        { 'consignor.name': { $in: duplicateNames } },
        { $set: { consignor: masterContact } }
      );

      await Shipment.updateMany(
        { 'consignee.name': { $in: duplicateNames } },
        { $set: { consignee: masterContact } }
      );
    }

    // Delete the duplicate party records
    await Party.deleteMany({ _id: { $in: duplicatePartyIds } });

    res.json({
      success: true,
      message: `Successfully merged ${duplicatePartyIds.length} duplicate record(s) into "${masterParty.name}".`,
      masterParty
    });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// POST /api/parties/seed — Seed parties from existing shipments and companies
router.post('/seed', async (req, res) => {
  try {
    const existingCount = await Party.countDocuments();
    if (existingCount > 0 && !req.query.force) {
      const list = await Party.find().sort({ name: 1 });
      return res.json({ count: existingCount, parties: list, message: 'Parties already seeded.' });
    }

    const [shipments, companies] = await Promise.all([
      Shipment.find().lean(),
      Company.find().lean()
    ]);

    const partyMap = new Map();

    const addParty = (item) => {
      if (!item || !item.name || !item.name.trim()) return;
      const rawName = item.name.trim();
      const key = rawName.toLowerCase();

      // Filter placeholder / invalid entries
      if (key === '-' || key === 'n/a' || key === 'null' || key === 'undefined' || key.length < 2) return;

      if (!partyMap.has(key)) {
        partyMap.set(key, {
          name: rawName,
          type: 'Both',
          address: (item.address || '').trim(),
          city: (item.city || '').trim(),
          state: (item.state || '').trim(),
          pin: (item.pin || item.pinCode || '').trim(),
          gstin: (item.gstin || '').trim(),
          contact: (item.contact || item.phone || '').trim(),
          phone: (item.phone || item.contactPhone || '').trim(),
          email: (item.email || '').trim()
        });
      } else {
        // Enrich existing entry if newer record has more details
        const existing = partyMap.get(key);
        if (!existing.address && item.address) existing.address = item.address.trim();
        if (!existing.city && item.city) existing.city = item.city.trim();
        if (!existing.state && item.state) existing.state = item.state.trim();
        if (!existing.pin && (item.pin || item.pinCode)) existing.pin = (item.pin || item.pinCode).trim();
        if (!existing.gstin && item.gstin) existing.gstin = item.gstin.trim();
        if (!existing.contact && item.contact) existing.contact = item.contact.trim();
      }
    };

    // Add from companies
    companies.forEach(comp => {
      if (comp.companyName) {
        addParty({
          name: comp.companyName,
          address: comp.billing?.address || '',
          city: comp.billing?.city || '',
          state: comp.billing?.state || '',
          pin: comp.billing?.pinCode || '',
          gstin: comp.gstin || comp.billing?.gstin || '',
          contact: comp.primaryContact?.name || '',
          phone: comp.primaryContact?.phone || '',
          email: comp.primaryContact?.email || ''
        }, 'Both');
      }
      if (Array.isArray(comp.hubs)) {
        comp.hubs.forEach(h => {
          if (h.name || h.hubName) {
            addParty({
              name: h.name || h.hubName,
              address: h.address || '',
              city: h.city || '',
              gstin: h.gstin || ''
            }, 'Both');
          }
        });
      }
    });

    // Add from past shipments
    shipments.forEach(s => {
      if (s.consignor) addParty(s.consignor, 'Consignor');
      if (s.consignee) addParty(s.consignee, 'Consignee');
    });

    const partyDocs = Array.from(partyMap.values());
    if (partyDocs.length > 0) {
      if (req.query.force) {
        await Party.deleteMany({});
      }
      await Party.insertMany(partyDocs, { ordered: false }).catch(() => null);
    }

    const result = await Party.find().sort({ name: 1 });
    res.json({ count: result.length, parties: result, message: `Seeded ${result.length} parties.` });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

module.exports = router;
