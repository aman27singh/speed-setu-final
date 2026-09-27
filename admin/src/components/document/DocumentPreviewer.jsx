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

  const isImage = 
    fileType !== 'pdf' && 
    !fileName?.toLowerCase().endsWith('.pdf') && 
    (
      (uploadedFile && uploadedFile.type?.startsWith('image/')) ||
      (displayUrl && (displayUrl.startsWith('data:image/') || displayUrl.startsWith('blob:') || /\.(jpg|jpeg|png|webp|gif)/i.test(displayUrl))) ||
      fileType?.includes('image') ||
      fileType?.includes('png') ||
      fileType?.includes('jpg') ||
      fileType?.includes('jpeg')
    );

  return (
    <div className="bg-slate-900 border border-slate-800 rounded-xl overflow-hidden shadow-lg flex flex-col w-full">
      {/* Top Document Preview Toolbar */}
      <div className="p-3 bg-slate-950 border-b border-slate-800 flex items-center justify-between text-white text-xs">
        {/* LEFT SIDE: UPLOAD POD PDF BUTTON */}
        <div className="flex items-center gap-2">
          <label className="flex items-center gap-1.5 px-3.5 py-1.5 bg-setu-600 hover:bg-setu-700 text-white font-bold text-xs rounded-lg cursor-pointer transition-colors shadow-xs">
            <Upload className="w-3.5 h-3.5" />
            <span>{uploadedFile ? `Uploaded: ${uploadedFile.name}` : (displayUrl ? 'Re-Upload Photo' : 'Upload POD / Photo')}</span>
            <input
              type="file"
              accept=".pdf,application/pdf,image/*"
              className="hidden"
              onChange={handleFileChange}
            />
          </label>
        </div>

        {/* Rotation Controls */}
        <div className="flex items-center gap-1.5">
          <button
            onClick={handleRotate}
            className="px-3 py-1.5 text-slate-300 hover:text-white bg-slate-800 hover:bg-slate-700 rounded-lg flex items-center gap-1.5 font-bold text-xs cursor-pointer transition-colors"
            title="Rotate Image 90°"
          >
            <RotateCw className="w-3.5 h-3.5" />
            <span>Rotate</span>
          </button>
        </div>
      </div>

      {/* Full Uncropped Document View Canvas */}
      <div className="p-2 sm:p-4 bg-slate-950 flex items-center justify-center relative w-full overflow-hidden">
        {displayUrl ? (
          <div className="w-full flex justify-center items-center">
            {isImage ? (
              <img
                src={displayUrl}
                alt="Full Uploaded Invoice Document"
                style={{
                  transform: `rotate(${rotation}deg)`,
                  transition: 'transform 0.2s ease-out'
                }}
                className="w-full h-auto max-w-full rounded-lg border border-slate-800 shadow-2xl bg-white object-contain block mx-auto"
              />
            ) : (
              <iframe
                src={displayUrl}
                title="Uploaded Document"
                className="w-full h-[600px] sm:h-[800px] rounded-lg border border-slate-700 shadow-2xl bg-white"
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
