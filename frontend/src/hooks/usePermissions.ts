import type { Role } from "@/types";
import { useAuth } from "./useAuth";

export const usePermissions = () => {
  const { user } = useAuth();
  const role = user?.role ?? null;

  const hasRole = (allowed: Role | Role[]) => {
    const allowedArray = Array.isArray(allowed) ? allowed : [allowed];
    return role ? allowedArray.includes(role) : false;
  };

  return { role, hasRole };
};

