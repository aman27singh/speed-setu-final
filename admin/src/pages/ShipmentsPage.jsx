import React, { useState, useEffect, useRef } from 'react';
import clsx from 'clsx';
import { useNavigate } from 'react-router-dom';
import { useSearch } from '../context/SearchContext';
import { shipmentService, sortShipments, matchRoute, matchPackage, matchWeight } from '../services/shipmentService';
import { companyService } from '../services/companyService';
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
  Check
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
  const [statusFilter, setStatusFilter] = useState('All');

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
      const shipmentsData = await shipmentService.getShipments({
        companyId: companyFilter,
        route: routeFilter,
        packageCount: packageFilter,
        weight: weightFilter,
        status: statusFilter
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

  // Fetch shipments when dropdown filters change
  useEffect(() => {
    fetchData();
  }, [companyFilter, routeFilter, packageFilter, weightFilter, statusFilter]);

  // Fetch backend dynamic filter options aggregation for exact database verification
  useEffect(() => {
    shipmentService.getFilterOptions({
      companyId: companyFilter,
      route: routeFilter,
      packageCount: packageFilter,
      status: statusFilter
    }).then((res) => {
      if (res) setBackendOptions(res);
    }).catch(() => {});
  }, [companyFilter, routeFilter, packageFilter, statusFilter]);

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

  // Instant in-memory multi-filter and search filtering (AND logic across all 4 filters + search)
  const shipments = React.useMemo(() => {
    let list = baseShipments;

    // 1. Company Filter (AND)
    if (companyFilter && companyFilter !== 'All') {
      const cLower = companyFilter.toLowerCase();
      list = list.filter((s) =>
        s.companyId === companyFilter ||
        s.companyCode === companyFilter ||
        (s.companyName && s.companyName.toLowerCase() === cLower)
      );
    }

    // 2. Origin – Destination Filter (AND)
    if (routeFilter && routeFilter !== 'All') {
      list = list.filter((s) => matchRoute(s.origin, s.destination, routeFilter));
    }

    // 3. Package Filter (AND)
    if (packageFilter && packageFilter !== 'All') {
      list = list.filter((s) => matchPackage(s.packages, packageFilter));
    }

    // 4. Weight Filter: 0 Weight vs Greater Than 0 (AND)
    if (weightFilter && weightFilter !== 'All') {
      list = list.filter((s) => matchWeight(s.actualWeight, s.chargeableWeight, weightFilter));
    }

    // 5. Search Bar Query (AND) - CN, Company, Consignor, Consignee, Origin, Destination, Invoice...
    const q = (search || searchQuery || '').toLowerCase().trim();
    if (q) {
      list = list.filter((s) => {
        const cnMatch = s.cnNumber && s.cnNumber.toLowerCase().includes(q);
        const compNameMatch = s.companyName && s.companyName.toLowerCase().includes(q);
        const compCodeMatch = s.companyCode && s.companyCode.toLowerCase().includes(q);
        const consignorMatch = s.consignor?.name && s.consignor.name.toLowerCase().includes(q);
        const consigneeMatch = s.consignee?.name && s.consignee.name.toLowerCase().includes(q);
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

    return sortShipments(list);
  }, [baseShipments, search, searchQuery, companyFilter, routeFilter, packageFilter, weightFilter]);

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
        const results = await shipmentService.getShipments({
          search: q,
          companyId: companyFilter,
          route: routeFilter,
          packageCount: packageFilter,
          weight: weightFilter,
          status: statusFilter
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
  }, [search, searchQuery, baseShipments, companyFilter, routeFilter, packageFilter, weightFilter, statusFilter]);

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

  const statusFilterOptions = [
    { label: 'All Statuses', value: 'All' },
    { label: 'Booked', value: 'Booked' },
    { label: 'Delivered', value: 'Delivered' },
  ];

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
        <div className="bg-white border border-slate-200 rounded-xl p-3.5 sm:p-4 shadow-xs space-y-3">
          <div className="flex flex-col md:flex-row items-center gap-3">
            <div className="w-full md:flex-1">
              <SearchBar
                value={search}
                onChange={handleSearchChange}
                placeholder="Search CN number, company, consignor, consignee, origin, destination, invoice..."
              />
            </div>

            <div className="grid grid-cols-2 sm:grid-cols-4 md:flex md:items-center gap-2 w-full md:w-auto">
              {/* 1. Company Filter */}
              <select
                value={companyFilter}
                onChange={(e) => setCompanyFilter(e.target.value)}
                className={`px-2.5 sm:px-3 py-2 text-xs bg-slate-50 border rounded-md font-medium focus:outline-none focus:ring-2 focus:ring-setu-600/20 w-full md:w-auto truncate transition-colors cursor-pointer ${
                  companyFilter !== 'All'
                    ? 'border-setu-500 text-setu-700 bg-setu-50/50 font-bold'
                    : 'border-slate-200 text-slate-700'
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

              {/* 2. Dynamic Origin – Destination Filter (Depends on Company) */}
              <select
                value={routeFilter}
                onChange={(e) => setRouteFilter(e.target.value)}
                className={`px-2.5 sm:px-3 py-2 text-xs bg-slate-50 border rounded-md font-medium focus:outline-none focus:ring-2 focus:ring-setu-600/20 w-full md:w-auto truncate transition-colors cursor-pointer ${
                  routeFilter !== 'All'
                    ? 'border-setu-500 text-setu-700 bg-setu-50/50 font-bold'
                    : 'border-slate-200 text-slate-700'
                }`}
                title="Filter by Origin – Destination Route"
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

              {/* 3. Dynamic Package Filter (Depends on Company + Route) */}
              <select
                value={packageFilter}
                onChange={(e) => setPackageFilter(e.target.value)}
                className={`px-2.5 sm:px-3 py-2 text-xs bg-slate-50 border rounded-md font-medium focus:outline-none focus:ring-2 focus:ring-setu-600/20 w-full md:w-auto truncate transition-colors cursor-pointer ${
                  packageFilter !== 'All'
                    ? 'border-setu-500 text-setu-700 bg-setu-50/50 font-bold'
                    : 'border-slate-200 text-slate-700'
                }`}
                title="Filter by Package Count"
              >
                <option value="All">
                  All Packages {availablePackages.length > 0 ? `(${availablePackages.reduce((acc, p) => acc + (p.count || 0), 0)})` : ''}
                </option>
                {availablePackages.map((p) => (
                  <option key={p.value} value={p.value}>
                    {p.label}
                  </option>
                ))}
              </select>

              {/* 4. Dynamic Weight Filter (0 Weight vs Greater Than 0) */}
              <select
                value={weightFilter}
                onChange={(e) => setWeightFilter(e.target.value)}
                className={`px-2.5 sm:px-3 py-2 text-xs bg-slate-50 border rounded-md font-medium focus:outline-none focus:ring-2 focus:ring-setu-600/20 w-full md:w-auto truncate transition-colors cursor-pointer ${
                  weightFilter !== 'All'
                    ? 'border-setu-500 text-setu-700 bg-setu-50/50 font-bold'
                    : 'border-slate-200 text-slate-700'
                }`}
                title="Filter by Weight"
              >
                <option value="All">
                  All Weights {availableWeights.length > 0 ? `(${availableWeights.reduce((acc, w) => acc + (w.count || 0), 0)})` : ''}
                </option>
                {availableWeights.map((w) => (
                  <option key={w.value} value={w.value}>
                    {w.label}
                  </option>
                ))}
              </select>

              {/* Reset All Filters Button */}
              <button
                onClick={() => {
                  setSearch('');
                  setCompanyFilter('All');
                  setRouteFilter('All');
                  setPackageFilter('All');
                  setWeightFilter('All');
                  setStatusFilter('All');
                }}
                className="col-span-2 sm:col-span-4 md:col-span-1 px-3 py-2 text-xs font-semibold text-slate-600 hover:text-slate-900 bg-slate-100 hover:bg-slate-200 rounded-md transition-colors text-center shrink-0 cursor-pointer"
                title="Reset all filters to default"
              >
                Reset
              </button>
            </div>
          </div>

          {/* Active Filter Badges with Individual Dismiss (x) and Clear All */}
          {(companyFilter !== 'All' || routeFilter !== 'All' || packageFilter !== 'All' || weightFilter !== 'All') && (
            <div className="flex flex-wrap items-center gap-1.5 pt-1 text-xs">
              <span className="text-[11px] font-semibold text-slate-400 mr-1">Active Filters:</span>
              {companyFilter !== 'All' && (
                <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-md text-[11px] font-semibold bg-setu-50 text-setu-700 border border-setu-200 shadow-2xs">
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
                <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-md text-[11px] font-semibold bg-blue-50 text-blue-700 border border-blue-200 shadow-2xs">
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
                <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-md text-[11px] font-semibold bg-emerald-50 text-emerald-700 border border-emerald-200 shadow-2xs">
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
                <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-md text-[11px] font-semibold bg-purple-50 text-purple-700 border border-purple-200 shadow-2xs">
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
              <button
                onClick={() => {
                  setCompanyFilter('All');
                  setRouteFilter('All');
                  setPackageFilter('All');
                  setWeightFilter('All');
                }}
                className="text-[11px] font-bold text-slate-500 hover:text-rose-600 underline ml-1 cursor-pointer"
              >
                Clear All
              </button>
            </div>
          )}

          <div className="pt-2.5 border-t border-slate-100 flex flex-col sm:flex-row sm:items-center justify-between gap-2 text-xs">
            <div className="overflow-x-auto max-w-full pb-1">
              <FilterBar
                options={statusFilterOptions}
                activeFilter={statusFilter}
                onSelectFilter={setStatusFilter}
              />
            </div>
            <span className="text-slate-500 font-medium shrink-0 text-[11px] sm:text-xs">
              Showing <strong>{shipments.length}</strong> Consignment Notes
            </span>
          </div>
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
