import React, { useMemo } from 'react';
import {
  computeCnLayout,
  wrapProseByWidth,
  measureRenderedTextWidth,
  resolveShipmentFieldValue,
} from '../../cn/cnLayoutEngine';
import defaultLogoImg from '../../assets/logo2.png';

/**
 * Centralized Consignment Note (CN) SVG Rendering Engine.
 * Used identically across Browser Modal Preview, CN Template Editor Live Preview,
 * Single-Page Print, Split 2-in-1 Duplicate Print, PDF Export, and PDF Sharing.
 */
export const ConsignmentNoteDocument = ({
  template,
  shipment,
  logoSrc,
  interactive = false,
  selectedElementId = null,
  onSelectElement,
  showGrid = false,
  className = 'w-full h-auto select-none bg-white',
}) => {
  const layout = useMemo(
    () => computeCnLayout(template, shipment || {}),
    [template, shipment]
  );

  const {
    template: tpl,
    page,
    data,
    elMap,
    frameLeft,
    frameTop,
    frameRight,
    frameBottom,
    innerWidth,
    docWidth,
    totalDocHeight,
    headerHeight,
    headerBottom,
    partiesHeight,
    partiesBottom,
    vehicleVisible,
    rightColX,
    rightColWidth,
    bodyTop,
    leftColWidth,
    centerColX,
    centerColWidth,
    bodyHeight,
    bodyBottom,
    computedLeftRows,
    remarksLines,
    remarksHeight,
    remarksBottom,
    ackHeight,
    cenvatTop,
    cenvatHeight,
    footerTop,
    footerDeltaY,
  } = layout;

  const info = tpl.companyInfo || {};
  const fontFamily = page.fontFamily || 'Arial, "Helvetica Neue", Helvetica, sans-serif';
  const brandColor = page.brandColor || '#0B315B';
  const outerStroke = Number(page.borderThickness ?? 1.8);
  const thinStroke = Number(page.thinBorderThickness ?? 1.0);
  const resolvedLogo = info.logoUrl || logoSrc || defaultLogoImg;

  const selectProps = (id) => {
    if (!interactive) return {};
    return {
      onClick: (e) => {
        e.stopPropagation();
        if (onSelectElement) onSelectElement(id);
      },
      style: { cursor: 'pointer' },
    };
  };

  const renderHighlight = (id, x, y, w, h) => {
    if (!interactive || selectedElementId !== id) return null;
    return (
      <rect
        x={x}
        y={y}
        width={Math.max(10, w)}
        height={Math.max(10, h)}
        fill="rgba(37, 99, 235, 0.08)"
        stroke="#2563eb"
        strokeWidth="2.5"
        strokeDasharray="6 3"
        pointerEvents="none"
      />
    );
  };

  const textAnchorFromAlign = (align) => {
    if (align === 'center') return 'middle';
    if (align === 'right') return 'end';
    return 'start';
  };

  const alignedX = (x, w, padL, padR, align) => {
    if (align === 'center') return x + w / 2;
    if (align === 'right') return x + w - padR;
    return x + padL;
  };

  // Element helpers
  const logoEl = elMap.company_logo || {};
  const nameAddrEl = elMap.company_name_address || {};
  const contactEl = elMap.company_contact || {};
  const titleEl = elMap.cn_title || {};
  const gstEl = elMap.gst_info || {};

  const consignorEl = elMap.consignor_details || {};
  const consignorCodeEl = elMap.consignor_code || {};
  const consignorPinEl = elMap.consignor_pin || {};

  const consigneeEl = elMap.consignee_details || {};
  const consigneeCodeEl = elMap.consignee_code || {};
  const consigneePinEl = elMap.consignee_pin || {};

  const cnNumEl = elMap.cn_number || {};
  const cnDateEl = elMap.cn_date || {};
  const modeEl = elMap.freight_mode || {};
  const routeEl = elMap.origin_destination || {};
  const vehicleEl = elMap.vehicle_details || {};

  const rateEl = elMap.rate || {};
  const basicEl = elMap.basic_freight || {};
  const loadEl = elMap.loading_unloading || {};
  const otherEl = elMap.other_charges || {};

  const ackEl = elMap.acknowledgement || {};
  const sigSealEl = elMap.signature_seal || {};
  const remarksEl = elMap.remarks || {};
  const legalEl = elMap.legal_cenvat || {};

  // Wrapped static/legal texts so custom edits never clip
  const cenvatLines = useMemo(
    () =>
      wrapProseByWidth(info.cenvatText || '', rightColWidth - 22, {
        fontSize: 10.5,
        fontWeight: '400',
        fontFamily,
      }),
    [info.cenvatText, rightColWidth, fontFamily]
  );

  const noticeLines = useMemo(
    () =>
      wrapProseByWidth(info.noticeText || '', rightColX - frameLeft - 24, {
        fontSize: 10.5,
        fontWeight: '700',
        fontFamily,
      }),
    [info.noticeText, rightColX, frameLeft, fontFamily]
  );

  const demurrageLines = useMemo(
    () =>
      wrapProseByWidth(info.demurrageText || '', rightColX - frameLeft - 24, {
        fontSize: 12,
        fontWeight: '400',
        fontFamily,
      }),
    [info.demurrageText, rightColX, frameLeft, fontFamily]
  );

  const cubicLines = useMemo(
    () =>
      wrapProseByWidth(info.cubicFeetNote || '', rightColWidth - 20, {
        fontSize: 11,
        fontWeight: '700',
        fontFamily,
      }),
    [info.cubicFeetNote, rightColWidth, fontFamily]
  );

  const consignorMaxW = Math.max(200, rightColX - frameLeft - 145);
  const consignorNameLines = useMemo(
    () =>
      wrapProseByWidth(data.consignorName || '', consignorMaxW, {
        fontSize: Number(consignorEl.valueFontSize) || 15,
        fontWeight: consignorEl.fontWeight || '600',
        fontFamily,
      }),
    [data.consignorName, consignorMaxW, consignorEl.valueFontSize, consignorEl.fontWeight, fontFamily]
  );
  const consigneeNameLines = useMemo(
    () =>
      wrapProseByWidth(data.consigneeName || '', consignorMaxW, {
        fontSize: Number(consigneeEl.valueFontSize) || 15,
        fontWeight: consigneeEl.fontWeight || '600',
        fontFamily,
      }),
    [data.consigneeName, consignorMaxW, consigneeEl.valueFontSize, consigneeEl.fontWeight, fontFamily]
  );

  // Freight rows definition
  const freightLabelX = 10;
  const freightColsSplitX = Math.round(centerColWidth * 0.66); // 310 on 470
  const freightPaiseX = centerColWidth - 60; // 410 on 470
  const freightValX = freightPaiseX - 10;

  const customFreightRows = (tpl.customElements || []).filter(
    (c) => c && c.visible !== false && c.type === 'table_row' && c.placement === 'freight_table'
  );

  const freightChargeRows = [
    {
      id: 'basic_freight',
      el: basicEl,
      label: basicEl.label || 'Basic Freight',
      value: data.basicFreight ? data.basicFreight.toFixed(0) : '',
      visible: basicEl.visible !== false,
    },
    {
      id: 'loading_unloading_1',
      el: loadEl,
      label: loadEl.label || 'Loading Chg.',
      value: data.loadingCharge ? data.loadingCharge.toFixed(0) : '',
      visible: loadEl.visible !== false,
    },
    {
      id: 'loading_unloading_2',
      el: loadEl,
      label: loadEl.secondaryLabel || 'Unloading Chg.',
      value: data.unloadingCharge ? data.unloadingCharge.toFixed(0) : '',
      visible: loadEl.visible !== false,
    },
    {
      id: 'other_charges_sl',
      el: otherEl,
      label: 'SL Chrs. / G.C. Chgs',
      value: data.slCharges ? data.slCharges.toFixed(0) : '',
      visible: otherEl.visible !== false,
    },
    {
      id: 'other_charges_hl',
      el: otherEl,
      label: 'Surcharge on Height/Length',
      value: '',
      visible: otherEl.visible !== false,
    },
    {
      id: 'other_charges_val',
      el: otherEl,
      label: 'Surcharge on Value',
      value: '',
      visible: otherEl.visible !== false,
    },
    {
      id: 'other_charges_oth',
      el: otherEl,
      label: 'Others Charges (Specify)',
      value: data.otherChargesDisplay ? data.otherChargesDisplay.toFixed(0) : '',
      visible: otherEl.visible !== false,
    },
    {
      id: 'other_charges_gt',
      el: otherEl,
      label: 'Green Tax',
      value: '',
      visible: otherEl.visible !== false,
    },
    {
      id: 'other_charges_gst',
      el: otherEl,
      label: 'G.S.T.',
      value: data.gstAmount ? data.gstAmount.toFixed(0) : '',
      visible: otherEl.visible !== false,
    },
    ...customFreightRows.map((c) => ({
      id: c.id,
      el: c,
      label: c.label || 'Custom Charge',
      value: c.fieldMapping
        ? resolveShipmentFieldValue(shipment, data, c.fieldMapping)
        : String(c.defaultValue || ''),
      visible: true,
    })),
  ].filter((r) => r.visible);

  // Floating / non-table custom elements
  const floatingCustomElements = (tpl.customElements || []).filter(
    (c) =>
      c &&
      c.visible !== false &&
      !(c.type === 'table_row' && (c.placement === 'left_table' || c.placement === 'freight_table'))
  );

  // Consignor / Consignee vertical layout helpers
  const partiesMidY = headerBottom + partiesHeight / 2;
  const consignorTop = headerBottom;
  const consigneeTop = partiesMidY;

  return (
    <svg
      xmlns="http://www.w3.org/2000/svg"
      viewBox={`0 0 ${docWidth} ${totalDocHeight}`}
      width="100%"
      height="100%"
      preserveAspectRatio="xMidYMid meet"
      className={className}
      style={{ fontFamily }}
    >
      <style>{`
        .static-border { stroke: #000000; stroke-width: ${outerStroke}; fill: none; }
        .thin-line { stroke: #000000; stroke-width: ${thinStroke}; fill: none; }
        .font-condensed-bold { font-family: ${fontFamily}; font-weight: 700; }
        .font-serif-title { font-family: ${fontFamily}; font-weight: 700; }
        .font-sans-bold { font-family: ${fontFamily}; font-weight: 600; }
        .font-sans-regular { font-family: ${fontFamily}; font-weight: 400; }
        .static-text { fill: #000000; }
        .brand-title-text { fill: ${brandColor} !important; font-family: ${fontFamily}; font-weight: 700; }
        .dynamic-text { fill: #000000; font-family: ${fontFamily}; font-weight: 600; letter-spacing: 0.2px; }
        .dynamic-digit-text { fill: #000000; font-family: ${fontFamily}; font-weight: 600; text-anchor: middle; }
      `}</style>

      {/* BACKGROUND */}
      <rect x="0" y="0" width={docWidth} height={totalDocHeight} fill="#ffffff" />

      {/* Optional Editor Alignment Grid */}
      {showGrid && (
        <g opacity="0.2">
          {Array.from({ length: Math.floor(docWidth / 50) }).map((_, i) => (
            <line key={`gx-${i}`} x1={i * 50} y1={0} x2={i * 50} y2={totalDocHeight} stroke="#94a3b8" strokeWidth="0.6" />
          ))}
          {Array.from({ length: Math.floor(totalDocHeight / 50) }).map((_, i) => (
            <line key={`gy-${i}`} x1={0} y1={i * 50} x2={docWidth} y2={i * 50} stroke="#94a3b8" strokeWidth="0.6" />
          ))}
        </g>
      )}

      {/* =================================================================== */}
      {/* OUTER DOCUMENT BORDER & MAJOR STRUCTURAL DIVIDERS                   */}
      {/* =================================================================== */}
      <rect
        x={frameLeft}
        y={frameTop}
        width={innerWidth}
        height={frameBottom - frameTop}
        className="static-border"
      />

      {/* Header Bottom Divider */}
      <line x1={frameLeft} y1={headerBottom} x2={frameRight} y2={headerBottom} className="static-border" />

      {/* Parties & Metadata Bottom Divider */}
      <line x1={frameLeft} y1={partiesBottom} x2={frameRight} y2={partiesBottom} className="static-border" />

      {/* Main Right Column Vertical Divider */}
      <line x1={rightColX} y1={headerBottom} x2={rightColX} y2={frameBottom} className="static-border" />

      {/* Consignor / Consignee Horizontal Divider */}
      <line x1={frameLeft} y1={partiesMidY} x2={rightColX} y2={partiesMidY} className="thin-line" />

      {/* =================================================================== */}
      {/* HEADER SECTION                                                      */}
      {/* =================================================================== */}
      {/* Company Logo */}
      {info.showLogo !== false && logoEl.visible !== false && (
        <g
          transform={`translate(${Number(logoEl.x ?? 25) + Number(logoEl.xOffset || 0)}, ${
            Number(logoEl.y ?? 18) + Number(logoEl.yOffset || 0)
          })`}
          {...selectProps('company_logo')}
        >
          {logoEl.showBorder && (
            <rect
              x="0"
              y="0"
              width={Number(logoEl.width) || 415}
              height={Math.min(headerHeight - 6, Number(logoEl.height) || 114)}
              fill="none"
              stroke="#000"
              strokeWidth={Number(logoEl.borderThickness) || 1}
            />
          )}
          <image
            href={resolvedLogo}
            x={Number(logoEl.paddingLeft || 0)}
            y={Number(logoEl.paddingTop || 0)}
            width={Math.max(40, Number(logoEl.width) || 415)}
            height={Math.max(30, Math.min(headerHeight - 8, Number(logoEl.height) || 114))}
            preserveAspectRatio="xMinYMid meet"
            style={{ imageRendering: 'high-quality' }}
          />
          {renderHighlight('company_logo', 0, 0, Number(logoEl.width) || 415, Math.min(headerHeight - 6, Number(logoEl.height) || 114))}
        </g>
      )}

      {/* Company Name & Address */}
      {nameAddrEl.visible !== false && (
        <g
          transform={`translate(${Number(nameAddrEl.x ?? docWidth / 2) + Number(nameAddrEl.xOffset || 0)}, ${
            Number(nameAddrEl.y ?? frameTop + 33) + Number(nameAddrEl.yOffset || 0)
          })`}
          {...selectProps('company_name_address')}
        >
          <text
            x="0"
            y="0"
            textAnchor={textAnchorFromAlign(nameAddrEl.align || 'center')}
            className="brand-title-text"
            fill={brandColor}
            fontSize={Number(nameAddrEl.fontSize) || 34}
            fontWeight={nameAddrEl.fontWeight || '700'}
            letterSpacing="0.5"
          >
            {info.companyName || 'SPEED SETU LOGISTICS PVT. LTD.'}
          </text>
          <text
            x="0"
            y="24"
            textAnchor={textAnchorFromAlign(nameAddrEl.align || 'center')}
            className="static-text"
            fontSize={Number(nameAddrEl.subFontSize) || 15}
            fontWeight="600"
          >
            {info.companyAddress || 'Haripur, Bhiwani Haryana-127 021'}
          </text>
          {renderHighlight('company_name_address', -260, -30, 520, 62)}
        </g>
      )}

      {/* Company Contact Info */}
      {contactEl.visible !== false && (
        <g
          transform={`translate(${Number(contactEl.x ?? docWidth / 2) + Number(contactEl.xOffset || 0)}, ${
            Number(contactEl.y ?? frameTop + 77) + Number(contactEl.yOffset || 0)
          })`}
          {...selectProps('company_contact')}
        >
          <text
            x="0"
            y="0"
            textAnchor={textAnchorFromAlign(contactEl.align || 'center')}
            className="static-text"
            fontSize={Number(contactEl.fontSize) || 14}
            fontWeight={contactEl.fontWeight || '600'}
          >
            {info.companyContact || 'Customer Care No. : 8884199555, 9996321200'}
          </text>
          <text
            x="0"
            y="20"
            textAnchor={textAnchorFromAlign(contactEl.align || 'center')}
            className="static-text"
            fontSize={Number(contactEl.subFontSize) || 13.5}
            fontWeight={contactEl.fontWeight || '600'}
          >
            {info.companyEmailWeb || 'Email : speedsetu@gmail.com | Website : www.speedsetu.com'}
          </text>
          {renderHighlight('company_contact', -250, -16, 500, 44)}
        </g>
      )}

      {/* CN Title */}
      {titleEl.visible !== false && (
        <g
          transform={`translate(${Number(titleEl.x ?? docWidth - 188) + Number(titleEl.xOffset || 0)}, ${
            Number(titleEl.y ?? frameTop + 39) + Number(titleEl.yOffset || 0)
          })`}
          {...selectProps('cn_title')}
        >
          <text
            x="0"
            y="0"
            textAnchor={textAnchorFromAlign(titleEl.align || 'center')}
            className="static-text"
            fontSize={Number(titleEl.fontSize) || 28}
            fontWeight={titleEl.fontWeight || '700'}
            letterSpacing="1"
          >
            {info.cnTitle || 'CONSIGNMENT NOTE'}
          </text>
          {titleEl.showBorder !== false && (
            <line
              x1={-(Number(titleEl.width) || 310) / 2}
              y1="8"
              x2={(Number(titleEl.width) || 310) / 2}
              y2="8"
              stroke="#000000"
              strokeWidth={Number(titleEl.borderThickness) || 1.8}
            />
          )}
          {renderHighlight('cn_title', -160, -28, 320, 40)}
        </g>
      )}

      {/* Header GST & Risk Notice */}
      {gstEl.visible !== false && (
        <g
          transform={`translate(${Number(gstEl.x ?? docWidth - 188) + Number(gstEl.xOffset || 0)}, ${
            Number(gstEl.y ?? frameTop + 73) + Number(gstEl.yOffset || 0)
          })`}
          {...selectProps('gst_info')}
        >
          <text
            x="0"
            y="0"
            textAnchor={textAnchorFromAlign(gstEl.align || 'center')}
            className="static-text"
            fontSize={Number(gstEl.fontSize) || 14}
            fontWeight={gstEl.fontWeight || '600'}
            letterSpacing="0.8"
          >
            {info.companyGstin || 'GST - 06ABSCS1710K1Z4'}
          </text>
          <text
            x="0"
            y="24"
            textAnchor={textAnchorFromAlign(gstEl.align || 'center')}
            className="static-text"
            fontSize={Number(gstEl.subFontSize) || 12.5}
            fontWeight="600"
            letterSpacing="0.2"
          >
            {info.riskNotice || "AT CARRIER'S RISK / OWNER'S RISK"}
          </text>
          {gstEl.showBorder !== false && (
            <line
              x1={-(Number(gstEl.width) || 330) / 2}
              y1="30"
              x2={(Number(gstEl.width) || 330) / 2}
              y2="30"
              stroke="#000000"
              strokeWidth={Number(gstEl.borderThickness) || 1.0}
            />
          )}
          {renderHighlight('gst_info', -165, -16, 330, 50)}
        </g>
      )}

      {/* =================================================================== */}
      {/* CONSIGNOR & CONSIGNEE BLOCKS                                        */}
      {/* =================================================================== */}
      {consignorEl.visible !== false && (
        <g
          transform={`translate(${frameLeft + 10 + Number(consignorEl.xOffset || 0)}, ${
            consignorTop + 30 + Number(consignorEl.yOffset || 0)
          })`}
          {...selectProps('consignor_details')}
        >
          <text x="0" y="0" className="static-text" fontSize={Number(consignorEl.fontSize) || 15} fontWeight="700">
            {consignorEl.label || "Consignor's"}
          </text>
          {consignorEl.showBorder !== false && (
            <line
              x1="95"
              y1="2"
              x2={rightColX - frameLeft - 35}
              y2="2"
              stroke="#000"
              strokeWidth={Number(consignorEl.borderThickness) || 1.0}
            />
          )}
          {consignorNameLines.slice(0, 2).map((ln, idx) => (
            <text
              key={idx}
              x="115"
              y={-1 + idx * 17}
              className="dynamic-text"
              fontSize={Number(consignorEl.valueFontSize) || 15}
              fontWeight={consignorEl.fontWeight || '600'}
            >
              {ln}
            </text>
          ))}

          <text x="360" y="45" className="static-text" fontSize="14" fontWeight="700">
            {consignorEl.secondaryLabel || 'GST No.'}
          </text>
          {consignorEl.showBorder !== false && (
            <line x1="435" y1="47" x2="720" y2="47" stroke="#000" strokeWidth={Number(consignorEl.borderThickness) || 1.0} />
          )}
          <text x="455" y="44" className="dynamic-text" fontSize="14">
            {data.consignorGstin}
          </text>
          {renderHighlight('consignor_details', -5, -22, rightColX - frameLeft - 25, 78)}
        </g>
      )}

      {consignorCodeEl.visible !== false && (
        <g
          transform={`translate(${frameLeft + 10 + Number(consignorCodeEl.xOffset || 0)}, ${
            consignorTop + 75 + Number(consignorCodeEl.yOffset || 0)
          })`}
          {...selectProps('consignor_code')}
        >
          <text x="0" y="0" className="static-text" fontSize={Number(consignorCodeEl.fontSize) || 14} fontWeight="700">
            {consignorCodeEl.label || 'CONSIGNER CODE'}
          </text>
          {consignorCodeEl.showBorder !== false && (
            <line x1="150" y1="2" x2="330" y2="2" stroke="#000" strokeWidth={Number(consignorCodeEl.borderThickness) || 1.0} />
          )}
          <text x="165" y="-1" className="dynamic-text" fontSize={Number(consignorCodeEl.valueFontSize) || 14}>
            {data.consignorCode}
          </text>
          {renderHighlight('consignor_code', -4, -18, 338, 26)}
        </g>
      )}

      {consignorPinEl.visible !== false && (
        <g
          transform={`translate(${frameLeft + 745 + Number(consignorPinEl.xOffset || 0)}, ${
            consignorTop + 56 + Number(consignorPinEl.yOffset || 0)
          })`}
          {...selectProps('consignor_pin')}
        >
          <text x="0" y="19" className="static-text" fontSize={Number(consignorPinEl.fontSize) || 14} fontWeight="700">
            {consignorPinEl.label || 'Pin :'}
          </text>
          <g transform="translate(45, 0)">
            {data.consignorPinBoxes.map((digit, idx) => (
              <g key={idx}>
                {consignorPinEl.showBorder !== false && (
                  <rect
                    x={idx * 22}
                    y="0"
                    width="22"
                    height="24"
                    fill="none"
                    stroke="#000"
                    strokeWidth={Number(consignorPinEl.borderThickness) || 1.0}
                  />
                )}
                <text
                  x={idx * 22 + 11}
                  y="17"
                  className="dynamic-digit-text"
                  fontSize={Number(consignorPinEl.valueFontSize) || 14}
                >
                  {digit}
                </text>
              </g>
            ))}
          </g>
          {renderHighlight('consignor_pin', -4, -4, 185, 32)}
        </g>
      )}

      {consigneeEl.visible !== false && (
        <g
          transform={`translate(${frameLeft + 10 + Number(consigneeEl.xOffset || 0)}, ${
            consigneeTop + 30 + Number(consigneeEl.yOffset || 0)
          })`}
          {...selectProps('consignee_details')}
        >
          <text x="0" y="0" className="static-text" fontSize={Number(consigneeEl.fontSize) || 15} fontWeight="700">
            {consigneeEl.label || 'Consignee'}
          </text>
          {consigneeEl.showBorder !== false && (
            <line
              x1="95"
              y1="2"
              x2={rightColX - frameLeft - 35}
              y2="2"
              stroke="#000"
              strokeWidth={Number(consigneeEl.borderThickness) || 1.0}
            />
          )}
          {consigneeNameLines.slice(0, 2).map((ln, idx) => (
            <text
              key={idx}
              x="115"
              y={-1 + idx * 17}
              className="dynamic-text"
              fontSize={Number(consigneeEl.valueFontSize) || 15}
              fontWeight={consigneeEl.fontWeight || '600'}
            >
              {ln}
            </text>
          ))}

          <text x="360" y="45" className="static-text" fontSize="14" fontWeight="700">
            {consigneeEl.secondaryLabel || 'GST No.'}
          </text>
          {consigneeEl.showBorder !== false && (
            <line x1="435" y1="47" x2="720" y2="47" stroke="#000" strokeWidth={Number(consigneeEl.borderThickness) || 1.0} />
          )}
          <text x="455" y="44" className="dynamic-text" fontSize="14">
            {data.consigneeGstin}
          </text>
          {renderHighlight('consignee_details', -5, -22, rightColX - frameLeft - 25, 78)}
        </g>
      )}

      {consigneeCodeEl.visible !== false && (
        <g
          transform={`translate(${frameLeft + 10 + Number(consigneeCodeEl.xOffset || 0)}, ${
            consigneeTop + 75 + Number(consigneeCodeEl.yOffset || 0)
          })`}
          {...selectProps('consignee_code')}
        >
          <text x="0" y="0" className="static-text" fontSize={Number(consigneeCodeEl.fontSize) || 14} fontWeight="700">
            {consigneeCodeEl.label || 'CONSIGNEE CODE'}
          </text>
          {consigneeCodeEl.showBorder !== false && (
            <line x1="150" y1="2" x2="330" y2="2" stroke="#000" strokeWidth={Number(consigneeCodeEl.borderThickness) || 1.0} />
          )}
          <text x="165" y="-1" className="dynamic-text" fontSize={Number(consigneeCodeEl.valueFontSize) || 14}>
            {data.consigneeCode}
          </text>
          {renderHighlight('consignee_code', -4, -18, 338, 26)}
        </g>
      )}

      {consigneePinEl.visible !== false && (
        <g
          transform={`translate(${frameLeft + 745 + Number(consigneePinEl.xOffset || 0)}, ${
            consigneeTop + 56 + Number(consigneePinEl.yOffset || 0)
          })`}
          {...selectProps('consignee_pin')}
        >
          <text x="0" y="19" className="static-text" fontSize={Number(consigneePinEl.fontSize) || 14} fontWeight="700">
            {consigneePinEl.label || 'Pin :'}
          </text>
          <g transform="translate(45, 0)">
            {data.consigneePinBoxes.map((digit, idx) => (
              <g key={idx}>
                {consigneePinEl.showBorder !== false && (
                  <rect
                    x={idx * 22}
                    y="0"
                    width="22"
                    height="24"
                    fill="none"
                    stroke="#000"
                    strokeWidth={Number(consigneePinEl.borderThickness) || 1.0}
                  />
                )}
                <text
                  x={idx * 22 + 11}
                  y="17"
                  className="dynamic-digit-text"
                  fontSize={Number(consigneePinEl.valueFontSize) || 14}
                >
                  {digit}
                </text>
              </g>
            ))}
          </g>
          {renderHighlight('consignee_pin', -4, -4, 185, 32)}
        </g>
      )}

      {/* =================================================================== */}
      {/* RIGHT METADATA: CN NO., DATE, FREIGHT MODE, ROUTING, VEHICLE        */}
      {/* =================================================================== */}
      {cnNumEl.visible !== false && (
        <g
          transform={`translate(${rightColX + 15 + Number(cnNumEl.xOffset || 0)}, ${
            headerBottom + 30 + Number(cnNumEl.yOffset || 0)
          })`}
          {...selectProps('cn_number')}
        >
          <text x="0" y="0" className="static-text" fontSize={Number(cnNumEl.fontSize) || 18} fontWeight="700">
            {cnNumEl.label || 'CN NO.'}
          </text>
          <text x="85" y="0" className="dynamic-text" fontSize={Number(cnNumEl.valueFontSize) || 22} fontWeight="700">
            {data.cnDetails.prefix}
          </text>
          <text x="145" y="0" className="dynamic-text" fontSize={(Number(cnNumEl.valueFontSize) || 24)} fontWeight="700">
            {data.cnDetails.number}
          </text>
          {renderHighlight('cn_number', -6, -22, rightColWidth - 18, 30)}
        </g>
      )}

      {cnDateEl.visible !== false && (
        <g
          transform={`translate(${rightColX + 15 + Number(cnDateEl.xOffset || 0)}, ${
            headerBottom + 54 + Number(cnDateEl.yOffset || 0)
          })`}
          {...selectProps('cn_date')}
        >
          <text x="0" y="18" className="static-text" fontSize={Number(cnDateEl.fontSize) || 15} fontWeight="700">
            {cnDateEl.label || 'Date'}
          </text>
          <g transform="translate(145, 0)">
            {data.dateBoxes.map((digit, idx) => (
              <g key={idx}>
                {cnDateEl.showBorder !== false && (
                  <rect
                    x={idx * 28}
                    y="0"
                    width="28"
                    height="26"
                    fill="none"
                    stroke="#000"
                    strokeWidth={Number(cnDateEl.borderThickness) || 1.0}
                  />
                )}
                <text
                  x={idx * 28 + 14}
                  y="18"
                  className="dynamic-digit-text"
                  fontSize={Number(cnDateEl.valueFontSize) || 15}
                >
                  {digit}
                </text>
              </g>
            ))}
          </g>
          {renderHighlight('cn_date', -6, -4, rightColWidth - 18, 34)}
        </g>
      )}

      {modeEl.visible !== false && (
        <g
          transform={`translate(${rightColX + Number(modeEl.xOffset || 0)}, ${
            headerBottom + 92 + Number(modeEl.yOffset || 0)
          })`}
          {...selectProps('freight_mode')}
        >
          {modeEl.showBorder !== false && (
            <>
              <line x1="0" y1="0" x2={rightColWidth} y2="0" stroke="#000" strokeWidth={Number(modeEl.borderThickness) || 1.0} />
              <line x1="0" y1="30" x2={rightColWidth} y2="30" stroke="#000" strokeWidth={Number(modeEl.borderThickness) || 1.0} />
            </>
          )}
          {[
            { x: 15, label: 'AIR EXPRESS', active: data.modes.isAirExpress },
            { x: 125, label: 'AIR', active: data.modes.isAir },
            { x: 190, label: 'TRAIN', active: data.modes.isTrain },
            { x: 270, label: 'ROAD', active: data.modes.isRoad },
            { x: 350, label: 'FTL', active: data.modes.isFtl },
          ].map((m) => (
            <g key={m.label}>
              <rect x={m.x} y="8" width="14" height="14" className="thin-line" />
              {m.active && (
                <text x={m.x + 1} y="20" className="dynamic-text" fontSize={Number(modeEl.valueFontSize) || 16}>
                  ✓
                </text>
              )}
              <text x={m.x + 20} y="20" className="static-text" fontSize={Number(modeEl.fontSize) || 11.5} fontWeight="700">
                {m.label}
              </text>
            </g>
          ))}
          {renderHighlight('freight_mode', 2, 1, rightColWidth - 4, 28)}
        </g>
      )}

      {routeEl.visible !== false && (
        <g
          transform={`translate(${rightColX + 15 + Number(routeEl.xOffset || 0)}, ${
            headerBottom + 140 + Number(routeEl.yOffset || 0)
          })`}
          {...selectProps('origin_destination')}
        >
          <text x="0" y="0" className="static-text" fontSize={Number(routeEl.fontSize) || 14} fontWeight="700">
            {routeEl.fromLabel || 'From'}
          </text>
          {routeEl.showBorder !== false && (
            <line x1="45" y1="2" x2="280" y2="2" stroke="#000" strokeWidth={Number(routeEl.borderThickness) || 1.0} />
          )}
          <text x="55" y="-1" className="dynamic-text" fontSize={Number(routeEl.valueFontSize) || 14.5}>
            {data.origin}
          </text>
          <text x="295" y="0" className="static-text" fontSize={Number(routeEl.fontSize) || 14} fontWeight="700">
            {routeEl.codeLabel || 'Code'}
          </text>
          {routeEl.showBorder !== false && (
            <line x1="345" y1="2" x2="415" y2="2" stroke="#000" strokeWidth={Number(routeEl.borderThickness) || 1.0} />
          )}
          <text x="355" y="-1" className="dynamic-text" fontSize="14">
            {data.originCode}
          </text>

          <text x="0" y="28" className="static-text" fontSize={Number(routeEl.fontSize) || 14} fontWeight="700">
            {routeEl.toLabel || 'To'}
          </text>
          {routeEl.showBorder !== false && (
            <line x1="28" y1="30" x2="280" y2="30" stroke="#000" strokeWidth={Number(routeEl.borderThickness) || 1.0} />
          )}
          <text x="55" y="27" className="dynamic-text" fontSize={Number(routeEl.valueFontSize) || 14.5}>
            {data.destination}
          </text>
          <text x="295" y="28" className="static-text" fontSize={Number(routeEl.fontSize) || 14} fontWeight="700">
            {routeEl.codeLabel || 'Code'}
          </text>
          {routeEl.showBorder !== false && (
            <line x1="345" y1="30" x2="415" y2="30" stroke="#000" strokeWidth={Number(routeEl.borderThickness) || 1.0} />
          )}
          <text x="355" y="27" className="dynamic-text" fontSize="14">
            {data.destCode}
          </text>

          <text x="0" y="56" className="static-text" fontSize={Number(routeEl.fontSize) || 14} fontWeight="700">
            {routeEl.eximLabel || 'To (For EXIM)'}
          </text>
          {routeEl.showBorder !== false && (
            <line x1="105" y1="58" x2="280" y2="58" stroke="#000" strokeWidth={Number(routeEl.borderThickness) || 1.0} />
          )}
          <text x="115" y="55" className="dynamic-text" fontSize="13.5">
            {data.eximDestination}
          </text>
          <text x="295" y="56" className="static-text" fontSize={Number(routeEl.fontSize) || 14} fontWeight="700">
            {routeEl.codeLabel || 'Code'}
          </text>
          {routeEl.showBorder !== false && (
            <line x1="345" y1="58" x2="415" y2="58" stroke="#000" strokeWidth={Number(routeEl.borderThickness) || 1.0} />
          )}
          <text x="355" y="55" className="dynamic-text" fontSize="14">
            {data.eximCode}
          </text>
          {renderHighlight('origin_destination', -6, -18, rightColWidth - 18, 80)}
        </g>
      )}

      {vehicleVisible && (
        <g
          transform={`translate(${rightColX + 15 + Number(vehicleEl.xOffset || 0)}, ${
            partiesBottom - 8 + Number(vehicleEl.yOffset || 0)
          })`}
          {...selectProps('vehicle_details')}
        >
          <text x="0" y="0" className="static-text" fontSize={Number(vehicleEl.fontSize) || 12} fontWeight="700">
            {vehicleEl.label || 'Vehicle :'}
          </text>
          <text x="72" y="0" className="dynamic-text" fontSize={Number(vehicleEl.valueFontSize) || 12}>
            {data.vehicleInfo || '—'}
          </text>
          {renderHighlight('vehicle_details', -4, -14, rightColWidth - 20, 20)}
        </g>
      )}

      {/* =================================================================== */}
      {/* MAIN BODY: COLUMN 1 (PACKAGES / DESCRIPTION / INVOICES)             */}
      {/* =================================================================== */}
      <line x1={centerColX} y1={bodyTop} x2={centerColX} y2={bodyBottom} className="static-border" />
      <line x1={frameLeft} y1={bodyBottom} x2={rightColX} y2={bodyBottom} className="static-border" />

      <g id="COL1_CARGO_INVOICES">
        {computedLeftRows.map((row, idx) => {
          const isLastRow = idx === computedLeftRows.length - 1;

          if (row.kind === 'metrics') {
            return (
              <g key={row.id}>
                {/* Header split line across metrics */}
                <line x1={frameLeft} y1={row.y + 28} x2={centerColX} y2={row.y + 28} className="thin-line" />
                {row.cols.map((col, cIdx) => (
                  <g
                    key={col.id}
                    transform={`translate(${col.x + Number(col.xOffset || 0)}, ${row.y + Number(col.yOffset || 0)})`}
                    {...selectProps(col.id)}
                  >
                    {cIdx > 0 && (
                      <line x1="0" y1="0" x2="0" y2={row.height} className="thin-line" />
                    )}
                    <text
                      x={col.width / 2}
                      y="19"
                      textAnchor="middle"
                      className="static-text"
                      fontSize={Number(col.fontSize) || 12}
                      fontWeight="700"
                    >
                      {col.label}
                    </text>
                    <text
                      x={alignedX(0, col.width, 6, 6, col.align || 'center')}
                      y={28 + (row.height - 28) / 2 + (Number(col.valueFontSize) || 16) * 0.35}
                      textAnchor={textAnchorFromAlign(col.align || 'center')}
                      className="dynamic-text"
                      fontSize={Number(col.valueFontSize) || 16}
                      fontWeight={col.fontWeight || '700'}
                    >
                      {col.value}
                    </text>
                    {renderHighlight(col.id, 1, 1, col.width - 2, row.height - 2)}
                  </g>
                ))}
                <line x1={frameLeft} y1={row.y + row.height} x2={centerColX} y2={row.y + row.height} className="thin-line" />
              </g>
            );
          }

          if (row.kind === 'description') {
            const el = row.element;
            const textAlign = el.align || 'left';
            const contentX = alignedX(frameLeft, row.width, row.padL, row.padR, textAlign);
            const anchor = textAnchorFromAlign(textAlign);

            return (
              <g
                key={row.id}
                transform={`translate(${Number(el.xOffset || 0)}, ${Number(el.yOffset || 0)})`}
                {...selectProps(row.id)}
              >
                <text
                  x={frameLeft + row.padL}
                  y={row.y + row.padT + row.labelFs}
                  className="static-text"
                  fontSize={row.labelFs}
                  fontWeight="700"
                >
                  {el.label || 'Description of Goods (Said to Contain):'}
                </text>

                {row.lines.map((line, lIdx) => (
                  <text
                    key={lIdx}
                    x={contentX}
                    y={row.y + row.padT + row.headerLabelH + row.valFs + lIdx * row.lineHeight}
                    textAnchor={anchor}
                    className="dynamic-text"
                    fontSize={row.valFs}
                    fontWeight={el.fontWeight || '600'}
                  >
                    {line}
                  </text>
                ))}

                {el.showBorder !== false && !isLastRow && (
                  <line
                    x1={frameLeft}
                    y1={row.y + row.height}
                    x2={frameLeft + row.width}
                    y2={row.y + row.height}
                    stroke="#000"
                    strokeWidth={Number(el.borderThickness) || thinStroke}
                  />
                )}
                {renderHighlight(row.id, frameLeft + 1, row.y + 1, row.width - 2, row.height - 2)}
              </g>
            );
          }

          // Standard key_value & custom_row (including Dynamic Invisible Line Generation for Invoice No.)
          const el = row.element;
          const textAlign = el.align || 'left';
          const valueAreaX = frameLeft + row.padL + row.labelWidth;
          const valueAreaW = Math.max(40, row.width - row.padL - row.labelWidth - row.padR);
          const valX = alignedX(valueAreaX, valueAreaW, 0, 0, textAlign);
          const anchor = textAnchorFromAlign(textAlign);
          const firstBaselineY = row.y + row.padT + Math.max(row.labelFs, row.valFs) * 0.88;

          return (
            <g
              key={row.id}
              transform={`translate(${Number(el.xOffset || 0)}, ${Number(el.yOffset || 0)})`}
              {...selectProps(row.id)}
            >
              {/* Field Label */}
              <text
                x={frameLeft + row.padL}
                y={firstBaselineY}
                className="static-text"
                fontSize={row.labelFs}
                fontWeight="700"
              >
                {el.label}
              </text>

              {/* Wrapped lines: Line 0 aligns horizontally with label; Lines 1..N render on invisible lines directly below at identical X */}
              {row.lines.map((lineText, lIdx) => (
                <text
                  key={lIdx}
                  x={valX}
                  y={firstBaselineY + lIdx * row.lineHeight}
                  textAnchor={anchor}
                  className="dynamic-text"
                  fontSize={row.valFs}
                  fontWeight={el.fontWeight || '600'}
                >
                  {lineText}
                </text>
              ))}

              {/* Single bottom border ONLY after all wrapped invisible lines */}
              {el.showBorder !== false && !isLastRow && (
                <line
                  x1={frameLeft}
                  y1={row.y + row.height}
                  x2={frameLeft + row.width}
                  y2={row.y + row.height}
                  stroke="#000"
                  strokeWidth={Number(el.borderThickness) || thinStroke}
                />
              )}
              {renderHighlight(row.id, frameLeft + 1, row.y + 1, row.width - 2, row.height - 2)}
            </g>
          );
        })}
      </g>

      {/* =================================================================== */}
      {/* COLUMN 2: FREIGHT & CHARGES TABLE                                   */}
      {/* =================================================================== */}
      <g transform={`translate(${centerColX}, ${bodyTop})`}>
        {/* Vertical Column Splitters (extend full dynamic bodyHeight) */}
        <line x1={freightColsSplitX} y1="0" x2={freightColsSplitX} y2={bodyHeight} className="thin-line" />
        <line x1={freightPaiseX} y1="28" x2={freightPaiseX} y2={bodyHeight} className="thin-line" />

        {/* Header Row 1: Rate | Freight */}
        <line x1="0" y1="28" x2={centerColWidth} y2="28" className="thin-line" />
        <g {...selectProps('rate')}>
          <text
            x={freightColsSplitX / 2}
            y="20"
            textAnchor="middle"
            className="static-text"
            fontSize={Number(rateEl.fontSize) || 13}
            fontWeight="700"
          >
            {rateEl.label || 'Rate per MT / Per FTL (Rs.)'}
          </text>
          {data.rateVal > 0 && (
            <text x={freightColsSplitX - 10} y="48" textAnchor="end" className="dynamic-text" fontSize="12.5">
              {`₹ ${data.rateVal}`}
            </text>
          )}
          {renderHighlight('rate', 1, 1, freightColsSplitX - 2, 54)}
        </g>

        <text x={(freightColsSplitX + centerColWidth) / 2} y="20" textAnchor="middle" className="static-text" fontSize="13" fontWeight="700">
          Freight
        </text>

        {/* Header Row 2: Charges | Rs. | Ps. */}
        <line x1="0" y1="56" x2={centerColWidth} y2="56" className="thin-line" />
        <text x={freightLabelX} y="46" className="static-text" fontSize="12" fontWeight="700">
          Charges
        </text>
        <text x={(freightColsSplitX + freightPaiseX) / 2} y="46" textAnchor="middle" className="static-text" fontSize="12" fontWeight="700">
          Rs.
        </text>
        <text x={(freightPaiseX + centerColWidth) / 2} y="46" textAnchor="middle" className="static-text" fontSize="12" fontWeight="700">
          Ps.
        </text>

        {/* Dynamic Freight Charge Rows */}
        {(() => {
          const rowsStartY = 56;
          const grandTotalH = 34;
          const availForRows = bodyHeight - rowsStartY - grandTotalH;
          const rowStep = Math.max(24, Math.min(34, availForRows / Math.max(1, freightChargeRows.length)));

          return (
            <>
              {freightChargeRows.map((fr, idx) => {
                const rowTop = rowsStartY + idx * rowStep;
                const rowBottom = rowTop + rowStep;
                const selectId = fr.id.startsWith('loading_unloading')
                  ? 'loading_unloading'
                  : fr.id.startsWith('other_charges')
                  ? 'other_charges'
                  : fr.id;

                return (
                  <g key={fr.id} {...selectProps(selectId)}>
                    <line x1="0" y1={rowBottom} x2={centerColWidth} y2={rowBottom} className="thin-line" />
                    <text
                      x={freightLabelX}
                      y={rowTop + rowStep * 0.68}
                      className="static-text"
                      fontSize={Number(fr.el?.fontSize) || 12.5}
                      fontWeight="600"
                    >
                      {fr.label}
                    </text>
                    {fr.value !== '' && (
                      <text
                        x={freightValX}
                        y={rowTop + rowStep * 0.68}
                        textAnchor="end"
                        className="dynamic-text"
                        fontSize={Number(fr.el?.valueFontSize) || 14}
                      >
                        {fr.value}
                      </text>
                    )}
                    {renderHighlight(selectId, 1, rowTop + 1, centerColWidth - 2, rowStep - 2)}
                  </g>
                );
              })}

              {/* Grand Total anchored cleanly at bottom of Freight Column */}
              <g {...selectProps('other_charges')}>
                <line x1="0" y1={bodyHeight - grandTotalH} x2={centerColWidth} y2={bodyHeight - grandTotalH} className="thin-line" />
                <text x={freightLabelX} y={bodyHeight - 10} className="static-text" fontSize="14" fontWeight="700">
                  Grand Total
                </text>
                {data.grandTotal > 0 && (
                  <text x={freightValX} y={bodyHeight - 10} textAnchor="end" className="dynamic-text" fontSize="16" fontWeight="700">
                    {`₹ ${data.grandTotal.toFixed(0)}`}
                  </text>
                )}
              </g>
            </>
          );
        })()}
      </g>

      {/* =================================================================== */}
      {/* COLUMN 3: ACKNOWLEDGEMENT & CENVAT                                  */}
      {/* =================================================================== */}
      {ackEl.visible !== false && (
        <g
          transform={`translate(${rightColX + Number(ackEl.xOffset || 0)}, ${bodyTop + Number(ackEl.yOffset || 0)})`}
          {...selectProps('acknowledgement')}
        >
          {ackEl.showBorder !== false && (
            <rect
              x="0"
              y="0"
              width={rightColWidth}
              height={ackHeight}
              fill="none"
              stroke="#000"
              strokeWidth={Number(ackEl.borderThickness) || thinStroke}
            />
          )}
          <text x={Number(ackEl.paddingLeft ?? 12)} y="28" className="static-text" fontSize={Number(ackEl.fontSize) || 15} fontWeight="700">
            {ackEl.label || 'ACKNOWLEDGEMENT :'}
          </text>
          {data.acknowledgementText && (
            <text x={Number(ackEl.paddingLeft ?? 12)} y="55" className="dynamic-text" fontSize={Number(ackEl.valueFontSize) || 12}>
              {data.acknowledgementText}
            </text>
          )}

          <text x="12" y={ackHeight - 28} className="static-text" fontSize="14" fontWeight="700">
            DATE
          </text>
          <line x1="60" y1={ackHeight - 26} x2="210" y2={ackHeight - 26} className="thin-line" />

          <text x="260" y={ackHeight - 28} className="static-text" fontSize="14" fontWeight="700">
            SIGNATURE
          </text>
          <line x1="350" y1={ackHeight - 26} x2={rightColWidth - 10} y2={ackHeight - 26} className="thin-line" />
          {renderHighlight('acknowledgement', 1, 1, rightColWidth - 2, ackHeight - 2)}
        </g>
      )}

      {/* CENVAT Disclaimer Box */}
      <g transform={`translate(${rightColX}, ${cenvatTop})`} {...selectProps('legal_cenvat')}>
        <rect x="0" y="0" width={rightColWidth} height={cenvatHeight} className="thin-line" />
        {cenvatLines.map((line, i) => (
          <text
            key={i}
            x="10"
            y={22 + i * 16}
            className="static-text"
            fontSize="10.5"
            fontStyle="italic"
            fontWeight="400"
          >
            {line}
          </text>
        ))}
      </g>

      {/* =================================================================== */}
      {/* CONSIGNOR SIGNATURE & SEAL + REMARKS                                */}
      {/* =================================================================== */}
      {sigSealEl.visible !== false && (
        <g
          transform={`translate(${frameLeft + Number(sigSealEl.xOffset || 0)}, ${bodyBottom + Number(sigSealEl.yOffset || 0)})`}
          {...selectProps('signature_seal')}
        >
          <text
            x={(Number(sigSealEl.width) || 295) / 2}
            y={remarksHeight / 2 + 6}
            textAnchor={textAnchorFromAlign(sigSealEl.align || 'center')}
            className="static-text"
            fontSize={Number(sigSealEl.fontSize) || 12}
            fontWeight="700"
          >
            {sigSealEl.label || "Space for Consignor's Signature & Seal"}
          </text>
          {renderHighlight('signature_seal', 1, 1, 293, remarksHeight - 2)}
        </g>
      )}

      {remarksEl.visible !== false && (
        <g
          transform={`translate(${frameLeft + 295 + Number(remarksEl.xOffset || 0)}, ${
            bodyBottom + Number(remarksEl.yOffset || 0)
          })`}
          {...selectProps('remarks')}
        >
          <line x1="0" y1="0" x2="0" y2={remarksHeight} className="static-border" />
          <text x="10" y="24" className="static-text" fontSize={Number(remarksEl.fontSize) || 14} fontWeight="700">
            {remarksEl.label || 'REMARKS :'}
          </text>
          {remarksLines.map((line, lIdx) => (
            <text
              key={lIdx}
              x="100"
              y={24 + lIdx * (Number(remarksEl.valueFontSize || 13.5) * 1.32)}
              className="dynamic-text"
              fontSize={Number(remarksEl.valueFontSize) || 13.5}
              fontWeight={remarksEl.fontWeight || '600'}
            >
              {line}
            </text>
          ))}
          {renderHighlight('remarks', 1, 1, rightColX - (frameLeft + 295) - 2, remarksHeight - 2)}
        </g>
      )}

      {/* =================================================================== */}
      {/* BOTTOM LEGAL SECTION & SPEED SETU SIGNATORY                         */}
      {/* =================================================================== */}
      <line x1={frameLeft} y1={footerTop} x2={frameRight} y2={footerTop} className="static-border" />

      {legalEl.visible !== false && (
        <g {...selectProps('legal_cenvat')}>
          {/* Left Legal Notices */}
          <g transform={`translate(${frameLeft + 10}, ${footerTop + 20})`}>
            <text x="0" y="0" className="static-text" fontSize="13" fontWeight="700">
              {info.demurrageTitle || 'SCHEDULE OF DEMURRAGE CHARGES'}
            </text>
            {demurrageLines.map((line, i) => (
              <text key={i} x="0" y={18 + i * 15} className="static-text" fontSize="12" fontWeight="400">
                {line}
              </text>
            ))}
          </g>

          <line x1={frameLeft} y1={footerTop + 53} x2={rightColX} y2={footerTop + 53} className="thin-line" />

          <g transform={`translate(${frameLeft + 10}, ${footerTop + 68})`}>
            {noticeLines.map((line, i) => (
              <text key={i} x="0" y={i * 15} className="static-text" fontSize="10.5" fontWeight="700">
                {line}
              </text>
            ))}
            <text x="0" y={Math.max(48, noticeLines.length * 15 + 10)} className="static-text" fontSize="12.5" fontWeight="700">
              {info.termsNote || 'All terms & Conditions Overleaf'}
            </text>
            <text x="0" y={Math.max(68, noticeLines.length * 15 + 30)} className="static-text" fontSize="12.5" fontWeight="700">
              {info.copyLabels || '1. Consignor Copy     2. Proof of Delivery     3. Consignee Copy'}
            </text>
          </g>

          {/* Bottom Right: Cubic Feet & Speed Setu Signature & Employee Code */}
          <g transform={`translate(${rightColX}, ${footerTop})`}>
            <rect x="0" y="0" width={rightColWidth} height="52" className="thin-line" />
            {cubicLines.map((line, i) => (
              <text key={i} x="10" y={20 + i * 16} className="static-text" fontSize="11" fontWeight="700">
                {line}
              </text>
            ))}

            <g transform="translate(10, 75)">
              <text x="0" y="0" className="brand-title-text" fill={brandColor} fontSize="15" fontWeight="700">
                {info.signatureForLabel || 'For SPEED SETU LOGISTICS PVT. LTD.'}
              </text>

              <text x="0" y="50" className="static-text" fontSize="12.5" fontWeight="700">
                {info.signLabel || 'Sign.'}
              </text>
              <line x1="40" y1="52" x2="235" y2="52" className="thin-line" />

              <text x="250" y="30" className="static-text" fontSize="11.5" fontWeight="700">
                {info.employeeCodeLabel || 'Employee Code'}
              </text>
              <g transform="translate(250, 34)">
                {data.empCodeBoxes.map((digit, idx) => (
                  <g key={idx}>
                    <rect x={idx * 22} y="0" width="22" height="24" className="thin-line" />
                    <text x={idx * 22 + 11} y="17" className="dynamic-digit-text" fontSize="14">
                      {digit}
                    </text>
                  </g>
                ))}
              </g>
            </g>
          </g>
          {renderHighlight('legal_cenvat', frameLeft + 2, footerTop + 2, innerWidth - 4, layout.footerHeight - 4)}
        </g>
      )}

      {/* =================================================================== */}
      {/* CUSTOM ADDED ELEMENTS (Text, Labels, Sections, Notes, Numeric)      */}
      {/* =================================================================== */}
      {floatingCustomElements.map((c) => {
        const rawY = Number(c.y ?? 100);
        // Shift custom elements placed in lower/footer zone downward automatically if body expanded
        const yPos = rawY >= 700 ? rawY + footerDeltaY : rawY >= 690 ? rawY + layout.bodyBottomDeltaY : rawY;
        const xPos = Number(c.x ?? 40) + Number(c.xOffset || 0);
        const finalY = yPos + Number(c.yOffset || 0);
        const w = Math.max(60, Number(c.width ?? 220));
        const h = Math.max(24, Number(c.height ?? 36));
        const fs = Number(c.fontSize ?? 13);
        const padL = Number(c.paddingLeft ?? 8);
        const padR = Number(c.paddingRight ?? 8);
        const padT = Number(c.paddingTop ?? 6);
        const align = c.align || 'left';

        const mappedVal = c.fieldMapping
          ? resolveShipmentFieldValue(shipment, data, c.fieldMapping)
          : '';
        let displayValue = mappedVal || String(c.defaultValue || '');
        if (c.type === 'numeric_field' && displayValue && !isNaN(Number(displayValue))) {
          displayValue = `${c.prefix || ''}${Number(displayValue).toLocaleString('en-IN')}${c.suffix || ''}`;
        }

        const labelText = String(c.label || '');
        const fullText =
          c.type === 'custom_label'
            ? labelText
            : c.type === 'note'
            ? `${labelText ? `${labelText}: ` : ''}${displayValue}`
            : labelText;

        const bodyLines =
          c.type === 'info_section' || c.type === 'note'
            ? wrapProseByWidth(c.type === 'info_section' ? displayValue : fullText, w - padL - padR, {
                fontSize: fs,
                fontWeight: c.fontWeight || '600',
                fontFamily,
              })
            : [];

        return (
          <g key={c.id} transform={`translate(${xPos}, ${finalY})`} {...selectProps(c.id)}>
            {c.showBorder !== false && (
              <rect
                x="0"
                y="0"
                width={w}
                height={h}
                fill={c.backgroundColor || '#ffffff'}
                fillOpacity={c.backgroundColor ? 1 : 0.9}
                stroke="#000000"
                strokeWidth={Number(c.borderThickness ?? 1.0)}
              />
            )}

            {c.type === 'info_section' ? (
              <>
                <text
                  x={alignedX(0, w, padL, padR, align)}
                  y={padT + fs}
                  textAnchor={textAnchorFromAlign(align)}
                  className="static-text"
                  fontSize={fs}
                  fontWeight="700"
                >
                  {labelText}
                </text>
                {bodyLines.map((ln, lIdx) => (
                  <text
                    key={lIdx}
                    x={alignedX(0, w, padL, padR, align)}
                    y={padT + fs + 18 + lIdx * (fs * 1.3)}
                    textAnchor={textAnchorFromAlign(align)}
                    className="dynamic-text"
                    fontSize={Math.max(10, fs - 1)}
                    fontWeight={c.fontWeight || '500'}
                  >
                    {ln}
                  </text>
                ))}
              </>
            ) : c.type === 'note' ? (
              bodyLines.map((ln, lIdx) => (
                <text
                  key={lIdx}
                  x={alignedX(0, w, padL, padR, align)}
                  y={padT + fs + lIdx * (fs * 1.3)}
                  textAnchor={textAnchorFromAlign(align)}
                  className="static-text"
                  fontSize={fs}
                  fontStyle="italic"
                  fontWeight={c.fontWeight || '500'}
                >
                  {ln}
                </text>
              ))
            ) : c.type === 'custom_label' ? (
              <text
                x={alignedX(0, w, padL, padR, align)}
                y={h / 2 + fs * 0.35}
                textAnchor={textAnchorFromAlign(align)}
                className="static-text"
                fontSize={fs}
                fontWeight={c.fontWeight || '700'}
              >
                {labelText}
              </text>
            ) : (
              <>
                <text
                  x={padL}
                  y={h / 2 + fs * 0.35}
                  className="static-text"
                  fontSize={fs}
                  fontWeight="700"
                >
                  {labelText ? `${labelText}:` : ''}
                </text>
                <text
                  x={(() => {
                    const measuredLbl = labelText
                      ? measureRenderedTextWidth(`${labelText}:`, { fontSize: fs, fontWeight: '700', fontFamily }) + 10
                      : 0;
                    const offset = Math.min(w * 0.48, measuredLbl);
                    return alignedX(padL + offset, Math.max(30, w - padL - padR - offset), 0, 0, align);
                  })()}
                  y={h / 2 + fs * 0.35}
                  textAnchor={textAnchorFromAlign(align)}
                  className="dynamic-text"
                  fontSize={Number(c.valueFontSize ?? fs)}
                  fontWeight={c.fontWeight || '600'}
                >
                  {displayValue}
                </text>
              </>
            )}

            {renderHighlight(c.id, -2, -2, w + 4, h + 4)}
          </g>
        );
      })}
    </svg>
  );
};
