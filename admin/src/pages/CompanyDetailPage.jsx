import React, { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { companyService } from '../services/companyService';
import { quotationService } from '../services/quotationService';
import { shipmentService } from '../services/shipmentService';
import { billingService } from '../services/billingService';
import { paymentService } from '../services/paymentService';
import { formatINR, formatDate } from '../utils/formatters';
import { StatusBadge } from '../components/common/StatusBadge';
import { LoadingState } from '../components/common/LoadingState';
import { Modal } from '../components/common/Modal';
import {
  Building2,
  User,
  Phone,
  Mail,
  MapPin,
  CreditCard,
  Truck,
  Edit,
  Trash2,
  ArrowLeft,
  FileCheck,
  AlertCircle,
  FileSpreadsheet,
  Receipt,
  DollarSign,
  TrendingUp,
  Clock,
  Package,
  Plus
} from 'lucide-react';

export const CompanyDetailPage = () => {
  const { id } = useParams();
  const navigate = useNavigate();

  const [company, setCompany] = useState(null);
  const [rateCards, setRateCards] = useState([]);
  const [shipments, setShipments] = useState([]);
  const [invoices, setInvoices] = useState([]);
  const [payments, setPayments] = useState([]);
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState('overview');

  // Deactivation Modal State
  const [showDeactivateModal, setShowDeactivateModal] = useState(false);
  const [toastMessage, setToastMessage] = useState('');

  const fetchCompanyData = async () => {
    setLoading(true);
    try {
      const [compData, quotesData, allShipments, allInvoices, allPayments] = await Promise.all([
        companyService.getCompany(id),
        quotationService.getCompanyRateCards(id).catch(() => []),
        shipmentService.getShipments().catch(() => []),
        billingService.getInvoices().catch(() => []),
        paymentService.getPayments().catch(() => [])
      ]);

      const compNameLower = (compData.companyName || '').toLowerCase().trim();
      const compIdLower = (compData.id || compData.companyId || '').toLowerCase().trim();
      const compCodeLower = (compData.companyCode || '').toLowerCase().trim();

      const matchedShipments = allShipments.filter((s) => {
        const cId = (s.companyId || '').toLowerCase().trim();
        const cName = (s.companyName || '').toLowerCase().trim();
        const cCode = (s.companyCode || '').toLowerCase().trim();
        return (cId && cId === compIdLower) || (cCode && cCode === compCodeLower) || (cName && (cName.includes(compNameLower) || compNameLower.includes(cName)));
      });

      const matchedInvoices = allInvoices.filter((inv) => {
        const cId = (inv.companyId || '').toLowerCase().trim();
        const cName = (inv.companyName || '').toLowerCase().trim();
        return (cId && cId === compIdLower) || (cName && (cName.includes(compNameLower) || compNameLower.includes(cName)));
      });

      const matchedPayments = allPayments.filter((p) => {
        const cId = (p.companyId || '').toLowerCase().trim();
        const cName = (p.companyName || '').toLowerCase().trim();
        return (cId && cId === compIdLower) || (cName && (cName.includes(compNameLower) || compNameLower.includes(cName)));
      });

      // Filter out cancelled/void invoices from financial totals
      const validInvoices = matchedInvoices.filter((i) => {
        const st = (i.status || '').toLowerCase();
        return st !== 'cancelled' && st !== 'void';
      });

      // Calculate dynamic company KPIs
      const totalShipmentsCount = matchedShipments.length;
      const activeShipmentsCount = matchedShipments.filter(s => s.status !== 'Delivered' && s.status !== 'Cancelled').length;
      const totalBillingVal = validInvoices.reduce((acc, i) => acc + (i.grandTotal || i.totalAmount || 0), 0);
      const outstandingVal = validInvoices.reduce((acc, i) => acc + (i.balanceAmount ?? i.balanceDue ?? (i.grandTotal || 0)), 0);
      const paidVal = validInvoices.reduce((acc, i) => acc + (i.paidAmount || 0), 0);
      const lastShipmentDate = matchedShipments.length > 0 ? (matchedShipments[0].cnDate || matchedShipments[0].bookingDate || '-') : '-';

      const updatedCompany = {
        ...compData,
        kpis: {
          totalShipments: totalShipmentsCount,
          activeShipments: activeShipmentsCount,
          totalBilling: totalBillingVal,
          outstandingAmount: outstandingVal,
          paidAmount: paidVal,
          lastShipmentDate
        }
      };

      setCompany(updatedCompany);
      setRateCards(quotesData);
      setShipments(matchedShipments);
      setInvoices(matchedInvoices);
      setPayments(matchedPayments);
    } catch (err) {
      alert(err.message || 'Failed to load company details.');
      navigate('/admin/companies');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchCompanyData();
  }, [id]);

  const handleConfirmDeactivate = async () => {
    try {
      await companyService.deactivateCompany(company.id);
      setToastMessage(`Company '${company.companyName}' has been deactivated. Historical records preserved.`);
      setShowDeactivateModal(false);
      fetchCompanyData();
      setTimeout(() => setToastMessage(''), 4000);
    } catch (err) {
      alert(err.message || 'Failed to deactivate company.');
    }
  };

  if (loading) {
    return <LoadingState message="Loading company profile details..." />;
  }

  if (!company) return null;

  const tabs = [
    { id: 'overview', label: 'Overview' },
    { id: 'shipments', label: `Shipments (${shipments.length})` },
    { id: 'quotations', label: `Quotations (${rateCards.length})` },
    { id: 'invoices', label: `Invoices (${invoices.length})` },
    { id: 'payments', label: `Payments (${payments.length})` },
    { id: 'profitability', label: 'Profitability' },
  ];

  return (
    <div className="space-y-6 pb-12">
      {/* Top Controls */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div className="flex items-center gap-3">
          <button
            onClick={() => navigate('/admin/companies')}
            className="p-2 text-slate-600 bg-white border border-slate-200 rounded-lg hover:bg-slate-50 transition-colors shadow-xs"
            title="Back to Companies Directory"
          >
            <ArrowLeft className="w-4 h-4" />
          </button>

          <div>
            <div className="flex items-center gap-2">
              <span className="text-xs font-bold text-slate-400 uppercase tracking-wider">
                Corporate Master Record
              </span>
              <span className="text-[10px] px-1.5 py-0.2 rounded bg-setu-50 font-mono text-setu-700 font-bold border border-setu-100">
                {company.companyCode}
              </span>
            </div>
            <div className="flex items-center gap-3">
              <h1 className="text-2xl font-bold text-slate-900 tracking-tight">
                {company.companyName}
              </h1>
              <StatusBadge status={company.status} />
            </div>
          </div>
        </div>

        {/* Action Controls */}
        <div className="flex items-center gap-2">
          <button
            onClick={() => navigate(`/admin/quotations/new?companyId=${company.id}`)}
            className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-bold text-white bg-setu-600 hover:bg-setu-700 rounded-md transition-colors shadow-xs"
          >
            <Plus className="w-3.5 h-3.5" />
            <span>Create Quotation</span>
          </button>

          <button
            onClick={() => navigate(`/admin/companies/${company.id}/edit`)}
            className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-bold text-slate-700 bg-white border border-slate-300 rounded-md hover:bg-slate-50 transition-colors shadow-xs"
          >
            <Edit className="w-3.5 h-3.5" />
            <span>Edit Company</span>
          </button>

          {company.status === 'Active' && (
            <button
              onClick={() => setShowDeactivateModal(true)}
              className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-bold text-rose-700 bg-rose-50 border border-rose-200 rounded-md hover:bg-rose-600 hover:text-white transition-colors"
            >
              <Trash2 className="w-3.5 h-3.5" />
              <span>Deactivate</span>
            </button>
          )}
        </div>
      </div>

      {/* Toast Notification */}
      {toastMessage && (
        <div className="p-3 bg-slate-900 text-white rounded-lg text-xs font-semibold flex items-center justify-between shadow-lg animate-fade-in">
          <span>{toastMessage}</span>
          <button onClick={() => setToastMessage('')} className="text-slate-400 hover:text-white font-bold">
            Dismiss
          </button>
        </div>
      )}

      {/* FINANCIAL & OPERATIONAL KPI SUMMARY CARDS */}
      <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-4">
        <div className="bg-white border border-slate-200 rounded-xl p-4 shadow-xs">
          <span className="text-[11px] font-bold text-slate-400 uppercase tracking-wider block mb-1">Total Shipments</span>
          <span className="text-xl font-bold text-slate-900">{company.kpis?.totalShipments || 0}</span>
        </div>

        <div className="bg-white border border-slate-200 rounded-xl p-4 shadow-xs">
          <span className="text-[11px] font-bold text-slate-400 uppercase tracking-wider block mb-1">Total Billing</span>
          <span className="text-xl font-bold text-slate-900 font-mono">{formatINR(company.kpis?.totalBilling || 0)}</span>
        </div>

        <div className="bg-white border border-slate-200 rounded-xl p-4 shadow-xs">
          <span className="text-[11px] font-bold text-slate-400 uppercase tracking-wider block mb-1">Outstanding</span>
          <span className="text-xl font-bold text-rose-600 font-mono">{formatINR(company.kpis?.outstandingAmount || 0)}</span>
        </div>

        <div className="bg-white border border-slate-200 rounded-xl p-4 shadow-xs">
          <span className="text-[11px] font-bold text-slate-400 uppercase tracking-wider block mb-1">Paid Amount</span>
          <span className="text-xl font-bold text-emerald-600 font-mono">{formatINR(company.kpis?.paidAmount || 0)}</span>
        </div>

        <div className="bg-white border border-slate-200 rounded-xl p-4 shadow-xs">
          <span className="text-[11px] font-bold text-slate-400 uppercase tracking-wider block mb-1">Active Shipments</span>
          <span className="text-xl font-bold text-blue-600">{company.kpis?.activeShipments || 0}</span>
        </div>

        <div className="bg-white border border-slate-200 rounded-xl p-4 shadow-xs">
          <span className="text-[11px] font-bold text-slate-400 uppercase tracking-wider block mb-1">Last Shipment</span>
          <span className="text-sm font-bold text-slate-700 font-mono">{company.kpis?.lastShipmentDate || '-'}</span>
        </div>
      </div>

      {/* NAVIGATION TABS */}
      <div className="border-b border-slate-200 flex gap-6 text-xs font-bold text-slate-500">
        {tabs.map((t) => (
          <button
            key={t.id}
            onClick={() => setActiveTab(t.id)}
            className={`pb-3 transition-colors relative ${
              activeTab === t.id ? 'text-setu-600 font-extrabold' : 'hover:text-slate-900'
            }`}
          >
            {t.label}
            {activeTab === t.id && (
              <span className="absolute bottom-0 left-0 right-0 h-0.5 bg-setu-600 rounded-full" />
            )}
          </button>
        ))}
      </div>

      {/* TAB CONTENT: OVERVIEW */}
      {activeTab === 'overview' && (
        <div className="space-y-6 text-xs">
          {/* BASIC COMPANY PROFILE & MASTER INFORMATION CARD */}
          <div className="bg-white border border-slate-200 rounded-xl p-5 shadow-xs space-y-4">
            <h3 className="text-sm font-bold text-slate-900 flex items-center justify-between border-b border-slate-100 pb-3">
              <div className="flex items-center gap-2">
                <Building2 className="w-4 h-4 text-setu-600" />
                <span>Basic Company Profile & Corporate Information</span>
              </div>
              <span className="text-xs font-mono font-bold text-setu-700 bg-setu-50 px-2.5 py-1 rounded border border-setu-100">
                ID: {company.companyCode || company.companyId}
              </span>
            </h3>

            <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-4 gap-4 font-medium">
              <div>
                <span className="text-slate-400 block text-[11px]">Legal Entity Name</span>
                <span className="font-bold text-slate-900 text-sm block">{company.companyName}</span>
              </div>
              <div>
                <span className="text-slate-400 block text-[11px]">Company Code / Account ID</span>
                <span className="font-bold font-mono text-slate-900 text-xs block">{company.companyCode || company.companyId}</span>
              </div>
              <div>
                <span className="text-slate-400 block text-[11px]">Industry Vertical</span>
                <span className="font-bold text-slate-800 text-xs block">{company.industry || 'N/A'}</span>
              </div>
              <div>
                <span className="text-slate-400 block text-[11px]">Company Type</span>
                <span className="font-bold text-slate-800 text-xs block">{company.companyType || 'Manufacturer'}</span>
              </div>

              <div>
                <span className="text-slate-400 block text-[11px]">GSTIN Number</span>
                <span className="font-mono font-bold text-slate-900 text-xs block">{company.gstin || company.billing?.gstin || 'N/A'}</span>
              </div>
              <div>
                <span className="text-slate-400 block text-[11px]">PAN Number</span>
                <span className="font-mono font-bold text-slate-900 text-xs block">{company.pan || 'AAACA1234A'}</span>
              </div>
              <div>
                <span className="text-slate-400 block text-[11px]">Payment Credit Terms</span>
                <span className="font-bold text-emerald-700 text-xs block">{company.billing?.paymentTerms || '30 Days Credit'}</span>
              </div>
              <div>
                <span className="text-slate-400 block text-[11px]">Account Status</span>
                <StatusBadge status={company.status} />
              </div>
            </div>
          </div>

          <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 text-xs">
          {/* Primary Contact & Registration Card */}
          <div className="bg-white border border-slate-200 rounded-xl p-5 shadow-xs space-y-4">
            <h3 className="text-sm font-bold text-slate-900 flex items-center gap-2 border-b border-slate-100 pb-3">
              <User className="w-4 h-4 text-setu-600" />
              <span>Primary Contact Details</span>
            </h3>

            <div className="space-y-3 font-medium">
              <div>
                <span className="text-slate-400 block text-[11px]">Contact Person</span>
                <span className="font-bold text-slate-900 text-sm">{company.primaryContact?.name || 'N/A'}</span>
              </div>

              <div>
                <span className="text-slate-400 block text-[11px]">Phone Number</span>
                <span className="font-bold text-slate-900 font-mono flex items-center gap-1.5">
                  <Phone className="w-3.5 h-3.5 text-slate-400" />
                  {company.primaryContact?.phone || 'N/A'}
                </span>
              </div>

              <div>
                <span className="text-slate-400 block text-[11px]">Email Address</span>
                <span className="font-bold text-slate-900 flex items-center gap-1.5">
                  <Mail className="w-3.5 h-3.5 text-slate-400" />
                  {company.primaryContact?.email || 'N/A'}
                </span>
              </div>
            </div>

            <div className="pt-3 border-t border-slate-100 space-y-2">
              <h4 className="font-bold text-slate-800 text-[11px] uppercase tracking-wider">Company Categorization</h4>
              <div className="grid grid-cols-2 gap-2 text-xs">
                <div>
                  <span className="text-slate-400 block text-[10px]">Industry</span>
                  <span className="font-semibold text-slate-800">{company.industry || 'N/A'}</span>
                </div>
                <div>
                  <span className="text-slate-400 block text-[10px]">Company Type</span>
                  <span className="font-semibold text-slate-800">{company.companyType || 'N/A'}</span>
                </div>
              </div>
            </div>
          </div>

          {/* Billing & Tax Compliance Card */}
          <div className="bg-white border border-slate-200 rounded-xl p-5 shadow-xs space-y-4">
            <h3 className="text-sm font-bold text-slate-900 flex items-center gap-2 border-b border-slate-100 pb-3">
              <CreditCard className="w-4 h-4 text-emerald-600" />
              <span>Billing & Tax Compliance</span>
            </h3>

            <div className="space-y-3 font-medium">
              <div>
                <span className="text-slate-400 block text-[11px]">GSTIN Number</span>
                <span className="font-mono font-bold text-slate-900 text-sm">{company.billing?.gstin || 'N/A'}</span>
              </div>

              <div>
                <span className="text-slate-400 block text-[11px]">Registered Address</span>
                <span className="text-slate-800 flex items-start gap-1.5 leading-relaxed">
                  <MapPin className="w-3.5 h-3.5 text-slate-400 shrink-0 mt-0.5" />
                  {company.billing?.address}, {company.billing?.city}, {company.billing?.state} - {company.billing?.pinCode}
                </span>
              </div>

              <div className="pt-2 border-t border-slate-100 space-y-3">
                <div>
                  <span className="text-slate-400 block text-[11px]">Billing Email</span>
                  <span className="font-bold text-slate-800 break-all">{company.billing?.billingEmail || 'N/A'}</span>
                </div>
                <div>
                  <span className="text-slate-400 block text-[11px]">Payment Terms</span>
                  <span className="font-bold text-emerald-700">{company.billing?.paymentTerms || '30 Days'}</span>
                </div>
              </div>
            </div>
          </div>

          {/* Logistics Operations Footprint */}
          <div className="bg-white border border-slate-200 rounded-xl p-5 shadow-xs space-y-4">
            <h3 className="text-sm font-bold text-slate-900 flex items-center gap-2 border-b border-slate-100 pb-3">
              <Truck className="w-4 h-4 text-blue-600" />
              <span>Logistics Footprint</span>
            </h3>

            <div className="space-y-3 font-medium">
              <div>
                <span className="text-slate-400 block text-[11px]">Preferred Freight Modes</span>
                <div className="flex flex-wrap gap-1.5 mt-1">
                  {(company.operations?.preferredModes || ['Air', 'FTL']).map((mode) => (
                    <span key={mode} className="px-2 py-0.5 rounded bg-slate-100 text-slate-700 font-bold text-[11px]">
                      {mode}
                    </span>
                  ))}
                </div>
              </div>

              <div className="pt-2 border-t border-slate-100 space-y-2">
                <span className="text-slate-400 block text-[11px]">Operational Hub Locations</span>
                <div className="space-y-1 text-xs">
                  <div>
                    <strong className="text-slate-600">Pickups: </strong>
                    <span>{(company.operations?.pickupLocations || []).join(', ') || 'N/A'}</span>
                  </div>
                  <div>
                    <strong className="text-slate-600">Destinations: </strong>
                    <span>{(company.operations?.destinations || []).join(', ') || 'N/A'}</span>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
      )}

      {/* TAB CONTENT: SHIPMENTS */}
      {activeTab === 'shipments' && (
        <div className="bg-white border border-slate-200 rounded-xl p-5 shadow-xs space-y-4">
          <div className="flex items-center justify-between">
            <h3 className="text-sm font-bold text-slate-900">Historical Shipments for {company.companyName}</h3>
            <span className="text-xs font-semibold px-2 py-0.5 rounded bg-blue-50 text-setu-600">
              {shipments.length} Total Records
            </span>
          </div>

          {shipments.length === 0 ? (
            <div className="p-8 text-center bg-slate-50 border border-slate-200 rounded-xl text-slate-500 space-y-2">
              <p className="font-semibold text-sm">No historical shipments booked for {company.companyName} yet.</p>
              <p className="text-xs text-slate-400">When Consignment Notes are booked for this client company, they will appear here automatically.</p>
              <button
                onClick={() => navigate('/admin/shipments/new')}
                className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-bold text-white bg-setu-600 hover:bg-setu-700 rounded-md transition-colors mt-2"
              >
                <Plus className="w-3.5 h-3.5" />
                <span>Create New Booking</span>
              </button>
            </div>
          ) : (
            <table className="w-full erp-table text-left border-collapse">
              <thead>
                <tr>
                  <th>CN Number</th>
                  <th>Booking Date</th>
                  <th>Origin</th>
                  <th>Destination</th>
                  <th>Weight</th>
                  <th>Status</th>
                </tr>
              </thead>
              <tbody>
                {shipments.map((s, idx) => (
                  <tr key={idx} className="hover:bg-slate-50 cursor-pointer" onClick={() => navigate(`/admin/shipments/${s.cnNumber || s.id}`)}>
                    <td className="font-bold text-setu-600 font-mono">{s.cnNumber || s.id}</td>
                    <td>{formatDate(s.cnDate || s.createdAt)}</td>
                    <td>{s.origin}</td>
                    <td>{s.destination}</td>
                    <td>{s.chargeableWeight || s.actualWeight || 0} Kg</td>
                    <td><StatusBadge status={s.status} /></td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>
      )}

      {/* TAB CONTENT: QUOTATIONS & RATE CARDS */}
      {activeTab === 'quotations' && (
        <div className="bg-white border border-slate-200 rounded-xl p-5 shadow-xs space-y-4">
          <div className="flex items-center justify-between">
            <div>
              <h3 className="text-sm font-bold text-slate-900">Rate Cards & Quotations Matrix</h3>
              <p className="text-xs text-slate-500">Contract versions and pricing rules for {company.companyName}</p>
            </div>
            <button
              onClick={() => navigate(`/admin/quotations/new?companyId=${company.id}`)}
              className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-bold text-white bg-setu-600 hover:bg-setu-700 rounded-md transition-colors"
            >
              <Plus className="w-3.5 h-3.5" />
              <span>New Quotation</span>
            </button>
          </div>

          {rateCards.length > 0 ? (
            <table className="w-full erp-table text-left border-collapse">
              <thead>
                <tr>
                  <th>Quotation No.</th>
                  <th>Version</th>
                  <th>Effective Range</th>
                  <th>Routes</th>
                  <th>Status</th>
                  <th>Actions</th>
                </tr>
              </thead>
              <tbody>
                {rateCards.map((q) => (
                  <tr key={q.id} className="hover:bg-slate-50 cursor-pointer" onClick={() => navigate(`/admin/quotations/${q.id}`)}>
                    <td className="font-bold font-mono text-setu-600">{q.quotationNumber}</td>
                    <td><span className="font-semibold text-slate-700">v{q.version}</span></td>
                    <td className="font-mono text-xs">{formatDate(q.effectiveFrom)} - {q.effectiveUntil ? formatDate(q.effectiveUntil) : 'Ongoing'}</td>
                    <td><span className="font-semibold text-slate-800">{(q.rateRules || q.routes || []).length} Lanes</span></td>
                    <td><StatusBadge status={q.status} /></td>
                    <td>
                      <button
                        onClick={(e) => {
                          e.stopPropagation();
                          navigate(`/admin/quotations/${q.id}`);
                        }}
                        className="text-xs font-bold text-setu-600 hover:underline"
                      >
                        View Rate Card
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          ) : (
            <div className="p-8 text-center bg-slate-50 border border-slate-200 rounded-xl text-slate-500 space-y-2">
              <p className="font-semibold text-sm">No active rate cards configured for {company.companyName}.</p>
              <button
                onClick={() => navigate(`/admin/quotations/new?companyId=${company.id}`)}
                className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-bold text-white bg-setu-600 hover:bg-setu-700 rounded-md transition-colors mt-2"
              >
                <Plus className="w-3.5 h-3.5" />
                <span>+ Create First Rate Card</span>
              </button>
            </div>
          )}
        </div>
      )}

      {/* TAB CONTENT: INVOICES */}
      {activeTab === 'invoices' && (
        <div className="bg-white border border-slate-200 rounded-xl p-5 shadow-xs space-y-4">
          <div className="flex items-center justify-between">
            <h3 className="text-sm font-bold text-slate-900">Invoices for {company.companyName}</h3>
            <span className="text-xs font-semibold px-2 py-0.5 rounded bg-blue-50 text-setu-600">
              {invoices.length} Invoices
            </span>
          </div>

          {invoices.length === 0 ? (
            <div className="p-8 text-center bg-slate-50 border border-slate-200 rounded-xl text-slate-500 space-y-2">
              <p className="font-semibold text-sm">No invoices generated for {company.companyName} yet.</p>
            </div>
          ) : (
            <table className="w-full erp-table text-left border-collapse">
              <thead>
                <tr>
                  <th>Invoice No</th>
                  <th>Date</th>
                  <th>Grand Total</th>
                  <th>Balance Due</th>
                  <th>Status</th>
                </tr>
              </thead>
              <tbody>
                {invoices.map((inv) => (
                  <tr key={inv.id} className="hover:bg-slate-50 cursor-pointer" onClick={() => navigate(`/admin/billing/invoices/${inv.id}`)}>
                    <td className="font-bold font-mono text-setu-600">{inv.invoiceNumber}</td>
                    <td>{formatDate(inv.invoiceDate || inv.createdAt)}</td>
                    <td className="font-mono font-bold text-slate-900">{formatINR(inv.grandTotal || inv.totalAmount || 0)}</td>
                    <td className="font-mono font-bold text-rose-600">{formatINR(inv.balanceAmount ?? inv.balanceDue ?? 0)}</td>
                    <td><StatusBadge status={inv.status} /></td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>
      )}

      {/* TAB CONTENT: PAYMENTS */}
      {activeTab === 'payments' && (
        <div className="bg-white border border-slate-200 rounded-xl p-5 shadow-xs space-y-4">
          <div className="flex items-center justify-between">
            <h3 className="text-sm font-bold text-slate-900">Payment Records for {company.companyName}</h3>
            <span className="text-xs font-semibold px-2 py-0.5 rounded bg-emerald-50 text-emerald-700">
              {payments.length} Payments
            </span>
          </div>

          {payments.length === 0 ? (
            <div className="p-8 text-center bg-slate-50 border border-slate-200 rounded-xl text-slate-500 space-y-2">
              <p className="font-semibold text-sm">No payment records found for {company.companyName} yet.</p>
            </div>
          ) : (
            <table className="w-full erp-table text-left border-collapse">
              <thead>
                <tr>
                  <th>Payment No</th>
                  <th>Date</th>
                  <th>Payment Mode</th>
                  <th>Reference No</th>
                  <th>Amount</th>
                  <th>Status</th>
                </tr>
              </thead>
              <tbody>
                {payments.map((p) => (
                  <tr key={p.id} className="hover:bg-slate-50">
                    <td className="font-bold font-mono text-setu-600">{p.paymentNumber || p.id}</td>
                    <td>{formatDate(p.paymentDate || p.createdAt)}</td>
                    <td>{p.paymentMode || p.method}</td>
                    <td className="font-mono text-slate-600">{p.referenceNumber || '-'}</td>
                    <td className="font-mono font-bold text-emerald-700">{formatINR(p.amount)}</td>
                    <td><StatusBadge status={p.status} /></td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>
      )}

      {/* TAB CONTENT: PROFITABILITY */}
      {activeTab === 'profitability' && (
        <div className="bg-white border border-slate-200 rounded-xl p-6 shadow-xs space-y-4 text-xs">
          <h3 className="text-sm font-bold text-slate-900 border-b border-slate-100 pb-3">Client Profitability Summary</h3>

          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 font-mono">
            <div className="p-4 bg-blue-50 border border-blue-200 rounded-xl">
              <span className="text-[10px] text-blue-700 uppercase font-bold block">Total Billed Revenue</span>
              <strong className="text-lg text-blue-900">{formatINR(company.kpis?.totalBilling || 0)}</strong>
            </div>

            <div className="p-4 bg-emerald-50 border border-emerald-200 rounded-xl">
              <span className="text-[10px] text-emerald-700 uppercase font-bold block">Total Collected Revenue</span>
              <strong className="text-lg text-emerald-900">{formatINR(company.kpis?.paidAmount || 0)}</strong>
            </div>

            <div className="p-4 bg-amber-50 border border-amber-200 rounded-xl">
              <span className="text-[10px] text-amber-700 uppercase font-bold block">Pending Collections</span>
              <strong className="text-lg text-amber-900">{formatINR(company.kpis?.outstandingAmount || 0)}</strong>
            </div>
          </div>
        </div>
      )}

      {/* DEACTIVATION MODAL */}
      <Modal
        isOpen={showDeactivateModal}
        onClose={() => setShowDeactivateModal(false)}
        title="Confirm Company Deactivation"
      >
        <div className="space-y-4 text-xs">
          <div className="p-3 bg-amber-50 border border-amber-200 rounded-lg flex items-start gap-2.5 text-amber-900">
            <AlertCircle className="w-5 h-5 text-amber-600 shrink-0 mt-0.5" />
            <div>
              <p className="font-bold">Are you sure you want to deactivate {company.companyName}?</p>
              <p className="text-[11px] text-amber-800 mt-1">
                Deactivating this company will mark its status as <strong>Inactive</strong>. New quotations cannot be issued under inactive companies, but all historical shipment, billing, and rate card records will be safely preserved.
              </p>
            </div>
          </div>

          <div className="flex justify-end gap-2 pt-2">
            <button
              onClick={() => setShowDeactivateModal(false)}
              className="px-4 py-2 font-bold text-slate-700 bg-white border border-slate-300 rounded hover:bg-slate-50 transition-colors"
            >
              Cancel
            </button>
            <button
              onClick={handleConfirmDeactivate}
              className="px-4 py-2 font-bold text-white bg-rose-600 rounded hover:bg-rose-700 transition-colors"
            >
              Deactivate Company
            </button>
          </div>
        </div>
      </Modal>
    </div>
  );
};
