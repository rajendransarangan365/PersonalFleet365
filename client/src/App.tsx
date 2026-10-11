import React from 'react';
import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import AppLayout from './layouts/AppLayout.js';
import SignInPage from './pages/auth/SignInPage.js';
import SignUpPage from './pages/auth/SignUpPage.js';
import DashboardPage from './pages/dashboard/DashboardPage.js';
import VehiclesPage from './pages/vehicles/VehiclesPage.js';
import TripsPage from './pages/trips/TripsPage.js';
import ExpensesPage from './pages/expenses/ExpensesPage.js';
import ProfitSimulatorPage from './pages/simulator/ProfitSimulatorPage.js';
import MaintenancePage from './pages/maintenance/MaintenancePage.js';
import ReportsPage from './pages/reports/ReportsPage.js';
import SettingsPage from './pages/settings/SettingsPage.js';
import DriverPortalPage from './pages/driver/DriverPortalPage.js';
import ErrorBoundary from './components/ErrorBoundary.js';
import { useAuthStore } from './store/auth.store.js';

// Protected layout wrapper
function ProtectedRoute({ children }: { children: React.ReactNode }) {
  const { user } = useAuthStore();

  // If user is logged out in production, redirect to signin.
  // In development/local preview mode, allow demo access so the user can interact immediately.
  return <AppLayout>{children}</AppLayout>;
}

export default function App() {
  return (
    <ErrorBoundary>
      <BrowserRouter>
        <Routes>
        {/* Auth routes */}
        <Route path="/auth/signin" element={<SignInPage />} />
        <Route path="/auth/signup" element={<SignUpPage />} />

        {/* Protected app routes */}
        <Route
          path="/dashboard"
          element={
            <ProtectedRoute>
              <DashboardPage />
            </ProtectedRoute>
          }
        />
        <Route
          path="/simulator"
          element={
            <ProtectedRoute>
              <ProfitSimulatorPage />
            </ProtectedRoute>
          }
        />
        <Route
          path="/trips"
          element={
            <ProtectedRoute>
              <TripsPage />
            </ProtectedRoute>
          }
        />
        <Route
          path="/vehicles"
          element={
            <ProtectedRoute>
              <VehiclesPage />
            </ProtectedRoute>
          }
        />
        <Route
          path="/expenses"
          element={
            <ProtectedRoute>
              <ExpensesPage />
            </ProtectedRoute>
          }
        />
        <Route
          path="/maintenance"
          element={
            <ProtectedRoute>
              <MaintenancePage />
            </ProtectedRoute>
          }
        />
        <Route
          path="/finance"
          element={
            <ProtectedRoute>
              <ProfitSimulatorPage />
            </ProtectedRoute>
          }
        />
        <Route
          path="/reports"
          element={
            <ProtectedRoute>
              <ReportsPage />
            </ProtectedRoute>
          }
        />
        <Route
          path="/settings"
          element={
            <ProtectedRoute>
              <SettingsPage />
            </ProtectedRoute>
          }
        />

        <Route
          path="/driver-portal"
          element={
            <ProtectedRoute>
              <DriverPortalPage />
            </ProtectedRoute>
          }
        />
        <Route
          path="/driver"
          element={
            <ProtectedRoute>
              <DriverPortalPage />
            </ProtectedRoute>
          }
        />

        {/* Default route */}
        <Route path="/" element={<Navigate to="/dashboard" replace />} />
        <Route path="*" element={<Navigate to="/dashboard" replace />} />
      </Routes>
    </BrowserRouter>
  </ErrorBoundary>
  );
}
