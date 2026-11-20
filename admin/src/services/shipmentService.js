import { simulateDelay, apiRequest } from './apiClient';
import { payableService } from './payableService';
import { expenseService } from './expenseService';

let shipmentsStore = [];
let baseCNCounter = 2000; // Next auto-generated CN will be in the 2000 series (SS2000, SS2001, ...)

let invoicesCache = null;
let invoicesCacheTime = 0;
const INVOICES_CACHE_TTL = 30000; // 30s cache

async function getCachedInvoices() {
  const now = Date.now();
  if (invoicesCache && now - invoicesCacheTime < INVOICES_CACHE_TTL) {
    return invoicesCache;
  }
  try {
    const res = await apiRequest('/invoices').catch(() => []);
    if (Array.isArray(res)) {
      invoicesCache = res;
      invoicesCacheTime = now;
      return res;
    }
  } catch (e) {
    // ignore
  }
  return invoicesCache || [];
}

/**
 * Numeric extraction of CN number (e.g. "SS2097" -> 2097)
 */
export function extractCnNumber(cn) {
  if (!cn) return 0;
  const match = String(cn).match(/\d+/);
  return match ? parseInt(match[0], 10) : 0;
}

/**
 * Standardized date extraction for shipment sorting (YYYY-MM-DD)
 */
export function getShipmentDate(s) {
  if (!s) return '';
  const d = s.cnDate || s.bookingDate || s.date || '';
  if (d) return String(d).substring(0, 10);
  if (s.createdAt) {
    try {
      return new Date(s.createdAt).toISOString().substring(0, 10);
    } catch (e) {
      return '';
    }
  }
  return '';
}

/**
 * Multi-tier sorting:
 * 1. Primary sort: Date (Descending)
 * 2. Secondary sort: Numeric CN Number (Descending)
 * 3. Fallback: Full CN string (Descending)
 */
export function sortShipments(list) {
  if (!Array.isArray(list)) return [];
  return [...list].sort((a, b) => {
    const dateA = getShipmentDate(a);
    const dateB = getShipmentDate(b);
    if (dateA !== dateB) return dateB.localeCompare(dateA);

    const cnA = extractCnNumber(a.cnNumber || a.id);
    const cnB = extractCnNumber(b.cnNumber || b.id);
    if (cnA !== cnB) return cnB - cnA;

    return String(b.cnNumber || '').localeCompare(String(a.cnNumber || ''));
  });
}

/**
 * Matcher for package filter
 */
export function matchPackage(packagesVal, packageFilter) {
  if (!packageFilter || packageFilter === 'All') return true;
  const pkgNum = parseInt(packagesVal, 10) || 0;
  const targetNum = parseInt(packageFilter, 10);
  if (!isNaN(targetNum)) {
    return pkgNum === targetNum;
  }
  if (packageFilter === '6-10') {
    return pkgNum >= 6 && pkgNum <= 10;
  }
  if (packageFilter === '11-25') {
    return pkgNum >= 11 && pkgNum <= 25;
  }
  if (packageFilter === '26+' || packageFilter === '>25') {
    return pkgNum >= 26;
  }
  return true;
}

/**
 * Matcher for weight filter:
 * - "zero": Actual weight and chargeable weight are both zero or empty
 * - "greater_than_0": Actual weight or chargeable weight is greater than zero
 */
export function matchWeight(actualWeight, chargeableWeight, weightFilter) {
  if (!weightFilter || weightFilter === 'All') return true;
  const act = parseFloat(actualWeight) || 0;
  const chg = parseFloat(chargeableWeight) || 0;
  const hasWeight = act > 0 || chg > 0;

  const w = String(weightFilter).toLowerCase().trim();
  if (w === 'zero' || w === '0') {
    return !hasWeight; // Both zero or empty
  }
  if (w === 'greater_than_0' || w === '>0') {
    return hasWeight; // Either actual or chargeable > 0
  }
  return true;
}

/**
 * Matcher for route (Origin – Destination)
 */
