import { authStore } from "@/stores/authStore";

export const useAuth = () => {
  const state = authStore();
  const isAuthenticated = Boolean(state.user);
  return { ...state, isAuthenticated };
};

