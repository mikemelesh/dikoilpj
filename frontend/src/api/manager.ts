import { apiClient } from "./axios";
import type { Client, Technician, Service, Promotion, Order, MaterialRequest } from "@/types";

// =============================================================================
// Типы запросов/ответов
// =============================================================================

export interface OrderAnalytics {
  total: number;
  by_status: Record<string, number>;
  by_priority: Record<string, number>;
  avg_completion_days?: number;
}

export interface RevenueAnalytics {
  total: number;
  by_period: { date: string; amount: number }[];
  by_service_category: { category_id: number; category_name: string; total: number }[];
}

export interface UpdateClientLoyaltyData {
  discount_percent?: number;
  loyalty_tier?: string;
}

export interface AssignTechnicianData {
  technician_id: number;
}

export interface ApproveMaterialRequestData {
  status: "approved" | "rejected";
  comment?: string;
}

// =============================================================================
// API функции
// =============================================================================

/**
 * Получение аналитики заказов
 */
export const getOrderAnalytics = async (params?: { date_from?: string; date_to?: string }): Promise<OrderAnalytics> => {
  const queryParams = new URLSearchParams();
  if (params?.date_from) queryParams.append("date_from", params.date_from);
  if (params?.date_to) queryParams.append("date_to", params.date_to);
  
  const response = await apiClient.get<OrderAnalytics>(`/analytics/orders?${queryParams}`);
  return response.data;
};

/**
 * Получение аналитики доходов
 */
export const getRevenueAnalytics = async (): Promise<RevenueAnalytics> => {
  const response = await apiClient.get<RevenueAnalytics>("/analytics/revenue");
  return response.data;
};

/**
 * Получение списка клиентов
 */
export const getClients = async (params?: { page?: number; limit?: number; search?: string }): Promise<{ items: Client[]; total: number }> => {
  const queryParams = new URLSearchParams();
  if (params?.page) queryParams.append("page", String(params.page));
  if (params?.limit) queryParams.append("limit", String(params.limit));
  if (params?.search) queryParams.append("search", params.search);
  
  const response = await apiClient.get(`/clients?${queryParams}`);
  return response.data;
};

/**
 * Обновление лояльности клиента
 */
export const updateClientLoyalty = async (clientId: number, data: UpdateClientLoyaltyData): Promise<Client> => {
  const response = await apiClient.put<Client>(`/clients/${clientId}/loyalty`, data);
  return response.data;
};

/**
 * Получение списка техников
 */
export const getTechnicians = async (): Promise<Technician[]> => {
  const response = await apiClient.get<Technician[]>("/technicians");
  return response.data;
};

/**
 * Назначение техника на заказ
 */
export const assignTechnician = async (orderId: string, technicianId: number): Promise<Order> => {
  const response = await apiClient.patch<Order>(`/orders/${orderId}/assign`, { technician_id: technicianId });
  return response.data;
};

/**
 * Получение списка услуг
 */
export const getServices = async (params?: { category_id?: number; is_active?: boolean; search?: string; page?: number; limit?: number }): Promise<{ items: Service[]; total: number; page: number; limit: number; pages: number }> => {
  const queryParams = new URLSearchParams();
  if (params?.category_id) queryParams.append("category_id", String(params.category_id));
  if (params?.is_active !== undefined) queryParams.append("is_active", String(params.is_active));
  if (params?.search) queryParams.append("search", params.search);
  if (params?.page) queryParams.append("page", String(params.page));
  if (params?.limit) queryParams.append("limit", String(params.limit));

  const response = await apiClient.get(`/services?${queryParams}`);
  return response.data;
};

/**
 * Создание услуги
 */
export const createService = async (data: { name: string; category_id: number; description?: string; base_price: number; unit: string; duration_days: number }): Promise<Service> => {
  const response = await apiClient.post<Service>("/services", data);
  return response.data;
};

/**
 * Обновление услуги
 */
export const updateService = async (id: number, data: Partial<{ name: string; category_id: number; description?: string; base_price: number; unit: string; duration_days: number; is_active: boolean }>): Promise<Service> => {
  const response = await apiClient.put<Service>(`/services/${id}`, data);
  return response.data;
};

/**
 * Удаление услуги
 */
export const deleteService = async (id: number): Promise<void> => {
  await apiClient.delete(`/services/${id}`);
};

/**
 * Получение списка акций
 */
export const getPromotions = async (): Promise<{ items: Promotion[]; total: number }> => {
  const response = await apiClient.get("/promotions");
  return response.data;
};

/**
 * Создание акции
 */
export const createPromotion = async (data: { title: string; description?: string; discount_percent: number; start_date: string; end_date: string; applies_to: string; target_id?: number }): Promise<Promotion> => {
  const response = await apiClient.post<Promotion>("/promotions", data);
  return response.data;
};

/**
 * Обновление акции
 */
export const updatePromotion = async (id: number, data: Partial<{ title: string; description?: string; discount_percent: number; start_date: string; end_date: string; is_active: boolean; applies_to: string; target_id?: number }>): Promise<Promotion> => {
  const response = await apiClient.put<Promotion>(`/promotions/${id}`, data);
  return response.data;
};

/**
 * Удаление акции
 */
export const deletePromotion = async (id: number): Promise<void> => {
  await apiClient.delete(`/promotions/${id}`);
};

/**
 * Получение списка материалов
 */
export const getMaterials = async (params?: { search?: string; low_stock_only?: boolean }): Promise<{ items: Material[]; total: number }> => {
  const queryParams = new URLSearchParams();
  if (params?.search) queryParams.append("search", params.search);
  if (params?.low_stock_only) queryParams.append("low_stock_only", String(params.low_stock_only));

  const response = await apiClient.get(`/materials?${queryParams}`);
  return response.data;
};

/**
 * Получение заявок на материалы
 */
export const getMaterialRequests = async (params?: { status?: string; technician_id?: number }): Promise<{ items: MaterialRequest[]; total: number }> => {
  const queryParams = new URLSearchParams();
  if (params?.status) queryParams.append("status", params.status);
  if (params?.technician_id) queryParams.append("technician_id", String(params.technician_id));

  const response = await apiClient.get(`/materials/requests?${queryParams}`);
  return response.data;
};

/**
 * Обработка заявки на материал
 */
export const approveMaterialRequest = async (id: number, data: ApproveMaterialRequestData): Promise<MaterialRequest> => {
  const response = await apiClient.patch<MaterialRequest>(`/materials/requests/${id}`, data);
  return response.data;
};
