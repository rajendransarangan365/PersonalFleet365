import React, { useState, useEffect, useCallback } from 'react';
import { Link, useLocation, useNavigate } from 'react-router-dom';
import {
  LayoutDashboard, Car, MapPin, Fuel, Wrench, TrendingUp,
  FileBarChart, Settings, Calculator, LogOut, Bell, ChevronLeft,
  ChevronRight, Menu, X, Truck, Building2, ChevronDown, Sparkles,
  Navigation, PlusCircle, MessageSquare, Phone, Users, ShieldAlert,
  AlertTriangle, ShieldCheck, Mic
} from 'lucide-react';
import { useAuthStore } from '../store/auth.store.js';
import { getSocket } from '../services/socket.client.js';
import { playMessageChime } from '../utils/audioAlerts.js';
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
import IncomingCallModal from '../components/IncomingCallModal.js';
import LiveDemoPersonaBar from '../components/LiveDemoPersonaBar.js';
import MandatoryPermissionsModal from '../components/MandatoryPermissionsModal.js';
import UserProfileModal from '../components/UserProfileModal.js';
import {
  checkFleetPermissions,
  subscribeToFleetPermissions,
  getCurrentFleetPermissions,
  type FleetPermissionsState,
} from '../services/permissions.service.js';
import type { FleetContact } from '../store/contacts.store.js';
import { CURRENT_CLIENT_VERSION } from '../services/version.service.js';

