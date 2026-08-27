import { simulateDelay } from './apiClient';
import { shipmentService } from './shipmentService';

export const podService = {
  async getPODs({ search = '', status = 'All', companyId = 'All' } = {}) {
    try {
      const shipments = await shipmentService.getShipments();
      const pods = shipments.map((s) => {
        const podDoc = (s.documents || []).find((d) => d.type === 'POD') || (s.documents || [])[0];
        const cachedDoc = localStorage.getItem(`speedsetu_pod_doc_${(s.cnNumber || s.id || '').toUpperCase()}`);
        const docUrl = s.podDocumentUrl || cachedDoc || podDoc?.url || '';

        return {
          id: `pod-${(s.cnNumber || s.id).toLowerCase()}`,
          shipmentId: s.cnNumber || s.id || s._id,
          cnNumber: s.cnNumber,
          companyName: s.companyName || 'General Client',
          consigneeName: s.consignee?.name || 'Authorized Receiver',
          origin: s.origin,
          destination: s.destination,
          tripId: s.operational?.tripId || '',
          documentId: podDoc?.id || '',
          fileName: podDoc?.name || '',
          fileSize: podDoc?.size || '',
          url: docUrl,
          status: s.podStatus || (docUrl ? 'Uploaded' : 'Pending'),
          deliveryDate: s.operational?.expectedDeliveryDate || s.bookingDate,
          deliveryTime: '14:30',
          receiverName: s.consignee?.name || '',
          receiverPhone: s.consignee?.contact || '',
          shipmentPackages: s.packages || 1,
          deliveredPackages: s.packages || 1,
          damageStatus: 'No Damage',
          shortageStatus: 'No Shortage',
          signatureAvailable: !!docUrl,
          stampAvailable: !!docUrl,
          remarks: ''
        };
      });

      return pods.filter((p) => {
        if (status !== 'All' && p.status.toLowerCase() !== status.toLowerCase()) return false;
        if (companyId !== 'All' && p.companyName !== companyId) return false;

        if (search.trim()) {
          const rawQ = search.toLowerCase().trim();
          const cleanQ = rawQ.replace(/^pod-/i, '');
          return (
            p.id.toLowerCase().includes(rawQ) ||
            p.cnNumber.toLowerCase().includes(cleanQ) ||
            p.companyName.toLowerCase().includes(rawQ) ||
            p.consigneeName.toLowerCase().includes(rawQ)
          );
        }
        return true;
      });
    } catch (err) {
      console.warn('[MongoDB Client] POD fetch fallback:', err.message);
    }

    await simulateDelay(150);
    return [];
  },

  async getPendingPODs() {
    const list = await this.getPODs();
    return list.filter((p) => p.status === 'Pending' || p.status === 'Uploaded' || p.status === 'Needs Review');
  },

  async getPOD(idOrCN) {
    if (!idOrCN || idOrCN === 'undefined') throw new Error('Invalid POD identifier.');
    const targetCN = String(idOrCN).replace(/^pod-/i, '').toUpperCase();
    const cachedDoc = localStorage.getItem(`speedsetu_pod_doc_${targetCN}`);

    const list = await this.getPODs({ search: targetCN });
    if (list && list.length > 0) {
      const podItem = list[0];
      if (!podItem.url && cachedDoc) {
        podItem.url = cachedDoc;
        podItem.status = 'Uploaded';
      }
      return podItem;
    }

    const shipment = await shipmentService.getShipment(targetCN);
    const podDoc = (shipment.documents || []).find((d) => d.type === 'POD') || (shipment.documents || [])[0];
    const docUrl = shipment.podDocumentUrl || cachedDoc || podDoc?.url || '';

    return {
      id: `pod-${shipment.cnNumber.toLowerCase()}`,
      shipmentId: shipment.cnNumber || shipment.id || shipment._id,
      cnNumber: shipment.cnNumber,
      companyName: shipment.companyName || 'General Client',
      consigneeName: shipment.consignee?.name || '',
      origin: shipment.origin,
      destination: shipment.destination,
      tripId: shipment.operational?.tripId || '',
      documentId: podDoc?.id || '',
      fileName: podDoc?.name || '',
      fileSize: podDoc?.size || '',
      url: docUrl,
      status: shipment.podStatus || (docUrl ? 'Uploaded' : 'Pending'),
      deliveryDate: shipment.operational?.expectedDeliveryDate || shipment.bookingDate,
      deliveryTime: '14:30',
      receiverName: shipment.consignee?.name || '',
      receiverPhone: shipment.consignee?.contact || '',
      shipmentPackages: shipment.packages || 1,
      deliveredPackages: shipment.packages || 1,
      damageStatus: 'No Damage',
      shortageStatus: 'No Shortage',
      signatureAvailable: !!docUrl,
      stampAvailable: !!docUrl,
      remarks: ''
    };
  },

  async uploadPOD(shipmentIdOrCN, fileObj) {
    const targetCN = String(shipmentIdOrCN).replace(/^pod-/i, '').toUpperCase();
    const docUrl = fileObj.url || fileObj.dataUrl || '';

    if (docUrl) {
      try {
        localStorage.setItem(`speedsetu_pod_doc_${targetCN}`, docUrl);
      } catch (e) {
        console.warn('[POD Cache] LocalStorage save exception:', e.message);
      }
    }

    const updatedShipment = await shipmentService.uploadShipmentDocument(targetCN, {
      name: fileObj.name || 'POD_Scan.pdf',
      type: 'POD',
      size: typeof fileObj.size === 'number' ? `${(fileObj.size / (1024 * 1024)).toFixed(2)} MB` : (fileObj.size || '1.5 MB'),
      url: docUrl
    });

    await shipmentService.updateShipment(targetCN, {
      podStatus: 'Uploaded',
      podDocumentUrl: docUrl
    });

    return this.getPOD(targetCN);
  },

  async updatePODDetails(idOrCN, verificationData = {}) {
    const pod = await this.getPOD(idOrCN);
    const targetCN = pod?.cnNumber || (pod?.shipmentId ? String(pod.shipmentId).replace(/^pod-/i, '') : String(idOrCN).replace(/^pod-/i, ''));
    const shipment = await shipmentService.getShipment(targetCN).catch(() => ({}));
    const updatedDate = verificationData.deliveryDate || pod.deliveryDate;

    await shipmentService.updateShipment(targetCN, {
      deliveryDate: updatedDate,
      operational: {
        ...(shipment?.operational || {}),
        expectedDeliveryDate: updatedDate,
        actualDeliveryDate: updatedDate,
        deliveryTime: verificationData.deliveryTime || pod.deliveryTime,
        receiverName: verificationData.receiverName || pod.receiverName
      }
    });

    return {
      ...pod,
      ...verificationData,
      deliveryDate: updatedDate
    };
  },

  async verifyPOD(idOrCN, verificationData = {}) {
    const pod = await this.getPOD(idOrCN);
    const targetCN = pod?.cnNumber || (pod?.shipmentId ? String(pod.shipmentId).replace(/^pod-/i, '') : String(idOrCN).replace(/^pod-/i, ''));
    const isPartial = (verificationData.deliveredPackages || pod.deliveredPackages) < pod.shipmentPackages;
    const shipment = await shipmentService.getShipment(targetCN).catch(() => ({}));
    const updatedDate = verificationData.deliveryDate || pod.deliveryDate;

    await shipmentService.updateShipment(targetCN, {
      status: isPartial ? 'Partially Delivered' : 'Delivered',
      podStatus: 'Verified',
      deliveryDate: updatedDate,
      operational: {
        ...(shipment?.operational || {}),
        expectedDeliveryDate: updatedDate,
        actualDeliveryDate: updatedDate,
        deliveryTime: verificationData.deliveryTime || pod.deliveryTime,
        receiverName: verificationData.receiverName || pod.receiverName
      }
    });

    return {
      ...pod,
      ...verificationData,
      deliveryDate: updatedDate,
      status: 'Verified'
    };
  },

  async rejectPOD(idOrCN, reason = 'Illegible signature') {
    const pod = await this.getPOD(idOrCN);
    const targetCN = pod?.cnNumber || (pod?.shipmentId ? String(pod.shipmentId).replace(/^pod-/i, '') : String(idOrCN).replace(/^pod-/i, ''));

    await shipmentService.updateShipment(targetCN, {
      podStatus: 'Missing'
    });

    return {
      ...pod,
      status: 'Rejected',
      rejectionReason: reason
    };
  }
};
