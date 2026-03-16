import { useOrders as useOrdersQuery } from "@/api/orders";

export const useOrders = () => {
  const query = useOrdersQuery();
  return query;
};

