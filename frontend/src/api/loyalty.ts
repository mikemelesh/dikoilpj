import { apiClient } from "./axios";
import type { LoyaltyProgress } from "@/utils/loyalty";

export interface ClientLoyaltyInfo {
  total_spent: number;
  total_orders: number;
  loyalty_tier: string;
  discount_percent: number;
  progress: LoyaltyProgress;
  rules: {
    threshold_spent: number;
    base_discount_percent: number;
    step_spent: number;
    step_discount_percent: number;
    max_discount_percent: number;
    currency: string;
  };
}

export const getMyLoyalty = async (): Promise<ClientLoyaltyInfo> => {
  const response = await apiClient.get<ClientLoyaltyInfo>("/clients/me/loyalty");
  return response.data;
};

export const recalculateAllLoyalty = async (): Promise<{ updated_clients: number }> => {
  const response = await apiClient.post<{ updated_clients: number }>(
    "/clients/loyalty/recalculate",
  );
  return response.data;
};
