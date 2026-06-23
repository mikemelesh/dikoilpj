import axios from "axios";
import { toast } from "react-toastify";

function formatFastApiDetail(detail: unknown): string | null {
  if (typeof detail === "string") return detail;
  if (Array.isArray(detail)) {
    const parts = detail
      .map((item) => {
        if (typeof item === "string") return item;
        if (item && typeof item === "object" && "msg" in item) {
          const loc = "loc" in item && Array.isArray(item.loc) ? item.loc.join(".") : "";
          return loc ? `${loc}: ${String(item.msg)}` : String(item.msg);
        }
        return null;
      })
      .filter((part): part is string => Boolean(part));
    return parts.length ? parts.join("; ") : null;
  }
  if (detail && typeof detail === "object" && "message" in detail) {
    return String((detail as { message: unknown }).message);
  }
  return null;
}

export function getApiErrorMessage(error: unknown, fallback: string): string {
  if (axios.isAxiosError(error)) {
    const detail = formatFastApiDetail(error.response?.data?.detail);
    if (detail) return detail;
    if (typeof error.response?.data === "string" && error.response.data.trim()) {
      return error.response.data;
    }
    if (error.message) return error.message;
  }
  if (error instanceof Error && error.message) return error.message;
  return fallback;
}

export function showApiError(error: unknown, fallback: string): void {
  toast.error(getApiErrorMessage(error, fallback));
}

export function mutationOnError(fallback: string) {
  return (error: unknown) => {
    showApiError(error, fallback);
  };
}
