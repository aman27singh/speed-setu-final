import React, { useState, useEffect } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import { documentService } from '../services/documentService';
import { companyService } from '../services/companyService';
import { shipmentService } from '../services/shipmentService';
import { validateExtractionResult } from '../utils/extractionValidation';
import { PageHeader } from '../components/common/PageHeader';
import { DocumentPreviewer } from '../components/document/DocumentPreviewer';
import { ConfidenceBadge } from '../components/document/ConfidenceBadge';
import { LoadingState } from '../components/common/LoadingState';
import { Modal } from '../components/common/Modal';
import {
  UploadCloud,
  FileText,
  CheckCircle2,
  AlertTriangle,
  Building2,
  Package,
  Save,
  ArrowLeft,
  RefreshCw,
  Eye,
  Check,
  X,
  AlertCircle,
  Sparkles,
  User
} from 'lucide-react';

const DOC_TYPES = [
  'Auto Detect',
  'Consignment Note (CN)',
  'Shipment Invoice',
  'E-Way Bill',
  'Proof of Delivery (POD)',
  'Other'
];

export const DocumentExtractionPage = () => {
  const navigate = useNavigate();
  const location = useLocation();

  // Check query params for target shipment if navigating from existing shipment
  const searchParams = new URLSearchParams(location.search);
  const targetShipmentId = searchParams.get('shipmentId') || searchParams.get('cn');

  // Stage: 'upload' | 'processing' | 'review'
  const [stage, setStage] = useState('upload');
  const [selectedDocType, setSelectedDocType] = useState('Auto Detect');
  const [uploadedFile, setUploadedFile] = useState(null);

  // Stepper state
  const [stepIndex, setStepIndex] = useState(0);

  // Extraction Data & Analysis
  const [extractionData, setExtractionData] = useState(null);
  const [companies, setCompanies] = useState([]);
  const [existingShipments, setExistingShipments] = useState([]);
  const [matchAnalysis, setMatchAnalysis] = useState(null);

  const [saving, setSaving] = useState(false);
  const [toastMessage, setToastMessage] = useState('');

  useEffect(() => {
    const loadMasterData = async () => {
      try {
        const [compList, shipList] = await Promise.all([
          companyService.getCompanies(),
          shipmentService.getShipments()
        ]);
        setCompanies(compList);
        setExistingShipments(shipList);
      } catch (err) {
        console.error('Failed to load master data for AI matching:', err);
      }
    };

    loadMasterData();
  }, []);

  const handleFileSelect = (e) => {
    if (e.target.files && e.target.files[0]) {
      startProcessing(e.target.files[0]);
    }
  };

  const handleRunDemoSample = () => {
    startProcessing({ name: 'Consignment_Note_SS253_Scan.pdf', size: 2400000 });
  };

  const startProcessing = async (file) => {
    setUploadedFile(file);
    setStage('processing');
    setStepIndex(1);

    // Simulate Stepper Progress
    setTimeout(() => setStepIndex(2), 300);
    setTimeout(() => setStepIndex(3), 600);
    setTimeout(async () => {
      setStepIndex(4);
      try {
        const result = await documentService.uploadDocument(file, selectedDocType);
        setExtractionData(result);

        const analysis = validateExtractionResult(result, companies, existingShipments);
        setMatchAnalysis(analysis);

        // Pre-fill matched company if exact
        if (analysis.companyMatchStatus === 'exact' && analysis.matchedCompany) {
          result.companyId = analysis.matchedCompany.id;
          result.companyName = analysis.matchedCompany.companyName;
          result.companyCode = analysis.matchedCompany.companyCode;
        }

        setTimeout(() => setStage('review'), 400);
      } catch (err) {
        alert(err.message || 'AI document processing failed.');
        setStage('upload');
      }
    }, 1000);
  };

  const handleFieldChange = (category, field, newValue) => {
    setExtractionData((prev) => {
      const copy = { ...prev };
      if (category && copy[category] && copy[category][field]) {
        copy[category][field] = {
          ...copy[category][field],
          value: newValue
        };
      } else if (category && copy[category]) {
        copy[category][field] = newValue;
      }
      return copy;
    });
  };

  const handleConfirmExtraction = async (attachToExistingCN = null) => {
    setSaving(true);
    try {
      const result = await documentService.confirmExtraction(
        extractionData.documentId,
        extractionData,
        attachToExistingCN || targetShipmentId
      );

      if (result.actionTaken === 'updated') {
        setToastMessage(`Document successfully attached to existing shipment ${attachToExistingCN || targetShipmentId}!`);
        setTimeout(() => navigate(`/admin/shipments/${attachToExistingCN || targetShipmentId}`), 1000);
      } else {
        setToastMessage(`New shipment ${result.cnNumber} created from extracted document!`);
        setTimeout(() => navigate(`/admin/shipments/${result.id}`), 1000);
      }
    } catch (err) {
      alert(err.message || 'Failed to confirm extraction.');
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="space-y-6 max-w-7xl mx-auto pb-12">
      <PageHeader
        title="AI Document Extraction Studio"
        description="Extract Consignment Notes, invoices, and e-way bills with AI OCR assistant."
        breadcrumbs={['Speed Setu Admin', 'Operations', 'AI Document Extraction']}
        actions={
          <button
            type="button"
            onClick={() => navigate('/admin/shipments')}
            className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold text-slate-700 bg-white border border-slate-300 rounded-md hover:bg-slate-50 transition-colors"
          >
            <ArrowLeft className="w-4 h-4" />
            <span>Back to Shipments</span>
          </button>
        }
      />

      {/* Toast Notification */}
      {toastMessage && (
        <div className="p-3 bg-slate-900 text-white rounded-lg text-xs font-semibold flex items-center justify-between shadow-lg animate-fade-in">
          <span>{toastMessage}</span>
          <button onClick={() => setToastMessage('')} className="text-slate-400 hover:text-white font-bold">
            <X className="w-4 h-4" />
          </button>
        </div>
      )}

      {/* STAGE 1: UPLOAD DROPZONE */}
      {stage === 'upload' && (
        <div className="max-w-3xl mx-auto space-y-6">
          <div className="bg-white border border-slate-200 rounded-xl p-8 shadow-xs text-center space-y-6">
            <div>
              <h3 className="text-base font-bold text-slate-900">Upload Shipment Document for AI Extraction</h3>
              <p className="text-xs text-slate-500 mt-1">
                Upload a scanned CN, tax invoice or e-way bill to extract structured fields automatically.
              </p>
            </div>

            {/* Document Type Selector */}
            <div className="max-w-md mx-auto text-left">
              <label className="block font-bold text-slate-700 uppercase tracking-wider text-xs mb-1">
                Document Category
              </label>
              <select
                value={selectedDocType}
                onChange={(e) => setSelectedDocType(e.target.value)}
                className="w-full p-2.5 bg-slate-50 border border-slate-300 rounded-md text-xs font-bold text-slate-900"
              >
                {DOC_TYPES.map((t) => (
                  <option key={t} value={t}>{t}</option>
                ))}
              </select>
            </div>

            {/* Drag and Drop Zone */}
            <div className="border-2 border-dashed border-slate-300 hover:border-setu-600 rounded-2xl p-8 bg-slate-50 hover:bg-blue-50/20 transition-all space-y-4">
              <input
                type="file"
                id="docUploadInput"
                accept=".pdf,.png,.jpg,.jpeg,.xlsx,.csv"
                onChange={handleFileSelect}
                className="hidden"
              />
              <label htmlFor="docUploadInput" className="cursor-pointer space-y-3 block">
                <UploadCloud className="w-12 h-12 text-setu-600 mx-auto" />
                <div>
                  <span className="text-sm font-bold text-slate-900 block">Drag & drop or Click to Browse Files</span>
                  <span className="text-xs text-slate-500 font-mono">JPG • PNG • PDF • XLSX • CSV (Max 25MB)</span>
                </div>
              </label>

              <div className="pt-3 border-t border-slate-200">
                <button
                  type="button"
                  onClick={handleRunDemoSample}
                  className="inline-flex items-center gap-2 px-4 py-2 text-xs font-bold text-purple-700 bg-purple-50 border border-purple-200 hover:bg-purple-100 rounded-lg shadow-xs transition-colors"
                >
                  <Sparkles className="w-4 h-4 text-purple-600" />
                  <span>⚡ Try Demo AI Extraction Sample (Consignment_Note_SS253.pdf)</span>
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* STAGE 2: PROCESSING STEPPER */}
      {stage === 'processing' && (
        <div className="max-w-lg mx-auto bg-white border border-slate-200 rounded-xl p-8 shadow-xs text-center space-y-6">
          <RefreshCw className="w-10 h-10 text-setu-600 mx-auto animate-spin" />

          <div>
            <h3 className="text-base font-bold text-slate-900">AI Vision Processing Document...</h3>
            <p className="text-xs text-slate-500 mt-0.5">Reading bounding boxes, OCR text and company matching</p>
          </div>

          <div className="space-y-3 text-xs text-left max-w-xs mx-auto border-t border-slate-100 pt-4">
            <div className="flex items-center gap-2">
              <CheckCircle2 className={`w-4 h-4 ${stepIndex >= 1 ? 'text-emerald-600' : 'text-slate-300'}`} />
              <span className={stepIndex >= 1 ? 'font-semibold text-slate-900' : 'text-slate-400'}>Document uploaded</span>
            </div>

            <div className="flex items-center gap-2">
              <CheckCircle2 className={`w-4 h-4 ${stepIndex >= 2 ? 'text-emerald-600' : 'text-slate-300'}`} />
              <span className={stepIndex >= 2 ? 'font-semibold text-slate-900' : 'text-slate-400'}>
                Document type detected ({selectedDocType})
              </span>
            </div>

            <div className="flex items-center gap-2">
              <CheckCircle2 className={`w-4 h-4 ${stepIndex >= 3 ? 'text-emerald-600' : 'text-slate-300'}`} />
              <span className={stepIndex >= 3 ? 'font-semibold text-slate-900' : 'text-slate-400'}>Reading document & OCR</span>
            </div>

            <div className="flex items-center gap-2">
              <CheckCircle2 className={`w-4 h-4 ${stepIndex >= 4 ? 'text-emerald-600' : 'text-slate-300'}`} />
              <span className={stepIndex >= 4 ? 'font-semibold text-slate-900' : 'text-slate-400'}>
                Extracting & validating fields
              </span>
            </div>
          </div>
        </div>
      )}

      {/* STAGE 3: SPLIT-SCREEN REVIEW INTERFACE */}
      {stage === 'review' && extractionData && (
        <div className="space-y-6">
          {/* SAFEGUARDS & WARNING BANNERS */}
          {matchAnalysis?.warnings?.length > 0 && (
            <div className="p-4 bg-amber-50 border border-amber-200 rounded-xl text-amber-900 text-xs space-y-1">
              <div className="flex items-center gap-2 font-bold text-amber-900 text-sm mb-1">
                <AlertTriangle className="w-4 h-4 text-amber-600" />
                <span>Admin Safeguard & Review Warnings:</span>
              </div>
              <ul className="list-disc list-inside space-y-0.5 text-amber-800">
                {matchAnalysis.warnings.map((w, idx) => (
                  <li key={idx}>{w}</li>
                ))}
              </ul>
            </div>
          )}

          {/* DUPLICATE CN WARNING CARD */}
          {matchAnalysis?.cnMatchStatus === 'existing' && matchAnalysis?.existingCN && (
            <div className="p-4 bg-rose-50 border border-rose-200 rounded-xl text-rose-900 text-xs flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
              <div>
                <strong className="font-bold text-rose-900 block text-sm">
                  Existing Shipment Found: CN {matchAnalysis.existingCN.cnNumber}
                </strong>
                <span>
                  Company: {matchAnalysis.existingCN.companyName} | Route: {matchAnalysis.existingCN.origin} → {matchAnalysis.existingCN.destination}
                </span>
              </div>

              <button
                onClick={() => handleConfirmExtraction(matchAnalysis.existingCN.cnNumber)}
                className="px-3 py-1.5 bg-rose-600 hover:bg-rose-700 text-white font-bold text-xs rounded transition-colors"
              >
                Attach Document to CN {matchAnalysis.existingCN.cnNumber}
              </button>
            </div>
          )}

          {/* SPLIT SCREEN GRID */}
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            {/* LEFT PANE: DOCUMENT PREVIEWER */}
            <div className="h-full">
              <DocumentPreviewer fileName={extractionData.fileName} fileType={extractionData.fileType} />
            </div>

            {/* RIGHT PANE: EDITABLE EXTRACTED FORM WITH CONFIDENCE BADGES */}
            <div className="bg-white border border-slate-200 rounded-xl p-6 shadow-xs space-y-6">
              <div className="flex items-center justify-between border-b border-slate-100 pb-3">
                <div>
                  <h3 className="text-sm font-bold text-slate-900">Extracted Shipment Information</h3>
                  <p className="text-xs text-slate-500">Verify and edit extracted values before confirming</p>
                </div>

                <button
                  type="button"
                  onClick={() => setStage('upload')}
                  className="px-2.5 py-1 text-xs font-semibold text-slate-600 bg-slate-100 hover:bg-slate-200 rounded"
                >
                  Upload Different File
                </button>
              </div>

              <div className="space-y-6 text-xs max-h-[600px] overflow-y-auto pr-2 space-y-5">
                {/* COMPANY MATCH CARD */}
                <div className="p-3.5 bg-slate-50 border border-slate-200 rounded-lg space-y-2">
                  <div className="flex items-center justify-between">
                    <span className="font-bold text-slate-700 uppercase tracking-wider text-[11px] flex items-center gap-1.5">
                      <Building2 className="w-3.5 h-3.5 text-setu-600" />
                      Corporate Account Match
                    </span>
                    <ConfidenceBadge score={extractionData.company?.name?.confidence} />
                  </div>

                  <select
                    value={extractionData.companyId || companies[0]?.id}
                    onChange={(e) => {
                      const comp = companies.find((c) => c.id === e.target.value);
                      if (comp) {
                        setExtractionData((prev) => ({
                          ...prev,
                          companyId: comp.id,
                          companyName: comp.companyName,
                          companyCode: comp.companyCode
                        }));
                      }
                    }}
                    className="w-full p-2 bg-white border border-slate-300 rounded font-bold text-slate-900"
                  >
                    {companies.map((c) => (
                      <option key={c.id} value={c.id}>
                        {c.companyName} ({c.companyCode}) — GST: {c.gstin || 'N/A'}
                      </option>
                    ))}
                  </select>
                </div>

                {/* CONSIGNOR (SHIPPER) DETAILS */}
                <div className="space-y-3 p-3 bg-emerald-50/40 border border-emerald-100 rounded-lg">
                  <div className="flex items-center justify-between border-b border-emerald-200/60 pb-1.5">
                    <h4 className="font-bold text-emerald-900 uppercase tracking-wider text-[11px] flex items-center gap-1.5">
                      <User className="w-3.5 h-3.5 text-emerald-600" />
                      Consignor (Shipper)
                    </h4>
                    <ConfidenceBadge score={extractionData.consignor?.name?.confidence} />
                  </div>

                  <div className="grid grid-cols-2 gap-3">
                    <div className="col-span-2">
                      <label className="font-bold text-slate-700 block mb-0.5">Consignor Name</label>
                      <input
                        type="text"
                        value={extractionData.consignor?.name?.value || ''}
                        onChange={(e) => handleFieldChange('consignor', 'name', e.target.value)}
                        className="w-full p-2 bg-white border border-slate-300 rounded font-semibold text-slate-900"
                      />
                    </div>

                    <div>
                      <label className="font-bold text-slate-700 block mb-0.5">Consignor GSTIN</label>
                      <input
                        type="text"
                        value={extractionData.consignor?.gstin?.value || ''}
                        onChange={(e) => handleFieldChange('consignor', 'gstin', e.target.value)}
                        className="w-full p-2 bg-white border border-slate-300 rounded font-mono"
                      />
                    </div>

                    <div>
                      <label className="font-bold text-slate-700 block mb-0.5">Contact Phone</label>
                      <input
                        type="text"
                        value={extractionData.consignor?.contact?.value || ''}
                        onChange={(e) => handleFieldChange('consignor', 'contact', e.target.value)}
                        className="w-full p-2 bg-white border border-slate-300 rounded font-mono"
                      />
                    </div>

                    <div className="col-span-2">
                      <label className="font-bold text-slate-700 block mb-0.5">Pickup Address</label>
                      <input
                        type="text"
                        value={extractionData.consignor?.address?.value || ''}
                        onChange={(e) => handleFieldChange('consignor', 'address', e.target.value)}
                        className="w-full p-2 bg-white border border-slate-300 rounded"
                      />
                    </div>
                  </div>
                </div>

                {/* CONSIGNEE (RECEIVER) DETAILS */}
                <div className="space-y-3 p-3 bg-amber-50/40 border border-amber-100 rounded-lg">
                  <div className="flex items-center justify-between border-b border-amber-200/60 pb-1.5">
                    <h4 className="font-bold text-amber-900 uppercase tracking-wider text-[11px] flex items-center gap-1.5">
                      <User className="w-3.5 h-3.5 text-amber-600" />
                      Consignee (Receiver)
                    </h4>
                    <ConfidenceBadge score={extractionData.consignee?.name?.confidence} />
                  </div>

                  <div className="grid grid-cols-2 gap-3">
                    <div className="col-span-2">
                      <label className="font-bold text-slate-700 block mb-0.5">Consignee Name</label>
                      <input
                        type="text"
                        value={extractionData.consignee?.name?.value || ''}
                        onChange={(e) => handleFieldChange('consignee', 'name', e.target.value)}
                        className="w-full p-2 bg-white border border-slate-300 rounded font-semibold text-slate-900"
                      />
                    </div>

                    <div>
                      <label className="font-bold text-slate-700 block mb-0.5">Consignee GSTIN</label>
                      <input
                        type="text"
                        value={extractionData.consignee?.gstin?.value || ''}
                        onChange={(e) => handleFieldChange('consignee', 'gstin', e.target.value)}
                        className="w-full p-2 bg-white border border-slate-300 rounded font-mono"
                      />
                    </div>

                    <div>
                      <label className="font-bold text-slate-700 block mb-0.5">Contact Phone</label>
                      <input
                        type="text"
                        value={extractionData.consignee?.contact?.value || ''}
                        onChange={(e) => handleFieldChange('consignee', 'contact', e.target.value)}
                        className="w-full p-2 bg-white border border-slate-300 rounded font-mono"
                      />
                    </div>

                    <div className="col-span-2">
                      <label className="font-bold text-slate-700 block mb-0.5">Delivery Address</label>
                      <input
                        type="text"
                        value={extractionData.consignee?.address?.value || ''}
                        onChange={(e) => handleFieldChange('consignee', 'address', e.target.value)}
                        className="w-full p-2 bg-white border border-slate-300 rounded"
                      />
                    </div>
                  </div>
                </div>

                {/* CARGO SPECS */}
                <div className="space-y-3">
                  <h4 className="font-bold text-slate-700 uppercase tracking-wider text-[11px] border-b border-slate-100 pb-1">
                    Shipment & Cargo Specs
                  </h4>

                  <div className="grid grid-cols-2 gap-3">
                    <div>
                      <div className="flex items-center justify-between mb-1">
                        <label className="font-bold text-slate-700">CN Number</label>
                        <ConfidenceBadge score={extractionData.shipment?.cnNumber?.confidence} />
                      </div>
                      <input
                        type="text"
                        value={extractionData.shipment?.cnNumber?.value || ''}
                        onChange={(e) => handleFieldChange('shipment', 'cnNumber', e.target.value)}
                        className="w-full p-2 bg-slate-50 border border-slate-300 rounded font-mono font-bold"
                      />
                    </div>

                    <div>
                      <div className="flex items-center justify-between mb-1">
                        <label className="font-bold text-slate-700">CN Date</label>
                        <ConfidenceBadge score={extractionData.shipment?.cnDate?.confidence} />
                      </div>
                      <input
                        type="date"
                        value={extractionData.shipment?.cnDate?.value || ''}
                        onChange={(e) => handleFieldChange('shipment', 'cnDate', e.target.value)}
                        className="w-full p-2 bg-slate-50 border border-slate-300 rounded font-mono font-bold"
                      />
                    </div>

                    <div>
                      <div className="flex items-center justify-between mb-1">
                        <label className="font-bold text-slate-700">Origin City</label>
                        <ConfidenceBadge score={extractionData.shipment?.origin?.confidence} />
                      </div>
                      <input
                        type="text"
                        value={extractionData.shipment?.origin?.value || ''}
                        onChange={(e) => handleFieldChange('shipment', 'origin', e.target.value)}
                        className="w-full p-2 bg-slate-50 border border-slate-300 rounded font-medium"
                      />
                    </div>

                    <div>
                      <div className="flex items-center justify-between mb-1">
                        <label className="font-bold text-slate-700">Destination City</label>
                        <ConfidenceBadge score={extractionData.shipment?.destination?.confidence} />
                      </div>
                      <input
                        type="text"
                        value={extractionData.shipment?.destination?.value || ''}
                        onChange={(e) => handleFieldChange('shipment', 'destination', e.target.value)}
                        className="w-full p-2 bg-slate-50 border border-slate-300 rounded font-medium"
                      />
                    </div>

                    <div>
                      <div className="flex items-center justify-between mb-1">
                        <label className="font-bold text-slate-700">Packages</label>
                        <ConfidenceBadge score={extractionData.shipment?.packages?.confidence} />
                      </div>
                      <input
                        type="number"
                        value={extractionData.shipment?.packages?.value || 0}
                        onChange={(e) => handleFieldChange('shipment', 'packages', e.target.value)}
                        className="w-full p-2 bg-slate-50 border border-slate-300 rounded font-mono font-bold"
                      />
                    </div>

                    <div>
                      <div className="flex items-center justify-between mb-1">
                        <label className="font-bold text-slate-700">Actual Weight (Kg)</label>
                        <ConfidenceBadge score={extractionData.shipment?.actualWeight?.confidence} />
                      </div>
                      <input
                        type="number"
                        value={extractionData.shipment?.actualWeight?.value || 0}
                        onChange={(e) => handleFieldChange('shipment', 'actualWeight', e.target.value)}
                        className="w-full p-2 bg-slate-50 border border-slate-300 rounded font-mono font-bold text-emerald-700"
                      />
                    </div>

                    <div className="col-span-2">
                      <div className="flex items-center justify-between mb-1">
                        <label className="font-bold text-slate-700">Commodity Description</label>
                        <ConfidenceBadge score={extractionData.shipment?.materialDescription?.confidence} />
                      </div>
                      <input
                        type="text"
                        value={extractionData.shipment?.materialDescription?.value || ''}
                        onChange={(e) => handleFieldChange('shipment', 'materialDescription', e.target.value)}
                        className="w-full p-2 bg-slate-50 border border-slate-300 rounded font-medium"
                      />
                    </div>
                  </div>
                </div>

                {/* INVOICE & REGULATORY */}
                <div className="space-y-3">
                  <h4 className="font-bold text-slate-700 uppercase tracking-wider text-[11px] border-b border-slate-100 pb-1">
                    Invoice & Regulatory
                  </h4>

                  <div className="grid grid-cols-2 gap-3">
                    <div>
                      <div className="flex items-center justify-between mb-1">
                        <label className="font-bold text-slate-700">Invoice Number</label>
                        <ConfidenceBadge score={extractionData.invoice?.invoiceNumber?.confidence} />
                      </div>
                      <input
                        type="text"
                        value={extractionData.invoice?.invoiceNumber?.value || ''}
                        onChange={(e) => handleFieldChange('invoice', 'invoiceNumber', e.target.value)}
                        className="w-full p-2 bg-slate-50 border border-slate-300 rounded font-mono"
                      />
                    </div>

                    <div>
                      <div className="flex items-center justify-between mb-1">
                        <label className="font-bold text-slate-700">E-Way Bill Number</label>
                        <ConfidenceBadge score={extractionData.regulatory?.ewayBillNumber?.confidence} />
                      </div>
                      <input
                        type="text"
                        value={extractionData.regulatory?.ewayBillNumber?.value || ''}
                        onChange={(e) => handleFieldChange('regulatory', 'ewayBillNumber', e.target.value)}
                        className="w-full p-2 bg-slate-50 border border-slate-300 rounded font-mono font-bold"
                      />
                    </div>
                  </div>
                </div>
              </div>

              {/* BOTTOM ACTIONS */}
              <div className="flex items-center justify-end gap-3 pt-4 border-t border-slate-200">
                <button
                  type="button"
                  onClick={() => navigate('/admin/shipments')}
                  className="px-3.5 py-2 text-xs font-semibold text-slate-700 bg-white border border-slate-300 rounded-md hover:bg-slate-50 transition-colors"
                >
                  Cancel
                </button>

                <button
                  type="button"
                  disabled={saving}
                  onClick={() => handleConfirmExtraction(null)}
                  className="inline-flex items-center gap-2 px-5 py-2 text-xs font-bold text-white bg-setu-600 hover:bg-setu-700 rounded-md shadow-sm transition-colors disabled:opacity-50"
                >
                  <Save className="w-4 h-4" />
                  <span>{saving ? 'Creating Shipment...' : 'Confirm & Create Official Shipment'}</span>
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
