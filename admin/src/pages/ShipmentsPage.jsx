import React, { useState, useEffect, useRef } from 'react';
import { createPortal } from 'react-dom';
import clsx from 'clsx';
import { useNavigate } from 'react-router-dom';
import { useSearch } from '../context/SearchContext';
import { shipmentService, sortShipments, matchRoute, matchPackage, matchWeight, getKolkataDateString, formatKolkataDateDisplay } from '../services/shipmentService';
import { companyService } from '../services/companyService';
import { getPricingBadgeInfo } from '../utils/pricingValidation';
import { formatDate } from '../utils/formatters';
import { PageHeader } from '../components/common/PageHeader';
import { DataTable } from '../components/common/DataTable';
import { StatusBadge } from '../components/common/StatusBadge';
import { SearchBar } from '../components/common/SearchBar';
import { FilterBar } from '../components/common/FilterBar';
import { LoadingState } from '../components/common/LoadingState';
import { ErrorState } from '../components/common/ErrorState';
import { EmptyState } from '../components/common/EmptyState';
import { DocumentUploadModal } from '../components/shipment/DocumentUploadModal';
import { BulkShipmentImportModal } from '../components/shipment/BulkShipmentImportModal';
import { useAuth } from '../context/AuthContext';
import {
  Plus,
  Upload,
  Eye,
  Edit,
  Trash2,
  Truck,
  Package,
  X,
  FileText,
  FileSpreadsheet,
  User,
  ArrowRight,
  ChevronDown,
  Check,
  Calendar,
  Search,
  RotateCcw
} from 'lucide-react';

/**
 * Editable Status Dropdown for Shipments
 * Supports strictly two statuses: Booked (Blue) and Delivered (Green).
 */
