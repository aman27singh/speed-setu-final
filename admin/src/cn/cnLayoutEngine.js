import { mergeWithDefaultTemplate } from './defaultCnTemplate.js';

/**
 * Offscreen Canvas 2D context for accurate rendered text width measurement.
 * Falls back gracefully to proportional font-metric estimation in non-DOM test environments.
 */
let _measureCtx = null;
function getMeasureContext() {
  if (_measureCtx) return _measureCtx;
  if (typeof document !== 'undefined') {
    try {
      const canvas = document.createElement('canvas');
      _measureCtx = canvas.getContext('2d');
      return _measureCtx;
    } catch (e) {
      return null;
    }
  }
  return null;
}

export function measureRenderedTextWidth(text, { fontSize = 13, fontWeight = '600', fontFamily = 'Arial, sans-serif', letterSpacing = 0.2 } = {}) {
  const str = String(text ?? '');
  if (!str) return 0;

  const ctx = getMeasureContext();
  if (ctx) {
    ctx.font = `${fontWeight} ${fontSize}px ${fontFamily}`;
    const baseWidth = ctx.measureText(str).width;
    const spacingAllowance = Math.max(0, str.length - 1) * letterSpacing;
    // Slight 3% safety margin prevents right-edge glyph collisions across browser/OS font renderers
    return (baseWidth + spacingAllowance) * 1.03;
  }

  // Deterministic fallback for headless/Node verification
  let est = 0;
  for (let i = 0; i < str.length; i++) {
    const ch = str[i];
    if ('iIl1.,:;|! '.includes(ch)) est += fontSize * 0.34;
    else if ('MW@#%&'.includes(ch)) est += fontSize * 0.92;
    else if (ch >= 'A' && ch <= 'Z') est += fontSize * 0.72;
    else if (ch >= '0' && ch <= '9') est += fontSize * 0.62;
    else est += fontSize * 0.58;
  }
  const weightBoost = Number(fontWeight) >= 700 ? 1.05 : 1.0;
  return est * weightBoost * 1.04 + Math.max(0, str.length - 1) * letterSpacing;
}

/**
 * Breaks a single over-wide token (e.g. a 45-char invoice number) across lines by measured width,
 * never truncating any character.
 */
function breakLongTokenByWidth(token, maxWidth, fontSpec) {
  if (!token) return [''];
  if (measureRenderedTextWidth(token, fontSpec) <= maxWidth) return [token];

  const chunks = [];
  let current = '';
  for (let i = 0; i < token.length; i++) {
    const candidate = current + token[i];
    if (current.length > 0 && measureRenderedTextWidth(candidate, fontSpec) > maxWidth) {
      chunks.push(current);
      current = token[i];
    } else {
      current = candidate;
    }
  }
  if (current) chunks.push(current);
  return chunks;
}

/**
 * Wraps an array of discrete tokens (like invoice numbers or E-Way bills) by actual rendered pixel width.
 * Never splits an invoice number mid-token unless the single token itself exceeds maxWidth.
 */
export function wrapTokensByWidth(tokens, maxWidth, fontSpec, separator = ', ') {
  const cleanTokens = (Array.isArray(tokens) ? tokens : [])
    .map((t) => String(t ?? '').trim())
    .filter(Boolean);

  if (cleanTokens.length === 0) return [];
  const safeMaxWidth = Math.max(40, maxWidth);

  const lines = [];
  let currentLine = '';

  for (let i = 0; i < cleanTokens.length; i++) {
    const token = cleanTokens[i];
    const tokenFitsAlone = measureRenderedTextWidth(token, fontSpec) <= safeMaxWidth;

    if (!tokenFitsAlone) {
      if (currentLine) {
        lines.push(currentLine);
        currentLine = '';
      }
      const broken = breakLongTokenByWidth(token, safeMaxWidth, fontSpec);
      for (let b = 0; b < broken.length - 1; b++) {
        lines.push(broken[b]);
      }
      currentLine = broken[broken.length - 1] || '';
      continue;
    }

    if (!currentLine) {
      currentLine = token;
    } else {
      const candidate = `${currentLine}${separator}${token}`;
      if (measureRenderedTextWidth(candidate, fontSpec) <= safeMaxWidth) {
        currentLine = candidate;
      } else {
        lines.push(currentLine);
        currentLine = token;
      }
    }
  }

  if (currentLine) {
    lines.push(currentLine);
  }

  return lines;
}

