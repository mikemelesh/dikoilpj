import { useEffect } from "react";
import { useQuery } from "@tanstack/react-query";
import { useAuthStore } from "@/stores/authStore";
import { getMe } from "@/api/auth";

/**
 * Хук для загрузки и синхронизации профиля текущего пользователя.
 * Обновляет данные в authStore при загрузке.
 */
export const useCurrentUser = () => {
  const { user, updateUser, isAuthenticated } = useAuthStore();

  const { data, isLoading, error } = useQuery({
    queryKey: ["current-user"],
    queryFn: getMe,
    enabled: isAuthenticated,
    retry: 1,
    staleTime: 5 * 60 * 1000, // 5 минут
  });

  useEffect(() => {
    if (data) {
      // Обновляем пользователя в store с профилями
      updateUser({
        ...data.user,
        client_profile: data.client_profile,
        technician_profile: data.technician_profile,
      });
    }
  }, [data, updateUser]);

  return {
    user: data ? {
      ...data.user,
      client_profile: data.client_profile,
      technician_profile: data.technician_profile,
    } : user,
    isLoading,
    error,
  };
};
