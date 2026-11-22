const mongoose = require('mongoose');
const Counter = require('../models/Counter');
const ConsignorConsignee = require('../models/ConsignorConsignee');

/**
 * Speed Setu - Centralized Consignor & Consignee Shared Company Master Service
 * 
 * BUSINESS RULES:
 * 1. Same company + same address = One record.
 * 2. Same company + different address = Multiple allowed records (e.g., Bangalore, Chennai, Hyderabad).
 * 3. Each unique company-location record = One unique company code (starting from CC100, new company registered as CC101).
 * 4. GST number alone does NOT prevent creation of another location record.
 * 5. Every record can be used interchangeably as both Consignor (Shipper) and Consignee (Receiver).
 */

function getModels(connection = mongoose.connection) {
  const CounterModel = connection.models.Counter || connection.model('Counter', Counter.schema);
  const PartyModel = connection.models.ConsignorConsignee || connection.model('ConsignorConsignee', ConsignorConsignee.schema, 'consignorConsignee');
  return { CounterModel, PartyModel };
}

/**
 * Normalizes text: trims, lowercases, replaces all punctuation/symbols with single spaces, collapses whitespace
 */
function normalizeText(val) {
  if (!val) return '';
  return String(val)
    .trim()
    .toLowerCase()
    .replace(/[^\w\s]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

/**
 * Normalizes an Indian PIN code (extracts 6 digits)
 */
function normalizePinCode(pin) {
  if (!pin) return '';
  const match = String(pin).match(/\b\d{6}\b/);
  return match ? match[0] : String(pin).replace(/\D/g, '');
}

/**
 * Normalize address input from string or object format
 */
function normalizeAddress(rawAddress, fallbackCity = '', fallbackState = '', fallbackPin = '') {
  if (!rawAddress) {
    return {
      addressLine1: '',
      addressLine2: '',
      city: (fallbackCity || '').trim(),
      state: (fallbackState || '').trim(),
      pinCode: (fallbackPin || '').trim()
    };
  }

  if (typeof rawAddress === 'object') {
    return {
      addressLine1: (rawAddress.addressLine1 || rawAddress.address || '').trim(),
      addressLine2: (rawAddress.addressLine2 || '').trim(),
      city: (rawAddress.city || fallbackCity || '').trim(),
      state: (rawAddress.state || fallbackState || '').trim(),
      pinCode: (rawAddress.pinCode || rawAddress.pin || fallbackPin || '').trim()
    };
  }

  // Raw string: parse address
  const str = String(rawAddress).trim();
  let pin = (fallbackPin || '').trim();
  const pinMatch = str.match(/\b\d{6}\b/);
  if (pinMatch) pin = pinMatch[0];

  return {
    addressLine1: str,
    addressLine2: '',
    city: (fallbackCity || '').trim(),
    state: (fallbackState || '').trim(),
    pinCode: pin
  };
}

/**
 * Compares two addresses to check if they represent the exact same physical location.
 * Returns true if both addresses match, false if they represent different locations.
 */
function areAddressesEqual(addr1, addr2) {
  const a1 = normalizeAddress(addr1);
  const a2 = normalizeAddress(addr2);

  const city1 = normalizeText(a1.city);
  const city2 = normalizeText(a2.city);
  const pin1 = normalizePinCode(a1.pinCode);
  const pin2 = normalizePinCode(a2.pinCode);
  const line1A = normalizeText(a1.addressLine1);
  const line1B = normalizeText(a2.addressLine1);
  const line2A = normalizeText(a1.addressLine2);
  const line2B = normalizeText(a2.addressLine2);

  // If cities are specified and different -> definitely different locations (e.g. Bangalore vs Chennai)
  if (city1 && city2 && city1 !== city2) {
    return false;
  }

  // If PIN codes are specified and different -> different locations
  if (pin1 && pin2 && pin1 !== pin2) {
    return false;
  }

  // Compare street address lines
  const combinedA = normalizeText(`${a1.addressLine1} ${a1.addressLine2}`);
  const combinedB = normalizeText(`${a2.addressLine1} ${a2.addressLine2}`);

  if (combinedA && combinedB) {
    if (combinedA === combinedB) {
      return true;
    }
    // Substantial street difference -> different locations
    return false;
  }

  // If street lines are blank or identical, compare city and pin
  if (city1 && city2 && city1 === city2) {
    if (pin1 && pin2) {
      return pin1 === pin2;
    }
    return true;
  }

  return false;
}

/**
 * Scan database to find the highest numeric CCxxx code across the entire shared collection.
 * The sequence starts from CC100 (so the first new company registered will be CC101).
 */
async function getHighestExistingCodeNumber(connection = mongoose.connection) {
  try {
    const { PartyModel } = getModels(connection);
    const parties = await PartyModel.find(
      { companyCode: /^CC\d+$/i },
      { companyCode: 1 }
    ).lean();

    let maxNum = 100; // Base sequence starts at 100
    for (const p of parties) {
      const match = String(p.companyCode || '').match(/^CC(\d+)$/i);
      if (match) {
        const num = parseInt(match[1], 10);
        if (num > maxNum) maxNum = num;
      }
    }
    return maxNum;
  } catch (err) {
    console.error('[consignorConsigneeService] Error scanning highest company code:', err.message);
    return 100;
  }
}

/**
 * Read-only preview of the next CC code that will be assigned.
 * NEVER increments or changes the counter in the database!
 * The sequence number changes ONLY after saving the company.
 */
async function previewNextPartyCode(connection = mongoose.connection) {
  const highestExisting = await getHighestExistingCodeNumber(connection);
  const nextNum = Math.max(101, highestExisting + 1);
  return `CC${nextNum}`;
}

/**
 * Atomically generates next unique Company Code starting from CC100 (new company to be registered as CC101, CC102...)
 * Called strictly upon saving the company.
 */
async function getNextPartyCode(connection = mongoose.connection) {
  const counterId = 'company_code_seq';
  const { CounterModel, PartyModel } = getModels(connection);

  // Sync counter to the actual highest existing saved code in DB
  const highestExisting = await getHighestExistingCodeNumber(connection);
  await CounterModel.findByIdAndUpdate(
    counterId,
    { seq: highestExisting },
    { upsert: true, setDefaultsOnInsert: true }
  );

  let nextCode = '';
  let attempts = 0;
  const maxAttempts = 100;

  while (attempts < maxAttempts) {
    attempts++;
    const counterDoc = await CounterModel.findByIdAndUpdate(
      counterId,
      { $inc: { seq: 1 } },
      { new: true, upsert: true }
    );

    const seqNum = Math.max(101, counterDoc.seq);
    nextCode = `CC${seqNum}`;

    // Verify code uniqueness in the target database
    const existing = await PartyModel.findOne({ companyCode: nextCode }).lean();
    if (!existing) {
      return nextCode;
    }
  }

  // Fallback in case of unexpected sequence collisions
  return `CC${Date.now().toString().slice(-4)}`;
}

/**
 * Find existing company record ONLY if companyName matches AND complete normalized address matches.
 * If companyName matches but address is different (e.g. Bangalore vs Chennai), returns null
 * so a new company-location record is created with its own unique CC code!
 */
async function findExistingParty({ companyName, address, addressLine1, addressLine2, city, state, pinCode, fullAddress }, connection = mongoose.connection) {
  const { PartyModel } = getModels(connection);

  const cleanName = normalizeText(companyName);
  if (!cleanName) return null;

  const targetAddr = normalizeAddress(address || fullAddress, city, state, pinCode);
  if (addressLine1 && !targetAddr.addressLine1) targetAddr.addressLine1 = addressLine1;
  if (addressLine2 && !targetAddr.addressLine2) targetAddr.addressLine2 = addressLine2;
  if (city && !targetAddr.city) targetAddr.city = city;
  if (state && !targetAddr.state) targetAddr.state = state;
  if (pinCode && !targetAddr.pinCode) targetAddr.pinCode = pinCode;

  // Search all parties with the same company name (case-insensitive)
  const escapedName = cleanName.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  const candidates = await PartyModel.find({
    companyName: new RegExp(`^${escapedName}$`, 'i')
  }).lean();

  if (!candidates || candidates.length === 0) {
    return null;
  }

  // Check each candidate's complete normalized address
  for (const candidate of candidates) {
    if (areAddressesEqual(candidate.address, targetAddr)) {
      return candidate; // Exact company + location match
    }
  }

  // Company name exists, but at a different address -> allow new record!
  return null;
}

/**
 * Build snapshot object for shipment
 */
function buildPartySnapshot(partyDoc, rawData = {}) {
  const addr = partyDoc.address || {};
  return {
    companyName: (partyDoc.companyName || rawData.name || rawData.companyName || '').toUpperCase(),
    companyCode: (partyDoc.companyCode || rawData.code || rawData.companyCode || '').toUpperCase(),
    gstNumber: (partyDoc.gstNumber || rawData.gstin || rawData.gstNumber || '').toUpperCase(),
    fullAddress: partyDoc.fullAddress || rawData.address || rawData.fullAddress || '',
    city: addr.city || rawData.city || '',
    state: addr.state || rawData.state || '',
    pinCode: addr.pinCode || rawData.pin || rawData.pinCode || '',
    contactPerson: partyDoc.contactPerson || rawData.contactPerson || '',
    mobileNumber: partyDoc.mobileNumber || rawData.mobileNumber || rawData.mobile || rawData.phone || rawData.contact || '',
    email: partyDoc.email || rawData.email || '',
    pickupDeliveryLocation: (partyDoc.pickupDeliveryLocation || rawData.pickupDeliveryLocation || rawData.pickupDelivery || '').toUpperCase()
  };
}

/**
 * Auto-creates a new company-location in the shared master if not already present
 */
async function autoCreateParty(rawData, connection = mongoose.connection) {
  const { PartyModel } = getModels(connection);
  const name = (rawData.name || rawData.companyName || '').trim().toUpperCase();
  if (!name) return null;

  const addrObj = normalizeAddress(
    rawData.address || rawData.fullAddress,
    rawData.city,
    rawData.state,
    rawData.pin || rawData.pinCode
  );

  const gst = (rawData.gstin || rawData.gstNumber || '').trim().toUpperCase();
  const pickupDeliveryLoc = (rawData.pickupDeliveryLocation || rawData.pickupDelivery || '').trim().toUpperCase();

  // Check if this exact company + location already exists
  const existing = await findExistingParty({
    companyName: name,
    address: addrObj
  }, connection);

  if (existing) {
    return existing;
  }

  // Generate atomic unique CC code (CC101, CC102...)
  const code = rawData.code || await getNextPartyCode(connection);

  const fullAddr = [
    addrObj.addressLine1,
    addrObj.addressLine2,
    addrObj.city,
    addrObj.state,
    addrObj.pinCode ? `PIN: ${addrObj.pinCode}` : ''
  ].filter(Boolean).join(', ');

  const newParty = new PartyModel({
    companyName: name,
    companyCode: code,
    address: addrObj,
    fullAddress: fullAddr,
    gstNumber: gst,
    pickupDeliveryLocation: pickupDeliveryLoc,
    contactPerson: (rawData.contactPerson || rawData.contact || '').trim(),
    mobileNumber: (rawData.mobileNumber || rawData.mobile || rawData.phone || '').trim(),
    email: (rawData.email || '').trim().toLowerCase(),
    isActive: true,
    partyType: 'SHARED'
  });

  const saved = await newParty.save();
  console.log(`[consignorConsigneeService] ✅ Auto-saved new company location: "${saved.companyName}" (${saved.companyCode}) in "${addrObj.city || 'unspecified'}"`);
  return saved;
}

/**
 * Resolves both Consignor and Consignee during shipment creation.
 * Handles all business scenarios seamlessly:
 * A. Both exist -> reuse both
 * B. Consignor is new location -> create consignor with unique CC code
 * C. Consignee is new location -> create consignee with unique CC code
 * D. Both new & different locations -> create both with distinct CC codes (e.g. CC101, CC102)
 * E. Consignor and Consignee are the SAME company at the SAME location -> create ONLY ONE master record!
 * F. Same existing company-location used for both -> reuse single master ID
 */
async function autoResolveShipmentParties({ consignor = {}, consignee = {}, consignorId = null, consigneeId = null }, connection = mongoose.connection) {
  const { PartyModel } = getModels(connection);

  const cnrName = (consignor.name || consignor.companyName || '').trim();
  const cneName = (consignee.name || consignee.companyName || '').trim();

  const cnrAddr = normalizeAddress(
    consignor.address || consignor.fullAddress,
    consignor.city,
    consignor.state,
    consignor.pin || consignor.pinCode
  );
  const cneAddr = normalizeAddress(
    consignee.address || consignee.fullAddress,
    consignee.city,
    consignee.state,
    consignee.pin || consignee.pinCode
  );

  // Check if both sides refer to the EXACT SAME company-location:
  // 1. Explicitly same ID selected, OR
  // 2. Both have matching company name AND matching complete address
  const isSameCompanyLocation = Boolean(
    (consignorId && consigneeId && String(consignorId) === String(consigneeId)) ||
    (cnrName && cneName && normalizeText(cnrName) === normalizeText(cneName) && areAddressesEqual(cnrAddr, cneAddr))
  );

  let masterConsignor = null;
  let masterConsignee = null;

  // 1. Resolve Consignor
  if (consignorId && mongoose.Types.ObjectId.isValid(consignorId)) {
    masterConsignor = await PartyModel.findById(consignorId);
  }
  if (!masterConsignor && cnrName) {
    masterConsignor = await findExistingParty({
      companyName: cnrName,
      address: cnrAddr
    }, connection);
  }

  // 2. Resolve Consignee
  if (isSameCompanyLocation && masterConsignor) {
    masterConsignee = masterConsignor;
  } else {
    if (consigneeId && mongoose.Types.ObjectId.isValid(consigneeId)) {
      masterConsignee = await PartyModel.findById(consigneeId);
    }
    if (!masterConsignee && cneName) {
      masterConsignee = await findExistingParty({
        companyName: cneName,
        address: cneAddr
      }, connection);
    }
  }

  // 3. Auto-create if not found
  if (isSameCompanyLocation && !masterConsignor && !masterConsignee && cnrName) {
    // Scenario E: Both sides are the SAME company at the SAME address -> create ONLY ONE record!
    masterConsignor = await autoCreateParty(consignor, connection);
    masterConsignee = masterConsignor;
  } else {
    if (!masterConsignor && cnrName) {
      masterConsignor = await autoCreateParty(consignor, connection);
    }
    if (!masterConsignee && cneName) {
      masterConsignee = await autoCreateParty(consignee, connection);
    }
  }

  // 4. Build return snapshots & IDs
  const finalConsignorId = masterConsignor ? masterConsignor._id.toString() : (consignorId || null);
  const finalConsigneeId = masterConsignee ? masterConsignee._id.toString() : (consigneeId || null);

  const cnrSnapshot = masterConsignor ? buildPartySnapshot(masterConsignor, consignor) : null;
  const cneSnapshot = masterConsignee ? buildPartySnapshot(masterConsignee, consignee) : null;

  // Synchronize legacy consignor/consignee contact sub-objects
  if (masterConsignor) {
    if (!consignor.code) consignor.code = masterConsignor.companyCode;
    if (!consignor.gstin && masterConsignor.gstNumber) consignor.gstin = masterConsignor.gstNumber;
    if (!consignor.pin && masterConsignor.address?.pinCode) consignor.pin = masterConsignor.address.pinCode;
    if (!consignor.city && masterConsignor.address?.city) consignor.city = masterConsignor.address.city;
    if (!consignor.state && masterConsignor.address?.state) consignor.state = masterConsignor.address.state;
    if (!consignor.address && masterConsignor.fullAddress) consignor.address = masterConsignor.fullAddress;
    if (!consignor.pickupDeliveryLocation && masterConsignor.pickupDeliveryLocation) consignor.pickupDeliveryLocation = masterConsignor.pickupDeliveryLocation;
  }

  if (masterConsignee) {
    if (!consignee.code) consignee.code = masterConsignee.companyCode;
    if (!consignee.gstin && masterConsignee.gstNumber) consignee.gstin = masterConsignee.gstNumber;
    if (!consignee.pin && masterConsignee.address?.pinCode) consignee.pin = masterConsignee.address.pinCode;
    if (!consignee.city && masterConsignee.address?.city) consignee.city = masterConsignee.address.city;
    if (!consignee.state && masterConsignee.address?.state) consignee.state = masterConsignee.address.state;
    if (!consignee.address && masterConsignee.fullAddress) consignee.address = masterConsignee.fullAddress;
    if (!consignee.pickupDeliveryLocation && masterConsignee.pickupDeliveryLocation) consignee.pickupDeliveryLocation = masterConsignee.pickupDeliveryLocation;
  }

  return {
    consignorId: finalConsignorId,
    consigneeId: finalConsigneeId,
    consignorSnapshot: cnrSnapshot,
    consigneeSnapshot: cneSnapshot,
    consignor,
    consignee
  };
}

module.exports = {
  getNextPartyCode,
  previewNextPartyCode,
  normalizeAddress,
  normalizeText,
  areAddressesEqual,
  findExistingParty,
  autoCreateParty,
  autoResolveShipmentParties,
  getHighestExistingCodeNumber
};