/**
 * Wraps prose (Description of Goods, Remarks, etc.) at word boundaries using rendered width measurement.
 */
export function wrapProseByWidth(text, maxWidth, fontSpec) {
  const raw = String(text ?? '').trim();
  if (!raw) return [];
  const safeMaxWidth = Math.max(40, maxWidth);

  const paragraphs = raw.split(/\r?\n/);
  const lines = [];

  for (const para of paragraphs) {
    const words = para.trim().split(/\s+/).filter(Boolean);
    if (words.length === 0) {
      lines.push('');
      continue;
    }

    let current = '';
    for (const word of words) {
      if (measureRenderedTextWidth(word, fontSpec) > safeMaxWidth) {
        if (current) {
          lines.push(current);
          current = '';
        }
        const broken = breakLongTokenByWidth(word, safeMaxWidth, fontSpec);
        for (let b = 0; b < broken.length - 1; b++) {
          lines.push(broken[b]);
        }
        current = broken[broken.length - 1] || '';
        continue;
      }

      if (!current) {
        current = word;
      } else {
        const candidate = `${current} ${word}`;
        if (measureRenderedTextWidth(candidate, fontSpec) <= safeMaxWidth) {
          current = candidate;
        } else {
          lines.push(current);
          current = word;
        }
      }
    }
    if (current) lines.push(current);
  }

  return lines;
}

export function formatDateBoxes(dateStr) {
  if (!dateStr) return Array(8).fill('');
  const d = new Date(dateStr);
  if (isNaN(d.getTime())) return Array(8).fill('');
  const day = String(d.getDate()).padStart(2, '0');
  const month = String(d.getMonth() + 1).padStart(2, '0');
  const year = String(d.getFullYear());
  return `${day}${month}${year}`.split('').slice(0, 8);
}

export function formatPinBoxes(pinStr) {
  const pin = String(pinStr || '').replace(/\D/g, '');
  const arr = pin.split('');
  while (arr.length < 6) arr.push('');
  return arr.slice(0, 6);
}

export function formatEmpCodeBoxes(empStr) {
  const code = String(empStr || '').replace(/[^a-zA-Z0-9]/g, '');
  const arr = code.split('');
  while (arr.length < 6) arr.push('');
  return arr.slice(0, 6);
}

export function parseCnNumber(shipmentObj = {}) {
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
    return {
      prefix: match[1].toUpperCase(),
      number: match[2].trim() || '285',
    };
  }

  return {
    prefix: 'SS',
    number: raw.replace(/^SS[-\s_]?/i, '').trim() || '285',
  };
}

/**
 * Extracts and normalizes all commercial invoice numbers, dates, values, quantities,
 * E-Way bills, and freight calculations from any SpeedSetu shipment object.
 */
