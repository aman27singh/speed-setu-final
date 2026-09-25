import React from 'react';
import { BrowserRouter, Routes, Route, Navigate, useNavigate } from 'react-router-dom';
import { AuthProvider, useAuth } from './context/AuthContext';
import { SearchProvider } from './context/SearchContext';
import { AdminLayout } from './components/layout/AdminLayout';
import { LoginPage } from './pages/LoginPage';
import { DashboardPage } from './pages/DashboardPage';
import { ShipmentsPage } from './pages/ShipmentsPage';
import { ShipmentFormPage } from './pages/ShipmentFormPage';
import { ShipmentDetailPage } from './pages/ShipmentDetailPage';
import { DocumentExtractionPage } from './pages/DocumentExtractionPage';
import { CompaniesPage } from './pages/CompaniesPage';
import { CompanyFormPage } from './pages/CompanyFormPage';
import { CompanyDetailPage } from './pages/CompanyDetailPage';
import { QuotationsPage } from './pages/QuotationsPage';
import { QuotationFormPage } from './pages/QuotationFormPage';
import { QuotationDetailPage } from './pages/QuotationDetailPage';
import { TripsPage } from './pages/TripsPage';
import { TripFormPage } from './pages/TripFormPage';
import { TripDetailPage } from './pages/TripDetailPage';
import { TransportersPage } from './pages/TransportersPage';
import { DriversPage } from './pages/DriversPage';
import { VehiclesPage } from './pages/VehiclesPage';
import { PODPage } from './pages/PODPage';
import { PendingPODPage } from './pages/PendingPODPage';
import { PODDetailPage } from './pages/PODDetailPage';
import { PublicTrackingPage } from './pages/PublicTrackingPage';
import { BillingPage } from './pages/BillingPage';
import { BillingReviewPage } from './pages/BillingReviewPage';
import { InvoiceDetailPage } from './pages/InvoiceDetailPage';
import { PaymentsPage } from './pages/PaymentsPage';
import { ReceivablesPage } from './pages/ReceivablesPage';
import { PaymentsReceivedPage } from './pages/PaymentsReceivedPage';
import { PaymentDetailPage } from './pages/PaymentDetailPage';
import { ExpensesPage } from './pages/ExpensesPage';
import { ExpenseFormPage } from './pages/ExpenseFormPage';
import { ExpenseDetailPage } from './pages/ExpenseDetailPage';
import { PayablesPage } from './pages/PayablesPage';
import { PayableDetailPage } from './pages/PayableDetailPage';
import { ReportsOverviewPage } from './pages/ReportsOverviewPage';
import { ShipmentProfitabilityPage } from './pages/ShipmentProfitabilityPage';
import { TripProfitabilityPage } from './pages/TripProfitabilityPage';
import { CustomerProfitabilityPage } from './pages/CustomerProfitabilityPage';
import { RouteAnalysisPage } from './pages/RouteAnalysisPage';
import { MonthlyMISPage } from './pages/MonthlyMISPage';
import { SettingsPage } from './pages/SettingsPage';
import { PlaceholderPage } from './pages/PlaceholderPage';
import { LoadingState } from './components/common/LoadingState';

// Protected Route Wrapper Component
const ProtectedRoute = ({ children, allowedRoles }) => {
  const { isAuthenticated, loading, isDriver, hasRole } = useAuth();

  if (loading) {
    return (
      <div className="h-screen w-screen flex items-center justify-center bg-slate-900 text-white">
        <LoadingState message="Authenticating Speed Setu Session..." />
      </div>
    );
  }

  if (!isAuthenticated) {
    return <Navigate to="/admin/login" replace />;
  }

  if (allowedRoles && !hasRole(allowedRoles)) {
    if (isDriver) {
      return <Navigate to="/admin/shipments" replace />;
    }
    return <Navigate to="/admin/dashboard" replace />;
  }

  return children;
};

// Driver Index Redirect Helper
const AdminIndexRedirect = () => {
  const { isDriver } = useAuth();
  if (isDriver) {
    return <Navigate to="/admin/shipments" replace />;
  }
  return <Navigate to="/admin/dashboard" replace />;
};

