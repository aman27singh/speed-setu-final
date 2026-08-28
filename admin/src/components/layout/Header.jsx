import React, { useState, useEffect, useRef } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import { useAuth } from '../../context/AuthContext';
import { useSearch } from '../../context/SearchContext';
import { shipmentService } from '../../services/shipmentService';
import { billingService } from '../../services/billingService';
import { formatINR } from '../../utils/formatters';
import {
  Menu,
  Search,
  Bell,
  LogOut,
  User,
  ChevronDown,
  Building,
  ShieldCheck,
  Truck,
  Receipt,
  MapPin,
  X
} from 'lucide-react';

const ROUTE_TITLES = {
  '/admin/dashboard': 'Operations Dashboard',
  '/admin/shipments': 'Shipments / CN Management',
  '/admin/trips': 'Trips & Dispatch',
  '/admin/pod': 'Proof of Delivery (POD)',
  '/admin/companies': 'Company Directory',
  '/admin/quotations': 'Quotations & Rate Cards',
  '/admin/billing': 'Customer Billing & Invoices',
  '/admin/payments': 'Payment Collections',
  '/admin/expenses': 'Operational Expenses',
  '/admin/payables': 'Transporter Payables',
  '/admin/reports': 'Logistics Analytics & Reports',
  '/admin/settings': 'System Settings',
};

