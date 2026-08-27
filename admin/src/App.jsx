import React from 'react';
import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
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
const ProtectedRoute = ({ children }) => {
  const { isAuthenticated, loading } = useAuth();

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

  return children;
};

export const AppRoutes = () => {
  return (
    <Routes>
      {/* PUBLIC CUSTOMER TRACKING PORTAL (NO AUTH REQUIRED) */}
      <Route path="/track" element={<PublicTrackingPage />} />

      {/* Public Auth Route */}
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
        <Route index element={<Navigate to="/admin/dashboard" replace />} />
        <Route path="dashboard" element={<DashboardPage />} />

        {/* CHUNK 2: COMPANY MANAGEMENT MODULE ROUTES */}
        <Route path="companies" element={<CompaniesPage />} />
        <Route path="companies/new" element={<CompanyFormPage />} />
        <Route path="companies/:id" element={<CompanyDetailPage />} />
        <Route path="companies/:id/edit" element={<CompanyFormPage />} />

        {/* CHUNK 3: QUOTATIONS & RATE CARDS MODULE ROUTES */}
        <Route path="quotations" element={<QuotationsPage />} />
        <Route path="quotations/new" element={<QuotationFormPage />} />
        <Route path="quotations/:id" element={<QuotationDetailPage />} />
        <Route path="quotations/:id/edit" element={<QuotationFormPage />} />
        <Route path="quotations/:id/new-version" element={<QuotationFormPage />} />

        {/* CHUNK 4 & 5: SHIPMENT & AI DOCUMENT EXTRACTION MODULE ROUTES */}
        <Route path="shipments" element={<ShipmentsPage />} />
        <Route path="shipments/new" element={<ShipmentFormPage />} />
        <Route path="shipments/upload" element={<DocumentExtractionPage />} />
        <Route path="shipments/:id" element={<ShipmentDetailPage />} />
        <Route path="shipments/:id/edit" element={<ShipmentFormPage />} />

        {/* CHUNK 6: TRIP, TRANSPORTER, DRIVER & VEHICLE MANAGEMENT ROUTES */}
        <Route path="trips" element={<TripsPage />} />
        <Route path="trips/new" element={<TripFormPage />} />
        <Route path="trips/:id" element={<TripDetailPage />} />
        <Route path="trips/:id/edit" element={<TripFormPage />} />
        <Route path="transporters" element={<TransportersPage />} />
        <Route path="drivers" element={<DriversPage />} />
        <Route path="vehicles" element={<VehiclesPage />} />

        {/* CHUNK 7: POD & DELIVERY MANAGEMENT ROUTES */}
        <Route path="pod" element={<PODPage />} />
        <Route path="pod/pending" element={<PendingPODPage />} />
        <Route path="pod/:id" element={<PODDetailPage />} />

        {/* CHUNK 8: BILLING & AUTOMATIC INVOICE GENERATION ROUTES */}
        <Route path="billing" element={<BillingPage />} />
        <Route path="billing/create" element={<BillingReviewPage />} />
        <Route path="billing/invoices/:id" element={<InvoiceDetailPage />} />

        {/* CHUNK 9: PAYMENTS & CUSTOMER RECEIVABLES ROUTES */}
        <Route path="payments" element={<PaymentsPage />} />
        <Route path="payments/receivables" element={<ReceivablesPage />} />
        <Route path="payments/received" element={<PaymentsReceivedPage />} />
        <Route path="payments/:id" element={<PaymentDetailPage />} />

        {/* CHUNK 10: EXPENSES & PAYABLES MANAGEMENT ROUTES */}
        <Route path="expenses" element={<ExpensesPage />} />
        <Route path="expenses/new" element={<ExpenseFormPage />} />
        <Route path="expenses/:id" element={<ExpenseDetailPage />} />
        <Route path="payables" element={<PayablesPage />} />
        <Route path="payables/:id" element={<PayableDetailPage />} />

        {/* CHUNK 11: PROFITABILITY, MIS & MANAGEMENT REPORTING ROUTES */}
        <Route path="reports" element={<ReportsOverviewPage />} />
        <Route path="reports/shipments" element={<ShipmentProfitabilityPage />} />
        <Route path="reports/trips" element={<TripProfitabilityPage />} />
        <Route path="reports/customers" element={<CustomerProfitabilityPage />} />
        <Route path="reports/routes" element={<RouteAnalysisPage />} />
        <Route path="reports/monthly-mis" element={<MonthlyMISPage />} />

        {/* System Settings & User Management Module */}
        <Route path="settings" element={<SettingsPage />} />
      </Route>

      {/* Global Fallback Route */}
      <Route path="*" element={<Navigate to="/admin/dashboard" replace />} />
    </Routes>
  );
};

export default function App() {
  return (
    <BrowserRouter>
      <AuthProvider>
        <SearchProvider>
          <AppRoutes />
        </SearchProvider>
      </AuthProvider>
    </BrowserRouter>
  );
}
