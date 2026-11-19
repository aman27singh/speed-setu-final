"use strict";
var __getOwnPropNames = Object.getOwnPropertyNames;
var __commonJS = (cb, mod) => function __require() {
  try {
    return mod || (0, cb[__getOwnPropNames(cb)[0]])((mod = { exports: {} }).exports, mod), mod.exports;
  } catch (e) {
    throw mod = 0, e;
  }
};

// backend/core/utils.js
var require_utils = __commonJS({
  "backend/core/utils.js"(exports2, module2) {
    "use strict";
    var IST_OFFSET_MIN = 330;
    var MON = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];
    var STATE_CODES = {
      "01": "Jammu & Kashmir",
      "02": "Himachal Pradesh",
      "03": "Punjab",
      "04": "Chandigarh",
      "05": "Uttarakhand",
      "06": "Haryana",
      "07": "Delhi",
      "08": "Rajasthan",
      "09": "Uttar Pradesh",
      "10": "Bihar",
      "11": "Sikkim",
      "12": "Arunachal Pradesh",
      "13": "Nagaland",
      "14": "Manipur",
      "15": "Mizoram",
      "16": "Tripura",
      "17": "Meghalaya",
      "18": "Assam",
      "19": "West Bengal",
      "20": "Jharkhand",
      "21": "Odisha",
      "22": "Chhattisgarh",
      "23": "Madhya Pradesh",
      "24": "Gujarat",
      "26": "Dadra & Nagar Haveli and Daman & Diu",
      "27": "Maharashtra",
      "29": "Karnataka",
      "30": "Goa",
      "31": "Lakshadweep",
      "32": "Kerala",
      "33": "Tamil Nadu",
      "34": "Puducherry",
      "35": "Andaman & Nicobar",
      "36": "Telangana",
      "37": "Andhra Pradesh",
      "38": "Ladakh",
      "97": "Other Territory"
    };
    var GSTIN_RE = /^\d{2}[A-Z]{5}\d{4}[A-Z][1-9A-Z]Z[0-9A-Z]$/;
    var HttpError = class extends Error {
      constructor(status, msg) {
        super(msg);
        this.status = status;
      }
    };
    function getPath(obj, path) {
      return String(path).split(".").reduce((o, k) => o === null || o === void 0 ? void 0 : o[k], obj);
    }
    function pick(obj, paths) {
      for (const p of [].concat(paths || [])) {
        const v = getPath(obj, p);
        if (v !== void 0 && v !== null && v !== "") return v;
      }
      return void 0;
    }
    function parseNum(v) {
      if (v === void 0 || v === null || v === "") return null;
      const s = typeof v === "string" ? v.replace(/[₹,\s]/g, "") : typeof v === "object" ? v.toString() : v;
      const n = Number(s);
      return Number.isFinite(n) ? n : null;
    }
    var toPaise = (v) => {
      const n = parseNum(v);
      return n === null ? 0 : Math.round((n + Number.EPSILON * Math.sign(n)) * 100);
    };
    var fromPaise = (p) => p / 100;
    var normStatus = (s) => String(s || "").trim().toLowerCase().replace(/[\s-]+/g, "_");
    function istParts(date) {
      const t = new Date(new Date(date).getTime() + IST_OFFSET_MIN * 6e4);
      return { y: t.getUTCFullYear(), m: t.getUTCMonth() + 1, d: t.getUTCDate() };
    }
    var startOfDayIST = (y, m, d) => new Date(Date.UTC(y, m - 1, d) - IST_OFFSET_MIN * 6e4);
    var pad = (n) => String(n).padStart(2, "0");
    function fmtDate(date) {
      const p = istParts(date);
      return `${pad(p.d)}-${MON[p.m - 1]}-${p.y}`;
    }
    function excelDate(date) {
      const p = istParts(date);
      return new Date(Date.UTC(p.y, p.m - 1, p.d));
    }
    function toDate(v) {
      if (v === void 0 || v === null || v === "") return null;
      if (typeof v === "string" && /^\d{4}-\d{2}-\d{2}$/.test(v)) {
        const [y, m, d] = v.split("-").map(Number);
        return startOfDayIST(y, m, d);
      }
      const d = v instanceof Date ? v : new Date(v);
      return Number.isNaN(d.getTime()) ? null : d;
    }
    function parseISODate(s, name) {
      const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(String(s || ""));
      if (!m) throw new HttpError(400, `${name} must be a date in YYYY-MM-DD format`);
      const [y, mo, d] = [+m[1], +m[2], +m[3]];
      const chk = new Date(Date.UTC(y, mo - 1, d));
      if (chk.getUTCMonth() !== mo - 1 || chk.getUTCDate() !== d) throw new HttpError(400, `${name} is not a valid date`);
      return { y, m: mo, d };
    }
    var toInt = (v, name, lo, hi) => {
      const n = Number(v);
      if (!Number.isInteger(n) || n < lo || n > hi) throw new HttpError(400, `${name} must be a whole number between ${lo} and ${hi}`);
      return n;
    };
    function resolvePeriod(q) {
      const type = String(q.type || "").toLowerCase();
      if (type === "monthly") {
        const year = toInt(q.year, "year", 2e3, 2100), month = toInt(q.month, "month", 1, 12);
        const ny = month === 12 ? year + 1 : year, nm = month === 12 ? 1 : month + 1;
        return {
          type,
          label: `${MON[month - 1]} ${year}`,
          fileTag: `${MON[month - 1]}-${year}`,
          start: startOfDayIST(year, month, 1),
          endExclusive: startOfDayIST(ny, nm, 1)
        };
      }
      if (type === "yearly") {
        const y = toInt(q.fy || q.year, "fy", 2e3, 2100);
        if (String(q.basis || "fy").toLowerCase() === "calendar")
          return { type, label: `Calendar Year ${y}`, fileTag: `CY${y}`, start: startOfDayIST(y, 1, 1), endExclusive: startOfDayIST(y + 1, 1, 1) };
        const yy = String(y + 1).slice(2);
        return { type, label: `FY ${y}-${yy}`, fileTag: `FY${y}-${yy}`, start: startOfDayIST(y, 4, 1), endExclusive: startOfDayIST(y + 1, 4, 1) };
      }
      if (type === "custom") {
        const f = parseISODate(q.from, "from"), t = parseISODate(q.to, "to");
        const start = startOfDayIST(f.y, f.m, f.d), endExclusive = startOfDayIST(t.y, t.m, t.d + 1);
        if (endExclusive <= start) throw new HttpError(400, "'to' date must be on or after 'from' date");
        if ((endExclusive - start) / 864e5 > 366 * 3) throw new HttpError(400, "Custom range cannot exceed 3 years");
        const a = `${pad(f.d)}-${MON[f.m - 1]}-${f.y}`, b = `${pad(t.d)}-${MON[t.m - 1]}-${t.y}`;
        return { type, label: `${a} to ${b}`, fileTag: `${a.replace(/-/g, "")}_to_${b.replace(/-/g, "")}`, start, endExclusive };
      }
      throw new HttpError(400, "type must be 'monthly', 'yearly' or 'custom'");
    }
    var lastDayIST = (period) => new Date(period.endExclusive.getTime() - 1);
    function splitInvoiceNo(no) {
      const m = /^(.*?)(\d+)$/.exec(String(no || "").trim());
      return m ? { prefix: m[1], seq: Number(m[2]), width: m[2].length } : { prefix: String(no || ""), seq: NaN, width: 0 };
    }
    function naturalCompare(a, b) {
      const x = splitInvoiceNo(a), y = splitInvoiceNo(b);
      if (x.prefix !== y.prefix) return x.prefix < y.prefix ? -1 : 1;
      return (x.seq || 0) - (y.seq || 0);
    }
    var docketKey = (d) => String(d || "").toUpperCase().replace(/\s+/g, "").replace(/^[^A-Z0-9]+|[^A-Z0-9]+$/g, "");
    var rateLabel = (r) => `${Math.round(r * 1e3) / 10}%`;
    module2.exports = {
      IST_OFFSET_MIN,
      MON,
      STATE_CODES,
      GSTIN_RE,
      HttpError,
      getPath,
      pick,
      parseNum,
      toPaise,
      fromPaise,
      normStatus,
      istParts,
      startOfDayIST,
      pad,
      fmtDate,
      excelDate,
      toDate,
      resolvePeriod,
      lastDayIST,
      splitInvoiceNo,
      naturalCompare,
      docketKey,
      rateLabel
    };
  }
});

