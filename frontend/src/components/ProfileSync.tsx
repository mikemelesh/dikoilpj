import axios from "axios";
import { useEffect } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useAuthStore } from "@/stores/authStore";
import { getMe } from "@/api/auth";
import { getCurrentTechnician } from "@/api/technicians";
import { showApiError } from "@/lib/apiError";

/**
 * Компонент для синхронизации профиля пользователя.
 * Загружает актуальные данные профиля при монтировании.
 */
export const ProfileSync = () => {
  const { isAuthenticated, user, updateUser, logout } = useAuthStore();
  const queryClient = useQueryClient();

  // Загружаем данные из /auth/me при каждом изменении isAuthenticated
  const { data: meData, error: meError } = useQuery({
    queryKey: ["current-user-profile"],
    queryFn: getMe,
    enabled: isAuthenticated,
    retry: 1,
    staleTime: 5 * 60 * 1000, // 5 минут
    meta: { skipErrorToast: true },
  });

  // Для техников дополнительно загружаем профиль
  const isTechnician = user?.role === "technician";
  const { data: technicianData, error: technicianError } = useQuery({
    queryKey: ["current-technician-full"],
    queryFn: getCurrentTechnician,
    enabled: isAuthenticated && isTechnician && !!meData,
    retry: 1,
    staleTime: 5 * 60 * 1000, // 5 минут
    meta: { skipErrorToast: true },
  });

  // Обновляем данные пользователя при загрузке (игнорируем устаревший кэш другого пользователя)
  useEffect(() => {
    if (!meData?.user) return;

    const currentUser = useAuthStore.getState().user;
    if (currentUser?.id && meData.user.id !== currentUser.id) {
      return;
    }

    updateUser({
      id: meData.user.id,
      email: meData.user.email,
      first_name: meData.user.first_name,
      last_name: meData.user.last_name,
      phone: meData.user.phone,
      role: meData.user.role,
      client_profile: meData.client_profile,
      technician_profile: meData.technician_profile || technicianData,
    });
  }, [meData, technicianData, updateUser]);

  // Обработка ошибки — logout при 401, иначе уведомление
  useEffect(() => {
    if (!meError) return;

    if (axios.isAxiosError(meError) && meError.response?.status === 401) {
      logout();
      queryClient.clear();
      return;
    }
    showApiError(meError, "Не удалось загрузить профиль");
  }, [meError, logout, queryClient]);

  useEffect(() => {
    if (!technicianError) return;
    showApiError(technicianError, "Не удалось загрузить профиль техника");
  }, [technicianError]);

  return null;
};
