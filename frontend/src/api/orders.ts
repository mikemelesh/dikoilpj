import { apiClient } from "./axios";
import type { Order, OrderFile, OrderStatus, OrderItem } from "@/types";

// =============================================================================
// Типы запросов/ответов
// =============================================================================

export interface GetOrdersParams {
  status?: string;
  priority?: string;
  date_from?: string;
  date_to?: string;
  client_id?: number;
  page?: number;
  limit?: number;
}

export interface CreateOrderData {
  items: { service_id: number; quantity: number; specifications?: Record<string, string> }[];
  notes?: string;
  deadline?: string;
  priority?: "normal" | "urgent" | "critical";
}

export interface UpdateOrderStatusData {
  new_status: OrderStatus;
  comment?: string;
}

export interface OrdersResponse {
  items: Order[];
  total: number;
  page: number;
  limit: number;
  pages: number;
}

// =============================================================================
// API функции
// =============================================================================

/**
 * Получение списка заказов
 */
export const getOrders = async (params?: GetOrdersParams): Promise<OrdersResponse> => {
  const queryParams = new URLSearchParams();
  
  if (params?.status) queryParams.append("status", params.status);
  if (params?.priority) queryParams.append("priority", params.priority);
  if (params?.date_from) queryParams.append("date_from", params.date_from);
  if (params?.date_to) queryParams.append("date_to", params.date_to);
  if (params?.client_id) queryParams.append("client_id", String(params.client_id));
  if (params?.page) queryParams.append("page", String(params.page));
  if (params?.limit) queryParams.append("limit", String(params.limit));

  const response = await apiClient.get<OrdersResponse>(`/orders?${queryParams}`);
  return response.data;
};

/**
 * Получение заказа по ID
 */
export const getOrder = async (id: string): Promise<Order> => {
  const response = await apiClient.get<Order>(`/orders/${id}`);
  return response.data;
};

/**
 * Создание заказа
 */
export const createOrder = async (data: CreateOrderData): Promise<Order> => {
  const response = await apiClient.post<Order>("/orders", data);
  return response.data;
};

/**
 * Обновление заказа (клиентом)
 */
export const updateOrder = async (id: string, data: { notes?: string; deadline?: string; priority?: string }): Promise<Order> => {
  const response = await apiClient.put<Order>(`/orders/${id}`, data);
  return response.data;
};

/**
 * Изменение статуса заказа
 */
export const updateOrderStatus = async (id: string, data: UpdateOrderStatusData): Promise<Order> => {
  const response = await apiClient.patch<Order>(`/orders/${id}/status`, data);
  return response.data;
};

/**
 * Назначение техника на заказ
 */
export const assignTechnician = async (id: string, technicianId: number): Promise<Order> => {
  const response = await apiClient.patch<Order>(`/orders/${id}/assign`, { technician_id: technicianId });
  return response.data;
};

/**
 * Загрузка файла к заказу
 */
export const uploadFile = async (orderId: string, file: File): Promise<OrderFile> => {
  const formData = new FormData();
  formData.append("file", file);

  const response = await apiClient.post<OrderFile>(`/orders/${orderId}/files`, formData, {
    headers: { "Content-Type": "multipart/form-data" },
  });
  return response.data;
};

/**
 * Удаление файла заказа
 */
export const deleteFile = async (orderId: string, fileId: number): Promise<void> => {
  await apiClient.delete(`/orders/${orderId}/files/${fileId}`);
};

/**
 * Получение файлов заказа (если нужно отдельно)
 */
export const getOrderFiles = async (orderId: string): Promise<OrderFile[]> => {
  const response = await apiClient.get<OrderFile[]>(`/orders/${orderId}/files`);
  return response.data;
};