export function extractCnData(shipment = {}) {
  const commList = Array.isArray(shipment.commercialInvoices) ? shipment.commercialInvoices : [];

  // 1. Invoice numbers: gather all from commercialInvoices + fallback/merge invoiceDetails.invoiceNumber
  const commInvNumbers = commList
    .map((i) => String(i?.invoiceNumber ?? '').trim())
    .filter(Boolean);

  const detailInvRaw = String(shipment.invoiceDetails?.invoiceNumber ?? '').trim();
  const detailInvTokens = detailInvRaw
    ? detailInvRaw
        .split(',')
        .map((t) => t.trim())
        .filter(Boolean)
    : [];

  let invoiceNumbers = [];
  if (commInvNumbers.length > 0) {
    invoiceNumbers = [...commInvNumbers];
    // Include any extra comma-separated tokens stored directly in invoiceDetails
    detailInvTokens.forEach((tok) => {
      if (!invoiceNumbers.includes(tok)) {
        invoiceNumbers.push(tok);
      }
    });
  } else {
    invoiceNumbers = detailInvTokens;
  }

  // 2. Invoice dates
  const commDates = commList
    .map((i) => String(i?.invoiceDate ?? '').trim())
    .filter(Boolean);
  const detailDateRaw = String(shipment.invoiceDetails?.invoiceDate ?? '').trim();
  const detailDates = detailDateRaw
    ? detailDateRaw.split(',').map((d) => d.trim()).filter(Boolean)
    : [];
  const invoiceDates = [];
  [...commDates, ...detailDates].forEach((d) => {
    if (d && !invoiceDates.includes(d)) invoiceDates.push(d);
  });

  // 3. Invoice value (total)
  const commValSum = commList.reduce((sum, i) => sum + (parseFloat(i?.invoiceValue) || 0), 0);
  const detailVal = parseFloat(shipment.invoiceDetails?.invoiceValue) || 0;
  const invoiceValueNum = commValSum > 0 ? commValSum : detailVal;
  const invoiceValueDisplay = invoiceValueNum > 0 ? `₹ ${invoiceValueNum.toLocaleString('en-IN')}` : '';

  // 4. Invoice quantity (total)
  const commQtyList = commList
    .map((i) => i?.invoiceQuantity)
    .filter((q) => q !== undefined && q !== null && q !== '' && q !== 0 && q !== '0');
  let invoiceQtyDisplay = '';
  const detailQty = shipment.invoiceDetails?.invoiceQuantity;
  if (commQtyList.length > 0) {
    const allNumeric = commQtyList.every((q) => !isNaN(Number(q)));
    if (allNumeric) {
      const sumQty = commQtyList.reduce((s, q) => s + Number(q), 0);
      invoiceQtyDisplay = sumQty > 0 ? String(sumQty) : '';
    } else {
      invoiceQtyDisplay = commQtyList.join(', ');
    }
  } else if (detailQty !== undefined && detailQty !== null && detailQty !== '' && detailQty !== 0 && detailQty !== '0') {
    invoiceQtyDisplay = String(detailQty);
  }

  // 5. E-Way Bill numbers
  const ewaySet = [];
  const addTokens = (raw, target) => {
    String(raw ?? '')
      .split(',')
      .map((s) => s.trim())
      .filter(Boolean)
      .forEach((tok) => {
        if (!target.includes(tok)) target.push(tok);
      });
  };
  addTokens(shipment.ewayBillNumber, ewaySet);
  commList.forEach((i) => addTokens(i?.ewayBillNumber, ewaySet));

  // 6. AWB numbers
  const awbSet = [];
  addTokens(shipment.awbNumber, awbSet);
  commList.forEach((i) => addTokens(i?.awbNumber, awbSet));

  // 7. Freight & Charges
  const actualW = parseFloat(shipment.actualWeight || 0);
  const chargeW = parseFloat(shipment.chargeableWeight || actualW || 0);
  const packingC = parseFloat(shipment.packingCharges || 0);
  const laborC = parseFloat(shipment.laborCharges || 0);
  const pickupC = parseFloat(shipment.pickupCharges || 0);
  const deliveryC = parseFloat(shipment.deliveryCharges || 0);
  const godownC = parseFloat(shipment.godownCharges || 0);
  const otherC = parseFloat(shipment.otherCharges || 0);
  const rateVal = parseFloat(
    shipment.ratePerKg ||
      shipment.pricingValidation?.appliedRate ||
      shipment.billingSnapshot?.appliedRate ||
      0
  );

  let basicFreight = parseFloat(shipment.freightCharges || shipment.basicFreight || 0);
  if (!basicFreight && rateVal > 0 && chargeW > 0) {
    basicFreight = Math.round(rateVal * chargeW);
  }

  const subtotalBeforeGst = basicFreight + packingC + laborC + pickupC + deliveryC + godownC + otherC;
  const isGstExempt = Boolean(shipment.isGstExempt || shipment.gstRate === 0);
  const gstRate = isGstExempt ? 0 : shipment.gstRate ?? 18;
  const gstAmount = isGstExempt ? 0 : Math.round((subtotalBeforeGst * gstRate) / 100);
  const grandTotal = subtotalBeforeGst > 0 ? subtotalBeforeGst + gstAmount : 0;

  // 8. Modes
  const modeStr = String(shipment.mode || shipment.freightMode || '').toUpperCase();
  const isAirExpress = modeStr.includes('AIR EXPRESS');
  const isAir = modeStr.includes('AIR') && !isAirExpress;
  const isTrain = modeStr.includes('TRAIN');
  const isRoad = modeStr.includes('ROAD') || modeStr.includes('EXPRESS LTL') || modeStr.includes('LTL');
  const isFtl = modeStr.includes('FTL');

  return {
    cnNumber: shipment.cnNumber || shipment.cn_number || shipment.cnNo || 'SS2004',
    cnDetails: parseCnNumber(shipment),
    dateBoxes: formatDateBoxes(shipment.cnDate || shipment.bookingDate || shipment.createdAt),
    consignorPinBoxes: formatPinBoxes(shipment.consignor?.pin),
    consigneePinBoxes: formatPinBoxes(shipment.consignee?.pin),
    empCodeBoxes: formatEmpCodeBoxes(shipment.employeeCode),
    consignorName: String(shipment.consignor?.name || shipment.companyName || '').toUpperCase(),
    consignorCode: String(shipment.consignor?.code || shipment.companyCode || '').toUpperCase(),
    consignorGstin: String(shipment.consignor?.gstin || '').toUpperCase(),
    consigneeName: String(shipment.consignee?.name || '').toUpperCase(),
    consigneeCode: String(shipment.consignee?.code || '').toUpperCase(),
    consigneeGstin: String(shipment.consignee?.gstin || '').toUpperCase(),
    origin: String(shipment.origin || ''),
    originCode: String(shipment.originCode || ''),
    destination: String(shipment.destination || ''),
    destCode: String(shipment.destCode || ''),
    eximDestination: String(shipment.eximDestination || ''),
    eximCode: String(shipment.eximCode || ''),
    vehicleInfo: [shipment.operational?.vehicle, shipment.operational?.driver].filter(Boolean).join(' / '),
    doNumber: String(shipment.doNumber || shipment.dcpiNumber || ''),
    packages: shipment.packages !== undefined && shipment.packages !== null ? String(shipment.packages) : '',
    actualWeight: actualW ? String(actualW) : '',
    chargeableWeight: chargeW ? String(chargeW) : '',
    materialDescription: String(shipment.materialDescription || ''),
    invoiceNumbers,
    invoiceNumbersText: invoiceNumbers.join(', '),
    invoiceDates,
    invoiceDateText: invoiceDates.join(', '),
    invoiceValueNum,
    invoiceValueDisplay,
    invoiceQtyDisplay,
    ewayBills: ewaySet,
    ewayBillText: ewaySet.join(', '),
    awbNumbers: awbSet,
    awbText: awbSet.join(', '),
    rateVal,
    basicFreight,
    loadingCharge: laborC,
    unloadingCharge: deliveryC,
    slCharges: pickupC,
    otherChargesDisplay: packingC + godownC + otherC,
    gstAmount,
    grandTotal,
    remarks: String(shipment.remarks || ''),
    acknowledgementText: String(shipment.acknowledgementText || ''),
    modes: { isAirExpress, isAir, isTrain, isRoad, isFtl },
  };
}

