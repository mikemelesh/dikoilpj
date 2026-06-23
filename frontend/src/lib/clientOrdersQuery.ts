export const CLIENT_ORDER_QUERY_KEYS = [
  "client-orders",
  "client-archive",
  "client-dashboard-orders",
] as const;

export const clientOrdersQueryOptions = {
  staleTime: 30_000,
  refetchOnWindowFocus: true,
} as const;
