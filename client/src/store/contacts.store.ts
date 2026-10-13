import { create } from 'zustand';
import { persist } from 'zustand/middleware';

export interface FleetContact {
  id: string;
  name: string;
  role: 'owner' | 'manager' | 'driver' | 'telecaller' | 'customer';
  phone: string;
  email?: string;
  vehiclePlate?: string;
  vehicleModel?: string;
  status: 'online' | 'offline' | 'on_trip' | 'available' | 'busy';
  speedKmH?: number;
  rating?: number;
  tempPassword?: string;
  mustChangePassword?: boolean;
  avatar?: string;
  activeTrip?: {
    tripId: string;
    pickup: string;
    dropoff: string;
    fare: number;
    otp: string;
  };
}

export const COMPANY_OWNER_CONTACT: FleetContact = {
  id: 'owner-01',
  name: 'Sarangan (Company Owner)',
  role: 'owner',
  phone: '+91 9629991655',
  email: 'sarangan365@gmail.com',
  status: 'online',
  tempPassword: 'FleetPass@2026',
  mustChangePassword: false,
  rating: 5.0,
};

const LEGACY_MOCK_IDS = new Set([
  'drv-01', 'drv-02', 'drv-03', 'drv-04',
  'mgr-01', 'mgr-02',
  'tel-01', 'tel-02',
  'cust-01', 'cust-02'
]);

const INITIAL_CONTACTS: FleetContact[] = [
  COMPANY_OWNER_CONTACT,
];

// Clean up legacy localStorage key from older versions
if (typeof window !== 'undefined') {
  try {
    const legacy = localStorage.getItem('fleet365_contacts_store');
    if (legacy) {
      localStorage.removeItem('fleet365_contacts_store');
    }
  } catch {
    // Ignore storage errors
  }
}

interface ContactsState {
  contacts: FleetContact[];
  addContact: (contact: Omit<FleetContact, 'id'>) => FleetContact;
  updateContact: (id: string, updates: Partial<FleetContact>) => void;
  deleteContact: (id: string) => void;
  getOwner: () => FleetContact | undefined;
  getDrivers: () => FleetContact[];
  getManagers: () => FleetContact[];
  getTelecallers: () => FleetContact[];
  getCustomers: () => FleetContact[];
  resetToDefaults: () => void;
  resetToOwnerOnly: () => void;
}

export const useContactsStore = create<ContactsState>()(
  persist(
    (set, get) => ({
      contacts: INITIAL_CONTACTS,

      addContact: (contactData) => {
        const id = `${contactData.role.slice(0, 3)}-${Date.now()}`;
        const newContact: FleetContact = {
          id,
          ...contactData,
        };
        set((state) => ({ contacts: [newContact, ...state.contacts] }));
        return newContact;
      },

      updateContact: (id, updates) => {
        set((state) => ({
          contacts: state.contacts.map((c) => (c.id === id ? { ...c, ...updates } : c)),
        }));
      },

      deleteContact: (id) => {
        // Prevent accidental deletion of the company owner
        set((state) => ({
          contacts: state.contacts.filter((c) => c.id !== id || c.role === 'owner'),
        }));
      },

      getOwner: () => get().contacts.find((c) => c.role === 'owner' || c.id === 'owner-01'),
      getDrivers: () => get().contacts.filter((c) => c.role === 'driver'),
      getManagers: () => get().contacts.filter((c) => c.role === 'manager'),
      getTelecallers: () => get().contacts.filter((c) => c.role === 'telecaller'),
      getCustomers: () => get().contacts.filter((c) => c.role === 'customer'),

      resetToDefaults: () => set({ contacts: [COMPANY_OWNER_CONTACT] }),
      resetToOwnerOnly: () => set({ contacts: [COMPANY_OWNER_CONTACT] }),
    }),
    {
      name: 'fleet365_contacts_store_v2',
      version: 2,
      migrate: (persistedState: any) => {
        const raw: FleetContact[] = (persistedState as any)?.contacts || [];
        // Purge mock dummy contacts
        const nonMock = raw.filter((c) => !LEGACY_MOCK_IDS.has(c.id));
        const filtered = nonMock.filter(
          (c) =>
            !c.email?.includes('driver@fleetwise.in') &&
            !c.email?.includes('ops@fleetwise.in') &&
            !c.email?.includes('helpline@fleetwise.in') &&
            !c.email?.includes('ananya') &&
            !c.email?.includes('arvind') &&
            c.id !== 'mgr-01'
        );

        const hasOwner = filtered.some((c) => c.role === 'owner' || c.email === 'sarangan365@gmail.com');
        const finalContacts = hasOwner
          ? filtered.map((c) =>
              c.email === 'sarangan365@gmail.com' || c.id === 'owner-01'
                ? { ...COMPANY_OWNER_CONTACT, ...c, role: 'owner' as const }
                : c
            )
          : [COMPANY_OWNER_CONTACT, ...filtered];

        return {
          ...(persistedState as any),
          contacts: finalContacts,
        };
      },
    },
  ),
);
