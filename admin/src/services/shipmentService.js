import { simulateDelay, apiRequest } from './apiClient';
import { payableService } from './payableService';
import { expenseService } from './expenseService';

let shipmentsStore = [];
let cnCounter = 253; // Next auto-generated CN will be SS253

export const shipmentService = {
  /**
   * Auto-generate next sequential CN number (Server simulation)
   */
  async generateNextCN() {
    await simulateDelay(50);
    return `SS${cnCounter}`;
  },

  /**
   * Fetch shipments list with optional multi-criteria filtering
   */
  async getShipments({
    search = '',
    companyId = 'All',
    status = 'All',
    mode = 'All',
    podStatus = 'All',
    billingStatus = 'All',
    paymentStatus = 'All'
  } = {}) {
    try {
      const queryParams = new URLSearchParams();
      if (search) queryParams.append('search', search);
      if (status && status !== 'All') queryParams.append('status', status);

      const [remoteShipments, remoteInvoices] = await Promise.all([
        apiRequest(`/shipments?${queryParams.toString()}`).catch(() => null),
        apiRequest('/invoices').catch(() => [])
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

          return {
            ...s,
            id: s.id || s.cnNumber || s._id,
            paymentStatus: computedPaymentStatus,
            invoice: inv
          };
        });

        return shipmentsStore.filter((s) => {
          if (companyId !== 'All' && s.companyId !== companyId && s.companyCode !== companyId) return false;
          if (status !== 'All' && s.status?.toLowerCase() !== status.toLowerCase()) return false;
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
      }
    } catch (err) {
      console.warn('[MongoDB Client] Shipments list fetch fallback:', err.message);
    }

    await simulateDelay(150);

    return shipmentsStore.filter((s) => {
      if (companyId !== 'All' && s.companyId !== companyId && s.companyCode !== companyId) return false;
      if (status !== 'All' && s.status?.toLowerCase() !== status.toLowerCase()) return false;
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
        const formatted = {
          ...response,
          id: response.id || response.cnNumber || response._id
        };
        return formatted;
      }
    } catch (err) {
      console.warn('[MongoDB Client] Single shipment fetch fallback:', err.message);
    }

    await simulateDelay(120);
    const target = idOrCN.toLowerCase();
    const found = shipmentsStore.find(
      (s) =>
        (s.id && s.id.toLowerCase() === target) ||
        (s.cnNumber && s.cnNumber.toLowerCase() === target) ||
        (s._id && s._id.toLowerCase() === target)
    );

    if (!found) {
      throw new Error(`Shipment with CN / ID '${idOrCN}' not found.`);
    }
    return { ...found };
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
    try {
      const response = await apiRequest('/shipments', {
        method: 'POST',
        body: JSON.stringify(shipmentData)
      });
      if (response && (response.cnNumber || response._id)) {
        const formatted = {
          ...response,
          id: response.id || response.cnNumber || response._id,
          cnNumber: response.cnNumber || shipmentData.cnNumber
        };
        shipmentsStore = [formatted, ...shipmentsStore];
        return formatted;
      }
    } catch (err) {
      console.warn('[MongoDB Client] Falling back to local store simulation:', err.message);
    }

    await simulateDelay(250);

    const userCN = shipmentData.cnNumber && shipmentData.cnNumber.trim() && !shipmentData.cnNumber.startsWith('Auto-generating')
      ? shipmentData.cnNumber.trim()
      : null;

    const finalCN = userCN || `SS${cnCounter++}`;
    const id = finalCN;

    const initialHistory = [
      {
        status: shipmentData.status || 'Booked',
        timestamp: new Date().toLocaleString('en-IN', { dateStyle: 'short', timeStyle: 'short' }),
        location: shipmentData.origin || 'Booking Branch Hub',
        remarks: `Shipment created. Consignment Note ${finalCN} issued.`
      }
    ];

    const newShipment = {
      ...shipmentData,
      id,
      cnNumber: finalCN,
      cnDate: shipmentData.cnDate || new Date().toISOString().split('T')[0],
      status: shipmentData.status || 'Booked',
      podStatus: shipmentData.podStatus || 'Pending',
      billingStatus: shipmentData.billingStatus || 'Not Ready',
      documents: shipmentData.documents || [],
      statusHistory: initialHistory,
      createdAt: new Date().toISOString().split('T')[0],
      updatedAt: new Date().toISOString().split('T')[0]
    };

    shipmentsStore = [newShipment, ...shipmentsStore];
    return { ...newShipment };
  },

  /**
   * Update existing shipment details
   */
  async updateShipment(idOrCN, updateData) {
    if (!idOrCN || idOrCN === 'undefined') {
      throw new Error(`Invalid Shipment identifier.`);
    }

    try {
      const targetShipment = await this.getShipment(idOrCN);
      const dbId = targetShipment._id || targetShipment.id;

      if (dbId) {
        const response = await apiRequest(`/shipments/${dbId}`, {
          method: 'PUT',
          body: JSON.stringify(updateData)
        });
        if (response) {
          const formatted = {
            ...response,
            id: response.id || response.cnNumber || response._id
          };
          const index = shipmentsStore.findIndex((s) => s.cnNumber === formatted.cnNumber);
          if (index !== -1) shipmentsStore[index] = formatted;
          else shipmentsStore.unshift(formatted);
          return formatted;
        }
      }
    } catch (err) {
      console.warn('[MongoDB Client] Update shipment fallback:', err.message);
    }

    await simulateDelay(200);

    const target = idOrCN.toLowerCase();
    const index = shipmentsStore.findIndex(
      (s) => (s.id && s.id.toLowerCase() === target) || (s.cnNumber && s.cnNumber.toLowerCase() === target)
    );

    if (index === -1) {
      throw new Error(`Shipment '${idOrCN}' not found for update.`);
    }

    const current = shipmentsStore[index];
    const updatedShipment = {
      ...current,
      ...updateData,
      id: current.id || current.cnNumber,
      cnNumber: current.cnNumber,
      updatedAt: new Date().toISOString().split('T')[0]
    };

    shipmentsStore[index] = updatedShipment;
    return { ...updatedShipment };
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
  }
};
