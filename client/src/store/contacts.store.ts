import { create } from 'zustand';
import { persist } from 'zustand/middleware';

export interface FleetContact {
  id: string;
  name: string;
  role: 'driver' | 'manager' | 'telecaller' | 'customer';
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

const INITIAL_CONTACTS: FleetContact[] = [
  // ── Drivers ──
  {
    id: 'drv-01',
    name: 'Karthik Raja',
    role: 'driver',
    phone: '+91 98401 23456',
    email: 'karthik.driver@fleetwise.in',
    vehiclePlate: 'TN01BV4589',
    vehicleModel: 'Maruti Suzuki Tour S (CNG)',
    status: 'on_trip',
    speedKmH: 52,
    rating: 4.9,
    activeTrip: {
      tripId: 'TRIP-8841',
      pickup: 'Chennai Airport T1',
      dropoff: 'OMR IT Park, Sholinganallur',
      fare: 680,
      otp: '4591',
    },
  },
  {
    id: 'drv-02',
    name: 'Suresh Kumar',
    role: 'driver',
    phone: '+91 98402 34567',
    email: 'suresh.driver@fleetwise.in',
    vehiclePlate: 'TN09CE2311',
    vehicleModel: 'Hyundai Aura CNG',
    status: 'on_trip',
    speedKmH: 46,
    rating: 4.8,
    activeTrip: {
      tripId: 'TRIP-8842',
      pickup: 'Central Railway Station',
      dropoff: 'Guindy Industrial Estate',
      fare: 420,
      otp: '7823',
    },
  },
  {
    id: 'drv-03',
    name: 'Vijay Anand',
    role: 'driver',
    phone: '+91 98403 45678',
    email: 'vijay.driver@fleetwise.in',
    vehiclePlate: 'TN02DF7812',
    vehicleModel: 'Tata Tigor EV (Green)',
    status: 'available',
    speedKmH: 0,
    rating: 4.95,
  },
  {
    id: 'drv-04',
    name: 'Ramesh Babu',
    role: 'driver',
    phone: '+91 98404 56789',
    email: 'ramesh.driver@fleetwise.in',
    vehiclePlate: 'TN10AK9944',
    vehicleModel: 'Toyota Innova Crysta (7-Seater)',
    status: 'available',
    speedKmH: 0,
    rating: 4.7,
  },

  // ── Managers ──
  {
    id: 'mgr-01',
    name: 'Kishore M.',
    role: 'manager',
    phone: '+91 98410 11223',
    email: 'manager@fleetwise.in',
    status: 'online',
    rating: 5.0,
  },
  {
    id: 'mgr-02',
    name: 'Priya S.',
    role: 'manager',
    phone: '+91 98410 44556',
    email: 'priya.ops@fleetwise.in',
    status: 'online',
    rating: 4.9,
  },

  // ── Telecaller & Helpline Support ──
  {
    id: 'tel-01',
    name: 'Fleet 365 24x7 Helpline Desk',
    role: 'telecaller',
    phone: '+91 1800 365 000',
    email: 'helpline@fleetwise.in',
    status: 'online',
    rating: 5.0,
  },
  {
    id: 'tel-02',
    name: 'Rajesh (Booking & Dispute Telecaller)',
    role: 'telecaller',
    phone: '+91 98410 99887',
    email: 'rajesh.support@fleetwise.in',
    status: 'online',
    rating: 4.8,
  },

  // ── Active Fleet Booked Customers ──
  {
    id: 'cust-01',
    name: 'Ananya Sharma',
    role: 'customer',
    phone: '+91 99620 12345',
    email: 'ananya.s@gmail.com',
    status: 'on_trip',
    activeTrip: {
      tripId: 'TRIP-8841',
      pickup: 'Chennai Airport T1',
      dropoff: 'OMR IT Park, Sholinganallur',
      fare: 680,
      otp: '4591',
    },
  },
  {
    id: 'cust-02',
    name: 'Arvind Swaminathan',
    role: 'customer',
    phone: '+91 98840 98765',
    email: 'arvind.swami@outlook.com',
    status: 'on_trip',
    activeTrip: {
      tripId: 'TRIP-8842',
      pickup: 'Central Railway Station',
      dropoff: 'Guindy Industrial Estate',
      fare: 420,
      otp: '7823',
    },
  },
];

interface ContactsState {
  contacts: FleetContact[];
  addContact: (contact: Omit<FleetContact, 'id'>) => FleetContact;
  updateContact: (id: string, updates: Partial<FleetContact>) => void;
  deleteContact: (id: string) => void;
  getDrivers: () => FleetContact[];
  getManagers: () => FleetContact[];
  getTelecallers: () => FleetContact[];
  getCustomers: () => FleetContact[];
  resetToDefaults: () => void;
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
        set((state) => ({
          contacts: state.contacts.filter((c) => c.id !== id),
        }));
      },

      getDrivers: () => get().contacts.filter((c) => c.role === 'driver'),
      getManagers: () => get().contacts.filter((c) => c.role === 'manager'),
      getTelecallers: () => get().contacts.filter((c) => c.role === 'telecaller'),
      getCustomers: () => get().contacts.filter((c) => c.role === 'customer'),

      resetToDefaults: () => set({ contacts: INITIAL_CONTACTS }),
    }),
    {
      name: 'fleet365_contacts_store',
    },
  ),
);
