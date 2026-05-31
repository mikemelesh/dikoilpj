import { useEffect } from "react";
import { useQueryClient } from "@tanstack/react-query";

import { clearAuthProfileCache } from "@/lib/authProfileCache";

/**
 * Clears cached profile queries on login/logout.
 * Must be mounted under QueryClientProvider (e.g. in main.tsx).
 * LoginPage has no ProfileSync, so this listener is required on login.
 */
export const AuthQueryCacheListener = () => {
  const queryClient = useQueryClient();

  useEffect(() => {
    const clear = () => clearAuthProfileCache(queryClient);

    window.addEventListener("auth-login", clear);
    window.addEventListener("auth-logout", clear);
    return () => {
      window.removeEventListener("auth-login", clear);
      window.removeEventListener("auth-logout", clear);
    };
  }, [queryClient]);

  return null;
};
