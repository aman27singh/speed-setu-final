import React, { useState } from 'react';
import { Outlet } from 'react-router-dom';
import { Sidebar } from './Sidebar';
import { Header } from './Header';
import { DatabaseStatusBanner } from '../common/DatabaseStatusBanner';
import { DriverMobileBottomNav } from './DriverMobileBottomNav';
import { useAuth } from '../../context/AuthContext';

export const AdminLayout = () => {
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const { isDriver } = useAuth();

  return (
    <div className="min-h-screen bg-slate-50 flex flex-col">
      {/* MongoDB Atlas Error Status Alert Banner */}
      <DatabaseStatusBanner />

      {/* Sidebar */}
      <Sidebar isOpen={sidebarOpen} onClose={() => setSidebarOpen(false)} />

      {/* Main Container */}
      <div className="lg:pl-64 flex flex-col flex-1 min-w-0">
        {/* Top Header */}
        <Header onToggleSidebar={() => setSidebarOpen(!sidebarOpen)} />

        {/* Main Content Area */}
        <main className={`flex-1 p-3 sm:p-6 lg:p-8 max-w-7xl w-full mx-auto ${isDriver ? 'pb-20 lg:pb-8' : ''}`}>
          <Outlet />
        </main>
      </div>

      {/* Driver Mobile Bottom Navigation */}
      {isDriver && <DriverMobileBottomNav />}
    </div>
  );
};
