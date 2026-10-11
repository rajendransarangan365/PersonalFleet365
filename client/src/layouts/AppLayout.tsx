import React, { useState, useEffect, useCallback } from 'react';
import { Link, useLocation, useNavigate } from 'react-router-dom';
import {
  LayoutDashboard, Car, MapPin, Fuel, Wrench, TrendingUp,
  FileBarChart, Settings, Calculator, LogOut, Bell, ChevronLeft,
  ChevronRight, Menu, X, Truck, Building2, ChevronDown, Sparkles,
  Navigation, PlusCircle, MessageSquare, Phone, Users, ShieldAlert
} from 'lucide-react';
import { useAuthStore } from '../store/auth.store.js';
import VersionUpdateModal from '../components/VersionUpdateModal.js';
import VersionUpdateToast from '../components/VersionUpdateToast.js';
import OnboardingWizardModal from '../components/OnboardingWizardModal.js';
import FleetLogo from '../components/FleetLogo.js';
import InstallWebAppBanner from '../components/InstallWebAppBanner.js';
import ServerStatusIndicator from '../components/ServerStatusIndicator.js';
import NotificationCenterDrawer from '../components/NotificationCenterDrawer.js';
import InAppChatModal from '../components/InAppChatModal.js';
import InAppCallModal from '../components/InAppCallModal.js';
import ContactDirectoryModal from '../components/ContactDirectoryModal.js';
import CompulsoryPasswordChangeModal from '../components/CompulsoryPasswordChangeModal.js';
import type { FleetContact } from '../store/contacts.store.js';
import { CURRENT_CLIENT_VERSION } from '../services/version.service.js';

const navItems = [
  { icon: LayoutDashboard, label: 'Dashboard', path: '/dashboard' },
  { icon: Navigation, label: 'Driver Console & GPS', path: '/driver-portal' },
  { icon: Users, label: 'Customer Ride Portal', path: '/customer' },
  { icon: Calculator, label: 'Simulator', path: '/simulator' },
  { icon: MapPin, label: 'Trips', path: '/trips' },
  { icon: Car, label: 'Vehicles', path: '/vehicles' },
  { icon: Fuel, label: 'Fuel & Expenses', path: '/expenses' },
  { icon: Wrench, label: 'Maintenance', path: '/maintenance' },
  { icon: TrendingUp, label: 'Finance', path: '/finance' },
  { icon: FileBarChart, label: 'Reports', path: '/reports' },
  { icon: Settings, label: 'Settings', path: '/settings' },
];

// Bottom nav items for mobile (subset)
const bottomNavItems = [
  { icon: LayoutDashboard, label: 'Home', path: '/dashboard' },
  { icon: MapPin, label: 'Trips', path: '/trips' },
  { icon: Car, label: 'Vehicles', path: '/vehicles' },
  { icon: Fuel, label: 'Fuel', path: '/expenses' },
  { icon: Settings, label: 'More', path: '/settings' },
];

interface AppLayoutProps {
  children: React.ReactNode;
}

