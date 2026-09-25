import React from 'react';
import { NavLink, useLocation } from 'react-router-dom';
import clsx from 'clsx';
import {
  MapPin,
  Truck,
  Camera,
  FileCheck,
  PlusCircle
} from 'lucide-react';

export const DriverMobileBottomNav = () => {
  const location = useLocation();

  const navItems = [
    { name: 'Trips', path: '/admin/trips', icon: MapPin },
    { name: 'My Shipments', path: '/admin/shipments', icon: Truck },
    { name: 'Scan Invoice', path: '/admin/shipments/upload', icon: Camera, highlight: true },
    { name: 'POD', path: '/admin/pod', icon: FileCheck },
    { name: 'New CN', path: '/admin/shipments/new', icon: PlusCircle }
  ];

  return (
    <nav className="fixed bottom-0 left-0 right-0 z-40 bg-slate-900/95 backdrop-blur-md border-t border-slate-800 text-slate-300 lg:hidden shadow-2xl pb-safe">
      <div className="flex items-center justify-around h-16 px-1">
        {navItems.map((item) => {
          const Icon = item.icon;
          const isActive = location.pathname === item.path;

          if (item.highlight) {
            return (
              <NavLink
                key={item.path}
                to={item.path}
                className={({ isActive: active }) =>
                  clsx(
                    'flex flex-col items-center justify-center -mt-5 transition-transform active:scale-95',
                    active ? 'scale-105' : ''
                  )
                }
              >
                <div className="w-12 h-12 rounded-full bg-gradient-to-tr from-setu-600 to-blue-500 text-white flex items-center justify-center shadow-lg shadow-setu-600/40 border-2 border-slate-900">
                  <Icon className="w-6 h-6 animate-pulse" />
                </div>
                <span className="text-[10px] font-bold text-setu-400 mt-0.5 tracking-tight">
                  {item.name}
                </span>
              </NavLink>
            );
          }

          return (
            <NavLink
              key={item.path}
              to={item.path}
              className={({ isActive: active }) =>
                clsx(
                  'flex-1 flex flex-col items-center justify-center h-full py-1 text-center transition-colors active:scale-95',
                  active
                    ? 'text-setu-400 font-bold'
                    : 'text-slate-400 hover:text-slate-200 font-medium'
                )
              }
            >
              <Icon className={clsx('w-5 h-5 mb-0.5 transition-colors', isActive ? 'text-setu-400' : 'text-slate-400')} />
              <span className="text-[10px] leading-tight truncate max-w-[64px]">{item.name}</span>
            </NavLink>
          );
        })}
      </div>
    </nav>
  );
};
