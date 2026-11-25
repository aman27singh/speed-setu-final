import React, { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { shipmentService } from '../services/shipmentService';
import { billingService } from '../services/billingService';
import { pricingService } from '../services/pricingService';
import { quotationService } from '../services/quotationService';
import { getPricingBadgeInfo } from '../utils/pricingValidation';
import { formatINR, formatDate } from '../utils/formatters';
import { StatusBadge } from '../components/common/StatusBadge';
import { PageHeader } from '../components/common/PageHeader';
import { LoadingState } from '../components/common/LoadingState';
import { EmptyState } from '../components/common/EmptyState';
import { Modal } from '../components/common/Modal';
import { StatusTimeline } from '../components/shipment/StatusTimeline';
import { DocumentUploadModal } from '../components/shipment/DocumentUploadModal';
import { ConsignmentNoteModal } from '../components/shipment/ConsignmentNoteModal';
import { useAuth } from '../context/AuthContext';
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
  ExternalLink,
  ShieldCheck,
  FileCheck
} from 'lucide-react';

export const ShipmentDetailPage = () => {
  const { id } = useParams();
  const navigate = useNavigate();
  const { isDriver } = useAuth();

  const [shipment, setShipment] = useState(null);
  const [billingCalculation, setBillingCalculation] = useState(null);
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState('overview');

  // Modal States
  const [showStatusModal, setShowStatusModal] = useState(false);
  const [showUploadModal, setShowUploadModal] = useState(false);
  const [showCNModal, setShowCNModal] = useState(false);
  const [autoPrintCN, setAutoPrintCN] = useState(false);
  const [selectedDocForPreview, setSelectedDocForPreview] = useState(null);
  const [newStatus, setNewStatus] = useState('');
  const [statusLocation, setStatusLocation] = useState('');
  const [statusRemarks, setStatusRemarks] = useState('');
  const [statusDriver, setStatusDriver] = useState('');
  const [statusVehicle, setStatusVehicle] = useState('');
  const [statusTransporterType, setStatusTransporterType] = useState('Market Driver');
  const [statusTransporter, setStatusTransporter] = useState('Market Driver');
  const [statusPickupCost, setStatusPickupCost] = useState('');

  // Pricing Resolution States
  const [showPricingModal, setShowPricingModal] = useState(false);
  const [pricingAction, setPricingAction] = useState('revalidate');
  const [availableQuotations, setAvailableQuotations] = useState([]);
  const [availableRateCards, setAvailableRateCards] = useState([]);
  const [selectedQuoteId, setSelectedQuoteId] = useState('');
  const [selectedRateCardId, setSelectedRateCardId] = useState('');
  const [pricingResolutionReason, setPricingResolutionReason] = useState('');
  const [savingPricing, setSavingPricing] = useState(false);
  const [loadingPricingOptions, setLoadingPricingOptions] = useState(false);

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
      const data = await shipmentService.getShipment(id);
      setShipment(data);
      setNewStatus(data.status || 'Booked');
      setStatusLocation(typeof data.operational?.currentLocation === 'string' ? data.operational.currentLocation : (data.origin || ''));
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
      console.error('[Shipment Details] Fetch error:', err);
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
      await shipmentService.updateStatus(shipment._id || shipment.id, newStatus);
      setToastMessage(`Status successfully updated to '${newStatus}' & saved to MongoDB!`);
      setShowStatusModal(false);
      setStatusRemarks('');
      fetchShipment();
      setTimeout(() => setToastMessage(''), 4000);
    } catch (err) {
      alert(err.message || 'Failed to update status.');
    }
  };

  const handleOpenPricingModal = async () => {
    setShowPricingModal(true);
    setLoadingPricingOptions(true);
    try {
      const [quotes, rateCards] = await Promise.all([
        quotationService.getQuotations({ companyId: shipment?.companyId || 'All', status: 'Active' }).catch(() => []),
        pricingService.getRateCards({ status: 'Active' }).catch(() => [])
      ]);
      setAvailableQuotations(quotes || []);
      setAvailableRateCards(rateCards || []);
      if (quotes && quotes.length > 0) setSelectedQuoteId(quotes[0].id || quotes[0].quotationNumber);
      if (rateCards && rateCards.length > 0) setSelectedRateCardId(rateCards[0].id || rateCards[0]._id || rateCards[0].rateCardNumber);
    } catch (e) {
      console.warn('Failed to load pricing options:', e.message);
    } finally {
      setLoadingPricingOptions(false);
    }
  };

  const handleSavePricingResolution = async (e) => {
    e.preventDefault();
    setSavingPricing(true);
    try {
      await pricingService.assignPricing(shipment.cnNumber || shipment.id || shipment._id, {
        action: pricingAction,
        quotationId: pricingAction === 'assign_quotation' ? selectedQuoteId : undefined,
        rateCardId: pricingAction === 'assign_rate_card' ? selectedRateCardId : undefined,
        reason: pricingResolutionReason || 'Operational manual assignment',
        modifiedBy: 'Admin User'
      });
      setToastMessage('Pricing agreement successfully updated and validated!');
      setShowPricingModal(false);
      setPricingResolutionReason('');
      await fetchShipment();
      setTimeout(() => setToastMessage(''), 4000);
    } catch (err) {
      alert(err.message || 'Failed to update pricing agreement.');
    } finally {
      setSavingPricing(false);
    }
  };

  if (loading) {
    return <LoadingState message="Loading Consignment Note A-to-Z profile..." />;
  }

  if (!shipment) return null;

  const consignor = shipment.consignor || shipment.shipper || {};
  const consignee = shipment.consignee || {};

  const formatAddress = (contactObj) => {
    const city = contactObj?.city || '';
    const state = contactObj?.state || '';
    const pin = contactObj?.pin || '';
    const parts = [city, state].filter(Boolean).join(', ');
    if (parts && pin) return `${parts} - ${pin}`;
    if (parts) return parts;
    if (pin) return `PIN: ${pin}`;
    return '';
  };

  const tabs = isDriver
    ? [
        { id: 'overview', label: 'Overview' },
        { id: 'documents', label: `Documents (${(shipment.documents || []).length})` },
        { id: 'activity', label: 'Activity Log' }
      ]
    : [
        { id: 'overview', label: 'Overview' },
        { id: 'trip', label: 'Trip' },
        { id: 'pod', label: `POD (${shipment.podStatus || 'Pending'})` },
        { id: 'billing', label: `Billing (${shipment.billingStatus || 'Not Ready'})` },
        { id: 'payments', label: 'Payments' },
        { id: 'expenses', label: 'Expenses' },
        { id: 'documents', label: `Documents (${(shipment.documents || []).length})` },
        { id: 'activity', label: 'Activity Log' }
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

              <span className="text-xs px-2 py-0.5 rounded bg-blue-50 text-blue-800 font-bold border border-blue-200 flex items-center gap-1 shrink-0">
                <User className="w-3.5 h-3.5 text-blue-600" />
                <span>Created by: {shipment.createdByName || shipment.createdBy || shipment.operational?.driver || 'Admin'}</span>
              </span>

              <div className="flex flex-wrap items-center gap-1.5">
                <StatusBadge status={shipment.status || 'Booked'} />
                <StatusBadge status={shipment.podStatus || 'Pending'} />
                {!isDriver && <StatusBadge status={shipment.billingStatus || 'Not Ready'} />}
                {(() => {
                  const pBadge = getPricingBadgeInfo(shipment);
                  return (
                    <span
                      className={`text-xs px-2 py-0.5 rounded font-bold border flex items-center gap-1 shrink-0 ${pBadge.badgeClass}`}
                      title={pBadge.tooltip}
                    >
                      <span className={`w-1.5 h-1.5 rounded-full ${pBadge.dotClass}`}></span>
                      <span>{pBadge.text}</span>
                    </span>
                  );
                })()}
              </div>
            </div>
          </div>
        </div>

        {/* Actions Bar - Uniform Equal-Sized Buttons Grid */}
        <div className="grid grid-cols-2 sm:flex sm:items-center gap-2 sm:gap-2.5 w-full sm:w-auto">
          {/* 1. Pickup Document (CN) */}
          <button
            onClick={() => {
              setAutoPrintCN(false);
              setShowCNModal(true);
            }}
            className="flex items-center justify-center gap-2 px-3 py-2.5 sm:py-2 text-xs font-bold text-slate-900 bg-amber-400 hover:bg-amber-300 rounded-xl shadow-xs transition-all active:scale-95 h-12 sm:h-10 cursor-pointer"
            title="View, Print & Share Official Pickup Document (Consignment Note)"
          >
            <FileText className="w-4 h-4 text-slate-900 flex-shrink-0" />
            <span className="truncate">Print CN</span>
          </button>

          {/* 2. Update Status */}
          <button
            onClick={() => setShowStatusModal(true)}
            className="flex items-center justify-center gap-2 px-3 py-2.5 sm:py-2 text-xs font-bold text-white bg-setu-600 hover:bg-setu-700 rounded-xl shadow-xs transition-all active:scale-95 h-12 sm:h-10 cursor-pointer"
          >
            <RefreshCw className="w-4 h-4 flex-shrink-0" />
            <span className="truncate">Update Status</span>
          </button>

          {/* 3. Upload Document */}
          <button
            onClick={() => setShowUploadModal(true)}
            className="flex items-center justify-center gap-2 px-3 py-2.5 sm:py-2 text-xs font-bold text-slate-700 bg-white border border-slate-300 rounded-xl hover:bg-slate-50 shadow-xs transition-all active:scale-95 h-12 sm:h-10 cursor-pointer"
          >
            <Upload className="w-4 h-4 text-setu-600 flex-shrink-0" />
            <span className="truncate">Upload Doc</span>
          </button>

          {/* 4. Print 2-Up CN */}
          <button
            onClick={() => {
              setAutoPrintCN(true);
              setShowCNModal(true);
            }}
            className="flex items-center justify-center gap-2 px-3 py-2.5 sm:py-2 text-xs font-bold text-slate-700 bg-white border border-slate-300 rounded-xl hover:bg-slate-50 shadow-xs transition-all active:scale-95 h-12 sm:h-10 cursor-pointer"
            title="Directly Print Official Consignment Note (2-up A4)"
          >
            <Printer className="w-4 h-4 text-slate-700 flex-shrink-0" />
            <span className="truncate">Print 2-Up CN</span>
          </button>

          {!isDriver && (
            <button
              onClick={() => navigate(`/admin/shipments/${shipment.id || shipment.cnNumber}/edit`)}
              className="col-span-2 sm:col-span-1 flex items-center justify-center gap-2 px-3 py-2.5 sm:py-2 text-xs font-semibold text-slate-700 bg-white border border-slate-300 rounded-xl hover:bg-slate-50 transition-colors h-12 sm:h-10 cursor-pointer"
            >
              <Edit className="w-4 h-4 flex-shrink-0" />
              <span>Edit Shipment</span>
            </button>
          )}
        </div>
      </div>

      {/* VISUAL MILESTONE TIMELINE COMPONENT */}
      <StatusTimeline currentStatus={shipment.status} statusHistory={shipment.statusHistory} />

      {/* SUMMARY METRICS STRIP */}
      <div className={`bg-white border border-slate-200 rounded-xl p-3.5 sm:p-4 shadow-xs grid grid-cols-2 sm:grid-cols-3 ${isDriver ? 'lg:grid-cols-5' : 'lg:grid-cols-7'} gap-3 sm:gap-4 font-sans`}>
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

        {!isDriver && (
          <>
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
          </>
        )}

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
            {/* DEDICATED SECTION: PRICING & QUOTATION DETAILS */}
            <div className="bg-white border border-slate-200 rounded-xl p-5 shadow-xs space-y-4">
              <div className="flex items-center justify-between border-b border-slate-100 pb-3">
                <div className="flex items-center gap-2">
                  <Receipt className="w-4 h-4 text-setu-600" />
                  <h3 className="text-xs font-bold text-slate-700 uppercase tracking-wider">
                    Pricing & Quotation Details
                  </h3>
                </div>
                {!isDriver && (
                  <button
                    type="button"
                    onClick={handleOpenPricingModal}
                    className="inline-flex items-center gap-1.5 px-2.5 py-1 text-xs font-bold text-setu-700 bg-setu-50 border border-setu-200 rounded hover:bg-setu-100 transition-colors"
                  >
                    <RefreshCw className="w-3.5 h-3.5" />
                    <span>Manage Pricing</span>
                  </button>
                )}
              </div>

              {(() => {
                const pv = shipment.pricingValidation;
                const status = pv?.status;
                const source = pv?.source;

                if (status === 'MATCHED' && source === 'QUOTATION') {
                  return (
                    <div className="space-y-3">
                      <div className="p-3 bg-emerald-50/70 border border-emerald-200 rounded-lg flex items-center justify-between">
                        <div className="flex items-center gap-2">
                          <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0" />
                          <div>
                            <span className="font-bold text-emerald-900 text-xs block">
                              ✓ Quotation Available — {pv.quotationNumber || 'Agreed Quote'}
                            </span>
                            <span className="text-[10px] text-emerald-700 font-mono">
                              Pricing Source: Company Quotation (Version {pv.quotationVersion || 1})
                            </span>
                          </div>
                        </div>
                        <span className="px-2 py-0.5 rounded text-[10px] font-bold bg-emerald-100 text-emerald-800 border border-emerald-300">
                          Active Agreement
                        </span>
                      </div>

                      <div className="grid grid-cols-2 gap-3 text-xs">
                        <div>
                          <span className="text-slate-400 block text-[11px]">Customer / Company</span>
                          <span className="font-bold text-slate-900">{shipment.companyName || 'Customer'}</span>
                        </div>
                        <div>
                          <span className="text-slate-400 block text-[11px]">Quotation Reference</span>
                          <span
                            onClick={() => {
                              if (pv.quotationNumber && pv.quotationNumber !== 'QT-AGREEMENT') {
                                navigate(`/admin/quotations/${encodeURIComponent(pv.quotationNumber)}`);
                              }
                            }}
                            className={`font-bold font-mono text-emerald-700 ${pv.quotationNumber && pv.quotationNumber !== 'QT-AGREEMENT' ? 'cursor-pointer hover:underline' : ''}`}
                          >
                            {pv.quotationNumber || 'QT-AGREEMENT'} (v{pv.quotationVersion || 1})
                          </span>
                        </div>
                        <div>
                          <span className="text-slate-400 block text-[11px]">Pickup Location (Origin)</span>
                          <span className="font-bold font-mono text-slate-800">{pv.origin || shipment.origin}</span>
                        </div>
                        <div>
                          <span className="text-slate-400 block text-[11px]">Drop Location (Destination)</span>
                          <span className="font-bold font-mono text-slate-800">{pv.destination || shipment.destination}</span>
                        </div>
                        <div>
                          <span className="text-slate-400 block text-[11px]">Freight Mode</span>
                          <span className="font-bold text-setu-600">{pv.freightMode || shipment.mode || 'Air'}</span>
                        </div>
                        <div>
                          <span className="text-slate-400 block text-[11px]">Applied Base Freight Rate</span>
                          <span className="font-bold font-mono text-slate-900">
                            ₹{pv.appliedRate || pv.pricingSnapshot?.baseFreightRate || 0} / {pv.rateBasis || pv.pricingSnapshot?.rateBasis || pv.appliedRuleSnapshot?.rateBasis || 'Per KG'}
                          </span>
                        </div>
                        <div>
                          <span className="text-slate-400 block text-[11px]">Minimum Chargeable Weight</span>
                          <span className="font-bold font-mono text-slate-900">{pv.minimumChargeableWeight || pv.pricingSnapshot?.minimumWeight || 50} Kg</span>
                        </div>
                        {(pv.pricingSnapshot?.docketCharges > 0 || pv.pricingSnapshot?.pickupCharges > 0 || pv.pricingSnapshot?.deliveryCharges > 0) && (
                          <div>
                            <span className="text-slate-400 block text-[11px]">Agreement Charges</span>
                            <span className="font-bold font-mono text-slate-800">
                              {[
                                pv.pricingSnapshot?.docketCharges > 0 ? `Docket ₹${pv.pricingSnapshot.docketCharges}` : null,
                                pv.pricingSnapshot?.pickupCharges > 0 ? `Pickup ₹${pv.pricingSnapshot.pickupCharges}` : null,
                                pv.pricingSnapshot?.deliveryCharges > 0 ? `Delivery ₹${pv.pricingSnapshot.deliveryCharges}` : null
                              ].filter(Boolean).join(' • ')}
                            </span>
                          </div>
                        )}
                        <div>
                          <span className="text-slate-400 block text-[11px]">GST Configuration</span>
                          <span className="font-bold text-slate-900">
                            {(() => {
                              const tc = pv.pricingSnapshot?.taxConfiguration || pv.appliedRuleSnapshot?.taxConfiguration;
                              const gstPct = pv.pricingSnapshot?.gstPercentage ?? tc?.gstRate ?? 18;
                              const isRcm = pv.pricingSnapshot?.isRcm || tc?.isRcm || /rcm|reverse\s*charge/i.test(String(tc?.notes || ''));
                              if (tc?.applicable === false || gstPct === 0) return '0% GST Exempt';
                              return `${gstPct}% GST${isRcm ? ' (Under RCM)' : ' Integrated IGST'}`;
                            })()}
                          </span>
                        </div>
                      </div>

                      {pv.validatedAt && (
                        <div className="text-[10px] text-slate-400 font-mono pt-1 border-t border-slate-100">
                          Validated on: {formatDate(pv.validatedAt)}
                        </div>
                      )}
                    </div>
                  );
                }

                if (status === 'MATCHED' && source === 'RATE_CARD') {
                  return (
                    <div className="space-y-3">
                      <div className="p-3 bg-blue-50/70 border border-blue-200 rounded-lg flex items-center justify-between">
                        <div className="flex items-center gap-2">
                          <AlertCircle className="w-4 h-4 text-blue-600 shrink-0" />
                          <div>
                            <span className="font-bold text-blue-950 text-xs block">
                              ⚠ No Company Quotation – Charges Based on Rate Card
                            </span>
                            <span className="text-[10px] text-blue-700 font-mono">
                              Pricing Source: Rate Card ({pv.rateCardNumber || pv.rateCardName || 'Standard'} v{pv.rateCardVersion || 1})
                            </span>
                          </div>
                        </div>
                        <span className="px-2 py-0.5 rounded text-[10px] font-bold bg-blue-100 text-blue-800 border border-blue-300">
                          Rate Card Fallback
                        </span>
                      </div>

                      <div className="grid grid-cols-2 gap-3 text-xs">
                        <div>
                          <span className="text-slate-400 block text-[11px]">Rate Card Name / Number</span>
                          <span className="font-bold font-mono text-blue-800">{pv.rateCardNumber || 'Standard Rate Card'} (v{pv.rateCardVersion || 1})</span>
                        </div>
                        <div>
                          <span className="text-slate-400 block text-[11px]">Applied Route</span>
                          <span className="font-bold font-mono text-slate-800">{pv.origin || shipment.origin} → {pv.destination || shipment.destination}</span>
                        </div>
                        <div>
                          <span className="text-slate-400 block text-[11px]">Freight Mode</span>
                          <span className="font-bold text-setu-600">{pv.freightMode || shipment.mode || 'Air'}</span>
                        </div>
                        <div>
                          <span className="text-slate-400 block text-[11px]">Applied Freight Rate</span>
                          <span className="font-bold font-mono text-slate-900">₹{pv.appliedRate || 0}/Kg</span>
                        </div>
                        <div>
                          <span className="text-slate-400 block text-[11px]">Minimum Chargeable Weight</span>
                          <span className="font-bold font-mono text-slate-900">{pv.minimumChargeableWeight || 50} Kg</span>
                        </div>
                        <div>
                          <span className="text-slate-400 block text-[11px]">Pricing Agreement Type</span>
                          <span className="font-bold text-slate-900">Standard Logistics Rate Card</span>
                        </div>
                      </div>

                      {pv.validatedAt && (
                        <div className="text-[10px] text-slate-400 font-mono pt-1 border-t border-slate-100">
                          Validated on: {formatDate(pv.validatedAt)}
                        </div>
                      )}
                    </div>
                  );
                }

                // PRICING AGREEMENT MISSING
                return (
                  <div className="p-4 bg-rose-50 border-2 border-rose-300 rounded-xl space-y-3 text-xs text-rose-900">
                    <div className="flex items-start gap-2.5">
                      <AlertTriangle className="w-5 h-5 text-rose-600 shrink-0 mt-0.5" />
                      <div className="space-y-1">
                        <span className="font-bold text-sm text-rose-950 block">
                          Pricing Agreement Missing
                        </span>
                        <p className="text-xs text-rose-800 leading-relaxed">
                          The selected company does not have an applicable quotation or rate card for this shipment's pickup and drop locations.
                        </p>
                      </div>
                    </div>

                    <div className="p-3 bg-white/80 border border-rose-200 rounded-lg grid grid-cols-2 gap-2 text-xs font-mono">
                      <div><span className="text-slate-500 font-sans text-[11px] block">Company:</span><strong className="text-slate-900 font-sans">{shipment.companyName || 'Not Set'}</strong></div>
                      <div><span className="text-slate-500 font-sans text-[11px] block">Route:</span><strong className="text-slate-900">{shipment.origin} → {shipment.destination}</strong></div>
                      <div><span className="text-slate-500 font-sans text-[11px] block">Freight Mode:</span><strong className="text-setu-600 font-sans">{shipment.mode || shipment.freightMode || 'Air'}</strong></div>
                      <div><span className="text-slate-500 font-sans text-[11px] block">Booking Date:</span><strong className="text-slate-900 font-sans">{formatDate(shipment.cnDate || shipment.createdAt)}</strong></div>
                      {pv?.overrideConfirmed && (
                        <div className="col-span-2 text-rose-700 text-[11px] font-sans pt-1 border-t border-rose-100">
                          * Saved with pricing override: Confirmed by <strong>{pv.overrideConfirmedBy || 'User'}</strong> on {formatDate(pv.overrideConfirmedAt)}. Tax invoice generation remains blocked.
                        </div>
                      )}
                    </div>

                    {!isDriver && (
                      <div className="pt-1 flex items-center justify-between">
                        <span className="text-[11px] text-rose-700 font-medium">
                          Tax invoice generation blocked until pricing is established.
                        </span>
                        <button
                          type="button"
                          onClick={handleOpenPricingModal}
                          className="px-3.5 py-1.5 text-xs font-bold text-white bg-rose-600 hover:bg-rose-700 rounded-lg shadow-xs inline-flex items-center gap-1.5 transition-colors"
                        >
                          <RefreshCw className="w-3.5 h-3.5" />
                          <span>Assign / Establish Pricing</span>
                        </button>
                      </div>
                    )}
                  </div>
                );
              })()}
            </div>

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
                          {inv.invoiceDate ? `Date: ${inv.invoiceDate} | ` : ''}E-Way: {inv.ewayBillNumber || 'N/A'} {inv.invoiceQuantity ? `| Qty: ${inv.invoiceQuantity} Pcs` : ''} {inv.awbNumber || shipment.awbNumber ? `| AWB: ${inv.awbNumber || shipment.awbNumber}` : ''}
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
                    <span className="text-slate-400 block text-[11px]">Invoice Quantity</span>
                    <span className="font-bold font-mono text-slate-900">{shipment.invoiceDetails?.invoiceQuantity ? `${shipment.invoiceDetails.invoiceQuantity} Pcs` : 'N/A'}</span>
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
              {!isDriver && (
                <>
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
                    ) : shipment.pricingValidation?.status === 'MISSING' || shipment.pricingValidation?.source === 'NONE' ? (
                      <div className="p-3 bg-rose-50 border border-rose-200 rounded-lg text-xs space-y-2">
                        <div className="flex items-center gap-1.5 text-rose-800 font-bold">
                          <AlertTriangle className="w-4 h-4 text-rose-600 shrink-0" />
                          <span>Billing Blocked: Missing agreed quotation or rate card coverage</span>
                        </div>
                        <p className="text-[11px] text-rose-700">
                          This shipment cannot be billed or included in a tax invoice until valid pricing coverage is established for <strong>{shipment.origin} → {shipment.destination}</strong>.
                        </p>
                        {!isDriver && (
                          <button
                            type="button"
                            onClick={handleOpenPricingModal}
                            className="px-3 py-1.5 text-xs font-bold text-white bg-rose-600 hover:bg-rose-700 rounded shadow-xs inline-flex items-center gap-1.5"
                          >
                            <RefreshCw className="w-3.5 h-3.5" />
                            <span>Resolve Pricing Issue</span>
                          </button>
                        )}
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
                </>
              )}
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
                {!isDriver && shipment.operational?.pickupCost > 0 && (
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
                  {!isDriver && (
                    <button
                      onClick={() => navigate('/admin/trips/new')}
                      className="px-2.5 py-1 text-xs font-bold text-setu-700 bg-white border border-setu-200 rounded hover:bg-setu-50"
                    >
                      + Assign to Trip
                    </button>
                  )}
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

          {(shipment.documents || []).length > 0 || shipment.podDocumentUrl ? (
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
              {[
                ...(shipment.documents || []),
                ...(shipment.podDocumentUrl && !(shipment.documents || []).some(d => d.url === shipment.podDocumentUrl) ? [{
                  id: 'pod-photo-doc',
                  name: 'Scanned_POD_Invoice_Photo.jpg',
                  type: 'Proof of Delivery (POD)',
                  size: '1.8 MB',
                  uploadedAt: shipment.updatedAt || 'Recently Uploaded',
                  url: shipment.podDocumentUrl
                }] : [])
              ].map((doc) => {
                const isPhoto = doc.url && (doc.url.startsWith('data:image/') || /\.(png|jpg|jpeg|webp)/i.test(doc.name || doc.url));
                return (
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

                    {isPhoto && (
                      <div
                        className="w-full h-40 bg-slate-900 rounded-lg overflow-hidden border border-slate-200 relative group cursor-pointer"
                        onClick={() => handleOpenDocument(doc)}
                      >
                        <img src={doc.url} alt={doc.name} className="w-full h-full object-contain p-1 group-hover:scale-105 transition-transform" />
                        <div className="absolute inset-0 bg-slate-950/50 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center text-white text-xs font-bold gap-1.5">
                          <Eye className="w-4 h-4 text-setu-400" />
                          <span>View Full Photo</span>
                        </div>
                      </div>
                    )}

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
                );
              })}
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
              <option value="Delivered">Delivered</option>
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

            {selectedDocForPreview.url ? (
              <div className="p-3 bg-slate-900 border border-slate-800 rounded-xl overflow-hidden text-center space-y-2">
                <img
                  src={selectedDocForPreview.url}
                  alt={selectedDocForPreview.name}
                  className="max-w-full max-h-[60vh] object-contain mx-auto rounded-lg shadow-2xl bg-white p-1"
                />
                <div className="text-[11px] font-mono text-slate-400">
                  {selectedDocForPreview.name} ({selectedDocForPreview.type})
                </div>
              </div>
            ) : (
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
            )}
          </div>
        )}
      </Modal>

      {/* CONSIGNMENT NOTE PICKUP DOCUMENT MODAL */}
      <ConsignmentNoteModal
        isOpen={showCNModal}
        onClose={() => {
          setShowCNModal(false);
          setAutoPrintCN(false);
        }}
        shipment={shipment}
        autoPrint={autoPrintCN}
      />

      {/* ASSIGN / REVALIDATE PRICING MODAL */}
      <Modal
        isOpen={showPricingModal}
        onClose={() => setShowPricingModal(false)}
        title={`Manage Pricing Coverage — ${shipment.cnNumber}`}
        footer={
          <>
            <button
              onClick={() => setShowPricingModal(false)}
              className="px-3 py-1.5 text-xs font-semibold text-slate-700 bg-white border border-slate-300 rounded"
            >
              Cancel
            </button>
            <button
              onClick={handleSavePricingResolution}
              disabled={savingPricing}
              className="px-4 py-1.5 text-xs font-bold text-white bg-setu-600 hover:bg-setu-700 rounded shadow-sm inline-flex items-center gap-1.5"
            >
              {savingPricing && <RefreshCw className="w-3.5 h-3.5 animate-spin" />}
              <span>Apply Pricing Resolution</span>
            </button>
          </>
        }
      >
        <form onSubmit={handleSavePricingResolution} className="space-y-4 text-xs">
          <div className="p-3 bg-slate-50 border border-slate-200 rounded-lg space-y-1">
            <div className="font-bold text-slate-800 text-xs">Shipment Route & Parameters</div>
            <div className="text-[11px] text-slate-600 font-mono">
              Customer: <strong>{shipment.companyName}</strong> | Route: <strong>{shipment.origin} → {shipment.destination}</strong> | Mode: <strong>{shipment.mode || shipment.freightMode || 'Air'}</strong>
            </div>
          </div>

          <div>
            <label className="block font-bold text-slate-700 uppercase tracking-wider mb-1.5">
              Resolution Method <span className="text-rose-500">*</span>
            </label>
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-2">
              <label
                className={`p-2.5 rounded-lg border cursor-pointer transition-all flex flex-col justify-between ${
                  pricingAction === 'revalidate'
                    ? 'bg-setu-50 border-setu-500 text-setu-900 font-bold'
                    : 'bg-white border-slate-200 text-slate-700 hover:bg-slate-50'
                }`}
              >
                <input
                  type="radio"
                  name="pricingAction"
                  value="revalidate"
                  checked={pricingAction === 'revalidate'}
                  onChange={() => setPricingAction('revalidate')}
                  className="sr-only"
                />
                <span className="text-xs">Auto Revalidate</span>
                <span className="text-[10px] text-slate-500 font-normal">Check active quotations & rate cards</span>
              </label>

              <label
                className={`p-2.5 rounded-lg border cursor-pointer transition-all flex flex-col justify-between ${
                  pricingAction === 'assign_quotation'
                    ? 'bg-setu-50 border-setu-500 text-setu-900 font-bold'
                    : 'bg-white border-slate-200 text-slate-700 hover:bg-slate-50'
                }`}
              >
                <input
                  type="radio"
                  name="pricingAction"
                  value="assign_quotation"
                  checked={pricingAction === 'assign_quotation'}
                  onChange={() => setPricingAction('assign_quotation')}
                  className="sr-only"
                />
                <span className="text-xs">Assign Quotation</span>
                <span className="text-[10px] text-slate-500 font-normal">Link company quotation agreement</span>
              </label>

              <label
                className={`p-2.5 rounded-lg border cursor-pointer transition-all flex flex-col justify-between ${
                  pricingAction === 'assign_rate_card'
                    ? 'bg-setu-50 border-setu-500 text-setu-900 font-bold'
                    : 'bg-white border-slate-200 text-slate-700 hover:bg-slate-50'
                }`}
              >
                <input
                  type="radio"
                  name="pricingAction"
                  value="assign_rate_card"
                  checked={pricingAction === 'assign_rate_card'}
                  onChange={() => setPricingAction('assign_rate_card')}
                  className="sr-only"
                />
                <span className="text-xs">Assign Rate Card</span>
                <span className="text-[10px] text-slate-500 font-normal">Apply standard rate card</span>
              </label>
            </div>
          </div>

          {pricingAction === 'assign_quotation' && (
            <div>
              <label className="block font-bold text-slate-700 uppercase tracking-wider mb-1">
                Select Active Company Quotation
              </label>
              {loadingPricingOptions ? (
                <div className="p-3 text-slate-500 text-xs">Loading available quotations...</div>
              ) : availableQuotations.length === 0 ? (
                <p className="text-amber-700 text-xs p-2.5 bg-amber-50 border border-amber-200 rounded">
                  No active quotations found for this company in MongoDB.
                </p>
              ) : (
                <select
                  value={selectedQuoteId}
                  onChange={(e) => setSelectedQuoteId(e.target.value)}
                  className="w-full p-2 bg-white border border-slate-300 rounded font-bold text-slate-900"
                >
                  {availableQuotations.map((q) => (
                    <option key={q.id || q.quotationNumber} value={q.id || q.quotationNumber}>
                      {q.quotationNumber} — {q.companyName} (v{q.version || 1})
                    </option>
                  ))}
                </select>
              )}
            </div>
          )}

          {pricingAction === 'assign_rate_card' && (
            <div>
              <label className="block font-bold text-slate-700 uppercase tracking-wider mb-1">
                Select Active Standard Rate Card
              </label>
              {loadingPricingOptions ? (
                <div className="p-3 text-slate-500 text-xs">Loading available rate cards...</div>
              ) : availableRateCards.length === 0 ? (
                <p className="text-amber-700 text-xs p-2.5 bg-amber-50 border border-amber-200 rounded">
                  No active standard rate cards found in MongoDB.
                </p>
              ) : (
                <select
                  value={selectedRateCardId}
                  onChange={(e) => setSelectedRateCardId(e.target.value)}
                  className="w-full p-2 bg-white border border-slate-300 rounded font-bold text-slate-900"
                >
                  {availableRateCards.map((rc) => (
                    <option key={rc.id || rc._id || rc.rateCardNumber} value={rc.id || rc._id || rc.rateCardNumber}>
                      {rc.rateCardNumber} — {rc.name} (v{rc.version || 1})
                    </option>
                  ))}
                </select>
              )}
            </div>
          )}

          <div>
            <label className="block font-bold text-slate-700 uppercase tracking-wider mb-1">
              Reason / Audit Notes <span className="text-rose-500">*</span>
            </label>
            <input
              type="text"
              required
              value={pricingResolutionReason}
              onChange={(e) => setPricingResolutionReason(e.target.value)}
              placeholder="e.g. Agreement signed by customer addendum, verified route waiver"
              className="w-full p-2.5 bg-white border border-slate-300 rounded-md font-medium"
            />
            <span className="text-[10px] text-slate-500">
              This note will be recorded in the shipment's pricing validation audit trail.
            </span>
          </div>
        </form>
      </Modal>
    </div>
  );
};
