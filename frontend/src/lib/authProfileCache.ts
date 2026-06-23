import type { QueryClient } from "@tanstack/react-query";

const PROFILE_QUERY_KEYS = [["current-user-profile"], ["current-technician-full"]] as const;

export function clearAuthProfileCache(queryClient: QueryClient): void {
  for (const queryKey of PROFILE_QUERY_KEYS) {
    queryClient.removeQueries({ queryKey });
  }
}