export default function AppLayout({ children }: AppLayoutProps) {
  const location = useLocation();
  const navigate = useNavigate();
  const { user, businesses, activeBusinessId, setActiveBusiness, logout } = useAuthStore();
  const [sidebarCollapsed, setSidebarCollapsed] = useState(false);
  const [mobileSidebarOpen, setMobileSidebarOpen] = useState(false);
  const [businessPickerOpen, setBusinessPickerOpen] = useState(false);
  const [updateModalOpen, setUpdateModalOpen] = useState(false);
  const [isOnboardingOpen, setIsOnboardingOpen] = useState(false);
  const [isNotificationDrawerOpen, setIsNotificationDrawerOpen] = useState(false);
  const [unreadCount, setUnreadCount] = useState(2);
  const [isChatOpen, setIsChatOpen] = useState(false);
  const [isCallOpen, setIsCallOpen] = useState(false);
  const [isContactDirectoryOpen, setIsContactDirectoryOpen] = useState(false);
  const [selectedCallContact, setSelectedCallContact] = useState<FleetContact | null>(null);
  const [selectedChatContact, setSelectedChatContact] = useState<FleetContact | null>(null);
  const [mustChangePassword, setMustChangePassword] = useState(() => {
    return Boolean(user?.email?.includes('temp') || localStorage.getItem('fleet_must_change_pwd') === 'true');
  });

  const activeBusiness = businesses.find((b) => b.businessId === activeBusinessId);

  // Close mobile sidebar on navigation
  useEffect(() => {
    setMobileSidebarOpen(false);
  }, [location.pathname]);

  const handleLogout = useCallback(async () => {
    await logout();
    navigate('/auth/signin');
  }, [logout, navigate]);

  const SidebarContent = () => (
    <>
      {/* Fleet365 Stylized Brand Logo */}
      <div className={`flex items-center ${sidebarCollapsed ? 'justify-center px-3' : 'px-5'} py-5 border-b border-slate-700/50`}>
        <FleetLogo size={sidebarCollapsed ? 'xs' : 'md'} showText={!sidebarCollapsed} subtitle="Commercial Fleet OS" />
      </div>

      {/* Business switcher */}
      {!sidebarCollapsed && (
        <div className="px-3 py-3 border-b border-slate-700/50">
          <button
            onClick={() => setBusinessPickerOpen((v) => !v)}
            className="w-full flex items-center gap-2 px-3 py-2 rounded-xl bg-slate-800/60 hover:bg-slate-700/60 transition-colors text-left"
            id="business-switcher"
          >
            <Building2 className="w-4 h-4 text-slate-400 flex-shrink-0" />
            <span className="text-sm text-slate-300 truncate flex-1">
              {activeBusiness ? businesses.find((b) => b.businessId === activeBusiness.businessId)?.businessId?.slice(-6) ?? 'My Business' : 'Select Business'}
            </span>
            <ChevronDown className={`w-3.5 h-3.5 text-slate-500 transition-transform ${businessPickerOpen ? 'rotate-180' : ''}`} />
          </button>

          {businessPickerOpen && businesses.length > 1 && (
            <div className="mt-1.5 space-y-1">
              {businesses.map((b) => (
                <button
                  key={b.businessId}
                  onClick={() => { setActiveBusiness(b.businessId); setBusinessPickerOpen(false); }}
                  className={`w-full flex items-center gap-2 px-3 py-2 rounded-xl text-sm transition-colors text-left
                    ${b.businessId === activeBusinessId ? 'bg-brand-500/10 text-brand-400 border border-brand-500/20' : 'text-slate-400 hover:bg-slate-700/50'}`}
                >
                  <div className={`w-2 h-2 rounded-full ${b.businessId === activeBusinessId ? 'bg-brand-400' : 'bg-slate-600'}`} />
                  <span className="truncate">{b.businessId.slice(-8)}</span>
                  <span className="text-xs text-slate-500 ml-auto">{b.role.replace('_', ' ')}</span>
                </button>
              ))}
            </div>
          )}
        </div>
      )}

      {/* Nav items */}
      <nav className="flex-1 overflow-y-auto px-3 py-3 space-y-0.5">
        {navItems.map(({ icon: Icon, label, path }) => {
          const isActive = location.pathname.startsWith(path);
          return (
            <Link
              key={path}
              to={path}
              id={`nav-${label.toLowerCase().replace(/\s+/g, '-')}`}
              className={isActive ? 'nav-item-active' : 'nav-item'}
              title={sidebarCollapsed ? label : undefined}
            >
              <Icon className="w-4.5 h-4.5 flex-shrink-0" />
              {!sidebarCollapsed && <span>{label}</span>}
            </Link>
          );
        })}
      </nav>

      {/* User section */}
      <div className={`border-t border-slate-700/50 p-3 ${sidebarCollapsed ? 'flex justify-center' : ''}`}>
        {!sidebarCollapsed && (
          <div className="flex items-center gap-3 px-3 py-2 mb-1.5 rounded-xl bg-slate-800/40">
            <div className="w-8 h-8 rounded-lg bg-gradient-to-br from-brand-500 to-cyan-500 flex items-center justify-center text-white text-xs font-bold flex-shrink-0">
              {user?.displayName?.[0]?.toUpperCase() ?? 'U'}
            </div>
            <div className="overflow-hidden flex-1 min-w-0">
              <p className="text-sm font-medium text-slate-200 truncate">{user?.displayName}</p>
              <p className="text-xs text-slate-500 truncate">{user?.email}</p>
            </div>
          </div>
        )}
        <button
          onClick={handleLogout}
          className={`nav-item w-full text-danger/70 hover:text-danger hover:bg-danger/10 ${sidebarCollapsed ? 'justify-center' : ''}`}
          title="Sign out"
          id="logout-button"
        >
          <LogOut className="w-4 h-4 flex-shrink-0" />
          {!sidebarCollapsed && <span>Sign out</span>}
        </button>
      </div>
    </>
  );

  return (
    <div className="flex h-screen overflow-hidden bg-slate-950">
      {/* Desktop sidebar */}
      <aside
        className={`hidden lg:flex flex-col bg-slate-900/95 backdrop-blur-md border-r border-slate-700/50 transition-all duration-300 z-40 flex-shrink-0 ${sidebarCollapsed ? 'w-16' : 'w-64'}`}
      >
        <SidebarContent />
        {/* Collapse toggle */}
        <button
          onClick={() => setSidebarCollapsed((v) => !v)}
          className="absolute -right-3 top-20 w-6 h-6 rounded-full bg-slate-800 border border-slate-700 flex items-center justify-center text-slate-400 hover:text-slate-200 hover:bg-slate-700 transition-all z-50 shadow-md"
          aria-label="Toggle sidebar"
          id="sidebar-toggle"
        >
          {sidebarCollapsed ? <ChevronRight className="w-3 h-3" /> : <ChevronLeft className="w-3 h-3" />}
        </button>
      </aside>

      {/* Mobile sidebar overlay */}
      {mobileSidebarOpen && (
        <div className="fixed inset-0 z-50 lg:hidden">
          <div className="absolute inset-0 bg-black/60 backdrop-blur-sm" onClick={() => setMobileSidebarOpen(false)} />
          <aside className="absolute left-0 top-0 h-full w-72 bg-slate-900 border-r border-slate-700/50 flex flex-col animate-slide-in">
            <SidebarContent />
          </aside>
        </div>
      )}

      {/* Main content area */}
      <div className="flex-1 flex flex-col overflow-hidden">
        {/* Top header */}
        <header className="flex items-center justify-between px-4 lg:px-6 border-b border-slate-700/50 bg-slate-900/60 backdrop-blur-sm flex-shrink-0 h-16">
          {/* Mobile menu button */}
          <button
            onClick={() => setMobileSidebarOpen(true)}
            className="lg:hidden btn-ghost -ml-2"
            aria-label="Open menu"
            id="mobile-menu-button"
          >
            <Menu className="w-5 h-5" />
          </button>

          {/* Page title from location */}
          <div className="hidden lg:flex items-center gap-2">
            <h2 className="text-sm font-semibold text-slate-300">
              {navItems.find((n) => location.pathname.startsWith(n.path))?.label ?? 'FleetWise'}
            </h2>
          </div>

          <div className="flex items-center gap-2 ml-auto">
            {/* Live Server Connection Status Indicator */}
            <ServerStatusIndicator />

            {/* In-App Direct Chat & Contact Directory */}
            <button
              onClick={() => setIsContactDirectoryOpen(true)}
              className="p-1.5 rounded-xl bg-slate-800/80 hover:bg-slate-700/80 text-cyan-400 hover:text-cyan-300 border border-slate-700/60 transition-colors"
              title="Open Live Dispatch Chat & Contact Directory"
              id="header-chat-button"
            >
              <MessageSquare className="w-4 h-4" />
            </button>

            {/* In-App Direct Voice Call & Contact Directory */}
            <button
              onClick={() => setIsContactDirectoryOpen(true)}
              className="p-1.5 rounded-xl bg-slate-800/80 hover:bg-slate-700/80 text-emerald-400 hover:text-emerald-300 border border-slate-700/60 transition-colors"
              title="Start In-App VoIP Call (Drivers, Managers, Helpline)"
              id="header-call-button"
            >
              <Phone className="w-4 h-4" />
            </button>

            {/* Quick Fleet Onboard / Registration button */}
            <button
              onClick={() => setIsOnboardingOpen(true)}
              className="hidden sm:flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-gradient-to-r from-brand-600/30 to-cyan-600/30 hover:from-brand-600/40 hover:to-cyan-600/40 text-brand-300 border border-brand-500/30 text-xs font-semibold transition-all shadow-sm"
              title="Fast Onboarding Wizard: Add Fleet, Indian Car, Loan EMI, Mileage, Driver & OTP"
              id="header-onboarding-button"
            >
              <PlusCircle className="w-3.5 h-3.5 text-brand-400" />
              <span>Register Fleet</span>
            </button>

            {/* Version & Updates button */}
            <button
              onClick={() => setUpdateModalOpen(true)}
              className="hidden sm:flex items-center gap-1.5 px-2.5 py-1 rounded-xl bg-brand-500/10 hover:bg-brand-500/20 text-brand-400 border border-brand-500/20 text-xs font-mono font-medium transition-all"
              title="View what's new & check for updates"
              id="version-check-button"
            >
              <Sparkles className="w-3.5 h-3.5 text-brand-400" />
              <span>v{CURRENT_CLIENT_VERSION}</span>
            </button>

            {/* Notifications bell */}
            <button
              onClick={() => setIsNotificationDrawerOpen(true)}
              className="btn-ghost relative p-1.5"
              aria-label="Notifications"
              id="notifications-bell"
              title="View Notifications & Missed Alerts"
            >
              <Bell className="w-5 h-5 text-slate-300 hover:text-white" />
              {unreadCount > 0 && (
                <span className="absolute -top-1 -right-1 min-w-[18px] h-[18px] bg-rose-500 text-white text-[10px] font-bold rounded-full flex items-center justify-center px-1 border-2 border-slate-900 shadow-sm animate-pulse">
                  {unreadCount}
                </span>
              )}
            </button>

            {/* Mobile user avatar */}
            <div className="w-8 h-8 rounded-lg bg-gradient-to-br from-brand-500 to-cyan-500 flex items-center justify-center text-white text-xs font-bold lg:hidden">
              {user?.displayName?.[0]?.toUpperCase() ?? 'U'}
            </div>
          </div>
        </header>

        {/* Scrollable content */}
        <main className="flex-1 overflow-y-auto pb-20 lg:pb-0">
          {children}
        </main>
      </div>

      {/* Mobile bottom navigation */}
      <nav className="fixed bottom-0 left-0 right-0 lg:hidden bg-slate-900/95 backdrop-blur-md border-t border-slate-700/50 z-40 bottom-nav">
        <div className="flex items-center justify-around px-2 py-2">
          {bottomNavItems.map(({ icon: Icon, label, path }) => {
            const isActive = location.pathname.startsWith(path);
            return (
              <Link
                key={path}
                to={path}
                className={`flex flex-col items-center gap-0.5 px-3 py-1.5 rounded-xl transition-all ${
                  isActive ? 'text-brand-400' : 'text-slate-500 hover:text-slate-300'
                }`}
              >
                <Icon className="w-5 h-5" />
                <span className="text-[10px] font-medium">{label}</span>
                {isActive && <div className="w-1 h-1 rounded-full bg-brand-400 mt-0.5" />}
              </Link>
            );
          })}
        </div>
      </nav>

      {/* Missed Notifications Center Drawer */}
      <NotificationCenterDrawer
        isOpen={isNotificationDrawerOpen}
        onClose={() => setIsNotificationDrawerOpen(false)}
        onUnreadCountChange={setUnreadCount}
      />

      {/* Unified Fleet Contact Directory Modal (Drivers, Managers, Helpline, Customers) */}
      <ContactDirectoryModal
        isOpen={isContactDirectoryOpen}
        onClose={() => setIsContactDirectoryOpen(false)}
        onSelectCall={(contact) => {
          setSelectedCallContact(contact);
          setIsCallOpen(true);
        }}
        onSelectChat={(contact) => {
          setSelectedChatContact(contact);
          setIsChatOpen(true);
        }}
      />

      {/* Live In-App Chat Modal */}
      <InAppChatModal
        isOpen={isChatOpen}
        onClose={() => setIsChatOpen(false)}
        contact={selectedChatContact}
        onStartCall={(contact) => {
          setSelectedCallContact(contact);
          setIsCallOpen(true);
        }}
      />

      {/* Live In-App Voice Call Modal */}
      <InAppCallModal
        isOpen={isCallOpen}
        onClose={() => setIsCallOpen(false)}
        callerName={selectedCallContact?.name || 'Fleet Dispatch Control'}
        callerRole={selectedCallContact?.role || 'Operations Control'}
        targetPhone={selectedCallContact?.phone || '+91 98401 23456'}
        vehiclePlate={selectedCallContact?.vehiclePlate}
      />

      {/* Compulsory Password Change Modal for newly assigned staff */}
      <CompulsoryPasswordChangeModal
        isOpen={mustChangePassword}
        onSuccess={() => setMustChangePassword(false)}
      />

      {/* Mini popup toast for new versions / improvements */}
      <VersionUpdateToast onOpenModal={() => setUpdateModalOpen(true)} />

      {/* Detailed What's New & Version Update modal */}
      <VersionUpdateModal
        isOpen={updateModalOpen}
        onClose={() => setUpdateModalOpen(false)}
      />

      {/* 5-Step Fast Fleet Onboarding Wizard */}
      <OnboardingWizardModal
        isOpen={isOnboardingOpen}
        onClose={() => setIsOnboardingOpen(false)}
      />

      {/* Modern PWA Install as Web App banner */}
      <InstallWebAppBanner />
    </div>
  );
}
