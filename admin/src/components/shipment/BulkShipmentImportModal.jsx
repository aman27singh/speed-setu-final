import React, { useState } from 'react';
import * as XLSX from 'xlsx';
import { shipmentService } from '../../services/shipmentService';
import { companyService } from '../../services/companyService';
import {
  FileSpreadsheet,
  Upload,
  Download,
  CheckCircle2,
  AlertCircle,
  X,
  RefreshCw,
  FileText
} from 'lucide-react';

export const BulkShipmentImportModal = ({ isOpen, onClose, onImportSuccess }) => {
  const [file, setFile] = useState(null);
  const [parsedRows, setParsedRows] = useState([]);
  const [fileName, setFileName] = useState('');
  const [importing, setImporting] = useState(false);
  const [progress, setProgress] = useState(0);
  const [totalCount, setTotalCount] = useState(0);
  const [error, setError] = useState(null);
  const [successCount, setSuccessCount] = useState(0);

  if (!isOpen) return null;

  // Helper to normalize header keys
  const getFieldValue = (row, possibleKeys) => {
    for (const key of possibleKeys) {
      const foundKey = Object.keys(row).find(
        (k) => k.toLowerCase().replace(/[^a-z0-9]/g, '') === key.toLowerCase().replace(/[^a-z0-9]/g, '')
      );
      if (foundKey && row[foundKey] !== undefined && row[foundKey] !== null && String(row[foundKey]).trim() !== '') {
        return String(row[foundKey]).trim();
      }
    }
    return '';
  };

  // Convert Excel / JS dates into YYYY-MM-DD
  const formatExcelDate = (val) => {
    if (!val) return new Date().toLocaleDateString('en-CA');

    if (val instanceof Date) {
      if (isNaN(val.getTime())) return '';
      // SheetJS adjusts cell dates to local timezone resulting in ~18:30 UTC of previous day.
      // Adding 12 hours moves the time into midday of the actual intended calendar date!
      const adjusted = new Date(val.getTime() + 12 * 3600 * 1000);
      const year = adjusted.getUTCFullYear();
      const month = String(adjusted.getUTCMonth() + 1).padStart(2, '0');
      const day = String(adjusted.getUTCDate()).padStart(2, '0');
      return `${year}-${month}-${day}`;
    }

    if (typeof val === 'number') {
      const date = new Date(Math.round((val - 25569) * 86400 * 1000));
      const year = date.getUTCFullYear();
      const month = String(date.getUTCMonth() + 1).padStart(2, '0');
      const day = String(date.getUTCDate()).padStart(2, '0');
      return `${year}-${month}-${day}`;
    }

    const str = String(val).trim();
    if (/^\d{4}-\d{2}-\d{2}/.test(str)) return str.slice(0, 10);

    const parts = str.split('/');
    if (parts.length === 3) {
      let part1 = parseInt(parts[0], 10);
      let part2 = parseInt(parts[1], 10);
      let year = parts[2].trim();
      if (year.length === 2) year = '20' + year;

      let day = part1;
      let month = part2;
      if (part2 > 12 && part1 <= 12) {
        day = part2;
        month = part1;
      }

      const dayStr = String(day).padStart(2, '0');
      const monthStr = String(month).padStart(2, '0');
      return `${year}-${monthStr}-${dayStr}`;
    }

    const parsed = new Date(str);
    if (!isNaN(parsed.getTime())) {
      const adjusted = new Date(parsed.getTime() + 12 * 3600 * 1000);
      const year = adjusted.getUTCFullYear();
      const month = String(adjusted.getUTCMonth() + 1).padStart(2, '0');
      const day = String(adjusted.getUTCDate()).padStart(2, '0');
      return `${year}-${month}-${day}`;
    }

    return str;
  };

  const handleFileUpload = (e) => {
    const uploadedFile = e.target.files?.[0];
    if (!uploadedFile) return;

    setFile(uploadedFile);
    setFileName(uploadedFile.name);
    setError(null);

    const reader = new FileReader();
    reader.onload = (event) => {
      try {
        const bstr = event.target.result;
        const workbook = XLSX.read(bstr, { type: 'binary', cellDates: true });
        const sheetName = workbook.SheetNames[0];
        const sheet = workbook.Sheets[sheetName];
        const rawData = XLSX.utils.sheet_to_json(sheet, { defval: '', cellDates: true });

        if (!rawData || rawData.length === 0) {
          setError('The uploaded Excel file contains no data rows.');
          setParsedRows([]);
          return;
        }

        const mapped = rawData.map((row, idx) => {
          const cnNumber = getFieldValue(row, ['docketno', 'cnnumber', 'docketnumber', 'cnno', 'waybill', 'lrno', 'lrnumber', 'cn', 'docket', 'bookingno', 'consignmentno']) || `CN-${Date.now()}-${idx + 1}`;
          const cnDate = formatExcelDate(getFieldValue(row, ['docketdate', 'cndate', 'bookingdate', 'docketdate', 'lrdate', 'dispatchdate']));
          const companyName = getFieldValue(row, ['billto', 'companyname', 'company', 'customer', 'client', 'billingparty', 'billedto', 'party', 'customername']) || 'General Corporate Client';
          const companyCode = getFieldValue(row, ['companycode', 'companyid', 'customercode', 'partycode']) || '';
          
          const consignorName = getFieldValue(row, ['consignor', 'consignorname', 'shipper', 'fromname', 'fromparty', 'shippername', 'pickupfrom']);
          const consignorCity = getFieldValue(row, ['consignorcity', 'origincity', 'fromcity', 'pickupcity']);
          
          const consigneeName = getFieldValue(row, ['consignee', 'consigneename', 'receiver', 'toname', 'toparty', 'receivername', 'deliveryto']);
          const consigneeCity = getFieldValue(row, ['consigneecity', 'destcity', 'tocity', 'deliverycity']);

          const origin = getFieldValue(row, ['origin', 'fromcity', 'origincity', 'source']) || consignorCity || '';
          const destination = getFieldValue(row, ['destination', 'tocity', 'destcity', 'dest']) || consigneeCity || '';

          const mode = getFieldValue(row, ['mode', 'freightmode', 'transportmode', 'shipmentmode']) || 'Express LTL';
          const packages = parseInt(getFieldValue(row, ['noboxpkt', 'packages', 'boxes', 'noofboxes', 'qty', 'quantity', 'nopack', 'pack', 'parcels', 'units'])) || 1;
          const actualWeight = parseFloat(getFieldValue(row, ['actualweight', 'weight', 'wt', 'actwt', 'grossweight'])) || 0;
          const chargeableWeight = parseFloat(getFieldValue(row, ['chargeableweight', 'chgweight', 'chargewt', 'billweight', 'chargedwt'])) || actualWeight;
          const volumetricWeight = parseFloat(getFieldValue(row, ['dimensionweight', 'volumetricweight', 'volweight'])) || 0;
          const deliveryDate = formatExcelDate(getFieldValue(row, ['deliverydate', 'actualdeliverydate', 'deldate']));

          const invoiceNumber = getFieldValue(row, ['invoicenumber', 'invoiceno', 'commercialinvoicenumber', 'cin']);
          const invoiceValue = parseFloat(getFieldValue(row, ['invoicevalue', 'invval', 'commercialinvoicevalue'])) || 0;
          const awbNumber = getFieldValue(row, ['awb', 'awbno', 'awbnumber', 'trackingno']);

          const rate = parseFloat(getFieldValue(row, ['rate', 'freightrate', 'rateperkg'])) || 0;
          const docketCharges = parseFloat(getFieldValue(row, ['docketcharges', 'docketcharge'])) || 0;
          const pickupCharges = parseFloat(getFieldValue(row, ['pickupcharges', 'pickupcharge'])) || 0;
          const deliveryCharges = parseFloat(getFieldValue(row, ['deliverycharges', 'deliverycharge'])) || 0;
          const otherCharges = (parseFloat(getFieldValue(row, ['greentax/tsp', 'greentax'])) || 0) + (parseFloat(getFieldValue(row, ['othercharges', 'othercharge'])) || 0);

          const podStatusRaw = getFieldValue(row, ['podstatus', 'pod']).toLowerCase();
          const podStatus = (podStatusRaw.includes('rec') || podStatusRaw.includes('deliv')) ? 'Received' : 'Pending';

          const remarks = getFieldValue(row, ['remarks', 'remark', 'notes', 'comment']);
          const transporter = getFieldValue(row, ['vendorname', 'transporter', 'vendor']);
          const vehicleNo = getFieldValue(row, ['flightnumber-trainnumber', 'flightnumber', 'trainnumber', 'vehiclenumber', 'vehicleno']);

          return {
            selected: true,
            rawRow: row,
            cnNumber,
            cnDate,
            companyName,
            companyCode,
            consignor: { name: consignorName, city: consignorCity },
            consignee: { name: consigneeName, city: consigneeCity },
            origin,
            destination,
            mode,
            packages,
            actualWeight,
            chargeableWeight,
            volumetricWeight,
            deliveryDate,
            invoiceNumber,
            invoiceValue,
            awbNumber,
            rate,
            docketCharges,
            pickupCharges,
            deliveryCharges,
            otherCharges,
            podStatus,
            remarks,
            transporter,
            vehicleNo
          };
        });

        setParsedRows(mapped);
      } catch (err) {
        setError(`Failed to parse Excel file: ${err.message}`);
      }
    };
    reader.readAsBinaryString(uploadedFile);
  };

  const handleDownloadSampleTemplate = () => {
    const sampleData = [
      {
        'DOCKET NO': 'SS154',
        'DOCKET DATE': '2026-08-03',
        'CONSIGNOR': 'TECHNIQUES SURFACES INDIA PVT LTD',
        'CONSIGNEE': 'SANSERA ENGINEERING LIMITED-PLANT 2',
        'BILL TO ': 'TECHNIQUES SURFACES INDIA PVT LTD',
        'ORIGIN': 'PUNE',
        'DESTINATION': 'BANGALORE',
        'INVOICE NUMBER': 'PVDN/26-27/747/748',
        'INVOICE VALUE': 395890,
        'DIMENSION WEIGHT': '',
        'NO. BOX-PKT': 6,
        'ACTUAL WEIGHT': 50,
        'CHARGEABLE WEIGHT': 50,
        'MODE': 'AIR',
        'DELIVERY DATE': '2026-08-03',
        'POD STATUS': 'RECEIVED',
        'REMARKS': '',
        'RATE': 110,
        'DOCKET CHARGES': 150,
        'PICKUP CHARGES': 500,
        'DELIVERY CHARGES': 500,
        'GREEN TAX/TSP': '',
        'OTHER CHARGES': '',
        'GST': 0,
        'AMOUNT': 7800,
        'FLIGHT ': '',
        'VENDOR NAME': 'SPEED SETU LOGISTICS',
        'FLIGHT NUMBER - TRAIN NUMBER': '6E-204',
        'AWB': '84920401'
      }
    ];

    const worksheet = XLSX.utils.json_to_sheet(sampleData);
    const workbook = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(workbook, worksheet, 'Pallavi MIS Template');
    XLSX.writeFile(workbook, 'Pallavi_MIS_Shipments_Template.xlsx');
  };

  const findMatchingCompany = (companyNameRaw, companyCodeRaw, companiesList = []) => {
    if (!companiesList || companiesList.length === 0) return {};

    const clean = (str) => (str || '').toLowerCase().replace(/[^a-z0-9]/g, '').trim();
    const searchName = clean(companyNameRaw);
    const searchCode = clean(companyCodeRaw);

    let match = companiesList.find((c) => {
      const cName = clean(c.companyName);
      const cCode = clean(c.companyCode);
      const cId = clean(c.id || c._id);
      return (
        (searchCode && (cCode === searchCode || cId === searchCode)) ||
        (searchName && cName === searchName)
      );
    });
    if (match) return match;

    match = companiesList.find((c) => {
      const cName = clean(c.companyName);
      return searchName && cName && (searchName.includes(cName) || cName.includes(searchName));
    });
    if (match) return match;

    const words = searchName
      .split(/\s+/)
      .filter((w) => w.length > 2 && !['pvt', 'ltd', 'private', 'limited', 'inc', 'corp', 'india'].includes(w));

    if (words.length > 0) {
      match = companiesList.find((c) => {
        const cText = clean(`${c.companyName} ${c.companyCode}`);
        const count = words.filter((w) => cText.includes(w)).length;
        return count >= Math.min(2, words.length);
      });
      if (match) return match;
    }

    return companiesList[0] || {};
  };

  const handleImportSubmit = async () => {
    const rowsToImport = parsedRows.filter((r) => r.selected);
    if (rowsToImport.length === 0) {
      alert('Please select at least 1 shipment row to import.');
      return;
    }

    setImporting(true);
    setTotalCount(rowsToImport.length);
    setProgress(0);
    setSuccessCount(0);
    setError(null);

    let count = 0;
    try {
      const companies = await companyService.getCompanies();

      for (let i = 0; i < rowsToImport.length; i++) {
        const item = rowsToImport[i];
        
        const matchedComp = findMatchingCompany(item.companyName, item.companyCode, companies);

        const payload = {
          cnNumber: item.cnNumber,
          cnDate: item.cnDate,
          bookingDate: item.cnDate,
          companyId: matchedComp.id || matchedComp._id || 'comp-001',
          companyName: matchedComp.companyName || item.companyName || 'General Corporate Client',
          companyCode: matchedComp.companyCode || item.companyCode || 'GCC',
          consignor: item.consignor,
          consignee: item.consignee,
          origin: item.origin,
          destination: item.destination,
          mode: item.mode,
          packages: item.packages,
          actualWeight: item.actualWeight,
          chargeableWeight: item.chargeableWeight,
          volumetricWeight: item.volumetricWeight,
          rate: item.rate,
          ratePerKg: item.rate,
          docketCharges: item.docketCharges,
          pickupCharges: item.pickupCharges,
          deliveryCharges: item.deliveryCharges,
          otherCharges: item.otherCharges,
          podStatus: item.podStatus,
          remarks: item.remarks,
          commercialInvoices: [
            {
              invoiceNumber: item.invoiceNumber || '',
              invoiceValue: item.invoiceValue || 0,
              ewayBillNumber: '',
              awbNumber: item.awbNumber || ''
            }
          ],
          invoiceDetails: {
            invoiceNumber: item.invoiceNumber || '',
            invoiceDate: item.cnDate,
            invoiceValue: item.invoiceValue || 0,
            invoiceQuantity: item.packages
          },
          operational: {
            actualDeliveryDate: item.deliveryDate,
            transporter: item.transporter,
            vehicle: item.vehicleNo
          }
        };

        try {
          await shipmentService.createShipment(payload);
          count++;
          setSuccessCount(count);
        } catch (err) {
          console.warn(`Failed to import CN ${item.cnNumber}:`, err.message);
        }

        setProgress(i + 1);
      }

      alert(`Successfully imported ${count} of ${rowsToImport.length} shipments from Excel!`);
      if (onImportSuccess) onImportSuccess();
      onClose();
    } catch (err) {
      setError(`Bulk import stopped: ${err.message}`);
    } finally {
      setImporting(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 bg-slate-900/60 backdrop-blur-xs flex items-center justify-center p-4 overflow-y-auto">
      <div className="bg-white rounded-2xl shadow-2xl border border-slate-200 w-full max-w-4xl overflow-hidden flex flex-col max-h-[90vh]">
        {/* HEADER */}
        <div className="bg-slate-900 text-white px-6 py-4 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="p-2 rounded-lg bg-emerald-500/20 text-emerald-400">
              <FileSpreadsheet className="w-6 h-6" />
            </div>
            <div>
              <h2 className="text-base font-bold">Import Shipments from Excel / CSV</h2>
              <p className="text-xs text-slate-400">Bulk upload consignment notes & booking data instantly into Speed Setu DB.</p>
            </div>
          </div>
          <button onClick={onClose} className="text-slate-400 hover:text-white p-1 rounded-lg">
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* BODY */}
        <div className="p-6 overflow-y-auto space-y-5 flex-1">
          {/* ACTION BUTTONS & UPLOAD ZONE */}
          <div className="flex flex-col sm:flex-row items-center justify-between gap-4 bg-slate-50 border border-slate-200 rounded-xl p-4">
            <div className="space-y-1">
              <h4 className="text-xs font-bold text-slate-800 uppercase tracking-wider">Step 1: Upload File or Download Template</h4>
              <p className="text-xs text-slate-500">Supports .xlsx, .xls, and .csv format.</p>
            </div>

            <div className="flex items-center gap-2">
              <button
                onClick={handleDownloadSampleTemplate}
                className="inline-flex items-center gap-1.5 px-3 py-2 text-xs font-bold text-slate-700 bg-white border border-slate-300 rounded-lg hover:bg-slate-100 transition-colors shadow-2xs"
              >
                <Download className="w-4 h-4 text-emerald-600" />
                <span>Download Sample Excel</span>
              </button>

              <label className="inline-flex items-center gap-1.5 px-4 py-2 text-xs font-bold text-white bg-setu-600 hover:bg-setu-700 rounded-lg cursor-pointer transition-colors shadow-2xs">
                <Upload className="w-4 h-4" />
                <span>{fileName ? 'Change File' : 'Browse Excel File'}</span>
                <input type="file" accept=".xlsx,.xls,.csv" onChange={handleFileUpload} className="hidden" />
              </label>
            </div>
          </div>

          {fileName && (
            <div className="flex items-center justify-between bg-emerald-50 border border-emerald-200 rounded-lg px-4 py-2 text-xs font-medium text-emerald-900">
              <span>📄 Loaded: <strong>{fileName}</strong> ({parsedRows.length} rows parsed)</span>
              <button onClick={() => setParsedRows(parsedRows.map((r) => ({ ...r, selected: !r.selected })))} className="text-xs font-bold underline">
                Toggle Select All
              </button>
            </div>
          )}

          {error && (
            <div className="bg-rose-50 border border-rose-200 rounded-lg p-3 text-xs text-rose-700 flex items-center gap-2">
              <AlertCircle className="w-4 h-4 shrink-0" />
              <span>{error}</span>
            </div>
          )}

          {/* PREVIEW TABLE */}
          {parsedRows.length > 0 && (
            <div className="space-y-2">
              <h4 className="text-xs font-bold text-slate-700 uppercase tracking-wider">
                Step 2: Review Parsed Shipments ({parsedRows.filter(r => r.selected).length} Selected)
              </h4>
              <div className="border border-slate-200 rounded-xl overflow-x-auto max-h-64 overflow-y-auto">
                <table className="w-full text-xs text-left border-collapse">
                  <thead className="bg-slate-100 font-extrabold text-slate-700 sticky top-0 border-b border-slate-200 uppercase text-[10px]">
                    <tr>
                      <th className="p-2 text-center">Import</th>
                      <th className="p-2">CN Number</th>
                      <th className="p-2">CN Date</th>
                      <th className="p-2">Company</th>
                      <th className="p-2">Consignor</th>
                      <th className="p-2">Consignee</th>
                      <th className="p-2">Origin → Dest</th>
                      <th className="p-2">Mode</th>
                      <th className="p-2 text-center">Packs</th>
                      <th className="p-2 text-right">Weight</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100 font-medium">
                    {parsedRows.map((row, idx) => (
                      <tr key={idx} className={`hover:bg-slate-50 ${row.selected ? 'bg-white' : 'bg-slate-50/50 opacity-60'}`}>
                        <td className="p-2 text-center">
                          <input
                            type="checkbox"
                            checked={row.selected}
                            onChange={(e) => {
                              const updated = [...parsedRows];
                              updated[idx].selected = e.target.checked;
                              setParsedRows(updated);
                            }}
                            className="rounded text-setu-600 cursor-pointer"
                          />
                        </td>
                        <td className="p-2 font-mono font-bold text-slate-900">{row.cnNumber}</td>
                        <td className="p-2 font-mono text-slate-600">{row.cnDate}</td>
                        <td className="p-2 font-bold text-slate-800 truncate max-w-[120px]">{row.companyName}</td>
                        <td className="p-2 text-slate-700 truncate max-w-[120px]">{row.consignor?.name || '-'}</td>
                        <td className="p-2 text-slate-700 truncate max-w-[120px]">{row.consignee?.name || '-'}</td>
                        <td className="p-2 text-slate-600">{row.origin || '-'} → {row.destination || '-'}</td>
                        <td className="p-2 text-slate-700">{row.mode}</td>
                        <td className="p-2 text-center font-mono">{row.packages}</td>
                        <td className="p-2 text-right font-mono font-bold">{row.chargeableWeight > 0 ? `${row.chargeableWeight} Kg` : '-'}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          )}

          {importing && (
            <div className="space-y-2 bg-slate-900 text-white p-4 rounded-xl">
              <div className="flex items-center justify-between text-xs font-bold">
                <span className="flex items-center gap-2">
                  <RefreshCw className="w-4 h-4 animate-spin text-emerald-400" />
                  Importing Shipments into Database...
                </span>
                <span>{progress} / {totalCount} ({Math.round((progress / totalCount) * 100)}%)</span>
              </div>
              <div className="w-full bg-slate-800 rounded-full h-2 overflow-hidden">
                <div
                  className="bg-emerald-500 h-2 transition-all duration-200"
                  style={{ width: `${(progress / totalCount) * 100}%` }}
                />
              </div>
            </div>
          )}
        </div>

        {/* FOOTER */}
        <div className="bg-slate-50 border-t border-slate-200 px-6 py-4 flex items-center justify-between">
          <button
            onClick={onClose}
            disabled={importing}
            className="px-4 py-2 text-xs font-bold text-slate-600 hover:text-slate-900 bg-white border border-slate-300 rounded-lg"
          >
            Cancel
          </button>

          <button
            onClick={handleImportSubmit}
            disabled={importing || parsedRows.filter((r) => r.selected).length === 0}
            className="inline-flex items-center gap-2 px-5 py-2 text-xs font-bold text-white bg-emerald-600 hover:bg-emerald-700 disabled:opacity-50 rounded-lg shadow-xs transition-colors"
          >
            <CheckCircle2 className="w-4 h-4" />
            <span>Import {parsedRows.filter((r) => r.selected).length} Shipments to DB</span>
          </button>
        </div>
      </div>
    </div>
  );
};