// backend/core/normalize.js
var require_normalize = __commonJS({
  "backend/core/normalize.js"(exports2, module2) {
    "use strict";
    var U2 = require_utils();
    var addNote = (inv, severity, code, message) => inv.notes.push({ severity, code, message });
    function normalizeInvoice(raw, map, cfg) {
      const I = map.invoice, C = map.customer, L = map.line;
      const supplierState = cfg.supplier.gstin.slice(0, 2);
      const inv = {
        id: String(raw._id || ""),
        number: String(U2.pick(raw, I.number) || "").trim(),
        date: U2.toDate(U2.pick(raw, I.date)),
        status: U2.normStatus(U2.pick(raw, I.status)),
        mode: String(U2.pick(raw, I.mode) || "").toUpperCase(),
        hsn: String(U2.pick(raw, I.hsn) || ""),
        declaredRate: null,
        declaredGrandTotalP: null,
        customer: {
          name: String(U2.pick(raw, C.name) || "").trim(),
          gstin: String(U2.pick(raw, C.gstin) || "").trim().toUpperCase(),
          address: String(U2.pick(raw, C.address) || "")
        },
        lines: [],
        notes: []
      };
      inv.customer.stateCode = inv.customer.gstin.slice(0, 2);
      inv.customer.state = U2.STATE_CODES[inv.customer.stateCode] || "";
      inv.placeOfSupply = inv.customer.state ? `${inv.customer.state} (${inv.customer.stateCode})` : "";
      let gr = U2.parseNum(U2.pick(raw, I.gstRate));
      if (gr !== null) inv.declaredRate = gr > 1 ? gr / 100 : gr;
      const gt = U2.parseNum(U2.pick(raw, I.grandTotal));
      if (gt !== null) inv.declaredGrandTotalP = U2.toPaise(gt);
      if (!inv.number) addNote(inv, "error", "MISSING_NUMBER", "Invoice has no invoice number");
      if (!inv.date) addNote(inv, "error", "MISSING_DATE", "Invoice has no valid invoice date");
      if (!inv.hsn) addNote(inv, "warn", "MISSING_HSN", "HSN/SAC code is missing");
      if (!inv.customer.name) addNote(inv, "warn", "MISSING_CUSTOMER", "Customer name is missing");
      const intra = inv.customer.stateCode === supplierState;
      const lines = U2.pick(raw, I.lines) || [];
      lines.forEach((rl, idx) => {
        const g = (k) => U2.pick(rl, L[k]);
        const num = (k) => U2.parseNum(g(k));
        const weight = num("weight") || 0, rate = num("rate") || 0;
        const line = {
          docketNo: String(g("docketNo") || "").trim(),
          docketDate: U2.toDate(g("docketDate")),
          origin: String(g("origin") || "").toUpperCase(),
          destination: String(g("destination") || "").toUpperCase(),
          packages: num("packages") || 0,
          weight,
          rate
        };
        line.key = U2.docketKey(line.docketNo);
        const ref = `${inv.number} line ${idx + 1}${line.docketNo ? ` (${line.docketNo})` : ""}`;
        const formulaFreightP = Math.round(weight * rate * 100);
        const storedFreight = num("freight");
        line.freightP = storedFreight !== null ? U2.toPaise(storedFreight) : formulaFreightP;
        if (storedFreight !== null && Math.abs(line.freightP - formulaFreightP) > cfg.tolerancePaise)
          addNote(inv, "info", "FREIGHT_NOT_WEIGHT_X_RATE", `${ref}: freight ${line.freightP / 100} differs from weight x rate (${formulaFreightP / 100}). Fine if a minimum charge applies`);
        line.docketP = U2.toPaise(g("docketCharges"));
        line.pickupP = U2.toPaise(g("pickupCharges"));
        line.deliveryP = U2.toPaise(g("deliveryCharges"));
        line.otherP = U2.toPaise(g("otherCharges"));
        line.taxableP = line.freightP + line.docketP + line.pickupP + line.deliveryP + line.otherP;
        const storedTaxable = num("taxable");
        if (storedTaxable !== null && Math.abs(U2.toPaise(storedTaxable) - line.taxableP) > cfg.tolerancePaise)
          addNote(inv, "error", "TAXABLE_MISMATCH", `${ref}: stored taxable ${storedTaxable} but freight + charges = ${line.taxableP / 100}`);
        
        const stored = ["cgst", "sgst", "igst"].map((k) => num(k));
        const hasStoredGst = intra 
          ? (stored[0] !== null && stored[0] > 0) || (stored[1] !== null && stored[1] > 0)
          : (stored[2] !== null && stored[2] > 0);

        if (hasStoredGst || (stored.some((v) => v !== null && v > 0) && !intra)) {
          [line.cgstP, line.sgstP, line.igstP] = stored.map((v) => U2.toPaise(v));
          line.taxSource = "billed";
        } else {
          const isTrain = inv.mode.includes("TRAIN");
          const rt = isTrain ? 0.05 : (inv.declaredRate !== null ? inv.declaredRate : cfg.defaultGstRate);
          if (intra) {
            line.cgstP = line.sgstP = Math.round(line.taxableP * rt / 2);
            line.igstP = 0;
          } else {
            line.cgstP = line.sgstP = 0;
            line.igstP = cfg.roundIgstToRupee ? Math.round(line.taxableP * rt / 100) * 100 : Math.round(line.taxableP * rt);
          }
          line.taxSource = "calculated";
          if (inv.declaredRate === null && !isTrain) addNote(inv, "warn", "DEFAULT_RATE_USED", `${ref}: no GST stored, calculated at default ${cfg.defaultGstRate * 100}%`);
        }
        line.gstP = line.cgstP + line.sgstP + line.igstP;
        line.totalP = line.taxableP + line.gstP;
        const storedTotal = num("total");
        line.billedTotalP = storedTotal !== null ? U2.toPaise(storedTotal) : null;
        if (line.billedTotalP !== null && Math.abs(line.billedTotalP - line.totalP) > cfg.tolerancePaise)
          addNote(inv, "error", "LINE_TOTAL_MISMATCH", `${ref}: stored total ${line.billedTotalP / 100} but taxable + GST = ${line.totalP / 100}`);
        if (inv.customer.stateCode && /^\d{2}$/.test(inv.customer.stateCode)) {
          if (intra && line.igstP > 0) addNote(inv, "warn", "WRONG_TAX_TYPE", `${ref}: customer is in the supplier's state but IGST was charged`);
          if (!intra && (line.cgstP > 0 || line.sgstP > 0)) addNote(inv, "warn", "WRONG_TAX_TYPE", `${ref}: customer is in another state but CGST/SGST was charged`);
        }
        if (line.cgstP !== line.sgstP) addNote(inv, "warn", "CGST_SGST_UNEQUAL", `${ref}: CGST and SGST are not equal`);
        if (line.docketDate && inv.date && (inv.date - line.docketDate) / 864e5 > cfg.staleDocketDays)
          addNote(inv, "info", "OLD_DOCKET", `${ref}: docket dated ${U2.fmtDate(line.docketDate)} billed ${Math.round((inv.date - line.docketDate) / 864e5)} days later`);
        if (!line.docketNo) addNote(inv, "warn", "MISSING_DOCKET_NO", `${ref}: docket number is missing`);
        inv.lines.push(line);
      });
      const sum = (k) => inv.lines.reduce((s, l) => s + l[k], 0);
      inv.t = {
        freightP: sum("freightP"),
        docketP: sum("docketP"),
        pickupP: sum("pickupP"),
        deliveryP: sum("deliveryP"),
        otherP: sum("otherP"),
        taxableP: sum("taxableP"),
        cgstP: sum("cgstP"),
        sgstP: sum("sgstP"),
        igstP: sum("igstP"),
        gstP: sum("gstP"),
        totalP: sum("totalP"),
        packages: sum("packages"),
        weight: inv.lines.reduce((s, l) => s + l.weight, 0)
      };
      if (inv.declaredGrandTotalP !== null && Math.abs(inv.declaredGrandTotalP - inv.t.totalP) > 0)
        addNote(
          inv,
          "error",
          "GRAND_TOTAL_MISMATCH",
          `${inv.number}: stored grand total ${inv.declaredGrandTotalP / 100} but docket lines add up to ${inv.t.totalP / 100} (difference ${(inv.declaredGrandTotalP - inv.t.totalP) / 100}). The register uses the line totals`
        );
      inv.rate = inv.t.taxableP ? Math.round(inv.t.gstP / inv.t.taxableP * 200) / 200 : 0;
      if (inv.t.taxableP && !cfg.standardRates.includes(inv.rate))
        addNote(inv, "warn", "NONSTANDARD_RATE", `${inv.number}: effective GST rate ${U2.rateLabel(inv.rate)} is not a standard slab`);
      if (inv.t.taxableP && inv.lines.some((l) => l.taxSource === "billed")) {
        for (const l of inv.lines) {
          if (l.taxSource !== "billed" || !l.taxableP) continue;
          const exp = cfg.roundIgstToRupee && l.igstP ? Math.round(l.taxableP * inv.rate / 100) * 100 : Math.round(l.taxableP * inv.rate);
          if (Math.abs(exp - l.gstP) > cfg.tolerancePaise)
            addNote(inv, "warn", "GST_NOT_AT_RATE", `${inv.number} docket ${l.docketNo}: GST ${l.gstP / 100} is not ${U2.rateLabel(inv.rate)} of taxable ${l.taxableP / 100}`);
        }
      }
      if (inv.customer.gstin) {
        if (!U2.GSTIN_RE.test(inv.customer.gstin)) addNote(inv, "warn", "BAD_GSTIN", `${inv.number}: customer GSTIN "${inv.customer.gstin}" is not a valid GSTIN format`);
        else if (!inv.customer.state) addNote(inv, "warn", "BAD_STATE_CODE", `${inv.number}: GSTIN state code ${inv.customer.stateCode} is unknown`);
      } else addNote(inv, "warn", "MISSING_GSTIN", `${inv.number}: customer GSTIN is missing`);
      if (!inv.lines.length) addNote(inv, "warn", "NO_LINES", `${inv.number}: invoice has no docket lines`);
      return inv;
    }
    function normalizeRef(raw, map) {
      const I = map.invoice, L = map.line;
      const docketsFromLines = (U2.pick(raw, I.lines) || []).map((l) => String(U2.pick(l, L.docketNo) || "").trim()).filter(Boolean);
      const docketsFromCns = (Array.isArray(raw.cns) ? raw.cns : []).map(s => String(s || "").trim()).filter(Boolean);
      return {
        number: String(U2.pick(raw, I.number) || "").trim(),
        date: U2.toDate(U2.pick(raw, I.date)),
        status: U2.normStatus(U2.pick(raw, I.status)),
        dockets: [...new Set([...docketsFromLines, ...docketsFromCns])]
      };
    }
    module2.exports = { normalizeInvoice, normalizeRef };
  }
});

