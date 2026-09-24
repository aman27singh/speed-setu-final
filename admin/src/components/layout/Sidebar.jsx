import React from 'react';
import { NavLink, useLocation } from 'react-router-dom';
import clsx from 'clsx';
import logoImg from '../../assets/logo1.png';
import { useAuth } from '../../context/AuthContext';
import {
  LayoutDashboard,
  Truck,
  MapPin,
  FileCheck,
  Building2,
  FileSpreadsheet,
  Receipt,
  CreditCard,
  TrendingDown,
  DollarSign,
  BarChart3,
  Settings,
  ShieldAlert,
  UserCheck,
  Plus,
  Camera,
  Sparkles
} from 'lucide-react';

export const Sidebar = ({ isOpen, onClose }) => {
  const location = useLocation();
  const { user, isSuperAdmin, isDriver } = useAuth();

  const role = user?.role || 'Super Admin';

  // Role-based Navigation Configuration
  let navGroups = [];

  if (isDriver) {
    // Driver Portal Navigation
    navGroups = [
      {
        groupLabel: 'Driver Portal',
        items: [
          { name: 'My Assigned Trips', path: '/admin/trips', icon: MapPin },
          { name: 'Scan Invoice (Create CN)', path: '/admin/shipments/upload', icon: Camera },
          { name: 'Upload ePOD', path: '/admin/pod', icon: FileCheck },
          { name: 'Assigned Shipments', path: '/admin/shipments', icon: Truck },
          { name: 'Create Shipment', path: '/admin/shipments/new', icon: Plus }
        ]
      }
    ];
  } else {
    // Full Unrestricted Navigation for Super Admin & Admin / Staff
    navGroups = [
      {
        groupLabel: null,
        items: [
          { name: 'Dashboard', path: '/admin/dashboard', icon: LayoutDashboard }
        ]
      },
      {
        groupLabel: 'Operations',
        items: [
          { name: 'Shipments', path: '/admin/shipments', icon: Truck },
          { name: 'Trips', path: '/admin/trips', icon: MapPin },
          { name: 'POD', path: '/admin/pod', icon: FileCheck }
        ]
      },
      {
        groupLabel: 'Commercial',
        items: [
          { name: 'Companies', path: '/admin/companies', icon: Building2 },
          { name: 'Quotations & Rate Cards', path: '/admin/quotations', icon: FileSpreadsheet }
        ]
      },
      {
        groupLabel: 'Finance',
        items: [
          { name: 'Billing', path: '/admin/billing', icon: Receipt },
          { name: 'Payments', path: '/admin/payments', icon: CreditCard },
          { name: 'Expenses', path: '/admin/expenses', icon: TrendingDown },
          { name: 'Payables', path: '/admin/payables', icon: DollarSign }
        ]
      },
      {
        groupLabel: 'Analytics & Management',
        items: [
          { name: 'Reports', path: '/admin/reports', icon: BarChart3 },
          { name: 'Settings', path: '/admin/settings', icon: Settings }
        ]
      }
    ];
  }

  return (
    <>
      {/* Mobile Backdrop */}
      {isOpen && (
        <div
          onClick={onClose}
          className="fixed inset-0 z-40 bg-slate-900/50 backdrop-blur-sm lg:hidden transition-opacity"
        />
      )}

      <aside
        className={clsx(
          'fixed top-0 left-0 z-40 h-screen w-64 bg-slate-900 text-slate-300 border-r border-slate-800 flex flex-col transition-transform duration-300 ease-in-out lg:translate-x-0',
          isOpen ? 'translate-x-0' : '-translate-x-full'
        )}
      >
        {/* Brand Header */}
        <div className="px-5 py-3 border-b border-slate-800 flex flex-col justify-center shrink-0 gap-1.5">
          <div className="flex items-center justify-between">
            <NavLink to={isDriver ? "/admin/trips" : "/admin/dashboard"} className="flex items-center gap-3 group">
              <img
                src={logoImg}
                alt="Speed Setu Logo"
                className="h-8 w-auto object-contain shrink-0 group-hover:scale-105 transition-transform"
              />
              <div>
                <span className="font-bold text-white tracking-tight text-sm block leading-tight">
                  Speed Setu
                </span>
                <span className="text-[9px] font-medium tracking-wider uppercase text-setu-400 block">
                  Logistics ERP
                </span>
              </div>
            </NavLink>
          </div>

          {/* Active Role Badge Pill */}
          <div className="flex items-center gap-1.5 mt-0.5">
            <UserCheck className="w-3.5 h-3.5 text-slate-400" />
            <span
              className={clsx(
                'text-[10px] font-extrabold uppercase px-2 py-0.5 rounded tracking-wide',
                isSuperAdmin && 'bg-amber-500/20 text-amber-300 border border-amber-500/30',
                !isSuperAdmin && !isDriver && 'bg-blue-500/20 text-blue-300 border border-blue-500/30',
                isDriver && 'bg-emerald-500/20 text-emerald-300 border border-emerald-500/30'
              )}
            >
              {role}
            </span>
          </div>
        </div>

        {/* Navigation Menu */}
        <div className="flex-1 overflow-y-auto px-3 py-4 space-y-6">
          {navGroups.map((group, groupIdx) => (
            <div key={groupIdx}>
              {group.groupLabel && (
                <div className="px-3 mb-2 text-[11px] font-bold text-slate-400 uppercase tracking-wider">
                  {group.groupLabel}
                </div>
              )}
              <div className="space-y-1">
                {group.items.map((item) => {
                  const Icon = item.icon;
                  return (
                    <NavLink
                      key={item.path}
                      to={item.path}
                      onClick={onClose}
                      className={({ isActive }) =>
                        clsx(
                          'flex items-center justify-between px-3 py-2 rounded-md text-xs font-medium transition-colors group',
                          isActive
                            ? 'bg-setu-600 text-white font-semibold shadow-sm'
                            : 'text-slate-300 hover:bg-slate-800 hover:text-white'
                        )
                      }
                    >
                      <div className="flex items-center gap-2.5">
                        <Icon className="w-4 h-4 text-slate-400 group-hover:text-white transition-colors" />
                        <span>{item.name}</span>
                      </div>
                    </NavLink>
                  );
                })}
              </div>
            </div>
          ))}
        </div>

        {/* Footer info */}
        <div className="p-3.5 border-t border-slate-800 bg-slate-950/50 shrink-0">
          <div className="flex items-center gap-2 text-xs text-slate-400">
            <ShieldAlert className="w-4 h-4 text-setu-400 shrink-0" />
            <div>
              <p className="font-medium text-slate-200 text-[11px]">Role Shell ({role})</p>
              <p className="text-[10px] text-slate-400">{user?.name || user?.username || 'Authenticated'}</p>
            </div>
          </div>
        </div>
      </aside>
    </>
  );
};
