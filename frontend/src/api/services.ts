import { useQuery } from "@tanstack/react-query";

import { apiClient } from "./axios";

export interface ServiceDto {
  id: number;
  name: string;
  description?: string;
  base_price: number;
}

export const useServices = () =>
  useQuery({
    queryKey: ["services"],
    queryFn: async () => {
      const { data } = await apiClient.get<ServiceDto[]>("/services");
      return data;
    },
  });