const EditableStatusDropdown = ({ shipment, onStatusChange, isUpdating }) => {
  const [isOpen, setIsOpen] = useState(false);
  const dropdownRef = useRef(null);

  const currentStatus = shipment.status === 'Delivered' ? 'Delivered' : 'Booked';
  const isBooked = currentStatus === 'Booked';

  useEffect(() => {
    const handleClickOutside = (e) => {
      if (dropdownRef.current && !dropdownRef.current.contains(e.target)) {
        setIsOpen(false);
      }
    };
    if (isOpen) {
      document.addEventListener('mousedown', handleClickOutside);
    }
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, [isOpen]);

  const handleSelect = (e, targetStatus) => {
    e.stopPropagation();
    e.preventDefault();
    setIsOpen(false);
    if (targetStatus !== currentStatus) {
      onStatusChange(shipment, targetStatus);
    }
  };

  return (
    <div className="relative inline-block text-left" ref={dropdownRef} onClick={(e) => e.stopPropagation()}>
      <button
        type="button"
        disabled={isUpdating}
        onClick={(e) => {
          e.stopPropagation();
          setIsOpen(!isOpen);
        }}
        className={clsx(
          'inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-semibold border transition-all duration-150 cursor-pointer shadow-sm select-none',
          isBooked
            ? 'bg-blue-50 text-blue-700 border-blue-200 hover:bg-blue-100 hover:border-blue-300'
            : 'bg-emerald-50 text-emerald-700 border-emerald-200 hover:bg-emerald-100 hover:border-emerald-300',
          isUpdating && 'opacity-60 cursor-wait'
        )}
        title="Click to change status (Booked / Delivered)"
      >
        <span
          className={clsx(
            'w-1.5 h-1.5 rounded-full shrink-0',
            isBooked ? 'bg-blue-500' : 'bg-emerald-500',
            isUpdating && 'animate-ping'
          )}
        />
        <span>{currentStatus}</span>
        {isUpdating ? (
          <span className="w-2.5 h-2.5 border-2 border-current border-t-transparent rounded-full animate-spin ml-0.5" />
        ) : (
          <ChevronDown className={clsx('w-3 h-3 text-slate-400 transition-transform duration-150', isOpen && 'rotate-180')} />
        )}
      </button>

      {isOpen && (
        <div
          className="absolute z-50 left-0 mt-1 w-32 bg-white rounded-lg shadow-xl border border-slate-200 py-1 focus:outline-none animate-in fade-in zoom-in-95 duration-100"
          onClick={(e) => e.stopPropagation()}
        >
          <div className="px-2.5 py-1 text-[10px] font-bold text-slate-400 uppercase tracking-wider border-b border-slate-100 mb-0.5">
            Set Status
          </div>
          <button
            type="button"
            onClick={(e) => handleSelect(e, 'Booked')}
            className={clsx(
              'w-full text-left flex items-center justify-between px-2.5 py-1.5 text-xs font-medium transition-colors hover:bg-slate-50',
              isBooked ? 'text-blue-700 font-bold bg-blue-50/60' : 'text-slate-700'
            )}
          >
            <div className="flex items-center gap-1.5">
              <span className="w-2 h-2 rounded-full bg-blue-500 shrink-0" />
              <span>Booked</span>
            </div>
            {isBooked && <Check className="w-3.5 h-3.5 text-blue-600 shrink-0" />}
          </button>
          <button
            type="button"
            onClick={(e) => handleSelect(e, 'Delivered')}
            className={clsx(
              'w-full text-left flex items-center justify-between px-2.5 py-1.5 text-xs font-medium transition-colors hover:bg-slate-50',
              !isBooked ? 'text-emerald-700 font-bold bg-emerald-50/60' : 'text-slate-700'
            )}
          >
            <div className="flex items-center gap-1.5">
              <span className="w-2 h-2 rounded-full bg-emerald-500 shrink-0" />
              <span>Delivered</span>
            </div>
            {!isBooked && <Check className="w-3.5 h-3.5 text-emerald-600 shrink-0" />}
          </button>
        </div>
      )}
    </div>
  );
};

/**
 * Date Filter Popover Component
 * Supports Particular Date (Option A) and Custom Date Range (Option B)
 * Rendered via createPortal to document.body with viewport collision detection
 * Responsive: anchored popover on desktop/tablet, centered modal on mobile
 */
const DateFilterPopover = ({ dateFilter, onApply, onClear }) => {
  const [isOpen, setIsOpen] = useState(false);
  const [mode, setMode] = useState(dateFilter.mode || 'particular');
  const [tempDate, setTempDate] = useState(dateFilter.date || '');
  const [tempStartDate, setTempStartDate] = useState(dateFilter.startDate || '');
  const [tempEndDate, setTempEndDate] = useState(dateFilter.endDate || '');
  const [coords, setCoords] = useState({ top: 0, left: 0, width: 360, isMobile: false });

  const triggerRef = useRef(null);
  const popoverRef = useRef(null);

  // Sync internal form state whenever opened or when active filter changes
  useEffect(() => {
    if (isOpen) {
      setMode(dateFilter.mode || 'particular');
      setTempDate(dateFilter.date || '');
      setTempStartDate(dateFilter.startDate || '');
      setTempEndDate(dateFilter.endDate || '');
    }
  }, [isOpen, dateFilter]);

  // Viewport collision detection and coordinate calculation
  const updatePosition = () => {
    if (!triggerRef.current) return;
    const isMobile = window.innerWidth < 640;
    if (isMobile) {
      setCoords({ isMobile: true, top: 0, left: 0, width: 0 });
      return;
    }

    const rect = triggerRef.current.getBoundingClientRect();
    const popoverWidth = Math.min(360, window.innerWidth - 24);
    const estimatedHeight = 360;

    // Default: align right edge of popover with right edge of trigger button
    let left = rect.right - popoverWidth;

    // If aligning to the right goes off left screen edge, anchor to trigger's left
    if (left < 12) {
      left = rect.left;
    }

    // Viewport boundaries clamping
    if (left + popoverWidth > window.innerWidth - 12) {
      left = window.innerWidth - popoverWidth - 12;
    }
    if (left < 12) {
      left = 12;
    }

    // Vertical positioning (default below button)
    let top = rect.bottom + 6;
    if (top + estimatedHeight > window.innerHeight - 12 && rect.top > estimatedHeight + 12) {
      // Flip above trigger button if there is more space above
      top = Math.max(12, rect.top - estimatedHeight - 6);
    }

    setCoords({
      isMobile: false,
      top,
      left,
      width: popoverWidth
    });
  };

  // Re-calculate position on open, scroll, or resize
  useEffect(() => {
    if (!isOpen) return;

    updatePosition();

    const handleScroll = () => {
      updatePosition();
    };
    const handleResize = () => {
      updatePosition();
    };

    window.addEventListener('scroll', handleScroll, true);
    window.addEventListener('resize', handleResize);

    return () => {
      window.removeEventListener('scroll', handleScroll, true);
      window.removeEventListener('resize', handleResize);
    };
  }, [isOpen]);

  // Click outside and escape key listeners
  useEffect(() => {
    if (!isOpen) return;

    const handleClickOutside = (e) => {
      if (
        triggerRef.current &&
        triggerRef.current.contains(e.target)
      ) {
        return;
      }
      if (
        popoverRef.current &&
        popoverRef.current.contains(e.target)
      ) {
        return;
      }
      setIsOpen(false);
    };

    const handleKeyDown = (e) => {
      if (e.key === 'Escape') {
        setIsOpen(false);
      }
    };

    document.addEventListener('mousedown', handleClickOutside);
    document.addEventListener('keydown', handleKeyDown);

    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
      document.removeEventListener('keydown', handleKeyDown);
    };
  }, [isOpen]);

  const handleApply = () => {
    if (mode === 'particular') {
      if (!tempDate) return;
      onApply({
        mode: 'particular',
        date: tempDate,
        startDate: '',
        endDate: '',
        applied: true
      });
    } else {
      if (!tempStartDate || !tempEndDate || tempStartDate > tempEndDate) return;
      onApply({
        mode: 'range',
        date: '',
        startDate: tempStartDate,
        endDate: tempEndDate,
        applied: true
      });
    }
    setIsOpen(false);
  };

  const handleClear = () => {
    onClear();
    setIsOpen(false);
  };

  const isRangeInvalid = mode === 'range' && tempStartDate && tempEndDate && tempStartDate > tempEndDate;

  const isApplyDisabled =
    mode === 'particular'
      ? !tempDate
      : !tempStartDate || !tempEndDate || tempStartDate > tempEndDate;

  const getButtonLabel = () => {
    if (!dateFilter.applied) return 'Date';
    if (dateFilter.mode === 'particular' && dateFilter.date) {
      return formatKolkataDateDisplay(dateFilter.date);
    }
    if (dateFilter.mode === 'range' && dateFilter.startDate && dateFilter.endDate) {
      return `${formatKolkataDateDisplay(dateFilter.startDate)} – ${formatKolkataDateDisplay(dateFilter.endDate)}`;
    }
    return 'Date';
  };

  const popoverContent = (
    <div
      ref={popoverRef}
      style={
        coords.isMobile
          ? undefined
          : {
              position: 'fixed',
              top: `${coords.top}px`,
              left: `${coords.left}px`,
              width: `${coords.width}px`,
              maxWidth: 'calc(100vw - 24px)',
              zIndex: 9999
            }
      }
      className={clsx(
        'bg-white rounded-xl shadow-2xl border border-slate-200 p-4 sm:p-5 text-xs',
        coords.isMobile
          ? 'w-full max-w-sm max-h-[90vh] overflow-y-auto animate-in fade-in zoom-in-95 duration-150'
          : 'max-h-[calc(100vh-24px)] overflow-y-auto animate-in fade-in zoom-in-95 duration-100'
      )}
    >
      {/* Header */}
      <div className="flex items-center justify-between pb-3 border-b border-slate-100">
        <span className="font-bold text-slate-800 text-sm flex items-center gap-2">
          <Calendar className="w-4 h-4 text-blue-600" />
          <span>Filter by Date</span>
        </span>
        <button
          type="button"
          onClick={() => setIsOpen(false)}
          className="p-1 text-slate-400 hover:text-slate-600 rounded-md hover:bg-slate-100 cursor-pointer transition-colors"
          title="Close"
        >
          <X className="w-4 h-4" />
        </button>
      </div>

      {/* Date Selection Tabs */}
      <div className="grid grid-cols-2 gap-1 bg-slate-100/90 p-1 rounded-lg my-3.5 border border-slate-200/50">
        <button
          type="button"
          onClick={() => setMode('particular')}
          className={`py-1.5 px-2 rounded-md font-semibold text-center transition-all cursor-pointer ${
            mode === 'particular'
              ? 'bg-white text-blue-700 shadow-2xs font-bold'
              : 'text-slate-600 hover:text-slate-900'
          }`}
        >
          Particular Date
        </button>
        <button
          type="button"
          onClick={() => setMode('range')}
          className={`py-1.5 px-2 rounded-md font-semibold text-center transition-all cursor-pointer ${
            mode === 'range'
              ? 'bg-white text-blue-700 shadow-2xs font-bold'
              : 'text-slate-600 hover:text-slate-900'
          }`}
        >
          Custom Date Range
        </button>
      </div>

      {/* Mode Form Content */}
      {mode === 'particular' ? (
        <div className="space-y-1.5 mb-4">
          <label className="block text-[11px] font-semibold text-slate-700">
            Select Date
          </label>
          <input
            type="date"
            value={tempDate}
            onChange={(e) => setTempDate(e.target.value)}
            className="w-full h-9.5 px-3 border border-slate-200 rounded-lg text-xs bg-slate-50/60 focus:bg-white focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 transition-all font-medium text-slate-800"
          />
          <p className="text-[10px] text-slate-500 pt-0.5">
            Displays shipments created on this date (Asia/Kolkata timezone).
          </p>
        </div>
      ) : (
        <div className="space-y-3 mb-4">
          <div>
            <label className="block text-[11px] font-semibold text-slate-700 mb-1">
              Start Date (From)
            </label>
            <input
              type="date"
              value={tempStartDate}
              max={tempEndDate || undefined}
              onChange={(e) => setTempStartDate(e.target.value)}
              className="w-full h-9.5 px-3 border border-slate-200 rounded-lg text-xs bg-slate-50/60 focus:bg-white focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 transition-all font-medium text-slate-800"
            />
          </div>
          <div>
            <label className="block text-[11px] font-semibold text-slate-700 mb-1">
              End Date (To)
            </label>
            <input
              type="date"
              value={tempEndDate}
              min={tempStartDate || undefined}
              onChange={(e) => setTempEndDate(e.target.value)}
              className="w-full h-9.5 px-3 border border-slate-200 rounded-lg text-xs bg-slate-50/60 focus:bg-white focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 transition-all font-medium text-slate-800"
            />
          </div>
          {isRangeInvalid && (
            <p className="text-[10px] text-rose-600 font-semibold">
              End date cannot be earlier than start date.
            </p>
          )}
          <p className="text-[10px] text-slate-500">
            Displays shipments created between start and end date (inclusive).
          </p>
        </div>
      )}

      {/* Footer – Clear button on left, Apply Filter on right */}
      <div className="flex items-center justify-between pt-3.5 border-t border-slate-100 gap-3">
        <button
          type="button"
          onClick={handleClear}
          className="px-3.5 py-2 text-xs font-semibold text-slate-600 hover:text-slate-900 hover:bg-slate-100 rounded-lg transition-colors cursor-pointer shrink-0"
        >
          Clear
        </button>
        <button
          type="button"
          onClick={handleApply}
          disabled={isApplyDisabled}
          className={`px-4 py-2 text-xs font-bold rounded-lg transition-all shadow-xs shrink-0 ${
            isApplyDisabled
              ? 'bg-slate-200 text-slate-400 cursor-not-allowed'
              : 'bg-blue-600 hover:bg-blue-700 text-white cursor-pointer'
          }`}
        >
          Apply Filter
        </button>
      </div>
    </div>
  );

  return (
    <>
      {/* Anchor Trigger Button */}
      <button
        ref={triggerRef}
        type="button"
        onClick={() => setIsOpen(!isOpen)}
        className={`w-full h-9 inline-flex items-center justify-between gap-1.5 px-2.5 text-xs rounded-lg font-medium border transition-all cursor-pointer ${
          dateFilter.applied
            ? 'border-blue-500 text-blue-700 bg-blue-50/40 font-semibold ring-1 ring-blue-500/20'
            : 'border-slate-200 text-slate-700 bg-white hover:bg-slate-50'
        }`}
        title="Filter by Date or Date Range"
      >
        <div className="flex items-center gap-1.5 truncate">
          <Calendar className={`w-3.5 h-3.5 shrink-0 ${dateFilter.applied ? 'text-blue-600' : 'text-slate-400'}`} />
          <span className="truncate">{getButtonLabel()}</span>
        </div>
        <ChevronDown className={`w-3.5 h-3.5 text-slate-400 shrink-0 transition-transform ${isOpen ? 'rotate-180' : ''}`} />
      </button>

      {/* Portal Overlay / Popover */}
      {isOpen &&
        createPortal(
          coords.isMobile ? (
            <div className="fixed inset-0 bg-slate-900/40 backdrop-blur-xs flex items-center justify-center p-4 z-[9999] animate-in fade-in duration-150">
              {popoverContent}
            </div>
          ) : (
            popoverContent
          ),
          document.body
        )}
    </>
  );
};

