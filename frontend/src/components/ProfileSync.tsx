import { useEffect } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useAuthStore } from "@/stores/authStore";
import { getMe } from "@/api/auth";
import { getCurrentTechnician } from "@/api/technicians";

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
  });

  // Для техников дополнительно загружаем профиль
  const isTechnician = user?.role === "technician";
  const { data: technicianData } = useQuery({
    queryKey: ["current-technician-full"],
    queryFn: getCurrentTechnician,
    enabled: isAuthenticated && isTechnician && !!meData,
    retry: 1,
    staleTime: 5 * 60 * 1000, // 5 минут
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

  // Обработка ошибки - logout при 401
  useEffect(() => {
    if (meError) {
      console.error("Ошибка загрузки профиля:", meError);
      logout();
      queryClient.clear();
    }
  }, [meError]);

  return null;
};
