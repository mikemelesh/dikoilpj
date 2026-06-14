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
}

export interface TechnicianListResponse {
  items: Technician[];
  total: number;
  page: number;
  limit: number;
  pages: number;
}

export interface PublicRecentWork {
  order_number: string;
  completed_at?: string | null;
  items_count: number;
  completion_days?: number | null;
}

export interface TechnicianPortfolio {
  id: number;
  first_name?: string;
  last_name?: string;
  specialization?: string;
  experience_years: number;
  rating: number;
  completed_orders: number;
  in_progress_orders: number;
  average_completion_days?: number | null;
  portfolio_description?: string;
  is_available: boolean;
  recent_works: PublicRecentWork[];
}

// =============================================================================
// API функции
// =============================================================================

/**
 * Публичный список техников (портфолио)
 */
export const getPublicTechnicians = async (params?: {
  page?: number;
  limit?: number;
  search?: string;
  specialization?: string;
  available_only?: boolean;
}): Promise<TechnicianListResponse> => {
  const queryParams = new URLSearchParams();
  if (params?.page) queryParams.append("page", String(params.page));
  if (params?.limit) queryParams.append("limit", String(params.limit));
  if (params?.search) queryParams.append("search", params.search);
  if (params?.specialization) queryParams.append("specialization", params.specialization);
  if (params?.available_only !== undefined) {
    queryParams.append("available_only", String(params.available_only));
  }

  const response = await apiClient.get<TechnicianListResponse>(`/technicians?${queryParams.toString()}`);
  return response.data;
};

/**
 * Публичное портфолио техника
 */
export const getTechnicianPortfolio = async (id: number): Promise<TechnicianPortfolio> => {
  const response = await apiClient.get<TechnicianPortfolio>(`/technicians/${id}/portfolio`);
  return response.data;
};

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
export const getTechnicianOrders = async (params?: {
  status?: string | string[];
  priority?: string;
  date_from?: string;
  date_to?: string;
  search?: string;
  sort_by?: string;
  sort_dir?: "asc" | "desc";
  page?: number;
  limit?: number;
}) => {
  const queryParams = new URLSearchParams();
  if (params?.status) {
    if (Array.isArray(params.status)) {
      params.status.forEach(s => queryParams.append("status", s));
    } else {
      queryParams.append("status", params.status);
    }
  }
  if (params?.priority) queryParams.append("priority", params.priority);
  if (params?.date_from) queryParams.append("date_from", params.date_from);
  if (params?.date_to) queryParams.append("date_to", params.date_to);
  if (params?.search) queryParams.append("search", params.search);
  if (params?.sort_by) queryParams.append("sort_by", params.sort_by);
  if (params?.sort_dir) queryParams.append("sort_dir", params.sort_dir);
  if (params?.page) queryParams.append("page", String(params.page));
  if (params?.limit) queryParams.append("limit", String(params.limit));

  const response = await apiClient.get(`/technicians/me/orders?${queryParams}`);
  return response.data;
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
 * Создание запроса на материал
 */
export const createMaterialRequest = async (data: CreateMaterialRequestData): Promise<MaterialRequest> => {
  const response = await apiClient.post<MaterialRequest>("/materials/requests", data);
  return response.data;
};

/**
 * Получение запросов на материалы техника
 */
export const getMyMaterialRequests = async (): Promise<{ items: MaterialRequest[]; total: number }> => {
  const response = await apiClient.get("/materials/requests?technician_me=true");
  return response.data;
};

/**
 * Получение базы знаний
 */
export const getKnowledgeBase = async (params?: { category?: string; search?: string }): Promise<{ items: KnowledgeBase[]; total: number }> => {
  const queryParams = new URLSearchParams();
  if (params?.category) queryParams.append("category", params.category);
  if (params?.search) queryParams.append("search", params.search);

  const response = await apiClient.get(`/knowledge-base?${queryParams}`);
  return response.data;
};

/**
 * Получение статьи базы знаний
 */
export const getKnowledgeArticle = async (id: number): Promise<KnowledgeBase> => {
  const response = await apiClient.get(`/knowledge-base/${id}`);
  return response.data;
};
