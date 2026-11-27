const ExcelJS = require('exceljs');
const mongoose = require('mongoose');

// Exact 33 headers (A to AG) matching SPEEDSETU_MIS.xlsx reference (including trailing spaces)
const EXPORT_HEADERS = [
  'DOCKET NO',
  'DOCKET DATE',
  'CONSIGNOR',
  'CONSIGNEE',
  'BILL TO ',
  'ORIGIN',
  'DESTINATION',
  'INVOICE NUMBER',
  'INVOICE VALUE',
  'DIMENSION WEIGHT',
  'NO. BOX-PKT',
  'ACTUAL WEIGHT',
  'CHARGEABLE WEIGHT',
  'MODE',
  'DELIVERY DATE',
  'POD STATUS',
  'REMARKS',
  'RATE',
  'DOCKET CHARGES',
  'PICKUP CHARGES',
  'DELIVERY CHARGES',
  'GREEN TAX/TSP',
  'OTHER CHARGES',
  'DRIVER NAME',
  'TSP',
  'PRICE',
  'BILL NO.',
  'GST',
  'AMOUNT',
  'FLIGHT ',
  'VENDOR NAME',
  'FLIGHT NUMBER - TRAIN NUMBER',
  'AWB'
];

// 1-indexed columns that must always remain text (preserving IDs, leading zeros, multi-invoice strings)
const TEXT_CODE_COLUMN_INDEXES = new Set([1, 8, 27, 32, 33]);

/**
 * Return the first defined, non-null, non-empty-string value.
 * Zero (0) and boolean false are treated as present values and preserved as-is.
 */
function firstDefined(...values) {
  for (const val of values) {
    if (val !== undefined && val !== null && val !== '') {
      return val;
    }
  }
  return null;
}

/**
 * Return raw string without trimming or changing case; null for null/undefined/''.
 */
function toRawText(val) {
  if (val === undefined || val === null || val === '') return null;
  return String(val);
}

/**
 * Return numeric values untouched or non-empty strings untouched; null for null/undefined/''.
 */
function toRawNumberOrText(val) {
  if (val === undefined || val === null || val === '') return null;
  if (typeof val === 'number') {
    return Number.isFinite(val) ? val : null;
  }
  return val;
}

/**
 * Convert stored date string or Date into a real Excel Date (UTC midnight) without timezone shift.
 * If stored value is not a valid calendar date, return raw text as stored.
 */
function parseStoredDateToExcelDate(val) {
  if (val === undefined || val === null || val === '') return null;

  if (val instanceof Date) {
    if (isNaN(val.getTime())) return null;
    return new Date(Date.UTC(val.getUTCFullYear(), val.getUTCMonth(), val.getUTCDate(), 0, 0, 0));
  }

  const str = String(val);

  // ISO format YYYY-MM-DD (or YYYY-MM-DDTHH:mm:ss...)
  const isoMatch = str.match(/^(\d{4})-(\d{2})-(\d{2})(?:$|T|\s)/);
  if (isoMatch) {
    const y = parseInt(isoMatch[1], 10);
    const m = parseInt(isoMatch[2], 10);
    const d = parseInt(isoMatch[3], 10);
    const dt = new Date(Date.UTC(y, m - 1, d, 0, 0, 0));
    if (dt.getUTCFullYear() === y && dt.getUTCMonth() === m - 1 && dt.getUTCDate() === d) {
      return dt;
    }
    return str;
  }

  // DD/MM/YYYY or DD-MM-YYYY
  const dmyMatch = str.match(/^(\d{1,2})[/-](\d{1,2})[/-](\d{4})$/);
  if (dmyMatch) {
    const d = parseInt(dmyMatch[1], 10);
    const m = parseInt(dmyMatch[2], 10);
    const y = parseInt(dmyMatch[3], 10);
    const dt = new Date(Date.UTC(y, m - 1, d, 0, 0, 0));
    if (dt.getUTCFullYear() === y && dt.getUTCMonth() === m - 1 && dt.getUTCDate() === d) {
      return dt;
    }
    return str;
  }

  // Unrecognized / non-date text (e.g. "`", "Pending"): preserve raw text untouched
  return str;
}

/**
 * Map a raw Shipment document from MongoDB strictly to the 33-column array (A to AG)
 * with zero tampering, zero normalization, and zero default-filling.
 */
