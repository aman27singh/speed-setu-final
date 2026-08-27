import React, { useState } from 'react';
import { Modal } from '../common/Modal';
import { podService } from '../../services/podService';
import { UploadCloud, CheckCircle2 } from 'lucide-react';

export const PODUploadModal = ({ isOpen, onClose, shipmentId, cnNumber, onSuccess }) => {
  const [selectedFile, setSelectedFile] = useState(null);
  const [inputCN, setInputCN] = useState('');
  const [uploading, setUploading] = useState(false);
  const [uploadComplete, setUploadComplete] = useState(false);

  const activeCN = cnNumber || inputCN || '';

  const handleFileSelect = (e) => {
    if (e.target.files && e.target.files[0]) {
      setSelectedFile(e.target.files[0]);
    }
  };

  const handleUpload = async () => {
    if (!activeCN.trim()) {
      alert('Please specify or select a Consignment Note Number (CN #).');
      return;
    }
    if (!selectedFile) {
      alert('Please select a POD file (PDF, PNG, JPG).');
      return;
    }

    setUploading(true);
    try {
      await podService.uploadPOD(activeCN.trim(), {
        name: selectedFile.name,
        size: `${(selectedFile.size / (1024 * 1024)).toFixed(2)} MB`,
        url: URL.createObjectURL(selectedFile)
      });
      setUploadComplete(true);
      if (onSuccess) onSuccess();
    } catch (err) {
      alert(err.message || 'Failed to upload POD.');
    } finally {
      setUploading(false);
    }
  };

  const handleReset = () => {
    setSelectedFile(null);
    setUploadComplete(false);
    onClose();
  };

  return (
    <Modal
      isOpen={isOpen}
      onClose={handleReset}
      title={`Upload Proof of Delivery (POD) — ${cnNumber || 'Shipment'}`}
      footer={
        uploadComplete ? (
          <button
            onClick={handleReset}
            className="px-4 py-1.5 text-xs font-bold text-white bg-setu-600 rounded hover:bg-setu-700"
          >
            Done
          </button>
        ) : (
          <>
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
              {uploading ? 'Uploading...' : 'Upload POD'}
            </button>
          </>
        )
      }
    >
      <div className="space-y-4 text-xs">
        {uploadComplete ? (
          <div className="p-4 bg-emerald-50 border border-emerald-200 rounded-xl text-center space-y-2">
            <CheckCircle2 className="w-8 h-8 text-emerald-600 mx-auto" />
            <h4 className="font-bold text-slate-900 text-sm">POD Uploaded Successfully!</h4>
            <p className="text-slate-600 text-xs">
              File <strong>{selectedFile?.name}</strong> uploaded for CN <strong>{activeCN}</strong>. Status updated to <strong>Uploaded / Needs Review</strong>.
            </p>
          </div>
        ) : (
          <>
            {!cnNumber ? (
              <div>
                <label className="block font-bold text-slate-700 uppercase tracking-wider mb-1">
                  Consignment Note Number (CN #) <span className="text-rose-500">*</span>
                </label>
                <input
                  type="text"
                  value={inputCN}
                  onChange={(e) => setInputCN(e.target.value)}
                  placeholder="e.g. SS253"
                  className="w-full p-2.5 bg-white border border-slate-300 rounded font-mono font-bold text-slate-900 uppercase"
                />
              </div>
            ) : (
              <div className="p-3 bg-blue-50 border border-blue-100 rounded text-slate-800 text-xs">
                CN Number: <strong className="font-mono text-setu-700">{cnNumber}</strong> (Auto-associated with shipment)
              </div>
            )}

            <div className="border-2 border-dashed border-slate-300 hover:border-setu-600 rounded-xl p-6 text-center bg-slate-50 hover:bg-blue-50/20 transition-all cursor-pointer">
              <input
                type="file"
                id="podFileInput"
                accept=".pdf,.png,.jpg,.jpeg"
                onChange={handleFileSelect}
                className="hidden"
              />
              <label htmlFor="podFileInput" className="cursor-pointer space-y-2 block">
                <UploadCloud className="w-10 h-10 text-setu-600 mx-auto" />
                <div className="font-bold text-slate-900">
                  {selectedFile ? selectedFile.name : 'Click to Browse or Drag & Drop POD Scan'}
                </div>
                <p className="text-slate-500 text-[11px]">
                  Supports PDF, PNG, JPG scans (Up to 25MB)
                </p>
              </label>
            </div>
          </>
        )}
      </div>
    </Modal>
  );
};
