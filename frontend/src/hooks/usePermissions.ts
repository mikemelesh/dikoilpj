import type { UserRole } from "@/types";
import { useAuth } from "./useAuth";

export const usePermissions = () => {
  const { role } = useAuth();

  const hasRole = (allowed: UserRole | UserRole[]) => {
    const allowedArray = Array.isArray(allowed) ? allowed : [allowed];
    return role ? allowedArray.includes(role) : false;
  };

  return { role, hasRole };
};

