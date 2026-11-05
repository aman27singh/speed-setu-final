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
          id: p._id || p.id
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
    return local.filter(p => {
      if (type !== 'All') {
        if (type === 'Consignor' && p.type !== 'Consignor' && p.type !== 'Both') return false;
        if (type === 'Consignee' && p.type !== 'Consignee' && p.type !== 'Both') return false;
      }
      if (city !== 'All' && p.city?.toLowerCase() !== city.toLowerCase()) return false;
      if (search && search.trim()) {
        const q = search.toLowerCase().trim();
        const match =
          (p.name || '').toLowerCase().includes(q) ||
          (p.city || '').toLowerCase().includes(q) ||
          (p.state || '').toLowerCase().includes(q) ||
          (p.pin || '').toLowerCase().includes(q) ||
          (p.gstin || '').toLowerCase().includes(q) ||
          (p.address || '').toLowerCase().includes(q) ||
          (p.contact || '').toLowerCase().includes(q) ||
          (p.phone || '').toLowerCase().includes(q);
        if (!match) return false;
      }
      return true;
    }).sort((a, b) => (a.name || '').localeCompare(b.name || ''));
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
          phone: c.phone || '',
          email: c.email || '',
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
      if (s.consignor) add(s.consignor, 'Consignor');
      if (s.consignee) add(s.consignee, 'Consignee');
    });

    return Array.from(partyMap.values());
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
      type: partyData.type || 'Both',
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
  async updateParty(id, partyData, updatePastShipments = false) {
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

    const current = getLocalParties();
    const updated = current.map(p => (p.id === id || p._id === id ? { ...p, ...partyData } : p));
    saveLocalParties(updated);
    return { ...partyData, id };
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