export const AppRoutes = () => {
  return (
    <Routes>
      {/* PUBLIC CUSTOMER TRACKING PORTAL (NO AUTH REQUIRED) */}
      <Route path="/track" element={<PublicTrackingPage />} />

      {/* Root & Public Auth Routes */}
      <Route path="/" element={<Navigate to="/admin/login" replace />} />
      <Route path="/login" element={<Navigate to="/admin/login" replace />} />
      <Route path="/admin/login" element={<LoginPage />} />

      {/* Protected Admin Shell Routes */}
      <Route
        path="/admin"
        element={
          <ProtectedRoute>
            <AdminLayout />
          </ProtectedRoute>
        }
      >
        <Route index element={<AdminIndexRedirect />} />
        <Route path="dashboard" element={<ProtectedRoute allowedRoles={['Super Admin', 'Admin']}><DashboardPage /></ProtectedRoute>} />

        {/* COMMERCIAL MODULE ROUTES (Super Admin & Admin) */}
        <Route path="companies" element={<ProtectedRoute allowedRoles={['Super Admin', 'Admin']}><CompaniesPage /></ProtectedRoute>} />
        <Route path="companies/new" element={<ProtectedRoute allowedRoles={['Super Admin', 'Admin']}><CompanyFormPage /></ProtectedRoute>} />
        <Route path="companies/:id" element={<ProtectedRoute allowedRoles={['Super Admin', 'Admin']}><CompanyDetailPage /></ProtectedRoute>} />
        <Route path="companies/:id/edit" element={<ProtectedRoute allowedRoles={['Super Admin', 'Admin']}><CompanyFormPage /></ProtectedRoute>} />

        <Route path="quotations" element={<ProtectedRoute allowedRoles={['Super Admin', 'Admin']}><QuotationsPage /></ProtectedRoute>} />
        <Route path="quotations/new" element={<ProtectedRoute allowedRoles={['Super Admin', 'Admin']}><QuotationFormPage /></ProtectedRoute>} />
        <Route path="quotations/:id" element={<ProtectedRoute allowedRoles={['Super Admin', 'Admin']}><QuotationDetailPage /></ProtectedRoute>} />
        <Route path="quotations/:id/edit" element={<ProtectedRoute allowedRoles={['Super Admin', 'Admin']}><QuotationFormPage /></ProtectedRoute>} />
        <Route path="quotations/:id/new-version" element={<ProtectedRoute allowedRoles={['Super Admin', 'Admin']}><QuotationFormPage /></ProtectedRoute>} />

        {/* OPERATIONS MODULE ROUTES (All Roles Have Access to Operations / Driver Assigned Trips) */}
        <Route path="shipments" element={<ShipmentsPage />} />
        <Route path="shipments/new" element={<ProtectedRoute allowedRoles={['Super Admin', 'Admin', 'Driver']}><ShipmentFormPage /></ProtectedRoute>} />
        <Route path="shipments/upload" element={<ProtectedRoute allowedRoles={['Super Admin', 'Admin', 'Driver']}><DocumentExtractionPage /></ProtectedRoute>} />
        <Route path="shipments/:id" element={<ShipmentDetailPage />} />
        <Route path="shipments/:id/edit" element={<ProtectedRoute allowedRoles={['Super Admin', 'Admin', 'Driver']}><ShipmentFormPage /></ProtectedRoute>} />

        <Route path="trips" element={<TripsPage />} />
        <Route path="trips/new" element={<ProtectedRoute allowedRoles={['Super Admin', 'Admin']}><TripFormPage /></ProtectedRoute>} />
        <Route path="trips/:id" element={<TripDetailPage />} />
        <Route path="trips/:id/edit" element={<ProtectedRoute allowedRoles={['Super Admin', 'Admin']}><TripFormPage /></ProtectedRoute>} />
        <Route path="transporters" element={<ProtectedRoute allowedRoles={['Super Admin', 'Admin']}><TransportersPage /></ProtectedRoute>} />
        <Route path="drivers" element={<ProtectedRoute allowedRoles={['Super Admin', 'Admin']}><DriversPage /></ProtectedRoute>} />
        <Route path="vehicles" element={<ProtectedRoute allowedRoles={['Super Admin', 'Admin']}><VehiclesPage /></ProtectedRoute>} />

        {/* POD & DELIVERY MANAGEMENT ROUTES (All Roles Can View & Upload POD) */}
        <Route path="pod" element={<PODPage />} />
        <Route path="pod/pending" element={<PendingPODPage />} />
        <Route path="pod/:id" element={<PODDetailPage />} />

        {/* FINANCE MODULE ROUTES (Super Admin & Admin Only) */}
        <Route path="billing" element={<ProtectedRoute allowedRoles={['Super Admin', 'Admin']}><BillingPage /></ProtectedRoute>} />
        <Route path="billing/create" element={<ProtectedRoute allowedRoles={['Super Admin', 'Admin']}><BillingReviewPage /></ProtectedRoute>} />
        <Route path="billing/invoices/:id" element={<ProtectedRoute allowedRoles={['Super Admin', 'Admin']}><InvoiceDetailPage /></ProtectedRoute>} />

        <Route path="payments" element={<ProtectedRoute allowedRoles={['Super Admin', 'Admin']}><PaymentsPage /></ProtectedRoute>} />
        <Route path="payments/receivables" element={<ProtectedRoute allowedRoles={['Super Admin', 'Admin']}><ReceivablesPage /></ProtectedRoute>} />
        <Route path="payments/received" element={<ProtectedRoute allowedRoles={['Super Admin', 'Admin']}><PaymentsReceivedPage /></ProtectedRoute>} />
        <Route path="payments/:id" element={<ProtectedRoute allowedRoles={['Super Admin', 'Admin']}><PaymentDetailPage /></ProtectedRoute>} />

        <Route path="expenses" element={<ProtectedRoute allowedRoles={['Super Admin', 'Admin']}><ExpensesPage /></ProtectedRoute>} />
        <Route path="expenses/new" element={<ProtectedRoute allowedRoles={['Super Admin', 'Admin']}><ExpenseFormPage /></ProtectedRoute>} />
        <Route path="expenses/:id" element={<ProtectedRoute allowedRoles={['Super Admin', 'Admin']}><ExpenseDetailPage /></ProtectedRoute>} />
        <Route path="payables" element={<ProtectedRoute allowedRoles={['Super Admin', 'Admin']}><PayablesPage /></ProtectedRoute>} />
        <Route path="payables/:id" element={<ProtectedRoute allowedRoles={['Super Admin', 'Admin']}><PayableDetailPage /></ProtectedRoute>} />

        {/* EXECUTIVE REPORTING MODULE ROUTES (Super Admin Only) */}
        <Route path="reports" element={<ProtectedRoute allowedRoles={['Super Admin']}><ReportsOverviewPage /></ProtectedRoute>} />
        <Route path="reports/shipments" element={<ProtectedRoute allowedRoles={['Super Admin']}><ShipmentProfitabilityPage /></ProtectedRoute>} />
        <Route path="reports/trips" element={<ProtectedRoute allowedRoles={['Super Admin']}><TripProfitabilityPage /></ProtectedRoute>} />
        <Route path="reports/customers" element={<ProtectedRoute allowedRoles={['Super Admin']}><CustomerProfitabilityPage /></ProtectedRoute>} />
        <Route path="reports/routes" element={<ProtectedRoute allowedRoles={['Super Admin']}><RouteAnalysisPage /></ProtectedRoute>} />
        <Route path="reports/monthly-mis" element={<ProtectedRoute allowedRoles={['Super Admin']}><MonthlyMISPage /></ProtectedRoute>} />

        {/* System Settings & User Management Module (Super Admin Only) */}
        <Route path="settings" element={<ProtectedRoute allowedRoles={['Super Admin']}><SettingsPage /></ProtectedRoute>} />
      </Route>

      {/* Global Fallback Route */}
      <Route path="*" element={<Navigate to="/admin/dashboard" replace />} />
    </Routes>
  );
};

function SpaRedirectHandler() {
  const navigate = useNavigate();
  React.useEffect(() => {
    const redirectPath = sessionStorage.getItem('speedsetu_spa_redirect');
    if (redirectPath) {
      sessionStorage.removeItem('speedsetu_spa_redirect');
      if (redirectPath !== window.location.pathname) {
        navigate(redirectPath, { replace: true });
      }
    }
  }, [navigate]);
  return null;
}

export default function App() {
  return (
    <BrowserRouter>
      <AuthProvider>
        <SearchProvider>
          <SpaRedirectHandler />
          <AppRoutes />
        </SearchProvider>
      </AuthProvider>
    </BrowserRouter>
  );
}