function mapShipmentToExportRow(s) {
  const pv = s?.pricingValidation;
  const snap = pv?.pricingSnapshot;
  const calc = snap?.calculatedCharges;

  return [
    toRawText(s?.cnNumber),                                                              // A: DOCKET NO
    parseStoredDateToExcelDate(firstDefined(s?.cnDate, s?.bookingDate)),                 // B: DOCKET DATE
    toRawText(firstDefined(s?.consignor?.name, s?.shipper?.name)),                       // C: CONSIGNOR
    toRawText(s?.consignee?.name),                                                       // D: CONSIGNEE
    toRawText(s?.companyName),                                                           // E: BILL TO 
    toRawText(s?.origin),                                                                // F: ORIGIN
    toRawText(s?.destination),                                                           // G: DESTINATION
    toRawText(s?.invoiceDetails?.invoiceNumber),                                         // H: INVOICE NUMBER
    toRawNumberOrText(s?.invoiceDetails?.invoiceValue),                                  // I: INVOICE VALUE
    toRawNumberOrText(s?.volumetricWeight),                                              // J: DIMENSION WEIGHT
    toRawNumberOrText(s?.packages),                                                      // K: NO. BOX-PKT
    toRawNumberOrText(s?.actualWeight),                                                  // L: ACTUAL WEIGHT
    toRawNumberOrText(s?.chargeableWeight),                                              // M: CHARGEABLE WEIGHT
    toRawText(firstDefined(s?.mode, s?.freightMode)),                                    // N: MODE
    parseStoredDateToExcelDate(firstDefined(s?.deliveryDate, s?.operational?.actualDeliveryDate)), // O: DELIVERY DATE
    toRawText(s?.podStatus),                                                             // P: POD STATUS
    toRawText(s?.remarks),                                                               // Q: REMARKS
    toRawNumberOrText(firstDefined(s?.rate, s?.baseFreightRate, s?.ratePerKg, pv?.appliedRate)), // R: RATE
    toRawNumberOrText(firstDefined(s?.docketCharges, snap?.docketCharges)),              // S: DOCKET CHARGES
    toRawNumberOrText(firstDefined(s?.pickupCharges, snap?.pickupCharges)),              // T: PICKUP CHARGES
    toRawNumberOrText(firstDefined(s?.deliveryCharges, snap?.deliveryCharges)),          // U: DELIVERY CHARGES
    null,                                                                                // V: GREEN TAX/TSP (no stored field)
    toRawNumberOrText(firstDefined(s?.otherCharges, snap?.otherCharges)),                // W: OTHER CHARGES
    toRawText(s?.operational?.driver),                                                   // X: DRIVER NAME
    null,                                                                                // Y: TSP (no stored field)
    toRawNumberOrText(calc?.freightAmount),                                              // Z: PRICE
    toRawText(s?.invoiceId),                                                             // AA: BILL NO.
    toRawNumberOrText(calc?.gstAmount),                                                  // AB: GST
    toRawNumberOrText(calc?.grandTotal),                                                 // AC: AMOUNT
    null,                                                                                // AD: FLIGHT  (no stored field)
    toRawText(s?.operational?.transporter),                                              // AE: VENDOR NAME
    toRawText(s?.operational?.vehicle),                                                  // AF: FLIGHT NUMBER - TRAIN NUMBER
    toRawText(s?.awbNumber)                                                              // AG: AWB
  ];
}

/**
 * Append a single shipment row to an ExcelJS worksheet cleanly, leaving null cells truly empty
 * and preserving exact date formats and text/number types.
 */
function appendShipmentRow(worksheet, shipment) {
  const rowValues = mapShipmentToExportRow(shipment);
  const excelRow = worksheet.addRow([]);

  for (let i = 0; i < EXPORT_HEADERS.length; i += 1) {
    const colIdx = i + 1;
    const val = rowValues[i];
    if (val === null || val === undefined || val === '') {
      continue;
    }

    const cell = excelRow.getCell(colIdx);
    cell.value = val;

    if (val instanceof Date) {
      if (colIdx === 2) {
        cell.numFmt = 'd"-"m"-"yyyy';
      } else if (colIdx === 15) {
        cell.numFmt = 'dd/MM/yyyy';
      }
    } else if (TEXT_CODE_COLUMN_INDEXES.has(colIdx)) {
      cell.numFmt = '@';
    }
  }
}