// backend/core/register.js
var require_register = __commonJS({
  "backend/core/register.js"(exports2, module2) {
    "use strict";
    var U2 = require_utils();
    var { normalizeInvoice, normalizeRef } = require_normalize();
    var sevOrder = { error: 0, warn: 1, info: 2 };
    var SUM_KEYS = ["freightP", "docketP", "pickupP", "deliveryP", "otherP", "taxableP", "cgstP", "sgstP", "igstP", "gstP", "totalP"];
    function emptyTotals() {
      const t = { invoices: 0, dockets: 0, packages: 0, weight: 0 };
      SUM_KEYS.forEach((k) => t[k] = 0);
      return t;
    }
    function addTo(t, inv) {
      t.invoices += 1;
      t.dockets += inv.lines.length;
      t.packages += inv.t.packages;
      t.weight += inv.t.weight;
      SUM_KEYS.forEach((k) => t[k] += inv.t[k]);
    }
    function buildRegister2({ invoices, refs, period, includeDrafts = false, cfg, map }) {
      const norm = invoices.map((r) => normalizeInvoice(r, map, cfg)).sort((a, b) => U2.naturalCompare(a.number, b.number));
      const warnings = [];
      const warn = (severity, code, reference, message) => warnings.push({ severity, code, reference, message });
      const rows = [], docketRows = [];
      const totals = emptyTotals();
      const byCustomer = /* @__PURE__ */ new Map(), byRate = /* @__PURE__ */ new Map(), byHsn = /* @__PURE__ */ new Map();
      let draftExcluded = [];
      for (const inv of norm) {
        const cancelled = inv.status === "cancelled", draft = inv.status === "draft";
        if (draft && !includeDrafts) {
          draftExcluded.push(inv.number);
          continue;
        }
        const counted = !cancelled;
        const T = counted ? inv.t : null;
        const row = {
          number: inv.number,
          date: inv.date,
          customer: inv.customer.name,
          gstin: inv.customer.gstin,
          placeOfSupply: inv.placeOfSupply,
          mode: inv.mode,
          hsn: inv.hsn,
          status: inv.status,
          dockets: counted ? inv.lines.length : 0,
          packages: counted ? T.packages : 0,
          weight: counted ? T.weight : 0,
          freightP: counted ? T.freightP : 0,
          docketP: counted ? T.docketP : 0,
          pickupP: counted ? T.pickupP : 0,
          deliveryP: counted ? T.deliveryP : 0,
          otherP: counted ? T.otherP : 0,
          taxableP: counted ? T.taxableP : 0,
          cgstP: counted ? T.cgstP : 0,
          sgstP: counted ? T.sgstP : 0,
          igstP: counted ? T.igstP : 0,
          gstP: counted ? T.gstP : 0,
          totalP: counted ? T.totalP : 0,
          rate: counted ? inv.rate : 0,
          remarks: cancelled ? "Cancelled" : draft ? "DRAFT (not a final invoice)" : ""
        };
        rows.push(row);
        if (!counted) continue;
        addTo(totals, inv);
        const ck = inv.customer.gstin || inv.customer.name;
        if (!byCustomer.has(ck)) byCustomer.set(ck, { name: inv.customer.name, gstin: inv.customer.gstin, t: emptyTotals() });
        addTo(byCustomer.get(ck).t, inv);
        if (!byRate.has(inv.rate)) byRate.set(inv.rate, emptyTotals());
        addTo(byRate.get(inv.rate), inv);
        if (!byHsn.has(inv.hsn)) byHsn.set(inv.hsn, emptyTotals());
        addTo(byHsn.get(inv.hsn), inv);
        for (const l of inv.lines) docketRows.push({ invoice: inv, line: l });
        for (const n of inv.notes) warn(n.severity, n.code, inv.number, n.message);
      }
      rows.forEach((r, i) => r.sr = i + 1);
      if (draftExcluded.length)
        warn("warn", "DRAFT_EXCLUDED", draftExcluded.join(", "), `${draftExcluded.length} draft invoice(s) dated in this period are NOT included in the register: ${draftExcluded.join(", ")}`);
      if (includeDrafts && rows.some((r) => r.status === "draft"))
        warn("warn", "DRAFT_INCLUDED", "", 'Draft invoices are included in these totals because "include drafts" is switched on');
      const everyNumber = new Set((refs || []).map((r) => normalizeRef(r, map).number));
      norm.forEach((i) => everyNumber.add(i.number));
      const groups = /* @__PURE__ */ new Map();
      for (const inv of norm) {
        const s = U2.splitInvoiceNo(inv.number);
        if (!Number.isFinite(s.seq)) continue;
        if (!groups.has(s.prefix)) groups.set(s.prefix, { width: s.width, seqs: [] });
        groups.get(s.prefix).seqs.push(s.seq);
      }
      for (const [prefix, g] of groups) {
        const have = new Set(g.seqs), lo = Math.min(...g.seqs), hi = Math.max(...g.seqs);
        const missing = [], elsewhere = [];
        for (let n = lo; n <= hi; n++) {
          if (have.has(n)) continue;
          const label = prefix + String(n).padStart(g.width, "0");
          (everyNumber.has(label) ? elsewhere : missing).push(label);
        }
        if (missing.length) warn("error", "NUMBER_GAP", prefix + "*", `Invoice numbers missing from the series (not found anywhere in the system): ${missing.join(", ")}`);
        if (elsewhere.length) warn("info", "NUMBER_OTHER_PERIOD", prefix + "*", `Numbers inside this range that are dated in another period: ${elsewhere.join(", ")}`);
      }
      const periodNumbers = new Set(norm.map((i) => i.number));
      const all = refs && refs.length ? refs.map((r) => normalizeRef(r, map)) : norm.map((i) => ({ number: i.number, date: i.date, status: i.status, dockets: i.lines.map((l) => l.docketNo) }));
      const seen = /* @__PURE__ */ new Map();
      for (const r of all) {
        if (r.status === "cancelled") continue;
        for (const d of new Set(r.dockets)) {
          const k = U2.docketKey(d);
          if (!k) continue;
          if (!seen.has(k)) seen.set(k, []);
          seen.get(k).push({ number: r.number, status: r.status, date: r.date, raw: d });
        }
      }
      for (const [k, list] of seen) {
        const uniq = [...new Map(list.map((x) => [x.number, x])).values()];
        if (uniq.length < 2 || !uniq.some((x) => periodNumbers.has(x.number))) continue;
        const where = uniq.map((x) => `${x.number}${x.status === "draft" ? " [draft]" : ""}${x.date ? " (" + U2.fmtDate(x.date) + ")" : ""}`).join(" and ");
        const raws = [...new Set(uniq.map((x) => x.raw))];
        warn("error", "DUPLICATE_DOCKET", k, `Docket ${raws.join(" / ")} is billed on ${uniq.length} invoices: ${where}. If one is a replacement, cancel the old invoice`);
      }
      warnings.sort((a, b) => sevOrder[a.severity] - sevOrder[b.severity] || a.code.localeCompare(b.code));
      const sumLines = docketRows.reduce((s, d) => s + d.line.totalP, 0);
      const reconciliation = { registerTotalP: totals.totalP, docketLinesTotalP: sumLines, differenceP: totals.totalP - sumLines };
      if (reconciliation.differenceP !== 0) warn("error", "RECONCILIATION", "", `Register total differs from docket lines by ${reconciliation.differenceP / 100}`);
      const arr = (m) => [...m.entries()];
      return {
        period,
        supplier: cfg.supplier,
        includeDrafts,
        generatedAt: /* @__PURE__ */ new Date(),
        rows,
        docketRows,
        totals,
        reconciliation,
        warnings,
        summaries: {
          customers: arr(byCustomer).map(([, v]) => v).sort((a, b) => b.t.totalP - a.t.totalP),
          rates: arr(byRate).map(([rate, t]) => ({ rate, t })).sort((a, b) => a.rate - b.rate),
          hsn: arr(byHsn).map(([hsn, t]) => ({ hsn, t })).sort((a, b) => String(a.hsn).localeCompare(String(b.hsn)))
        }
      };
    }
    function toJSON2(rep) {
      const r2 = (p) => p / 100;
      const money = (o) => {
        const x = {};
        for (const k of Object.keys(o)) x[k.endsWith("P") ? k.slice(0, -1) : k] = k.endsWith("P") ? r2(o[k]) : o[k];
        return x;
      };
      return {
        period: { type: rep.period.type, label: rep.period.label, start: rep.period.start, endExclusive: rep.period.endExclusive },
        supplier: rep.supplier,
        includeDrafts: rep.includeDrafts,
        generatedAt: rep.generatedAt,
        rows: rep.rows.map((r) => ({ ...money(r), date: r.date })),
        totals: money(rep.totals),
        reconciliation: money(rep.reconciliation),
        warnings: rep.warnings,
        summaries: {
          customers: rep.summaries.customers.map((c) => ({ name: c.name, gstin: c.gstin, ...money(c.t) })),
          rates: rep.summaries.rates.map((x) => ({ rate: x.rate, ...money(x.t) })),
          hsn: rep.summaries.hsn.map((x) => ({ hsn: x.hsn, ...money(x.t) }))
        }
      };
    }
    module2.exports = { buildRegister: buildRegister2, toJSON: toJSON2 };
  }
});

