import axios, { AxiosError, InternalAxiosRequestConfig } from "axios";

import { authStore } from "@/stores/authStore";

export const API_BASE_URL = import.meta.env.VITE_API_URL ?? "http://localhost:8000/api";

export const apiClient = axios.create({
  baseURL: API_BASE_URL,
  withCredentials: true,
  headers: {
    "Content-Type": "application/json",
  },
});

// Request interceptor — добавляем Authorization header
apiClient.interceptors.request.use(
  (config: InternalAxiosRequestConfig) => {
    const { accessToken } = authStore.getState();
    if (accessToken && config.headers) {
      config.headers.Authorization = `Bearer ${accessToken}`;
    }
    return config;
  },
  (error) => Promise.reject(error)
);

let isRefreshing = false;
let pendingRequests: Array<() => void> = [];

const processQueue = (error: AxiosError | null = null) => {
  pendingRequests.forEach((cb) => {
    cb();
  });
  pendingRequests = [];
};

// Response interceptor — обрабатываем 401 и refresh токен
apiClient.interceptors.response.use(
  (response) => response,
  async (error: AxiosError) => {
    const originalRequest = error.config as InternalAxiosRequestConfig & { _retry?: boolean };
    
    if (error.response?.status === 401 && !originalRequest._retry) {
      if (isRefreshing) {
        // Если уже идёт refresh, добавляем запрос в очередь
        return new Promise((resolve, reject) => {
          pendingRequests.push(() => {
            apiClient(originalRequest)
              .then(resolve)
              .catch(reject);
          });
        });
      }

      originalRequest._retry = true;
      isRefreshing = true;

      try {
        const { refreshToken, setTokens, clearAuth } = authStore.getState();
        
        if (!refreshToken) {
          clearAuth();
          window.location.href = "/login";
          return Promise.reject(error);
        }

        // Запрос на refresh токена
        const response = await axios.post(`${API_BASE_URL}/auth/refresh`, {
          refresh_token: refreshToken,
        });

        const { access_token, refresh_token } = response.data;
        setTokens(access_token, refresh_token);
        
        // Повторяем все ожидающие запросы
        processQueue();
        
        return apiClient(originalRequest);
      } catch (refreshError) {
        // Ошибка refresh — logout и redirect
        authStore.getState().clearAuth();
        window.location.href = "/login";
        return Promise.reject(refreshError);
      } finally {
        isRefreshing = false;
      }
    }

    return Promise.reject(error);
  }
);

