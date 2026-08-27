import { simulateDelay } from './apiClient';
import { shipmentService } from './shipmentService';

let extractionsStore = [];

export const documentService = {
  /**
   * Upload document file and simulate AI OCR Vision extraction
   */
  async uploadDocument(file, docType = 'Auto Detect') {
    await simulateDelay(600); // Simulate OCR Vision latency

    const docId = `doc-${Date.now()}`;
    const fileName = file.name || 'Uploaded_Document.pdf';
    const fileSize = `${(file.size / (1024 * 1024)).toFixed(2)} MB`;

    // Clone base sample extraction and adapt for uploaded file
    const newExtraction = JSON.parse(JSON.stringify(mockSampleExtractions[0]));
    newExtraction.documentId = docId;
    newExtraction.fileName = fileName;
    newExtraction.fileSize = fileSize;
    newExtraction.detectedDocType = docType === 'Auto Detect' ? 'Consignment Note (CN)' : docType;
    newExtraction.extractedAt = new Date().toLocaleString('en-IN', { dateStyle: 'short', timeStyle: 'short' });

    extractionsStore = [newExtraction, ...extractionsStore];
    return { ...newExtraction };
  },

  /**
   * Get extraction result object by documentId
   */
  async getExtractionResult(documentId) {
    await simulateDelay(150);
    const found = extractionsStore.find((d) => d.documentId === documentId);
    if (!found) {
      // Fallback to sample
      return JSON.parse(JSON.stringify(mockSampleExtractions[0]));
    }
    return JSON.parse(JSON.stringify(found));
  },

  /**
   * Save draft modifications to extracted fields during admin review
   */
  async reviewExtraction(documentId, updatedData) {
    await simulateDelay(200);
    const idx = extractionsStore.findIndex((d) => d.documentId === documentId);
    if (idx !== -1) {
      extractionsStore[idx] = {
        ...extractionsStore[idx],
        ...updatedData,
        extractionStatus: 'Needs Review'
      };
      return { ...extractionsStore[idx] };
    }
  },

  /**
   * Confirm extraction and create/update official shipment
   */
  async confirmExtraction(documentId, finalData, existingCNToUpdate = null) {
    await simulateDelay(350);

    const idx = extractionsStore.findIndex((d) => d.documentId === documentId);
    if (idx !== -1) {
      extractionsStore[idx].extractionStatus = 'Confirmed';
    }

    // Transform extracted fields into official shipment payload
    const shipmentPayload = {
      companyId: finalData.companyId || 'com-001',
      companyName: finalData.companyName || finalData.company?.name?.value || 'Advik Autocomp Pvt Ltd',
      companyCode: finalData.companyCode || 'COM-001',

      consignor: {
        name: finalData.consignor?.name?.value || finalData.consignor?.name || '',
        gstin: finalData.consignor?.gstin?.value || finalData.consignor?.gstin || '',
        address: finalData.consignor?.address?.value || finalData.consignor?.address || '',
        city: finalData.consignor?.city?.value || finalData.consignor?.city || 'Bengaluru',
        state: finalData.consignor?.state?.value || finalData.consignor?.state || 'Karnataka',
        pin: finalData.consignor?.pin?.value || finalData.consignor?.pin || '560099',
        contact: finalData.consignor?.contact?.value || finalData.consignor?.contact || ''
      },

      consignee: {
        name: finalData.consignee?.name?.value || finalData.consignee?.name || '',
        gstin: finalData.consignee?.gstin?.value || finalData.consignee?.gstin || '',
        address: finalData.consignee?.address?.value || finalData.consignee?.address || '',
        city: finalData.consignee?.city?.value || finalData.consignee?.city || 'Pune',
        state: finalData.consignee?.state?.value || finalData.consignee?.state || 'Maharashtra',
        pin: finalData.consignee?.pin?.value || finalData.consignee?.pin || '411018',
        contact: finalData.consignee?.contact?.value || finalData.consignee?.contact || ''
      },

      origin: finalData.shipment?.origin?.value || finalData.shipment?.origin || 'Bengaluru Hub',
      destination: finalData.shipment?.destination?.value || finalData.shipment?.destination || 'Pune Hub',
      mode: finalData.shipment?.mode?.value || finalData.shipment?.mode || 'Express LTL',
      packages: parseInt(finalData.shipment?.packages?.value || finalData.shipment?.packages || 10, 10),
      actualWeight: parseFloat(finalData.shipment?.actualWeight?.value || finalData.shipment?.actualWeight || 250),
      chargeableWeight: parseFloat(finalData.shipment?.chargeableWeight?.value || finalData.shipment?.chargeableWeight || 300),
      materialDescription: finalData.shipment?.materialDescription?.value || finalData.shipment?.materialDescription || '',

      invoiceDetails: {
        invoiceNumber: finalData.invoice?.invoiceNumber?.value || finalData.invoice?.invoiceNumber || '',
        invoiceDate: finalData.invoice?.invoiceDate?.value || finalData.invoice?.invoiceDate || '',
        invoiceValue: parseFloat(finalData.invoice?.invoiceValue?.value || finalData.invoice?.invoiceValue || 0),
        invoiceQuantity: parseInt(finalData.invoice?.invoiceQuantity?.value || finalData.invoice?.invoiceQuantity || 0, 10)
      },

      ewayBillNumber: finalData.regulatory?.ewayBillNumber?.value || finalData.regulatory?.ewayBillNumber || '',
      status: 'Booked',
      podStatus: 'Pending',
      billingStatus: 'Not Ready',

      documents: [
        {
          id: documentId,
          name: finalData.fileName || 'Extracted_Document.pdf',
          type: finalData.detectedDocType || 'CN',
          uploadedAt: new Date().toLocaleString('en-IN', { dateStyle: 'short', timeStyle: 'short' }),
          size: finalData.fileSize || '1.5 MB'
        }
      ]
    };

    if (existingCNToUpdate) {
      // Attach to existing shipment
      const updated = await shipmentService.uploadShipmentDocument(existingCNToUpdate, {
        name: finalData.fileName || 'Extracted_Document.pdf',
        type: finalData.detectedDocType || 'CN',
        size: finalData.fileSize || '1.5 MB'
      });
      return { ...updated, actionTaken: 'updated' };
    } else {
      // Create new official shipment
      const created = await shipmentService.createShipment(shipmentPayload);
      return { ...created, actionTaken: 'created' };
    }
  }
};