/**
 * Initialize workbook in the exact SPEEDSETU_MIS.xlsx reference layout:
 * - Single sheet named Sheet1
 * - Row 1 bold, centered, fill #8EA9DB
 * - No merged cells, no frozen panes
 */
function createExportWorkbook() {
  const workbook = new ExcelJS.Workbook();
  const worksheet = workbook.addWorksheet('Sheet1', {
    views: []
  });

  const headerRow = worksheet.addRow(EXPORT_HEADERS);
  headerRow.eachCell({ includeEmpty: false }, (cell) => {
    cell.font = { bold: true };
    cell.alignment = { horizontal: 'center', vertical: 'middle' };
    cell.fill = {
      type: 'pattern',
      pattern: 'solid',
      fgColor: { argb: 'FF8EA9DB' }
    };
  });

  return { workbook, worksheet };
}

/**
 * Build an .xlsx Buffer from either an async cursor/iterable or an array of raw Shipment docs.
 */
async function buildShipmentsExportBuffer(shipmentSource) {
  const { workbook, worksheet } = createExportWorkbook();

  if (Array.isArray(shipmentSource)) {
    for (const s of shipmentSource) {
      appendShipmentRow(worksheet, s);
    }
  } else if (shipmentSource && typeof shipmentSource[Symbol.asyncIterator] === 'function') {
    for await (const s of shipmentSource) {
      appendShipmentRow(worksheet, s);
    }
  }

  return workbook.xlsx.writeBuffer();
}

/**
 * Build MongoDB aggregation pipeline matching listing filters and DB sort order.
 */
