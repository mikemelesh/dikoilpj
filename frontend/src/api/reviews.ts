import type { Review } from "@/types";

import { apiClient } from "./axios";

interface CreateOrderReviewPayload {
  rating: number;
  text?: string;
  order_id: string;
}

export const createOrderReview = async (
  payload: CreateOrderReviewPayload,
): Promise<Review> => {
  const response = await apiClient.post<Review>("/reviews", {
    rating: payload.rating,
    text: payload.text,
    order_id: payload.order_id,
  });
  return response.data;
};

