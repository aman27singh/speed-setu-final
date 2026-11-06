import { apiRequest } from './apiClient';
import { shipmentService } from './shipmentService';
import { companyService } from './companyService';

const STORAGE_KEY = 'speedsetu_parties_master';

const getLocalParties = () => {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    return raw ? JSON.parse(raw) : [];
  } catch (e) {
    return [];
  }
};

const saveLocalParties = (parties) => {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(parties));
  } catch (e) {
    console.warn('Failed to save parties to localStorage:', e);
  }
};

/**
 * Normalizes a company name for fuzzy duplicate comparison:
 * Removes punctuation, common corporate suffixes (pvt, ltd, private, limited, plant, inc),
 * and parenthesis content like (Hobli), (Bangalore), (P-40).
 */
export const normalizePartyNameForGrouping = (name = '') => {
  return String(name)
    .toLowerCase()
    .replace(/\(.*?\)/g, '') // remove (Hobli), (P-40) etc.
    .replace(/[^a-z0-9]/g, ' ') // replace non-alphanumeric with spaces
    .replace(/\b(pvt|ltd|private|limited|plant|inc|co|corp|enterprises|enterprise|industries|corp|auto|autocomp)\b/g, '')
    .replace(/\s+/g, ' ')
    .trim();
};

export const partyService = {
  /**
   * Fetch all parties (consignors & consignees)
   */
  async getParties({ search = '', type = 'All', city = 'All' } = {}) {
    let remoteParties = null;

    try {
      const params = new URLSearchParams();
      if (search) params.append('search', search);
      if (type && type !== 'All') params.append('type', type);
      if (city && city !== 'All') params.append('city', city);

      const data = await apiRequest(`/parties?${params.toString()}`);
      if (Array.isArray(data) && data.length > 0) {
        remoteParties = data.map(p => ({
          ...p,
          id: p._id || p.id,
          type: 'Both'
        }));
        saveLocalParties(remoteParties);
      }
    } catch (err) {
      // Remote call failed (offline, cold start, etc.) - proceed to local/fallback
    }

    if (remoteParties && remoteParties.length > 0) {
      return remoteParties;
    }

    // Check Local Storage
    let local = getLocalParties();

    // Ensure all existing cached records have type = 'Both' and separate email/phone
    if (local && local.length > 0) {
      let modified = false;
      local = local.map(p => {
        let changed = false;
        let item = { ...p };
        if (item.type !== 'Both') {
          item.type = 'Both';
          changed = true;
        }
        if (item.email === undefined && item.contact && item.contact.includes('@')) {
          item.email = item.contact.trim();
          changed = true;
        }
        if (item.phone === undefined && item.contact && !item.contact.includes('@')) {
          item.phone = item.contact.trim();
          changed = true;
        }
        // If email was explicitly cleared/empty, ensure contact does not retain the stale email address
        if (item.email === '' && item.contact && item.contact.includes('@')) {
          item.contact = item.phone || '';
          changed = true;
        }
        if (changed) modified = true;
        return item;
      });
      if (modified) saveLocalParties(local);
    }

    // If local storage is also empty, seed from existing live shipments and companies
    if (!local || local.length === 0) {
      local = await this.seedFromExistingData();
      saveLocalParties(local);

      // Attempt background seed to remote backend as well
      try {
        apiRequest('/parties/seed', { method: 'POST' }).catch(() => null);
      } catch (_) {}
    }

    // Apply local filters
    const q = (search || '').toLowerCase().trim();

    const scored = local
      .filter((p) => {
        if (type !== 'All') {
          if (type === 'Consignor' && p.type !== 'Consignor' && p.type !== 'Both') return false;
          if (type === 'Consignee' && p.type !== 'Consignee' && p.type !== 'Both') return false;
        }
        if (city !== 'All' && p.city?.toLowerCase() !== city.toLowerCase()) return false;
        return true;
      })
      .map((p) => {
        if (!q) return { party: p, score: 1 };
        const name = (p.name || '').toLowerCase().trim();
        const pCity = (p.city || '').toLowerCase().trim();
        const gstin = (p.gstin || '').toLowerCase().trim();
        const pin = (p.pin || '').toLowerCase().trim();
        const phone = (p.phone || '').toLowerCase().trim();
        const email = (p.email || '').toLowerCase().trim();
        const address = (p.address || '').toLowerCase().trim();

        let score = 0;
        if (name === q) score = 1000;
        else if (name.startsWith(q)) score = 800;
        else if (name.split(/[\s,()\-./]+/).some((w) => w.startsWith(q))) score = 650;
        else if (name.includes(q)) score = 450;
        else if (pCity.startsWith(q)) score = 350;
        else if (gstin.startsWith(q)) score = 300;
        else if (pin.startsWith(q)) score = 250;
        else if (phone.startsWith(q) || email.startsWith(q)) score = 220;
        else if (q.length >= 3) {
          if (pCity.includes(q)) score = 180;
          else if (gstin.includes(q)) score = 150;
          else if (phone.includes(q) || email.includes(q)) score = 120;
          else if (address.includes(q)) score = 60;
        }

        return { party: p, score };
      })
      .filter((item) => !q || item.score > 0);

    if (q) {
      scored.sort((a, b) => {
        if (b.score !== a.score) return b.score - a.score;
        return (a.party.name || '').localeCompare(b.party.name || '');
      });
    } else {
      scored.sort((a, b) => (a.party.name || '').localeCompare(b.party.name || ''));
    }

    return scored.map((item) => item.party);
  },

  /**
   * Seed parties directory by extracting unique entities from past shipments & companies
   */
  async seedFromExistingData() {
    let shipments = [];
    let companies = [];

    try {
      shipments = await shipmentService.getShipments();
    } catch (_) {}

    try {
      companies = await companyService.getCompanies();
    } catch (_) {}

    const partyMap = new Map();

    const add = (c, defaultType = 'Both') => {
      if (!c || !c.name || !c.name.trim()) return;
      const rawName = c.name.trim();
      const key = rawName.toLowerCase();
      if (key === '-' || key === 'n/a' || key.length < 2) return;

      const cleanGstin = c.gstin || c.gstNo || '';
      const cleanAddress = c.address || c.pickupAddress || c.deliveryAddress || '';
      const cleanPin = c.pin || c.pinCode || '';
      const cleanCity = c.city || '';
      const cleanContact = c.contact || c.contactPhone || c.phone || '';
      let cleanEmail = (c.email || '').trim();
      let cleanPhone = (c.phone || c.contactPhone || '').trim();
      if (!cleanEmail && cleanContact.includes('@')) {
        cleanEmail = cleanContact.trim();
      }
      if (!cleanPhone && !cleanContact.includes('@')) {
        cleanPhone = cleanContact.trim();
      }

      if (!partyMap.has(key)) {
        partyMap.set(key, {
          id: c.id || c._id || `party-${Date.now()}-${partyMap.size + 1}`,
          name: rawName,
          type: defaultType,
          address: cleanAddress,
          city: cleanCity,
          state: c.state || '',
          pin: cleanPin,
          gstin: cleanGstin,
          contact: cleanContact,
          phone: cleanPhone,
          email: cleanEmail,
          shipmentCount: 1
        });
      } else {
        const existing = partyMap.get(key);
        existing.shipmentCount = (existing.shipmentCount || 0) + 1;
        if (!existing.address && cleanAddress) existing.address = cleanAddress;
        if (!existing.city && cleanCity) existing.city = cleanCity;
        if (!existing.pin && cleanPin) existing.pin = cleanPin;
        if (!existing.gstin && cleanGstin) existing.gstin = cleanGstin;
        if (!existing.contact && cleanContact) existing.contact = cleanContact;
        if (!existing.email && cleanEmail) existing.email = cleanEmail;
        if (!existing.phone && cleanPhone) existing.phone = cleanPhone;
        if (existing.type !== defaultType) existing.type = 'Both';
      }
    };

    (companies || []).forEach(comp => {
      if (comp.companyName) {
        add({
          id: comp.id,
          name: comp.companyName,
          address: comp.billing?.address || '',
          city: comp.billing?.city || '',
          state: comp.billing?.state || '',
          pin: comp.billing?.pinCode || '',
          gstin: comp.gstin || '',
          contact: comp.primaryContact?.phone || ''
        }, 'Both');
      }
      if (Array.isArray(comp.hubs)) {
        comp.hubs.forEach(h => {
          if (h.name || h.hubName) {
            add({
              name: h.name || h.hubName,
              address: h.address || '',
              city: h.city || '',
              gstin: h.gstin || ''
            }, 'Both');
          }
        });
      }
    });

    (shipments || []).forEach(s => {
      if (s.consignor) add(s.consignor, 'Both');
      if (s.consignee) add(s.consignee, 'Both');
    });

    return Array.from(partyMap.values()).map(p => ({ ...p, type: 'Both' }));
  },

  /**
   * Create a new party
   */
  async createParty(partyData) {
    const newId = `party-${Date.now()}`;
    const payload = {
      ...partyData,
      id: newId,
      name: partyData.name.trim(),
      type: 'Both',
      address: (partyData.address || '').trim(),
      city: (partyData.city || '').trim(),
      state: (partyData.state || '').trim(),
      pin: (partyData.pin || '').trim(),
      gstin: (partyData.gstin || '').trim(),
      contact: (partyData.contact || '').trim(),
      phone: (partyData.phone || '').trim(),
      email: (partyData.email || '').trim()
    };

    try {
      const res = await apiRequest('/parties', {
        method: 'POST',
        body: JSON.stringify(payload)
      });
      if (res && (res._id || res.id)) {
        payload.id = res._id || res.id;
      }
    } catch (err) {
      console.warn('Remote party create failed, saving locally:', err.message);
    }

    const current = getLocalParties();
    const updated = [payload, ...current.filter(p => p.id !== payload.id)];
    saveLocalParties(updated);
    return payload;
  },

  /**
   * Update an existing party
   */
  async updateParty(id, partyData, updatePastShipments = false, originalParty = null) {
    const payload = {
      ...partyData,
      updatePastShipments
    };

    try {
      await apiRequest(`/parties/${id}`, {
        method: 'PUT',
        body: JSON.stringify(payload)
      });
    } catch (err) {
      console.warn('Remote party update failed, saving locally:', err.message);
    }

    const cleanEmail = partyData.email !== undefined ? (partyData.email || '').trim() : '';
    const cleanPhone = partyData.phone !== undefined ? (partyData.phone || '').trim() : '';
    const cleanContact = cleanPhone || cleanEmail || '';

    const current = getLocalParties();
    let matchedAny = false;
    const updated = current.map(p => {
      const isMatch =
        (id && (p.id == id || p._id == id || p.companyId == id)) ||
        (originalParty?.id && (p.id == originalParty.id || p._id == originalParty.id)) ||
        (originalParty?._id && (p.id == originalParty._id || p._id == originalParty._id)) ||
        (originalParty?.name && p.name && p.name.trim().toLowerCase() === originalParty.name.trim().toLowerCase()) ||
        (partyData?.name && p.name && p.name.trim().toLowerCase() === partyData.name.trim().toLowerCase()) ||
        (originalParty?.gstin && p.gstin && p.gstin.trim().toLowerCase() === originalParty.gstin.trim().toLowerCase());

      if (isMatch) {
        matchedAny = true;
        return {
          ...p,
          ...partyData,
          type: 'Both',
          email: cleanEmail,
          phone: cleanPhone,
          contact: cleanContact
        };
      }
      return p;
    });

    if (!matchedAny) {
      updated.unshift({
        id: id || `party-${Date.now()}`,
        ...partyData,
        type: 'Both',
        email: cleanEmail,
        phone: cleanPhone,
        contact: cleanContact
      });
    }

    saveLocalParties(updated);
    return { ...partyData, id, email: cleanEmail, phone: cleanPhone, contact: cleanContact };
  },

  /**
   * Delete a party (e.g. removing duplicates)
   */
  async deleteParty(id) {
    try {
      await apiRequest(`/parties/${id}`, { method: 'DELETE' });
    } catch (err) {
      console.warn('Remote party delete failed, removing locally:', err.message);
    }

    const current = getLocalParties();
    const filtered = current.filter(p => p.id !== id && p._id !== id);
    saveLocalParties(filtered);
    return { success: true, id };
  },

  /**
   * Merge multiple duplicate parties into one master party record
   */
  async mergeParties(masterPartyId, duplicatePartyIds = [], updatePastShipments = true) {
    try {
      await apiRequest('/parties/merge', {
        method: 'POST',
        body: JSON.stringify({ masterPartyId, duplicatePartyIds, updatePastShipments })
      });
    } catch (err) {
      console.warn('Remote party merge failed, processing locally:', err.message);
    }

    const current = getLocalParties();
    const filtered = current.filter(p => !duplicatePartyIds.includes(p.id) && !duplicatePartyIds.includes(p._id));
    saveLocalParties(filtered);
    return { success: true };
  },

  /**
   * Analyzes list of parties and clusters potential duplicate entries
   * e.g. "Advik Autocomp Pvt Ltd (Hobli)", "Advik Autocomp pvt ltd plant - 40"
   */
  findDuplicateClusters(parties = []) {
    const clusters = [];
    const processedIds = new Set();

    for (let i = 0; i < parties.length; i++) {
      const p1 = parties[i];
      const p1Id = p1.id || p1._id;
      if (processedIds.has(p1Id)) continue;

      const norm1 = normalizePartyNameForGrouping(p1.name);
      if (!norm1 || norm1.length < 3) continue;

      const matchingGroup = [p1];

      for (let j = i + 1; j < parties.length; j++) {
        const p2 = parties[j];
        const p2Id = p2.id || p2._id;
        if (processedIds.has(p2Id)) continue;

        const norm2 = normalizePartyNameForGrouping(p2.name);
        if (!norm2 || norm2.length < 3) continue;

        // Check if normalized names are identical OR one is contained within the other OR same GSTIN
        const isNameSimilar = norm1 === norm2 ||
          (norm1.length > 5 && norm2.length > 5 && (norm1.includes(norm2) || norm2.includes(norm1)));
        const isGstinMatch = p1.gstin && p2.gstin && p1.gstin.trim() === p2.gstin.trim() && p1.gstin.length > 5;

        if (isNameSimilar || isGstinMatch) {
          matchingGroup.push(p2);
          processedIds.add(p2Id);
        }
      }

      if (matchingGroup.length > 1) {
        processedIds.add(p1Id);
        clusters.push({
          normalizedKey: norm1,
          primaryName: p1.name,
          records: matchingGroup
        });
      }
    }

    return clusters;
  }
};
