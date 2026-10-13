import React from 'react';
import { BrowserRouter, Routes, Route, Navigate, useLocation } from 'react-router-dom';
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
import CustomerPortalPage from './pages/customer/CustomerPortalPage.js';
import TaxiBookingsPage from './pages/bookings/TaxiBookingsPage.js';
import MessagesPage from './pages/messages/MessagesPage.js';
import ErrorBoundary from './components/ErrorBoundary.js';
import { useAuthStore } from './store/auth.store.js';

// Protected layout wrapper with Role-Based Access Control (RBAC)
function ProtectedRoute({
  children,
  allowedRoles,
}: {
  children: React.ReactNode;
  allowedRoles?: string[];
}) {
  const { user, businesses, activeBusinessId } = useAuthStore();
  const location = useLocation();

  // 1. Mandatory Authentication Check: If not logged in, redirect directly to Sign In
  if (!user) {
    return <Navigate to="/auth/signin" state={{ from: location }} replace />;
  }

  const userRole =
    (user as any)?.role ||
    businesses.find((b) => b.businessId === activeBusinessId)?.role ||
    businesses[0]?.role ||
    'fleet_owner';

  // Role Boundary 1: Driver can access /driver-portal, /taxi-bookings, /vehicles, /messages
  if (userRole === 'driver') {
    const driverAllowed = ['/driver-portal', '/taxi-bookings', '/vehicles', '/driver', '/messages'];
    const isAllowed = driverAllowed.some((path) => location.pathname.startsWith(path));
    if (!isAllowed) {
      return <Navigate to="/driver-portal" replace />;
    }
  }

  // Role Boundary 2: Customer can access /bookings, /customer, /book, /taxi-bookings, /messages
  if (userRole === 'customer') {
    const customerAllowed = ['/bookings', '/customer', '/book', '/taxi-bookings', '/messages'];
    const isAllowed = customerAllowed.some((path) => location.pathname.startsWith(path));
    if (!isAllowed) {
      return <Navigate to="/bookings" replace />;
    }
  }

  // Role Boundary 3: Telecaller can access /taxi-bookings, /driver-portal, /customer, /bookings, /messages
  if (userRole === 'telecaller' || userRole === 'support') {
    const telecallerAllowed = ['/taxi-bookings', '/driver-portal', '/customer', '/bookings', '/messages'];
    const isAllowed = telecallerAllowed.some((path) => location.pathname.startsWith(path));
    if (!isAllowed) {
      return <Navigate to="/taxi-bookings" replace />;
    }
  }

  // Role Boundary 4: Operations Manager cannot access finance or profit simulator
  if (userRole === 'fleet_manager' || userRole === 'operations_manager') {
    const managerBlocked = ['/finance', '/simulator'];
    const isBlocked = managerBlocked.some((path) => location.pathname.startsWith(path));
    if (isBlocked) {
      return <Navigate to="/dashboard" replace />;
    }
  }

  // Role Boundary 5: Explicit allowedRoles check if provided
  if (allowedRoles && allowedRoles.length > 0 && !allowedRoles.includes(userRole)) {
    if (userRole === 'driver') return <Navigate to="/driver-portal" replace />;
    if (userRole === 'customer') return <Navigate to="/bookings" replace />;
    if (userRole === 'telecaller') return <Navigate to="/taxi-bookings" replace />;
    return <Navigate to="/dashboard" replace />;
  }

  return <AppLayout>{children}</AppLayout>;
}

// Smart Role-Aware Home Redirection
function RoleBasedHomeRedirect() {
  const { user, businesses, activeBusinessId } = useAuthStore();
  if (!user) {
    return <Navigate to="/auth/signin" replace />;
  }

  const userRole =
    (user as any)?.role ||
    businesses.find((b) => b.businessId === activeBusinessId)?.role ||
    businesses[0]?.role ||
    'fleet_owner';

  if (userRole === 'driver') return <Navigate to="/driver-portal" replace />;
  if (userRole === 'customer') return <Navigate to="/bookings" replace />;
  if (userRole === 'telecaller' || userRole === 'support') return <Navigate to="/taxi-bookings" replace />;
  return <Navigate to="/dashboard" replace />;
}

export default function App() {
  return (
    <ErrorBoundary>
      <BrowserRouter>
        <Routes>
        {/* Auth routes */}
        <Route path="/auth/signin" element={<SignInPage />} />
        <Route path="/auth/signup" element={<SignUpPage />} />
        <Route path="/dev" element={<SignInPage />} />
        <Route path="/demo" element={<SignInPage />} />
        <Route path="/auth/dev" element={<SignInPage />} />

        {/* Dedicated Customer Taxi Ride Portal */}
        <Route path="/bookings" element={<CustomerPortalPage />} />
        <Route path="/customer" element={<CustomerPortalPage />} />
        <Route path="/book" element={<CustomerPortalPage />} />

        {/* Real In-App Messages, WhatsApp Voice Notes & Communications Center */}
        <Route
          path="/messages"
          element={
            <ProtectedRoute>
              <MessagesPage />
            </ProtectedRoute>
          }
        />

        {/* Taxi Bookings & Dispatch Center (Owner, Manager, Call Center) */}
        <Route
          path="/taxi-bookings"
          element={
            <ProtectedRoute>
              <TaxiBookingsPage />
            </ProtectedRoute>
          }
        />

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

        {/* Default route (Role-Aware) */}
        <Route path="/" element={<RoleBasedHomeRedirect />} />
        <Route path="*" element={<RoleBasedHomeRedirect />} />
      </Routes>
    </BrowserRouter>
  </ErrorBoundary>
  );
}