function buildShipmentExportPipeline(queryParams = {}, driverUser = null) {
  const {
    scope = 'all',
    search,
    status,
    companyId,
    company,
    route,
    origin,
    destination,
    package: pkgParam,
    weight,
    date,
    startDate,
    endDate,
    pricingStatus,
    ids
  } = queryParams;

  const isExportAll = String(scope || 'all').trim().toLowerCase() === 'all';
  const andConditions = [];

  // Role scoping for Driver / Fleet Manager accounts
  if (driverUser) {
    const rawRole = String(driverUser.role || '').trim().toLowerCase();
    const isDriverRole =
      rawRole === 'driver' ||
      rawRole === 'fleet manager' ||
      rawRole === 'fleet_manager' ||
      String(driverUser.username || '').toLowerCase() === 'driver' ||
      String(driverUser.email || '').toLowerCase().includes('driver');

    if (isDriverRole) {
      const driverIdentifiers = [
        driverUser._id ? driverUser._id.toString() : null,
        driverUser.id ? String(driverUser.id) : null,
        driverUser.username,
        driverUser.email,
        driverUser.driverId,
        driverUser.name
      ]
        .filter(Boolean)
        .map((val) => String(val).trim());

      const driverOr = [];
      for (const ident of driverIdentifiers) {
        const escIdent = ident.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
        driverOr.push(
          { createdBy: new RegExp(`^${escIdent}$`, 'i') },
          { driverId: new RegExp(`^${escIdent}$`, 'i') },
          { createdByName: new RegExp(`^${escIdent}$`, 'i') },
          { 'operational.driver': new RegExp(`^${escIdent}$`, 'i') }
        );
      }
      if (driverOr.length > 0) {
        andConditions.push({ $or: driverOr });
      }
    }
  }

  if (!isExportAll) {
    // Explicit selected row IDs (ticked checkboxes)
    if (ids && String(ids).trim()) {
      const idTokens = String(ids)
        .split(',')
        .map((t) => t.trim())
        .filter(Boolean);

      if (idTokens.length > 0) {
        const objIds = [];
        const stringTokens = [];
        for (const tok of idTokens) {
          if (mongoose.isValidObjectId(tok)) {
            objIds.push(new mongoose.Types.ObjectId(tok));
          }
          stringTokens.push(tok);
        }
        andConditions.push({
          $or: [
            ...(objIds.length > 0 ? [{ _id: { $in: objIds } }] : []),
            { id: { $in: stringTokens } },
            { cnNumber: { $in: stringTokens } }
          ]
        });
      }
    } else {
      if (pricingStatus && pricingStatus !== 'All') {
        if (pricingStatus === 'Quotation' || pricingStatus === 'QUOTATION') {
          andConditions.push({ 'pricingValidation.status': 'MATCHED', 'pricingValidation.source': 'QUOTATION' });
        } else if (pricingStatus === 'RateCard' || pricingStatus === 'RATE_CARD') {
          andConditions.push({ 'pricingValidation.status': 'MATCHED', 'pricingValidation.source': 'RATE_CARD' });
        } else if (pricingStatus === 'NoQuotation' || pricingStatus === 'Missing' || pricingStatus === 'MISSING') {
          andConditions.push({
            $or: [
              { 'pricingValidation.status': 'MISSING' },
              { 'pricingValidation.source': 'NONE' },
              { pricingValidation: null },
              { pricingValidation: { $exists: false } }
            ]
          });
        }
      }

      if (status && status !== 'All') {
        if (status === 'Booked') {
          andConditions.push({ status: { $ne: 'Delivered' } });
        } else {
          andConditions.push({ status });
        }
      }

      if (search && String(search).trim()) {
        const q = String(search).trim();
        const escaped = q.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
        andConditions.push({
          $or: [
            { cnNumber: { $regex: escaped, $options: 'i' } },
            { companyName: { $regex: escaped, $options: 'i' } },
            { companyCode: { $regex: escaped, $options: 'i' } },
            { origin: { $regex: escaped, $options: 'i' } },
            { destination: { $regex: escaped, $options: 'i' } },
            { ewayBillNumber: { $regex: escaped, $options: 'i' } },
            { awbNumber: { $regex: escaped, $options: 'i' } },
            { 'consignor.name': { $regex: escaped, $options: 'i' } },
            { 'consignor.companyName': { $regex: escaped, $options: 'i' } },
            { 'consignor.companyCode': { $regex: escaped, $options: 'i' } },
            { consignorName: { $regex: escaped, $options: 'i' } },
            { 'consignee.name': { $regex: escaped, $options: 'i' } },
            { 'consignee.companyName': { $regex: escaped, $options: 'i' } },
            { 'consignee.companyCode': { $regex: escaped, $options: 'i' } },
            { consigneeName: { $regex: escaped, $options: 'i' } },
            { 'invoiceDetails.invoiceNumber': { $regex: escaped, $options: 'i' } },
            { 'commercialInvoices.invoiceNumber': { $regex: escaped, $options: 'i' } },
            { 'commercialInvoices.ewayBillNumber': { $regex: escaped, $options: 'i' } },
            { 'commercialInvoices.awbNumber': { $regex: escaped, $options: 'i' } }
          ]
        });
      }

      const targetComp = String(companyId || company || '').trim();
      if (targetComp && targetComp !== 'All') {
        const escapedComp = targetComp.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
        andConditions.push({
          $or: [
            { companyId: targetComp },
            { companyCode: targetComp },
            { companyName: { $regex: `^\\s*${escapedComp}\\s*$`, $options: 'i' } }
          ]
        });
      }

      if (route && route !== 'All') {
        const parts = route.includes('→') ? route.split('→') : route.split('|');
        if (parts.length === 2) {
          const orig = parts[0].trim();
          const dest = parts[1].trim();
          const cond = {};
          if (orig && orig !== 'ANY') cond.origin = { $regex: `^${orig.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}$`, $options: 'i' };
          if (dest && dest !== 'ANY') cond.destination = { $regex: `^${dest.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}$`, $options: 'i' };
          if (Object.keys(cond).length > 0) andConditions.push(cond);
        }
      }
      if (origin && origin !== 'All') {
        andConditions.push({ origin: { $regex: `^${String(origin).trim().replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}$`, $options: 'i' } });
      }
      if (destination && destination !== 'All') {
        andConditions.push({ destination: { $regex: `^${String(destination).trim().replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}$`, $options: 'i' } });
      }

      if (pkgParam && pkgParam !== 'All') {
        const pkg = String(pkgParam).trim();
        const num = parseInt(pkg, 10);
        if (!isNaN(num)) {
          andConditions.push({
            $or: [
              { packages: num },
              { packages: pkg },
              { packages: `0${pkg}` },
              { $expr: { $eq: [{ $toDouble: { $toString: { $ifNull: ['$packages', 0] } } }, num] } }
            ]
          });
        } else if (pkg === '6-10') {
          andConditions.push({
            $expr: {
              $and: [
                { $gte: [{ $toDouble: { $toString: { $ifNull: ['$packages', 0] } } }, 6] },
                { $lte: [{ $toDouble: { $toString: { $ifNull: ['$packages', 0] } } }, 10] }
              ]
            }
          });
        } else if (pkg === '11-25') {
          andConditions.push({
            $expr: {
              $and: [
                { $gte: [{ $toDouble: { $toString: { $ifNull: ['$packages', 0] } } }, 11] },
                { $lte: [{ $toDouble: { $toString: { $ifNull: ['$packages', 0] } } }, 25] }
              ]
            }
          });
        } else if (pkg === '26+' || pkg === '>25') {
          andConditions.push({
            $expr: {
              $gte: [{ $toDouble: { $toString: { $ifNull: ['$packages', 0] } } }, 26]
            }
          });
        }
      }

      if (weight && weight !== 'All') {
        const wVal = String(weight).trim().toLowerCase();
        if (wVal === 'zero' || wVal === '0') {
          andConditions.push({
            $and: [
              { $or: [{ actualWeight: 0 }, { actualWeight: null }, { actualWeight: { $exists: false } }] },
              { $or: [{ chargeableWeight: 0 }, { chargeableWeight: null }, { chargeableWeight: { $exists: false } }] }
            ]
          });
        } else if (wVal === 'greater_than_0' || wVal === '>0') {
          andConditions.push({
            $or: [
              { actualWeight: { $gt: 0 } },
              { chargeableWeight: { $gt: 0 } }
            ]
          });
        }
      }

      const dateParam = String(date || '').trim();
      const startDateParam = String(startDate || '').trim();
      const endDateParam = String(endDate || '').trim();

      if (dateParam) {
        const startUtc = new Date(`${dateParam}T00:00:00.000+05:30`);
        const endUtc = new Date(`${dateParam}T23:59:59.999+05:30`);
        if (!isNaN(startUtc.getTime()) && !isNaN(endUtc.getTime())) {
          andConditions.push({
            $or: [
              { createdAt: { $gte: startUtc, $lte: endUtc } },
              { createdAt: { $gte: startUtc.toISOString(), $lte: endUtc.toISOString() } }
            ]
          });
        }
      } else if (startDateParam && endDateParam) {
        const startUtc = new Date(`${startDateParam}T00:00:00.000+05:30`);
        const endUtc = new Date(`${endDateParam}T23:59:59.999+05:30`);
        if (!isNaN(startUtc.getTime()) && !isNaN(endUtc.getTime())) {
          andConditions.push({
            $or: [
              { createdAt: { $gte: startUtc, $lte: endUtc } },
              { createdAt: { $gte: startUtc.toISOString(), $lte: endUtc.toISOString() } }
            ]
          });
        }
      }
    }
  }

  const query = andConditions.length > 0 ? { $and: andConditions } : {};
  const pipeline = [];
  if (Object.keys(query).length > 0) {
    pipeline.push({ $match: query });
  }
  pipeline.push(
    {
      $addFields: {
        sortDate: {
          $let: {
            vars: {
              rawDate: { $ifNull: ['$cnDate', { $ifNull: ['$bookingDate', null] }] }
            },
            in: {
              $cond: [
                { $and: [{ $ne: ['$$rawDate', null] }, { $ne: ['$$rawDate', ''] }] },
                { $substrBytes: [{ $toString: '$$rawDate' }, 0, 10] },
                {
                  $dateToString: {
                    date: { $ifNull: ['$createdAt', new Date(0)] },
                    format: '%Y-%m-%d',
                    timezone: 'Asia/Kolkata'
                  }
                }
              ]
            }
          }
        },
        cnDigits: {
          $regexFind: {
            input: { $toString: { $ifNull: ['$cnNumber', '0'] } },
            regex: '[0-9]+'
          }
        }
      }
    },
    {
      $addFields: {
        cnNum: {
          $convert: {
            input: '$cnDigits.match',
            to: 'long',
            onError: 0,
            onNull: 0
          }
        }
      }
    },
    {
      $sort: {
        sortDate: -1,
        cnNum: -1,
        cnNumber: -1
      }
    },
    {
      $unset: ['sortDate', 'cnDigits', 'cnNum']
    }
  );

  return pipeline;
}

module.exports = {
  EXPORT_HEADERS,
  firstDefined,
  toRawText,
  toRawNumberOrText,
  parseStoredDateToExcelDate,
  mapShipmentToExportRow,
  createExportWorkbook,
  appendShipmentRow,
  buildShipmentsExportBuffer,
  buildShipmentExportPipeline
};