/**
 * Resolves a dot-path field from shipment or normalized data for custom elements.
 */
export function resolveShipmentFieldValue(shipment = {}, data = {}, mappingPath = '') {
  if (!mappingPath) return '';
  if (mappingPath === 'invoiceNumbers') return data.invoiceNumbersText || '';
  if (mappingPath === 'invoiceDate') return data.invoiceDateText || '';
  if (mappingPath === 'invoiceValue') return data.invoiceValueDisplay || '';
  if (mappingPath === 'invoiceQuantity') return data.invoiceQtyDisplay || '';
  if (mappingPath === 'ewayBillNumber') return data.ewayBillText || '';
  if (mappingPath === 'awbNumber') return data.awbText || '';

  const parts = String(mappingPath).split('.');
  let cur = shipment;
  for (const p of parts) {
    if (cur === null || cur === undefined) {
      cur = undefined;
      break;
    }
    cur = cur[p];
  }
  if (cur !== undefined && cur !== null && cur !== '') {
    return String(cur);
  }
  return data[mappingPath] !== undefined ? String(data[mappingPath]) : '';
}

export function getPageDimensionsMm(pageConfig = {}, isSplit = false) {
  if (isSplit) {
    return {
      format: 'a4',
      orientation: 'portrait',
      widthMm: 210,
      heightMm: 297,
      marginTop: 3,
      marginRight: 3,
      marginBottom: 3,
      marginLeft: 3,
    };
  }

  const sizeMap = {
    A4: { w: 210, h: 297, format: 'a4' },
    A5: { w: 148, h: 210, format: 'a5' },
    Letter: { w: 215.9, h: 279.4, format: 'letter' },
    Legal: { w: 215.9, h: 355.6, format: 'legal' },
  };
  const preset = sizeMap[pageConfig.size] || sizeMap.A4;
  const orientation = pageConfig.orientation === 'portrait' ? 'portrait' : 'landscape';

  const widthMm = orientation === 'landscape' ? preset.h : preset.w;
  const heightMm = orientation === 'landscape' ? preset.w : preset.h;

  return {
    format: preset.format,
    orientation,
    widthMm,
    heightMm,
    marginTop: Number(pageConfig.marginTop ?? 3),
    marginRight: Number(pageConfig.marginRight ?? 3),
    marginBottom: Number(pageConfig.marginBottom ?? 3),
    marginLeft: Number(pageConfig.marginLeft ?? 3),
  };
}