export const ShipmentsPage = () => {
  const navigate = useNavigate();
  const { searchQuery, setSearchQuery } = useSearch();
  const { user, isDriver } = useAuth();
  const isDriverAccount = isDriver ||
    user?.role === 'Driver' ||
    user?.role === 'Fleet Manager' ||
    user?.username?.toLowerCase() === 'driver' ||
    user?.email?.toLowerCase().includes('driver');

  const [baseShipments, setBaseShipments] = useState([]);
  const [allShipmentsMaster, setAllShipmentsMaster] = useState([]);
  const [companies, setCompanies] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  // Filters (Company → Origin–Destination → Package → Weight)
  const [search, setSearch] = useState(searchQuery || '');
  const [companyFilter, setCompanyFilter] = useState('All');
  const [routeFilter, setRouteFilter] = useState('All');
  const [packageFilter, setPackageFilter] = useState('All');
  const [weightFilter, setWeightFilter] = useState('All');
  const [pricingFilter, setPricingFilter] = useState('All');
  const [statusFilter, setStatusFilter] = useState('All');
  const [dateFilter, setDateFilter] = useState({
    mode: 'particular',
    date: '',
    startDate: '',
    endDate: '',
    applied: false
  });

  // Backend-aggregated options cache
  const [backendOptions, setBackendOptions] = useState(null);

  // Modal State
  const [showUploadModal, setShowUploadModal] = useState(false);
  const [showImportModal, setShowImportModal] = useState(false);
  const [toastMessage, setToastMessage] = useState('');

  // Multi-selection state
  const [selectedIds, setSelectedIds] = useState([]);
  const [deletingBulk, setDeletingBulk] = useState(false);
  const [updatingStatusId, setUpdatingStatusId] = useState(null);

  const handleStatusChange = async (shipment, newStatus) => {
    const rowId = shipment._id || shipment.id || shipment.cnNumber;
    const currentSt = shipment.status === 'Delivered' ? 'Delivered' : 'Booked';
    if (currentSt === newStatus) return;

    setUpdatingStatusId(rowId);
    try {
      await shipmentService.updateStatus(shipment._id || shipment.id, newStatus);

      const updateList = (list) =>
        list.map((s) => {
          const match =
            (shipment._id && s._id === shipment._id) ||
            (shipment.id && s.id === shipment.id) ||
            (shipment.cnNumber && s.cnNumber === shipment.cnNumber);
          return match ? { ...s, status: newStatus } : s;
        });

      setBaseShipments(updateList);
      setAllShipmentsMaster(updateList);

      setToastMessage(`✓ Consignment Note ${shipment.cnNumber || rowId} status updated to '${newStatus}'`);
      setTimeout(() => setToastMessage(''), 4000);
    } catch (err) {
      console.error('Failed to update shipment status:', err);
      alert(`Failed to update status to '${newStatus}': ${err.message || 'Server error'}`);
    } finally {
      setUpdatingStatusId(null);
    }
  };

  // Instant local search change
  const handleSearchChange = (val) => {
    setSearch(val);
  };

  // Reset all active filters to default
  const handleResetFilters = () => {
    setSearch('');
    setSearchQuery('');
    setCompanyFilter('All');
    setRouteFilter('All');
    setPackageFilter('All');
    setWeightFilter('All');
    setPricingFilter('All');
    setStatusFilter('All');
    setDateFilter({
      mode: 'particular',
      date: '',
      startDate: '',
      endDate: '',
      applied: false
    });
  };

  // Debounce syncing local search to global header searchQuery
  useEffect(() => {
    const timer = setTimeout(() => {
      setSearchQuery(search);
    }, 300);
    return () => clearTimeout(timer);
  }, [search, setSearchQuery]);

  // Sync from header to local search if header query changes
  useEffect(() => {
    if (searchQuery !== search) {
      setSearch(searchQuery || '');
    }
  }, [searchQuery]);

  // Load companies once on component mount
  useEffect(() => {
    companyService.getCompanies().then(setCompanies).catch(() => {});
  }, []);

  const fetchData = async () => {
    setLoading(true);
    setError(null);
    try {
      const dateParams = dateFilter.applied ? {
        date: dateFilter.mode === 'particular' ? dateFilter.date : '',
        startDate: dateFilter.mode === 'range' ? dateFilter.startDate : '',
        endDate: dateFilter.mode === 'range' ? dateFilter.endDate : ''
      } : {};

      const shipmentsData = await shipmentService.getShipments({
        companyId: companyFilter,
        route: routeFilter,
        packageCount: packageFilter,
        weight: weightFilter,
        ...dateParams
      });

      let finalShipments = shipmentsData || [];

      if (isDriverAccount && user) {
        const driverIdentifiers = [
          user.id,
          user._id,
          user.username,
          user.email,
          user.driverId,
          user.name
        ]
          .filter(Boolean)
          .map((val) => String(val).toLowerCase().trim());

        finalShipments = (shipmentsData || []).filter((s) => {
          const createdByVal = String(s.createdBy || '').toLowerCase().trim();
          const driverIdVal = String(s.driverId || '').toLowerCase().trim();
          const createdByNameVal = String(s.createdByName || '').toLowerCase().trim();
          const operationalDriverVal = String(s.operational?.driver || '').toLowerCase().trim();

          const isCreatorMatch = driverIdentifiers.some((id) =>
            (createdByVal && createdByVal === id) ||
            (driverIdVal && driverIdVal === id) ||
            (createdByNameVal && createdByNameVal === id) ||
            (operationalDriverVal && operationalDriverVal === id)
          );

          return isCreatorMatch;
        });
      }

      const sorted = sortShipments(finalShipments);
      setBaseShipments(sorted);

      // Keep master copy of shipments on initial fetch or when no company filter is applied
      if (allShipmentsMaster.length === 0 || companyFilter === 'All') {
        setAllShipmentsMaster(sorted);
      }
    } catch (err) {
      setError(err.message || 'Failed to load shipments records.');
    } finally {
      setLoading(false);
    }
  };

  // Fetch shipments when non-status filters change (status toggling is purely client-side)
  useEffect(() => {
    fetchData();
  }, [companyFilter, routeFilter, packageFilter, weightFilter, dateFilter]);

  // Fetch backend dynamic filter options aggregation for exact database verification
  useEffect(() => {
    const dateParams = dateFilter.applied ? {
      date: dateFilter.mode === 'particular' ? dateFilter.date : '',
      startDate: dateFilter.mode === 'range' ? dateFilter.startDate : '',
      endDate: dateFilter.mode === 'range' ? dateFilter.endDate : ''
    } : {};

    shipmentService.getFilterOptions({
      companyId: companyFilter,
      route: routeFilter,
      packageCount: packageFilter,
      ...dateParams
    }).then((res) => {
      if (res) setBackendOptions(res);
    }).catch(() => {});
  }, [companyFilter, routeFilter, packageFilter, dateFilter]);

  // 1. Available Companies (across database, with counts)
  const availableCompanies = React.useMemo(() => {
    if (backendOptions?.companies && backendOptions.companies.length > 0) {
      return backendOptions.companies;
    }
    const list = allShipmentsMaster.length > 0 ? allShipmentsMaster : baseShipments;
    const compMap = new Map();
    list.forEach((s) => {
      const id = s.companyId || s.companyCode || s.companyName;
      if (!id) return;
      if (!compMap.has(id)) {
        compMap.set(id, {
          id,
          name: s.companyName || id,
          code: s.companyCode || '',
          count: 0
        });
      }
      compMap.get(id).count++;
    });

    return Array.from(compMap.values())
      .sort((a, b) => b.count - a.count || a.name.localeCompare(b.name))
      .map((c) => ({
        id: c.id,
        name: c.name,
        code: c.code,
        label: `${c.name}${c.code ? ` (${c.code})` : ''} (${c.count})`,
        count: c.count
      }));
  }, [backendOptions, allShipmentsMaster, baseShipments]);

  // 2. Dynamic Origin – Destination Routes (Depends on selected Company)
  const availableRoutes = React.useMemo(() => {
    if (backendOptions?.routes && backendOptions.routes.length > 0) {
      return backendOptions.routes;
    }
    const list = (allShipmentsMaster.length > 0 ? allShipmentsMaster : baseShipments).filter((s) => {
      if (companyFilter !== 'All') {
        const cLower = companyFilter.toLowerCase();
        return (
          s.companyId === companyFilter ||
          s.companyCode === companyFilter ||
          (s.companyName && s.companyName.toLowerCase() === cLower)
        );
      }
      return true;
    });

    const routeCounts = new Map();
    list.forEach((s) => {
      const orig = (s.origin || '').trim().toUpperCase();
      const dest = (s.destination || '').trim().toUpperCase();
      if (orig || dest) {
        const key = `${orig || 'ANY'} → ${dest || 'ANY'}`;
        routeCounts.set(key, (routeCounts.get(key) || 0) + 1);
      }
    });

    return Array.from(routeCounts.entries())
      .sort((a, b) => b[1] - a[1] || a[0].localeCompare(b[0]))
      .map(([key, count]) => ({
        value: key,
        label: `${key} (${count})`,
        count
      }));
  }, [backendOptions, allShipmentsMaster, baseShipments, companyFilter]);

  // 3. Dynamic Packages (Depends on selected Company + Route)
  const availablePackages = React.useMemo(() => {
    if (backendOptions?.packages && backendOptions.packages.length > 0) {
      return backendOptions.packages;
    }
    const list = (allShipmentsMaster.length > 0 ? allShipmentsMaster : baseShipments).filter((s) => {
      if (companyFilter !== 'All') {
        const cLower = companyFilter.toLowerCase();
        if (s.companyId !== companyFilter && s.companyCode !== companyFilter && s.companyName?.toLowerCase() !== cLower) return false;
      }
      if (routeFilter !== 'All' && !matchRoute(s.origin, s.destination, routeFilter)) return false;
      return true;
    });

    const pkgCounts = new Map();
    list.forEach((s) => {
      const num = parseInt(s.packages, 10) || 1;
      pkgCounts.set(num, (pkgCounts.get(num) || 0) + 1);
    });

    return Array.from(pkgCounts.entries())
      .sort((a, b) => a[0] - b[0])
      .map(([num, count]) => ({
        value: String(num),
        label: `${num} ${num === 1 ? 'Box' : 'Boxes'} (${count})`,
        count
      }));
  }, [backendOptions, allShipmentsMaster, baseShipments, companyFilter, routeFilter]);

  // 4. Dynamic Weights (Depends on selected Company + Route + Package)
  // Only two conditions: 0 Weight vs Greater Than 0
  const availableWeights = React.useMemo(() => {
    if (backendOptions?.weights && backendOptions.weights.length > 0) {
      return backendOptions.weights;
    }
    const list = (allShipmentsMaster.length > 0 ? allShipmentsMaster : baseShipments).filter((s) => {
      if (companyFilter !== 'All') {
        const cLower = companyFilter.toLowerCase();
        if (s.companyId !== companyFilter && s.companyCode !== companyFilter && s.companyName?.toLowerCase() !== cLower) return false;
      }
      if (routeFilter !== 'All' && !matchRoute(s.origin, s.destination, routeFilter)) return false;
      if (packageFilter !== 'All' && !matchPackage(s.packages, packageFilter)) return false;
      return true;
    });

    let zeroCount = 0;
    let gt0Count = 0;
    list.forEach((s) => {
      const act = parseFloat(s.actualWeight) || 0;
      const chg = parseFloat(s.chargeableWeight) || 0;
      if (act > 0 || chg > 0) gt0Count++;
      else zeroCount++;
    });

    const opts = [];
    if (gt0Count > 0) {
      opts.push({
        value: 'greater_than_0',
        label: `Greater Than 0 (${gt0Count})`,
        count: gt0Count
      });
    }
    if (zeroCount > 0) {
      opts.push({
        value: 'zero',
        label: `0 Weight (${zeroCount})`,
        count: zeroCount
      });
    }
    return opts;
  }, [backendOptions, allShipmentsMaster, baseShipments, companyFilter, routeFilter, packageFilter]);

  // Cascading reset: changing parent resets any dependent selection that is no longer valid
  useEffect(() => {
    if (routeFilter !== 'All' && availableRoutes.length > 0 && !availableRoutes.some((r) => r.value === routeFilter)) {
      setRouteFilter('All');
    }
  }, [availableRoutes, routeFilter]);

  useEffect(() => {
    if (packageFilter !== 'All' && availablePackages.length > 0 && !availablePackages.some((p) => p.value === packageFilter)) {
      setPackageFilter('All');
    }
  }, [availablePackages, packageFilter]);

  useEffect(() => {
    if (weightFilter !== 'All' && availableWeights.length > 0 && !availableWeights.some((w) => w.value === weightFilter)) {
      setWeightFilter('All');
    }
  }, [availableWeights, weightFilter]);

  // -------------------------------------------------------------
  // Data Pipeline:
  // Step 1: Base dataset after all non-status filters (Search, Company, Route, Packages, Weight, Date)
  // Step 2: Calculate status counts (All, Booked, Delivered) from this base dataset BEFORE applying statusFilter
  // Step 3: Apply statusFilter exclusively to determine displayed rows in the table
  // -------------------------------------------------------------

  // Step 1: Base dataset filtered by all active non-status filters
  const baseFilteredShipments = React.useMemo(() => {
    let list = baseShipments;

    // 1. Search Bar Query (AND) - CN, Company, Consignor, Consignee, Origin, Destination, Invoice...
    const q = (search || searchQuery || '').toLowerCase().trim();
    if (q) {
      list = list.filter((s) => {
        const cnMatch = s.cnNumber && s.cnNumber.toLowerCase().includes(q);
        const compNameMatch = s.companyName && s.companyName.toLowerCase().includes(q);
        const compCodeMatch = s.companyCode && s.companyCode.toLowerCase().includes(q);
        const consignorMatch =
          (s.consignor?.name && s.consignor.name.toLowerCase().includes(q)) ||
          (s.consignor?.companyName && s.consignor.companyName.toLowerCase().includes(q)) ||
          (s.consignor?.companyCode && s.consignor.companyCode.toLowerCase().includes(q)) ||
          (s.consignorName && s.consignorName.toLowerCase().includes(q));
        const consigneeMatch =
          (s.consignee?.name && s.consignee.name.toLowerCase().includes(q)) ||
          (s.consignee?.companyName && s.consignee.companyName.toLowerCase().includes(q)) ||
          (s.consignee?.companyCode && s.consignee.companyCode.toLowerCase().includes(q)) ||
          (s.consigneeName && s.consigneeName.toLowerCase().includes(q));
        const originMatch = s.origin && s.origin.toLowerCase().includes(q);
        const destMatch = s.destination && s.destination.toLowerCase().includes(q);
        const invoiceMatch = s.invoiceDetails?.invoiceNumber && s.invoiceDetails.invoiceNumber.toLowerCase().includes(q);
        const ewayMatch = s.ewayBillNumber && s.ewayBillNumber.toLowerCase().includes(q);
        const awbMatch = s.awbNumber && s.awbNumber.toLowerCase().includes(q);
        const commMatch = (s.commercialInvoices || []).some(
          (inv) =>
            (inv.invoiceNumber && inv.invoiceNumber.toLowerCase().includes(q)) ||
            (inv.ewayBillNumber && inv.ewayBillNumber.toLowerCase().includes(q)) ||
            (inv.awbNumber && inv.awbNumber.toLowerCase().includes(q))
        );

        return (
          cnMatch ||
          compNameMatch ||
          compCodeMatch ||
          consignorMatch ||
          consigneeMatch ||
          originMatch ||
          destMatch ||
          invoiceMatch ||
          ewayMatch ||
          awbMatch ||
          commMatch
        );
      });
    }

    // 2. Company Filter (AND)
    if (companyFilter && companyFilter !== 'All') {
      const cLower = companyFilter.toLowerCase();
      list = list.filter((s) =>
        s.companyId === companyFilter ||
        s.companyCode === companyFilter ||
        (s.companyName && s.companyName.toLowerCase() === cLower)
      );
    }

    // 3. Origin – Destination Filter (AND)
    if (routeFilter && routeFilter !== 'All') {
      list = list.filter((s) => matchRoute(s.origin, s.destination, routeFilter));
    }

    // 4. Package Filter (AND)
    if (packageFilter && packageFilter !== 'All') {
      list = list.filter((s) => matchPackage(s.packages, packageFilter));
    }

    // 5. Weight Filter: 0 Weight vs Greater Than 0 (AND)
    if (weightFilter && weightFilter !== 'All') {
      list = list.filter((s) => matchWeight(s.actualWeight, s.chargeableWeight, weightFilter));
    }

    // 6. Pricing Status Filter (AND)
    if (pricingFilter && pricingFilter !== 'All') {
      list = list.filter((s) => {
        const pv = s.pricingValidation;
        if (pricingFilter === 'Quotation') {
          return pv?.status === 'MATCHED' && pv?.source === 'QUOTATION';
        }
        if (pricingFilter === 'RateCard') {
          return pv?.status === 'MATCHED' && pv?.source === 'RATE_CARD';
        }
        if (pricingFilter === 'NoQuotation') {
          return !pv || pv.status === 'MISSING' || pv.source === 'NONE';
        }
        return true;
      });
    }

    // 7. Date Filter (AND)
    if (dateFilter.applied) {
      if (dateFilter.mode === 'particular' && dateFilter.date) {
        list = list.filter((s) => {
          const dStr = getKolkataDateString(s.createdAt);
          return dStr === dateFilter.date;
        });
      } else if (dateFilter.mode === 'range' && dateFilter.startDate && dateFilter.endDate) {
        list = list.filter((s) => {
          const dStr = getKolkataDateString(s.createdAt);
          return dStr && dStr >= dateFilter.startDate && dStr <= dateFilter.endDate;
        });
      }
    }

    return list;
  }, [baseShipments, search, searchQuery, companyFilter, routeFilter, packageFilter, weightFilter, pricingFilter, dateFilter]);

  // Step 2: Calculate All, Booked, and Delivered counts from baseFilteredShipments (BEFORE status filter is applied)
  const statusCounts = React.useMemo(() => {
    let booked = 0;
    let delivered = 0;

    baseFilteredShipments.forEach((s) => {
      const st = s.status === 'Delivered' ? 'Delivered' : 'Booked';
      if (st === 'Delivered') {
        delivered++;
      } else {
        booked++;
      }
    });

    return {
      all: baseFilteredShipments.length,
      booked,
      delivered
    };
  }, [baseFilteredShipments]);

  // Step 3: Apply the selected status filter only to determine which rows are displayed in the table
  const shipments = React.useMemo(() => {
    if (!statusFilter || statusFilter === 'All') {
      return sortShipments(baseFilteredShipments);
    }

    const filtered = baseFilteredShipments.filter((s) => {
      const st = s.status === 'Delivered' ? 'Delivered' : 'Booked';
      return st === statusFilter;
    });

    return sortShipments(filtered);
  }, [baseFilteredShipments, statusFilter]);

  // Optional background fetch if query is not found locally, without blocking the UI
  useEffect(() => {
    const q = (search || searchQuery || '').trim();
    if (!q || q.length < 2) return;

    const localMatch = baseShipments.some((s) => {
      const qLower = q.toLowerCase();
      return (s.cnNumber && s.cnNumber.toLowerCase().includes(qLower)) ||
             (s.companyName && s.companyName.toLowerCase().includes(qLower));
    });
    if (localMatch) return;

    let isCurrent = true;
    const timer = setTimeout(async () => {
      try {
        const dateParams = dateFilter.applied ? {
          date: dateFilter.mode === 'particular' ? dateFilter.date : '',
          startDate: dateFilter.mode === 'range' ? dateFilter.startDate : '',
          endDate: dateFilter.mode === 'range' ? dateFilter.endDate : ''
        } : {};

        const results = await shipmentService.getShipments({
          search: q,
          companyId: companyFilter,
          route: routeFilter,
          packageCount: packageFilter,
          weight: weightFilter,
          ...dateParams
        });
        if (isCurrent && Array.isArray(results) && results.length > 0) {
          setBaseShipments((prev) => {
            const existing = new Set(prev.map((p) => p.id || p.cnNumber || p._id));
            const fresh = results.filter((r) => !existing.has(r.id || r.cnNumber || r._id));
            return fresh.length > 0 ? sortShipments([...fresh, ...prev]) : prev;
          });
        }
      } catch (e) {
        // background check fallback
      }
    }, 400);

    return () => {
      isCurrent = false;
      clearTimeout(timer);
    };
  }, [search, searchQuery, baseShipments, companyFilter, routeFilter, packageFilter, weightFilter, dateFilter]);

  const handleSelectAll = (e) => {
    if (e.target.checked) {
      const allIds = shipments.map((s) => s.id || s.cnNumber || s._id).filter(Boolean);
      setSelectedIds(allIds);
    } else {
      setSelectedIds([]);
    }
  };

  const handleSelectRow = (id, e) => {
    if (e) e.stopPropagation();
    if (selectedIds.includes(id)) {
      setSelectedIds(selectedIds.filter((item) => item !== id));
    } else {
      setSelectedIds([...selectedIds, id]);
    }
  };

  const handleBulkDelete = async () => {
    const count = selectedIds.length;
    if (count === 0) return;

    if (
      window.confirm(
        `Are you sure you want to delete ${count} selected shipment${count > 1 ? 's' : ''}? This action cannot be undone.`
      )
    ) {
      setDeletingBulk(true);
      try {
        await shipmentService.deleteMultipleShipments(selectedIds);
        setToastMessage(`Successfully deleted ${count} shipment${count > 1 ? 's' : ''}.`);
        setSelectedIds([]);
        fetchData();
      } catch (err) {
        alert(`Bulk deletion error: ${err.message}`);
      } finally {
        setDeletingBulk(false);
      }
    }
  };

  const columns = [
    {
      header: (
        <input
          type="checkbox"
          checked={shipments.length > 0 && selectedIds.length === shipments.length}
          onChange={handleSelectAll}
          className="w-4 h-4 rounded text-setu-600 focus:ring-setu-500 cursor-pointer accent-setu-600"
          title="Select All Shipments"
        />
      ),
      key: 'select',
      align: 'center',
      render: (row) => {
        const rowId = row.id || row.cnNumber || row._id;
        const isSelected = selectedIds.includes(rowId);
        return (
          <div onClick={(e) => e.stopPropagation()}>
            <input
              type="checkbox"
              checked={isSelected}
              onChange={(e) => handleSelectRow(rowId, e)}
              className="w-4 h-4 rounded text-setu-600 focus:ring-setu-500 cursor-pointer accent-setu-600"
            />
          </div>
        );
      }
    },
    {
      header: 'CN Number',
      accessor: 'cnNumber',
      render: (row) => (
        <div>
          <span
            onClick={() => navigate(`/admin/shipments/${row.id}`)}
            className="font-bold text-setu-600 font-mono hover:underline cursor-pointer block"
          >
            {row.cnNumber}
          </span>
          {row.awbNumber && (
            <span className="text-[10px] text-slate-500 font-mono block">AWB: {row.awbNumber}</span>
          )}
        </div>
      )
    },
    {
      header: 'CN Date',
      accessor: 'cnDate',
      render: (row) => <span className="font-mono text-slate-700 text-xs">{formatDate(row.cnDate)}</span>
    },
    {
      header: 'Company',
      accessor: 'companyName',
      render: (row) => (
        <div>
          <span
            onClick={() => navigate(`/admin/companies/${row.companyId}`)}
            className="font-bold text-slate-900 hover:text-setu-600 cursor-pointer block"
          >
            {row.companyName}
          </span>
          <span className="text-[10px] text-slate-400 font-mono">{row.companyCode}</span>
        </div>
      )
    },
    {
      header: 'Consignor',
      accessor: 'consignor',
      render: (row) => (
        <div>
          <span className="font-semibold text-slate-800 block text-xs truncate max-w-[140px]">{row.consignor?.name || '-'}</span>
          {row.consignor?.city && <span className="text-[10px] text-slate-400 block">{row.consignor.city}</span>}
        </div>
      )
    },
    {
      header: 'Consignee',
      accessor: 'consignee',
      render: (row) => (
        <div>
          <span className="font-semibold text-slate-800 block text-xs truncate max-w-[140px]">{row.consignee?.name || '-'}</span>
          {row.consignee?.city && <span className="text-[10px] text-slate-400 block">{row.consignee.city}</span>}
        </div>
      )
    },
    {
      header: 'Origin → Dest',
      accessor: 'origin',
      render: (row) => (
        <div className="text-xs font-semibold">
          {row.origin || row.destination ? (
            <>
              <span className="text-slate-900">{row.origin || '-'}</span>
              <span className="text-slate-400 block text-[10px]">→ {row.destination || '-'}</span>
            </>
          ) : (
            <span className="text-slate-400 font-normal">-</span>
          )}
        </div>
      )
    },
    {
      header: 'Mode',
      accessor: 'mode',
      render: (row) => (
        <span className="px-2 py-0.5 rounded text-[11px] font-semibold bg-slate-100 text-slate-700">
          {row.mode}
        </span>
      )
    },
    {
      header: 'Pricing',
      accessor: 'pricingValidation',
      render: (row) => {
        const badge = getPricingBadgeInfo(row);
        return (
          <span
            title={badge.tooltip}
            className={`inline-flex items-center gap-1.5 px-2 py-0.5 rounded-full text-[10px] font-bold border transition-colors cursor-help whitespace-nowrap ${badge.badgeClass}`}
          >
            <span className={`w-1.5 h-1.5 rounded-full shrink-0 ${badge.dotClass}`} />
            <span>{badge.text}</span>
          </span>
        );
      }
    },
    {
      header: 'Packages',
      accessor: 'packages',
      align: 'center',
      render: (row) => {
        const pkg = row.packages;
        if (!pkg) return <span className="font-bold text-slate-800">1 Box</span>;
        const str = String(pkg).trim();
        const display = /^\d+$/.test(str) ? `${str} ${parseInt(str, 10) === 1 ? 'Box' : 'Boxes'}` : str;
        return <span className="font-bold text-slate-800">{display}</span>;
      }
    },
    {
      header: 'Weight (Act / Chg)',
      accessor: 'actualWeight',
      align: 'right',
      render: (row) => (
        <div className="text-xs text-right font-mono">
          <span className="font-bold text-slate-900">{row.actualWeight} Kg</span>
          <span className="text-[10px] text-slate-500 block">Chg: {row.chargeableWeight} Kg</span>
        </div>
      )
    },
    {
      header: 'Status',
      accessor: 'status',
      render: (row) => (
        <EditableStatusDropdown
          shipment={row}
          onStatusChange={handleStatusChange}
          isUpdating={updatingStatusId === (row._id || row.id || row.cnNumber)}
        />
      )
    },
    {
      header: 'POD',
      accessor: 'podStatus',
      render: (row) => <StatusBadge status={row.podStatus} />
    },
    ...(!isDriverAccount ? [
      {
        header: 'Created By',
        accessor: 'createdByName',
        render: (row) => {
          const creatorName = row.createdByName || row.operational?.driver || row.createdBy || 'Admin / System';
          const isDriverCN = String(row.createdBy || '').toLowerCase().includes('driver') ||
                             String(row.createdByName || '').toLowerCase().includes('driver') ||
                             !!row.driverId;
          return (
            <div className="text-xs">
              <span className={`inline-flex items-center gap-1 font-semibold ${isDriverCN ? 'text-blue-700 font-bold' : 'text-slate-800'}`}>
                <User className="w-3.5 h-3.5 text-slate-400 shrink-0" />
                <span className="truncate max-w-[120px]" title={creatorName}>{creatorName}</span>
              </span>
              {isDriverCN && (
                <span className="text-[9px] font-bold text-blue-600 block uppercase tracking-wider">
                  Driver CN
                </span>
              )}
            </div>
          );
        }
      },
      {
        header: 'Billing',
        accessor: 'billingStatus',
        render: (row) => <StatusBadge status={row.billingStatus} />
      },
      {
        header: 'Payment Status',
        accessor: 'paymentStatus',
        render: (row) => {
          const st = row.paymentStatus || 'Unbilled';
          if (st === 'Paid') {
            return (
              <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[11px] font-bold bg-emerald-100 text-emerald-800 border border-emerald-300">
                <span className="w-1.5 h-1.5 rounded-full bg-emerald-500"></span>
                Paid
              </span>
            );
          } else if (st === 'Partially Paid') {
            return (
              <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[11px] font-bold bg-amber-100 text-amber-800 border border-amber-300">
                <span className="w-1.5 h-1.5 rounded-full bg-amber-500"></span>
                Partially Paid
              </span>
            );
          } else if (st === 'Unpaid') {
            return (
              <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[11px] font-bold bg-rose-100 text-rose-800 border border-rose-300">
                <span className="w-1.5 h-1.5 rounded-full bg-rose-500"></span>
                Unpaid
              </span>
            );
          } else {
            return (
              <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[11px] font-bold bg-slate-100 text-slate-600 border border-slate-300">
                <span className="w-1.5 h-1.5 rounded-full bg-slate-400"></span>
                Unbilled
              </span>
            );
          }
        }
      }
    ] : []),
    {
      header: 'Actions',
      key: 'actions',
      render: (row) => (
        <div className="flex items-center gap-1" onClick={(e) => e.stopPropagation()}>
          <button
            onClick={() => navigate(`/admin/shipments/${row.id}`)}
            className="p-1.5 text-slate-500 hover:text-setu-600 hover:bg-slate-100 rounded transition-colors"
            title="View Full Shipment Details"
          >
            <Eye className="w-4 h-4" />
          </button>

          {!isDriverAccount && (
            <>
              <button
                onClick={() => navigate(`/admin/shipments/${row.id}/edit`)}
                className="p-1.5 text-slate-500 hover:text-blue-600 hover:bg-slate-100 rounded transition-colors"
                title="Edit Shipment"
              >
                <Edit className="w-4 h-4" />
              </button>

              <button
                onClick={async (e) => {
                  e.stopPropagation();
                  const cn = row.cnNumber || row.id;
                  if (window.confirm(`Are you sure you want to delete Consignment Note ${cn}? This action cannot be undone.`)) {
                    try {
                      await shipmentService.deleteShipment(row.id || cn);
                      setToastMessage(`Consignment Note ${cn} deleted successfully.`);
                      fetchData();
                    } catch (err) {
                      alert(`Failed to delete shipment ${cn}: ${err.message}`);
                    }
                  }
                }}
                className="p-1.5 text-slate-400 hover:text-rose-600 hover:bg-rose-50 rounded transition-colors"
                title="Delete Consignment Note (CN)"
              >
                <Trash2 className="w-4 h-4" />
              </button>
            </>
          )}
        </div>
      )
    }
  ];

  return (
    <div className="space-y-6">
      {/* Header */}
      <PageHeader
        title={isDriverAccount ? 'My Created Shipments' : 'Shipments Management'}
        description={
          isDriverAccount
            ? 'View and manage consignment notes (CN) created by your driver account.'
            : 'Manage Consignment Notes (CN), track dispatch status, and monitor linehaul movements.'
        }
        breadcrumbs={['Speed Setu Admin', 'Operations', isDriverAccount ? 'My Shipments' : 'Shipments']}
        actions={
          !isDriverAccount ? (
            <div className="flex flex-wrap items-center gap-2 w-full sm:w-auto">
              <button
                onClick={() => setShowImportModal(true)}
                className="inline-flex items-center justify-center gap-2 px-3.5 py-2 text-xs font-bold text-emerald-800 bg-emerald-50 border border-emerald-300 hover:bg-emerald-100 rounded-md shadow-2xs transition-colors flex-1 sm:flex-initial"
                title="Bulk import shipment data from Excel (.xlsx/.xls/.csv) file"
              >
                <FileSpreadsheet className="w-4 h-4 text-emerald-600" />
                <span>Import Excel / CSV</span>
              </button>

              <button
                onClick={() => setShowUploadModal(true)}
                className="inline-flex items-center justify-center gap-2 px-3.5 py-2 text-xs font-bold text-slate-700 bg-white border border-slate-300 hover:bg-slate-50 rounded-md shadow-xs transition-colors flex-1 sm:flex-initial"
              >
                <Upload className="w-4 h-4 text-setu-600" />
                <span>Upload Document</span>
              </button>

              <button
                onClick={() => navigate('/admin/shipments/new')}
                className="inline-flex items-center justify-center gap-2 px-4 py-2 text-xs font-bold text-white bg-setu-600 hover:bg-setu-700 rounded-md shadow-sm transition-colors flex-1 sm:flex-initial"
              >
                <Plus className="w-4 h-4" />
                <span>New Shipment</span>
              </button>
            </div>
          ) : null
        }
      />

      {/* Toast Notification */}
      {toastMessage && (
        <div className="p-3 bg-slate-900 text-white rounded-lg text-xs font-semibold flex items-center justify-between shadow-lg animate-fade-in">
          <span>{toastMessage}</span>
          <button onClick={() => setToastMessage('')} className="text-slate-400 hover:text-white font-bold">
            <X className="w-4 h-4" />
          </button>
        </div>
      )}

      {/* Search & Multi-Filter Controls Bar (Admin Only) */}
      {!isDriverAccount && (
        <div className="bg-white border border-slate-200/90 rounded-xl p-3 sm:p-4 shadow-xs space-y-3">
          {/* First Row – Search (approx 30%) and 5 Filters + Reset aligned in one horizontal row */}
          <div className="flex flex-col lg:flex-row items-stretch lg:items-center gap-2.5 w-full">
            {/* 1. Search Bar – Approx 30% width */}
            <div className="w-full lg:w-[28%] xl:w-[30%] min-w-[200px] shrink-0 relative flex items-center">
              <Search className="w-4 h-4 text-slate-400 absolute left-3 pointer-events-none" />
              <input
                type="text"
                value={search}
                onChange={(e) => handleSearchChange(e.target.value)}
                placeholder="Search CN, company, consignor, consignee, code..."
                className="w-full h-9 pl-9 pr-7 text-xs bg-slate-50/60 hover:bg-white focus:bg-white border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 transition-all placeholder:text-slate-400 text-slate-800 font-medium"
              />
              {search && (
                <button
                  type="button"
                  onClick={() => {
                    setSearch('');
                    setSearchQuery('');
                  }}
                  className="absolute right-2.5 p-0.5 text-slate-400 hover:text-slate-600 rounded-full cursor-pointer"
                  title="Clear search"
                >
                  <X className="w-3.5 h-3.5" />
                </button>
              )}
            </div>

            {/* Flexible Filter Controls Container (utilizes full remaining width) */}
            <div className="grid grid-cols-2 sm:grid-cols-3 lg:flex lg:flex-1 lg:items-center gap-2 w-full">
              {/* 2. Company Filter */}
              <div className="lg:flex-1 lg:min-w-[120px] relative">
                <select
                  value={companyFilter}
                  onChange={(e) => setCompanyFilter(e.target.value)}
                  className={`w-full h-9 pl-2.5 pr-7 text-xs border rounded-lg font-medium focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 truncate transition-all cursor-pointer appearance-none ${
                    companyFilter !== 'All'
                      ? 'border-blue-500 text-blue-700 bg-blue-50/40 font-semibold ring-1 ring-blue-500/20'
                      : 'border-slate-200 text-slate-700 bg-white hover:bg-slate-50'
                  }`}
                  title="Filter by Company"
                >
                  <option value="All">
                    All Companies {availableCompanies.length > 0 ? `(${availableCompanies.reduce((acc, c) => acc + (c.count || 0), 0)})` : ''}
                  </option>
                  {availableCompanies.map((c) => (
                    <option key={c.id} value={c.id}>
                      {c.label || `${c.name} (${c.count})`}
                    </option>
                  ))}
                </select>
                <ChevronDown className="w-3.5 h-3.5 text-slate-400 absolute right-2.5 top-1/2 -translate-y-1/2 pointer-events-none" />
              </div>

              {/* 3. Origin – Destination (Route) Filter */}
              <div className="lg:flex-1 lg:min-w-[130px] relative">
                <select
                  value={routeFilter}
                  onChange={(e) => setRouteFilter(e.target.value)}
                  className={`w-full h-9 pl-2.5 pr-7 text-xs border rounded-lg font-medium focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 truncate transition-all cursor-pointer appearance-none ${
                    routeFilter !== 'All'
                      ? 'border-blue-500 text-blue-700 bg-blue-50/40 font-semibold ring-1 ring-blue-500/20'
                      : 'border-slate-200 text-slate-700 bg-white hover:bg-slate-50'
                  }`}
                  title="Filter by Route (Origin – Destination)"
                >
                  <option value="All">
                    {companyFilter === 'All' ? 'Origin – Destination' : 'All Routes for Company'} {availableRoutes.length > 0 ? `(${availableRoutes.reduce((acc, r) => acc + (r.count || 0), 0)})` : ''}
                  </option>
                  {availableRoutes.map((r) => (
                    <option key={r.value} value={r.value}>
                      {r.label}
                    </option>
                  ))}
                </select>
                <ChevronDown className="w-3.5 h-3.5 text-slate-400 absolute right-2.5 top-1/2 -translate-y-1/2 pointer-events-none" />
              </div>

              {/* 4. Packages Filter */}
              <div className="lg:flex-[0.8] lg:min-w-[95px] relative">
                <select
                  value={packageFilter}
                  onChange={(e) => setPackageFilter(e.target.value)}
                  className={`w-full h-9 pl-2.5 pr-7 text-xs border rounded-lg font-medium focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 truncate transition-all cursor-pointer appearance-none ${
                    packageFilter !== 'All'
                      ? 'border-blue-500 text-blue-700 bg-blue-50/40 font-semibold ring-1 ring-blue-500/20'
                      : 'border-slate-200 text-slate-700 bg-white hover:bg-slate-50'
                  }`}
                  title="Filter by Package Count"
                >
                  <option value="All">
                    Packages {availablePackages.length > 0 ? `(${availablePackages.reduce((acc, p) => acc + (p.count || 0), 0)})` : ''}
                  </option>
                  {availablePackages.map((p) => (
                    <option key={p.value} value={p.value}>
                      {p.label}
                    </option>
                  ))}
                </select>
                <ChevronDown className="w-3.5 h-3.5 text-slate-400 absolute right-2.5 top-1/2 -translate-y-1/2 pointer-events-none" />
              </div>

              {/* 5. Weight Filter */}
              <div className="lg:flex-[0.8] lg:min-w-[95px] relative">
                <select
                  value={weightFilter}
                  onChange={(e) => setWeightFilter(e.target.value)}
                  className={`w-full h-9 pl-2.5 pr-7 text-xs border rounded-lg font-medium focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 truncate transition-all cursor-pointer appearance-none ${
                    weightFilter !== 'All'
                      ? 'border-blue-500 text-blue-700 bg-blue-50/40 font-semibold ring-1 ring-blue-500/20'
                      : 'border-slate-200 text-slate-700 bg-white hover:bg-slate-50'
                  }`}
                  title="Filter by Weight"
                >
                  <option value="All">
                    Weights {availableWeights.length > 0 ? `(${availableWeights.reduce((acc, w) => acc + (w.count || 0), 0)})` : ''}
                  </option>
                  {availableWeights.map((w) => (
                    <option key={w.value} value={w.value}>
                      {w.label}
                    </option>
                  ))}
                </select>
                <ChevronDown className="w-3.5 h-3.5 text-slate-400 absolute right-2.5 top-1/2 -translate-y-1/2 pointer-events-none" />
              </div>

              {/* Pricing Agreement Status Filter */}
              <div className="lg:flex-[1.1] lg:min-w-[125px] relative">
                <select
                  value={pricingFilter}
                  onChange={(e) => setPricingFilter(e.target.value)}
                  className={`w-full h-9 pl-2.5 pr-7 text-xs border rounded-lg font-medium focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 truncate transition-all cursor-pointer appearance-none ${
                    pricingFilter !== 'All'
                      ? 'border-blue-500 text-blue-700 bg-blue-50/40 font-semibold ring-1 ring-blue-500/20'
                      : 'border-slate-200 text-slate-700 bg-white hover:bg-slate-50'
                  }`}
                  title="Filter by Pricing Agreement Coverage"
                >
                  <option value="All">All Pricing Statuses</option>
                  <option value="Quotation">Quotation Applied</option>
                  <option value="RateCard">Rate Card Applied</option>
                  <option value="NoQuotation">No Quotation</option>
                </select>
                <ChevronDown className="w-3.5 h-3.5 text-slate-400 absolute right-2.5 top-1/2 -translate-y-1/2 pointer-events-none" />
              </div>

              {/* 6. Date Filter */}
              <div className="lg:flex-[1.1] lg:min-w-[115px]">
                <DateFilterPopover
                  dateFilter={dateFilter}
                  onApply={(newFilter) => setDateFilter(newFilter)}
                  onClear={() =>
                    setDateFilter({
                      mode: 'particular',
                      date: '',
                      startDate: '',
                      endDate: '',
                      applied: false
                    })
                  }
                />
              </div>

              {/* 7. Reset Button */}
              <button
                type="button"
                onClick={handleResetFilters}
                className="col-span-2 sm:col-span-1 h-9 px-3 text-xs font-semibold text-slate-600 hover:text-slate-900 bg-slate-100/90 hover:bg-slate-200/90 border border-slate-200/80 rounded-lg transition-colors flex items-center justify-center gap-1.5 shrink-0 cursor-pointer"
                title="Reset all filters to default"
              >
                <RotateCcw className="w-3.5 h-3.5 text-slate-500" />
                <span>Reset</span>
              </button>
            </div>
          </div>

          {/* Second Row – Compact Segmented Status Buttons (Left) & Total Matching Count (Right) */}
          <div className="pt-2.5 border-t border-slate-100 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 text-xs">
            {/* Left: Segmented Filter Buttons */}
            <div className="flex items-center bg-slate-100/90 p-0.5 rounded-lg border border-slate-200/60 shadow-2xs">
              <button
                type="button"
                onClick={() => setStatusFilter('All')}
                className={clsx(
                  'px-3 py-1.5 text-xs rounded-md transition-all cursor-pointer flex items-center gap-1.5',
                  statusFilter === 'All'
                    ? 'bg-white text-blue-700 font-bold shadow-xs'
                    : 'text-slate-600 hover:text-slate-900 font-medium'
                )}
              >
                <span>All Statuses</span>
                <span
                  className={clsx(
                    'px-1.5 py-0.2 rounded-full text-[10px] font-semibold',
                    statusFilter === 'All' ? 'bg-blue-100/70 text-blue-700' : 'bg-slate-200/60 text-slate-500'
                  )}
                >
                  {statusCounts.all}
                </span>
              </button>

              <button
                type="button"
                onClick={() => setStatusFilter('Booked')}
                className={clsx(
                  'px-3 py-1.5 text-xs rounded-md transition-all cursor-pointer flex items-center gap-1.5',
                  statusFilter === 'Booked'
                    ? 'bg-white text-blue-700 font-bold shadow-xs'
                    : 'text-slate-600 hover:text-slate-900 font-medium'
                )}
              >
                <span className="w-1.5 h-1.5 rounded-full bg-blue-500 shrink-0" />
                <span>Booked</span>
                <span
                  className={clsx(
                    'px-1.5 py-0.2 rounded-full text-[10px] font-semibold',
                    statusFilter === 'Booked' ? 'bg-blue-100/70 text-blue-700' : 'bg-slate-200/60 text-slate-500'
                  )}
                >
                  {statusCounts.booked}
                </span>
              </button>

              <button
                type="button"
                onClick={() => setStatusFilter('Delivered')}
                className={clsx(
                  'px-3 py-1.5 text-xs rounded-md transition-all cursor-pointer flex items-center gap-1.5',
                  statusFilter === 'Delivered'
                    ? 'bg-white text-emerald-700 font-bold shadow-xs'
                    : 'text-slate-600 hover:text-slate-900 font-medium'
                )}
              >
                <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 shrink-0" />
                <span>Delivered</span>
                <span
                  className={clsx(
                    'px-1.5 py-0.2 rounded-full text-[10px] font-semibold',
                    statusFilter === 'Delivered' ? 'bg-emerald-100 text-emerald-700' : 'bg-slate-200/60 text-slate-500'
                  )}
                >
                  {statusCounts.delivered}
                </span>
              </button>
            </div>

            {/* Right: Total Matching Record Count */}
            <div className="flex items-center gap-2 text-xs text-slate-500 font-medium shrink-0">
              <span>
                Showing <strong className="font-bold text-slate-800">{shipments.length}</strong> matching {shipments.length === 1 ? 'Consignment Note' : 'Consignment Notes'}
              </span>
            </div>
          </div>

          {/* Active Filter Chips with Individual Dismiss (x) and Clear All */}
          {(companyFilter !== 'All' || routeFilter !== 'All' || packageFilter !== 'All' || weightFilter !== 'All' || pricingFilter !== 'All' || dateFilter.applied || search) && (
            <div className="flex flex-wrap items-center gap-1.5 pt-2 border-t border-slate-100/80 text-xs">
              <span className="text-[11px] font-semibold text-slate-400 mr-1">Active Filters:</span>
              {companyFilter !== 'All' && (
                <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-md text-[11px] font-semibold bg-blue-50 text-blue-700 border border-blue-200/80 shadow-2xs">
                  <span>
                    Company: {(() => {
                      const found = availableCompanies.find((c) => c.id === companyFilter);
                      return found ? found.name : companyFilter;
                    })()}
                  </span>
                  <button
                    onClick={() => setCompanyFilter('All')}
                    className="hover:text-rose-600 hover:bg-rose-50 p-0.5 rounded cursor-pointer"
                    title="Clear Company filter"
                  >
                    <X className="w-3 h-3" />
                  </button>
                </span>
              )}
              {routeFilter !== 'All' && (
                <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-md text-[11px] font-semibold bg-blue-50 text-blue-700 border border-blue-200/80 shadow-2xs">
                  <span>Route: {routeFilter}</span>
                  <button
                    onClick={() => setRouteFilter('All')}
                    className="hover:text-rose-600 hover:bg-rose-50 p-0.5 rounded cursor-pointer"
                    title="Clear Route filter"
                  >
                    <X className="w-3 h-3" />
                  </button>
                </span>
              )}
              {packageFilter !== 'All' && (
                <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-md text-[11px] font-semibold bg-blue-50 text-blue-700 border border-blue-200/80 shadow-2xs">
                  <span>
                    Package: {availablePackages.find((p) => p.value === packageFilter)?.label || `${packageFilter} Boxes`}
                  </span>
                  <button
                    onClick={() => setPackageFilter('All')}
                    className="hover:text-rose-600 hover:bg-rose-50 p-0.5 rounded cursor-pointer"
                    title="Clear Package filter"
                  >
                    <X className="w-3 h-3" />
                  </button>
                </span>
              )}
              {weightFilter !== 'All' && (
                <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-md text-[11px] font-semibold bg-blue-50 text-blue-700 border border-blue-200/80 shadow-2xs">
                  <span>
                    Weight: {availableWeights.find((w) => w.value === weightFilter)?.label || (weightFilter === 'zero' ? '0 Weight' : 'Greater Than 0')}
                  </span>
                  <button
                    onClick={() => setWeightFilter('All')}
                    className="hover:text-rose-600 hover:bg-rose-50 p-0.5 rounded cursor-pointer"
                    title="Clear Weight filter"
                  >
                    <X className="w-3 h-3" />
                  </button>
                </span>
              )}
              {pricingFilter !== 'All' && (
                <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-md text-[11px] font-semibold bg-blue-50 text-blue-700 border border-blue-200/80 shadow-2xs">
                  <span>
                    Pricing: {pricingFilter === 'Quotation' ? 'Quotation Applied' : pricingFilter === 'RateCard' ? 'Rate Card Applied' : 'No Quotation'}
                  </span>
                  <button
                    onClick={() => setPricingFilter('All')}
                    className="hover:text-rose-600 hover:bg-rose-50 p-0.5 rounded cursor-pointer"
                    title="Clear Pricing filter"
                  >
                    <X className="w-3 h-3" />
                  </button>
                </span>
              )}
              {dateFilter.applied && (
                <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-md text-[11px] font-semibold bg-blue-50 text-blue-700 border border-blue-200/80 shadow-2xs">
                  <Calendar className="w-3 h-3 text-blue-600" />
                  <span>
                    Date:{' '}
                    {dateFilter.mode === 'particular'
                      ? formatKolkataDateDisplay(dateFilter.date)
                      : `${formatKolkataDateDisplay(dateFilter.startDate)} – ${formatKolkataDateDisplay(dateFilter.endDate)}`}
                  </span>
                  <button
                    onClick={() =>
                      setDateFilter({
                        mode: 'particular',
                        date: '',
                        startDate: '',
                        endDate: '',
                        applied: false
                      })
                    }
                    className="hover:text-rose-600 hover:bg-rose-50 p-0.5 rounded cursor-pointer"
                    title="Clear Date filter"
                  >
                    <X className="w-3 h-3" />
                  </button>
                </span>
              )}
              {search && (
                <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-md text-[11px] font-semibold bg-slate-100 text-slate-700 border border-slate-300 shadow-2xs">
                  <span>Search: "{search}"</span>
                  <button
                    onClick={() => {
                      setSearch('');
                      setSearchQuery('');
                    }}
                    className="hover:text-rose-600 hover:bg-rose-50 p-0.5 rounded cursor-pointer"
                    title="Clear search query"
                  >
                    <X className="w-3 h-3" />
                  </button>
                </span>
              )}
              <button
                type="button"
                onClick={handleResetFilters}
                className="text-[11px] font-semibold text-slate-500 hover:text-rose-600 underline ml-1 cursor-pointer"
              >
                Clear All
              </button>
            </div>
          )}
        </div>
      )}

      {/* Multi-Selection Bulk Actions Floating Banner */}
      {selectedIds.length > 0 && (
        <div className="bg-slate-900 text-white border border-slate-700 rounded-xl p-3 px-4 shadow-xl flex flex-wrap items-center justify-between gap-3 animate-fade-in">
          <div className="flex items-center gap-3">
            <span className="bg-rose-500/20 text-rose-300 border border-rose-500/40 px-2.5 py-1 rounded-full text-xs font-bold font-mono">
              {selectedIds.length} Selected
            </span>
            <span className="text-xs text-slate-300 font-medium">
              Shipments selected for bulk action
            </span>
          </div>

          <div className="flex items-center gap-2">
            <button
              onClick={() => setSelectedIds([])}
              className="px-3 py-1.5 text-xs font-semibold text-slate-300 hover:text-white bg-slate-800 hover:bg-slate-700 rounded-lg transition-colors"
            >
              Clear Selection
            </button>

            <button
              disabled={deletingBulk}
              onClick={handleBulkDelete}
              className="inline-flex items-center gap-2 px-4 py-1.5 text-xs font-bold text-white bg-rose-600 hover:bg-rose-700 disabled:opacity-50 rounded-lg shadow-sm transition-colors cursor-pointer"
            >
              <Trash2 className="w-4 h-4" />
              <span>{deletingBulk ? `Deleting (${selectedIds.length})...` : `Delete Selected (${selectedIds.length})`}</span>
            </button>
          </div>
        </div>
      )}

      {/* Main Shipments Table (Desktop Table + Mobile Cards) */}
      {loading ? (
        <LoadingState message="Loading Speed Setu Consignment Notes..." />
      ) : error ? (
        <ErrorState message={error} onRetry={fetchData} />
      ) : shipments.length === 0 ? (
        <div className="bg-white border border-slate-200 rounded-lg p-6 text-center">
          <EmptyState title="No shipments found" description="Try adjusting your search query, status, or date filters." />
        </div>
      ) : (
        <>
          {/* Mobile Cards (Visible on mobile screens < 768px) */}
          <div className="space-y-3 md:hidden">
            {shipments.map((row) => {
              const rowId = row.id || row.cnNumber || row._id;
              const isSelected = selectedIds.includes(rowId);
              const creatorName = row.createdByName || row.operational?.driver || row.createdBy || 'Admin';
              const isDriverCN = String(row.createdBy || '').toLowerCase().includes('driver') ||
                                 String(row.createdByName || '').toLowerCase().includes('driver') ||
                                 !!row.driverId;

              return (
                <div
                  key={rowId}
                  onClick={() => navigate(`/admin/shipments/${row.id}`)}
                  className={`bg-white border ${isSelected ? 'border-setu-500 ring-1 ring-setu-500' : 'border-slate-200'} rounded-xl p-3.5 shadow-xs active:bg-slate-50 transition-colors cursor-pointer space-y-3`}
                >
                  {/* Card Header: Selection + CN Number + Date */}
                  <div className="flex items-center justify-between gap-2 border-b border-slate-100 pb-2.5">
                    <div className="flex items-center gap-2">
                      <div onClick={(e) => e.stopPropagation()}>
                        <input
                          type="checkbox"
                          checked={isSelected}
                          onChange={(e) => handleSelectRow(rowId, e)}
                          className="w-4 h-4 rounded text-setu-600 focus:ring-setu-500 cursor-pointer accent-setu-600"
                        />
                      </div>
                      <div>
                        <span className="font-bold text-setu-600 font-mono text-sm block">
                          {row.cnNumber}
                        </span>
                        {row.awbNumber && (
                          <span className="text-[10px] text-slate-500 font-mono block">AWB: {row.awbNumber}</span>
                        )}
                      </div>
                    </div>

                    <div className="text-right">
                      <span className="font-mono text-slate-600 text-[11px] block">{formatDate(row.cnDate)}</span>
                      <span className="inline-block px-2 py-0.5 rounded text-[10px] font-bold bg-slate-100 text-slate-700">
                        {row.mode || 'Express LTL'}
                      </span>
                    </div>
                  </div>

                  {/* Route & Consignee */}
                  <div className="flex items-center justify-between text-xs gap-2 bg-slate-50/80 p-2.5 rounded-lg border border-slate-100">
                    <div className="min-w-0">
                      <span className="text-[10px] uppercase font-bold text-slate-400 block">Route</span>
                      <div className="flex items-center gap-1 font-bold text-slate-800 text-xs truncate">
                        <span>{row.origin || row.consignor?.city || 'Origin'}</span>
                        <ArrowRight className="w-3.5 h-3.5 text-setu-500 shrink-0" />
                        <span>{row.destination || row.consignee?.city || 'Destination'}</span>
                      </div>
                    </div>

                    <div className="text-right shrink-0">
                      <span className="text-[10px] uppercase font-bold text-slate-400 block">Packages</span>
                      <span className="font-bold text-slate-900 text-xs">{row.packages || 0} Boxes</span>
                    </div>
                  </div>

                  {/* Customer / Company */}
                  <div className="flex items-center justify-between text-xs text-slate-600">
                    <div className="truncate max-w-[200px]">
                      <span className="text-[10px] text-slate-400 font-bold block uppercase">Client / Consignee</span>
                      <span className="font-semibold text-slate-800 truncate block">
                        {row.companyName || row.consigneeName || 'Logistics Client'}
                      </span>
                    </div>

                    {!isDriverAccount && (
                      <div className="text-right">
                        <span className="text-[10px] text-slate-400 font-bold block uppercase">Created By</span>
                        <span className={`text-[11px] font-bold ${isDriverCN ? 'text-blue-700' : 'text-slate-700'}`}>
                          {creatorName}
                        </span>
                      </div>
                    )}
                  </div>

                  {/* Badges & Actions Footer */}
                  <div className="flex items-center justify-between pt-2 border-t border-slate-100 gap-2">
                    <div className="flex flex-wrap items-center gap-1.5">
                      <EditableStatusDropdown
                        shipment={row}
                        onStatusChange={handleStatusChange}
                        isUpdating={updatingStatusId === (row._id || row.id || row.cnNumber)}
                      />
                      <StatusBadge status={row.podStatus} />
                    </div>

                    <div className="flex items-center gap-2 shrink-0" onClick={(e) => e.stopPropagation()}>
                      <button
                        onClick={() => navigate(`/admin/shipments/${row.id}`)}
                        className="px-3 py-1.5 text-xs font-bold text-setu-700 bg-setu-50 border border-setu-200 rounded-lg hover:bg-setu-100 active:scale-95 transition-all flex items-center gap-1"
                      >
                        <Eye className="w-3.5 h-3.5" />
                        <span>View</span>
                      </button>
                    </div>
                  </div>
                </div>
              );
            })}
          </div>

          {/* Desktop Table View (Visible on md and larger) */}
          <div className="hidden md:block">
            <DataTable
              columns={columns}
              data={shipments}
              onRowClick={(row) => navigate(`/admin/shipments/${row.id}`)}
              emptyMessage="No shipments found"
              emptySubtext="Try adjusting your search query, status, or date filters."
            />
          </div>
        </>
      )}

      {/* Document Upload Modal */}
      <DocumentUploadModal
        isOpen={showUploadModal}
        onClose={() => setShowUploadModal(false)}
        onUploadSuccess={() => {
          setToastMessage('Document uploaded successfully!');
          fetchData();
          setTimeout(() => setToastMessage(''), 4000);
        }}
      />

      {/* Excel / CSV Bulk Shipment Import Modal */}
      <BulkShipmentImportModal
        isOpen={showImportModal}
        onClose={() => setShowImportModal(false)}
        onImportSuccess={() => {
          setToastMessage('Bulk shipment data imported successfully from Excel!');
          fetchData();
          setTimeout(() => setToastMessage(''), 4000);
        }}
      />
    </div>
  );
};