// backend/excel/exportExcel.js
var require_exportExcel = __commonJS({
  "backend/excel/exportExcel.js"(exports2, module2) {
    "use strict";
    var ExcelJS = require("exceljs");
    var U2 = require_utils();
    var FONT = "Arial";
    var AMT = "[>=10000000]##\\,##\\,##\\,##0.00;[>=100000]##\\,##\\,##0.00;##,##0.00";
    var INT = "#,##0";
    var DT = "dd-mmm-yyyy";
    var WT = "#,##0.##";
    var fNorm = { name: FONT, size: 10 };
    var fIn = { name: FONT, size: 10, color: { argb: "FF0000FF" } };
    var fLink = { name: FONT, size: 10, color: { argb: "FF008000" } };
    var fBold = { name: FONT, size: 10, bold: true };
    var fHdr = { name: FONT, size: 10, bold: true, color: { argb: "FFFFFFFF" } };
    var fillHdr = { type: "pattern", pattern: "solid", fgColor: { argb: "FF1F3864" } };
    var fillTot = { type: "pattern", pattern: "solid", fgColor: { argb: "FFD9E1F2" } };
    var thin = { style: "thin", color: { argb: "FF999999" } };
    var border = { left: thin, right: thin, top: thin, bottom: thin };
    var L = (n) => {
      let s = "";
      while (n > 0) {
        const m = (n - 1) % 26;
        s = String.fromCharCode(65 + m) + s;
        n = Math.floor((n - 1) / 26);
      }
      return s;
    };
    var r2 = (p) => p / 100;
    function header(ws, row, heads) {
      heads.forEach((h, i) => {
        const c = ws.getCell(row, i + 1);
        c.value = h;
        c.font = fHdr;
        c.fill = fillHdr;
        c.border = border;
        c.alignment = { horizontal: "center", vertical: "middle", wrapText: true };
      });
      ws.getRow(row).height = 32;
    }
    function F(ws, row, col, formula, result, fmt, font = fNorm) {
      const c = ws.getCell(row, col);
      c.value = { formula, result };
      c.font = font;
      if (fmt) c.numFmt = fmt;
      return c;
    }
    function V(ws, row, col, value, fmt, font = fIn) {
      const c = ws.getCell(row, col);
      c.value = value;
      c.font = font;
      if (fmt) c.numFmt = fmt;
      return c;
    }
    function buildWorkbook2(rep) {
      const wb = new ExcelJS.Workbook();
      wb.creator = rep.supplier.name;
      wb.created = rep.generatedAt;
      wb.calcProperties = { fullCalcOnLoad: true };
      const rg = wb.addWorksheet("Sales Register", { views: [{ state: "frozen", xSplit: 4, ySplit: 5 }] });
      const dd = wb.addWorksheet("Docket Details", { views: [{ state: "frozen", xSplit: 5, ySplit: 4 }] });
      const sm = wb.addWorksheet("Summary");
      const nt = wb.addWorksheet("Checks & Notes");
      const p = rep.period, rows = rep.rows;
      const periodTxt = `${p.label} (${U2.fmtDate(p.start)} to ${U2.fmtDate(U2.lastDayIST(p))})`;
      rg.getCell("A1").value = rep.supplier.name;
      rg.getCell("A1").font = { name: FONT, size: 14, bold: true };
      rg.getCell("A2").value = `${rep.supplier.address} | GSTIN: ${rep.supplier.gstin}`;
      rg.getCell("A2").font = fNorm;
      rg.getCell("A3").value = `SALES REGISTER (Outward Supplies - Goods Transport Services) | Period: ${periodTxt}`;
      rg.getCell("A3").font = fBold;
      rg.getCell("A4").value = `Generated on ${U2.fmtDate(rep.generatedAt)}${rep.includeDrafts ? " | INCLUDES DRAFT INVOICES" : ""} | Blue = from invoices; black = formula; green = from 'Docket Details'. Amounts in INR.`;
      rg.getCell("A4").font = { name: FONT, size: 9, italic: true };
      const rh = [
        "Sr",
        "Invoice No",
        "Invoice Date",
        "Customer Name",
        "Customer GSTIN",
        "Place of Supply",
        "Mode",
        "HSN / SAC",
        "No. of Dockets",
        "No. of Pkgs",
        "Weight (kg)",
        "Freight",
        "Docket Chg",
        "Pickup Chg",
        "Delivery Chg",
        "Other Chg",
        "Taxable Value",
        "CGST",
        "SGST",
        "IGST",
        "Total GST",
        "Invoice Value",
        "GST Rate",
        "Remarks"
      ];
      header(rg, 5, rh);
      [5, 13, 13, 42, 18, 22, 15, 10, 9, 8, 10, 13, 11, 11, 11, 9, 14, 11, 11, 13, 13, 14, 8, 50].forEach((w, i) => rg.getColumn(i + 1).width = w);
      const RG1 = 6, N = rows.length, RGN = RG1 + N - 1, RGT = RGN + 1;
      const DD1 = 5, M = rep.docketRows.length, DDN = Math.max(DD1, DD1 + M - 1), DDT = DD1 + M;
      const ddr = (c) => `'Docket Details'!$${c}$${DD1}:$${c}$${DDN}`;
      const rgr = (c) => `'Sales Register'!$${c}$${RG1}:$${c}$${Math.max(RGN, RG1)}`;
      if (!N) {
        rg.getCell("A6").value = "No invoices found in this period.";
        rg.getCell("A6").font = fBold;
      } else {
        rows.forEach((r3, i) => {
          const x2 = RG1 + i;
          V(rg, x2, 1, r3.sr, null, fNorm);
          V(rg, x2, 2, r3.number);
          V(rg, x2, 3, U2.excelDate(r3.date), DT);
          V(rg, x2, 4, r3.customer);
          V(rg, x2, 5, r3.gstin);
          V(rg, x2, 6, r3.placeOfSupply);
          V(rg, x2, 7, r3.mode);
          V(rg, x2, 8, r3.hsn);
          F(rg, x2, 9, `COUNTIFS(${ddr("B")},$B${x2})`, r3.dockets, INT, fLink);
          F(rg, x2, 10, `SUMIFS(${ddr("I")},${ddr("B")},$B${x2})`, r3.packages, INT, fLink);
          F(rg, x2, 11, `SUMIFS(${ddr("J")},${ddr("B")},$B${x2})`, r3.weight, WT, fLink);
          [
            ["L", 12, r3.freightP],
            ["M", 13, r3.docketP],
            ["N", 14, r3.pickupP],
            ["O", 15, r3.deliveryP],
            ["P", 16, r3.otherP],
            ["Q", 17, r3.taxableP],
            ["R", 18, r3.cgstP],
            ["S", 19, r3.sgstP],
            ["T", 20, r3.igstP]
          ].forEach(([c, col, val]) => F(rg, x2, col, `SUMIFS(${ddr(c)},${ddr("B")},$B${x2})`, r2(val), AMT, fLink));
          F(rg, x2, 21, `R${x2}+S${x2}+T${x2}`, r2(r3.gstP), AMT);
          F(rg, x2, 22, `Q${x2}+U${x2}`, r2(r3.totalP), AMT);
          F(rg, x2, 23, `IF(Q${x2}=0,0,ROUND(U${x2}/Q${x2}*200,0)/200)`, r3.rate, "0.0%");
          V(rg, x2, 24, r3.remarks, null, fIn).alignment = { wrapText: true, vertical: "top" };
        });
        const T = rep.totals;
        rg.getCell(RGT, 4).value = "TOTAL";
        rg.getCell(RGT, 4).font = fBold;
        const tv = {
          9: T.dockets,
          10: T.packages,
          11: T.weight,
          12: r2(T.freightP),
          13: r2(T.docketP),
          14: r2(T.pickupP),
          15: r2(T.deliveryP),
          16: r2(T.otherP),
          17: r2(T.taxableP),
          18: r2(T.cgstP),
          19: r2(T.sgstP),
          20: r2(T.igstP),
          21: r2(T.gstP),
          22: r2(T.totalP)
        };
        for (let c = 9; c <= 22; c++) F(rg, RGT, c, `SUM(${L(c)}${RG1}:${L(c)}${RGN})`, tv[c], c <= 10 ? INT : c === 11 ? WT : AMT, fBold);
        for (let x2 = RG1; x2 <= RGT; x2++) for (let c = 1; c <= 24; c++) {
          const cell = rg.getCell(x2, c);
          cell.border = border;
          if (x2 === RGT) cell.fill = fillTot;
        }
        const chk = RGT + 2;
        rg.getCell(chk, 4).value = "Check: register total less 'Docket Details' total (must be 0.00)";
        rg.getCell(chk, 4).font = { name: FONT, size: 9, italic: true };
        F(rg, chk, 22, `V${RGT}-'Docket Details'!U${DDT}`, r2(rep.reconciliation.differenceP), AMT, fLink);
        rg.autoFilter = { from: { row: 5, column: 1 }, to: { row: RGN, column: 24 } };
      }
      rg.pageSetup = { orientation: "landscape", fitToPage: true, fitToWidth: 1, fitToHeight: 0, paperSize: 9 };
      rg.pageSetup.printTitlesRow = "5:5";
      dd.getCell("A1").value = "Docket-wise Details (supporting schedule to the Sales Register)";
      dd.getCell("A1").font = { name: FONT, size: 14, bold: true };
      dd.getCell("A2").value = `${rep.supplier.name} | GSTIN ${rep.supplier.gstin} | Period: ${periodTxt}`;
      dd.getCell("A2").font = { name: FONT, size: 9, italic: true };
      header(dd, 4, [
        "Sr",
        "Invoice No",
        "Invoice Date",
        "Customer",
        "Docket No",
        "Docket Date",
        "Origin",
        "Destination",
        "No. of Pkgs",
        "Weight (kg)",
        "Rate (INR/kg)",
        "Freight",
        "Docket Chg",
        "Pickup Chg",
        "Delivery Chg",
        "Other Chg",
        "Taxable Value",
        "CGST",
        "SGST",
        "IGST",
        "Line Total",
        "Total as stored on bill",
        "Diff"
      ]);
      [5, 13, 13, 34, 11, 13, 14, 16, 8, 9, 9, 12, 10, 10, 10, 9, 13, 10, 10, 12, 13, 14, 8].forEach((w, i) => dd.getColumn(i + 1).width = w);
      rep.docketRows.forEach(({ invoice: inv, line: l }, i) => {
        const x2 = DD1 + i;
        V(dd, x2, 1, i + 1, null, fNorm);
        V(dd, x2, 2, inv.number);
        V(dd, x2, 3, U2.excelDate(inv.date), DT);
        V(dd, x2, 4, inv.customer.name);
        V(dd, x2, 5, l.docketNo);
        V(dd, x2, 6, l.docketDate ? U2.excelDate(l.docketDate) : null, DT);
        V(dd, x2, 7, l.origin);
        V(dd, x2, 8, l.destination);
        V(dd, x2, 9, l.packages, INT);
        V(dd, x2, 10, l.weight, WT);
        V(dd, x2, 11, l.rate, "0.##");
        V(dd, x2, 12, r2(l.freightP), AMT);
        V(dd, x2, 13, r2(l.docketP), AMT);
        V(dd, x2, 14, r2(l.pickupP), AMT);
        V(dd, x2, 15, r2(l.deliveryP), AMT);
        V(dd, x2, 16, r2(l.otherP), AMT);
        F(dd, x2, 17, `SUM(L${x2}:P${x2})`, r2(l.taxableP), AMT);
        V(dd, x2, 18, r2(l.cgstP), AMT);
        V(dd, x2, 19, r2(l.sgstP), AMT);
        V(dd, x2, 20, r2(l.igstP), AMT);
        F(dd, x2, 21, `Q${x2}+R${x2}+S${x2}+T${x2}`, r2(l.totalP), AMT);
        if (l.billedTotalP !== null) {
          V(dd, x2, 22, r2(l.billedTotalP), AMT);
          F(dd, x2, 23, `U${x2}-V${x2}`, r2(l.totalP - l.billedTotalP), AMT);
        }
      });
      if (M) {
        const dT = rep.docketRows.reduce((a, { line: l }) => {
          for (const k of ["freightP", "docketP", "pickupP", "deliveryP", "otherP", "taxableP", "cgstP", "sgstP", "igstP", "totalP"]) a[k] = (a[k] || 0) + l[k];
          a.pk = (a.pk || 0) + l.packages;
          a.wt = (a.wt || 0) + l.weight;
          return a;
        }, {});
        dd.getCell(DDT, 8).value = "TOTAL";
        dd.getCell(DDT, 8).font = fBold;
        const tvals = { 9: dT.pk, 10: dT.wt, 12: r2(dT.freightP), 13: r2(dT.docketP), 14: r2(dT.pickupP), 15: r2(dT.deliveryP), 16: r2(dT.otherP), 17: r2(dT.taxableP), 18: r2(dT.cgstP), 19: r2(dT.sgstP), 20: r2(dT.igstP), 21: r2(dT.totalP) };
        for (const c of Object.keys(tvals)) F(dd, DDT, +c, `SUM(${L(+c)}${DD1}:${L(+c)}${DDN})`, tvals[c], +c === 9 ? INT : +c === 10 ? WT : AMT, fBold);
        for (let x2 = DD1; x2 <= DDT; x2++) for (let c = 1; c <= 23; c++) {
          const cell = dd.getCell(x2, c);
          cell.border = border;
          if (x2 === DDT) cell.fill = fillTot;
        }
        dd.autoFilter = { from: { row: 4, column: 1 }, to: { row: DDN, column: 23 } };
      }
      dd.pageSetup = { orientation: "landscape", fitToPage: true, fitToWidth: 1, fitToHeight: 0, paperSize: 9 };
      sm.getCell("A1").value = `Summary | ${p.label}`;
      sm.getCell("A1").font = { name: FONT, size: 14, bold: true };
      [38, 18, 13, 15, 13, 13, 15, 15, 16].forEach((w, i) => sm.getColumn(i + 1).width = w);
      const heads = (first, second) => [first, second, "No. of Invoices", "Taxable Value", "CGST", "SGST", "IGST", "Total GST", "Invoice Value"];
      let r = 3;
      const block = (title, headRow, items, keyCol, keyOf, keyFmt) => {
        sm.getCell(r, 1).value = title;
        sm.getCell(r, 1).font = fBold;
        r++;
        header(sm, r, headRow);
        r++;
        const first = r;
        items.forEach((it) => {
          const [k1, k2] = keyOf(it);
          V(sm, r, 1, k1, keyFmt, fIn).alignment = { horizontal: "left" };
          if (k2 !== void 0) V(sm, r, 2, k2);
          const crit = keyCol === "E" ? `$B${r}` : `$A${r}`;
          F(sm, r, 3, `COUNTIFS(${rgr(keyCol)},${crit},${rgr("V")},">0")`, it.t.invoices, INT, fLink);
          [["Q", 4, it.t.taxableP], ["R", 5, it.t.cgstP], ["S", 6, it.t.sgstP], ["T", 7, it.t.igstP], ["U", 8, it.t.gstP], ["V", 9, it.t.totalP]].forEach(([c, col, v]) => F(sm, r, col, `SUMIFS(${rgr(c)},${rgr(keyCol)},${crit})`, r2(v), AMT, fLink));
          r++;
        });
        const last = r - 1;
        sm.getCell(r, 1).value = "TOTAL";
        sm.getCell(r, 1).font = fBold;
        const tot = items.reduce((a, it) => {
          for (const k of Object.keys(it.t)) a[k] = (a[k] || 0) + it.t[k];
          return a;
        }, {});
        [[3, tot.invoices || 0], [4, r2(tot.taxableP || 0)], [5, r2(tot.cgstP || 0)], [6, r2(tot.sgstP || 0)], [7, r2(tot.igstP || 0)], [8, r2(tot.gstP || 0)], [9, r2(tot.totalP || 0)]].forEach(([c, v]) => F(sm, r, c, items.length ? `SUM(${L(c)}${first}:${L(c)}${last})` : "0", v, c === 3 ? INT : AMT, fBold));
        for (let x2 = first; x2 <= r; x2++) for (let c = 1; c <= 9; c++) {
          const cell = sm.getCell(x2, c);
          cell.border = border;
          if (x2 === r) cell.fill = fillTot;
        }
        r += 3;
      };
      if (N) {
        block("A. Customer-wise (by GSTIN)", heads("Customer Name", "Customer GSTIN"), rep.summaries.customers, "E", (c) => [c.name, c.gstin]);
        block("B. GST rate-wise", heads("GST Rate", ""), rep.summaries.rates, "W", (x2) => [x2.rate, void 0], "0.0%");
        block("C. HSN / SAC-wise", heads("HSN / SAC", ""), rep.summaries.hsn, "H", (x2) => [x2.hsn, void 0]);
      } else sm.getCell("A3").value = "No invoices in this period.";
      nt.getColumn(1).width = 10;
      nt.getColumn(2).width = 24;
      nt.getColumn(3).width = 30;
      nt.getColumn(4).width = 130;
      nt.getCell("A1").value = "Checks & Notes";
      nt.getCell("A1").font = { name: FONT, size: 14, bold: true };
      nt.getCell("A3").value = "Reconciliation";
      nt.getCell("A3").font = fBold;
      nt.getCell("B4").value = "Register invoice value total";
      V(nt, 4, 4, r2(rep.reconciliation.registerTotalP), AMT, fNorm).alignment = { horizontal: "left" };
      nt.getCell("B5").value = "'Docket Details' line total";
      V(nt, 5, 4, r2(rep.reconciliation.docketLinesTotalP), AMT, fNorm).alignment = { horizontal: "left" };
      nt.getCell("B6").value = "Difference (must be 0.00)";
      V(nt, 6, 4, r2(rep.reconciliation.differenceP), AMT, fBold).alignment = { horizontal: "left" };
      ["B4", "B5", "B6"].forEach((a) => nt.getCell(a).font = fNorm);
      let x = 8;
      nt.getCell(x, 1).value = `Warnings (${rep.warnings.length})`;
      nt.getCell(x, 1).font = fBold;
      x++;
      if (rep.warnings.length) {
        header(nt, x, ["Severity", "Check", "Reference", "Details"]);
        x++;
        const col = { error: "FFFCE4E4", warn: "FFFFF4D6", info: "FFEDEDED" };
        rep.warnings.forEach((w) => {
          [w.severity.toUpperCase(), w.code, w.reference, w.message].forEach((v, i) => {
            const c = nt.getCell(x, i + 1);
            c.value = v;
            c.font = fNorm;
            c.border = border;
            c.alignment = { wrapText: true, vertical: "top" };
            c.fill = { type: "pattern", pattern: "solid", fgColor: { argb: col[w.severity] } };
          });
          x++;
        });
      } else {
        nt.getCell(x, 1).value = "No warnings. All checks passed.";
        nt.getCell(x, 1).font = fNorm;
        x++;
      }
      x += 1;
      nt.getCell(x, 1).value = "Basis of preparation";
      nt.getCell(x, 1).font = fBold;
      x++;
      [
        "Invoices are selected by INVOICE DATE (IST) within the period. Draft invoices are excluded unless stated at the top of the register.",
        "Cancelled invoices are listed with zero values so the invoice number series stays complete.",
        "Freight, charges, taxable value and totals are recalculated from the docket lines. GST amounts are taken as billed so the register agrees with the printed invoices.",
        "Place of Supply is derived from the first two digits of the customer's GSTIN. CGST + SGST applies when it equals the supplier's state, otherwise IGST.",
        "All sums are computed in whole paise. Register rows pull their figures from the Docket Details sheet with SUMIFS, so editing a docket line updates everything."
      ].forEach((t, i) => {
        nt.getCell(x, 1).value = i + 1;
        nt.getCell(x, 1).font = fBold;
        nt.getCell(x, 1).alignment = { vertical: "top" };
        nt.getCell(x, 2).value = t;
        nt.mergeCells(x, 2, x, 4);
        nt.getCell(x, 2).font = fNorm;
        nt.getCell(x, 2).alignment = { wrapText: true, vertical: "top" };
        nt.getRow(x).height = 28;
        x++;
      });
      return wb;
    }
    function toCSV2(rep) {
      const esc = (v) => {
        const s = v === null || v === void 0 ? "" : String(v);
        return /[",\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
      };
      const head = [
        "Sr",
        "Invoice No",
        "Invoice Date",
        "Customer Name",
        "Customer GSTIN",
        "Place of Supply",
        "Mode",
        "HSN/SAC",
        "No. of Dockets",
        "No. of Pkgs",
        "Weight (kg)",
        "Freight",
        "Docket Chg",
        "Pickup Chg",
        "Delivery Chg",
        "Other Chg",
        "Taxable Value",
        "CGST",
        "SGST",
        "IGST",
        "Total GST",
        "Invoice Value",
        "GST Rate",
        "Remarks"
      ];
      const lines = [head.join(",")];
      for (const r of rep.rows)
        lines.push([
          r.sr,
          r.number,
          U2.fmtDate(r.date),
          r.customer,
          r.gstin,
          r.placeOfSupply,
          r.mode,
          r.hsn,
          r.dockets,
          r.packages,
          r.weight,
          ...["freightP", "docketP", "pickupP", "deliveryP", "otherP", "taxableP", "cgstP", "sgstP", "igstP", "gstP", "totalP"].map((k) => (r[k] / 100).toFixed(2)),
          r.rate,
          r.remarks
        ].map(esc).join(","));
      const T = rep.totals;
      lines.push([
        "",
        "",
        "",
        "TOTAL",
        "",
        "",
        "",
        "",
        T.dockets,
        T.packages,
        T.weight,
        ...["freightP", "docketP", "pickupP", "deliveryP", "otherP", "taxableP", "cgstP", "sgstP", "igstP", "gstP", "totalP"].map((k) => (T[k] / 100).toFixed(2)),
        "",
        ""
      ].map(esc).join(","));
      return "\uFEFF" + lines.join("\r\n");
    }
    function fileName2(rep, ext) {
      return `Sales_Register_${rep.period.fileTag}.${ext}`;
    }
    module2.exports = { buildWorkbook: buildWorkbook2, toCSV: toCSV2, fileName: fileName2 };
  }
});

// backend/repo/mongoRepo.js
var require_mongoRepo = __commonJS({
  "backend/repo/mongoRepo.js"(exports2, module2) {
    "use strict";
    var U2 = require_utils();
    var first = (v) => [].concat(v)[0];
    function createMongoRepo2(InvoiceModel, map) {
      const dateField = first(map.invoice.date);
      return {
        /** Invoices whose invoice date is in [start, endExclusive). Supports Date and YYYY-MM-DD string fields. */
        async findInRange({ start, endExclusive }, { companyId } = {}) {
          const sParts = U2.istParts(start);
          const eParts = U2.istParts(new Date(endExclusive.getTime() - 1));
          const startStr = `${sParts.y}-${U2.pad(sParts.m)}-${U2.pad(sParts.d)}`;
          const endInclusiveStr = `${eParts.y}-${U2.pad(eParts.m)}-${U2.pad(eParts.d)}`;
          const endExclusiveParts = U2.istParts(endExclusive);
          const endStr = `${endExclusiveParts.y}-${U2.pad(endExclusiveParts.m)}-${U2.pad(endExclusiveParts.d)}`;

          const q = {
            $or: [
              { [dateField]: { $gte: start, $lt: endExclusive } },
              { [dateField]: { $gte: startStr, $lt: endStr } },
              { [dateField]: { $gte: startStr, $lte: endInclusiveStr } }
            ]
          };
          if (companyId) q[first(map.invoice.companyId)] = companyId;
          let cur = InvoiceModel.find(q).lean();
          for (const p of map.populate || []) cur = cur.populate({ path: p, strictPopulate: false });
          return cur.exec();
        },
        /** Light projection of EVERY invoice: used for duplicate-docket and invoice-number-gap checks. */
        async findRefs() {
          const lines = first(map.invoice.lines), docket = first(map.line.docketNo);
          const projection = {
            [first(map.invoice.number)]: 1,
            [dateField]: 1,
            [first(map.invoice.status)]: 1,
            [`${lines}.${docket}`]: 1,
            cns: 1
          };
          return InvoiceModel.find({}, projection).lean().exec();
        }
      };
    }
    module2.exports = { createMongoRepo: createMongoRepo2 };
  }
});

// backend/routes.js
var express = require("express");
var defaultMap = require("./fieldMap");
var defaultCfg = require("./config");
var U = require_utils();
var { buildRegister, toJSON } = require_register();
var { buildWorkbook, toCSV, fileName } = require_exportExcel();
var { createMongoRepo } = require_mongoRepo();

function salesRegisterRouter({ InvoiceModel, repo, authMiddleware = [], fieldMap = defaultMap, config = defaultCfg }) {
  const router = express.Router();
  const data = repo || createMongoRepo(InvoiceModel, fieldMap);
  router.use(authMiddleware);
  async function generate(query) {
    const period = U.resolvePeriod(query);
    const includeDrafts = String(query.includeDrafts || "").toLowerCase() === "true";
    const [invoices, refs] = await Promise.all([data.findInRange(period, { companyId: query.companyId || void 0 }), data.findRefs()]);
    const status = query.status ? U.normStatus(query.status) : null;
    const filtered = status ? invoices.filter((i) => U.normStatus(U.pick(i, fieldMap.invoice.status)) === status) : invoices;
    return buildRegister({ invoices: filtered, refs, period, includeDrafts, cfg: config, map: fieldMap });
  }
  const fail = (res, e) => {
    if (e instanceof U.HttpError) return res.status(e.status).json({ error: e.message });
    console.error("sales-register error:", e);
    return res.status(500).json({ error: "Could not generate the sales register" });
  };
  router.get("/", async (req, res) => {
    try {
      res.json(toJSON(await generate(req.query)));
    } catch (e) {
      fail(res, e);
    }
  });
  router.get("/export", async (req, res) => {
    try {
      const rep = await generate(req.query);
      const format = String(req.query.format || "xlsx").toLowerCase();
      if (format === "csv") {
        res.setHeader("Content-Type", "text/csv; charset=utf-8");
        res.setHeader("Content-Disposition", `attachment; filename="${fileName(rep, "csv")}"`);
        return res.send(toCSV(rep));
      }
      if (format !== "xlsx") throw new U.HttpError(400, "format must be 'xlsx' or 'csv'");
      res.setHeader("Content-Type", "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet");
      res.setHeader("Content-Disposition", `attachment; filename="${fileName(rep, "xlsx")}"`);
      await buildWorkbook(rep).xlsx.write(res);
      res.end();
    } catch (e) {
      fail(res, e);
    }
  });
  return router;
}

module.exports = { salesRegisterRouter };