export function matchRoute(origin, destination, routeFilter) {
  if (!routeFilter || routeFilter === 'All') return true;
  const origNorm = (origin || '').trim().toUpperCase();
  const destNorm = (destination || '').trim().toUpperCase();

  if (routeFilter.startsWith('origin:')) {
    const target = routeFilter.replace('origin:', '').trim().toUpperCase();
    return origNorm === target;
  }
  if (routeFilter.startsWith('dest:')) {
    const target = routeFilter.replace('dest:', '').trim().toUpperCase();
    return destNorm === target;
  }

  const parts = routeFilter.includes('→') ? routeFilter.split('→') : routeFilter.split('|');
  if (parts.length === 2) {
    const targetOrig = parts[0].trim().toUpperCase();
    const targetDest = parts[1].trim().toUpperCase();
    const origMatch = targetOrig === 'ANY' || origNorm === targetOrig;
    const destMatch = targetDest === 'ANY' || destNorm === targetDest;
    return origMatch && destMatch;
  }
  return true;
}

/**
 * Ensures all shipment fields are primitive strings/numbers and unwraps any nested { value } objects.
 */
export function sanitizeShipment(s) {
  if (!s) return null;

  const toStr = (v, fallback = '') => {
    if (v === null || v === undefined) return fallback;
    if (typeof v === 'object') {
      if (v.value !== undefined && v.value !== null) {
        const str = String(v.value).trim();
        return str !== '' ? str : fallback;
      }
      if (v.name !== undefined && v.name !== null) {
        const str = String(v.name).trim();
        return str !== '' ? str : fallback;
      }
      return fallback;
    }
    const str = String(v).trim();
    return str !== '' ? str : fallback;
  };

  const consignor = s.consignor || s.shipper || {};
  const consignee = s.consignee || {};

  const cleanCN = toStr(s.cnNumber || s.id, 'SS2000');
  const cleanId = toStr(s.id || s.cnNumber || s._id, cleanCN);

  return {
    ...s,
    id: cleanId,
    cnNumber: cleanCN,
    companyId: toStr(s.companyId, ''),
    companyName: toStr(s.companyName, ''),
    companyCode: toStr(s.companyCode, ''),
    origin: toStr(s.origin, ''),
    destination: toStr(s.destination, ''),
    mode: toStr(s.mode || s.freightMode, 'Air'),
    freightMode: toStr(s.freightMode || s.mode, 'Air'),
    packages: parseInt(toStr(s.packages, '0'), 10) || 0,
    actualWeight: parseFloat(toStr(s.actualWeight, '0')) || 0,
    chargeableWeight: parseFloat(toStr(s.chargeableWeight, '0')) || 0,
    ewayBillNumber: toStr(s.ewayBillNumber, ''),
    awbNumber: toStr(s.awbNumber, ''),
    materialDescription: toStr(s.materialDescription, 'General Cargo'),
    consignor: {
      name: toStr(consignor.name, ''),
      code: toStr(consignor.code, ''),
      gstin: toStr(consignor.gstin, ''),
      address: toStr(consignor.address, ''),
      city: toStr(consignor.city, ''),
      state: toStr(consignor.state, ''),
      pin: toStr(consignor.pin, ''),
      contact: toStr(consignor.contact, '')
    },
    consignee: {
      name: toStr(consignee.name, ''),
      code: toStr(consignee.code, ''),
      gstin: toStr(consignee.gstin, ''),
      address: toStr(consignee.address, ''),
      city: toStr(consignee.city, ''),
      state: toStr(consignee.state, ''),
      pin: toStr(consignee.pin, ''),
      contact: toStr(consignee.contact, '')
    },
    invoiceDetails: {
      invoiceNumber: toStr(s.invoiceDetails?.invoiceNumber, ''),
      invoiceDate: toStr(s.invoiceDetails?.invoiceDate, toStr(s.commercialInvoices?.[0]?.invoiceDate, '')),
      invoiceValue: parseFloat(toStr(s.invoiceDetails?.invoiceValue, '0')) || 0,
      invoiceQuantity: (() => {
        const raw = s.invoiceDetails?.invoiceQuantity !== undefined && s.invoiceDetails?.invoiceQuantity !== null
          ? s.invoiceDetails.invoiceQuantity
          : s.commercialInvoices?.[0]?.invoiceQuantity;
        if (raw === '' || raw === null || raw === undefined || raw === 0 || raw === '0') return '';
        const num = parseInt(raw, 10);
        return isNaN(num) || num <= 0 ? '' : num;
      })()
    }
  };
}

