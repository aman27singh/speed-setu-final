const mongoose = require('mongoose');
const Invoice = require('../models/Invoice');
const BilledDocket = require('../models/BilledDocket');
const Shipment = require('../models/Shipment');

function escapeRegExp(string) {
  return string.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

/**
 * Synchronize all active invoices into the BilledDocket collection
 * to ensure database-level uniqueness enforcement is active across all records.
 */
async function syncBilledDockets() {
  try {
    const activeInvoices = await Invoice.find({
      status: { $nin: ['Cancelled', 'Void'] }
    });

    const bulkOps = [];
    for (const inv of activeInvoices) {
      const invNum = (inv.invoiceNumber || '').trim();
      if (!invNum) continue;

      const dockets = [
        ...(inv.cns || []),
        ...(inv.shipmentIds || []),
        ...(inv.dockets || []).map(d => d.docketNo || d.cnNumber)
      ].filter(Boolean);

      const uniqueDockets = Array.from(new Set(dockets.map(d => String(d).trim())));

      for (const d of uniqueDockets) {
        if (!d) continue;
        bulkOps.push({
          updateOne: {
            filter: { docketNoNormalized: d.toLowerCase() },
            update: {
              $set: {
                docketNo: d,
                docketNoNormalized: d.toLowerCase(),
                invoiceNumber: invNum,
                invoiceNumberNormalized: invNum.toLowerCase(),
                invoiceId: inv._id,
                status: 'Active'
              }
            },
            upsert: true
          }
        });
      }
    }

    if (bulkOps.length > 0) {
      await BilledDocket.bulkWrite(bulkOps, { ordered: false }).catch(err => {
        // Ignore duplicate key errors if historical data has overlapping dockets
        if (!err.message.includes('E11000')) {
          console.warn('[BilledDocket Sync Notice]:', err.message);
        }
      });
      console.log(`[BilledDocket] Initialized and synced active dockets index.`);
    }
  } catch (err) {
    console.warn('[BilledDocket Sync Warning]:', err.message);
  }
}

/**
 * Validate duplicate Invoice Number and Docket Numbers
 * Supports excluding the current invoice when editing.
 */
async function validateDuplicates({
  currentInvoiceId = null,
  currentInvoiceNumber = null,
  invoiceNumber = '',
  dockets = []
}) {
  let invoiceNumberError = null;
  let conflictingInvoice = null;
  const docketErrors = [];

  // Determine current invoice identifiers for exclusion
  let excludeId = null;
  let excludeInvNum = (currentInvoiceNumber || '').trim().toLowerCase();

  if (currentInvoiceId) {
    if (mongoose.isValidObjectId(currentInvoiceId)) {
      excludeId = currentInvoiceId;
    } else if (!excludeInvNum) {
      excludeInvNum = currentInvoiceId.trim().toLowerCase();
    }
  }

  // If excludeId is not an ObjectId yet, look up invoice by invoiceNumber to get its _id
  if (!excludeId && excludeInvNum) {
    const existingInv = await Invoice.findOne({
      $or: [
        { invoiceNumber: new RegExp(`^${escapeRegExp(excludeInvNum)}$`, 'i') },
        { invoiceNumberNormalized: excludeInvNum }
      ]
    });
    if (existingInv) {
      excludeId = existingInv._id;
      excludeInvNum = existingInv.invoiceNumber.trim().toLowerCase();
    }
  } else if (excludeId && !excludeInvNum) {
    const existingInv = await Invoice.findById(excludeId);
    if (existingInv) {
      excludeInvNum = (existingInv.invoiceNumber || '').trim().toLowerCase();
    }
  }

  // ================= 1. INVOICE NUMBER DUPLICATE VALIDATION =================
  const trimmedInvNum = (invoiceNumber || '').trim();
  if (trimmedInvNum) {
    const query = {
      $or: [
        { invoiceNumber: new RegExp(`^${escapeRegExp(trimmedInvNum)}$`, 'i') },
        { invoiceNumberNormalized: trimmedInvNum.toLowerCase() }
      ]
    };

    if (excludeId) {
      query._id = { $ne: excludeId };
    }

    const conflicting = await Invoice.findOne(query);

    // If found, ensure it is not the current invoice being edited
    if (conflicting) {
      const conflictingNum = (conflicting.invoiceNumber || '').trim().toLowerCase();
      if (!excludeInvNum || conflictingNum !== excludeInvNum) {
        invoiceNumberError = 'This invoice number already exists. Please enter a unique invoice number.';
        conflictingInvoice = conflicting.invoiceNumber;
      }
    }
  }

  // ================= 2. DOCKET NUMBERS DUPLICATE VALIDATION =================
  const seenInternalDockets = new Map();

  for (let idx = 0; idx < dockets.length; idx++) {
    const docketItem = dockets[idx];
    const rawDocketNo = typeof docketItem === 'string'
      ? docketItem.trim()
      : (docketItem?.docketNo || docketItem?.cnNumber || '').trim();

    if (!rawDocketNo) continue;
    const normalizedDocket = rawDocketNo.toLowerCase();

    // Check A: Internal Duplicate within this invoice form
    if (seenInternalDockets.has(normalizedDocket)) {
      const firstSeenIndex = seenInternalDockets.get(normalizedDocket);
      docketErrors.push({
        index: idx,
        row: idx + 1,
        docketNo: rawDocketNo,
        error: `Duplicate docket number in this invoice (row ${firstSeenIndex + 1} and row ${idx + 1}).`,
        conflictingInvoice: 'This Invoice',
        type: 'internal_duplicate',
        firstSeenIndex
      });
      continue; // Skip external query since internal duplicate is already caught
    }
    seenInternalDockets.set(normalizedDocket, idx);

    // Check B: External Duplicate against other active invoices in BilledDocket
    let externalConflict = await BilledDocket.findOne({
      docketNoNormalized: normalizedDocket,
      status: 'Active',
      ...(excludeInvNum ? { invoiceNumberNormalized: { $ne: excludeInvNum } } : {}),
      ...(excludeId ? { invoiceId: { $ne: excludeId } } : {})
    });

    // Fallback Check against Invoice collection directly if BilledDocket was not yet synced
    if (!externalConflict) {
      const invQuery = {
        $or: [
          { 'dockets.docketNo': new RegExp(`^${escapeRegExp(rawDocketNo)}$`, 'i') },
          { cns: new RegExp(`^${escapeRegExp(rawDocketNo)}$`, 'i') },
          { shipmentIds: new RegExp(`^${escapeRegExp(rawDocketNo)}$`, 'i') }
        ],
        status: { $nin: ['Cancelled', 'Void'] }
      };

      if (excludeId) invQuery._id = { $ne: excludeId };
      if (excludeInvNum) {
        invQuery.invoiceNumber = { $not: new RegExp(`^${escapeRegExp(excludeInvNum)}$`, 'i') };
      }

      const invConflict = await Invoice.findOne(invQuery);
      if (invConflict) {
        externalConflict = {
          invoiceNumber: invConflict.invoiceNumber,
          invoiceId: invConflict._id
        };
      }
    }

    if (externalConflict) {
      const conflictingNum = externalConflict.invoiceNumber || 'another invoice';
      // Do not flag if it actually belongs to the current invoice
      const isCurrentInvoice = (excludeInvNum && conflictingNum.toLowerCase() === excludeInvNum) ||
                               (excludeId && externalConflict.invoiceId && externalConflict.invoiceId.toString() === excludeId.toString());
      if (!isCurrentInvoice) {
        docketErrors.push({
          index: idx,
          row: idx + 1,
          docketNo: rawDocketNo,
          error: `This docket number has already been billed in invoice ${conflictingNum}.`,
          conflictingInvoice: conflictingNum,
          type: 'external_duplicate'
        });
      }
    }
  }

  const isValid = !invoiceNumberError && docketErrors.length === 0;

  return {
    isValid,
    invoiceNumberError,
    conflictingInvoice,
    docketErrors
  };
}

/**
 * Atomically claim dockets for an invoice in the BilledDocket collection
 * and update corresponding Shipments billingStatus.
 */
async function claimDocketsForInvoice({
  invoiceNumber,
  invoiceId,
  dockets = [],
  status = 'Active'
}) {
  const invNum = (invoiceNumber || '').trim();
  const invNumNorm = invNum.toLowerCase();

  const docketStrings = dockets
    .map(d => (typeof d === 'string' ? d : (d?.docketNo || d?.cnNumber || '')))
    .map(s => s.trim())
    .filter(Boolean);

  const uniqueDockets = Array.from(new Set(docketStrings));
  const uniqueNormalized = uniqueDockets.map(d => d.toLowerCase());

  if (status === 'Cancelled') {
    // Release all dockets for this invoice
    await BilledDocket.deleteMany({
      $or: [
        { invoiceNumberNormalized: invNumNorm },
        ...(invoiceId ? [{ invoiceId }] : [])
      ]
    });

    if (uniqueDockets.length > 0) {
      await Shipment.updateMany(
        {
          $or: [
            { cnNumber: { $in: uniqueDockets } },
            { invoiceId: invNum }
          ]
        },
        { $set: { billingStatus: 'Ready', invoiceId: '' } }
      );
    }
    return;
  }

  // Remove any dockets that were previously on this invoice but were deleted in this edit
  if (invoiceId) {
    await BilledDocket.deleteMany({
      invoiceId,
      docketNoNormalized: { $nin: uniqueNormalized }
    });
  } else {
    await BilledDocket.deleteMany({
      invoiceNumberNormalized: invNumNorm,
      docketNoNormalized: { $nin: uniqueNormalized }
    });
  }

  // Claim all current dockets
  for (const d of uniqueDockets) {
    const dNorm = d.toLowerCase();
    try {
      await BilledDocket.findOneAndUpdate(
        { docketNoNormalized: dNorm },
        {
          $set: {
            docketNo: d,
            docketNoNormalized: dNorm,
            invoiceNumber: invNum,
            invoiceNumberNormalized: invNumNorm,
            invoiceId,
            status: 'Active'
          }
        },
        { upsert: true, new: true, runValidators: true }
      );
    } catch (err) {
      // Catch MongoDB duplicate key error if race condition or concurrent write occurred
      if (err.code === 11000 || err.message.includes('E11000')) {
        const owner = await BilledDocket.findOne({ docketNoNormalized: dNorm, status: 'Active' });
        const ownerInv = owner ? owner.invoiceNumber : 'another invoice';
        const conflictErr = new Error(`This docket number has already been used in invoice ${ownerInv}.`);
        conflictErr.statusCode = 409;
        conflictErr.conflictingInvoice = ownerInv;
        conflictErr.docketNo = d;
        throw conflictErr;
      }
      throw err;
    }
  }

  // Update Shipment status for newly claimed dockets
  if (uniqueDockets.length > 0) {
    await Shipment.updateMany(
      { cnNumber: { $in: uniqueDockets } },
      { $set: { billingStatus: 'Invoiced', invoiceId: invNum } }
    );
  }
}

/**
 * Release all dockets for an invoice upon deletion
 */
async function releaseDocketsForInvoice({ invoiceNumber, invoiceId }) {
  const invNum = (invoiceNumber || '').trim();
  const invNumNorm = invNum.toLowerCase();

  const existingDockets = await BilledDocket.find({
    $or: [
      { invoiceNumberNormalized: invNumNorm },
      ...(invoiceId ? [{ invoiceId }] : [])
    ]
  });

  const cnList = existingDockets.map(d => d.docketNo);

  await BilledDocket.deleteMany({
    $or: [
      { invoiceNumberNormalized: invNumNorm },
      ...(invoiceId ? [{ invoiceId }] : [])
    ]
  });

  if (cnList.length > 0) {
    await Shipment.updateMany(
      { cnNumber: { $in: cnList } },
      { $set: { billingStatus: 'Ready', invoiceId: '' } }
    );
  }
}

module.exports = {
  syncBilledDockets,
  validateDuplicates,
  claimDocketsForInvoice,
  releaseDocketsForInvoice
};
