import React, { useRef, useState, useEffect } from 'react';
import { X, Printer, Share2, Check, FileText, Download, Loader2 } from 'lucide-react';
import jsPDF from 'jspdf';
import html2canvas from 'html2canvas';
import logoImg from '../../assets/logo1.png';

export const ConsignmentNoteModal = ({ isOpen, onClose, shipment, autoPrint = false }) => {
  const printRef = useRef(null);
  const [copiedToast, setCopiedToast] = useState(null);
  const [isGeneratingPdf, setIsGeneratingPdf] = useState(false);
  const [logoBase64, setLogoBase64] = useState(logoImg);

  // Convert logo to inline Base64 data URI on mount to ensure html2canvas & print PDF engines never miss logo
  useEffect(() => {
    if (!logoImg) return;
    const img = new Image();
    img.crossOrigin = 'Anonymous';
    img.onload = () => {
      try {
        const canvas = document.createElement('canvas');
        canvas.width = img.width;
        canvas.height = img.height;
        const ctx = canvas.getContext('2d');
        ctx.drawImage(img, 0, 0);
        setLogoBase64(canvas.toDataURL('image/png'));
      } catch (e) {
        setLogoBase64(logoImg);
      }
    };
    img.onerror = () => setLogoBase64(logoImg);
    img.src = logoImg;
  }, []);

  useEffect(() => {
    if (isOpen && autoPrint && shipment) {
      const timer = setTimeout(() => {
        handlePrintSplit();
      }, 300);
      return () => clearTimeout(timer);
    }
  }, [isOpen, autoPrint, shipment]);

  if (!isOpen || !shipment) return null;

  const getShareText = (isSplit = false) => {
    const cnNo = shipment.cnNumber || shipment.cn_number || shipment.cnNo || 'SS2004';
    const consignorName = shipment.consignor?.name || 'Shipper';
    const consigneeName = shipment.consignee?.name || 'Receiver';
    const layoutType = isSplit ? 'Split 2-in-1 Duplicate CN (2 Copies/A4)' : 'Single Page CN';
    return `Speed Setu Consignment Note (CN: ${cnNo})\nConsignor: ${consignorName}\nConsignee: ${consigneeName}\nFormat: ${layoutType}`;
  };

  // Helper function to build 300+ DPI razor-sharp PDF File object using html2canvas & jsPDF
  const generateCnPdfFile = async (isSplit = false) => {
    const printContent = printRef.current;
    if (!printContent) throw new Error('Document element not found');

    const cnNo = shipment.cnNumber || shipment.cn_number || shipment.cnNo || 'SS2004';

    // Capture SVG layout at 4x high resolution scaling (300+ DPI) with base64 embedded assets
    const canvas = await html2canvas(printContent, {
      scale: 4,
      useCORS: true,
      allowTaint: true,
      backgroundColor: '#ffffff',
      logging: false,
      imageTimeout: 0,
    });
    const imgData = canvas.toDataURL('image/png', 1.0);

    let pdf;
    if (!isSplit) {
      // Single Page CN -> A4 Landscape (297mm x 210mm)
      pdf = new jsPDF({
        orientation: 'landscape',
        unit: 'mm',
        format: 'a4',
        compress: true,
      });
      pdf.addImage(imgData, 'PNG', 3, 3, 291, 204, undefined, 'FAST');
    } else {
      // Split 2-in-1 Duplicate CN -> A4 Portrait (210mm x 297mm)
      pdf = new jsPDF({
        orientation: 'portrait',
        unit: 'mm',
        format: 'a4',
        compress: true,
      });
      // Top Copy
      pdf.addImage(imgData, 'PNG', 3, 3, 204, 142, undefined, 'FAST');

      // Dashed Cut Line Divider
      pdf.setLineDashPattern([3, 2], 0);
      pdf.setDrawColor(120, 120, 120);
      pdf.setLineWidth(0.4);
      pdf.line(3, 148.5, 207, 148.5);

      pdf.setFontSize(8);
      pdf.setTextColor(120, 120, 120);
      pdf.text('- - - - - - - - - - - - CUT HERE FOR DUPLICATE COPY - - - - - - - - - - - -', 105, 147.5, { align: 'center' });

      // Bottom Copy
      pdf.addImage(imgData, 'PNG', 3, 153, 204, 142, undefined, 'FAST');
    }

    const pdfBlob = pdf.output('blob');
    const fileName = `Consignment_Note_${cnNo}_${isSplit ? '2Up' : 'Single'}.pdf`;
    const pdfFile = new File([pdfBlob], fileName, { type: 'application/pdf' });

    return { pdfBlob, pdfFile, fileName };
  };

  // 1. Native Mobile PDF Share (Shares high-res .pdf file via Web Share API with logo intact)
  const handleSharePdf = async (isSplit = false) => {
    const cnNo = shipment.cnNumber || shipment.cn_number || shipment.cnNo || 'SS2004';
    setIsGeneratingPdf(true);

    try {
      const { pdfFile, pdfBlob, fileName } = await generateCnPdfFile(isSplit);

      // Try native Web Share API with file attachment (iOS Safari / Android / Mobile Chrome)
      if (navigator.canShare && navigator.canShare({ files: [pdfFile] })) {
        await navigator.share({
          title: `Consignment Note ${cnNo}`,
          text: `Speed Setu Consignment Note - ${cnNo}`,
          files: [pdfFile],
        });
        setIsGeneratingPdf(false);
        return;
      }

      // Fallback for browsers that don't support file sharing: Download PDF file directly
      const url = URL.createObjectURL(pdfBlob);
      const a = document.createElement('a');
      a.href = url;
      a.download = fileName;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(url);

      setCopiedToast(isSplit ? 'split-download' : 'single-download');
      setTimeout(() => setCopiedToast(null), 3000);
    } catch (err) {
      console.error('Share PDF error:', err);
      // Secondary fallback: Copy text summary
      try {
        const shareText = getShareText(isSplit);
        await navigator.clipboard.writeText(shareText);
        setCopiedToast(isSplit ? 'split-text' : 'single-text');
        setTimeout(() => setCopiedToast(null), 2500);
      } catch (e) {}
    } finally {
      setIsGeneratingPdf(false);
    }
  };

  // 2. Direct PDF File Download
  const handleDownloadPdf = async (isSplit = false) => {
    setIsGeneratingPdf(true);
    try {
      const { pdfBlob, fileName } = await generateCnPdfFile(isSplit);
      const url = URL.createObjectURL(pdfBlob);
      const a = document.createElement('a');
      a.href = url;
      a.download = fileName;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(url);

      setCopiedToast(isSplit ? 'split-download' : 'single-download');
      setTimeout(() => setCopiedToast(null), 3000);
    } catch (err) {
      console.error('Download PDF error:', err);
    } finally {
      setIsGeneratingPdf(false);
    }
  };

  // Shared CSS styles for iframe print generation
  const printStyles = `
    .static-border { stroke: #000000; stroke-width: 1.8; fill: none; }
    .thin-line { stroke: #000000; stroke-width: 1.0; fill: none; }
    .font-condensed-bold { font-family: Arial, "Helvetica Neue", Helvetica, sans-serif; font-weight: 700; }
    .font-serif-title { font-family: Arial, "Helvetica Neue", Helvetica, sans-serif; font-weight: 700; }
    .font-sans-bold { font-family: Arial, "Helvetica Neue", Helvetica, sans-serif; font-weight: 600; }
    .font-sans-regular { font-family: Arial, "Helvetica Neue", Helvetica, sans-serif; font-weight: 400; }
    .font-mono-bold { font-family: "Courier New", Courier, monospace; font-weight: 600; }
    .static-text { fill: #000000; }
    .dynamic-text { fill: #000000; font-family: Arial, "Helvetica Neue", Helvetica, sans-serif; font-weight: 600; letter-spacing: 0.2px; }
    .dynamic-digit-text { fill: #000000; font-family: Arial, "Helvetica Neue", Helvetica, sans-serif; font-weight: 600; text-anchor: middle; }
  `;

  // Dynamic Printable Iframe Creation (iOS / Mobile WebKit Compatible)
  const createAndPrintIframe = (svgHtml, isSplit = false) => {
    const oldIframe = document.getElementById('speed-setu-print-iframe');
    if (oldIframe) {
      try { document.body.removeChild(oldIframe); } catch (e) {}
    }

    const iframe = document.createElement('iframe');
    iframe.id = 'speed-setu-print-iframe';
    iframe.style.position = 'absolute';
    iframe.style.top = '0';
    iframe.style.left = '-9999px';
    iframe.style.width = '1024px';
    iframe.style.height = '1440px';
    iframe.style.border = '0';
    iframe.style.opacity = '0';
    iframe.style.pointerEvents = 'none';
    document.body.appendChild(iframe);

    const doc = iframe.contentWindow.document;
    doc.open();
    const titleText = `Consignment Note ${isSplit ? '2-Up' : 'Single'} - ${shipment.cnNumber || shipment.cn_number || 'SS2004'}`;

    const bodyHtml = isSplit ? `
      <div class="page-container">
        <div class="copy-wrapper">${svgHtml}</div>
        <div class="cut-line-divider"><div class="cut-line-dashed"></div></div>
        <div class="copy-wrapper">${svgHtml}</div>
      </div>
    ` : `
      <div class="single-container">
        ${svgHtml}
      </div>
    `;

    doc.write(`
      <!DOCTYPE html>
      <html>
        <head>
          <title>${titleText}</title>
          <style>
            @page { size: ${isSplit ? 'A4 portrait' : 'A4 landscape'}; margin: 4mm !important; }
            html, body {
              margin: 0 !important;
              padding: 0 !important;
              background: #ffffff !important;
              width: 100% !important;
              height: 100% !important;
              box-sizing: border-box !important;
              font-family: Arial, Helvetica, sans-serif;
            }
            .single-container {
              width: 100%;
              height: 98vh;
              display: flex;
              align-items: center;
              justify-content: center;
            }
            .single-container svg {
              width: 100% !important;
              height: auto !important;
              max-height: 95vh !important;
              display: block !important;
              margin: 0 auto !important;
            }
            .page-container {
              width: 100%;
              height: 99vh;
              display: flex;
              flex-direction: column;
              justify-content: space-between;
              align-items: center;
              box-sizing: border-box;
              padding: 1mm 0;
            }
            .copy-wrapper {
              width: 100%;
              height: 48vh;
              display: flex;
              flex-direction: column;
              align-items: center;
              justify-content: center;
              position: relative;
              box-sizing: border-box;
              overflow: hidden;
            }
            .copy-wrapper svg {
              width: 100% !important;
              height: auto !important;
              max-height: 47vh !important;
              display: block !important;
              margin: 0 auto !important;
            }
            .cut-line-divider {
              width: 100%;
              height: 2vh;
              display: flex;
              align-items: center;
              justify-content: center;
              position: relative;
              margin: 1mm 0;
            }
            .cut-line-dashed {
              position: absolute;
              top: 50%;
              left: 0;
              right: 0;
              border-top: 2px dashed #000000;
              z-index: 1;
            }
            ${printStyles}
          </style>
        </head>
        <body>
          ${bodyHtml}
        </body>
      </html>
    `);
    doc.close();

    iframe.contentWindow.focus();
    setTimeout(() => {
      try {
        iframe.contentWindow.print();
      } catch (e) {
        console.error('Print call error:', e);
      }
      setTimeout(() => {
        try { if (document.body.contains(iframe)) document.body.removeChild(iframe); } catch (e) {}
      }, 1500);
    }, 400);
  };

  // 3. Single Page CN Print
  const handlePrintSingle = async () => {
    const isIOS = /iPhone|iPad|iPod/i.test(navigator.userAgent);
    if (isIOS) {
      window.print();
      return;
    }

    const printContent = printRef.current;
    if (!printContent) {
      window.print();
      return;
    }

    const svgElement = printContent.querySelector('svg');
    const svgHtml = svgElement ? svgElement.outerHTML : printContent.innerHTML;
    createAndPrintIframe(svgHtml, false);
  };

  // 4. Split 2-in-1 Duplicate CN Print
  const handlePrintSplit = async () => {
    const isIOS = /iPhone|iPad|iPod/i.test(navigator.userAgent);
    if (isIOS) {
      window.print();
      return;
    }

    const printContent = printRef.current;
    if (!printContent) {
      window.print();
      return;
    }

    const svgElement = printContent.querySelector('svg');
    const svgHtml = svgElement ? svgElement.outerHTML : printContent.innerHTML;
    createAndPrintIframe(svgHtml, true);
  };

  // Formatting helpers for exact digit arrays
  const formatDateBoxes = (dateStr) => {
    if (!dateStr) return Array(8).fill('');
    const d = new Date(dateStr);
    if (isNaN(d.getTime())) return Array(8).fill('');
    const day = String(d.getDate()).padStart(2, '0');
    const month = String(d.getMonth() + 1).padStart(2, '0');
    const year = String(d.getFullYear());
    return `${day}${month}${year}`.split('').slice(0, 8);
  };

  const formatPinBoxes = (pinStr) => {
    const pin = (pinStr || '').replace(/\D/g, '');
    const arr = pin.split('');
    while (arr.length < 6) arr.push('');
    return arr.slice(0, 6);
  };

  const formatEmpCodeBoxes = (empStr) => {
    const code = (empStr || '').replace(/[^a-zA-Z0-9]/g, '');
    const arr = code.split('');
    while (arr.length < 6) arr.push('');
    return arr.slice(0, 6);
  };

  // Helper to parse dynamic user-filled CN / LR / Waybill number
  const parseCnNumber = (shipmentObj) => {
    const raw = String(
      shipmentObj.cnNumber ||
      shipmentObj.cn_number ||
      shipmentObj.cnNo ||
      shipmentObj.cn_no ||
      shipmentObj.lrNumber ||
      shipmentObj.lrNo ||
      shipmentObj.waybillNumber ||
      shipmentObj.consignmentNumber ||
      shipmentObj.shipmentNumber ||
      shipmentObj.id ||
      '285'
    ).trim();

    const match = raw.match(/^(SS|CN|LR)[-\s_]?(.*)$/i);
    if (match) {
      const prefix = match[1].toUpperCase();
      const number = match[2].trim() || '285';
      return { prefix, number };
    }

    return {
      prefix: 'SS',
      number: raw.replace(/^SS[-\s_]?/i, '').trim() || '285'
    };
  };

  const cnDetails = parseCnNumber(shipment);

  // Calculations for Freight charges display
  const actualW = parseFloat(shipment.actualWeight || 0);
  const chargeW = parseFloat(shipment.chargeableWeight || actualW || 0);
  const packingC = parseFloat(shipment.packingCharges || 0);
  const laborC = parseFloat(shipment.laborCharges || 0);
  const pickupC = parseFloat(shipment.pickupCharges || 0);
  const deliveryC = parseFloat(shipment.deliveryCharges || 0);
  const godownC = parseFloat(shipment.godownCharges || 0);

  let basicFreight = parseFloat(shipment.freightCharges || shipment.basicFreight || 0);
  if (!basicFreight && shipment.ratePerKg && chargeW > 0) {
    basicFreight = Math.round(shipment.ratePerKg * chargeW);
  }

  const subtotalBeforeGst = basicFreight + packingC + laborC + pickupC + deliveryC + godownC;
  const isGstExempt = shipment.isGstExempt || shipment.gstRate === 0;
  const gstRate = isGstExempt ? 0 : (shipment.gstRate || 18);
  const gstAmount = isGstExempt ? 0 : Math.round((subtotalBeforeGst * gstRate) / 100);
  const grandTotal = subtotalBeforeGst > 0 ? subtotalBeforeGst + gstAmount : 0;

  const dateBoxes = formatDateBoxes(shipment.cnDate || shipment.bookingDate || shipment.createdAt);
  const consignorPinBoxes = formatPinBoxes(shipment.consignor?.pin);
  const consigneePinBoxes = formatPinBoxes(shipment.consignee?.pin);
  const empCodeBoxes = formatEmpCodeBoxes(shipment.employeeCode);

  const mode = (shipment.mode || '').toUpperCase();
  const isAirExpress = mode.includes('AIR EXPRESS');
  const isAir = mode.includes('AIR') && !isAirExpress;
  const isTrain = mode.includes('TRAIN');
  const isRoad = mode.includes('ROAD') || mode.includes('EXPRESS LTL');
  const isFtl = mode.includes('FTL');

  return (
    <div className="fixed inset-0 z-50 overflow-y-auto bg-slate-950/85 backdrop-blur-md flex items-center justify-center p-2 sm:p-4 print:p-0 print:bg-white print:static">
      
      {/* Screen Wrapper Shell */}
      <div className="bg-white rounded-2xl border border-slate-700 w-full max-w-[1050px] overflow-hidden print:border-none print:w-full print:max-w-none shadow-2xl relative">
        
        {/* Screen Control Toolbar (Hidden on Print) */}
        <div className="no-print bg-slate-900 text-white border-b border-slate-800 shadow-md p-3 sm:p-4">
          
          {/* Top Header Row */}
          <div className="flex items-center justify-between pb-2.5 border-b border-slate-800">
            <div className="flex items-center space-x-2.5 min-w-0">
              <div className="w-8 h-8 rounded-lg bg-setu-600/20 border border-setu-500/30 flex items-center justify-center text-setu-400 flex-shrink-0">
                <FileText className="w-4 h-4" />
              </div>
              <div className="min-w-0">
                <div className="flex items-center space-x-2">
                  <h2 className="text-sm font-bold text-white truncate">Consignment Note (CN)</h2>
                  <span className="px-2 py-0.5 text-[11px] font-extrabold rounded bg-amber-400 text-slate-900 shadow-xs flex-shrink-0">
                    {shipment.cnNumber || 'SS2004'}
                  </span>
                </div>
                <p className="text-[11px] text-slate-400 truncate">Speed Setu Official Lorry Receipt</p>
              </div>
            </div>

            <button
              onClick={onClose}
              className="p-1.5 text-slate-400 hover:text-white hover:bg-slate-800 rounded-lg transition-colors cursor-pointer flex-shrink-0"
              title="Close preview"
            >
              <X className="w-5 h-5" />
            </button>
          </div>

          {/* Action Buttons Row: Option 1 (Single) and Option 2 (Split 2-in-1 Duplicate) */}
          <div className="pt-2.5 grid grid-cols-1 lg:grid-cols-2 gap-2">
            {/* Option 1 Card: Single Page CN */}
            <div className="bg-slate-950/80 border border-slate-800 rounded-xl p-2 sm:p-2.5 flex items-center justify-between">
              <div className="min-w-0 mr-2">
                <span className="text-[11px] font-bold text-slate-200 block truncate">1. Single Page CN</span>
                <span className="text-[10px] text-slate-400 block truncate">Normal 1 copy</span>
              </div>
              <div className="flex items-center space-x-1.5 flex-shrink-0">
                <button
                  onClick={handlePrintSingle}
                  disabled={isGeneratingPdf}
                  className="inline-flex items-center space-x-1 px-2.5 py-1.5 rounded-lg bg-setu-600 hover:bg-setu-500 disabled:opacity-50 text-white font-bold text-xs shadow-xs transition-all active:scale-95 cursor-pointer"
                  title="Print Single Page CN"
                >
                  <Printer className="w-3.5 h-3.5" />
                  <span>Print</span>
                </button>
                <button
                  onClick={() => handleDownloadPdf(false)}
                  disabled={isGeneratingPdf}
                  className="inline-flex items-center space-x-1 px-2 py-1.5 rounded-lg bg-slate-800 hover:bg-slate-700 disabled:opacity-50 text-slate-200 border border-slate-700 font-bold text-xs shadow-xs transition-all active:scale-95 cursor-pointer"
                  title="Download Single Page PDF file"
                >
                  {copiedToast === 'single-download' ? <Check className="w-3.5 h-3.5 text-emerald-400" /> : <Download className="w-3.5 h-3.5 text-slate-300" />}
                  <span>PDF</span>
                </button>
                <button
                  onClick={() => handleSharePdf(false)}
                  disabled={isGeneratingPdf}
                  className="inline-flex items-center space-x-1 px-2.5 py-1.5 rounded-lg bg-slate-800 hover:bg-slate-700 disabled:opacity-50 text-slate-200 border border-slate-700 font-bold text-xs shadow-xs transition-all active:scale-95 cursor-pointer"
                  title="Share Single Page PDF file"
                >
                  {isGeneratingPdf ? <Loader2 className="w-3.5 h-3.5 text-setu-400 animate-spin" /> : copiedToast === 'single-text' ? <Check className="w-3.5 h-3.5 text-emerald-400" /> : <Share2 className="w-3.5 h-3.5 text-setu-400" />}
                  <span>Share PDF</span>
                </button>
              </div>
            </div>

            {/* Option 2 Card: Split 2-in-1 Duplicate CN */}
            <div className="bg-slate-950/80 border border-amber-500/30 rounded-xl p-2 sm:p-2.5 flex items-center justify-between">
              <div className="min-w-0 mr-2">
                <span className="text-[11px] font-bold text-amber-400 block truncate">2. Split 2-in-1 Duplicate</span>
                <span className="text-[10px] text-slate-400 block truncate">2 copies per A4 sheet</span>
              </div>
              <div className="flex items-center space-x-1.5 flex-shrink-0">
                <button
                  onClick={handlePrintSplit}
                  disabled={isGeneratingPdf}
                  className="inline-flex items-center space-x-1 px-2.5 py-1.5 rounded-lg bg-amber-500 hover:bg-amber-400 disabled:opacity-50 text-slate-950 font-extrabold text-xs shadow-xs transition-all active:scale-95 cursor-pointer"
                  title="Print 2 Copies on 1 A4 Sheet"
                >
                  <Printer className="w-3.5 h-3.5 text-slate-950" />
                  <span>Print 2-Up</span>
                </button>
                <button
                  onClick={() => handleDownloadPdf(true)}
                  disabled={isGeneratingPdf}
                  className="inline-flex items-center space-x-1 px-2 py-1.5 rounded-lg bg-slate-800 hover:bg-slate-700 disabled:opacity-50 text-slate-200 border border-slate-700 font-bold text-xs shadow-xs transition-all active:scale-95 cursor-pointer"
                  title="Download 2-Up Split PDF file"
                >
                  {copiedToast === 'split-download' ? <Check className="w-3.5 h-3.5 text-emerald-400" /> : <Download className="w-3.5 h-3.5 text-amber-400" />}
                  <span>PDF</span>
                </button>
                <button
                  onClick={() => handleSharePdf(true)}
                  disabled={isGeneratingPdf}
                  className="inline-flex items-center space-x-1 px-2.5 py-1.5 rounded-lg bg-slate-800 hover:bg-slate-700 disabled:opacity-50 text-slate-200 border border-slate-700 font-bold text-xs shadow-xs transition-all active:scale-95 cursor-pointer"
                  title="Share Split 2-in-1 PDF file"
                >
                  {isGeneratingPdf ? <Loader2 className="w-3.5 h-3.5 text-setu-400 animate-spin" /> : copiedToast === 'split-text' ? <Check className="w-3.5 h-3.5 text-emerald-400" /> : <Share2 className="w-3.5 h-3.5 text-setu-400" />}
                  <span>Share PDF</span>
                </button>
              </div>
            </div>
          </div>
        </div>

        {/* MASTER SVG DOCUMENT CONTAINER */}
        <div className="p-2 sm:p-3 bg-white print:p-0 svg-document-wrap" ref={printRef}>
          
          <svg
            xmlns="http://www.w3.org/2000/svg"
            viewBox="0 0 1400 980"
            width="100%"
            height="100%"
            preserveAspectRatio="xMidYMid meet"
            className="w-full h-auto select-none bg-white"
          >
            <style>{`
              .static-border { stroke: #000000; stroke-width: 1.8; fill: none; }
              .thin-line { stroke: #000000; stroke-width: 1.0; fill: none; }
              .font-condensed-bold { font-family: Arial, "Helvetica Neue", Helvetica, sans-serif; font-weight: 700; }
              .font-serif-title { font-family: Arial, "Helvetica Neue", Helvetica, sans-serif; font-weight: 700; }
              .font-sans-bold { font-family: Arial, "Helvetica Neue", Helvetica, sans-serif; font-weight: 600; }
              .font-sans-regular { font-family: Arial, "Helvetica Neue", Helvetica, sans-serif; font-weight: 400; }
              .font-mono-bold { font-family: "Courier New", Courier, monospace; font-weight: 600; }
              .static-text { fill: #000000; }
              .dynamic-text { fill: #000000; font-family: Arial, "Helvetica Neue", Helvetica, sans-serif; font-weight: 600; letter-spacing: 0.2px; }
              .dynamic-digit-text { fill: #000000; font-family: Arial, "Helvetica Neue", Helvetica, sans-serif; font-weight: 600; text-anchor: middle; }
            `}</style>

            {/* BACKGROUND */}
            <rect x="0" y="0" width="1400" height="980" fill="#ffffff" />

            {/* =================================================================== */}
            {/* LAYER 1: STATIC_TEMPLATE (EXACT BLUEPRINT RECREATION FROM IMAGE)      */}
            {/* =================================================================== */}
            <g id="STATIC_TEMPLATE">
              
              {/* Outer Frame Box */}
              <rect x="15" y="15" width="1370" height="950" className="static-border" />

              {/* HEADER ROW (Height: 125px) */}
              <line x1="15" y1="140" x2="1385" y2="140" className="static-border" />

              {/* Header Left: Official Speed Setu Brand Image Logo */}
              <g transform="translate(35, 25)">
                <image href={logoBase64 || logoImg} x="0" y="0" width="300" height="100" preserveAspectRatio="xMidYMid meet" />
              </g>

              {/* Header Center: Registered Company Title & Address */}
              <g transform="translate(700, 48)">
                <text x="0" y="0" textAnchor="middle" className="font-serif-title static-text" fontSize="34" letterSpacing="0.5">SPEED SETU LOGISTICS PVT. LTD.</text>
                <text x="0" y="24" textAnchor="middle" className="font-sans-bold static-text" fontSize="15">Haripur, Bhiwani Haryana-127 021</text>
                <text x="0" y="44" textAnchor="middle" className="font-sans-bold static-text" fontSize="14">Customer Care No. : 8884199555, 9996321200</text>
                <text x="0" y="64" textAnchor="middle" className="font-sans-bold static-text" fontSize="13.5">Email : speedsetu@gmail.com | Website : www.speedsetu.com</text>
              </g>

              {/* Header Right: Document Title & Carrier Risk Notice */}
              <g transform="translate(1212, 30)">
                <text x="0" y="24" textAnchor="middle" className="font-condensed-bold static-text" fontSize="28" letterSpacing="1">CONSIGNMENT NOTE</text>
                <line x1="-155" y1="32" x2="155" y2="32" stroke="#000000" strokeWidth="1.8" />
                
                <text x="0" y="58" textAnchor="middle" className="font-sans-bold static-text" fontSize="14" letterSpacing="0.8">GST - 06ABSCS1710K1Z4</text>

                <text x="0" y="82" textAnchor="middle" className="font-sans-bold static-text" fontSize="12.5" letterSpacing="0.2">AT CARRIER'S RISK / OWNER'S RISK</text>
                <line x1="-165" y1="88" x2="165" y2="88" stroke="#000000" strokeWidth="1.0" />
              </g>

              {/* =================================================================== */}
              {/* CONSIGNOR & CONSIGNEE & CN METADATA SECTION                         */}
              {/* =================================================================== */}
              <line x1="15" y1="350" x2="1385" y2="350" className="static-border" />
              <line x1="940" y1="140" x2="940" y2="965" className="static-border" />
              <line x1="15" y1="245" x2="940" y2="245" className="thin-line" />

              {/* Consignor's Block */}
              <g transform="translate(25, 170)">
                <text x="0" y="0" className="font-sans-bold static-text" fontSize="15">Consignor's</text>
                <line x1="95" y1="2" x2="905" y2="2" className="thin-line" />
                
                <text x="0" y="45" className="font-sans-bold static-text" fontSize="14">CONSIGNER CODE</text>
                <line x1="150" y1="47" x2="330" y2="47" className="thin-line" />

                <text x="360" y="45" className="font-sans-bold static-text" fontSize="14">GST No.</text>
                <line x1="435" y1="47" x2="720" y2="47" className="thin-line" />

                <text x="735" y="45" className="font-sans-bold static-text" fontSize="14">Pin :</text>
                {/* Consignor PIN 6 Digit Boxes */}
                <g transform="translate(780, 26)">
                  <rect x="0" y="0" width="22" height="24" className="thin-line" />
                  <rect x="22" y="0" width="22" height="24" className="thin-line" />
                  <rect x="44" y="0" width="22" height="24" className="thin-line" />
                  <rect x="66" y="0" width="22" height="24" className="thin-line" />
                  <rect x="88" y="0" width="22" height="24" className="thin-line" />
                  <rect x="110" y="0" width="22" height="24" className="thin-line" />
                </g>
              </g>

              {/* Consignee Block */}
              <g transform="translate(25, 275)">
                <text x="0" y="0" className="font-sans-bold static-text" fontSize="15">Consignee</text>
                <line x1="95" y1="2" x2="905" y2="2" className="thin-line" />
                
                <text x="0" y="45" className="font-sans-bold static-text" fontSize="14">CONSIGNEE CODE</text>
                <line x1="150" y1="47" x2="330" y2="47" className="thin-line" />

                <text x="360" y="45" className="font-sans-bold static-text" fontSize="14">GST No.</text>
                <line x1="435" y1="47" x2="720" y2="47" className="thin-line" />

                <text x="735" y="45" className="font-sans-bold static-text" fontSize="14">Pin :</text>
                {/* Consignee PIN 6 Digit Boxes */}
                <g transform="translate(780, 26)">
                  <rect x="0" y="0" width="22" height="24" className="thin-line" />
                  <rect x="22" y="0" width="22" height="24" className="thin-line" />
                  <rect x="44" y="0" width="22" height="24" className="thin-line" />
                  <rect x="66" y="0" width="22" height="24" className="thin-line" />
                  <rect x="88" y="0" width="22" height="24" className="thin-line" />
                  <rect x="110" y="0" width="22" height="24" className="thin-line" />
                </g>
              </g>

              {/* Right CN NO & Date & Transport Mode Section */}
              <g transform="translate(955, 170)">
                <text x="0" y="0" className="font-sans-bold static-text" fontSize="18">CN NO.</text>
                
                <text x="0" y="42" className="font-sans-bold static-text" fontSize="15">Date</text>
                {/* 8 Individual Date Digit Boxes */}
                <g transform="translate(145, 24)">
                  <rect x="0" y="0" width="28" height="26" className="thin-line" />
                  <rect x="28" y="0" width="28" height="26" className="thin-line" />
                  <rect x="56" y="0" width="28" height="26" className="thin-line" />
                  <rect x="84" y="0" width="28" height="26" className="thin-line" />
                  <rect x="112" y="0" width="28" height="26" className="thin-line" />
                  <rect x="140" y="0" width="28" height="26" className="thin-line" />
                  <rect x="168" y="0" width="28" height="26" className="thin-line" />
                  <rect x="196" y="0" width="28" height="26" className="thin-line" />
                </g>

                {/* Transport Mode Checkboxes Row */}
                <g transform="translate(0, 62)">
                  <line x1="-15" y1="0" x2="430" y2="0" className="thin-line" />
                  <line x1="-15" y1="30" x2="430" y2="30" className="thin-line" />

                  <rect x="0" y="8" width="14" height="14" className="thin-line" />
                  <text x="20" y="20" className="font-sans-bold static-text" fontSize="11.5">AIR EXPRESS</text>

                  <rect x="110" y="8" width="14" height="14" className="thin-line" />
                  <text x="130" y="20" className="font-sans-bold static-text" fontSize="11.5">AIR</text>

                  <rect x="175" y="8" width="14" height="14" className="thin-line" />
                  <text x="195" y="20" className="font-sans-bold static-text" fontSize="11.5">TRAIN</text>

                  <rect x="255" y="8" width="14" height="14" className="thin-line" />
                  <text x="275" y="20" className="font-sans-bold static-text" fontSize="11.5">ROAD</text>

                  <rect x="335" y="8" width="14" height="14" className="thin-line" />
                  <text x="355" y="20" className="font-sans-bold static-text" fontSize="11.5">FTL</text>
                </g>

                {/* From / To Routing Lines */}
                <g transform="translate(0, 110)">
                  <text x="0" y="0" className="font-sans-bold static-text" fontSize="14">From</text>
                  <line x1="45" y1="2" x2="280" y2="2" className="thin-line" />
                  <text x="295" y="0" className="font-sans-bold static-text" fontSize="14">Code</text>
                  <line x1="345" y1="2" x2="415" y2="2" className="thin-line" />

                  <text x="0" y="28" className="font-sans-bold static-text" fontSize="14">To</text>
                  <line x1="28" y1="30" x2="280" y2="30" className="thin-line" />
                  <text x="295" y="28" className="font-sans-bold static-text" fontSize="14">Code</text>
                  <line x1="345" y1="30" x2="415" y2="30" className="thin-line" />

                  <text x="0" y="56" className="font-sans-bold static-text" fontSize="14">To (For EXIM)</text>
                  <line x1="105" y1="58" x2="280" y2="58" className="thin-line" />
                  <text x="295" y="56" className="font-sans-bold static-text" fontSize="14">Code</text>
                  <line x1="345" y1="58" x2="415" y2="58" className="thin-line" />
                </g>
              </g>

              {/* =================================================================== */}
              {/* FAR RIGHT COLUMN: ACKNOWLEDGEMENT ABOVE MODE OF FREIGHT / CENVAT     */}
              {/* =================================================================== */}
              <g transform="translate(940, 350)">
                
                {/* 1. ACKNOWLEDGEMENT BOX DIRECTLY BELOW ROUTING (Height: 280px) */}
                <rect x="0" y="0" width="445" height="280" className="thin-line" />
                <text x="12" y="28" className="font-sans-bold static-text" fontSize="15">ACKNOWLEDGEMENT :</text>
                
                <text x="12" y="252" className="font-sans-bold static-text" fontSize="14">DATE</text>
                <line x1="60" y1="254" x2="210" y2="254" className="thin-line" />

                <text x="260" y="252" className="font-sans-bold static-text" fontSize="14">SIGNATURE</text>
                <line x1="350" y1="254" x2="435" y2="254" className="thin-line" />

                {/* 2. CENVAT STATUTORY DISCLAIMER TEXT DIRECTLY BELOW ACKNOWLEDGEMENT */}
                <g transform="translate(0, 280)">
                  <rect x="0" y="0" width="445" height="142" className="thin-line" />
                  <text x="10" y="22" className="font-sans-regular static-text" fontSize="10.5" fontStyle="italic">
                    "We hereby certify that we have not availed the credit of duty paid on inputs or capital
                  </text>
                  <text x="10" y="38" className="font-sans-regular static-text" fontSize="10.5" fontStyle="italic">
                    goods made for providing taxable service under the provision of the Cenvat Credit Rules"
                  </text>
                  <text x="10" y="54" className="font-sans-regular static-text" fontSize="10.5" fontStyle="italic">
                    2004 nor have we availed the benefit under the notification of the Government of India in
                  </text>
                  <text x="10" y="70" className="font-sans-regular static-text" fontSize="10.5" fontStyle="italic">
                    the Ministry of Finance (Department of revenue) No. 12 2003-Service Tax dated the 20th
                  </text>
                  <text x="10" y="86" className="font-sans-regular static-text" fontSize="10.5" fontStyle="italic">
                    June 2003 (G.S.R. 500 (E) dated the 20th June 2003)"
                  </text>
                </g>

              </g>

              {/* =================================================================== */}
              {/* MAIN BODY: 3 MAJOR VERTICAL TABLES (PACKAGE | FREIGHT | MODE)       */}
              {/* =================================================================== */}
              <line x1="470" y1="350" x2="470" y2="700" className="static-border" />
              <line x1="15" y1="700" x2="940" y2="700" className="static-border" />

              {/* COLUMN 1: PACKAGES & INVOICES */}
              <g transform="translate(15, 350)">
                <text x="10" y="22" className="font-sans-bold static-text" fontSize="13">D O No. / DCPI No.</text>
                <line x1="0" y1="32" x2="455" y2="32" className="thin-line" />

                <line x1="0" y1="64" x2="455" y2="64" className="thin-line" />
                <line x1="150" y1="32" x2="150" y2="95" className="thin-line" />
                <line x1="300" y1="32" x2="300" y2="95" className="thin-line" />

                <text x="75" y="48" textAnchor="middle" className="font-sans-bold static-text" fontSize="12">No. of Package</text>
                <text x="225" y="48" textAnchor="middle" className="font-sans-bold static-text" fontSize="12">Actual Weight (Kgs)</text>
                <text x="377" y="48" textAnchor="middle" className="font-sans-bold static-text" fontSize="12">Chargeable Weight (Kgs)</text>
                
                <line x1="0" y1="95" x2="455" y2="95" className="thin-line" />

                <text x="10" y="115" className="font-sans-bold static-text" fontSize="13">Description of Goods (Said to Contain):</text>
                <line x1="0" y1="180" x2="455" y2="180" className="thin-line" />

                <g transform="translate(10, 185)">
                  <text x="0" y="20" className="font-sans-bold static-text" fontSize="13">Invoice No.</text>
                  <line x1="-10" y1="28" x2="445" y2="28" className="thin-line" />

                  <text x="0" y="48" className="font-sans-bold static-text" fontSize="13">Dated :</text>
                  <line x1="-10" y1="56" x2="445" y2="56" className="thin-line" />

                  <text x="0" y="76" className="font-sans-bold static-text" fontSize="13">Invoice Value Rs.</text>
                  <line x1="-10" y1="84" x2="445" y2="84" className="thin-line" />

                  <text x="0" y="104" className="font-sans-bold static-text" fontSize="13">Invoice Qty.</text>
                  <line x1="-10" y1="112" x2="445" y2="112" className="thin-line" />

                  <text x="0" y="132" className="font-sans-bold static-text" fontSize="13">E Way Bill</text>
                  <line x1="-10" y1="140" x2="445" y2="140" className="thin-line" />

                  <text x="0" y="160" className="font-sans-bold static-text" fontSize="13">E. Way Bill / AWB</text>
                </g>
              </g>

              {/* Consignor Signature Box */}
              <line x1="15" y1="700" x2="310" y2="700" className="thin-line" />
              <text x="160" y="745" textAnchor="middle" className="font-sans-bold static-text" fontSize="12">Space for Consignor's Signature &amp; Seal</text>

              {/* COLUMN 2: FREIGHT TABLE (Center ~34%) */}
              <g transform="translate(470, 350)">
                <line x1="0" y1="28" x2="470" y2="28" className="thin-line" />
                <line x1="0" y1="56" x2="470" y2="56" className="thin-line" />
                <line x1="310" y1="0" x2="310" y2="350" className="thin-line" />
                <line x1="410" y1="28" x2="410" y2="350" className="thin-line" />

                <text x="155" y="20" textAnchor="middle" className="font-sans-bold static-text" fontSize="13">Rate per MT / Per FTL (Rs.)</text>
                <text x="390" y="20" textAnchor="middle" className="font-sans-bold static-text" fontSize="13">Freight</text>
                <text x="10" y="46" className="font-sans-bold static-text" fontSize="12">Charges</text>
                <text x="360" y="46" textAnchor="middle" className="font-sans-bold static-text" fontSize="12">Rs.</text>
                <text x="440" y="46" textAnchor="middle" className="font-sans-bold static-text" fontSize="12">Ps.</text>

                <g className="font-sans-bold static-text" fontSize="12.5">
                  <line x1="0" y1="82" x2="470" y2="82" className="thin-line" />
                  <text x="10" y="74">Basic Freight</text>

                  <line x1="0" y1="108" x2="470" y2="108" className="thin-line" />
                  <text x="10" y="100">Loading Chg.</text>

                  <line x1="0" y1="134" x2="470" y2="134" className="thin-line" />
                  <text x="10" y="126">Unloading Chg.</text>

                  <line x1="0" y1="160" x2="470" y2="160" className="thin-line" />
                  <text x="10" y="152">SL Chrs. / G.C. Chgs</text>

                  <line x1="0" y1="186" x2="470" y2="186" className="thin-line" />
                  <text x="10" y="178">Surcharge on Height/Length</text>

                  <line x1="0" y1="212" x2="470" y2="212" className="thin-line" />
                  <text x="10" y="204">Surcharge on Value</text>

                  <line x1="0" y1="238" x2="470" y2="238" className="thin-line" />
                  <text x="10" y="230">Others Charges (Specify)</text>

                  <line x1="0" y1="264" x2="470" y2="264" className="thin-line" />
                  <text x="10" y="256">Green Tax</text>

                  <line x1="0" y1="290" x2="470" y2="290" className="thin-line" />
                  <text x="10" y="282">G.S.T.</text>

                  <line x1="0" y1="316" x2="470" y2="316" className="thin-line" />
                  <text x="10" y="338" fontSize="14">Grand Total</text>
                </g>
              </g>

              {/* Remarks Box */}
              <g transform="translate(310, 700)">
                <line x1="0" y1="0" x2="0" y2="72" className="static-border" />
                <line x1="630" y1="0" x2="630" y2="72" className="static-border" />
                <text x="10" y="24" className="font-sans-bold static-text" fontSize="14">REMARKS :</text>
              </g>

              {/* =================================================================== */}
              {/* BOTTOM LEGAL SECTION & COMPANY SIGNATURE SECTION                    */}
              {/* =================================================================== */}
              <line x1="15" y1="772" x2="1385" y2="772" className="static-border" />

              <g transform="translate(25, 792)">
                <text x="0" y="0" className="font-sans-bold static-text" fontSize="13">SCHEDULE OF DEMURRAGE CHARGES</text>
                <text x="0" y="18" className="font-sans-regular static-text" fontSize="12">Demurrage Chargeable after ONE day from the date of arrival at the destination at the rate of Rs. 75 per ton per day or charged weight.</text>
              </g>
              <line x1="15" y1="825" x2="940" y2="825" className="thin-line" />

              <g transform="translate(25, 840)">
                <text x="0" y="0" className="font-sans-bold static-text" fontSize="10.5">
                  <tspan x="0" dy="0">NOTICE: The Consignment covered by this lorry Receipt shall the stored at the destination under the control of transport operator and shall be delivered to</tspan>
                  <tspan x="0" dy="15">or to the order of the consignee Bank whose name is mentioned in the Lorry Receipt. It will under no circumstance be delivered to anyone without the within</tspan>
                  <tspan x="0" dy="15">authority from the consignee Bank or its order endorsed on the Consignee Copy or on a separate letter of Authority.</tspan>
                </text>

                <text x="0" y="65" className="font-sans-bold static-text" fontSize="12.5">All terms &amp; Conditions Overleaf</text>
                <text x="0" y="85" className="font-sans-bold static-text" fontSize="12.5">1. Consignor Copy &nbsp;&nbsp;&nbsp;&nbsp; 2. Proof of Delivery &nbsp;&nbsp;&nbsp;&nbsp; 3. Consignee Copy</text>
              </g>

              {/* BOTTOM RIGHT: CUBIC FEET & FOR SPEED SETU LOGISTICS PVT. LTD. CELL */}
              <g transform="translate(940, 772)">
                <rect x="0" y="0" width="445" height="52" className="thin-line" />
                <text x="10" y="20" className="font-sans-bold static-text" fontSize="11">CUBIC METER-600 Kgs. OR CUBIC FEET - 18 Kgs. Please accept only our</text>
                <text x="10" y="36" className="font-sans-bold static-text" fontSize="11">printed money receipt at the time of freight pay ment.</text>

                <g transform="translate(10, 75)">
                  <text x="0" y="0" className="font-serif-title static-text" fontSize="15">For SPEED SETU LOGISTICS PVT. LTD.</text>
                  
                  {/* Left Signature Line */}
                  <text x="0" y="50" className="font-sans-bold static-text" fontSize="12.5">Sign.</text>
                  <line x1="40" y1="52" x2="235" y2="52" className="thin-line" />

                  {/* Right Employee Code Block with 6 digit boxes */}
                  <text x="250" y="30" className="font-sans-bold static-text" fontSize="11.5">Employee Code</text>
                  <g transform="translate(250, 34)">
                    <rect x="0" y="0" width="22" height="24" className="thin-line" />
                    <rect x="22" y="0" width="22" height="24" className="thin-line" />
                    <rect x="44" y="0" width="22" height="24" className="thin-line" />
                    <rect x="66" y="0" width="22" height="24" className="thin-line" />
                    <rect x="88" y="0" width="22" height="24" className="thin-line" />
                    <rect x="110" y="0" width="22" height="24" className="thin-line" />
                  </g>
                </g>
              </g>

            </g>

            {/* =================================================================== */}
            {/* LAYER 2: DYNAMIC_FIELDS (POPULATED AT EXACT BOUNDING POSITIONS)     */}
            {/* =================================================================== */}
            <g id="DYNAMIC_FIELDS">
              {/* Consignor Data */}
              <text x="140" y="170" className="dynamic-text" fontSize="15">
                {(shipment.consignor?.name || shipment.companyName || '').toUpperCase()}
              </text>
              <text x="190" y="215" className="dynamic-text" fontSize="14">
                {(shipment.consignor?.code || shipment.companyCode || '').toUpperCase()}
              </text>
              <text x="480" y="215" className="dynamic-text" fontSize="14">
                {(shipment.consignor?.gstin || '').toUpperCase()}
              </text>
              <g transform="translate(805, 196)">
                {consignorPinBoxes.map((digit, idx) => (
                  <text key={idx} x={idx * 22 + 11} y="17" className="dynamic-digit-text" fontSize="14">
                    {digit}
                  </text>
                ))}
              </g>

              {/* Consignee Data */}
              <text x="140" y="275" className="dynamic-text" fontSize="15">
                {(shipment.consignee?.name || '').toUpperCase()}
              </text>
              <text x="190" y="320" className="dynamic-text" fontSize="14">
                {(shipment.consignee?.code || '').toUpperCase()}
              </text>
              <text x="480" y="320" className="dynamic-text" fontSize="14">
                {(shipment.consignee?.gstin || '').toUpperCase()}
              </text>
              <g transform="translate(805, 301)">
                {consigneePinBoxes.map((digit, idx) => (
                  <text key={idx} x={idx * 22 + 11} y="17" className="dynamic-digit-text" fontSize="14">
                    {digit}
                  </text>
                ))}
              </g>

              {/* CN Number & Date */}
              <text x="1040" y="170" className="dynamic-text" fontSize="22">{cnDetails.prefix}</text>
              <text x="1100" y="170" className="dynamic-text" fontSize="24">
                {cnDetails.number}
              </text>
              <g transform="translate(1100, 194)">
                {dateBoxes.map((digit, idx) => (
                  <text key={idx} x={idx * 28 + 14} y="18" className="dynamic-digit-text" fontSize="15">
                    {digit}
                  </text>
                ))}
              </g>

              {/* Mode Checkboxes (renders check mark inside existing fixed checkbox) */}
              {isAirExpress && <text x="956" y="246" className="dynamic-text" fontSize="16">✓</text>}
              {isAir && <text x="1066" y="246" className="dynamic-text" fontSize="16">✓</text>}
              {isTrain && <text x="1131" y="246" className="dynamic-text" fontSize="16">✓</text>}
              {isRoad && <text x="1211" y="246" className="dynamic-text" fontSize="16">✓</text>}
              {isFtl && <text x="1291" y="246" className="dynamic-text" fontSize="16">✓</text>}

              {/* Routing */}
              <text x="1010" y="280" className="dynamic-text" fontSize="15">{shipment.origin || ''}</text>
              <text x="1310" y="280" className="dynamic-text" fontSize="14">{shipment.originCode || ''}</text>

              <text x="1010" y="308" className="dynamic-text" fontSize="15">{shipment.destination || ''}</text>
              <text x="1310" y="308" className="dynamic-text" fontSize="14">{shipment.destCode || ''}</text>

              {/* Packages & Weights */}
              <text x="170" y="370" className="dynamic-text" fontSize="14">{shipment.doNumber || shipment.dcpiNumber || ''}</text>
              <text x="90" y="432" className="dynamic-text" fontSize="16" textAnchor="middle">{shipment.packages || ''}</text>
              <text x="240" y="432" className="dynamic-text" fontSize="16" textAnchor="middle">{actualW || ''}</text>
              <text x="390" y="432" className="dynamic-text" fontSize="16" textAnchor="middle">{chargeW || ''}</text>

              {/* Goods Description */}
              <text x="30" y="480" className="dynamic-text" fontSize="14">{shipment.materialDescription || ''}</text>

              {/* Invoices */}
              <text x="150" y="555" className="dynamic-text" fontSize="14">{shipment.invoiceDetails?.invoiceNumber || shipment.commercialInvoices?.[0]?.invoiceNumber || ''}</text>
              <text x="150" y="583" className="dynamic-text" fontSize="14">{shipment.invoiceDetails?.invoiceDate || shipment.cnDate || ''}</text>
              <text x="150" y="611" className="dynamic-text" fontSize="14">{shipment.invoiceDetails?.invoiceValue || shipment.commercialInvoices?.[0]?.invoiceValue ? `₹ ${shipment.invoiceDetails?.invoiceValue || shipment.commercialInvoices?.[0]?.invoiceValue}` : ''}</text>
              <text x="150" y="639" className="dynamic-text" fontSize="14">
                {shipment.invoiceDetails?.invoiceQuantity !== undefined && shipment.invoiceDetails?.invoiceQuantity !== null && shipment.invoiceDetails?.invoiceQuantity !== ''
                  ? shipment.invoiceDetails.invoiceQuantity
                  : ((shipment.commercialInvoices || []).map(i => i.invoiceQuantity).filter((q) => q !== undefined && q !== null && q !== '').join(', ') || '')}
              </text>
              <text x="150" y="667" className="dynamic-text" fontSize="14">{shipment.ewayBillNumber || ''}</text>
              <text x="150" y="687" className="dynamic-text" fontSize="14">{shipment.awbNumber || ''}</text>

              {/* Freight Amounts */}
              <text x="870" y="424" className="dynamic-text" fontSize="14" textAnchor="end">{basicFreight ? basicFreight.toFixed(0) : ''}</text>
              <text x="870" y="450" className="dynamic-text" fontSize="14" textAnchor="end">{laborC ? laborC.toFixed(0) : ''}</text>
              <text x="870" y="502" className="dynamic-text" fontSize="14" textAnchor="end">{pickupC ? pickupC.toFixed(0) : ''}</text>
              <text x="870" y="580" className="dynamic-text" fontSize="14" textAnchor="end">{packingC ? packingC.toFixed(0) : ''}</text>
              <text x="870" y="632" className="dynamic-text" fontSize="14" textAnchor="end">{gstAmount ? gstAmount.toFixed(0) : ''}</text>
              <text x="870" y="688" className="dynamic-text" fontSize="16" textAnchor="end">{grandTotal ? `₹ ${grandTotal.toFixed(0)}` : ''}</text>

              {/* Remarks */}
              <text x="400" y="738" className="dynamic-text" fontSize="14">{shipment.remarks || ''}</text>

              {/* Employee Code digit boxes */}
              <g transform="translate(1200, 881)">
                {empCodeBoxes.map((digit, idx) => (
                  <text key={idx} x={idx * 22 + 11} y="17" className="dynamic-digit-text" fontSize="14">
                    {digit}
                  </text>
                ))}
              </g>
            </g>

          </svg>
        </div>

      </div>
    </div>
  );
};
