import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { Modal } from '../common/Modal';
import { shipmentService } from '../../services/shipmentService';
import { UploadCloud, FileText, CheckCircle2, Sparkles } from 'lucide-react';

export const DocumentUploadModal = ({ isOpen, onClose, shipmentId = null, onUploadSuccess }) => {
  const navigate = useNavigate();
  const [targetCN, setTargetCN] = useState(shipmentId || '');
  const [docType, setDocType] = useState('Invoice');
  const [selectedFile, setSelectedFile] = useState(null);
  const [fileDataUrl, setFileDataUrl] = useState('');
  const [uploading, setUploading] = useState(false);
  const [uploadComplete, setUploadComplete] = useState(false);
  const [availableShipments, setAvailableShipments] = useState([]);

  useEffect(() => {
    if (shipmentId) {
      setTargetCN(shipmentId);
    } else if (isOpen) {
      shipmentService.getShipments().then((list) => {
        setAvailableShipments(list || []);
        if (list && list.length > 0) {
          setTargetCN(list[0].cnNumber || list[0].id);
        }
      }).catch((e) => console.warn('Could not load shipments list:', e));
    }
  }, [isOpen, shipmentId]);

  const handleFileSelect = (e) => {
    if (e.target.files && e.target.files[0]) {
      const file = e.target.files[0];
      setSelectedFile(file);

      // Read file content as Data URL for previewing & downloading
      const reader = new FileReader();
      reader.onload = (evt) => {
        setFileDataUrl(evt.target.result);
      };
      reader.readAsDataURL(file);
    }
  };

  const handleUpload = async () => {
    if (!selectedFile) {
      alert('Please select a document file to upload.');
      return;
    }

    const cnToUse = shipmentId || targetCN;
    if (!cnToUse) {
      alert('Please select or enter a Consignment Note (CN) to attach this document.');
      return;
    }

    setUploading(true);
    try {
      await shipmentService.uploadShipmentDocument(cnToUse, {
        name: selectedFile.name,
        type: docType,
        size: `${(selectedFile.size / (1024 * 1024)).toFixed(2)} MB`,
        url: fileDataUrl || ''
      });

      setUploadComplete(true);
      if (onUploadSuccess) onUploadSuccess();
    } catch (err) {
      alert(err.message || 'Failed to upload document.');
    } finally {
      setUploading(false);
    }
  };

  const handleReset = () => {
    setSelectedFile(null);
    setFileDataUrl('');
    setUploadComplete(false);
    onClose();
  };

  return (
    <Modal
      isOpen={isOpen}
      onClose={handleReset}
      title="Upload Shipment Document"
      footer={
        uploadComplete ? (
          <button
            onClick={handleReset}
            className="px-4 py-1.5 text-xs font-bold text-white bg-setu-600 rounded hover:bg-setu-700"
          >
            Done
          </button>
        ) : (
          <div className="flex items-center justify-between w-full">
            <button
              type="button"
              onClick={() => {
                const activeCN = shipmentId || targetCN;
                onClose();
                navigate(activeCN ? `/admin/shipments/upload?shipmentId=${activeCN}` : '/admin/shipments/upload');
              }}
              className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-bold text-purple-700 bg-purple-50 border border-purple-200 rounded hover:bg-purple-100"
            >
              <Sparkles className="w-3.5 h-3.5" />
              <span>Launch AI Extraction Studio</span>
            </button>

            <div className="flex items-center gap-2">
              <button
                onClick={handleReset}
                className="px-3 py-1.5 text-xs font-semibold text-slate-700 bg-white border border-slate-300 rounded"
              >
                Cancel
              </button>
              <button
                onClick={handleUpload}
                disabled={uploading || !selectedFile}
                className="px-4 py-1.5 text-xs font-bold text-white bg-setu-600 hover:bg-setu-700 rounded disabled:opacity-50"
              >
                {uploading ? 'Uploading...' : 'Quick Upload'}
              </button>
            </div>
          </div>
        )
      }
    >
      <div className="space-y-4 text-xs">
        {uploadComplete ? (
          <div className="p-4 bg-emerald-50 border border-emerald-200 rounded-xl text-center space-y-2">
            <CheckCircle2 className="w-8 h-8 text-emerald-600 mx-auto" />
            <h4 className="font-bold text-slate-900 text-sm">Document Uploaded Successfully!</h4>
            <p className="text-slate-600 text-xs">
              File <strong>{selectedFile?.name}</strong> has been archived under shipment records.
            </p>
          </div>
        ) : (
          <>
            {/* Target CN selection if not fixed by prop */}
            {!shipmentId && (
              <div>
                <label className="block font-bold text-slate-700 uppercase tracking-wider mb-1">
                  Select Consignment Note (CN)
                </label>
                {availableShipments.length > 0 ? (
                  <select
                    value={targetCN}
                    onChange={(e) => setTargetCN(e.target.value)}
                    className="w-full p-2.5 bg-slate-50 border border-slate-300 rounded-md focus:outline-none focus:ring-2 focus:ring-setu-600/20 font-semibold text-slate-900"
                  >
                    {availableShipments.map((s) => (
                      <option key={s.id || s.cnNumber} value={s.cnNumber || s.id}>
                        {s.cnNumber} — {s.companyName || 'General'} ({s.origin} → {s.destination})
                      </option>
                    ))}
                  </select>
                ) : (
                  <input
                    type="text"
                    value={targetCN}
                    onChange={(e) => setTargetCN(e.target.value)}
                    placeholder="Enter Consignment Note number (e.g. SS254)"
                    className="w-full p-2.5 bg-slate-50 border border-slate-300 rounded-md font-semibold text-slate-900"
                  />
                )}
              </div>
            )}

            <div>
              <label className="block font-bold text-slate-700 uppercase tracking-wider mb-1">
                Document Category / Type
              </label>
              <select
                value={docType}
                onChange={(e) => setDocType(e.target.value)}
                className="w-full p-2.5 bg-slate-50 border border-slate-300 rounded-md focus:outline-none focus:ring-2 focus:ring-setu-600/20 font-semibold text-slate-900"
              >
                <option value="CN">CN / Consignment Note</option>
                <option value="Invoice">Tax Invoice / Packing List</option>
                <option value="E-Way Bill">E-Way Bill Document</option>
                <option value="POD">Proof of Delivery (POD)</option>
                <option value="Other">Other Operational Attachment</option>
              </select>
            </div>

            <div className="border-2 border-dashed border-slate-300 hover:border-setu-600 rounded-xl p-6 text-center bg-slate-50 hover:bg-blue-50/20 transition-all cursor-pointer">
              <input
                type="file"
                id="docFileInputModal"
                accept=".pdf,.png,.jpg,.jpeg,.xlsx,.csv"
                onChange={handleFileSelect}
                className="hidden"
              />
              <label htmlFor="docFileInputModal" className="cursor-pointer space-y-2 block">
                <UploadCloud className="w-10 h-10 text-setu-600 mx-auto" />
                <div className="font-bold text-slate-900">
                  {selectedFile ? selectedFile.name : 'Click to Browse or Drag & Drop File'}
                </div>
                <p className="text-slate-500 text-[11px]">
                  Supports PDF, PNG, JPG, XLSX, and CSV documents (Up to 25MB)
                </p>
              </label>
            </div>
          </>
        )}
      </div>
    </Modal>
  );
};
