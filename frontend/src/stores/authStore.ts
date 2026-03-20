import { create } from "zustand";
import { persist, createJSONStorage } from "zustand/middleware";

import type { UserRole, User } from "@/types";

interface ClientProfile {
  id: number;
  clinic_name?: string;
  address?: string;
  discount_percent: number;
  loyalty_tier: string;
  total_orders: number;
}

interface TechnicianProfile {
  id: number;
  specialization?: string;
  experience_years: number;
  rating: number;
  completed_orders: number;
}

interface ExtendedUser extends User {
  client_profile?: ClientProfile;
  technician_profile?: TechnicianProfile;
}

interface AuthState {
  user: ExtendedUser | null;
  accessToken: string | null;
  refreshToken: string | null;
  isAuthenticated: boolean;
  _hasHydrated: boolean;

  // Actions
  login: (tokens: { access_token: string; refresh_token: string }, user: ExtendedUser) => void;
  logout: () => void;
  setTokens: (accessToken: string, refreshToken: string) => void;
  updateUser: (user: Partial<ExtendedUser>) => void;
  clearAuth: () => void;
  setHasHydrated: (hasHydrated: boolean) => void;
}

export const useAuthStore = create<AuthState>()(
  persist(
    (set) => ({
      user: null,
      accessToken: null,
      refreshToken: null,
      isAuthenticated: false,
      _hasHydrated: false,

      login: (tokens, user) => {
        // Сначала очищаем старые данные
        set({
          user: null,
          accessToken: null,
          refreshToken: null,
          isAuthenticated: false,
        });
        // Затем устанавливаем новые
        set({
          user,
          accessToken: tokens.access_token,
          refreshToken: tokens.refresh_token,
          isAuthenticated: true,
        });
        // Очищаем кэш current-user-profile для ProfileSync
        if (typeof window !== 'undefined') {
          window.dispatchEvent(new CustomEvent('auth-login'));
        }
      },

      logout: () => {
        set({
          user: null,
          accessToken: null,
          refreshToken: null,
          isAuthenticated: false,
        });
        // Очищаем localStorage только для auth-storage
        localStorage.removeItem("auth-storage");
      },

      setTokens: (accessToken, refreshToken) => set((state) => ({
        ...state,
        accessToken,
        refreshToken,
      })),

      updateUser: (userData) => set((state) => ({
        ...state,
        user: state.user ? { ...state.user, ...userData } : null,
      })),

      clearAuth: () => set({
        user: null,
        accessToken: null,
        refreshToken: null,
        isAuthenticated: false,
      }),

      setHasHydrated: (hasHydrated) => set({ _hasHydrated: hasHydrated }),
    }),
    {
      name: "auth-storage",
      storage: createJSONStorage(() => localStorage),
      partialize: (state) => ({
        user: state.user,
        accessToken: state.accessToken,
        refreshToken: state.refreshToken,
        isAuthenticated: state.isAuthenticated,
      }),
      onRehydrateStorage: () => (state, error) => {
        if (error || !state) {
          console.error("Ошибка восстановления auth:", error);
          useAuthStore.getState().setHasHydrated(true);
          return;
        }
        state.setHasHydrated(true);
      },
    },
  ),
);

// Экспортируем store для использования без хука (например в router)
export const authStore = useAuthStore;

// Хелперы для проверки авторизации
export const selectIsAuthenticated = (state: AuthState) => state.isAuthenticated;
export const selectUser = (state: AuthState) => state.user;
export const selectUserRole = (state: AuthState) => state.user?.role ?? null;

// Хук для ожидания гидратации
export const useAuthHydration = () => {
  const hasHydrated = useAuthStore((state) => state._hasHydrated);
  return hasHydrated;
};
