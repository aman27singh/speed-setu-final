import React, { useState, useEffect } from 'react';
import { ZoomIn, ZoomOut, RotateCw, Maximize2, FileText, ChevronLeft, ChevronRight, Upload, FileCheck } from 'lucide-react';

export const DocumentPreviewer = ({ fileName = '', fileType = 'pdf', initialUrl = '', url = '', onUpload }) => {
  const [zoom, setZoom] = useState(100);
  const [rotation, setRotation] = useState(0);
  const [uploadedFile, setUploadedFile] = useState(null);
  const [uploadedUrl, setUploadedUrl] = useState(initialUrl || url || null);
  const [displayUrl, setDisplayUrl] = useState(null);

  useEffect(() => {
    const raw = uploadedUrl || initialUrl || url;
    if (uploadedFile) {
      setDisplayUrl(URL.createObjectURL(uploadedFile));
      return;
    }
    if (!raw) {
      return;
    }
    if (raw.startsWith('data:')) {
      try {
        const parts = raw.split(';base64,');
        const contentType = parts[0].replace('data:', '');
        const byteCharacters = atob(parts[1]);
        const byteNumbers = new Array(byteCharacters.length);
        for (let i = 0; i < byteCharacters.length; i++) {
          byteNumbers[i] = byteCharacters.charCodeAt(i);
        }
        const byteArray = new Uint8Array(byteNumbers);
        const blob = new Blob([byteArray], { type: contentType });
        const bUrl = URL.createObjectURL(blob);
        setDisplayUrl(bUrl);
      } catch (e) {
        setDisplayUrl(raw);
      }
    } else {
      setDisplayUrl(raw);
    }
  }, [uploadedFile, uploadedUrl, initialUrl, url]);

  const handleZoomIn = () => setZoom((prev) => Math.min(prev + 20, 200));
  const handleZoomOut = () => setZoom((prev) => Math.max(prev - 20, 60));
  const handleRotate = () => setRotation((prev) => (prev + 90) % 360);
  const handleReset = () => {
    setZoom(100);
    setRotation(0);
  };

  const handleFileChange = (e) => {
    const file = e.target.files?.[0];
    if (file) {
      setUploadedFile(file);
      const blobUrl = URL.createObjectURL(file);
      setDisplayUrl(blobUrl);

      const reader = new FileReader();
      reader.onload = (evt) => {
        const base64Data = evt.target.result;
        setUploadedUrl(base64Data);
        if (onUpload) {
          onUpload(file, base64Data);
        }
      };
      reader.readAsDataURL(file);
    }
  };

  const isImage = (uploadedFile && uploadedFile.type?.startsWith('image/')) || (displayUrl && (displayUrl.startsWith('data:image/') || /\.(jpg|jpeg|png|webp)/i.test(displayUrl)));

  return (
    <div className="bg-slate-900 border border-slate-800 rounded-xl overflow-hidden shadow-lg flex flex-col h-full min-h-[550px]">
      {/* Top Document Preview Toolbar */}
      <div className="p-3 bg-slate-950 border-b border-slate-800 flex items-center justify-between text-white text-xs">
        {/* LEFT SIDE: UPLOAD POD PDF BUTTON */}
        <div className="flex items-center gap-2">
          <label className="flex items-center gap-1.5 px-3.5 py-1.5 bg-setu-600 hover:bg-setu-700 text-white font-bold text-xs rounded-lg cursor-pointer transition-colors shadow-xs">
            <Upload className="w-3.5 h-3.5" />
            <span>{uploadedFile ? `Uploaded: ${uploadedFile.name}` : (displayUrl ? 'Re-Upload POD PDF / Photo' : 'Upload POD PDF / Photo')}</span>
            <input
              type="file"
              accept=".pdf,application/pdf,image/*"
              className="hidden"
              onChange={handleFileChange}
            />
          </label>
        </div>

        {/* Zoom & Rotation Controls */}
        <div className="flex items-center gap-1.5">
          <button
            onClick={handleZoomOut}
            className="p-1 text-slate-300 hover:text-white hover:bg-slate-800 rounded"
            title="Zoom Out"
          >
            <ZoomOut className="w-4 h-4" />
          </button>

          <span className="font-mono text-[11px] w-10 text-center">{zoom}%</span>

          <button
            onClick={handleZoomIn}
            className="p-1 text-slate-300 hover:text-white hover:bg-slate-800 rounded"
            title="Zoom In"
          >
            <ZoomIn className="w-4 h-4" />
          </button>

          <button
            onClick={handleRotate}
            className="p-1 text-slate-300 hover:text-white hover:bg-slate-800 rounded"
            title="Rotate 90°"
          >
            <RotateCw className="w-4 h-4" />
          </button>

          <button
            onClick={handleReset}
            className="px-2 py-0.5 text-[10px] font-semibold text-slate-400 hover:text-white bg-slate-800 rounded"
          >
            Reset
          </button>
        </div>
      </div>

      {/* Interactive Document View Canvas */}
      <div className="flex-1 p-4 overflow-auto flex items-center justify-center bg-slate-900/95 relative min-h-[500px]">
        {displayUrl ? (
          <div
            style={{
              transform: `scale(${zoom / 100}) rotate(${rotation}deg)`,
              transformOrigin: 'center center',
              transition: 'transform 0.2s ease-out'
            }}
            className="w-full h-full flex justify-center items-center"
          >
            {isImage ? (
              <img
                src={displayUrl}
                alt="Uploaded POD Document"
                className="max-w-[650px] w-full rounded-lg border border-slate-700 shadow-2xl bg-white object-contain"
              />
            ) : (
              <iframe
                src={displayUrl}
                title="Uploaded POD PDF Document"
                className="w-[640px] h-[780px] rounded-lg border border-slate-700 shadow-2xl bg-white"
              />
            )}
          </div>
        ) : (
          /* Clean Upload Prompt Zone when no file has been uploaded yet */
          <div className="flex flex-col items-center justify-center p-12 text-center border-2 border-dashed border-slate-700 bg-slate-900/60 rounded-2xl max-w-md mx-auto space-y-4 shadow-xl">
            <div className="w-16 h-16 rounded-full bg-slate-800 flex items-center justify-center text-setu-400 border border-slate-700 shadow-inner">
              <FileText className="w-8 h-8" />
            </div>
            <div>
              <h3 className="text-base font-bold text-white mb-1">No POD Document Uploaded Yet</h3>
              <p className="text-xs text-slate-400 leading-relaxed">
                Upload the original scanned PDF consignment note or POD delivery photo to view it here.
              </p>
            </div>
            <label className="flex items-center gap-2 px-5 py-2.5 bg-setu-600 hover:bg-setu-700 text-white font-bold text-xs rounded-xl cursor-pointer shadow-lg transition-all transform hover:scale-105">
              <Upload className="w-4 h-4" />
              <span>Upload POD PDF / Photo Now</span>
              <input
                type="file"
                accept=".pdf,application/pdf,image/*"
                className="hidden"
                onChange={handleFileChange}
              />
            </label>
          </div>
        )}
      </div>
    </div>
  );
};
