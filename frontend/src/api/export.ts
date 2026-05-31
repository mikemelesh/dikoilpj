import { apiClient } from "./axios";

export interface ExportFilters {
  status?: string | string[];
  priority?: string;
  date_from?: string;
  date_to?: string;
  client_id?: number;
  technician_id?: number;
  search?: string;
  page?: number;
  limit?: number;
}

export type ExportFormat = "excel" | "docx";

/** Корректная сериализация фильтров для FastAPI (массивы status, числа, поиск). */
export function buildExportQueryParams(filters: ExportFilters = {}): URLSearchParams {
  const params = new URLSearchParams();

  if (filters.status) {
    const statuses = Array.isArray(filters.status) ? filters.status : [filters.status];
    statuses.forEach((s) => {
      if (s) params.append("status", s);
    });
  }
  if (filters.priority) params.append("priority", filters.priority);
  if (filters.date_from) params.append("date_from", filters.date_from);
  if (filters.date_to) params.append("date_to", filters.date_to);
  if (filters.client_id != null) params.append("client_id", String(filters.client_id));
  if (filters.technician_id != null) params.append("technician_id", String(filters.technician_id));
  if (filters.search) params.append("search", filters.search);

  params.append("page", String(filters.page ?? 1));
  params.append("limit", String(filters.limit ?? 5000));

  return params;
}

async function fetchExportBlob(path: string, filters: ExportFilters, format: ExportFormat): Promise<Blob> {
  const params = buildExportQueryParams(filters);
  params.append("format", format);
  const response = await apiClient.get(`${path}?${params.toString()}`, {
    responseType: "blob",
  });
  return response.data;
}

export const exportOrders = async (filters: ExportFilters, format: ExportFormat): Promise<Blob> =>
  fetchExportBlob("/export/orders", filters, format);

export const exportMaterials = async (
  format: ExportFormat,
  filters: { status?: string; date_from?: string; date_to?: string; search?: string; page?: number; limit?: number } = {}
): Promise<Blob> => fetchExportBlob("/export/materials", filters, format);

export const exportGantt = async (
  format: ExportFormat,
  filters: ExportFilters = {}
): Promise<Blob> => fetchExportBlob("/export/gantt", filters, format);

export const exportClients = async (format: ExportFormat, filters: ExportFilters = {}): Promise<Blob> =>
  fetchExportBlob("/export/clients", filters, format);

export const exportTechnicians = async (
  format: ExportFormat,
  filters: ExportFilters & { available_only?: boolean } = {}
): Promise<Blob> => {
  const params = buildExportQueryParams(filters);
  params.append("format", format);
  if (filters.available_only !== undefined) {
    params.append("available_only", String(filters.available_only));
  }
  const response = await apiClient.get(`/export/technicians?${params.toString()}`, {
    responseType: "blob",
  });
  return response.data;
};

export const exportOrdersByClient = async (
  format: ExportFormat,
  filters: ExportFilters = {}
): Promise<Blob> => fetchExportBlob("/export/orders-by-client", filters, format);

export const exportOrdersByTechnician = async (
  format: ExportFormat,
  filters: ExportFilters = {}
): Promise<Blob> => fetchExportBlob("/export/orders-by-technician", filters, format);

export const exportTechnicianOrders = async (
  format: ExportFormat,
  filters: ExportFilters = {}
): Promise<Blob> => fetchExportBlob("/export/technician-orders", filters, format);

export const exportUsers = async (
  format: ExportFormat,
  filters: { role?: string; is_active?: string; search?: string; page?: number; limit?: number } = {}
): Promise<Blob> => fetchExportBlob("/export/users", filters, format);

export const exportFaqs = async (
  format: ExportFormat,
  filters: { page?: number; limit?: number } = {}
): Promise<Blob> => fetchExportBlob("/export/faqs", filters, format);

export const exportReviews = async (
  format: ExportFormat,
  filters: { is_published?: string; is_moderated?: string; page?: number; limit?: number } = {}
): Promise<Blob> => fetchExportBlob("/export/reviews", filters, format);

export const exportArticles = async (
  format: ExportFormat,
  filters: { is_published?: string; category?: string; page?: number; limit?: number } = {}
): Promise<Blob> => fetchExportBlob("/export/articles", filters, format);
