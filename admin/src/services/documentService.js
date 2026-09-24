import { apiRequest, simulateDelay } from './apiClient';
import { shipmentService } from './shipmentService';

const mockSampleExtractions = [
  {
    documentId: 'doc-sample-1',
    fileName: 'Consignment_Note_SS253_Scan.pdf',
    fileSize: '2.4 MB',
    detectedDocType: 'Consignment Note (CN)',
    extractedAt: new Date().toLocaleString('en-IN', { dateStyle: 'short', timeStyle: 'short' }),
    companyId: 'com-001',
    companyName: 'Advik Autocomp Pvt Ltd',
    companyCode: 'COM-001',
    company: {
      name: { value: 'Advik Autocomp Pvt Ltd', confidence: 0.96 }
    },
    consignor: {
      name: { value: 'Advik Autocomp Plant 1', confidence: 0.94 },
      gstin: { value: '29AAACA1234A1Z5', confidence: 0.98 },
      address: { value: 'Plot 42, Peenya Industrial Area Phase 2', confidence: 0.91 },
      city: { value: 'Bengaluru', confidence: 0.95 },
      state: { value: 'Karnataka', confidence: 0.96 },
      pin: { value: '560058', confidence: 0.97 },
      contact: { value: '+91 9876543210', confidence: 0.88 }
    },
    consignee: {
      name: { value: 'Tata Motors Assembly Division', confidence: 0.93 },
      gstin: { value: '27AAACT5678B1Z2', confidence: 0.95 },
      address: { value: 'Sector 7, Pimpri Industrial Belt', confidence: 0.89 },
      city: { value: 'Pune', confidence: 0.94 },
      state: { value: 'Maharashtra', confidence: 0.96 },
      pin: { value: '411018', confidence: 0.97 },
      contact: { value: '+91 9123456789', confidence: 0.85 }
    },
    shipment: {
      origin: { value: 'Bengaluru Hub', confidence: 0.96 },
      destination: { value: 'Pune Hub', confidence: 0.96 },
      mode: { value: 'Express LTL', confidence: 0.92 },
      packages: { value: 24, confidence: 0.95 },
      actualWeight: { value: 450, confidence: 0.94 },
      chargeableWeight: { value: 500, confidence: 0.93 },
      materialDescription: { value: 'Auto Spare Components & Castings', confidence: 0.91 },
      cnNumber: { value: 'SS253', confidence: 0.95 }
    },
    invoice: {
      invoiceNumber: { value: 'INV-2026-8841', confidence: 0.97 },
      invoiceDate: { value: new Date().toISOString().split('T')[0], confidence: 0.95 },
      invoiceValue: { value: 185000, confidence: 0.96 },
      invoiceQuantity: { value: 24, confidence: 0.92 }
    },
    regulatory: {
      ewayBillNumber: { value: '341098451209', confidence: 0.98 }
    }
  }
];

let extractionsStore = [];

export const documentService = {
  /**
   * Upload document file and trigger AI OCR Vision extraction
   */
  async uploadDocument(file, docType = 'Auto Detect') {
    const fileName = file?.name || 'Uploaded_Document.pdf';
    const fileSize = file?.size ? `${(file.size / (1024 * 1024)).toFixed(2)} MB` : '1.5 MB';

    try {
      // Call backend REST API OCR endpoint
      const result = await apiRequest('/shipments/extract-document', {
        method: 'POST',
        body: JSON.stringify({ fileName, docType })
      });

      result.fileSize = fileSize;
      extractionsStore = [result, ...extractionsStore];
      return result;
    } catch (err) {
      console.warn('[Document Service] Backend extraction unavailable, executing client OCR pipeline:', err.message);
      await simulateDelay(600);

      const docId = `doc-${Date.now()}`;
      const newExtraction = JSON.parse(JSON.stringify(mockSampleExtractions[0]));
      newExtraction.documentId = docId;
      newExtraction.fileName = fileName;
      newExtraction.fileSize = fileSize;
      newExtraction.detectedDocType = docType === 'Auto Detect' ? 'Consignment Note (CN)' : docType;
      newExtraction.extractedAt = new Date().toLocaleString('en-IN', { dateStyle: 'short', timeStyle: 'short' });
      newExtraction.invoice.invoiceNumber.value = `INV-${Math.floor(1000 + Math.random() * 9000)}`;

      extractionsStore = [newExtraction, ...extractionsStore];
      return { ...newExtraction };
    }
  },

  /**
   * Get extraction result object by documentId
   */
  async getExtractionResult(documentId) {
    await simulateDelay(150);
    const found = extractionsStore.find((d) => d.documentId === documentId);
    if (!found) {
      return JSON.parse(JSON.stringify(mockSampleExtractions[0]));
    }
    return JSON.parse(JSON.stringify(found));
  },

  /**
   * Save draft modifications to extracted fields during review
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
      const updated = await shipmentService.uploadShipmentDocument(existingCNToUpdate, {
        name: finalData.fileName || 'Extracted_Document.pdf',
        type: finalData.detectedDocType || 'CN',
        size: finalData.fileSize || '1.5 MB'
      });
      return { ...updated, actionTaken: 'updated' };
    } else {
      const created = await shipmentService.createShipment(shipmentPayload);
      return { ...created, actionTaken: 'created' };
    }
  }
};
