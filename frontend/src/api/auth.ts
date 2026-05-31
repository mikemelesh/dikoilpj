import axios from "axios";
import { apiClient } from "./axios";
import { authStore } from "@/stores/authStore";
import type { AuthTokens, LoginCredentials, RegisterData } from "@/types";

// Use the same base URL as apiClient but without relying on the interceptors
const BASE_URL = import.meta.env.VITE_API_URL ?? "http://localhost:8000/api";

// =============================================================================
// Типы профилей
// =============================================================================

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

// =============================================================================
// Типы ответов
// =============================================================================

interface AuthResponse {
  access_token: string;
  refresh_token: string;
  token_type?: string;
  user?: ExtendedUser;
  client_profile?: ClientProfile;
  technician_profile?: TechnicianProfile;
}

interface MeResponse {
  user: ExtendedUser;
  client_profile?: ClientProfile;
  technician_profile?: TechnicianProfile;
}

// =============================================================================
// API функции
// =============================================================================

/**
 * Вход в систему
 */
export const login = async (credentials: LoginCredentials): Promise<AuthResponse> => {
  // FastAPI OAuth2PasswordRequestForm корректно парсит только application/x-www-form-urlencoded.
  const body = new URLSearchParams();
  body.append("username", credentials.email);
  body.append("password", credentials.password);

  // Use raw axios with the same base URL as apiClient but without interceptors
  const response = await axios.post<AuthResponse>(`${BASE_URL}/auth/login`, body, {
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
  });

  return response.data;
};

/**
 * Регистрация нового пользователя
 */
export const register = async (data: RegisterData): Promise<AuthResponse> => {
  // Use raw axios with the same base URL as apiClient but without interceptors
  const response = await axios.post<AuthResponse>(`${BASE_URL}/auth/register`, data, {
    headers: { "Content-Type": "application/json" },
  });
  return response.data;
};

/**
 * Обновление токена
 */
export const refreshToken = async (refreshToken: string): Promise<{ access_token: string; refresh_token: string }> => {
  const response = await axios.post<{ access_token: string; refresh_token: string }>(`${BASE_URL}/auth/refresh`, {
    refresh_token: refreshToken,
  });
  return response.data;
};

/**
 * Выход из системы
 */
export const logout = async (): Promise<void> => {
  // Get current tokens from the store to make the logout request
  const state = authStore.getState();
  if (state.accessToken) {
    await axios.post(`${BASE_URL}/auth/logout`, {}, {
      headers: { "Authorization": `Bearer ${state.accessToken}` }
    });
  }
  // Clear the auth store regardless
  authStore.getState().logout();
};

/**
 * Получение текущего пользователя
 */
export const getMe = async (): Promise<MeResponse> => {
  const response = await apiClient.get<MeResponse>("/auth/me");
  return response.data;
};

/**
 * Получение пользователя по ID (для админа)
 */
export const getUsers = async (params?: GetUsersParams): Promise<GetUsersResponse> => {
  const queryParams = new URLSearchParams();
  
  if (params?.role) queryParams.append("role", params.role);
  if (params?.is_active !== undefined) queryParams.append("is_active", String(params.is_active));
  if (params?.page) queryParams.append("page", String(params.page));
  if (params?.limit) queryParams.append("limit", String(params.limit));

  const response = await apiClient.get<GetUsersResponse>(`/users?${queryParams.toString()}`);
  return response.data;
};

/**
 * Получение пользователя по ID (для админа)
 */
export const getUserById = async (userId: string): Promise<User> => {
  const response = await apiClient.get<User>(`/admin/users/${userId}`);
  return response.data;
};
