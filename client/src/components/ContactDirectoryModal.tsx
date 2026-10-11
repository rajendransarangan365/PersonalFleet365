import React, { useState } from 'react';
import {
  Users, Phone, MessageSquare, Search, Plus, Trash2, Edit3,
  Car, Shield, Headphones, UserCheck, Check, AlertCircle, X,
  KeyRound, Radio, Navigation, Star, PhoneCall
} from 'lucide-react';
import { useContactsStore, type FleetContact } from '../store/contacts.store.js';

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
  const { contacts, addContact, updateContact, deleteContact } = useContactsStore();
  const [activeTab, setActiveTab] = useState<'all' | 'driver' | 'manager' | 'telecaller' | 'customer'>('all');
  const [searchQuery, setSearchQuery] = useState('');

  // Add/Edit modal state
  const [isAddModalOpen, setIsAddModalOpen] = useState(false);
  const [editingContact, setEditingContact] = useState<FleetContact | null>(null);

  // Form fields
  const [formName, setFormName] = useState('');
  const [formRole, setFormRole] = useState<'driver' | 'manager' | 'telecaller'>('driver');
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
      (c.email && c.email.toLowerCase().includes(query));
    return matchesTab && matchesQuery;
  });

  const openAddModal = (edit?: FleetContact) => {
    if (edit) {
      setEditingContact(edit);
      setFormName(edit.name);
      setFormRole(edit.role as any);
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
      setFormTempPassword(`TempPass@${Math.floor(1000 + Math.random() * 9000)}`);
    }
    setIsAddModalOpen(true);
  };

  const handleSaveContact = (e: React.FormEvent) => {
    e.preventDefault();
    if (!formName.trim() || !formPhone.trim()) return;

    if (editingContact) {
      updateContact(editingContact.id, {
        name: formName.trim(),
        role: formRole,
        phone: formPhone.trim(),
        email: formEmail.trim() || undefined,
        vehiclePlate: formRole === 'driver' ? formVehiclePlate.trim() : undefined,
        vehicleModel: formRole === 'driver' ? formVehicleModel.trim() : undefined,
      });
    } else {
      addContact({
        name: formName.trim(),
        role: formRole,
        phone: formPhone.trim(),
        email: formEmail.trim() || undefined,
        vehiclePlate: formRole === 'driver' ? formVehiclePlate.trim() : undefined,
        vehicleModel: formRole === 'driver' ? formVehicleModel.trim() : undefined,
        status: 'available',
        speedKmH: 0,
        tempPassword: formTempPassword,
        mustChangePassword: true,
      });
    }
    setIsAddModalOpen(false);
  };

  const getRoleBadge = (role: FleetContact['role']) => {
    switch (role) {
      case 'driver':
        return <span className="px-2 py-0.5 rounded-full text-[10px] font-semibold bg-emerald-500/20 text-emerald-400 border border-emerald-500/30">Driver</span>;
      case 'manager':
        return <span className="px-2 py-0.5 rounded-full text-[10px] font-semibold bg-purple-500/20 text-purple-400 border border-purple-500/30">Manager</span>;
      case 'telecaller':
        return <span className="px-2 py-0.5 rounded-full text-[10px] font-semibold bg-cyan-500/20 text-cyan-400 border border-cyan-500/30">Helpline / Support</span>;
      case 'customer':
        return <span className="px-2 py-0.5 rounded-full text-[10px] font-semibold bg-amber-500/20 text-amber-400 border border-amber-500/30">Customer Ride</span>;
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
                <span className="text-xs px-2 py-0.5 rounded-full bg-slate-800 text-slate-400 font-normal">
                  {contacts.length} Contacts
                </span>
              </h2>
              <p className="text-xs text-slate-400">
                In-app VoIP calling, real-time dispatch chat, & role assignments
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

        {/* Toolbar: Search + Category Tabs + Add button */}
        <div className="px-5 py-3 border-b border-slate-800 bg-slate-950/40 space-y-3">
          <div className="flex items-center gap-2">
            <div className="relative flex-1">
              <Search className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
              <input
                type="text"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                placeholder="Search drivers, vehicles (TN01...), managers, customers..."
                className="w-full pl-9 pr-3 py-2 bg-slate-800/80 border border-slate-700 rounded-xl text-xs sm:text-sm text-white placeholder-slate-500 focus:outline-none focus:border-brand-500"
              />
            </div>
            <button
              onClick={() => openAddModal()}
              className="flex items-center gap-1.5 px-3 py-2 bg-brand-600 hover:bg-brand-500 text-white rounded-xl text-xs font-semibold shadow-md transition-all flex-shrink-0"
              title="Add Driver, Manager, or Telecaller with Temporary Password"
            >
              <Plus className="w-4 h-4" />
              <span className="hidden sm:inline">Add Member</span>
            </button>
          </div>

          {/* Category Tabs */}
          <div className="flex items-center gap-1.5 overflow-x-auto pb-1 text-xs">
            {[
              { id: 'all', label: 'All Contacts', count: contacts.length },
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
            <div className="text-center py-12 text-slate-500 text-sm">
              <Users className="w-10 h-10 mx-auto mb-2 opacity-40 text-slate-400" />
              <p>No contacts found matching your query.</p>
            </div>
          ) : (
            filteredContacts.map((contact) => (
              <div
                key={contact.id}
                className="pt-2.5 first:pt-0 flex flex-col sm:flex-row sm:items-center justify-between gap-3 p-3 rounded-2xl hover:bg-slate-800/40 transition-colors border border-transparent hover:border-slate-800"
              >
                {/* Contact Left: Avatar & Info */}
                <div className="flex items-start gap-3 min-w-0">
                  <div className="relative flex-shrink-0">
                    <div className="w-11 h-11 rounded-2xl bg-gradient-to-tr from-slate-800 to-slate-700 border border-slate-700 flex items-center justify-center text-white font-bold text-base shadow-sm">
                      {contact.name[0]?.toUpperCase()}
                    </div>
                    {/* Live Online Badge */}
                    <span
                      className={`absolute -bottom-0.5 -right-0.5 w-3.5 h-3.5 rounded-full border-2 border-slate-900 ${
                        contact.status === 'on_trip'
                          ? 'bg-cyan-400 animate-pulse'
                          : contact.status === 'online' || contact.status === 'available'
                          ? 'bg-emerald-400'
                          : 'bg-slate-500'
                      }`}
                      title={`Status: ${contact.status}`}
                    />
                  </div>

                  <div className="min-w-0 flex-1 space-y-0.5">
                    <div className="flex items-center gap-2 flex-wrap">
                      <span className="font-semibold text-white text-sm sm:text-base truncate">
                        {contact.name}
                      </span>
                      {getRoleBadge(contact.role)}
                      {contact.status === 'on_trip' && (
                        <span className="px-1.5 py-0.5 rounded text-[10px] font-mono bg-cyan-500/10 text-cyan-400 border border-cyan-500/20">
                          {contact.speedKmH ? `${contact.speedKmH} km/h` : 'On Trip'}
                        </span>
                      )}
                    </div>

                    {/* Driver details */}
                    {contact.vehiclePlate && (
                      <p className="text-xs text-slate-400 flex items-center gap-1.5">
                        <Car className="w-3.5 h-3.5 text-brand-400 flex-shrink-0" />
                        <span className="font-mono text-brand-300 font-semibold">{contact.vehiclePlate}</span>
                        <span>•</span>
                        <span className="truncate">{contact.vehicleModel}</span>
                      </p>
                    )}

                    {/* Customer Active Trip */}
                    {contact.activeTrip && (
                      <p className="text-[11px] text-amber-400/90 flex items-center gap-1 truncate">
                        <Navigation className="w-3 h-3 text-amber-400 flex-shrink-0" />
                        <span>{contact.activeTrip.pickup} ➔ {contact.activeTrip.dropoff}</span>
                        <span className="font-mono font-bold text-white">OTP: {contact.activeTrip.otp}</span>
                      </p>
                    )}

                    <div className="flex items-center gap-2 text-xs text-slate-400 font-mono">
                      <span>{contact.phone}</span>
                      {contact.tempPassword && (
                        <span className="text-[10px] text-amber-400 bg-amber-500/10 px-1.5 py-0.5 rounded font-sans">
                          Temp: {contact.tempPassword}
                        </span>
                      )}
                    </div>
                  </div>
                </div>

                {/* Contact Right: Action Buttons */}
                <div className="flex items-center gap-2 self-end sm:self-center flex-shrink-0">
                  {/* VoIP In-App Call Button */}
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

                  {/* Cellular Direct Call */}
                  <a
                    href={`tel:${contact.phone}`}
                    className="p-2 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-300 hover:text-white border border-slate-700 transition-colors"
                    title={`Dial phone number (${contact.phone}) via cellular`}
                  >
                    <PhoneCall className="w-3.5 h-3.5 text-cyan-400" />
                  </a>

                  {/* Realtime Chat Button */}
                  <button
                    onClick={() => {
                      onSelectChat(contact);
                      onClose();
                    }}
                    className="p-2 rounded-xl bg-slate-800 hover:bg-slate-700 text-cyan-400 hover:text-cyan-300 border border-slate-700 transition-colors"
                    title={`Send instant dispatch message to ${contact.name}`}
                  >
                    <MessageSquare className="w-3.5 h-3.5" />
                  </button>

                  {/* Owner/Manager Edit & Delete Controls */}
                  {contact.role !== 'customer' && (
                    <>
                      <button
                        onClick={() => openAddModal(contact)}
                        className="p-2 rounded-xl text-slate-400 hover:text-white hover:bg-slate-800 transition-colors"
                        title="Edit Contact"
                      >
                        <Edit3 className="w-3.5 h-3.5" />
                      </button>
                      <button
                        onClick={() => {
                          if (confirm(`Are you sure you want to remove ${contact.name}?`)) {
                            deleteContact(contact.id);
                          }
                        }}
                        className="p-2 rounded-xl text-slate-400 hover:text-rose-400 hover:bg-rose-500/10 transition-colors"
                        title="Delete Member"
                      >
                        <Trash2 className="w-3.5 h-3.5" />
                      </button>
                    </>
                  )}
                </div>
              </div>
            ))
          )}
        </div>

        {/* Footer info */}
        <div className="px-5 py-3 border-t border-slate-800 bg-slate-950/80 text-xs text-slate-400 flex items-center justify-between">
          <div className="flex items-center gap-1.5 text-brand-400">
            <Radio className="w-3.5 h-3.5 animate-pulse" />
            <span>Real-time VoIP & Dispatch Network Active</span>
          </div>
          <span className="font-mono text-[11px] text-slate-500">256-bit AES</span>
        </div>
      </div>

      {/* Add / Edit Member Modal */}
      {isAddModalOpen && (
        <div className="fixed inset-0 z-60 flex items-center justify-center p-4 bg-black/80 backdrop-blur-md animate-fade-in">
          <div className="bg-slate-900 border border-slate-700 rounded-2xl max-w-md w-full p-6 shadow-2xl space-y-4">
            <div className="flex items-center justify-between border-b border-slate-800 pb-3">
              <h3 className="text-base font-bold text-white flex items-center gap-2">
                <UserCheck className="w-5 h-5 text-brand-400" />
                {editingContact ? 'Edit Fleet Member' : 'Add New Member / Assign Role'}
              </h3>
              <button onClick={() => setIsAddModalOpen(false)} className="text-slate-400 hover:text-white">
                <X className="w-5 h-5" />
              </button>
            </div>

            <form onSubmit={handleSaveContact} className="space-y-3.5 text-xs sm:text-sm">
              <div>
                <label className="block text-xs font-semibold text-slate-300 mb-1">Full Name</label>
                <input
                  type="text"
                  required
                  value={formName}
                  onChange={(e) => setFormName(e.target.value)}
                  placeholder="e.g. Vignesh R."
                  className="w-full px-3 py-2 bg-slate-800 border border-slate-700 rounded-xl text-white placeholder-slate-500 focus:outline-none focus:border-brand-500"
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-semibold text-slate-300 mb-1">Role</label>
                  <select
                    value={formRole}
                    onChange={(e) => setFormRole(e.target.value as any)}
                    className="w-full px-3 py-2 bg-slate-800 border border-slate-700 rounded-xl text-white focus:outline-none focus:border-brand-500"
                  >
                    <option value="driver">Driver</option>
                    <option value="manager">Fleet Manager</option>
                    <option value="telecaller">Telecaller / Support</option>
                  </select>
                </div>
                <div>
                  <label className="block text-xs font-semibold text-slate-300 mb-1">Phone Number</label>
                  <input
                    type="tel"
                    required
                    value={formPhone}
                    onChange={(e) => setFormPhone(e.target.value)}
                    placeholder="+91 98400 00000"
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
                  placeholder="vignesh@fleetwise.in"
                  className="w-full px-3 py-2 bg-slate-800 border border-slate-700 rounded-xl text-white placeholder-slate-500 focus:outline-none focus:border-brand-500"
                />
              </div>

              {formRole === 'driver' && (
                <div className="grid grid-cols-2 gap-3 bg-slate-800/40 p-3 rounded-xl border border-slate-800">
                  <div>
                    <label className="block text-[11px] font-semibold text-slate-400 mb-1">Assigned Vehicle</label>
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

              {/* Temporary Password & Security Badge */}
              <div className="bg-amber-500/10 border border-amber-500/30 p-3 rounded-xl space-y-1">
                <div className="flex items-center gap-1.5 text-amber-400 text-xs font-semibold">
                  <KeyRound className="w-3.5 h-3.5" />
                  <span>Temporary First-Time Login Password</span>
                </div>
                <input
                  type="text"
                  value={formTempPassword}
                  onChange={(e) => setFormTempPassword(e.target.value)}
                  className="w-full px-2.5 py-1.5 bg-slate-900/90 border border-amber-500/40 rounded-lg text-amber-300 font-mono text-xs focus:outline-none"
                />
                <p className="text-[11px] text-amber-400/80">
                  Compulsory password change will be enforced immediately on their first login.
                </p>
              </div>

              <div className="flex items-center justify-end gap-2 pt-2">
                <button
                  type="button"
                  onClick={() => setIsAddModalOpen(false)}
                  className="px-4 py-2 bg-slate-800 hover:bg-slate-700 text-slate-300 rounded-xl text-xs font-semibold"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="px-4 py-2 bg-brand-600 hover:bg-brand-500 text-white rounded-xl text-xs font-semibold shadow-md"
                >
                  {editingContact ? 'Save Changes' : 'Create & Assign'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
