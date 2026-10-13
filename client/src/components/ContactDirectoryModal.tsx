import React, { useState, useEffect } from 'react';
import {
  Users, Phone, MessageSquare, Search, Plus, Trash2, Edit3,
  Car, Shield, Headphones, UserCheck, Check, AlertCircle, X,
  KeyRound, Radio, Navigation, Star, PhoneCall, Crown, Copy, RefreshCw,
  CreditCard
} from 'lucide-react';
import { useContactsStore, type FleetContact, COMPANY_OWNER_CONTACT } from '../store/contacts.store.js';
import { useAuthStore } from '../store/auth.store.js';
import { apiPost, apiDelete } from '../services/api.js';
import { subscribeToOnlineUsers, type OnlineUserPresence } from '../services/socket.client.js';
import DigitalIdCardModal from './DigitalIdCardModal.js';

interface Props {
  isOpen: boolean;
  onClose: () => void;
  onSelectCall: (contact: FleetContact) => void;
  onSelectChat: (contact: FleetContact) => void;
  currentRole?: string;
}

export default function ContactDirectoryModal({
  isOpen,
  onClose,
  onSelectCall,
  onSelectChat,
  currentRole = 'fleet_owner',
}: Props) {
  const { user } = useAuthStore();
  const myUserId = (user as any)?.id || (user as any)?._id;
  const { contacts, addContact, updateContact, deleteContact, resetToOwnerOnly } = useContactsStore();
  const [activeTab, setActiveTab] = useState<'all' | 'owner' | 'driver' | 'manager' | 'telecaller' | 'customer'>('all');
  const [searchQuery, setSearchQuery] = useState('');
  const [onlineUsers, setOnlineUsers] = useState<OnlineUserPresence[]>([]);
  const [copiedId, setCopiedId] = useState<string | null>(null);
  const [selectedIdCardRole, setSelectedIdCardRole] = useState<'driver' | 'manager' | 'owner' | 'telecaller' | null>(null);

  useEffect(() => {
    if (!isOpen) return;
    const unsubscribe = subscribeToOnlineUsers((users) => {
      setOnlineUsers(users);
    });
    return () => unsubscribe();
  }, [isOpen]);

  // Add/Edit modal state
  const [isAddModalOpen, setIsAddModalOpen] = useState(false);
  const [editingContact, setEditingContact] = useState<FleetContact | null>(null);
  const [isSaving, setIsSaving] = useState(false);
  const [statusMessage, setStatusMessage] = useState<string | null>(null);

  // Form fields
  const [formName, setFormName] = useState('');
  const [formRole, setFormRole] = useState<'owner' | 'driver' | 'manager' | 'telecaller' | 'customer'>('driver');
  const [formPhone, setFormPhone] = useState('');
  const [formEmail, setFormEmail] = useState('');
  const [formVehiclePlate, setFormVehiclePlate] = useState('TN01BV4589');
  const [formVehicleModel, setFormVehicleModel] = useState('Maruti Suzuki Tour S (CNG)');
  const [formTempPassword, setFormTempPassword] = useState('FleetPass@2026');

  if (!isOpen) return null;

  const filteredContacts = contacts.filter((c) => {
    const matchesTab = activeTab === 'all' || c.role === activeTab;
    const query = searchQuery.toLowerCase().trim();
    if (!query) return matchesTab;
    const matchesQuery =
      c.name.toLowerCase().includes(query) ||
      c.phone.toLowerCase().includes(query) ||
      (c.vehiclePlate && c.vehiclePlate.toLowerCase().includes(query)) ||
      (c.email && c.email.toLowerCase().includes(query)) ||
      (c.tempPassword && c.tempPassword.toLowerCase().includes(query));
    return matchesTab && matchesQuery;
  });

  const openAddModal = (edit?: FleetContact) => {
    setStatusMessage(null);
    if (edit) {
      setEditingContact(edit);
      setFormName(edit.name);
      setFormRole(edit.role);
      setFormPhone(edit.phone);
      setFormEmail(edit.email || '');
      setFormVehiclePlate(edit.vehiclePlate || 'TN01BV4589');
      setFormVehicleModel(edit.vehicleModel || 'Maruti Suzuki Tour S');
      setFormTempPassword(edit.tempPassword || 'FleetPass@2026');
    } else {
      setEditingContact(null);
      setFormName('');
      setFormRole('driver');
      setFormPhone('+91 ');
      setFormEmail('');
      setFormVehiclePlate('TN01BV4589');
      setFormVehicleModel('Maruti Suzuki Tour S (CNG)');
      setFormTempPassword(`FleetPass@${Math.floor(1000 + Math.random() * 9000)}`);
    }
    setIsAddModalOpen(true);
  };

  const handleCopyPassword = (contactId: string, pwd: string) => {
    if (navigator?.clipboard) {
      navigator.clipboard.writeText(pwd);
      setCopiedId(contactId);
      setTimeout(() => setCopiedId(null), 1800);
    }
  };

  const handleSaveContact = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!formName.trim() || !formPhone.trim()) return;

    setIsSaving(true);
    setStatusMessage(null);

    const emailToUse = formEmail.trim() || `${formName.toLowerCase().replace(/[^a-z0-9]/g, '')}@fleetwise.in`;
    const finalPassword = formTempPassword.trim() || 'FleetPass@2026';
    const roleForBackend = formRole === 'owner' ? 'fleet_owner' : formRole === 'manager' ? 'fleet_manager' : formRole;

    try {
      // Persist to backend server and sync with MongoDB
      await apiPost('/app/staff', {
        userId: editingContact?.id,
        oldEmail: editingContact?.email,
        name: formName.trim(),
        role: roleForBackend,
        phone: formPhone.trim(),
        email: emailToUse,
        password: finalPassword,
        vehiclePlate: formRole === 'driver' ? formVehiclePlate.trim() : undefined,
        vehicleModel: formRole === 'driver' ? formVehicleModel.trim() : undefined,
      });
    } catch (err) {
      console.warn('Backend staff sync noticed (locally updating):', err);
    }

    if (editingContact) {
      updateContact(editingContact.id, {
        name: formName.trim(),
        role: formRole,
        phone: formPhone.trim(),
        email: emailToUse,
        tempPassword: finalPassword,
        mustChangePassword: formRole !== 'owner',
        vehiclePlate: formRole === 'driver' ? formVehiclePlate.trim() : undefined,
        vehicleModel: formRole === 'driver' ? formVehicleModel.trim() : undefined,
      });
    } else {
      addContact({
        name: formName.trim(),
        role: formRole,
        phone: formPhone.trim(),
        email: emailToUse,
        tempPassword: finalPassword,
        mustChangePassword: formRole !== 'owner',
        vehiclePlate: formRole === 'driver' ? formVehiclePlate.trim() : undefined,
        vehicleModel: formRole === 'driver' ? formVehicleModel.trim() : undefined,
        status: 'available',
        speedKmH: 0,
      });
    }

    setIsSaving(false);
    setStatusMessage('Password and details saved successfully!');
    setTimeout(() => {
      setIsAddModalOpen(false);
      setStatusMessage(null);
    }, 450);
  };

  const handleDelete = (contact: FleetContact) => {
    if (contact.role === 'owner' || contact.id === 'owner-01') {
      alert('The Company Owner account cannot be removed.');
      return;
    }

    if (confirm(`Are you sure you want to remove ${contact.name}?`)) {
      deleteContact(contact.id);
      apiDelete(`/app/staff/${contact.id}`).catch(() => {
        apiDelete(`/app/staff/${encodeURIComponent(contact.email || '')}`).catch(() => {});
      });
    }
  };

  const getRoleBadge = (role: FleetContact['role']) => {
    switch (role) {
      case 'owner':
        return (
          <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-amber-500/20 text-amber-300 border border-amber-500/40 flex items-center gap-1 shadow-sm">
            <Crown className="w-3 h-3 text-amber-400" />
            Company Owner
          </span>
        );
      case 'driver':
        return (
          <span className="px-2 py-0.5 rounded-full text-[10px] font-semibold bg-emerald-500/20 text-emerald-400 border border-emerald-500/30">
            Driver
          </span>
        );
      case 'manager':
        return (
          <span className="px-2 py-0.5 rounded-full text-[10px] font-semibold bg-purple-500/20 text-purple-400 border border-purple-500/30">
            Operations Manager
          </span>
        );
      case 'telecaller':
        return (
          <span className="px-2 py-0.5 rounded-full text-[10px] font-semibold bg-cyan-500/20 text-cyan-400 border border-cyan-500/30">
            Helpline / Support
          </span>
        );
      case 'customer':
        return (
          <span className="px-2 py-0.5 rounded-full text-[10px] font-semibold bg-amber-500/20 text-amber-400 border border-amber-500/30">
            Customer Ride
          </span>
        );
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-4 bg-black/80 backdrop-blur-md animate-fade-in">
      <div className="bg-slate-900 border border-slate-700/80 rounded-2xl sm:rounded-3xl max-w-2xl w-full max-h-[90vh] flex flex-col shadow-2xl overflow-hidden">
        {/* Header */}
        <div className="flex items-center justify-between px-5 py-4 border-b border-slate-800 bg-slate-900/90">
          <div className="flex items-center gap-2.5">
            <div className="p-2 rounded-xl bg-gradient-to-tr from-brand-600 to-cyan-500 text-white shadow-md">
              <Users className="w-5 h-5" />
            </div>
            <div>
              <h2 className="text-base sm:text-lg font-bold text-white flex items-center gap-2">
                Fleet 365 Contact Directory
                <span className="text-xs px-2 py-0.5 rounded-full bg-slate-800 text-slate-300 font-normal">
                  {contacts.length} {contacts.length === 1 ? 'Member' : 'Members'}
                </span>
              </h2>
              <p className="text-xs text-slate-400">
                Company Owner controls, in-app VoIP calling, role assignments & password security
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-2 rounded-xl text-slate-400 hover:text-white hover:bg-slate-800 transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Toolbar: Search + Category Tabs + Add + Reset button */}
        <div className="px-5 py-3 border-b border-slate-800 bg-slate-950/40 space-y-3">
          <div className="flex items-center gap-2">
            <div className="relative flex-1">
              <Search className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
              <input
                type="text"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                placeholder="Search by name, phone, vehicle plate (TN01...), or email..."
                className="w-full pl-9 pr-3 py-2 bg-slate-800/80 border border-slate-700 rounded-xl text-xs sm:text-sm text-white placeholder-slate-500 focus:outline-none focus:border-brand-500"
              />
            </div>

            <button
              onClick={() => {
                if (confirm('Reset contact directory to keep only the Company Owner? All legacy mock data will be wiped.')) {
                  resetToOwnerOnly();
                }
              }}
              className="p-2 sm:px-3 sm:py-2 bg-slate-800/90 hover:bg-slate-700/80 text-slate-400 hover:text-white rounded-xl text-xs font-medium border border-slate-700 flex items-center gap-1.5 transition-all flex-shrink-0"
              title="Remove mock demo staff and keep only the Company Owner"
            >
              <RefreshCw className="w-3.5 h-3.5 text-amber-400" />
              <span className="hidden md:inline">Reset to Owner</span>
            </button>

            <button
              onClick={() => openAddModal()}
              className="flex items-center gap-1.5 px-3 py-2 bg-brand-600 hover:bg-brand-500 text-white rounded-xl text-xs font-semibold shadow-md transition-all flex-shrink-0"
              title="Add Driver, Manager, Helpline, or Customer with Temporary Password"
            >
              <Plus className="w-4 h-4" />
              <span>Add Member</span>
            </button>
          </div>

          {/* Category Tabs */}
          <div className="flex items-center gap-1.5 overflow-x-auto pb-1 text-xs">
            {[
              { id: 'all', label: 'All Contacts', count: contacts.length },
              { id: 'owner', label: 'Company Owner', count: contacts.filter((c) => c.role === 'owner').length },
              { id: 'driver', label: 'Drivers', count: contacts.filter((c) => c.role === 'driver').length },
              { id: 'manager', label: 'Managers', count: contacts.filter((c) => c.role === 'manager').length },
              { id: 'telecaller', label: 'Helpline & Support', count: contacts.filter((c) => c.role === 'telecaller').length },
              { id: 'customer', label: 'Customers', count: contacts.filter((c) => c.role === 'customer').length },
            ].map((tab) => (
              <button
                key={tab.id}
                onClick={() => setActiveTab(tab.id as any)}
                className={`px-3 py-1.5 rounded-lg whitespace-nowrap transition-all font-medium flex items-center gap-1.5 ${
                  activeTab === tab.id
                    ? 'bg-brand-500 text-white shadow-sm'
                    : 'bg-slate-800/60 text-slate-400 hover:text-slate-200 hover:bg-slate-800'
                }`}
              >
                <span>{tab.label}</span>
                <span className={`text-[10px] px-1.5 py-0.2 rounded-full ${activeTab === tab.id ? 'bg-white/20 text-white' : 'bg-slate-700 text-slate-300'}`}>
                  {tab.count}
                </span>
              </button>
            ))}
          </div>
        </div>

        {/* Contacts List */}
        <div className="flex-1 overflow-y-auto p-4 space-y-2.5 divide-y divide-slate-800/50">
          {filteredContacts.length === 0 ? (
            <div className="text-center py-12 text-slate-500 text-sm space-y-2">
              <Users className="w-10 h-10 mx-auto opacity-40 text-slate-400" />
              <p>No members found matching your filter.</p>
              <button
                onClick={() => openAddModal()}
                className="inline-flex items-center gap-1 px-3 py-1.5 bg-brand-600 hover:bg-brand-500 text-white rounded-lg text-xs font-semibold"
              >
                <Plus className="w-3.5 h-3.5" />
                <span>Create New Member Now</span>
              </button>
            </div>
          ) : (
            filteredContacts.map((contact) => {
              const isContactOnline = onlineUsers.some((u) => u.userId === contact.id);
              const isSelf = contact.id === myUserId || Boolean(user?.email && contact.email === user.email);
              const isOwner = contact.role === 'owner';

              return (
                <div
                  key={contact.id}
                  className={`pt-2.5 first:pt-0 flex flex-col sm:flex-row sm:items-center justify-between gap-3 p-3.5 rounded-2xl transition-all border ${
                    isOwner
                      ? 'bg-amber-500/5 border-amber-500/30 hover:border-amber-500/50'
                      : 'hover:bg-slate-800/40 border-transparent hover:border-slate-800'
                  }`}
                >
                  {/* Contact Left: Avatar & Info */}
                  <div className="flex items-start gap-3 min-w-0">
                    <div className="relative flex-shrink-0">
                      <div className={`w-11 h-11 rounded-2xl flex items-center justify-center font-bold text-base shadow-sm border ${
                        isOwner
                          ? 'bg-gradient-to-tr from-amber-600 to-yellow-500 text-white border-amber-400'
                          : 'bg-gradient-to-tr from-slate-800 to-slate-700 border-slate-700 text-white'
                      }`}>
                        {contact.name[0]?.toUpperCase()}
                      </div>
                      {/* Live Online Badge */}
                      <span
                        className={`absolute -bottom-0.5 -right-0.5 w-3.5 h-3.5 rounded-full border-2 border-slate-900 ${
                          isContactOnline
                            ? 'bg-emerald-400 animate-pulse'
                            : 'bg-slate-500'
                        }`}
                        title={isContactOnline ? 'Online on Server' : 'Offline'}
                      />
                    </div>

                    <div className="min-w-0 flex-1 space-y-1">
                      <div className="flex items-center gap-2 flex-wrap">
                        <span className="font-semibold text-white text-sm sm:text-base truncate">
                          {contact.name}
                        </span>
                        {getRoleBadge(contact.role)}
                        {isSelf && (
                          <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-cyan-500/20 text-cyan-400 border border-cyan-500/30">
                            You (Logged In)
                          </span>
                        )}
                        <span className={`text-[10px] px-1.5 py-0.5 rounded-full font-mono font-medium ${
                          isContactOnline
                            ? 'bg-emerald-500/20 text-emerald-400 border border-emerald-500/30'
                            : 'bg-slate-800 text-slate-500 border border-slate-700/60'
                        }`}>
                          {isContactOnline ? 'Online' : 'Offline'}
                        </span>
                        {contact.status === 'on_trip' && (
                          <span className="px-1.5 py-0.5 rounded text-[10px] font-mono bg-cyan-500/10 text-cyan-400 border border-cyan-500/20">
                            {contact.speedKmH ? `${contact.speedKmH} km/h` : 'On Trip'}
                          </span>
                        )}
                      </div>

                      {/* Driver vehicle details */}
                      {contact.vehiclePlate && (
                        <p className="text-xs text-slate-400 flex items-center gap-1.5">
                          <Car className="w-3.5 h-3.5 text-brand-400 flex-shrink-0" />
                          <span className="font-mono text-brand-300 font-semibold">{contact.vehiclePlate}</span>
                          <span>•</span>
                          <span className="truncate">{contact.vehicleModel}</span>
                        </p>
                      )}

                      {/* Active Trip Info */}
                      {contact.activeTrip && (
                        <p className="text-[11px] text-amber-400/90 flex items-center gap-1 truncate">
                          <Navigation className="w-3 h-3 text-amber-400 flex-shrink-0" />
                          <span>{contact.activeTrip.pickup} ➔ {contact.activeTrip.dropoff}</span>
                          <span className="font-mono font-bold text-white">OTP: {contact.activeTrip.otp}</span>
                        </p>
                      )}

                      <div className="flex items-center gap-2 flex-wrap text-xs text-slate-400 font-mono">
                        <span>{contact.phone}</span>
                        {contact.email && (
                          <span className="text-slate-500 font-sans truncate">({contact.email})</span>
                        )}

                        {/* Explicit Password Badge with 1-click Copy */}
                        {contact.tempPassword && (
                          <div className="flex items-center gap-1 bg-amber-500/15 border border-amber-500/30 text-amber-300 px-2 py-0.5 rounded-md font-mono text-[11px]">
                            <KeyRound className="w-3 h-3 text-amber-400" />
                            <span>Password: <b className="text-white select-all">{contact.tempPassword}</b></span>
                            <button
                              type="button"
                              onClick={() => handleCopyPassword(contact.id, contact.tempPassword!)}
                              className="ml-1 text-amber-400 hover:text-white transition-colors"
                              title="Copy password to clipboard"
                            >
                              {copiedId === contact.id ? (
                                <Check className="w-3 h-3 text-emerald-400" />
                              ) : (
                                <Copy className="w-3 h-3" />
                              )}
                            </button>
                          </div>
                        )}
                      </div>
                    </div>
                  </div>

                  {/* Contact Right: Actions */}
                  <div className="flex items-center gap-2 self-end sm:self-center flex-shrink-0">
                    {/* VoIP Calling */}
                    {!isSelf && (
                      <>
                        <button
                          onClick={() => {
                            onSelectCall(contact);
                            onClose();
                          }}
                          className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-emerald-600 hover:bg-emerald-500 text-white text-xs font-semibold shadow-md shadow-emerald-600/20 transition-all active:scale-95"
                          title={`Start VoIP In-App HD Call with ${contact.name}`}
                        >
                          <Phone className="w-3.5 h-3.5" />
                          <span>In-App Call</span>
                        </button>

                        <a
                          href={`tel:${contact.phone}`}
                          className="p-2 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-300 hover:text-white border border-slate-700 transition-colors"
                          title={`Dial phone number (${contact.phone})`}
                        >
                          <PhoneCall className="w-3.5 h-3.5 text-cyan-400" />
                        </a>

                        <button
                          onClick={() => {
                            onSelectChat(contact);
                            onClose();
                          }}
                          className="p-2 rounded-xl bg-slate-800 hover:bg-slate-700 text-cyan-400 hover:text-cyan-300 border border-slate-700 transition-colors"
                          title={`Dispatch message to ${contact.name}`}
                        >
                          <MessageSquare className="w-3.5 h-3.5" />
                        </button>
                      </>
                    )}

                    {/* View Digital Smart ID Card & DL */}
                    <button
                      onClick={() => {
                        const r = contact.role === 'owner' ? 'owner' : contact.role === 'manager' ? 'manager' : contact.role === 'driver' ? 'driver' : 'telecaller';
                        setSelectedIdCardRole(r);
                      }}
                      className="p-2 rounded-xl text-amber-400 hover:text-amber-300 hover:bg-amber-500/10 border border-slate-700/60 transition-colors"
                      title={`View Official Digital Smart ID Card for ${contact.name}`}
                    >
                      <CreditCard className="w-3.5 h-3.5" />
                    </button>

                    {/* Edit Contact & Password */}
                    <button
                      onClick={() => openAddModal(contact)}
                      className="p-2 rounded-xl text-slate-400 hover:text-white hover:bg-slate-800 border border-slate-700/60 transition-colors"
                      title="Edit Member and Change Password"
                    >
                      <Edit3 className="w-3.5 h-3.5" />
                    </button>

                    {/* Delete Member (Owner is protected) */}
                    {!isOwner && (
                      <button
                        onClick={() => handleDelete(contact)}
                        className="p-2 rounded-xl text-slate-400 hover:text-rose-400 hover:bg-rose-500/10 border border-slate-700/60 transition-colors"
                        title="Delete Member"
                      >
                        <Trash2 className="w-3.5 h-3.5" />
                      </button>
                    )}
                  </div>
                </div>
              );
            })
          )}
        </div>

        {/* Footer info */}
        <div className="px-5 py-3 border-t border-slate-800 bg-slate-950/80 text-xs text-slate-400 flex items-center justify-between">
          <div className="flex items-center gap-1.5 text-amber-400">
            <Radio className="w-3.5 h-3.5 animate-pulse" />
            <span>Company Owner Fleet Command Active</span>
          </div>
          <span className="font-mono text-[11px] text-slate-500">Argon2id Hashed & AES-256</span>
        </div>
      </div>

      {/* Add / Edit Member Modal */}
      {isAddModalOpen && (
        <div className="fixed inset-0 z-60 flex items-center justify-center p-4 bg-black/85 backdrop-blur-md animate-fade-in">
          <div className="bg-slate-900 border border-slate-700 rounded-3xl max-w-md w-full p-6 shadow-2xl space-y-4">
            <div className="flex items-center justify-between border-b border-slate-800 pb-3">
              <h3 className="text-base font-bold text-white flex items-center gap-2">
                <UserCheck className="w-5 h-5 text-brand-400" />
                {editingContact ? 'Edit Fleet Member & Password' : 'Add New Member to Company'}
              </h3>
              <button onClick={() => setIsAddModalOpen(false)} className="text-slate-400 hover:text-white">
                <X className="w-5 h-5" />
              </button>
            </div>

            {statusMessage && (
              <div className="p-3 bg-emerald-500/15 border border-emerald-500/30 rounded-xl text-emerald-300 text-xs flex items-center gap-2">
                <Check className="w-4 h-4 text-emerald-400 flex-shrink-0" />
                <span>{statusMessage}</span>
              </div>
            )}

            <form onSubmit={handleSaveContact} className="space-y-3.5 text-xs sm:text-sm">
              <div>
                <label className="block text-xs font-semibold text-slate-300 mb-1">Full Name</label>
                <input
                  type="text"
                  required
                  value={formName}
                  onChange={(e) => setFormName(e.target.value)}
                  placeholder="e.g. Sarangan"
                  className="w-full px-3 py-2 bg-slate-800 border border-slate-700 rounded-xl text-white placeholder-slate-500 focus:outline-none focus:border-brand-500"
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-semibold text-slate-300 mb-1">Company Role</label>
                  <select
                    value={formRole}
                    onChange={(e) => setFormRole(e.target.value as any)}
                    className="w-full px-3 py-2 bg-slate-800 border border-slate-700 rounded-xl text-white focus:outline-none focus:border-brand-500"
                  >
                    <option value="owner">👑 Company Owner</option>
                    <option value="manager">💼 Fleet Manager</option>
                    <option value="driver">🚕 Duty Driver</option>
                    <option value="telecaller">🎧 Helpline & Support</option>
                    <option value="customer">👤 Customer Ride</option>
                  </select>
                </div>
                <div>
                  <label className="block text-xs font-semibold text-slate-300 mb-1">Phone Number</label>
                  <input
                    type="tel"
                    required
                    value={formPhone}
                    onChange={(e) => setFormPhone(e.target.value)}
                    placeholder="+91 9629991655"
                    className="w-full px-3 py-2 bg-slate-800 border border-slate-700 rounded-xl text-white placeholder-slate-500 focus:outline-none focus:border-brand-500 font-mono"
                  />
                </div>
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-300 mb-1">Email Address</label>
                <input
                  type="email"
                  value={formEmail}
                  onChange={(e) => setFormEmail(e.target.value)}
                  placeholder="sarangan365@gmail.com"
                  className="w-full px-3 py-2 bg-slate-800 border border-slate-700 rounded-xl text-white placeholder-slate-500 focus:outline-none focus:border-brand-500"
                />
              </div>

              {formRole === 'driver' && (
                <div className="grid grid-cols-2 gap-3 bg-slate-800/40 p-3 rounded-xl border border-slate-800">
                  <div>
                    <label className="block text-[11px] font-semibold text-slate-400 mb-1">Assigned Vehicle Plate</label>
                    <input
                      type="text"
                      value={formVehiclePlate}
                      onChange={(e) => setFormVehiclePlate(e.target.value)}
                      placeholder="TN01BV4589"
                      className="w-full px-2.5 py-1.5 bg-slate-900 border border-slate-700 rounded-lg text-white font-mono uppercase text-xs focus:outline-none focus:border-brand-500"
                    />
                  </div>
                  <div>
                    <label className="block text-[11px] font-semibold text-slate-400 mb-1">Vehicle Model</label>
                    <input
                      type="text"
                      value={formVehicleModel}
                      onChange={(e) => setFormVehicleModel(e.target.value)}
                      placeholder="Maruti Dzire Tour S"
                      className="w-full px-2.5 py-1.5 bg-slate-900 border border-slate-700 rounded-lg text-white text-xs focus:outline-none focus:border-brand-500"
                    />
                  </div>
                </div>
              )}

              {/* Password Setting & Updating Field */}
              <div className="bg-amber-500/10 border border-amber-500/30 p-3.5 rounded-2xl space-y-2">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-1.5 text-amber-400 text-xs font-semibold">
                    <KeyRound className="w-3.5 h-3.5" />
                    <span>{formRole === 'owner' ? 'Company Owner Login Password' : 'Temporary Login Password'}</span>
                  </div>
                  <span className="text-[10px] text-amber-300 font-mono">Argon2id Encrypted</span>
                </div>
                <input
                  type="text"
                  required
                  value={formTempPassword}
                  onChange={(e) => setFormTempPassword(e.target.value)}
                  placeholder="Enter login password"
                  className="w-full px-3 py-2 bg-slate-900/90 border border-amber-500/50 rounded-xl text-amber-300 font-mono text-xs sm:text-sm focus:outline-none focus:border-amber-400 shadow-inner"
                />
                <p className="text-[11px] text-amber-300/80 leading-relaxed">
                  {formRole === 'owner'
                    ? 'This password directly updates the owner login credentials in the system database.'
                    : 'The member will use this password to sign in. Compulsory password update will apply on first sign in.'}
                </p>
              </div>

              <div className="flex items-center justify-end gap-2 pt-2">
                <button
                  type="button"
                  disabled={isSaving}
                  onClick={() => setIsAddModalOpen(false)}
                  className="px-4 py-2 bg-slate-800 hover:bg-slate-700 text-slate-300 rounded-xl text-xs font-semibold"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={isSaving}
                  className="px-5 py-2 bg-gradient-to-r from-amber-500 to-brand-600 hover:from-amber-400 hover:to-brand-500 text-white rounded-xl text-xs font-semibold shadow-md flex items-center gap-1.5"
                >
                  {isSaving ? (
                    <span>Saving Credentials...</span>
                  ) : (
                    <span>{editingContact ? 'Save Changes & Password' : 'Create & Assign Member'}</span>
                  )}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Official Digital Smart ID Card Modal */}
      {selectedIdCardRole && (
        <DigitalIdCardModal
          isOpen={Boolean(selectedIdCardRole)}
          onClose={() => setSelectedIdCardRole(null)}
          initialRole={selectedIdCardRole}
        />
      )}
    </div>
  );
}
