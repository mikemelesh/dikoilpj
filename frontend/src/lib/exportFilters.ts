import type { ExportFilters } from "@/api/export";

interface ToExportFiltersInput {
  filters: Record<string, string>;
  search?: string;
  status?: string | string[];
  clientId?: number;
  technicianId?: number;
}

export function toExportFilters({
  filters,
  search,
  status,
  clientId,
  technicianId,
}: ToExportFiltersInput): ExportFilters {
  const result: ExportFilters = {};

  const trimmedSearch = search?.trim();
  if (trimmedSearch) result.search = trimmedSearch;

  if (status !== undefined) {
    result.status = status;
  } else if (filters.status) {
    result.status = filters.status;
  }

  if (filters.priority) result.priority = filters.priority;
  if (filters.date_from) result.date_from = filters.date_from;
  if (filters.date_to) result.date_to = filters.date_to;
  if (clientId != null) result.client_id = clientId;
  if (technicianId != null) result.technician_id = technicianId;

  return result;
}
