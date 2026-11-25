import React, { useRef, useState, useEffect, useMemo } from "react";
import {
  X,
  Printer,
  Share2,
  Check,
  FileText,
  Download,
  Loader2,
  Layers,
} from "lucide-react";
import jsPDF from "jspdf";
import html2canvas from "html2canvas";
import logoImg from "../../assets/logo2.png";
import { ConsignmentNoteDocument } from "../cn/ConsignmentNoteDocument";
import {
  DEFAULT_CN_TEMPLATE_CONFIG,
  mergeWithDefaultTemplate,
} from "../../cn/defaultCnTemplate";
import {
  extractCnData,
  getPageDimensionsMm,
  computeCnLayout,
} from "../../cn/cnLayoutEngine";
import { cnTemplateService } from "../../services/cnTemplateService";

export const ConsignmentNoteModal = ({
  isOpen,
  onClose,
  shipment,
  autoPrint = false,
}) => {
  const printRef = useRef(null);
  const [copiedToast, setCopiedToast] = useState(null);
  const [isGeneratingPdf, setIsGeneratingPdf] = useState(false);
  const [logoBase64, setLogoBase64] = useState(logoImg);
  const [resolvedTemplate, setResolvedTemplate] = useState(
    DEFAULT_CN_TEMPLATE_CONFIG
  );
  const [templateBadge, setTemplateBadge] = useState("Default");
  const [templateReady, setTemplateReady] = useState(false);

  // Convert logo to high-resolution inline Base64 data URI on mount
  useEffect(() => {
    if (!logoImg) return;
    const img = new Image();
    img.crossOrigin = "Anonymous";
    img.onload = () => {
      try {
        const canvas = document.createElement("canvas");
        canvas.width = img.width;
        canvas.height = img.height;
        const ctx = canvas.getContext("2d");
        ctx.imageSmoothingEnabled = true;
        ctx.imageSmoothingQuality = "high";
        ctx.drawImage(img, 0, 0);
        setLogoBase64(canvas.toDataURL("image/png", 1.0));
      } catch (e) {
        setLogoBase64(logoImg);
      }
    };
    img.onerror = () => setLogoBase64(logoImg);
    img.src = logoImg;
  }, []);

  // Resolve template: Snapshot on shipment -> Version lookup -> Active (unsaved draft) -> Default (legacy)
  useEffect(() => {
    if (!isOpen || !shipment) return;
    let cancelled = false;

    const loadTemplateForShipment = async () => {
      setTemplateReady(false);
      try {
        if (shipment.cnTemplateSnapshot) {
          if (!cancelled) {
            setResolvedTemplate(
              mergeWithDefaultTemplate(shipment.cnTemplateSnapshot)
            );
            setTemplateBadge(
              shipment.cnTemplateVersion
                ? `v${shipment.cnTemplateVersion} Snapshot`
                : "Snapshot"
            );
          }
          return;
        }

        if (shipment.cnTemplateVersion) {
          try {
            const verDoc = await cnTemplateService.getVersion(
              shipment.cnTemplateVersion
            );
            if (!cancelled && verDoc?.config) {
              setResolvedTemplate(mergeWithDefaultTemplate(verDoc.config));
              setTemplateBadge(`v${shipment.cnTemplateVersion}`);
              return;
            }
          } catch (e) {
            // Fall through to default
          }
        }

        const isExistingPersistedShipment = Boolean(
          shipment._id || shipment.createdAt
        );
        if (isExistingPersistedShipment) {
          // Legacy CN generated before template versioning: preserve original default layout
          if (!cancelled) {
            setResolvedTemplate(DEFAULT_CN_TEMPLATE_CONFIG);
            setTemplateBadge("Standard v1");
          }
          return;
        }

        // Unsaved/new CN preview: load currently active template
        try {
          const active = await cnTemplateService.getActiveTemplate();
          if (!cancelled && active?.config) {
            setResolvedTemplate(mergeWithDefaultTemplate(active.config));
            setTemplateBadge(`Active v${active.version || 1}`);
            return;
          }
        } catch (e) {
          // Fall back to default
        }

        if (!cancelled) {
          setResolvedTemplate(DEFAULT_CN_TEMPLATE_CONFIG);
          setTemplateBadge("Default");
        }
      } finally {
        if (!cancelled) setTemplateReady(true);
      }
    };

    loadTemplateForShipment();
    return () => {
      cancelled = true;
    };
  }, [isOpen, shipment]);

  useEffect(() => {
    const handleKeyDown = (e) => {
      if (e.key === "Escape") {
        onClose();
      }
    };
    if (isOpen) {
      window.addEventListener("keydown", handleKeyDown);
    }
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [isOpen, onClose]);

  useEffect(() => {
    if (isOpen && autoPrint && shipment && templateReady) {
      const timer = setTimeout(() => {
        handlePrintSplit();
      }, 300);
      return () => clearTimeout(timer);
    }
  }, [isOpen, autoPrint, shipment, templateReady]);

  const layoutMeta = useMemo(
    () =>
      shipment
        ? computeCnLayout(resolvedTemplate, shipment)
        : null,
    [resolvedTemplate, shipment]
  );

  const cnData = useMemo(
    () => (shipment ? extractCnData(shipment) : null),
    [shipment]
  );

  if (!isOpen || !shipment || !cnData) return null;

  const getShareText = (isSplit = false) => {
    const cnNo = cnData.cnNumber || "SS2004";
    const consignorName = shipment.consignor?.name || "Shipper";
    const consigneeName = shipment.consignee?.name || "Receiver";
    const layoutType = isSplit
      ? "Split 2-in-1 Duplicate CN (2 Copies/A4)"
      : "Single Page CN";
    return `Speed Setu Consignment Note (CN: ${cnNo})\nConsignor: ${consignorName}\nConsignee: ${consigneeName}\nFormat: ${layoutType}`;
  };

  /**
   * Captures the centralized SVG CN document via html2canvas and builds a razor-sharp PDF
   * with aspect-ratio-preserving scaling and predictable multi-page overflow handling.
   */
  const generateCnPdfFile = async (isSplit = false) => {
    const printContent = printRef.current;
    if (!printContent) throw new Error("Document element not found");

    const cnNo = cnData.cnNumber || "SS2004";
    const elHeight = Math.max(1, printContent.offsetHeight || 700);
    // Keep canvas well under 16384px browser max while targeting 300+ DPI
    const safeScale =
      elHeight * 4 > 14000
        ? Math.max(2, Math.floor(14000 / elHeight))
        : 4;

    const canvas = await html2canvas(printContent, {
      scale: safeScale,
      useCORS: true,
      allowTaint: true,
      backgroundColor: "#ffffff",
      logging: false,
      imageTimeout: 0,
    });

    const pageSpec = getPageDimensionsMm(resolvedTemplate.page, isSplit);
    const pdf = new jsPDF({
      orientation: pageSpec.orientation,
      unit: "mm",
      format: pageSpec.format,
      compress: true,
    });

    const availW = pageSpec.widthMm - pageSpec.marginLeft - pageSpec.marginRight;
    const availH = pageSpec.heightMm - pageSpec.marginTop - pageSpec.marginBottom;
    const imgRatio = canvas.height / canvas.width;

    if (!isSplit) {
      const hAtFullWidth = availW * imgRatio;

      if (hAtFullWidth <= availH) {
        const imgData = canvas.toDataURL("image/png", 1.0);
        const yOffset = pageSpec.marginTop + (availH - hAtFullWidth) / 2;
        pdf.addImage(imgData, "PNG", pageSpec.marginLeft, yOffset, availW, hAtFullWidth, undefined, "FAST");
      } else if (availH / hAtFullWidth >= 0.72) {
        // Uniform scale-to-fit single page without squishing or stretching
        const imgData = canvas.toDataURL("image/png", 1.0);
        const drawH = availH;
        const drawW = drawH / imgRatio;
        const xOffset = pageSpec.marginLeft + (availW - drawW) / 2;
        pdf.addImage(imgData, "PNG", xOffset, pageSpec.marginTop, drawW, drawH, undefined, "FAST");
      } else {
        // Multi-page clean vertical slicing so 25+ invoice lines stay crisp and readable
        const pxPerMm = canvas.width / availW;
        const sliceHeightPx = Math.floor(availH * pxPerMm);
        let yCursorPx = 0;
        let pageIdx = 0;

        while (yCursorPx < canvas.height) {
          const currentSlicePx = Math.min(sliceHeightPx, canvas.height - yCursorPx);
          const sliceCanvas = document.createElement("canvas");
          sliceCanvas.width = canvas.width;
          sliceCanvas.height = currentSlicePx;
          const sCtx = sliceCanvas.getContext("2d");
          sCtx.fillStyle = "#ffffff";
          sCtx.fillRect(0, 0, sliceCanvas.width, sliceCanvas.height);
          sCtx.drawImage(
            canvas,
            0,
            yCursorPx,
            canvas.width,
            currentSlicePx,
            0,
            0,
            canvas.width,
            currentSlicePx
          );

          if (pageIdx > 0) pdf.addPage();
          const sliceMmH = currentSlicePx / pxPerMm;
          pdf.addImage(
            sliceCanvas.toDataURL("image/png", 1.0),
            "PNG",
            pageSpec.marginLeft,
            pageSpec.marginTop,
            availW,
            sliceMmH,
            undefined,
            "FAST"
          );
          yCursorPx += currentSlicePx;
          pageIdx++;
        }
      }
    } else {
      // Split 2-in-1 Duplicate CN -> A4 Portrait (210mm x 297mm), 2 identical copies
      const imgData = canvas.toDataURL("image/png", 1.0);
      const cutZoneH = 6; // mm
      const halfAvailH = (availH - cutZoneH) / 2;
      const fitScale = Math.min(availW / canvas.width, halfAvailH / canvas.height);
      const drawW = canvas.width * fitScale;
      const drawH = canvas.height * fitScale;
      const xCentered = pageSpec.marginLeft + (availW - drawW) / 2;

      if (drawH / (availW * imgRatio) >= 0.52) {
        // Standard 2-up on 1 sheet
        const topY = pageSpec.marginTop + (halfAvailH - drawH) / 2;
        pdf.addImage(imgData, "PNG", xCentered, topY, drawW, drawH, undefined, "FAST");

        const cutY = pageSpec.marginTop + halfAvailH + cutZoneH / 2;
        pdf.setLineDashPattern([3, 2], 0);
        pdf.setDrawColor(120, 120, 120);
        pdf.setLineWidth(0.4);
        pdf.line(pageSpec.marginLeft, cutY, pageSpec.widthMm - pageSpec.marginRight, cutY);

        pdf.setFontSize(8);
        pdf.setTextColor(120, 120, 120);
        pdf.text(
          "- - - - - - - - - - - - CUT HERE FOR DUPLICATE COPY - - - - - - - - - - - -",
          pageSpec.widthMm / 2,
          cutY - 1,
          { align: "center" }
        );

        const bottomY = pageSpec.marginTop + halfAvailH + cutZoneH + (halfAvailH - drawH) / 2;
        pdf.addImage(imgData, "PNG", xCentered, bottomY, drawW, drawH, undefined, "FAST");
      } else {
        // Extreme overflow fallback: render each duplicate copy full-width across sheets
        const fullScale = Math.min(availW / canvas.width, availH / canvas.height);
        const fW = canvas.width * fullScale;
        const fH = canvas.height * fullScale;
        const fX = pageSpec.marginLeft + (availW - fW) / 2;
        pdf.addImage(imgData, "PNG", fX, pageSpec.marginTop, fW, fH, undefined, "FAST");
        pdf.addPage();
        pdf.addImage(imgData, "PNG", fX, pageSpec.marginTop, fW, fH, undefined, "FAST");
      }
    }

    const pdfBlob = pdf.output("blob");
    const fileName = `Consignment_Note_${cnNo}_${isSplit ? "2Up" : "Single"}.pdf`;
    const pdfFile = new File([pdfBlob], fileName, { type: "application/pdf" });

    return { pdfBlob, pdfFile, fileName };
  };

  // Native Mobile / Desktop PDF Share
  const handleSharePdf = async (isSplit = false) => {
    const cnNo = cnData.cnNumber || "SS2004";
    setIsGeneratingPdf(true);

    try {
      const { pdfFile, pdfBlob, fileName } = await generateCnPdfFile(isSplit);

      if (navigator.canShare && navigator.canShare({ files: [pdfFile] })) {
        await navigator.share({
          title: `Consignment Note ${cnNo}`,
          text: `Speed Setu Consignment Note - ${cnNo}`,
          files: [pdfFile],
        });
        setIsGeneratingPdf(false);
        return;
      }

      const url = URL.createObjectURL(pdfBlob);
      const a = document.createElement("a");
      a.href = url;
      a.download = fileName;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(url);

      setCopiedToast(isSplit ? "split-download" : "single-download");
      setTimeout(() => setCopiedToast(null), 3000);
    } catch (err) {
      console.error("Share PDF error:", err);
      try {
        const shareText = getShareText(isSplit);
        await navigator.clipboard.writeText(shareText);
        setCopiedToast(isSplit ? "split-text" : "single-text");
        setTimeout(() => setCopiedToast(null), 2500);
      } catch (e) {}
    } finally {
      setIsGeneratingPdf(false);
    }
  };

  // Direct PDF File Download
  const handleDownloadPdf = async (isSplit = false) => {
    setIsGeneratingPdf(true);
    try {
      const { pdfBlob, fileName } = await generateCnPdfFile(isSplit);
      const url = URL.createObjectURL(pdfBlob);
      const a = document.createElement("a");
      a.href = url;
      a.download = fileName;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(url);

      setCopiedToast(isSplit ? "split-download" : "single-download");
      setTimeout(() => setCopiedToast(null), 3000);
    } catch (err) {
      console.error("Download PDF error:", err);
    } finally {
      setIsGeneratingPdf(false);
    }
  };

  // Universal direct print handler (Desktop + AirPrint compatible)
  const triggerDirectPrint = (isSplit = false) => {
    const printContent = printRef.current;
    if (!printContent) {
      window.print();
      return;
    }

    const svgElement = printContent.querySelector("svg");
    const svgHtml = svgElement ? svgElement.outerHTML : printContent.innerHTML;

    const oldTarget = document.getElementById("speed-setu-direct-print-target");
    if (oldTarget) {
      try {
        oldTarget.remove();
      } catch (e) {}
    }

    const printTarget = document.createElement("div");
    printTarget.id = "speed-setu-direct-print-target";

    const pageSpec = getPageDimensionsMm(resolvedTemplate.page, isSplit);
    const cssSizeName =
      resolvedTemplate.page?.size && resolvedTemplate.page.size !== "Custom"
        ? resolvedTemplate.page.size
        : "A4";
    const singlePageSizeRule = isSplit
      ? "A4 portrait"
      : `${cssSizeName} ${pageSpec.orientation}`;
    const marginRule = isSplit
      ? "2mm"
      : `${pageSpec.marginTop}mm ${pageSpec.marginRight}mm ${pageSpec.marginBottom}mm ${pageSpec.marginLeft}mm`;

    const isOverflow = Boolean(layoutMeta?.isOverflowing);

    const pageOrientationStyle = `
      @media print {
        @page {
          size: ${singlePageSizeRule} !important;
          margin: ${marginRule} !important;
        }
        ${
          isOverflow && !isSplit
            ? `
          html, body, #speed-setu-direct-print-target {
            height: auto !important;
            overflow: visible !important;
          }
          .cn-single-print-wrapper {
            height: auto !important;
            display: block !important;
          }
          .cn-single-print-wrapper svg {
            max-height: none !important;
            height: auto !important;
          }
        `
            : ""
        }
      }
    `;

    if (!isSplit) {
      printTarget.innerHTML = `
        <style>${pageOrientationStyle}</style>
        <div class="cn-single-print-wrapper">${svgHtml}</div>
      `;
    } else {
      printTarget.innerHTML = `
        <style>${pageOrientationStyle}</style>
        <div class="cn-split-print-wrapper">
          <div class="cn-copy-half">${svgHtml}</div>
          <div class="cn-cut-line">
            <div class="cn-cut-line-dashed"></div>
            <span class="cn-cut-text">- - - CUT HERE FOR DUPLICATE COPY - - -</span>
          </div>
          <div class="cn-copy-half">${svgHtml}</div>
        </div>
      `;
    }

    document.body.classList.add("printing-direct");
    document.body.appendChild(printTarget);

    setTimeout(() => {
      try {
        window.print();
      } catch (err) {
        console.error("Direct print error:", err);
      }
      setTimeout(() => {
        try {
          document.body.classList.remove("printing-direct");
          if (document.body.contains(printTarget)) {
            printTarget.remove();
          }
        } catch (e) {}
      }, 1200);
    }, 150);
  };

  const handlePrintSingle = () => triggerDirectPrint(false);
  const handlePrintSplit = () => triggerDirectPrint(true);

  return (
    <div
      className="fixed inset-0 z-50 overflow-y-auto bg-slate-950/85 backdrop-blur-md flex items-center justify-center p-2 sm:p-4 print:p-0 print:bg-white print:static"
      onClick={onClose}
    >
      {/* Screen Wrapper Shell */}
      <div
        className="bg-white rounded-2xl border border-slate-700 w-full max-w-[1100px] overflow-hidden print:border-none print:w-full print:max-w-none shadow-2xl relative my-auto"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Screen Control Toolbar (Hidden on Print) */}
        <div className="no-print bg-slate-900 text-white border-b border-slate-800 shadow-md p-3 sm:p-4">
          <div className="flex items-center justify-between pb-2.5 border-b border-slate-800">
            <div className="flex items-center space-x-2.5 min-w-0">
              <div className="w-8 h-8 rounded-lg bg-setu-600/20 border border-setu-500/30 flex items-center justify-center text-setu-400 flex-shrink-0">
                <FileText className="w-4 h-4" />
              </div>
              <div className="min-w-0">
                <div className="flex items-center space-x-2">
                  <h2 className="text-sm font-bold text-white truncate">
                    Consignment Note (CN)
                  </h2>
                  <span className="px-2 py-0.5 text-[11px] font-extrabold rounded bg-amber-400 text-slate-900 shadow-xs flex-shrink-0">
                    {cnData.cnNumber}
                  </span>
                  <span className="hidden sm:inline-flex items-center gap-1 px-2 py-0.5 text-[10px] font-semibold rounded bg-slate-800 text-slate-300 border border-slate-700">
                    <Layers className="w-3 h-3 text-setu-400" />
                    {templateBadge}
                  </span>
                  {cnData.invoiceNumbers.length > 1 && (
                    <span className="hidden md:inline-flex px-2 py-0.5 text-[10px] font-semibold rounded bg-blue-500/20 text-blue-300 border border-blue-500/30">
                      {cnData.invoiceNumbers.length} Invoices
                    </span>
                  )}
                </div>
                <p className="text-[11px] text-slate-400 truncate">
                  Speed Setu Official Lorry Receipt
                </p>
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
            <div className="bg-slate-950/80 border border-slate-800 rounded-xl p-2.5 flex flex-col sm:flex-row sm:items-center justify-between gap-2">
              <div className="min-w-0">
                <span className="text-[11px] font-bold text-slate-200 block truncate">
                  1. Single Page CN
                </span>
                <span className="text-[10px] text-slate-400 block truncate">
                  {resolvedTemplate.page?.size || "A4"}{" "}
                  {resolvedTemplate.page?.orientation || "landscape"} (1 copy)
                </span>
              </div>
              <div className="flex flex-wrap items-center gap-1.5 shrink-0">
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
                  {copiedToast === "single-download" ? (
                    <Check className="w-3.5 h-3.5 text-emerald-400" />
                  ) : (
                    <Download className="w-3.5 h-3.5 text-slate-300" />
                  )}
                  <span>PDF</span>
                </button>
                <button
                  onClick={() => {
                    const cnNo = cnData.cnNumber || "SS2004";
                    const consignor = shipment.consignor?.name || "Shipper";
                    const consignee = shipment.consignee?.name || "Receiver";
                    const pkgs = shipment.packages || "0";
                    const wt = shipment.actualWeight || "0";
                    const invs = cnData.invoiceNumbersText || "N/A";
                    const text = `🚚 *SPEED SETU CONSIGNMENT NOTE (CN)*\n\n*CN Number:* ${cnNo}\n*Consignor:* ${consignor}\n*Consignee:* ${consignee}\n*Packages:* ${pkgs} Boxes\n*Actual Weight:* ${wt} Kg\n*Invoices:* ${invs}\n\nSpeed Setu Logistics Portal`;
                    window.open(
                      `https://api.whatsapp.com/send?text=${encodeURIComponent(text)}`,
                      "_blank"
                    );
                  }}
                  className="inline-flex items-center space-x-1 px-2.5 py-1.5 rounded-lg bg-emerald-600 hover:bg-emerald-500 text-white font-bold text-xs shadow-xs transition-all active:scale-95 cursor-pointer"
                  title="Share Consignment Note details on WhatsApp"
                >
                  <Share2 className="w-3.5 h-3.5 text-white" />
                  <span>WhatsApp</span>
                </button>
                <button
                  onClick={() => handleSharePdf(false)}
                  disabled={isGeneratingPdf}
                  className="inline-flex items-center space-x-1 px-2.5 py-1.5 rounded-lg bg-slate-800 hover:bg-slate-700 disabled:opacity-50 text-slate-200 border border-slate-700 font-bold text-xs shadow-xs transition-all active:scale-95 cursor-pointer"
                  title="Share Single Page PDF file"
                >
                  {isGeneratingPdf ? (
                    <Loader2 className="w-3.5 h-3.5 text-setu-400 animate-spin" />
                  ) : copiedToast === "single-text" ? (
                    <Check className="w-3.5 h-3.5 text-emerald-400" />
                  ) : (
                    <Share2 className="w-3.5 h-3.5 text-setu-400" />
                  )}
                  <span>Share PDF</span>
                </button>
              </div>
            </div>

            {/* Option 2 Card: Split 2-in-1 Duplicate CN */}
            <div className="bg-slate-950/80 border border-amber-500/30 rounded-xl p-2.5 flex flex-col sm:flex-row sm:items-center justify-between gap-2">
              <div className="min-w-0">
                <span className="text-[11px] font-bold text-amber-400 block truncate">
                  2. Split 2-in-1 Duplicate
                </span>
                <span className="text-[10px] text-slate-400 block truncate">
                  2 copies per A4 sheet
                </span>
              </div>
              <div className="flex flex-wrap items-center gap-1.5 shrink-0">
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
                  {copiedToast === "split-download" ? (
                    <Check className="w-3.5 h-3.5 text-emerald-400" />
                  ) : (
                    <Download className="w-3.5 h-3.5 text-amber-400" />
                  )}
                  <span>PDF</span>
                </button>
                <button
                  onClick={() => handleSharePdf(true)}
                  disabled={isGeneratingPdf}
                  className="inline-flex items-center space-x-1 px-2.5 py-1.5 rounded-lg bg-slate-800 hover:bg-slate-700 disabled:opacity-50 text-slate-200 border border-slate-700 font-bold text-xs shadow-xs transition-all active:scale-95 cursor-pointer"
                  title="Share Split 2-in-1 PDF file"
                >
                  {isGeneratingPdf ? (
                    <Loader2 className="w-3.5 h-3.5 text-setu-400 animate-spin" />
                  ) : copiedToast === "split-text" ? (
                    <Check className="w-3.5 h-3.5 text-emerald-400" />
                  ) : (
                    <Share2 className="w-3.5 h-3.5 text-setu-400" />
                  )}
                  <span>Share PDF</span>
                </button>
              </div>
            </div>
          </div>
        </div>

        {/* CENTRALIZED DYNAMIC CN SVG DOCUMENT CONTAINER */}
        <div
          id="printable-cn"
          className="p-2 sm:p-3 bg-white print:p-0 svg-document-wrap overflow-x-auto max-h-[78vh] overflow-y-auto"
          ref={printRef}
        >
          <ConsignmentNoteDocument
            template={resolvedTemplate}
            shipment={shipment}
            logoSrc={logoBase64}
          />
        </div>
      </div>
    </div>
  );
};
