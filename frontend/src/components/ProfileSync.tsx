import { useEffect, useRef } from "react";
import { useQuery } from "@tanstack/react-query";
import { useAuthStore } from "@/stores/authStore";
import { getMe } from "@/api/auth";
import { getCurrentTechnician } from "@/api/technicians";

/**
 * Компонент для синхронизации профиля пользователя.
 * Загружает актуальные данные профиля при монтировании.
 */
export const ProfileSync = () => {
  const { isAuthenticated, user, updateUser } = useAuthStore();
  const hasSyncedRef = useRef(false);
  const hasTechnicianSyncedRef = useRef(false);

  // Загружаем данные из /auth/me (только один раз при входе)
  const { data: meData } = useQuery({
    queryKey: ["current-user-profile"],
    queryFn: getMe,
    enabled: isAuthenticated && !hasSyncedRef.current,
    retry: 1,
    staleTime: Infinity, // Не обновлять автоматически
  });

  // Для техников дополнительно загружаем профиль (только один раз)
  const isTechnician = user?.role === "technician";
  const { data: technicianData } = useQuery({
    queryKey: ["current-technician-full"],
    queryFn: getCurrentTechnician,
    enabled: isAuthenticated && isTechnician && !hasTechnicianSyncedRef.current,
    retry: 1,
    staleTime: Infinity, // Не обновлять автоматически
  });

  useEffect(() => {
    if (meData && !hasSyncedRef.current) {
      hasSyncedRef.current = true;
      updateUser({
        ...meData.user,
        client_profile: meData.client_profile,
        technician_profile: meData.technician_profile,
      });
    }
  }, [meData]);

  // Для техников обновляем данные из более полного профиля
  useEffect(() => {
    if (technicianData && !hasTechnicianSyncedRef.current) {
      hasTechnicianSyncedRef.current = true;
      updateUser({
        technician_profile: {
          id: technicianData.id,
          specialization: technicianData.specialization,
          experience_years: technicianData.experience_years,
          rating: technicianData.rating,
          completed_orders: technicianData.completed_orders,
        },
      });
    }
  }, [technicianData]);

  return null;
};