export const Header = ({ onToggleSidebar }) => {
  const location = useLocation();
  const navigate = useNavigate();
  const { user, logout } = useAuth();
  const { searchQuery, setSearchQuery } = useSearch();

  const [showProfileMenu, setShowProfileMenu] = useState(false);
  const [liveAlerts, setLiveAlerts] = useState([]);
  const [notificationsCount, setNotificationsCount] = useState(0);
  const [showNotificationsModal, setShowNotificationsModal] = useState(false);
  const [isSearchFocused, setIsSearchFocused] = useState(false);
  const [matchedShipments, setMatchedShipments] = useState([]);
  const [isSearching, setIsSearching] = useState(false);

  const searchContainerRef = useRef(null);
  const pageTitle = ROUTE_TITLES[location.pathname] || (location.pathname.startsWith('/admin/shipments/') ? 'Shipment Details' : 'Logistics Admin System');

  // Load live system alerts dynamically from MongoDB Atlas
  useEffect(() => {
    let isMounted = true;
    const loadSystemAlerts = async () => {
      try {
        const [shipments, invoices] = await Promise.all([
          shipmentService.getShipments().catch(() => []),
          billingService.getInvoices().catch(() => [])
        ]);

        const alerts = [];
        const pendingPODs = shipments.filter(s => s.podStatus === 'Pending' || s.podStatus === 'Unuploaded');
        if (pendingPODs.length > 0) {
          alerts.push({
            id: 'pod-alert',
            title: 'POD Upload Pending',
            message: `${pendingPODs.length} shipment${pendingPODs.length > 1 ? 's' : ''} awaiting POD verification.`
          });
        }

        const overdueInvoices = invoices.filter(i => (i.balanceAmount ?? i.balanceDue ?? 0) > 0 && i.status === 'Overdue');
        if (overdueInvoices.length > 0) {
          alerts.push({
            id: 'overdue-alert',
            title: 'Payment Overdue Alert',
            message: `${overdueInvoices.length} client invoice${overdueInvoices.length > 1 ? 's' : ''} require payment follow-up.`
          });
        }

        const inTransitShipments = shipments.filter(s => s.status === 'In Transit');
        if (inTransitShipments.length > 0) {
          alerts.push({
            id: 'transit-alert',
            title: 'Active In-Transit Monitoring',
            message: `${inTransitShipments.length} shipment${inTransitShipments.length > 1 ? 's' : ''} currently moving across hubs.`
          });
        }

        if (isMounted) {
          setLiveAlerts(alerts);
          setNotificationsCount(alerts.length);
        }
      } catch (err) {
        console.warn('[Header Alerts] Alerts check:', err.message);
      }
    };

    loadSystemAlerts();
    return () => { isMounted = false; };
  }, []);

  // Handle clicking outside of search dropdown
  useEffect(() => {
    const handleClickOutside = (e) => {
      if (searchContainerRef.current && !searchContainerRef.current.contains(e.target)) {
        setIsSearchFocused(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  // Dynamically fetch live search results from shipments store / MongoDB API
  useEffect(() => {
    const q = searchQuery.toLowerCase().trim();
    if (!q) {
      setMatchedShipments([]);
      return;
    }

    let isMounted = true;
    setIsSearching(true);

    const timer = setTimeout(async () => {
      try {
        const results = await shipmentService.getShipments({ search: searchQuery });
        if (isMounted) {
          setMatchedShipments(results || []);
        }
      } catch (err) {
        console.warn('[Header Search] Live shipment fetch warning:', err.message);
      } finally {
        if (isMounted) setIsSearching(false);
      }
    }, 100);

    return () => {
      isMounted = false;
      clearTimeout(timer);
    };
  }, [searchQuery]);

  const q = searchQuery.toLowerCase().trim();

  const matchedInvoices = [];
  const matchedPayables = [];

  const totalResultsCount = matchedShipments.length + matchedInvoices.length + matchedPayables.length;

  const handleLogout = async () => {
    await logout();
  };

  const handleSelectResult = (targetPath) => {
    setIsSearchFocused(false);
    navigate(targetPath);
  };

  return (
    <header className="h-16 bg-white border-b border-slate-200 sticky top-0 z-30 px-3 sm:px-4 lg:px-6 flex items-center justify-between shadow-xs gap-2">
      {/* Left side: Hamburger & Page Title */}
      <div className="flex items-center gap-2 sm:gap-3 shrink-0">
        <button
          onClick={onToggleSidebar}
          className="p-2 text-slate-600 hover:text-slate-900 hover:bg-slate-100 rounded-lg lg:hidden transition-colors min-w-[40px] min-h-[40px] flex items-center justify-center"
          aria-label="Toggle navigation menu"
        >
          <Menu className="w-5 h-5" />
        </button>

        <h2 className="text-sm sm:text-lg font-bold text-slate-800 tracking-tight hidden md:block">
          {pageTitle}
        </h2>
      </div>

      {/* Center: Global Functional Search Input */}
      <div ref={searchContainerRef} className="flex items-center flex-1 max-w-[150px] xs:max-w-[220px] sm:max-w-md mx-1 sm:mx-4 relative">
        <div className="relative w-full">
          <Search className="w-4 h-4 text-slate-400 absolute left-2.5 sm:left-3 top-1/2 -translate-y-1/2 pointer-events-none" />
          <input
            type="text"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            onFocus={() => setIsSearchFocused(true)}
            placeholder="Search CN #, Company..."
            className="w-full pl-8 sm:pl-9 pr-7 sm:pr-8 py-1.5 text-xs bg-slate-50 border border-slate-200 rounded-md focus:outline-none focus:ring-2 focus:ring-setu-600/20 focus:border-setu-600 focus:bg-white transition-all placeholder:text-slate-400 font-medium truncate"
          />
          {searchQuery && (
            <button
              onClick={() => setSearchQuery('')}
              className="absolute right-2 top-1/2 -translate-y-1/2 p-0.5 text-slate-400 hover:text-slate-600 rounded-full"
            >
              <X className="w-3.5 h-3.5" />
            </button>
          )}
        </div>

        {/* Live Search Results Dropdown */}
        {isSearchFocused && searchQuery.trim() !== '' && (
          <div className="absolute top-full -left-12 sm:left-0 right-0 sm:right-auto sm:w-full w-[85vw] max-w-lg mt-2 bg-white rounded-lg border border-slate-200 shadow-2xl overflow-hidden z-50 max-h-96 overflow-y-auto text-xs animate-fade-in">
            <div className="px-3 py-2 bg-slate-50 border-b border-slate-100 flex items-center justify-between text-slate-500 font-medium">
              <span className="truncate mr-2">Search Results for "{searchQuery}"</span>
              <span className="font-bold text-slate-700 shrink-0">{totalResultsCount} items found</span>
            </div>

            {totalResultsCount === 0 ? (
              <div className="p-4 text-center text-slate-500">
                No matching records found for "{searchQuery}".
              </div>
            ) : (
              <div className="divide-y divide-slate-100">
                {/* Shipments / CNs */}
                {matchedShipments.length > 0 && (
                  <div className="p-2">
                    <div className="px-2 py-1 text-[10px] font-bold text-slate-400 uppercase tracking-wider flex items-center justify-between">
                      <span>Shipments / Consignment Notes ({matchedShipments.length})</span>
                      <span className="text-[9px] text-setu-600 font-semibold">Click to open full A-to-Z detail</span>
                    </div>
                    {matchedShipments.map((s) => (
                      <div
                        key={s.id || s.cnNumber}
                        onClick={() => handleSelectResult(`/admin/shipments/${s.cnNumber || s.id}`)}
                        className="px-2 py-2 hover:bg-setu-50/80 rounded flex items-center justify-between cursor-pointer transition-colors group"
                      >
                        <div className="flex items-center gap-2">
                          <Truck className="w-4 h-4 text-setu-600 group-hover:scale-110 transition-transform shrink-0" />
                          <div>
                            <span className="font-bold text-setu-600 font-mono text-sm underline group-hover:text-setu-700">{s.cnNumber}</span>
                            <span className="text-slate-900 ml-2 font-semibold">{s.companyName || s.company}</span>
                          </div>
                        </div>
                        <div className="text-right">
                          <span className="text-[11px] text-slate-500 block">{s.origin} → {s.destination}</span>
                          <span className="text-[10px] text-slate-400 font-medium">View Complete Record →</span>
                        </div>
                      </div>
                    ))}
                  </div>
                )}

                {/* Invoices */}
                {matchedInvoices.length > 0 && (
                  <div className="p-2">
                    <div className="px-2 py-1 text-[10px] font-bold text-slate-400 uppercase tracking-wider">
                      Invoices & Outstanding ({matchedInvoices.length})
                    </div>
                    {matchedInvoices.map((inv) => (
                      <div
                        key={inv.id}
                        onClick={() => handleSelectResult('/admin/dashboard')}
                        className="px-2 py-1.5 hover:bg-slate-50 rounded flex items-center justify-between cursor-pointer transition-colors"
                      >
                        <div className="flex items-center gap-2">
                          <Receipt className="w-3.5 h-3.5 text-rose-600 shrink-0" />
                          <div>
                            <span className="font-bold font-mono text-slate-900">{inv.invoice}</span>
                            <span className="text-slate-700 ml-2">{inv.company}</span>
                          </div>
                        </div>
                        <span className="font-bold text-slate-900">{formatINR(inv.amount)}</span>
                      </div>
                    ))}
                  </div>
                )}

                {/* Payables */}
                {matchedPayables.length > 0 && (
                  <div className="p-2">
                    <div className="px-2 py-1 text-[10px] font-bold text-slate-400 uppercase tracking-wider">
                      Transporter Payables ({matchedPayables.length})
                    </div>
                    {matchedPayables.map((p) => (
                      <div
                        key={p.id}
                        onClick={() => handleSelectResult('/admin/dashboard')}
                        className="px-2 py-1.5 hover:bg-slate-50 rounded flex items-center justify-between cursor-pointer transition-colors"
                      >
                        <div className="flex items-center gap-2">
                          <MapPin className="w-3.5 h-3.5 text-emerald-600 shrink-0" />
                          <div>
                            <span className="font-bold text-slate-900">{p.vendor}</span>
                            <span className="text-slate-500 font-mono text-[11px] ml-2">{p.trip}</span>
                          </div>
                        </div>
                        <span className="font-bold text-slate-900">{formatINR(p.amount)}</span>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            )}
          </div>
        )}
      </div>

      {/* Right side: Notifications & User Profile */}
      <div className="flex items-center gap-3">
        {/* Notification Bell */}
        <div className="relative">
          <button
            onClick={() => setShowNotificationsModal(!showNotificationsModal)}
            className="p-2 text-slate-600 hover:text-slate-900 hover:bg-slate-100 rounded-lg relative transition-colors"
            title="Notifications"
          >
            <Bell className="w-5 h-5" />
            {notificationsCount > 0 && (
              <span className="absolute top-1.5 right-1.5 w-2 h-2 rounded-full bg-orange-500 ring-2 ring-white animate-pulse" />
            )}
          </button>

          {/* Quick Notification Dropdown */}
          {showNotificationsModal && (
            <div className="absolute right-0 mt-2 w-80 bg-white rounded-lg border border-slate-200 shadow-xl py-2 z-50 text-xs">
              <div className="px-4 py-2 border-b border-slate-100 flex items-center justify-between font-semibold text-slate-800">
                <span>Recent System Alerts</span>
                <span className="text-[10px] text-setu-600 font-normal cursor-pointer" onClick={() => setNotificationsCount(0)}>
                  Mark read
                </span>
              </div>
              <div className="divide-y divide-slate-100 max-h-64 overflow-y-auto">
                {liveAlerts && liveAlerts.length > 0 ? (
                  liveAlerts.map((alert) => (
                    <div key={alert.id} className="p-3 hover:bg-slate-50 transition-colors">
                      <p className="font-semibold text-slate-800">{alert.title}</p>
                      <p className="text-slate-500 text-[11px] mt-0.5">{alert.message}</p>
                    </div>
                  ))
                ) : (
                  <div className="p-5 text-center text-slate-500">
                    <Bell className="w-6 h-6 text-slate-300 mx-auto mb-2" />
                    <p className="font-semibold text-slate-700 text-xs">No Active System Alerts</p>
                    <p className="text-[11px] text-slate-400 mt-0.5">All operational shipments & invoices are up to date.</p>
                  </div>
                )}
              </div>
            </div>
          )}
        </div>

        <div className="h-6 w-px bg-slate-200 mx-1 hidden sm:block" />

        {/* User Profile Dropdown */}
        <div className="relative">
          <button
            onClick={() => setShowProfileMenu(!showProfileMenu)}
            className="flex items-center gap-2.5 p-1 rounded-lg hover:bg-slate-100 transition-colors text-left"
          >
            <div className="w-8 h-8 rounded-full bg-setu-600 text-white font-bold flex items-center justify-center text-xs shadow-xs">
              {user?.name ? user.name.charAt(0) : 'A'}
            </div>
            <div className="hidden sm:block text-left">
              <span className="block text-xs font-semibold text-slate-800 leading-tight">
                {user?.name || 'Speed Setu Admin'}
              </span>
              <span className="block text-[10px] text-slate-500 font-medium">
                {user?.role || 'Super Admin'}
              </span>
            </div>
            <ChevronDown className="w-3.5 h-3.5 text-slate-400 hidden sm:block" />
          </button>

          {/* Profile Dropdown Menu */}
          {showProfileMenu && (
            <div className="absolute right-0 mt-2 w-56 bg-white rounded-lg border border-slate-200 shadow-xl py-1 z-50 text-xs">
              <div className="px-4 py-3 border-b border-slate-100">
                <p className="font-bold text-slate-800">{user?.name || 'Admin User'}</p>
                <p className="text-slate-500 text-[11px] truncate">{user?.email || 'admin@speedsetu.com'}</p>
              </div>

              <div className="py-1 border-b border-slate-100">
                <div className="px-4 py-1.5 text-slate-600 flex items-center gap-2 hover:bg-slate-50 cursor-pointer">
                  <User className="w-3.5 h-3.5 text-slate-400" />
                  <span>Profile Settings</span>
                </div>
                <div className="px-4 py-1.5 text-slate-600 flex items-center gap-2 hover:bg-slate-50 cursor-pointer">
                  <Building className="w-3.5 h-3.5 text-slate-400" />
                  <span>Speed Setu Logistics Pvt Ltd</span>
                </div>
                <div className="px-4 py-1.5 text-slate-600 flex items-center gap-2 hover:bg-slate-50 cursor-pointer">
                  <ShieldCheck className="w-3.5 h-3.5 text-slate-400" />
                  <span>Admin Access Level 5</span>
                </div>
              </div>

              <div className="py-1">
                <button
                  onClick={handleLogout}
                  className="w-full px-4 py-2 text-rose-600 hover:bg-rose-50 flex items-center gap-2 font-semibold transition-colors"
                >
                  <LogOut className="w-3.5 h-3.5" />
                  <span>Log Out Admin</span>
                </button>
              </div>
            </div>
          )}
        </div>
      </div>
    </header>
  );
};