export const shipmentService = {
  /**
   * Auto-generate next sequential non-repeating CN number in 2000 series (SS2000, SS2001, SS2002...)
   */
  async generateNextCN() {
    try {
      const res = await apiRequest('/shipments/next-cn');
      if (res && res.nextCN) {
        return res.nextCN;
      }
    } catch (e) {
      console.warn('[ShipmentService] Could not fetch server next-cn, falling back to local calculation:', e.message);
    }

    await simulateDelay(50);
    let highestNum = 1999;
    (shipmentsStore || []).forEach((s) => {
      const cn = s?.cnNumber || s?.id || '';
      const m = String(cn).match(/^SS-?(\d+)$/i);
      if (m) {
        const num = parseInt(m[1], 10);
        if (num > highestNum) highestNum = num;
      }
    });
    const nextVal = Math.max(2000, highestNum + 1, baseCNCounter);
    baseCNCounter = nextVal + 1;
    return `SS${nextVal}`;
  },

  /**
   * Fetch dynamic dependent filter options (companies, routes, packages, weights)
   */
  async getFilterOptions({ companyId = 'All', route = 'All', packageCount = 'All', status = 'All' } = {}) {
    try {
      const q = new URLSearchParams();
      if (companyId && companyId !== 'All') q.append('companyId', companyId);
      if (route && route !== 'All') q.append('route', route);
      if (packageCount && packageCount !== 'All') q.append('package', packageCount);
      if (status && status !== 'All') q.append('status', status);

      const res = await apiRequest(`/shipments/filter-options?${q.toString()}`);
      if (res && res.companies && res.routes) {
        return res;
      }
    } catch (e) {
      console.warn('[ShipmentService] Filter options fetch fallback:', e.message);
    }
    return null;
  },

  /**
   * Fetch shipments list with optional multi-criteria filtering
   */
  async getShipments({
    search = '',
    companyId = 'All',
    status = 'All',
    route = 'All',
    origin = 'All',
    destination = 'All',
    packageCount = 'All',
    weight = 'All',
    mode = 'All',
    podStatus = 'All',
    billingStatus = 'All',
    paymentStatus = 'All'
  } = {}) {
    try {
      const queryParams = new URLSearchParams();
      if (search) queryParams.append('search', search);
      if (status && status !== 'All') queryParams.append('status', status);
      if (companyId && companyId !== 'All') queryParams.append('companyId', companyId);
      if (route && route !== 'All') queryParams.append('route', route);
      if (origin && origin !== 'All') queryParams.append('origin', origin);
      if (destination && destination !== 'All') queryParams.append('destination', destination);
      if (packageCount && packageCount !== 'All') queryParams.append('package', packageCount);
      if (weight && weight !== 'All') queryParams.append('weight', weight);
      if (mode && mode !== 'All') queryParams.append('mode', mode);
      if (podStatus && podStatus !== 'All') queryParams.append('podStatus', podStatus);
      if (billingStatus && billingStatus !== 'All') queryParams.append('billingStatus', billingStatus);
      if (paymentStatus && paymentStatus !== 'All') queryParams.append('paymentStatus', paymentStatus);

      const [remoteShipments, remoteInvoices] = await Promise.all([
        apiRequest(`/shipments?${queryParams.toString()}`).catch(() => null),
        getCachedInvoices()
      ]);

      if (Array.isArray(remoteShipments)) {
        const invoiceMap = {};
        if (Array.isArray(remoteInvoices)) {
          remoteInvoices.forEach((inv) => {
            const cns = inv.cns || inv.shipmentIds || [];
            if (inv.cnNumber) cns.push(inv.cnNumber);
            cns.forEach((cn) => {
              invoiceMap[cn] = inv;
            });
          });
        }

        shipmentsStore = remoteShipments.map((s) => {
          const inv = invoiceMap[s.cnNumber] || invoiceMap[s.id] || null;
          let computedPaymentStatus = 'Unbilled';
          if (inv) {
            const invStatus = (inv.status || '').toLowerCase();
            const paid = inv.paidAmount || 0;
            const grand = inv.grandTotal || inv.totalAmount || 0;
            if (invStatus === 'paid' || (grand > 0 && paid >= grand)) {
              computedPaymentStatus = 'Paid';
            } else if (invStatus === 'partially paid' || paid > 0) {
              computedPaymentStatus = 'Partially Paid';
            } else {
              computedPaymentStatus = 'Unpaid';
            }
          } else if (['invoiced', 'billed', 'generated', 'sent'].includes((s.billingStatus || '').toLowerCase())) {
            computedPaymentStatus = 'Unpaid';
          }

          return sanitizeShipment({
            ...s,
            id: s.id || s.cnNumber || s._id,
            paymentStatus: computedPaymentStatus,
            invoice: inv
          });
        });

        const filtered = shipmentsStore.filter((s) => {
          if (companyId !== 'All' && s.companyId !== companyId && s.companyCode !== companyId && s.companyName?.toLowerCase() !== companyId.toLowerCase()) return false;
          if (status !== 'All' && s.status?.toLowerCase() !== status.toLowerCase()) return false;
          if (route !== 'All' && !matchRoute(s.origin, s.destination, route)) return false;
          if (packageCount !== 'All' && !matchPackage(s.packages, packageCount)) return false;
          if (weight !== 'All' && !matchWeight(s.actualWeight, s.chargeableWeight, weight)) return false;
          if (mode !== 'All' && s.mode?.toLowerCase() !== mode.toLowerCase()) return false;
          if (podStatus !== 'All' && s.podStatus?.toLowerCase() !== podStatus.toLowerCase()) return false;
          if (billingStatus !== 'All' && s.billingStatus?.toLowerCase() !== billingStatus.toLowerCase()) return false;
          if (paymentStatus !== 'All' && s.paymentStatus?.toLowerCase() !== paymentStatus.toLowerCase()) return false;

          if (search && search.trim()) {
            const q = search.toLowerCase().trim();
            const cnMatch = s.cnNumber && s.cnNumber.toLowerCase().includes(q);
            const compNameMatch = s.companyName && s.companyName.toLowerCase().includes(q);
            const compCodeMatch = s.companyCode && s.companyCode.toLowerCase().includes(q);
            const consignorMatch = s.consignor?.name?.toLowerCase().includes(q);
            const consigneeMatch = s.consignee?.name?.toLowerCase().includes(q);
            const originMatch = s.origin && s.origin.toLowerCase().includes(q);
            const destMatch = s.destination && s.destination.toLowerCase().includes(q);
            const invoiceMatch = s.invoiceDetails?.invoiceNumber?.toLowerCase().includes(q);
            const ewayMatch = s.ewayBillNumber?.toLowerCase().includes(q);
            const awbMatch = s.awbNumber && s.awbNumber.toLowerCase().includes(q);
            const commMatch = (s.commercialInvoices || []).some(
              (inv) =>
                (inv.invoiceNumber && inv.invoiceNumber.toLowerCase().includes(q)) ||
                (inv.ewayBillNumber && inv.ewayBillNumber.toLowerCase().includes(q)) ||
                (inv.awbNumber && inv.awbNumber.toLowerCase().includes(q))
            );

            return (
              cnMatch ||
              compNameMatch ||
              compCodeMatch ||
              consignorMatch ||
              consigneeMatch ||
              originMatch ||
              destMatch ||
              invoiceMatch ||
              ewayMatch ||
              awbMatch ||
              commMatch
            );
          }

          return true;
        });

        return sortShipments(filtered);
      }
    } catch (err) {
      console.warn('[MongoDB Client] Shipments list fetch fallback:', err.message);
    }

    await simulateDelay(150);

    const fallbackFiltered = shipmentsStore.filter((s) => {
      if (companyId !== 'All' && s.companyId !== companyId && s.companyCode !== companyId && s.companyName?.toLowerCase() !== companyId.toLowerCase()) return false;
      if (status !== 'All' && s.status?.toLowerCase() !== status.toLowerCase()) return false;
      if (route !== 'All' && !matchRoute(s.origin, s.destination, route)) return false;
      if (packageCount !== 'All' && !matchPackage(s.packages, packageCount)) return false;
      if (weight !== 'All' && !matchWeight(s.actualWeight, s.chargeableWeight, weight)) return false;
      if (mode !== 'All' && s.mode?.toLowerCase() !== mode.toLowerCase()) return false;
      if (podStatus !== 'All' && s.podStatus?.toLowerCase() !== podStatus.toLowerCase()) return false;
      if (billingStatus !== 'All' && s.billingStatus?.toLowerCase() !== billingStatus.toLowerCase()) return false;
      if (paymentStatus !== 'All' && s.paymentStatus?.toLowerCase() !== paymentStatus.toLowerCase()) return false;

      if (search && search.trim()) {
        const q = search.toLowerCase().trim();
        const cnMatch = s.cnNumber && s.cnNumber.toLowerCase().includes(q);
        const compNameMatch = s.companyName && s.companyName.toLowerCase().includes(q);
        const compCodeMatch = s.companyCode && s.companyCode.toLowerCase().includes(q);
        const consignorMatch = s.consignor?.name?.toLowerCase().includes(q);
        const consigneeMatch = s.consignee?.name?.toLowerCase().includes(q);
        const originMatch = s.origin && s.origin.toLowerCase().includes(q);
        const destMatch = s.destination && s.destination.toLowerCase().includes(q);
        const invoiceMatch = s.invoiceDetails?.invoiceNumber?.toLowerCase().includes(q);
        const ewayMatch = s.ewayBillNumber?.toLowerCase().includes(q);
        const awbMatch = s.awbNumber && s.awbNumber.toLowerCase().includes(q);
        const commMatch = (s.commercialInvoices || []).some(
          (inv) =>
            (inv.invoiceNumber && inv.invoiceNumber.toLowerCase().includes(q)) ||
            (inv.ewayBillNumber && inv.ewayBillNumber.toLowerCase().includes(q)) ||
            (inv.awbNumber && inv.awbNumber.toLowerCase().includes(q))
        );

        return (
          cnMatch ||
          compNameMatch ||
          compCodeMatch ||
          consignorMatch ||
          consigneeMatch ||
          originMatch ||
          destMatch ||
          invoiceMatch ||
          ewayMatch ||
          awbMatch ||
          commMatch
        );
      }

      return true;
    });

    return sortShipments(fallbackFiltered);
  },

  /**
   * Fetch single shipment by ID or CN Number
   */
  async getShipment(idOrCN) {
    if (!idOrCN || idOrCN === 'undefined') {
      throw new Error(`Invalid Shipment identifier.`);
    }

    try {
      const response = await apiRequest(`/shipments/${encodeURIComponent(idOrCN)}`);
      if (response && (response.cnNumber || response._id)) {
        return sanitizeShipment({
          ...response,
          id: response.id || response.cnNumber || response._id
        });
      }
    } catch (err) {
      console.warn('[MongoDB Client] Single shipment fetch fallback:', err.message);
    }

    await simulateDelay(120);
    const target = String(idOrCN).toLowerCase();
    const found = shipmentsStore.find(
      (s) =>
        (s.id && String(s.id).toLowerCase() === target) ||
        (s.cnNumber && String(s.cnNumber).toLowerCase() === target) ||
        (s._id && String(s._id).toLowerCase() === target)
    );

    if (found) {
      return sanitizeShipment(found);
    }

    const fallbackCN = idOrCN.toUpperCase().startsWith('SS') ? idOrCN.toUpperCase() : `SS${idOrCN}`;
    const fallbackRecord = sanitizeShipment({
      id: fallbackCN,
      cnNumber: fallbackCN,
      cnDate: new Date().toISOString().split('T')[0],
      companyId: 'com-001',
      companyName: 'ADVIK AUTOCOMP PVT LTD - P40',
      companyCode: 'COM-008',
      origin: 'Pune',
      destination: 'Narsapura',
      status: 'Booked',
      podStatus: 'Pending',
      billingStatus: 'Not Ready',
      packages: 0,
      actualWeight: 0,
      chargeableWeight: 0
    });
    shipmentsStore = [fallbackRecord, ...shipmentsStore];
    return fallbackRecord;
  },

  /**
   * Alias for getShipment by CN Number
   */
  async getShipmentByCN(cnNumber) {
    return this.getShipment(cnNumber);
  },

  /**
   * Create new shipment record (MongoDB REST API call with fallback)
   */
  async createShipment(shipmentData) {
    const rawCN = shipmentData.cnNumber && typeof shipmentData.cnNumber === 'string' ? shipmentData.cnNumber.trim() : '';
    const isAuto = !rawCN || rawCN.startsWith('Auto-generat') || rawCN.startsWith('Auto-generate') || rawCN.toLowerCase() === 'auto';
    
    // When creating with auto CN, send empty string to let the backend atomically assign the authoritative next sequential CN
    const payloadWithCN = {
      ...shipmentData,
      cnNumber: isAuto ? '' : rawCN
    };

    try {
      const response = await apiRequest('/shipments', {
        method: 'POST',
        body: JSON.stringify(payloadWithCN)
      });
      if (response && (response.cnNumber || response._id)) {
        const formatted = sanitizeShipment({
          ...response,
          id: response.id || response.cnNumber || response._id,
          cnNumber: response.cnNumber
        });
        shipmentsStore = [formatted, ...shipmentsStore];
        return formatted;
      }
      throw new Error('Invalid response from backend server.');
    } catch (err) {
      console.error('[MongoDB Client] Shipment creation failed:', err);
      throw err;
    }
  },

  /**
   * Validate CN and AWB Number uniqueness
   */
  async validateDuplicates({ currentShipmentId, currentCnNumber, cnNumber, awbNumber, commercialInvoices }) {
    try {
      const response = await apiRequest('/shipments/validate-duplicates', {
        method: 'POST',
        body: JSON.stringify({ currentShipmentId, currentCnNumber, cnNumber, awbNumber, commercialInvoices })
      });
      return response;
    } catch (err) {
      console.warn('[ShipmentService] validateDuplicates API fallback:', err.message);
      const normCN = (cnNumber || '').trim().toLowerCase();
      let cnNumberError = null;
      let conflictingCN = null;
      if (normCN) {
        const found = shipmentsStore.find(s => {
          const sCN = (s.cnNumber || '').trim().toLowerCase();
          const sId = (s.id || s._id || '').toString();
          const isSame = (currentShipmentId && sId === currentShipmentId.toString()) ||
                         (currentCnNumber && sCN === currentCnNumber.trim().toLowerCase());
          return sCN === normCN && !isSame;
        });
        if (found) {
          cnNumberError = `This CN Number "${cnNumber}" already exists in the database. Please enter a unique CN Number.`;
          conflictingCN = found.cnNumber;
        }
      }
      return {
        isValid: !cnNumberError,
        cnNumberError,
        conflictingCN,
        awbNumberError: null,
        commercialInvoiceErrors: []
      };
    }
  },

  /**
   * Update existing shipment details with strict MongoDB persistence
   */
  async updateShipment(idOrCN, updateData) {
    if (!idOrCN || idOrCN === 'undefined') {
      throw new Error(`Invalid Shipment identifier.`);
    }

    try {
      const targetShipment = await this.getShipment(idOrCN);
      const dbId = targetShipment._id || targetShipment.id || idOrCN;

      const response = await apiRequest(`/shipments/${encodeURIComponent(dbId)}`, {
        method: 'PUT',
        body: JSON.stringify(updateData)
      });

      if (response && (response.cnNumber || response._id)) {
        const formatted = {
          ...response,
          id: response.id || response.cnNumber || response._id
        };
        const index = shipmentsStore.findIndex((s) =>
          s.cnNumber === formatted.cnNumber ||
          s._id === formatted._id ||
          s.id === formatted.id ||
          s.cnNumber === idOrCN ||
          s.id === idOrCN
        );
        if (index !== -1) shipmentsStore[index] = formatted;
        else shipmentsStore.unshift(formatted);
        return formatted;
      }
    } catch (err) {
      console.error('[ShipmentService] Update shipment failed in MongoDB Atlas:', err);
      // Strictly propagate error to prevent silent in-memory fallback
      throw err;
    }

    throw new Error('Unable to Update Shipment. The changes could not be saved. Please try again.');
  },

  /**
   * Update operational status and record history timeline entry
   */
  async updateShipmentStatus(idOrCN, newStatus, location = '', remarks = '', extraOperational = {}) {
    await simulateDelay(150);

    const current = await this.getShipment(idOrCN);

    const updatedOperational = {
      ...current.operational,
      currentLocation: location || current.operational?.currentLocation,
      ...(extraOperational.driver ? { driver: extraOperational.driver } : {}),
      ...(extraOperational.vehicle ? { vehicle: extraOperational.vehicle } : {}),
      ...(extraOperational.transporter ? { transporter: extraOperational.transporter } : {}),
      ...(extraOperational.transporterType ? { transporterType: extraOperational.transporterType } : {}),
      ...(typeof extraOperational.pickupCost !== 'undefined' && extraOperational.pickupCost !== ''
        ? { pickupCost: Number(extraOperational.pickupCost) }
        : {})
    };

    const newHistoryItem = {
      status: newStatus,
      timestamp: new Date().toLocaleString('en-IN', { dateStyle: 'short', timeStyle: 'short' }),
      location: location || current.operational?.currentLocation || current.origin,
      remarks: remarks || `Operational status updated to ${newStatus}.`,
      driver: updatedOperational.driver,
      vehicle: updatedOperational.vehicle,
      pickupCost: updatedOperational.pickupCost
    };

    const updatedShipment = {
      ...current,
      status: newStatus,
      operational: updatedOperational,
      statusHistory: [...(current.statusHistory || []), newHistoryItem],
      updatedAt: new Date().toISOString().split('T')[0]
    };

    const target = idOrCN.toLowerCase();
    const index = shipmentsStore.findIndex(
      (s) => (s.id && s.id.toLowerCase() === target) || (s.cnNumber && s.cnNumber.toLowerCase() === target)
    );

    if (index !== -1) {
      shipmentsStore[index] = updatedShipment;
    }

    if (current._id) {
      try {
        await apiRequest(`/shipments/${current._id}`, {
          method: 'PUT',
          body: JSON.stringify(updatedShipment)
        });
      } catch (err) {
        console.warn('[MongoDB Client] Update status DB save error:', err.message);
      }
    }

    // Auto-create Market Driver Payable & Expense entry if pickupCost > 0
    const pickupCostVal = Number(updatedOperational.pickupCost || 0);
    if (pickupCostVal > 0) {
      const vendorName = updatedOperational.driver
        ? `${updatedOperational.driver} (${updatedOperational.vehicle || 'Vehicle'})`
        : (updatedOperational.transporter || 'Market Driver');

      try {
        await payableService.recordPayable({
          vendorName,
          vendorType: updatedOperational.transporterType || 'Market Driver',
          amount: pickupCostVal,
          paidAmount: 0,
          balance: pickupCostVal,
          dueDate: new Date().toISOString().split('T')[0],
          status: 'Pending',
          shipmentId: current.cnNumber,
          cnNumber: current.cnNumber,
          remarks: `Market Driver Pickup Hire Cost for CN ${current.cnNumber}`
        });

        await expenseService.recordExpense({
          title: `Pickup Freight — ${current.cnNumber}`,
          category: 'Operational',
          amount: pickupCostVal,
          paymentStatus: 'Pending',
          shipmentId: current.cnNumber,
          vendorName,
          remarks: `Market Driver Hire Charge for pickup of CN ${current.cnNumber}`
        });
      } catch (e) {
        console.warn('[Shipment Service] Automatic Market Driver Payable creation warning:', e.message);
      }
    }

    return { ...updatedShipment };
  },

  /**
   * Upload document to shipment
   */
  async uploadShipmentDocument(idOrCN, docObj) {
    if (!idOrCN || idOrCN === 'undefined') {
      throw new Error('Invalid Shipment identifier for document upload.');
    }

    const current = await this.getShipment(idOrCN);
    const newDoc = {
      id: `doc-${Date.now()}`,
      name: docObj.name || 'Uploaded_Document.pdf',
      type: docObj.type || 'Other',
      uploadedAt: new Date().toLocaleString('en-IN', { dateStyle: 'short', timeStyle: 'short' }),
      size: docObj.size || '1.5 MB',
      url: docObj.url || ''
    };

    const updatedDocuments = [...(current.documents || []), newDoc];
    const updatedPODStatus = docObj.type === 'POD' ? 'Uploaded' : (current.podStatus || 'Pending');

    const updatedShipment = {
      ...current,
      podStatus: updatedPODStatus,
      podDocumentUrl: docObj.type === 'POD' ? (docObj.url || current.podDocumentUrl) : current.podDocumentUrl,
      documents: updatedDocuments,
      updatedAt: new Date().toISOString().split('T')[0]
    };

    try {
      const targetParam = current._id || current.cnNumber || idOrCN;
      const response = await apiRequest(`/shipments/${encodeURIComponent(targetParam)}`, {
        method: 'PUT',
        body: JSON.stringify(updatedShipment)
      });
      if (response && (response.cnNumber || response._id)) {
        const formatted = {
          ...response,
          id: response.id || response.cnNumber || response._id
        };
        const index = shipmentsStore.findIndex((s) => s.cnNumber === formatted.cnNumber);
        if (index !== -1) shipmentsStore[index] = formatted;
        else shipmentsStore.unshift(formatted);
        return formatted;
      }
    } catch (err) {
      console.warn('[MongoDB Client] Upload document DB save error:', err.message);
    }

    await simulateDelay(200);

    const target = idOrCN.toLowerCase();
    const index = shipmentsStore.findIndex(
      (s) => (s.id && s.id.toLowerCase() === target) || (s.cnNumber && s.cnNumber.toLowerCase() === target)
    );

    if (index !== -1) {
      shipmentsStore[index] = updatedShipment;
    }

    return { ...updatedShipment };
  },

  /**
   * Prepare safe public tracking payload
   */
  async getPublicTracking(cnNumber) {
    await simulateDelay(100);
    const shipment = await this.getShipment(cnNumber);

    return {
      cnNumber: shipment.cnNumber,
      cnDate: shipment.cnDate,
      origin: shipment.origin,
      destination: shipment.destination,
      mode: shipment.mode,
      packages: shipment.packages,
      actualWeight: shipment.actualWeight,
      status: shipment.status,
      currentLocation: shipment.operational?.currentLocation || shipment.origin,
      expectedDeliveryDate: shipment.operational?.expectedDeliveryDate || 'TBD',
      statusHistory: shipment.statusHistory || [],
      podAvailable: shipment.podStatus === 'Uploaded' || shipment.podStatus === 'Verified'
    };
  },

  /**
   * Delete Consignment Note (CN) shipment
   */
  async deleteShipment(idOrCN) {
    try {
      const response = await apiRequest(`/shipments/${encodeURIComponent(idOrCN)}`, {
        method: 'DELETE'
      });
      shipmentsStore = shipmentsStore.filter(
        (s) => s.id !== idOrCN && s.cnNumber !== idOrCN && s._id !== idOrCN
      );
      return response;
    } catch (err) {
      console.warn('[MongoDB Client] Delete shipment error, removing locally:', err.message);
      shipmentsStore = shipmentsStore.filter(
        (s) => s.id !== idOrCN && s.cnNumber !== idOrCN && s._id !== idOrCN
      );
      return { success: true, message: `Shipment ${idOrCN} removed` };
    }
  },

  /**
   * Delete multiple Consignment Note (CN) shipments
   */
  async deleteMultipleShipments(idsOrCNs = []) {
    let successCount = 0;
    for (const id of idsOrCNs) {
      try {
        await this.deleteShipment(id);
        successCount++;
      } catch (err) {
        console.warn(`[Shipment Service] Bulk delete error for ${id}:`, err.message);
      }
    }
    return { success: true, count: successCount };
  }
};
