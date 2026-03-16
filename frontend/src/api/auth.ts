import { apiClient } from "./axios";
import type { User, AuthTokens, LoginCredentials, RegisterData } from "@/types";

// =============================================================================
// Типы ответов
// =============================================================================

interface AuthResponse {
  access_token: string;
  refresh_token: string;
  token_type: string;
  user?: User;
}

interface MeResponse {
  user: User;
  client_profile?: {
    id: number;
    clinic_name?: string;
    discount_percent: number;
    loyalty_tier: string;
    total_orders: number;
  };
  technician_profile?: {
    id: number;
    specialization?: string;
    experience_years: number;
    rating: number;
    completed_orders: number;
  };
}

// =============================================================================
// API функции
// =============================================================================

/**
 * Вход в систему
 */
export const login = async (credentials: LoginCredentials): Promise<AuthResponse> => {
  const formData = new FormData();
  formData.append("username", credentials.email);
  formData.append("password", credentials.password);

  const response = await apiClient.post<AuthResponse>("/auth/login", formData, {
    headers: {
      "Content-Type": "application/x-www-form-urlencoded",
    },
  });

  return response.data;
};

/**
 * Регистрация нового пользователя
 */
export const register = async (data: RegisterData): Promise<AuthResponse> => {
  const response = await apiClient.post<AuthResponse>("/auth/register", data);
  return response.data;
};

/**
 * Обновление токена
 */
export const refreshToken = async (refreshToken: string): Promise<{ access_token: string; refresh_token: string }> => {
  const response = await apiClient.post<{ access_token: string; refresh_token: string }>("/auth/refresh", {
    refresh_token: refreshToken,
  });
  return response.data;
};

/**
 * Выход из системы
 */
export const logout = async (): Promise<void> => {
  await apiClient.post("/auth/logout");
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
export const getUserById = async (userId: string): Promise<User> => {
  const response = await apiClient.get<User>(`/admin/users/${userId}`);
  return response.data;
};
