import React, { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { shipmentService } from '../services/shipmentService';
import { billingService } from '../services/billingService';
import { formatINR, formatDate } from '../utils/formatters';
import { StatusBadge } from '../components/common/StatusBadge';
import { PageHeader } from '../components/common/PageHeader';
import { LoadingState } from '../components/common/LoadingState';
import { EmptyState } from '../components/common/EmptyState';
import { Modal } from '../components/common/Modal';
import { StatusTimeline } from '../components/shipment/StatusTimeline';
import { DocumentUploadModal } from '../components/shipment/DocumentUploadModal';
import {
  Package,
  Building2,
  User,
  Phone,
  Mail,
  MapPin,
  Truck,
  Edit,
  ArrowLeft,
  FileText,
  Copy,
  Printer,
  Upload,
  Clock,
  CheckCircle2,
  AlertCircle,
  AlertTriangle,
  FileSpreadsheet,
  Receipt,
  DollarSign,
  TrendingUp,
  X,
  RefreshCw,
  Eye,
  Download,
  Trash2,
  ExternalLink
} from 'lucide-react';

export const ShipmentDetailPage = () => {
  const { id } = useParams();
  const navigate = useNavigate();

  const [shipment, setShipment] = useState(null);
  const [billingCalculation, setBillingCalculation] = useState(null);
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState('overview');

  // Modal States
  const [showStatusModal, setShowStatusModal] = useState(false);
  const [showUploadModal, setShowUploadModal] = useState(false);
  const [selectedDocForPreview, setSelectedDocForPreview] = useState(null);
  const [newStatus, setNewStatus] = useState('');
  const [statusLocation, setStatusLocation] = useState('');
  const [statusRemarks, setStatusRemarks] = useState('');
  const [statusDriver, setStatusDriver] = useState('');
  const [statusVehicle, setStatusVehicle] = useState('');
  const [statusTransporterType, setStatusTransporterType] = useState('Market Driver');
  const [statusTransporter, setStatusTransporter] = useState('Market Driver');
  const [statusPickupCost, setStatusPickupCost] = useState('');

  const [toastMessage, setToastMessage] = useState('');

  const handleOpenDocument = (doc) => {
    if (doc.url) {
      const win = window.open();
      if (win) {
        if (doc.url.startsWith('data:application/pdf')) {
          win.document.write(`<iframe src="${doc.url}" frameborder="0" style="border:0; top:0px; left:0px; bottom:0px; right:0px; width:100%; height:100%;" allowfullscreen></iframe>`);
        } else if (doc.url.startsWith('data:image')) {
          win.document.write(`<div style="display:flex;justify-content:center;align-items:center;min-height:100vh;background:#0f172a;"><img src="${doc.url}" style="max-width:90%;max-height:90vh;box-shadow:0 10px 25px rgba(0,0,0,0.5);border-radius:8px;" /></div>`);
        } else {
          win.location.href = doc.url;
        }
      }
    } else {
      setSelectedDocForPreview(doc);
    }
  };

  const handleDownloadDocument = (doc) => {
    const link = document.createElement('a');
    if (doc.url) {
      link.href = doc.url;
    } else {
      const mockText = `SPEED SETU LOGISTICS ARCHIVE DOCUMENT\n===================================\nDocument ID: ${doc.id}\nDocument Name: ${doc.name}\nDocument Type: ${doc.type}\nUploaded At: ${doc.uploadedAt}\nShipment CN: ${shipment.cnNumber}\nCompany: ${shipment.companyName}\nOrigin: ${shipment.origin}\nDestination: ${shipment.destination}\nWeight: ${shipment.actualWeight} Kg / ${shipment.chargeableWeight} Kg\nStatus: ${shipment.status}\n`;
      link.href = 'data:text/plain;charset=utf-8,' + encodeURIComponent(mockText);
    }
    link.download = doc.name || `Document_${shipment.cnNumber}.txt`;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  const fetchShipment = async () => {
    setLoading(true);
    try {
      let data;
      try {
        data = await shipmentService.getShipment(id);
      } catch (err) {
        // Fallback to static mock generator if not in master service list
        data = getShipmentDetailByCN(id);
      }
      setShipment(data);
      setNewStatus(data.status);
      setStatusLocation(data.operational?.currentLocation || data.origin);
      setStatusDriver(data.operational?.driver || '');
      setStatusVehicle(data.operational?.vehicle || '');
      setStatusTransporterType(data.operational?.transporterType || 'Market Driver');
      setStatusTransporter(data.operational?.transporter || 'Market Driver');
      setStatusPickupCost(data.operational?.pickupCost || '');

      try {
        const calc = await billingService.calculateShipmentBill(data.cnNumber || id);
        setBillingCalculation(calc);
      } catch (e) {
        console.warn('[Shipment Details] Billing calculation fallback:', e.message);
      }
    } catch (err) {
      alert(err.message || 'Failed to load shipment profile.');
      navigate('/admin/shipments');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchShipment();
  }, [id]);

  const handleUpdateStatusSubmit = async (e) => {
    e.preventDefault();
    try {
      await shipmentService.updateShipmentStatus(
        shipment.id,
        newStatus,
        statusLocation,
        statusRemarks,
        {
          driver: statusDriver,
          vehicle: statusVehicle,
          transporter: statusTransporter,
          transporterType: statusTransporterType,
          pickupCost: statusPickupCost
        }
      );
      setToastMessage(`Status updated to '${newStatus}' & operational specs saved to MongoDB!`);
      setShowStatusModal(false);
      setStatusRemarks('');
      fetchShipment();
      setTimeout(() => setToastMessage(''), 4000);
    } catch (err) {
      alert(err.message || 'Failed to update status.');
    }
  };

  if (loading) {
    return <LoadingState message="Loading Consignment Note A-to-Z profile..." />;
  }

  if (!shipment) return null;

  const consignor = shipment.consignor || shipment.shipper || {};
  const consignee = shipment.consignee || {};

  const formatAddress = (contactObj, fallbackCity, fallbackState) => {
    const city = contactObj?.city || fallbackCity || '';
    const state = contactObj?.state || fallbackState || '';
    const pin = contactObj?.pin || '';
    const parts = [city, state].filter(Boolean).join(', ');
    if (parts && pin) return `${parts} - ${pin}`;
    if (parts) return parts;
    if (pin) return `PIN: ${pin}`;
    return 'Location Details N/A';
  };

  const tabs = [
    { id: 'overview', label: 'Overview' },
    { id: 'trip', label: 'Trip' },
    { id: 'pod', label: `POD (${shipment.podStatus || 'Pending'})` },
    { id: 'billing', label: `Billing (${shipment.billingStatus || 'Not Ready'})` },
    { id: 'payments', label: 'Payments' },
    { id: 'expenses', label: 'Expenses' },
    { id: 'documents', label: `Documents (${(shipment.documents || []).length})` },
    { id: 'activity', label: 'Activity Log' },
  ];

  return (
    <div className="space-y-6 pb-12">
      {/* Top Header & Actions */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div className="flex items-start sm:items-center gap-3">
          <button
            onClick={() => navigate('/admin/shipments')}
            className="p-2 text-slate-600 bg-white border border-slate-200 rounded-lg hover:bg-slate-50 transition-colors shadow-xs shrink-0 mt-1 sm:mt-0"
            title="Back to Shipments Master"
          >
            <ArrowLeft className="w-4 h-4" />
          </button>

          <div className="space-y-1">
            <div className="flex flex-wrap items-center gap-2">
              <span className="text-[11px] font-bold text-slate-400 uppercase tracking-wider">
                Consignment Note (CN)
              </span>
              <span className="text-[10px] px-1.5 py-0.2 rounded bg-setu-50 font-mono text-setu-700 font-bold border border-setu-100 flex items-center gap-1.5 whitespace-nowrap">
                <span>EWB: {shipment.ewayBillNumber || 'N/A'}</span>
                <span>•</span>
                <span>AWB: {shipment.awbNumber || 'N/A'}</span>
              </span>
            </div>

            <div className="flex flex-wrap items-center gap-2 sm:gap-3">
              <h1 className="text-xl sm:text-2xl font-bold text-slate-900 font-mono tracking-tight">
                {shipment.cnNumber}
              </h1>

              <span
                onClick={() => navigate(`/admin/companies/${shipment.companyId}`)}
                className="text-xs sm:text-sm font-semibold text-slate-700 hover:text-setu-600 cursor-pointer truncate max-w-[180px] sm:max-w-xs"
              >
                {shipment.companyName || 'General Logistics Customer'}
              </span>

              <div className="flex flex-wrap items-center gap-1.5">
                <StatusBadge status={shipment.status || 'Booked'} />
                <StatusBadge status={shipment.podStatus || 'Pending'} />
                <StatusBadge status={shipment.billingStatus || 'Not Ready'} />
              </div>
            </div>
          </div>
        </div>

        {/* Actions Bar */}
        <div className="flex items-center gap-2 flex-wrap w-full sm:w-auto">
          <button
            onClick={() => setShowStatusModal(true)}
            className="inline-flex items-center justify-center gap-1.5 px-3.5 py-1.5 text-xs font-bold text-white bg-setu-600 hover:bg-setu-700 rounded-md shadow-xs transition-colors flex-1 sm:flex-initial"
          >
            <RefreshCw className="w-3.5 h-3.5" />
            <span>Update Status</span>
          </button>

          <button
            onClick={() => setShowUploadModal(true)}
            className="inline-flex items-center justify-center gap-1.5 px-3 py-1.5 text-xs font-bold text-slate-700 bg-white border border-slate-300 rounded-md hover:bg-slate-50 transition-colors flex-1 sm:flex-initial"
          >
            <Upload className="w-3.5 h-3.5 text-setu-600" />
            <span>Upload Document</span>
          </button>

          <button
            onClick={() => navigate(`/admin/shipments/${shipment.id || shipment.cnNumber}/edit`)}
            className="inline-flex items-center justify-center gap-1.5 px-3 py-1.5 text-xs font-semibold text-slate-700 bg-white border border-slate-300 rounded-md hover:bg-slate-50 transition-colors flex-1 sm:flex-initial"
          >
            <Edit className="w-3.5 h-3.5" />
            <span>Edit</span>
          </button>

          <button
            onClick={() => window.print()}
            className="inline-flex items-center justify-center gap-1.5 px-3 py-1.5 text-xs font-semibold text-slate-700 bg-white border border-slate-300 rounded-md hover:bg-slate-50 transition-colors flex-1 sm:flex-initial"
          >
            <Printer className="w-3.5 h-3.5" />
            <span>Print CN</span>
          </button>
        </div>
      </div>

      {/* VISUAL MILESTONE TIMELINE COMPONENT */}
      <StatusTimeline currentStatus={shipment.status} statusHistory={shipment.statusHistory} />

      {/* SUMMARY METRICS STRIP */}
      <div className="bg-white border border-slate-200 rounded-xl p-3.5 sm:p-4 shadow-xs grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-7 gap-3 sm:gap-4 font-sans">
        <div>
          <span className="text-[10px] sm:text-[11px] font-bold text-slate-400 uppercase tracking-wider block">Booking Date</span>
          <span className="text-xs font-bold text-slate-900 font-mono">
            {formatDate(shipment.cnDate || shipment.bookingDate || shipment.createdAt)}
          </span>
        </div>

        <div>
          <span className="text-[10px] sm:text-[11px] font-bold text-slate-400 uppercase tracking-wider block">Freight Mode</span>
          <span className="text-xs font-bold text-setu-600 font-mono">{shipment.mode || shipment.freightMode || 'Express LTL'}</span>
        </div>

        <div>
          <span className="text-[10px] sm:text-[11px] font-bold text-slate-400 uppercase tracking-wider block">Total Packages</span>
          <span className="text-xs font-bold text-slate-900">{shipment.packages || 0} Boxes</span>
        </div>

        <div>
          <span className="text-[10px] sm:text-[11px] font-bold text-slate-400 uppercase tracking-wider block">Gross / Chargeable</span>
          <span className="text-xs font-bold text-slate-900 font-mono">
            {shipment.actualWeight || 0} Kg / {shipment.chargeableWeight || shipment.volumetricWeight || 0} Kg
          </span>
        </div>

        <div>
          <span className="text-[10px] sm:text-[11px] font-bold text-slate-400 uppercase tracking-wider block mb-0.5">Billing Status</span>
          <StatusBadge status={shipment.billingStatus || 'Not Ready'} />
        </div>

        <div>
          <span className="text-[10px] sm:text-[11px] font-bold text-slate-400 uppercase tracking-wider block mb-0.5">Payment Status</span>
          {shipment.paymentStatus === 'Paid' ? (
            <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] sm:text-[11px] font-bold bg-emerald-100 text-emerald-800 border border-emerald-300">
              <span className="w-1.5 h-1.5 rounded-full bg-emerald-500"></span>
              Paid
            </span>
          ) : shipment.paymentStatus === 'Partially Paid' ? (
            <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] sm:text-[11px] font-bold bg-amber-100 text-amber-800 border border-amber-300">
              <span className="w-1.5 h-1.5 rounded-full bg-amber-500"></span>
              Partially Paid
            </span>
          ) : shipment.paymentStatus === 'Unpaid' ? (
            <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] sm:text-[11px] font-bold bg-rose-100 text-rose-800 border border-rose-300">
              <span className="w-1.5 h-1.5 rounded-full bg-rose-500"></span>
              Unpaid
            </span>
          ) : (
            <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] sm:text-[11px] font-bold bg-slate-100 text-slate-600 border border-slate-300">
              <span className="w-1.5 h-1.5 rounded-full bg-slate-400"></span>
              Unbilled
            </span>
          )}
        </div>

        <div>
          <span className="text-[10px] sm:text-[11px] font-bold text-slate-400 uppercase tracking-wider block">Current Location</span>
          <span className="text-xs font-bold text-slate-800 truncate block">
            {shipment.operational?.currentLocation || shipment.origin || 'Branch Hub'}
          </span>
        </div>
      </div>

      {/* NAVIGATION TABS */}
      <div className="border-b border-slate-200 overflow-x-auto max-w-full">
        <nav className="flex space-x-4 sm:space-x-6 min-w-max pb-0.5">
          {tabs.map((t) => (
            <button
              key={t.id}
              onClick={() => setActiveTab(t.id)}
              className={`py-3 px-1 border-b-2 text-xs font-bold whitespace-nowrap transition-colors ${
                activeTab === t.id
                  ? 'border-setu-600 text-setu-600'
                  : 'border-transparent text-slate-500 hover:text-slate-800'
              }`}
            >
              {t.label}
            </button>
          ))}
        </nav>
      </div>

      {/* TAB CONTENT: OVERVIEW */}
      {activeTab === 'overview' && (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          {/* Consignor & Consignee Info Cards */}
          <div className="space-y-6">
            {/* Consignor Card */}
            <div className="bg-white border border-slate-200 rounded-xl p-5 shadow-xs space-y-3">
              <h3 className="text-xs font-bold text-slate-400 uppercase tracking-wider border-b border-slate-100 pb-2 flex items-center justify-between">
                <span>Origin Consignor (Shipper)</span>
                <span className="text-emerald-700 font-mono">{consignor?.code || ''}</span>
              </h3>

              <div className="text-xs space-y-1.5">
                <span className="font-bold text-slate-900 text-sm block">{consignor?.name || 'Shipper Not Specified'}</span>
                {consignor?.address && <p className="text-slate-600">{consignor.address}</p>}
                <p className="text-slate-800 font-medium">
                  {formatAddress(consignor, shipment.origin, '')}
                </p>
                <div className="pt-2 border-t border-slate-100 text-slate-600 font-mono space-y-0.5">
                  <div><strong>GSTIN:</strong> {consignor?.gstin || 'N/A'}</div>
                  <div><strong>Phone:</strong> {consignor?.contact || 'N/A'}</div>
                </div>
              </div>
            </div>

            {/* Consignee Card */}
            <div className="bg-white border border-slate-200 rounded-xl p-5 shadow-xs space-y-3">
              <h3 className="text-xs font-bold text-slate-400 uppercase tracking-wider border-b border-slate-100 pb-2 flex items-center justify-between">
                <span>Destination Consignee (Receiver)</span>
                <span className="text-amber-700 font-mono">{consignee?.code || ''}</span>
              </h3>

              <div className="text-xs space-y-1.5">
                <span className="font-bold text-slate-900 text-sm block">{consignee?.name || 'Consignee Not Specified'}</span>
                {consignee?.address && <p className="text-slate-600">{consignee.address}</p>}
                <p className="text-slate-800 font-medium">
                  {formatAddress(consignee, shipment.destination, '')}
                </p>
                <div className="pt-2 border-t border-slate-100 text-slate-600 font-mono space-y-0.5">
                  <div><strong>GSTIN:</strong> {consignee?.gstin || 'N/A'}</div>
                  <div><strong>Phone:</strong> {consignee?.contact || 'N/A'}</div>
                </div>
              </div>
            </div>
          </div>

          {/* Commercial Specs & Operational Linehaul */}
          <div className="space-y-6">
            {/* Commercial Invoice Info */}
            <div className="bg-white border border-slate-200 rounded-xl p-5 shadow-xs space-y-3">
              <h3 className="text-xs font-bold text-slate-400 uppercase tracking-wider border-b border-slate-100 pb-2 flex items-center justify-between">
                <span>Shipper Commercial Invoices ({shipment.commercialInvoices?.length || 1})</span>
                <span className="text-[11px] font-mono text-emerald-700 font-bold">{formatINR(shipment.invoiceDetails?.invoiceValue || 0)}</span>
              </h3>

              {shipment.commercialInvoices && shipment.commercialInvoices.length > 0 ? (
                <div className="space-y-2 text-xs">
                  {shipment.commercialInvoices.map((inv, idx) => (
                    <div key={idx} className="p-2.5 bg-slate-50 border border-slate-200 rounded-lg flex items-center justify-between font-mono text-xs">
                      <div>
                        <span className="font-bold text-slate-900 block">Inv #{inv.invoiceNumber || 'N/A'}</span>
                        <span className="text-[10px] text-slate-500 font-sans">
                          E-Way: {inv.ewayBillNumber || 'N/A'} {inv.awbNumber || shipment.awbNumber ? `| AWB: ${inv.awbNumber || shipment.awbNumber}` : ''}
                        </span>
                      </div>
                      <span className="font-bold text-emerald-700">{formatINR(inv.invoiceValue || 0)}</span>
                    </div>
                  ))}
                </div>
              ) : (
                <div className="grid grid-cols-2 gap-3 text-xs">
                  <div>
                    <span className="text-slate-400 block text-[11px]">Invoice Number</span>
                    <span className="font-bold font-mono text-slate-900">{shipment.invoiceDetails?.invoiceNumber || 'N/A'}</span>
                  </div>
                  <div>
                    <span className="text-slate-400 block text-[11px]">Invoice Date</span>
                    <span className="font-bold font-mono text-slate-900">{shipment.invoiceDetails?.invoiceDate || 'N/A'}</span>
                  </div>
                  <div>
                    <span className="text-slate-400 block text-[11px]">Declared Cargo Value</span>
                    <span className="font-bold font-mono text-emerald-700">{formatINR(shipment.invoiceDetails?.invoiceValue || 0)}</span>
                  </div>
                  <div>
                    <span className="text-slate-400 block text-[11px]">E-Way Bill Number</span>
                    <span className="font-bold font-mono text-slate-900">{shipment.ewayBillNumber || 'N/A'}</span>
                  </div>
                  <div>
                    <span className="text-slate-400 block text-[11px]">AWB / Air Waybill No.</span>
                    <span className="font-bold font-mono text-slate-900">{shipment.awbNumber || 'N/A'}</span>
                  </div>
                </div>
              )}

              <div className="pt-2 border-t border-slate-100 text-xs">
                <span className="text-slate-400 block text-[11px]">Commodity Specs</span>
                <p className="font-medium text-slate-800">{shipment.materialDescription || 'General Cargo'}</p>
              </div>

              {/* CALCULATED LINE ITEMS & FREIGHT CHARGES CARD */}
              <div className="pt-3 border-t border-slate-100 space-y-2">
                <span className="text-xs font-bold text-slate-400 uppercase tracking-wider block">
                  Calculated Line Items & Freight Charges
                </span>

                <div className="p-3.5 bg-slate-50 border border-slate-200 rounded-lg text-xs space-y-2.5">
                  {billingCalculation?.lineItems && billingCalculation.lineItems.length > 0 ? (
                    <>
                      {billingCalculation.lineItems.map((item, idx) => (
                        <div key={idx} className="flex justify-between items-start pb-1.5 border-b border-slate-200/80 gap-3">
                          <div>
                            <span className="font-bold text-slate-800 block text-xs">{item.name || item.description}</span>
                            {item.description && item.description !== item.name && (
                              <span className="text-[10px] text-slate-500 font-mono block leading-tight">{item.description}</span>
                            )}
                          </div>
                          <span className="font-mono font-bold text-slate-900 shrink-0 text-xs">{formatINR(item.amount)}</span>
                        </div>
                      ))}

                      <div className="pt-1 space-y-1 font-mono text-xs">
                        <div className="flex justify-between text-slate-600">
                          <span>Taxable Subtotal:</span>
                          <strong className="text-slate-900">{formatINR(billingCalculation.subTotal || billingCalculation.taxableAmount)}</strong>
                        </div>
                        <div className="flex justify-between text-slate-600">
                          <span>GST ({billingCalculation.gstRate || 18}% IGST):</span>
                          <strong className="text-slate-900">{formatINR(billingCalculation.gstAmount)}</strong>
                        </div>
                        <div className="flex justify-between pt-1.5 border-t border-slate-300 font-bold text-sm">
                          <span className="text-slate-900">Grand Total Billed Value:</span>
                          <span className="text-setu-700">{formatINR(billingCalculation.grandTotal)}</span>
                        </div>
                      </div>
                    </>
                  ) : (
                    <div className="p-3.5 bg-amber-50/80 border border-amber-200 rounded-lg text-xs space-y-1.5 text-amber-900">
                      <div className="flex items-center gap-1.5 font-bold text-amber-950">
                        <AlertTriangle className="w-4 h-4 text-amber-600 shrink-0" />
                        <span>No Active Quotation / Rate Card Found</span>
                      </div>
                      <p className="text-[11px] text-amber-800 leading-relaxed">
                        No rate card exists in MongoDB for <strong>{shipment.companyName || 'this company'}</strong>. Create a Quotation in <em>Commercial → Quotations</em> to configure freight rates and automated charges.
                      </p>
                    </div>
                  )}
                </div>
              </div>

              {/* FREIGHT BILLING CARD */}
              <div className="pt-3 border-t border-slate-100">
                {shipment.invoiceId ? (
                  <div className="p-3 bg-emerald-50/70 border border-emerald-200 rounded-lg flex flex-col sm:flex-row items-start sm:items-center justify-between gap-2 text-xs">
                    <div>
                      <span className="text-[10px] font-bold text-emerald-700 uppercase tracking-wider block">GST Freight Invoice</span>
                      <span className="font-bold font-mono text-slate-900 text-sm">{shipment.invoiceId}</span>
                    </div>

                    <div className="flex items-center gap-2">
                      <button
                        type="button"
                        onClick={async () => {
                          if (window.confirm(`Do you want to reset billing for ${shipment.cnNumber} and recalculate with updated rate card values?`)) {
                            try {
                              await shipmentService.updateShipment(shipment.id || shipment.cnNumber, {
                                billingStatus: 'Not Ready',
                                invoiceId: ''
                              });
                              navigate(`/admin/billing/create?shipmentId=${shipment.cnNumber}`);
                            } catch (err) {
                              alert('Failed to reset billing status: ' + err.message);
                            }
                          }
                        }}
                        className="px-3 py-1.5 text-xs font-bold text-slate-700 bg-white border border-slate-300 rounded hover:bg-slate-50 transition-colors"
                      >
                        Recalculate & Re-Generate Bill
                      </button>

                      <button
                        onClick={() => navigate(`/admin/billing/invoices/${shipment.invoiceId.toLowerCase()}`)}
                        className="px-3 py-1.5 text-xs font-bold text-white bg-setu-600 hover:bg-setu-700 rounded shadow-xs"
                      >
                        View Invoice
                      </button>
                    </div>
                  </div>
                ) : (
                  <div className="p-3 bg-slate-50 border border-slate-200 rounded-lg text-xs flex items-center justify-between text-slate-500">
                    <span>Billing: <strong>Ready for Billing</strong></span>
                    <button
                      onClick={() => navigate(`/admin/billing/create?shipmentId=${shipment.cnNumber}`)}
                      className="px-3 py-1.5 text-xs font-bold text-white bg-setu-600 hover:bg-setu-700 rounded shadow-xs"
                    >
                      Review & Generate Bill
                    </button>
                  </div>
                )}
              </div>
            </div>

            {/* Linehaul Dispatch Info */}
            <div className="bg-white border border-slate-200 rounded-xl p-5 shadow-xs space-y-4">
              <h3 className="text-xs font-bold text-slate-400 uppercase tracking-wider border-b border-slate-100 pb-2 flex items-center justify-between">
                <span>First Mile & Dispatch Vehicle Specs</span>
                <span className="text-setu-600 font-mono text-[11px]">{shipment.operational?.transporterType || 'Transporter'}</span>
              </h3>

              <div className="text-xs space-y-2.5">
                <div>
                  <span className="text-slate-400 block text-[11px]">Transporter / Fleet Category</span>
                  <span className="font-bold text-slate-900">{shipment.operational?.transporter || shipment.operational?.transporterType || 'Speed Setu Fleet'}</span>
                </div>
                <div className="grid grid-cols-2 gap-2">
                  <div>
                    <span className="text-slate-400 block text-[11px]">Vehicle Number</span>
                    <span className="font-bold font-mono text-setu-700">{shipment.operational?.vehicle || 'Not Specified'}</span>
                  </div>
                  <div>
                    <span className="text-slate-400 block text-[11px]">Assigned Driver</span>
                    <span className="font-bold text-slate-900">{shipment.operational?.driver || 'Not Specified'}</span>
                  </div>
                </div>
                {shipment.operational?.pickupCost > 0 && (
                  <div className="pt-2 border-t border-slate-100 flex items-center justify-between font-mono text-xs">
                    <span className="text-slate-600">Pickup Hire Cost (Driver Payable):</span>
                    <span className="font-bold text-amber-700">{formatINR(shipment.operational.pickupCost)}</span>
                  </div>
                )}
              </div>

              {/* ASSIGNED TRIP CARD */}
              {shipment.operational?.tripId ? (
                <div className="p-3 bg-setu-50/70 border border-setu-200 rounded-lg flex items-center justify-between text-xs">
                  <div>
                    <span className="text-[10px] font-bold text-setu-600 uppercase tracking-wider block">Assigned Linehaul Trip</span>
                    <span className="font-bold font-mono text-slate-900 text-sm">{shipment.operational.tripId}</span>
                  </div>

                  <button
                    onClick={() => navigate(`/admin/trips/${shipment.operational.tripId.toLowerCase()}`)}
                    className="px-3 py-1.5 text-xs font-bold text-white bg-setu-600 hover:bg-setu-700 rounded shadow-xs"
                  >
                    View Trip
                  </button>
                </div>
              ) : (
                <div className="p-3 bg-slate-50 border border-slate-200 rounded-lg text-xs flex items-center justify-between text-slate-500">
                  <span>Trip: <strong>Not Assigned</strong></span>
                  <button
                    onClick={() => navigate('/admin/trips/new')}
                    className="px-2.5 py-1 text-xs font-bold text-setu-700 bg-white border border-setu-200 rounded hover:bg-setu-50"
                  >
                    + Assign to Trip
                  </button>
                </div>
              )}
            </div>
          </div>
        </div>
      )}

      {/* TAB CONTENT: DOCUMENTS */}
      {activeTab === 'documents' && (
        <div className="bg-white border border-slate-200 rounded-xl p-5 shadow-xs space-y-4">
          <div className="flex items-center justify-between">
            <h3 className="text-sm font-bold text-slate-900">Shipment Documents & ePOD Archive</h3>
            <button
              onClick={() => setShowUploadModal(true)}
              className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-bold text-white bg-setu-600 hover:bg-setu-700 rounded transition-colors"
            >
              <Upload className="w-3.5 h-3.5" />
              <span>Upload Document</span>
            </button>
          </div>

          {(shipment.documents || []).length > 0 ? (
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
              {shipment.documents.map((doc) => (
                <div key={doc.id} className="p-4 bg-slate-50 border border-slate-200 rounded-xl flex flex-col justify-between space-y-3 hover:border-setu-300 transition-all">
                  <div className="flex items-start gap-3">
                    <div className="p-2.5 rounded-lg bg-blue-100 text-setu-600 shrink-0">
                      <FileText className="w-5 h-5" />
                    </div>
                    <div className="min-w-0 flex-1">
                      <span className="font-bold text-slate-900 text-xs block truncate" title={doc.name}>
                        {doc.name}
                      </span>
                      <span className="text-[10px] text-slate-500 block font-mono">
                        {doc.type} • {doc.size || 'Attachment'}
                      </span>
                      <span className="text-[10px] text-slate-400 block">{doc.uploadedAt}</span>
                    </div>
                  </div>

                  <div className="flex items-center gap-2 pt-2 border-t border-slate-200/60">
                    <button
                      onClick={() => handleOpenDocument(doc)}
                      className="flex-1 inline-flex items-center justify-center gap-1 py-1.5 px-2 text-[11px] font-bold text-setu-700 bg-white border border-setu-200 rounded hover:bg-setu-50 transition-colors"
                    >
                      <Eye className="w-3.5 h-3.5" />
                      <span>View / Open</span>
                    </button>
                    <button
                      onClick={() => handleDownloadDocument(doc)}
                      className="inline-flex items-center justify-center p-1.5 text-slate-600 bg-white border border-slate-300 rounded hover:bg-slate-100 transition-colors"
                      title="Download Document"
                    >
                      <Download className="w-3.5 h-3.5" />
                    </button>
                  </div>
                </div>
              ))}
            </div>
          ) : (
            <EmptyState
              icon={FileText}
              title="No documents uploaded yet"
              description={`Consignment Notes, invoices, and e-way bills for ${shipment.cnNumber} will appear here.`}
            />
          )}
        </div>
      )}

      {/* TAB CONTENT: ACTIVITY LOG */}
      {activeTab === 'activity' && (
        <div className="bg-white border border-slate-200 rounded-xl p-5 shadow-xs space-y-4">
          <h3 className="text-sm font-bold text-slate-900">Chronological Operational Activity Log</h3>

          <div className="space-y-4">
            {(shipment.statusHistory || []).map((h, idx) => (
              <div key={idx} className="flex items-start gap-3 text-xs border-l-2 border-setu-600 pl-4 py-1">
                <div>
                  <div className="flex items-center gap-2">
                    <span className="font-bold text-slate-900">{h.status}</span>
                    <span className="text-[10px] font-mono text-slate-400">{h.timestamp}</span>
                  </div>
                  <span className="text-slate-600 block">{h.remarks}</span>
                  {h.location && <span className="text-[10px] text-slate-400 font-mono block">Location: {h.location}</span>}
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* TAB CONTENT: PLACEHOLDERS (TRIP, POD, BILLING, PAYMENTS, EXPENSES) */}
      {activeTab === 'trip' && (
        <div className="bg-white border border-slate-200 rounded-xl p-8 text-center">
          <EmptyState
            icon={Truck}
            title="Trip Sheet & Dispatch Details"
            description={`Trip sheet assignment, driver loading slip, fuel voucher logs for ${shipment.cnNumber} will appear here.`}
          />
        </div>
      )}

      {activeTab === 'pod' && (
        <div className="bg-white border border-slate-200 rounded-xl p-8 text-center">
          <EmptyState
            icon={FileCheck}
            title="Proof of Delivery (POD) Module"
            description={`Physical POD scan, OCR verification & delivery exception handling for ${shipment.cnNumber} will appear here.`}
          />
        </div>
      )}

      {activeTab === 'billing' && (
        <div className="bg-white border border-slate-200 rounded-xl p-8 text-center">
          <EmptyState
            icon={Receipt}
            title="Freight Billing & Invoicing"
            description={`Auto-calculated freight invoice from Chunk 3 Rate Cards for ${shipment.cnNumber} will appear here.`}
          />
        </div>
      )}

      {activeTab === 'payments' && (
        <div className="bg-white border border-slate-200 rounded-xl p-8 text-center">
          <EmptyState
            icon={DollarSign}
            title="Customer Payments & Collections"
            description={`Payment collections for ${shipment.cnNumber} will appear here.`}
          />
        </div>
      )}

      {activeTab === 'expenses' && (
        <div className="bg-white border border-slate-200 rounded-xl p-8 text-center">
          <EmptyState
            icon={TrendingUp}
            title="Shipment Linehaul Expenses"
            description={`Fuel expenses, toll charges & trip costs for ${shipment.cnNumber} will appear here.`}
          />
        </div>
      )}

      {/* UPDATE STATUS MODAL */}
      <Modal
        isOpen={showStatusModal}
        onClose={() => setShowStatusModal(false)}
        title={`Update Operational Status — ${shipment.cnNumber}`}
        footer={
          <>
            <button
              onClick={() => setShowStatusModal(false)}
              className="px-3 py-1.5 text-xs font-semibold text-slate-700 bg-white border border-slate-300 rounded"
            >
              Cancel
            </button>
            <button
              onClick={handleUpdateStatusSubmit}
              className="px-4 py-1.5 text-xs font-bold text-white bg-setu-600 hover:bg-setu-700 rounded shadow-sm"
            >
              Save Status Update
            </button>
          </>
        }
      >
        <form onSubmit={handleUpdateStatusSubmit} className="space-y-4 text-xs">
          <div>
            <label className="block font-bold text-slate-700 uppercase tracking-wider mb-1">
              New Operational Status <span className="text-rose-500">*</span>
            </label>
            <select
              value={newStatus}
              onChange={(e) => setNewStatus(e.target.value)}
              className="w-full p-2.5 bg-slate-50 border border-slate-300 rounded-md font-bold text-slate-900"
            >
              <option value="Booked">Booked</option>
              <option value="Picked Up">Picked Up</option>
              <option value="In Transit">In Transit</option>
              <option value="Reached Destination">Reached Destination</option>
              <option value="Out for Delivery">Out for Delivery</option>
              <option value="Partially Delivered">Partially Delivered</option>
              <option value="Delivered">Delivered</option>
              <option value="Delayed">Delayed</option>
              <option value="Cancelled">Cancelled</option>
            </select>
          </div>

          <div>
            <label className="block font-bold text-slate-700 uppercase tracking-wider mb-1">
              Current Location Tag
            </label>
            <input
              type="text"
              value={statusLocation}
              onChange={(e) => setStatusLocation(e.target.value)}
              placeholder="e.g. Panvel Toll Gate, MH"
              className="w-full p-2.5 bg-slate-50 border border-slate-300 rounded-md font-medium"
            />
          </div>

          {/* PICKED UP DISPATCH SPECS & MARKET DRIVER COSTS */}
          {newStatus === 'Picked Up' && (
            <div className="p-3.5 bg-blue-50/80 border border-blue-200 rounded-lg space-y-3">
              <div className="font-bold text-blue-950 flex items-center gap-1.5 text-xs">
                <Truck className="w-4 h-4 text-blue-600" />
                <span>First Mile Pickup Dispatch & Driver Details</span>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <label className="block font-bold text-slate-700 uppercase tracking-wider mb-1 text-[11px]">
                    Transporter / Vehicle Category
                  </label>
                  <select
                    value={statusTransporterType}
                    onChange={(e) => setStatusTransporterType(e.target.value)}
                    className="w-full p-2 bg-white border border-slate-300 rounded font-medium text-xs text-slate-900"
                  >
                    <option value="Market Driver">Market Driver / Hired Vehicle</option>
                    <option value="Dedicated Fleet">Speed Setu Fleet (Company Owned)</option>
                    <option value="Third-Party Vendor">Third-Party Transporter Vendor</option>
                  </select>
                </div>

                <div>
                  <label className="block font-bold text-slate-700 uppercase tracking-wider mb-1 text-[11px]">
                    Transporter / Vendor Name
                  </label>
                  <input
                    type="text"
                    value={statusTransporter}
                    onChange={(e) => setStatusTransporter(e.target.value)}
                    placeholder="e.g. Market Driver / VRL Logistics"
                    className="w-full p-2 bg-white border border-slate-300 rounded font-medium text-xs"
                  />
                </div>

                <div>
                  <label className="block font-bold text-slate-700 uppercase tracking-wider mb-1 text-[11px]">
                    Driver Name & Contact
                  </label>
                  <input
                    type="text"
                    value={statusDriver}
                    onChange={(e) => setStatusDriver(e.target.value)}
                    placeholder="e.g. Suresh Kumar (+91 98765 43210)"
                    className="w-full p-2 bg-white border border-slate-300 rounded font-medium text-xs"
                  />
                </div>

                <div>
                  <label className="block font-bold text-slate-700 uppercase tracking-wider mb-1 text-[11px]">
                    Vehicle Number
                  </label>
                  <input
                    type="text"
                    value={statusVehicle}
                    onChange={(e) => setStatusVehicle(e.target.value)}
                    placeholder="e.g. KA-05-MN-4321"
                    className="w-full p-2 bg-white border border-slate-300 rounded font-medium text-xs font-mono uppercase"
                  />
                </div>
              </div>

              <div>
                <label className="block font-bold text-slate-700 uppercase tracking-wider mb-1 text-[11px]">
                  Pickup Freight Cost / Market Driver Hire Charge (₹)
                </label>
                <div className="relative">
                  <span className="absolute left-2.5 top-2 text-slate-400 font-bold">₹</span>
                  <input
                    type="number"
                    min="0"
                    value={statusPickupCost}
                    onChange={(e) => setStatusPickupCost(e.target.value)}
                    placeholder="e.g. 2500 (Leave 0 if company fleet or no extra cost)"
                    className="w-full pl-7 p-2 bg-white border border-slate-300 rounded font-bold text-slate-900 text-xs"
                  />
                </div>
                <p className="text-[10px] text-blue-700 mt-1">
                  * Entering a pickup cost will automatically create an Operational Expense & Market Driver Payable entry in MongoDB.
                </p>
              </div>
            </div>
          )}

          <div>
            <label className="block font-bold text-slate-700 uppercase tracking-wider mb-1">
              Status Update Remarks
            </label>
            <textarea
              rows={3}
              value={statusRemarks}
              onChange={(e) => setStatusRemarks(e.target.value)}
              placeholder="Provide dispatch update notes for audit timeline..."
              className="w-full p-2.5 bg-slate-50 border border-slate-300 rounded-md font-medium"
            />
          </div>
        </form>
      </Modal>

      {/* DOCUMENT UPLOAD MODAL */}
      <DocumentUploadModal
        isOpen={showUploadModal}
        onClose={() => setShowUploadModal(false)}
        shipmentId={shipment.cnNumber || shipment.id || shipment._id}
        onUploadSuccess={() => {
          setToastMessage('Document uploaded successfully!');
          fetchShipment();
          setTimeout(() => setToastMessage(''), 4000);
        }}
      />

      {/* DOCUMENT PREVIEW MODAL */}
      <Modal
        isOpen={!!selectedDocForPreview}
        onClose={() => setSelectedDocForPreview(null)}
        title={`Document Viewer — ${selectedDocForPreview?.name || 'Document'}`}
        footer={
          <div className="flex items-center justify-between w-full">
            <span className="text-xs text-slate-500 font-mono">
              Archived for CN: <strong>{shipment.cnNumber}</strong>
            </span>
            <div className="flex items-center gap-2">
              <button
                onClick={() => handleDownloadDocument(selectedDocForPreview)}
                className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-bold text-slate-700 bg-white border border-slate-300 rounded hover:bg-slate-50"
              >
                <Download className="w-3.5 h-3.5" />
                <span>Download</span>
              </button>
              <button
                onClick={() => window.print()}
                className="inline-flex items-center gap-1.5 px-3.5 py-1.5 text-xs font-bold text-white bg-setu-600 rounded hover:bg-setu-700"
              >
                <Printer className="w-3.5 h-3.5" />
                <span>Print Document</span>
              </button>
            </div>
          </div>
        }
      >
        {selectedDocForPreview && (
          <div className="space-y-4 text-xs">
            <div className="p-4 bg-slate-900 text-white rounded-xl space-y-3">
              <div className="flex items-center justify-between border-b border-slate-700 pb-2">
                <div className="flex items-center gap-2">
                  <FileText className="w-5 h-5 text-setu-400" />
                  <span className="font-bold text-sm tracking-wide">{selectedDocForPreview.name}</span>
                </div>
                <span className="px-2 py-0.5 text-[10px] font-bold rounded bg-setu-500/20 text-setu-300 border border-setu-500/30">
                  {selectedDocForPreview.type}
                </span>
              </div>

              <div className="grid grid-cols-2 gap-3 text-slate-300 font-mono text-[11px]">
                <div>Consignment Note: <strong className="text-white">{shipment.cnNumber}</strong></div>
                <div>Uploaded Date: <strong className="text-white">{selectedDocForPreview.uploadedAt}</strong></div>
                <div>Shipper / Company: <strong className="text-white">{shipment.companyName}</strong></div>
                <div>File Size: <strong className="text-white">{selectedDocForPreview.size || '1.5 MB'}</strong></div>
              </div>
            </div>

            <div className="p-6 bg-slate-50 border-2 border-dashed border-slate-300 rounded-xl text-center space-y-3">
              <div className="font-mono text-slate-800 text-sm font-bold">
                📄 [OFFICIAL LOGISTICS ARCHIVE RECORD]
              </div>
              <p className="text-slate-600 text-xs max-w-md mx-auto">
                This document is securely archived under Speed Setu ERP for Consignment Note <strong>{shipment.cnNumber}</strong> ({shipment.origin} → {shipment.destination}).
              </p>
              <div className="inline-flex items-center gap-2 px-3 py-1 bg-emerald-100 text-emerald-800 rounded font-mono text-[11px] font-bold">
                <CheckCircle2 className="w-3.5 h-3.5 text-emerald-600" />
                <span>Verified ePOD / Operational Record</span>
              </div>
            </div>
          </div>
        )}
      </Modal>
    </div>
  );
};