export function getNavItemsForRole(role: string) {
  if (role === 'driver') {
    return [
      { icon: Navigation, label: 'Driver Console & GPS', path: '/driver-portal' },
      { icon: MessageSquare, label: 'Messages & Dispatch', path: '/messages' },
      { icon: Car, label: 'My Taxi Bookings', path: '/taxi-bookings' },
      { icon: Car, label: 'Assigned Vehicle', path: '/vehicles' },
    ];
  }
  if (role === 'customer') {
    return [
      { icon: Users, label: 'Book Taxi & Ride Portal', path: '/bookings' },
      { icon: MessageSquare, label: 'Messages & Support', path: '/messages' },
      { icon: Car, label: 'My Bookings & Receipts', path: '/taxi-bookings' },
    ];
  }
  if (role === 'telecaller' || role === 'support') {
    return [
      { icon: Car, label: 'Taxi Bookings & Support Desk', path: '/taxi-bookings' },
      { icon: MessageSquare, label: 'Messages & VoIP', path: '/messages' },
      { icon: Navigation, label: 'Driver Duty Roster', path: '/driver-portal' },
      { icon: Users, label: 'Customer Portal', path: '/bookings' },
    ];
  }
  if (role === 'fleet_manager' || role === 'operations_manager') {
    return [
      { icon: LayoutDashboard, label: 'Dashboard', path: '/dashboard' },
      { icon: MessageSquare, label: 'Messages & Dispatch', path: '/messages' },
      { icon: Car, label: 'Taxi Bookings & Dispatch', path: '/taxi-bookings' },
      { icon: Navigation, label: 'Driver Console & GPS', path: '/driver-portal' },
      { icon: MapPin, label: 'Trips', path: '/trips' },
      { icon: Car, label: 'Vehicles', path: '/vehicles' },
      { icon: Fuel, label: 'Fuel & Expenses', path: '/expenses' },
      { icon: Wrench, label: 'Maintenance', path: '/maintenance' },
      { icon: FileBarChart, label: 'Reports', path: '/reports' },
      { icon: Settings, label: 'Settings', path: '/settings' },
    ];
  }
  // Default: Fleet Owner (Full commercial OS suite)
  return [
    { icon: LayoutDashboard, label: 'Dashboard', path: '/dashboard' },
    { icon: MessageSquare, label: 'Messages & VoIP', path: '/messages' },
    { icon: Car, label: 'Taxi Bookings & Dispatch', path: '/taxi-bookings' },
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
}

export function getBottomNavForRole(role: string) {
  if (role === 'driver') {
    return [
      { icon: Navigation, label: 'Console', path: '/driver-portal' },
      { icon: MessageSquare, label: 'Messages', path: '/messages' },
      { icon: Car, label: 'Bookings', path: '/taxi-bookings' },
      { icon: Car, label: 'Vehicle', path: '/vehicles' },
    ];
  }
  if (role === 'customer') {
    return [
      { icon: Users, label: 'Book Ride', path: '/customer' },
      { icon: MessageSquare, label: 'Messages', path: '/messages' },
      { icon: Car, label: 'Bookings', path: '/taxi-bookings' },
    ];
  }
  if (role === 'telecaller' || role === 'support') {
    return [
      { icon: Car, label: 'Bookings', path: '/taxi-bookings' },
      { icon: MessageSquare, label: 'Messages', path: '/messages' },
      { icon: Navigation, label: 'Drivers', path: '/driver-portal' },
      { icon: Users, label: 'Customers', path: '/customer' },
    ];
  }
  return [
    { icon: LayoutDashboard, label: 'Home', path: '/dashboard' },
    { icon: MessageSquare, label: 'Messages', path: '/messages' },
    { icon: Car, label: 'Bookings', path: '/taxi-bookings' },
    { icon: Navigation, label: 'Drivers', path: '/driver-portal' },
    { icon: Settings, label: 'Settings', path: '/settings' },
  ];
}

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
  const [isIncomingAnswered, setIsIncomingAnswered] = useState(false);
  const [isContactDirectoryOpen, setIsContactDirectoryOpen] = useState(false);
  const [selectedCallContact, setSelectedCallContact] = useState<FleetContact | null>(null);
  const [selectedChatContact, setSelectedChatContact] = useState<FleetContact | null>(null);
  const [mustChangePassword, setMustChangePassword] = useState(() => {
    return Boolean(user?.email?.includes('temp') || localStorage.getItem('fleet_must_change_pwd') === 'true');
  });
  const [activeAlertToast, setActiveAlertToast] = useState<{ title: string; message: string; type: 'driver_offline' | 'support' } | null>(null);
  const [unreadMessagesCount, setUnreadMessagesCount] = useState(0);
  const [activeChatMessageToast, setActiveChatMessageToast] = useState<{
    senderId: string;
    senderName: string;
    senderRole?: string;
    text: string;
    messageType?: 'text' | 'voice';
    durationSec?: number;
    timestamp: string;
  } | null>(null);
  const [isPermissionsModalOpen, setIsPermissionsModalOpen] = useState(false);
  const [isProfileModalOpen, setIsProfileModalOpen] = useState(false);
  const [fleetPermissions, setFleetPermissions] = useState<FleetPermissionsState>(() => getCurrentFleetPermissions());

  const activeBusiness = businesses.find((b) => b.businessId === activeBusinessId);

  // Auto-check and prompt device permissions
  useEffect(() => {
    void checkFleetPermissions().then((state) => {
      setFleetPermissions(state);
      const hasAutoPrompted = sessionStorage.getItem('fleet_permissions_auto_prompted');
      if (!hasAutoPrompted && !state.allGranted) {
        sessionStorage.setItem('fleet_permissions_auto_prompted', 'true');
        setIsPermissionsModalOpen(true);
      }
    });

    const unsubscribe = subscribeToFleetPermissions((state) => {
      setFleetPermissions(state);
    });

    return () => unsubscribe();
  }, []);

  // Listen to real-time Driver Offline intimation & Support Escalation events
  useEffect(() => {
    const handleDriverOffline = (e: any) => {
      const detail = e.detail;
      setActiveAlertToast({
        title: detail?.title || '⚠️ Driver Went Offline',
        message: detail?.message || 'Driver marked their duty OFFLINE. Status intimating owner.',
        type: 'driver_offline',
      });
      setUnreadCount((prev) => prev + 1);
    };

    const handleSupportAlert = (e: any) => {
      const detail = e.detail;
      setActiveAlertToast({
        title: detail?.title || '🆘 Support Escalation',
        message: detail?.message || 'Customer reported a ride issue requiring assistance.',
        type: 'support',
      });
      setUnreadCount((prev) => prev + 1);
    };

    window.addEventListener('fleet:driver-offline', handleDriverOffline);
    window.addEventListener('fleet:support-alert', handleSupportAlert);

    return () => {
      window.removeEventListener('fleet:driver-offline', handleDriverOffline);
      window.removeEventListener('fleet:support-alert', handleSupportAlert);
    };
  }, []);

  // Real-time Chat message & Notification listeners
  useEffect(() => {
    const socket = getSocket();

    const handleChatReceive = (msg: any) => {
      const myId = (user as any)?.id || (user as any)?._id || 'owner-01';
      if (msg.senderId === myId) return;

      playMessageChime();
      setUnreadMessagesCount((prev) => prev + 1);

      // Show toast if not actively messaging in MessagesPage or ChatModal with that sender
      setActiveChatMessageToast({
        senderId: msg.senderId,
        senderName: msg.senderName || 'Contact',
        senderRole: msg.senderRole,
        text: msg.text || '',
        messageType: msg.messageType,
        durationSec: msg.durationSec,
        timestamp: msg.timestamp || new Date().toISOString(),
      });

      // Browser native notification if permission granted
      if (typeof window !== 'undefined' && 'Notification' in window && Notification.permission === 'granted') {
        const notifTitle = msg.messageType === 'voice'
          ? `🎤 Voice Note from ${msg.senderName}`
          : `💬 New Message from ${msg.senderName}`;
        const notifBody = msg.messageType === 'voice'
          ? `${msg.senderName} sent a ${msg.durationSec || 0}s voice note`
          : msg.text;

        new Notification(notifTitle, {
          body: notifBody,
          icon: '/favicon.ico',
        });
      }
    };

    const handleNewNotif = () => {
      setUnreadCount((prev) => prev + 1);
    };

    socket.on('chat:receive', handleChatReceive);
    socket.on('notification:new', handleNewNotif);

    return () => {
      socket.off('chat:receive', handleChatReceive);
      socket.off('notification:new', handleNewNotif);
    };
  }, [user]);

  // Auto-dismiss chat toast after 7s
  useEffect(() => {
    if (!activeChatMessageToast) return;
    const timer = setTimeout(() => {
      setActiveChatMessageToast(null);
    }, 7000);
    return () => clearTimeout(timer);
  }, [activeChatMessageToast]);

  // Close mobile sidebar on navigation
  useEffect(() => {
    setMobileSidebarOpen(false);
  }, [location.pathname]);

  const handleLogout = useCallback(async () => {
    await logout();
    navigate('/auth/signin');
  }, [logout, navigate]);

  const userRole =
    (user as any)?.role ||
    businesses.find((b) => b.businessId === activeBusinessId)?.role ||
    businesses[0]?.role ||
    'fleet_owner';

  const roleNavItems = getNavItemsForRole(userRole);
  const roleBottomNavItems = getBottomNavForRole(userRole);

  const SidebarContent = () => (
    <>
      {/* Fleet365 Stylized Brand Logo with Dynamic Role Branding */}
      <div className={`flex items-center ${sidebarCollapsed ? 'justify-center px-3' : 'px-5'} py-5 border-b border-slate-700/50`}>
        <FleetLogo size={sidebarCollapsed ? 'xs' : 'md'} showText={!sidebarCollapsed} role={userRole} />
      </div>

      {/* Role-Specific Profile or Business Switcher */}
      {!sidebarCollapsed && (
        <div className="px-3 py-3 border-b border-slate-700/50">
          {userRole === 'driver' ? (
            <div className="flex items-center gap-2.5 px-3 py-2 rounded-xl bg-slate-800/60 border border-slate-700/40 text-left">
              <div className="w-8 h-8 rounded-lg bg-cyan-500/20 text-cyan-400 flex items-center justify-center font-bold text-sm">
                🚕
              </div>
              <div className="min-w-0 flex-1">
                <p className="text-xs font-bold text-white truncate">{user?.displayName || 'Karthik Raja'}</p>
                <p className="text-[10px] text-cyan-300 font-mono truncate">Duty Driver • TN01BV4589</p>
              </div>
            </div>
          ) : userRole === 'customer' ? (
            <div className="flex items-center gap-2.5 px-3 py-2 rounded-xl bg-slate-800/60 border border-slate-700/40 text-left">
              <div className="w-8 h-8 rounded-lg bg-brand-500/20 text-brand-400 flex items-center justify-center font-bold text-sm">
                👤
              </div>
              <div className="min-w-0 flex-1">
                <p className="text-xs font-bold text-white truncate">{user?.displayName || 'Passenger'}</p>
                <p className="text-[10px] text-slate-400 truncate">Customer Ride Account</p>
              </div>
            </div>
          ) : userRole === 'telecaller' || userRole === 'support' ? (
            <div className="flex items-center gap-2.5 px-3 py-2 rounded-xl bg-slate-800/60 border border-slate-700/40 text-left">
              <div className="w-8 h-8 rounded-lg bg-amber-500/20 text-amber-400 flex items-center justify-center font-bold text-sm">
                🎧
              </div>
              <div className="min-w-0 flex-1">
                <p className="text-xs font-bold text-white truncate">Help Desk Support</p>
                <p className="text-[10px] text-amber-300 truncate">Telecaller & Resolution Desk</p>
              </div>
            </div>
          ) : (
            <>
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
            </>
          )}
        </div>
      )}

      {/* Role-Specific Navigation items */}
      <nav className="flex-1 overflow-y-auto px-3 py-3 space-y-0.5">
        {roleNavItems.map(({ icon: Icon, label, path }) => {
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

      {/* User section with Interactive Profile Trigger */}
      <div className={`border-t border-slate-700/50 p-3 ${sidebarCollapsed ? 'flex flex-col items-center' : ''}`}>
        <button
          onClick={() => setIsProfileModalOpen(true)}
          className={`w-full flex items-center ${sidebarCollapsed ? 'justify-center p-2' : 'gap-3 px-3 py-2'} mb-1.5 rounded-xl bg-slate-800/50 hover:bg-slate-800 text-left transition-all border border-slate-700/40 hover:border-brand-500/40 group cursor-pointer`}
          title={`Profile: ${user?.displayName || 'User'} (${userRole}) - Click to manage account & security`}
          id="sidebar-profile-button"
        >
          <div className="w-8 h-8 rounded-lg bg-gradient-to-br from-brand-500 via-indigo-500 to-cyan-500 flex items-center justify-center text-white text-xs font-bold flex-shrink-0 group-hover:scale-105 transition-transform shadow-md">
            {user?.displayName?.[0]?.toUpperCase() ?? 'U'}
          </div>
          {!sidebarCollapsed && (
            <div className="overflow-hidden flex-1 min-w-0">
              <p className="text-xs font-bold text-slate-200 truncate group-hover:text-white transition-colors">
                {user?.displayName || 'Fleet User'}
              </p>
              <p className="text-[10px] text-slate-400 capitalize truncate font-medium">
                {userRole.replace('_', ' ')} • {user?.email || 'Logged In'}
              </p>
            </div>
          )}
        </button>
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
              {roleNavItems.find((n) => location.pathname.startsWith(n.path))?.label ?? 'FleetWise'}
            </h2>
          </div>

          <div className="flex items-center gap-2 ml-auto">
            {/* Live Server Connection Status Indicator */}
            <ServerStatusIndicator />

            {/* Mandatory Device Hardware Permissions Indicator */}
            <button
              onClick={() => setIsPermissionsModalOpen(true)}
              className={`flex items-center gap-1.5 px-2.5 py-1 rounded-xl text-xs font-semibold border transition-all ${
                fleetPermissions.allGranted
                  ? 'bg-emerald-500/10 text-emerald-400 border-emerald-500/25 hover:bg-emerald-500/20'
                  : 'bg-amber-500/15 text-amber-300 border-amber-500/30 hover:bg-amber-500/25 animate-pulse'
              }`}
              title="Device Hardware Permissions: Microphone (VoIP), GPS Location, Notifications, Camera & Files"
              id="header-permissions-button"
            >
              <ShieldCheck className="w-3.5 h-3.5" />
              <span className="hidden sm:inline font-mono">
                {fleetPermissions.allGranted ? 'Permissions OK' : 'Permissions Setup'}
              </span>
            </button>

            {/* In-App Direct Chat & Messages Center */}
            <button
              onClick={() => {
                setUnreadMessagesCount(0);
                navigate('/messages');
              }}
              className="p-1.5 rounded-xl bg-slate-800/80 hover:bg-slate-700/80 text-cyan-400 hover:text-cyan-300 border border-slate-700/60 transition-colors relative"
              title="Open Live Messages & Dispatch Communications (/messages)"
              id="header-chat-button"
            >
              <MessageSquare className="w-4 h-4" />
              {unreadMessagesCount > 0 && (
                <span className="absolute -top-1 -right-1 w-4 h-4 rounded-full bg-cyan-500 text-slate-950 font-bold text-[10px] flex items-center justify-center animate-pulse shadow-sm">
                  {unreadMessagesCount}
                </span>
              )}
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

            {/* Staff & Employee Directory Button (Owner & Manager Only) */}
            {(userRole === 'fleet_owner' || userRole === 'fleet_manager') && (
              <button
                onClick={() => setIsContactDirectoryOpen(true)}
                className="hidden md:flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-purple-500/15 hover:bg-purple-500/25 text-purple-300 border border-purple-500/30 text-xs font-semibold transition-all shadow-sm"
                title="Manage Staff: Drivers, Managers, Telecallers & Add Employees"
                id="header-staff-button"
              >
                <Users className="w-3.5 h-3.5 text-purple-400" />
                <span>Staff & Drivers</span>
              </button>
            )}

            {/* Quick Fleet Onboard / Registration button (Owner & Manager Only) */}
            {(userRole === 'fleet_owner' || userRole === 'fleet_manager') && (
              <button
                onClick={() => setIsOnboardingOpen(true)}
                className="hidden sm:flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-gradient-to-r from-brand-600/30 to-cyan-600/30 hover:from-brand-600/40 hover:to-cyan-600/40 text-brand-300 border border-brand-500/30 text-xs font-semibold transition-all shadow-sm"
                title="Fast Onboarding Wizard: Add Fleet, Indian Car, Loan EMI, Mileage, Driver & OTP"
                id="header-onboarding-button"
              >
                <PlusCircle className="w-3.5 h-3.5 text-brand-400" />
                <span>Register Fleet</span>
              </button>
            )}

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

            {/* User profile avatar trigger button */}
            <button
              onClick={() => setIsProfileModalOpen(true)}
              className="w-8 h-8 rounded-lg bg-gradient-to-br from-brand-500 via-indigo-500 to-cyan-500 flex items-center justify-center text-white text-xs font-bold shadow-md hover:scale-105 transition-transform"
              title={`View ${user?.displayName || 'User'} Profile (${userRole})`}
              id="header-profile-avatar-button"
            >
              {user?.displayName?.[0]?.toUpperCase() ?? 'U'}
            </button>
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
          {roleBottomNavItems.map(({ icon: Icon, label, path }) => {
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
      {/* Unified Fleet Contact Directory Modal (Drivers, Managers, Helpline, Customers) */}
      <ContactDirectoryModal
        isOpen={isContactDirectoryOpen}
        onClose={() => setIsContactDirectoryOpen(false)}
        onSelectCall={(contact) => {
          setSelectedCallContact(contact);
          setIsIncomingAnswered(false);
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
          setIsIncomingAnswered(false);
          setIsCallOpen(true);
        }}
      />

      {/* Live In-App Voice Call Modal */}
      <InAppCallModal
        isOpen={isCallOpen}
        onClose={() => {
          setIsCallOpen(false);
          setIsIncomingAnswered(false);
        }}
        targetContact={selectedCallContact}
        callerName={selectedCallContact?.name || 'Fleet Dispatch Control'}
        callerRole={selectedCallContact?.role || 'Operations Control'}
        targetPhone={selectedCallContact?.phone || '+91 98401 23456'}
        vehiclePlate={selectedCallContact?.vehiclePlate}
        isIncomingAnswered={isIncomingAnswered}
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

      {/* Mandatory Device Hardware Permissions Modal */}
      <MandatoryPermissionsModal
        isOpen={isPermissionsModalOpen}
        onClose={() => setIsPermissionsModalOpen(false)}
      />

      {/* Interactive User Profile & Security Modal */}
      <UserProfileModal
        isOpen={isProfileModalOpen}
        onClose={() => setIsProfileModalOpen(false)}
        onOpenPasswordChange={() => setMustChangePassword(true)}
      />

      {/* Real Incoming VoIP Call Screen (Accept & Decline with Ringtone) */}
      <IncomingCallModal
        onAccept={(session) => {
          setSelectedCallContact({
            id: session.callerId,
            name: session.callerName,
            role: session.callerRole as any,
            phone: session.callerPhone,
            vehiclePlate: session.vehiclePlate,
            status: 'online',
          });
          setIsIncomingAnswered(true);
          setIsCallOpen(true);
        }}
      />

      {/* Floating Demo Persona Testing Suite (1-Click Switch & Ring Phone) */}
      <LiveDemoPersonaBar />

      {/* Real-Time Duty & Support Alert Toast */}
      {activeAlertToast && (
        <div className="fixed top-20 right-4 z-50 max-w-sm w-full animate-fade-in">
          <div className={`p-4 rounded-2xl shadow-2xl border backdrop-blur-md flex items-start justify-between gap-3 ${
            activeAlertToast.type === 'driver_offline'
              ? 'bg-amber-950/95 border-amber-500/50 text-amber-200 shadow-amber-950/40'
              : 'bg-rose-950/95 border-rose-500/50 text-rose-200 shadow-rose-950/40'
          }`}>
            <div className="flex items-start gap-3">
              {activeAlertToast.type === 'driver_offline' ? (
                <ShieldAlert className="w-5 h-5 text-amber-400 mt-0.5 flex-shrink-0" />
              ) : (
                <AlertTriangle className="w-5 h-5 text-rose-400 mt-0.5 flex-shrink-0" />
              )}
              <div>
                <h4 className="font-bold text-white text-xs">{activeAlertToast.title}</h4>
                <p className="text-[11px] text-slate-300 mt-0.5 leading-relaxed">{activeAlertToast.message}</p>
                {activeAlertToast.type === 'driver_offline' && (
                  <button
                    onClick={() => {
                      setActiveAlertToast(null);
                      navigate('/taxi-bookings');
                    }}
                    className="mt-2 px-2.5 py-1 bg-amber-500/20 hover:bg-amber-500/30 text-amber-300 text-[10px] font-bold rounded-lg border border-amber-500/30 transition-colors"
                  >
                    View Driver & Bookings
                  </button>
                )}
                {activeAlertToast.type === 'support' && (
                  <button
                    onClick={() => {
                      setActiveAlertToast(null);
                      navigate('/taxi-bookings');
                    }}
                    className="mt-2 px-2.5 py-1 bg-rose-500/20 hover:bg-rose-500/30 text-rose-300 text-[10px] font-bold rounded-lg border border-rose-500/30 transition-colors"
                  >
                    Open Dispatch & Resolve
                  </button>
                )}
              </div>
            </div>

            <button
              onClick={() => setActiveAlertToast(null)}
              className="text-slate-400 hover:text-white p-1 rounded-lg"
            >
              <X className="w-4 h-4" />
            </button>
          </div>
        </div>
      )}

      {/* Real-Time Incoming Chat / Voice Note Notification Toast */}
      {activeChatMessageToast && (
        <div className="fixed top-20 right-4 sm:right-6 z-60 max-w-sm w-full bg-slate-900/95 border border-cyan-500/40 rounded-2xl shadow-2xl p-3.5 backdrop-blur-md animate-slide-in">
          <div className="flex items-start justify-between gap-3">
            <div className="flex items-start gap-2.5 min-w-0">
              <div className="w-9 h-9 rounded-xl bg-gradient-to-tr from-cyan-600 to-brand-500 flex items-center justify-center text-white font-bold text-xs shadow flex-shrink-0 mt-0.5">
                {activeChatMessageToast.senderName[0]?.toUpperCase() ?? 'F'}
              </div>
              <div className="min-w-0">
                <div className="flex items-center gap-1.5">
                  <span className="text-[10px] uppercase font-bold tracking-wider text-cyan-400">
                    New Message
                  </span>
                  <span className="text-slate-500">•</span>
                  <span className="text-[10px] text-slate-400">Just now</span>
                </div>
                <h4 className="font-bold text-white text-xs truncate">
                  {activeChatMessageToast.senderName}
                </h4>
                <p className="text-xs text-slate-300 mt-0.5 line-clamp-2">
                  {activeChatMessageToast.messageType === 'voice' ? (
                    <span className="text-emerald-400 flex items-center gap-1 font-medium">
                      <Mic className="w-3.5 h-3.5" /> Voice note ({activeChatMessageToast.durationSec || 0}s)
                    </span>
                  ) : (
                    activeChatMessageToast.text
                  )}
                </p>
                <div className="mt-2.5 flex items-center gap-2">
                  <button
                    onClick={() => {
                      setActiveChatMessageToast(null);
                      setUnreadMessagesCount(0);
                      navigate('/messages');
                    }}
                    className="px-2.5 py-1 rounded-lg bg-cyan-600 hover:bg-cyan-500 text-white text-[11px] font-bold transition-all shadow-sm flex items-center gap-1"
                  >
                    <MessageSquare className="w-3 h-3" />
                    <span>Open Messages</span>
                  </button>
                  <button
                    onClick={() => setActiveChatMessageToast(null)}
                    className="px-2 py-1 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-400 hover:text-white text-[11px] transition-colors"
                  >
                    Dismiss
                  </button>
                </div>
              </div>
            </div>

            <button
              onClick={() => setActiveChatMessageToast(null)}
              className="text-slate-400 hover:text-white p-1 rounded-lg flex-shrink-0"
            >
              <X className="w-4 h-4" />
            </button>
          </div>
        </div>
      )}

      {/* Modern PWA Install as Web App banner */}
      <InstallWebAppBanner />
    </div>
  );
}
