const mongoose = require('mongoose');
const Counter = require('../models/Counter');
const Shipment = require('../models/Shipment');

/**
 * Speed Setu - Centralized Atomic CN Sequence Service
 * 
 * Guarantees monotonic, collision-free, database-backed sequential CN generation.
 * Operates independently on the currently active database (speed_setu_db or test_db).
 */

function getModels(connection = mongoose.connection) {
  const CounterModel = connection.models.Counter || connection.model('Counter', Counter.schema);
  const ShipmentModel = connection.models.Shipment || connection.model('Shipment', Shipment.schema);
  return { CounterModel, ShipmentModel };
}

/**
 * Scans the database for the highest numeric SS consignment note.
 * Matches: /^SS-?(\d+)$/i (e.g. SS2106, SS2107, SS-2108)
 * Returns the highest integer found, or 2000 as base fallback.
 */
async function getHighestExistingSSNumber(connection = mongoose.connection) {
  try {
    const { ShipmentModel } = getModels(connection);
    const shipments = await ShipmentModel.find(
      { cnNumber: /^SS-?\d+$/i },
      { cnNumber: 1 }
    ).lean();

    let maxNum = 2000;
    for (const s of shipments) {
      const match = String(s.cnNumber || '').match(/^SS-?(\d+)$/i);
      if (match) {
        const num = parseInt(match[1], 10);
        if (num > maxNum) {
          maxNum = num;
        }
      }
    }
    return maxNum;
  } catch (err) {
    console.error('[sequenceService] Error scanning highest SS shipment:', err.message);
    return 2000;
  }
}

/**
 * Reconciles the 'cn_seq' counter document in the active database.
 * Ensures counter.seq >= highest existing SS shipment number in that database.
 * Uses MongoDB $max operator so the counter NEVER regresses or decrements.
 */
async function syncCounterWithDatabase(connection = mongoose.connection) {
  try {
    const { CounterModel } = getModels(connection);
    const dbName = connection.name || 'default';
    const highestNum = await getHighestExistingSSNumber(connection);
    const currentCounter = await CounterModel.findById('cn_seq').lean();
    const currentSeq = currentCounter ? currentCounter.seq : 0;

    if (!currentCounter || currentSeq < highestNum) {
      const updated = await CounterModel.findByIdAndUpdate(
        'cn_seq',
        { $max: { seq: highestNum } },
        { new: true, upsert: true }
      );
      console.log(`📡 [CN Sequence Sync] Reconciled 'cn_seq' in DB "${dbName}": ${currentSeq} -> ${updated.seq} (DB Max SS: ${highestNum})`);
      return updated.seq;
    }

    console.log(`📡 [CN Sequence Sync] 'cn_seq' verified in DB "${dbName}": seq ${currentSeq} (DB Max SS: ${highestNum})`);
    return currentSeq;
  } catch (err) {
    console.error('[sequenceService] Error reconciling CN sequence counter:', err.message);
    throw err;
  }
}

/**
 * Atomically generates and returns the next sequential CN number.
 * 1. Ensures counter is synced to at least the highest existing SS shipment.
 * 2. Uses atomic $inc: { seq: 1 } to prevent race conditions during concurrent creation.
 * 3. Double-checks against existing shipments to guarantee 100% collision avoidance.
 * 
 * Returns formatted string, e.g. "SS2108".
 */
async function getNextCnNumber(connection = mongoose.connection) {
  const { CounterModel, ShipmentModel } = getModels(connection);
  const dbName = connection.name || 'default';

  // Step 1: Ensure counter is not lagging behind existing shipments
  const currentCounter = await CounterModel.findById('cn_seq').lean();
  const highestExisting = await getHighestExistingSSNumber(connection);
  if (!currentCounter || currentCounter.seq < highestExisting) {
    await syncCounterWithDatabase(connection);
  }

  // Step 2: Atomic increment
  const counter = await CounterModel.findByIdAndUpdate(
    'cn_seq',
    { $inc: { seq: 1 } },
    { new: true, upsert: true }
  );

  let nextSeq = counter.seq;

  // Step 3: Collision guard (if a manual entry exists with this number, advance)
  let collision = await ShipmentModel.exists({ cnNumber: new RegExp(`^SS-?0*${nextSeq}$`, 'i') });
  while (collision) {
    console.warn(`⚠️ [sequenceService] Detected existing shipment with SS${nextSeq}. Advancing atomic counter...`);
    const bumped = await CounterModel.findByIdAndUpdate(
      'cn_seq',
      { $inc: { seq: 1 } },
      { new: true, upsert: true }
    );
    nextSeq = bumped.seq;
    collision = await ShipmentModel.exists({ cnNumber: new RegExp(`^SS-?0*${nextSeq}$`, 'i') });
  }

  const generatedCN = `SS${nextSeq}`;
  console.log(`✨ [sequenceService] Generated next sequential CN: ${generatedCN} (DB: "${dbName}", seq: ${nextSeq})`);
  return generatedCN;
}

/**
 * Previews the next sequential CN number without incrementing the counter.
 */
async function previewNextCnNumber(connection = mongoose.connection) {
  const { CounterModel } = getModels(connection);
  const currentCounter = await CounterModel.findById('cn_seq').lean();
  const highestExisting = await getHighestExistingSSNumber(connection);
  const base = Math.max(currentCounter?.seq || 0, highestExisting);
  return `SS${base + 1}`;
}

module.exports = {
  getHighestExistingSSNumber,
  syncCounterWithDatabase,
  getNextCnNumber,
  previewNextCnNumber
};
