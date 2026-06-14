import { apiClient } from "./axios";

export interface OrderTemplateItem {
  service_id: number;
  quantity: number;
  service_name?: string;
  specifications?: Record<string, string>;
}

export interface OrderTemplate {
  id: number;
  client_id: number;
  client_name?: string | null;
  name: string;
  items: OrderTemplateItem[];
  notes?: string | null;
  created_at: string;
}

export interface OrderTemplateListResponse {
  items: OrderTemplate[];
  total: number;
  page: number;
  limit: number;
  pages: number;
}

export interface OrderTemplatePayload {
  name: string;
  items: OrderTemplateItem[];
  notes?: string;
  client_id?: number;
}

export const getTemplates = async (params?: {
  page?: number;
  limit?: number;
  search?: string;
  client_id?: number;
}): Promise<OrderTemplateListResponse> => {
  const query = new URLSearchParams();
  query.append("page", String(params?.page ?? 1));
  query.append("limit", String(params?.limit ?? 50));
  if (params?.search) query.append("search", params.search);
  if (params?.client_id != null) query.append("client_id", String(params.client_id));

  const response = await apiClient.get<OrderTemplateListResponse>(`/templates?${query.toString()}`);
  return response.data;
};

export const createTemplate = async (data: OrderTemplatePayload): Promise<OrderTemplate> => {
  const response = await apiClient.post<OrderTemplate>("/templates", data);
  return response.data;
};

export const updateTemplate = async (
  id: number,
  data: OrderTemplatePayload,
): Promise<OrderTemplate> => {
  const response = await apiClient.put<OrderTemplate>(`/templates/${id}`, data);
  return response.data;
};

export const deleteTemplate = async (id: number, clientId?: number): Promise<void> => {
  const query = clientId != null ? `?client_id=${clientId}` : "";
  await apiClient.delete(`/templates/${id}${query}`);
};
