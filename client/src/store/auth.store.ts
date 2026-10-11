import { create } from 'zustand';
import { persist } from 'zustand/middleware';
import { setAccessToken, apiPost } from '../services/api.js';
import type { User } from '@fleetwise/shared';

interface BusinessMeta {
  businessId: string;
  role: string;
  permissions: string[];
}

interface AuthState {
  user: User | null;
  businesses: BusinessMeta[];
  activeBusinessId: string | null;
  isAuthenticated: boolean;
  isLoading: boolean;

  setUser: (user: User | null) => void;
  setBusinesses: (businesses: BusinessMeta[]) => void;
  setActiveBusiness: (businessId: string) => void;
  setTokenAndUser: (token: string, user: User, businesses: BusinessMeta[]) => void;
  logout: () => Promise<void>;
  getActiveRole: () => string | null;
  getActivePermissions: () => string[];
  hasPermission: (permission: string) => boolean;
}

export const useAuthStore = create<AuthState>()(
  persist(
    (set, get) => ({
      user: null,
      businesses: [],
      activeBusinessId: null,
      isAuthenticated: false,
      isLoading: false,

      setUser: (user) => set({ user, isAuthenticated: !!user }),

      setBusinesses: (businesses) => {
        set({ businesses });
        // Auto-select first business if none active
        const { activeBusinessId } = get();
        if (!activeBusinessId && businesses.length > 0) {
          const first = businesses[0];
          if (first) {
            set({ activeBusinessId: first.businessId });
            localStorage.setItem('fw_business_id', first.businessId);
          }
        }
      },

      setActiveBusiness: (businessId) => {
        set({ activeBusinessId: businessId });
        localStorage.setItem('fw_business_id', businessId);
      },

      setTokenAndUser: (token, user, businesses) => {
        setAccessToken(token);
        set({ user, isAuthenticated: true, businesses });

        if (businesses.length > 0) {
          const { activeBusinessId } = get();
          if (!activeBusinessId || !businesses.find((b) => b.businessId === activeBusinessId)) {
            const first = businesses[0];
            if (first) {
              set({ activeBusinessId: first.businessId });
              localStorage.setItem('fw_business_id', first.businessId);
            }
          }
        }
      },

      logout: async () => {
        try {
          await apiPost('/auth/signout');
        } catch {
          // Ignore server errors — clear client state regardless
        }
        setAccessToken(null);
        localStorage.removeItem('fw_business_id');
        set({ user: null, businesses: [], activeBusinessId: null, isAuthenticated: false });
      },

      getActiveRole: () => {
        const { businesses, activeBusinessId } = get();
        return businesses.find((b) => b.businessId === activeBusinessId)?.role ?? null;
      },

      getActivePermissions: () => {
        const { businesses, activeBusinessId } = get();
        return businesses.find((b) => b.businessId === activeBusinessId)?.permissions ?? [];
      },

      hasPermission: (permission: string) => {
        const { businesses, activeBusinessId } = get();
        const role = businesses.find((b) => b.businessId === activeBusinessId)?.role;
        if (role === 'business_owner' || role === 'platform_admin') return true;
        const perms = businesses.find((b) => b.businessId === activeBusinessId)?.permissions ?? [];
        return perms.includes(permission);
      },
    }),
    {
      name: 'fw-auth',
      partialize: (state) => ({
        // Only persist non-sensitive state
        activeBusinessId: state.activeBusinessId,
        businesses: state.businesses.map(({ businessId, role }) => ({ businessId, role, permissions: [] })),
      }),
    },
  ),
);
