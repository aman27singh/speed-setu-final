import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { expenseService } from '../services/expenseService';
import { tripService } from '../services/tripService';
import { shipmentService } from '../services/shipmentService';
import { transporterService } from '../services/transporterService';
import { driverService } from '../services/driverService';
import {
  calculateWeightBasedAllocation,
  calculateRevenueBasedAllocation,
  validateExpenseForm
} from '../utils/expenseValidation';
import { PageHeader } from '../components/common/PageHeader';
import { LoadingState } from '../components/common/LoadingState';
import { AllocationPreviewCard } from '../components/expense/AllocationPreviewCard';
import {
  DollarSign,
  Truck,
  Package,
  Building2,
  Save,
  ArrowLeft,
  PieChart,
  AlertCircle
} from 'lucide-react';

const CATEGORIES = [
  'Transporter',
  'Driver',
  'Toll',
  'Fuel',
  'Pickup',
  'Delivery',
  'Loading',
  'Unloading',
  'Handling',
  'Vehicle Maintenance',
  'Office Overhead',
  'Miscellaneous'
];

export const ExpenseFormPage = () => {
  const navigate = useNavigate();

  const [formData, setFormData] = useState({
    expenseDate: new Date().toISOString().split('T')[0],
    category: 'Transporter',
    description: '',
    amount: '',

    payeeType: 'Transporter',
    payeeId: '',
    payeeName: '',

    scope: 'TRP', // SHIPMENT, TRIP, OVERHEAD
    tripId: 'TRP-102',
    shipmentId: '',
    cnNumber: '',

    allocationMethod: 'Weight' // Weight, Revenue, Manual
  });

  const [trips, setTrips] = useState([]);
  const [shipments, setShipments] = useState([]);
  const [transporters, setTransporters] = useState([]);
  const [drivers, setDrivers] = useState([]);

  const [allocations, setAllocations] = useState([]);
  const [errors, setErrors] = useState({});
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  const fetchInitializationData = async () => {
    setLoading(true);
    try {
      const [tList, sList, trList, drList] = await Promise.all([
        tripService.getTrips(),
        shipmentService.getShipments(),
        transporterService.getTransporters(),
        driverService.getDrivers()
      ]);

      setTrips(tList);
      setShipments(sList);
      setTransporters(trList);
      setDrivers(drList);

      const defaultTransporter = trList[0];
      setFormData((prev) => ({
        ...prev,
        payeeId: defaultTransporter ? defaultTransporter.id : '',
        payeeName: defaultTransporter ? defaultTransporter.name : ''
      }));
    } catch (err) {
      alert(err.message || 'Failed to load form initialization data.');
      navigate('/admin/expenses');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchInitializationData();
  }, []);

  // Compute live trip expense allocations whenever tripId, amount, or allocationMethod changes
  useEffect(() => {
    if (formData.scope === 'TRP' && formData.tripId) {
      const selectedTrip = trips.find((t) => t.tripNumber === formData.tripId || t.id === formData.tripId);
      const tripShipmentIds = selectedTrip?.shipmentIds || ['ss251', 'ss252', 'ss253', 'ss254'];
      const tripShipmentObjects = shipments.filter((s) => tripShipmentIds.includes(s.id));

      const amt = parseFloat(formData.amount) || 0;

      if (formData.allocationMethod === 'Weight') {
        const computed = calculateWeightBasedAllocation(tripShipmentObjects, amt);
        setAllocations(computed);
      } else if (formData.allocationMethod === 'Revenue') {
        const computed = calculateRevenueBasedAllocation(tripShipmentObjects, amt);
        setAllocations(computed);
      }
    } else {
      setAllocations([]);
    }
  }, [formData.scope, formData.tripId, formData.amount, formData.allocationMethod, trips, shipments]);

  const handleSubmit = async (e) => {
    e.preventDefault();
    const validationErrors = validateExpenseForm(formData);
    if (Object.keys(validationErrors).length > 0) {
      setErrors(validationErrors);
      return;
    }

    setSaving(true);
    try {
      const created = await expenseService.createExpense({
        ...formData,
        allocations
      });

      const expNum = created.expenseNumber || created.expenseId || created.id;
      alert(`Expense ${expNum} recorded successfully!`);
      navigate('/admin/expenses');
    } catch (err) {
      alert(err.message || 'Failed to record expense.');
    } finally {
      setSaving(false);
    }
  };

  if (loading) {
    return <LoadingState message="Initializing Expense & Allocation Builder..." />;
  }

  return (
    <div className="space-y-6 max-w-4xl mx-auto pb-12">
      <PageHeader
        title="Record New Operational Expense"
        description="Record linehaul costs, driver/transporter payables, and allocate expenses across trip shipments."
        breadcrumbs={['Speed Setu Admin', 'Finance', 'Expenses', 'New']}
        actions={
          <button
            type="button"
            onClick={() => navigate('/admin/expenses')}
            className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold text-slate-700 bg-white border border-slate-300 rounded-md hover:bg-slate-50 transition-colors"
          >
            <ArrowLeft className="w-4 h-4" />
            <span>Cancel</span>
          </button>
        }
      />

      <form onSubmit={handleSubmit} className="space-y-6">
        {/* SECTION A: BASIC EXPENSE INFO */}
        <div className="bg-white border border-slate-200 rounded-xl p-6 shadow-xs space-y-4 text-xs">
          <div className="flex items-center gap-2 border-b border-slate-100 pb-3">
            <DollarSign className="w-4 h-4 text-setu-600" />
            <h3 className="text-sm font-bold text-slate-900">Section A — Expense Details</h3>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <label className="block font-bold text-slate-700 uppercase tracking-wider mb-1">
                Expense Date <span className="text-rose-500">*</span>
              </label>
              <input
                type="date"
                value={formData.expenseDate}
                onChange={(e) => setFormData({ ...formData, expenseDate: e.target.value })}
                className="w-full p-2.5 bg-slate-50 border border-slate-300 rounded font-mono font-bold text-slate-900"
              />
            </div>

            <div>
              <label className="block font-bold text-slate-700 uppercase tracking-wider mb-1">
                Expense Category <span className="text-rose-500">*</span>
              </label>
              <select
                value={formData.category}
                onChange={(e) => setFormData({ ...formData, category: e.target.value })}
                className="w-full p-2.5 bg-slate-50 border border-slate-300 rounded font-bold text-slate-900"
              >
                {CATEGORIES.map((c) => (
                  <option key={c} value={c}>{c}</option>
                ))}
              </select>
            </div>

            <div className="col-span-2">
              <label className="block font-bold text-slate-700 uppercase tracking-wider mb-1">
                Description / Purpose <span className="text-rose-500">*</span>
              </label>
              <input
                type="text"
                value={formData.description}
                onChange={(e) => setFormData({ ...formData, description: e.target.value })}
                placeholder="e.g. Linehaul Container Freight Charges for Agra → Hosur"
                className="w-full p-2.5 bg-slate-50 border border-slate-300 rounded font-medium text-slate-900"
              />
              {errors.description && <span className="text-rose-600 text-[10px]">{errors.description}</span>}
            </div>

            <div>
              <label className="block font-bold text-slate-700 uppercase tracking-wider mb-1">
                Expense Amount (₹) <span className="text-rose-500">*</span>
              </label>
              <input
                type="number"
                value={formData.amount}
                onChange={(e) => setFormData({ ...formData, amount: e.target.value })}
                placeholder="e.g. 18000"
                className="w-full p-2.5 bg-slate-50 border border-slate-300 rounded font-mono font-bold text-setu-700 text-sm"
              />
              {errors.amount && <span className="text-rose-600 text-[10px]">{errors.amount}</span>}
            </div>
          </div>
        </div>

        {/* SECTION B: PAYEE SELECTOR */}
        <div className="bg-white border border-slate-200 rounded-xl p-6 shadow-xs space-y-4 text-xs">
          <div className="flex items-center gap-2 border-b border-slate-100 pb-3">
            <Building2 className="w-4 h-4 text-emerald-600" />
            <h3 className="text-sm font-bold text-slate-900">Section B — Payee Information (Generates Payable)</h3>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <label className="block font-bold text-slate-700 uppercase tracking-wider mb-1">Payee Type</label>
              <select
                value={formData.payeeType}
                onChange={(e) => {
                  const type = e.target.value;
                  let defaultName = '';
                  let defaultId = '';
                  if (type === 'Transporter') {
                    defaultName = transporters[0]?.name || '';
                    defaultId = transporters[0]?.id || '';
                  } else if (type === 'Driver') {
                    defaultName = drivers[0]?.name || '';
                    defaultId = drivers[0]?.id || '';
                  }
                  setFormData({
                    ...formData,
                    payeeType: type,
                    payeeName: defaultName,
                    payeeId: defaultId
                  });
                }}
                className="w-full p-2.5 bg-slate-50 border border-slate-300 rounded font-semibold text-slate-900"
              >
                <option value="Transporter">Transporter Vendor</option>
                <option value="Driver">Linehaul Driver</option>
                <option value="Vendor">External Vendor</option>
                <option value="Employee">Employee</option>
                <option value="Other">Other</option>
              </select>
            </div>

            <div>
              <label className="block font-bold text-slate-700 uppercase tracking-wider mb-1">Payee Name</label>
              {formData.payeeType === 'Transporter' ? (
                <select
                  value={formData.payeeId}
                  onChange={(e) => {
                    const t = transporters.find((x) => x.id === e.target.value);
                    setFormData({
                      ...formData,
                      payeeId: e.target.value,
                      payeeName: t ? t.name : ''
                    });
                  }}
                  className="w-full p-2.5 bg-slate-50 border border-slate-300 rounded font-semibold text-slate-900"
                >
                  {transporters.map((t) => (
                    <option key={t.id} value={t.id}>{t.name}</option>
                  ))}
                </select>
              ) : formData.payeeType === 'Driver' ? (
                <select
                  value={formData.payeeId}
                  onChange={(e) => {
                    const d = drivers.find((x) => x.id === e.target.value);
                    setFormData({
                      ...formData,
                      payeeId: e.target.value,
                      payeeName: d ? d.name : ''
                    });
                  }}
                  className="w-full p-2.5 bg-slate-50 border border-slate-300 rounded font-semibold text-slate-900"
                >
                  {drivers.map((d) => (
                    <option key={d.id} value={d.id}>{d.name} ({d.phone})</option>
                  ))}
                </select>
              ) : (
                <input
                  type="text"
                  value={formData.payeeName}
                  onChange={(e) => setFormData({ ...formData, payeeName: e.target.value })}
                  placeholder="e.g. NHAI FASTag Auto Remittance"
                  className="w-full p-2.5 bg-slate-50 border border-slate-300 rounded font-semibold text-slate-900"
                />
              )}
            </div>
          </div>
        </div>

        {/* SECTION C: SCOPE & TRIP ALLOCATION ENGINE */}
        <div className="bg-white border border-slate-200 rounded-xl p-6 shadow-xs space-y-4 text-xs">
          <div className="flex items-center gap-2 border-b border-slate-100 pb-3">
            <PieChart className="w-4 h-4 text-purple-600" />
            <h3 className="text-sm font-bold text-slate-900">Section C — Expense Scope & Trip Allocation Engine</h3>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <div>
              <label className="block font-bold text-slate-700 uppercase tracking-wider mb-1">Expense Scope</label>
              <select
                value={formData.scope}
                onChange={(e) => setFormData({ ...formData, scope: e.target.value })}
                className="w-full p-2.5 bg-slate-50 border border-slate-300 rounded font-bold text-slate-900"
              >
                <option value="TRP">Trip Expense (Allocated across CNs)</option>
                <option value="SHIPMENT">Shipment Expense (Direct CN cost)</option>
                <option value="OVERHEAD">Company Overhead</option>
              </select>
            </div>

            {formData.scope === 'TRP' && (
              <>
                <div>
                  <label className="block font-bold text-slate-700 uppercase tracking-wider mb-1">Target Trip</label>
                  <select
                    value={formData.tripId}
                    onChange={(e) => setFormData({ ...formData, tripId: e.target.value })}
                    className="w-full p-2.5 bg-slate-50 border border-slate-300 rounded font-mono font-bold text-slate-900"
                  >
                    {trips.map((t) => (
                      <option key={t.id} value={t.tripNumber}>{t.tripNumber} ({t.origin} → {t.destination})</option>
                    ))}
                  </select>
                </div>

                <div>
                  <label className="block font-bold text-slate-700 uppercase tracking-wider mb-1">Allocation Method</label>
                  <select
                    value={formData.allocationMethod}
                    onChange={(e) => setFormData({ ...formData, allocationMethod: e.target.value })}
                    className="w-full p-2.5 bg-slate-50 border border-slate-300 rounded font-bold text-slate-900"
                  >
                    <option value="Weight">Weight-Based Split</option>
                    <option value="Revenue">Revenue-Based Split</option>
                  </select>
                </div>
              </>
            )}

            {formData.scope === 'SHIPMENT' && (
              <div>
                <label className="block font-bold text-slate-700 uppercase tracking-wider mb-1">Target Consignment Note (CN)</label>
                <select
                  value={formData.cnNumber}
                  onChange={(e) => {
                    const s = shipments.find((x) => x.cnNumber === e.target.value);
                    setFormData({
                      ...formData,
                      cnNumber: e.target.value,
                      shipmentId: s ? s.id : ''
                    });
                  }}
                  className="w-full p-2.5 bg-slate-50 border border-slate-300 rounded font-mono font-bold text-slate-900"
                >
                  {shipments.map((s) => (
                    <option key={s.id} value={s.cnNumber}>{s.cnNumber} — {s.companyName}</option>
                  ))}
                </select>
              </div>
            )}
          </div>

          {/* TRIP ALLOCATION PREVIEW CARD */}
          {formData.scope === 'TRP' && allocations.length > 0 && (
            <div className="pt-2">
              <AllocationPreviewCard
                allocations={allocations}
                allocationMethod={formData.allocationMethod}
                totalExpenseAmount={parseFloat(formData.amount) || 0}
              />
            </div>
          )}
        </div>

        {/* BOTTOM FORM ACTIONS */}
        <div className="flex items-center justify-end gap-3 pt-4 border-t border-slate-200">
          <button
            type="button"
            onClick={() => navigate('/admin/expenses')}
            className="px-4 py-2 text-xs font-semibold text-slate-700 bg-white border border-slate-300 rounded-md hover:bg-slate-50 transition-colors"
          >
            Cancel
          </button>

          <button
            type="submit"
            disabled={saving}
            className="inline-flex items-center gap-2 px-6 py-2.5 text-xs font-bold text-white bg-setu-600 hover:bg-setu-700 rounded-md shadow-md transition-colors disabled:opacity-50"
          >
            <Save className="w-4 h-4" />
            <span>{saving ? 'Recording Expense...' : 'Record Expense & Generate Payable'}</span>
          </button>
        </div>
      </form>
    </div>
  );
};
