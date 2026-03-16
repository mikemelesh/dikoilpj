import { apiClient } from "./axios";
import type { Technician, Material, MaterialRequest, KnowledgeBase } from "@/types";

// =============================================================================
// Типы запросов/ответов
// =============================================================================

export interface TechnicianStats {
  total_orders: number;
  completed_orders: number;
  in_progress_orders: number;
  average_completion_days?: number;
  rating: number;
  total_earnings: number;
  monthly_completed: { month: string; count: number }[];
}

export interface CreateMaterialRequestData {
  material_id: number;
  quantity_requested: number;
  comment?: string;
}

export interface UpdateTechnicianProfileData {
  specialization?: string;
  experience_years?: number;
  portfolio_description?: string;
  is_available?: boolean;
}

// =============================================================================
// API функции
// =============================================================================

/**
 * Получение текущего техника
 */
export const getCurrentTechnician = async (): Promise<Technician> => {
  const response = await apiClient.get<Technician>("/technicians/me");
  return response.data;
};

/**
 * Получение статистики техника
 */
export const getTechnicianStats = async (): Promise<TechnicianStats> => {
  const response = await apiClient.get<TechnicianStats>("/technicians/me/stats");
  return response.data;
};

/**
 * Обновление профиля техника
 */
export const updateTechnicianProfile = async (data: UpdateTechnicianProfileData): Promise<Technician> => {
  const response = await apiClient.put<Technician>("/technicians/me/profile", data);
  return response.data;
};

/**
 * Получение заказов техника
 */
export const getTechnicianOrders = async (params?: { status?: string; page?: number; limit?: number }) => {
  const queryParams = new URLSearchParams();
  if (params?.status) queryParams.append("status", params.status);
  if (params?.page) queryParams.append("page", String(params.page));
  if (params?.limit) queryParams.append("limit", String(params.limit));
  
  const response = await apiClient.get(`/technicians/me/orders?${queryParams}`);
  return response.data;
};

/**
 * Получение списка материалов
 */
export const getMaterials = async (): Promise<Material[]> => {
  const response = await apiClient.get<Material[]>("/materials");
  return response.data;
};

/**
 * Создание запроса на материал
 */
export const createMaterialRequest = async (data: CreateMaterialRequestData): Promise<MaterialRequest> => {
  const response = await apiClient.post<MaterialRequest>("/materials/requests", data);
  return response.data;
};

/**
 * Получение запросов на материалы техника
 */
export const getMyMaterialRequests = async (): Promise<MaterialRequest[]> => {
  const response = await apiClient.get<MaterialRequest[]>("/materials/requests?technician_me=true");
  return response.data;
};

/**
 * Получение базы знаний
 */
export const getKnowledgeBase = async (params?: { category?: string; search?: string }): Promise<KnowledgeBase[]> => {
  const queryParams = new URLSearchParams();
  if (params?.category) queryParams.append("category", params.category);
  if (params?.search) queryParams.append("search", params.search);
  
  const response = await apiClient.get<KnowledgeBase[]>(`/knowledge-base?${queryParams}`);
  return response.data;
};

/**
 * Получение статьи базы знаний
 */
export const getKnowledgeArticle = async (id: number): Promise<KnowledgeBase> => {
  const response = await apiClient.get<KnowledgeBase>(`/knowledge-base/${id}`);
  return response.data;
};