/**
 * Pure deterministic layout engine for Consignment Notes.
 * Computes dynamic heights, invisible wrapped lines, column expansion, and footer shifts.
 */
export function computeCnLayout(rawTemplate, rawShipment) {
  const template = mergeWithDefaultTemplate(rawTemplate);
  const page = template.page;
  const data = extractCnData(rawShipment);

  const elMap = {};
  (template.elements || []).forEach((el) => {
    if (el && el.id) elMap[el.id] = el;
  });

  const frameLeft = 15;
  const frameTop = 15;
  const docWidth = Math.max(900, Number(page.docWidth) || 1400);
  const innerWidth = docWidth - frameLeft * 2;
  const frameRight = frameLeft + innerWidth;

  const fontFamily = page.fontFamily || 'Arial, "Helvetica Neue", Helvetica, sans-serif';
  const lineSpacing = Math.max(1.05, Number(page.lineSpacing) || 1.32);
  const defaultPadX = Number(page.cellPaddingX ?? 10);
  const defaultPadY = Number(page.cellPaddingY ?? 6);

  // 1. Header
  const headerHeight = Math.max(80, Number(page.headerHeight) || 125);
  const headerBottom = frameTop + headerHeight;

  // 2. Parties & CN Metadata Section
  const vehicleEl = elMap.vehicle_details;
  const vehicleVisible = Boolean(vehicleEl?.visible);
  const partiesHeight = vehicleVisible ? 226 : 210;
  const partiesBottom = headerBottom + partiesHeight;
  const rightColX = Math.max(750, docWidth - 460); // 940 on 1400 width
  const rightColWidth = frameRight - rightColX; // 445 on 1400 width

  // 3. Body Columns (Left Cargo/Invoices | Center Freight | Right Acknowledgement)
  const bodyTop = partiesBottom;
  const leftColWidth = Math.min(
    rightColX - frameLeft - 240,
    Math.max(320, Number(page.leftColWidth) || 455)
  );
  const centerColX = frameLeft + leftColWidth;
  const centerColWidth = rightColX - centerColX;

  // Compute Left Column Dynamic Flow Rows
  const leftFlowIds = [
    'do_number',
    'metrics_group',
    'goods_description',
    'invoice_numbers',
    'invoice_date',
    'invoice_value',
    'invoice_quantity',
    'eway_bill',
    'awb_number',
  ];

  // Collect custom rows inserted into left_table
  const leftCustomRows = (template.customElements || []).filter(
    (c) => c && c.visible !== false && c.type === 'table_row' && c.placement === 'left_table'
  );

  // Sortable flow items
  const pkgEl = elMap.package_count;
  const actEl = elMap.actual_weight;
  const chgEl = elMap.chargeable_weight;
  const metricsVisible = pkgEl?.visible !== false || actEl?.visible !== false || chgEl?.visible !== false;
  const metricsOrder = Math.min(pkgEl?.order ?? 2, actEl?.order ?? 3, chgEl?.order ?? 4);

  const flowItems = [
    { kind: 'standard', id: 'do_number', order: elMap.do_number?.order ?? 1 },
    { kind: 'metrics', id: 'metrics_group', order: metricsOrder },
    { kind: 'standard', id: 'goods_description', order: elMap.goods_description?.order ?? 5 },
    { kind: 'standard', id: 'invoice_numbers', order: elMap.invoice_numbers?.order ?? 6 },
    { kind: 'standard', id: 'invoice_date', order: elMap.invoice_date?.order ?? 7 },
    { kind: 'standard', id: 'invoice_value', order: elMap.invoice_value?.order ?? 8 },
    { kind: 'standard', id: 'invoice_quantity', order: elMap.invoice_quantity?.order ?? 9 },
    { kind: 'standard', id: 'eway_bill', order: elMap.eway_bill?.order ?? 10 },
    { kind: 'standard', id: 'awb_number', order: elMap.awb_number?.order ?? 11 },
    ...leftCustomRows.map((c, idx) => ({
      kind: 'custom_row',
      id: c.id,
      custom: c,
      order: c.order ?? 12 + idx,
    })),
  ].sort((a, b) => (a.order ?? 99) - (b.order ?? 99));

  let curY = bodyTop;
  const computedLeftRows = [];

  for (const item of flowItems) {
    if (item.kind === 'metrics') {
      if (!metricsVisible) continue;
      const mHeight = Math.max(
        48,
        Number(pkgEl?.height || 62),
        Number(actEl?.height || 62),
        Number(chgEl?.height || 62)
      );
      const visibleCols = [pkgEl, actEl, chgEl].filter((c) => c && c.visible !== false);
      const colW = leftColWidth / Math.max(1, visibleCols.length);
      computedLeftRows.push({
        kind: 'metrics',
        id: 'metrics_group',
        y: curY,
        height: mHeight,
        width: leftColWidth,
        cols: visibleCols.map((c, idx) => ({
          ...c,
          x: frameLeft + idx * colW,
          width: colW,
          value:
            c.id === 'package_count'
              ? data.packages
              : c.id === 'actual_weight'
              ? data.actualWeight
              : data.chargeableWeight,
        })),
      });
      curY += mHeight;
      continue;
    }

    if (item.kind === 'custom_row') {
      const c = item.custom;
      const padL = Number(c.paddingLeft ?? defaultPadX);
      const padR = Number(c.paddingRight ?? defaultPadX);
      const padT = Number(c.paddingTop ?? defaultPadY);
      const padB = Number(c.paddingBottom ?? defaultPadY);
      const labelFs = Number(c.fontSize ?? page.defaultFontSize ?? 13);
      const valFs = Number(c.valueFontSize ?? labelFs);
      const lh = valFs * lineSpacing;
      const valText = c.fieldMapping
        ? resolveShipmentFieldValue(rawShipment, data, c.fieldMapping)
        : String(c.defaultValue || '');
      const measuredLabelW = measureRenderedTextWidth(c.label || '', {
        fontSize: labelFs,
        fontWeight: c.fontWeight || '700',
        fontFamily,
      });
      const labelW = Math.min(leftColWidth * 0.48, Math.max(90, Number(c.labelWidth || measuredLabelW + 18)));
      const availW = leftColWidth - padL - labelW - padR;
      const lines = wrapProseByWidth(valText, availW, {
        fontSize: valFs,
        fontWeight: c.fontWeight || '600',
        fontFamily,
      });
      const contentH = padT + Math.max(1, lines.length) * lh + padB;
      const rowH = Math.max(Number(c.height) || 28, contentH);
      curY += Number(c.marginTop || 0);
      computedLeftRows.push({
        kind: 'custom_row',
        id: c.id,
        element: c,
        y: curY,
        height: rowH,
        width: leftColWidth,
        labelWidth: labelW,
        padL,
        padR,
        padT,
        padB,
        labelFs,
        valFs,
        lineHeight: lh,
        lines,
      });
      curY += rowH + Number(c.marginBottom || 0);
      continue;
    }

    const el = elMap[item.id];
    if (!el || el.visible === false) continue;

    const padL = Number(el.paddingLeft ?? defaultPadX);
    const padR = Number(el.paddingRight ?? defaultPadX);
    const padT = Number(el.paddingTop ?? defaultPadY);
    const padB = Number(el.paddingBottom ?? defaultPadY);
    const labelFs = Number(el.fontSize ?? page.defaultFontSize ?? 13);
    const valFs = Number(el.valueFontSize ?? labelFs);
    const lh = valFs * lineSpacing;
    const rowWidth = Math.min(leftColWidth, Number(el.width) || leftColWidth);

    curY += Number(el.marginTop || 0);

    if (item.id === 'goods_description') {
      const availW = rowWidth - padL - padR;
      const lines = wrapProseByWidth(data.materialDescription, availW, {
        fontSize: valFs,
        fontWeight: el.fontWeight || '600',
        fontFamily,
      });
      const headerLabelH = labelFs * 1.3 + 4;
      const contentH = padT + headerLabelH + Math.max(1, lines.length) * lh + padB;
      const rowH = Math.max(Number(el.height) || 52, contentH);

      computedLeftRows.push({
        kind: 'description',
        id: item.id,
        element: el,
        y: curY,
        height: rowH,
        width: rowWidth,
        padL,
        padR,
        padT,
        padB,
        labelFs,
        valFs,
        headerLabelH,
        lineHeight: lh,
        lines,
      });
      curY += rowH + Number(el.marginBottom || 0);
      continue;
    }

    if (item.id === 'do_number') {
      const measuredLabelW = measureRenderedTextWidth(el.label || '', {
        fontSize: labelFs,
        fontWeight: '700',
        fontFamily,
      });
      const labelW = Math.min(rowWidth * 0.48, measuredLabelW + 16);
      const availW = rowWidth - padL - labelW - padR;
      const lines = wrapProseByWidth(data.doNumber, availW, {
        fontSize: valFs,
        fontWeight: el.fontWeight || '600',
        fontFamily,
      });
      const contentH = padT + Math.max(1, lines.length) * lh + padB;
      const rowH = Math.max(Number(el.height) || 32, contentH);

      computedLeftRows.push({
        kind: 'key_value',
        id: item.id,
        element: el,
        y: curY,
        height: rowH,
        width: rowWidth,
        labelWidth: labelW,
        padL,
        padR,
        padT,
        padB,
        labelFs,
        valFs,
        lineHeight: lh,
        lines,
      });
      curY += rowH + Number(el.marginBottom || 0);
      continue;
    }

    // Invoice & Regulatory Rows (Invoice No., Dated, Invoice Value, Invoice Qty, E-Way Bill, AWB)
    const measuredLabelW = measureRenderedTextWidth(el.label || '', {
      fontSize: labelFs,
      fontWeight: '700',
      fontFamily,
    });
    const labelW = Math.min(
      rowWidth * 0.48,
      Math.max(Number(el.labelWidth) || 110, measuredLabelW + 16)
    );
    const availW = rowWidth - padL - labelW - padR;

    let lines = [];
    if (item.id === 'invoice_numbers') {
      lines = wrapTokensByWidth(
        data.invoiceNumbers,
        availW,
        { fontSize: valFs, fontWeight: el.fontWeight || '600', fontFamily },
        ', '
      );
    } else if (item.id === 'invoice_date') {
      lines = wrapTokensByWidth(
        data.invoiceDates,
        availW,
        { fontSize: valFs, fontWeight: el.fontWeight || '600', fontFamily },
        ', '
      );
    } else if (item.id === 'invoice_value') {
      lines = data.invoiceValueDisplay ? [data.invoiceValueDisplay] : [];
    } else if (item.id === 'invoice_quantity') {
      lines = wrapProseByWidth(data.invoiceQtyDisplay, availW, {
        fontSize: valFs,
        fontWeight: el.fontWeight || '600',
        fontFamily,
      });
    } else if (item.id === 'eway_bill') {
      lines = wrapTokensByWidth(
        data.ewayBills,
        availW,
        { fontSize: valFs, fontWeight: el.fontWeight || '600', fontFamily },
        ', '
      );
    } else if (item.id === 'awb_number') {
      lines = wrapTokensByWidth(
        data.awbNumbers,
        availW,
        { fontSize: valFs, fontWeight: el.fontWeight || '600', fontFamily },
        ', '
      );
    }

    const contentH = padT + Math.max(1, lines.length) * lh + padB;
    const rowH = Math.max(Number(el.height) || 28, contentH);

    computedLeftRows.push({
      kind: 'key_value',
      id: item.id,
      element: el,
      y: curY,
      height: rowH,
      width: rowWidth,
      labelWidth: labelW,
      padL,
      padR,
      padT,
      padB,
      labelFs,
      valFs,
      lineHeight: lh,
      lines,
    });
    curY += rowH + Number(el.marginBottom || 0);
  }

  const col1TotalHeight = curY - bodyTop;
  const freightDefaultHeight = 350;
  const bodyHeight = Math.max(freightDefaultHeight, col1TotalHeight);
  const bodyBottom = bodyTop + bodyHeight;

  // 4. Lower Middle Row: Consignor Signature & Remarks
  const remarksEl = elMap.remarks;
  const sigSealEl = elMap.signature_seal;
  const remarksPadL = Number(remarksEl?.paddingLeft ?? defaultPadX);
  const remarksPadR = Number(remarksEl?.paddingRight ?? defaultPadX);
  const remarksPadT = Number(remarksEl?.paddingTop ?? defaultPadY);
  const remarksPadB = Number(remarksEl?.paddingBottom ?? defaultPadY);
  const remarksFs = Number(remarksEl?.valueFontSize ?? 13.5);
  const remarksLh = remarksFs * lineSpacing;
  const remarksWidth = Number(remarksEl?.width) || 630;
  const remarksLines = wrapProseByWidth(data.remarks, Math.max(120, remarksWidth - remarksPadL - remarksPadR - 95), {
    fontSize: remarksFs,
    fontWeight: remarksEl?.fontWeight || '600',
    fontFamily,
  });
  const baseRemarksH = Math.max(Number(remarksEl?.height) || 72, Number(sigSealEl?.height) || 72);
  const remarksHeight = Math.max(
    baseRemarksH,
    remarksPadT + Math.max(1, remarksLines.length) * remarksLh + remarksPadB + 8
  );
  const remarksBottom = bodyBottom + remarksHeight;

  // 5. Right Column (Acknowledgement + CENVAT) aligns cleanly to remarksBottom
  const ackEl = elMap.acknowledgement;
  const cenvatMinH = 142;
  const totalRightBodyH = remarksBottom - bodyTop;
  const ackHeight = Math.max(
    Math.min(Number(ackEl?.height) || 280, totalRightBodyH - cenvatMinH),
    totalRightBodyH - cenvatMinH
  );
  const cenvatTop = bodyTop + ackHeight;
  const cenvatHeight = remarksBottom - cenvatTop;

  // 6. Footer (Legal & Speed Setu Signature)
  const footerTop = remarksBottom;
  const footerHeight = Math.max(150, Number(page.footerHeight) || 193);
  const frameBottom = footerTop + footerHeight;
  const totalDocHeight = Math.max(Number(page.docHeight) || 980, frameBottom + frameTop);

  // Determine if content significantly exceeds 1 standard page aspect ratio
  const baseAspect = (Number(page.docHeight) || 980) / docWidth;
  const actualAspect = totalDocHeight / docWidth;
  const isOverflowing = actualAspect > baseAspect * 1.38;

  const footerDeltaY = footerTop - 772;
  const bodyBottomDeltaY = bodyBottom - 700;

  return {
    template,
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
    isOverflowing,
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
    footerHeight,
    footerDeltaY,
    bodyBottomDeltaY,
  };
}
