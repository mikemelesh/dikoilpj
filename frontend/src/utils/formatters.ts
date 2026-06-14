import { format, isValid, parseISO } from "date-fns";

export const formatCurrency = (value: number, currency = "BYN") =>
  new Intl.NumberFormat("ru-BY", { style: "currency", currency }).format(value);

function toDate(value: string | Date): Date {
  if (value instanceof Date) return value;
  const parsed = parseISO(value);
  if (isValid(parsed)) return parsed;
  return new Date(value);
}

export function formatDate(value: string | Date | null | undefined): string {
  if (value == null || value === "") return "—";
  const date = toDate(value);
  if (!isValid(date)) return "—";
  return format(date, "dd/MM/yy");
}

export function formatDateTime(value: string | Date | null | undefined): string {
  if (value == null || value === "") return "—";
  const date = toDate(value);
  if (!isValid(date)) return "—";
  return format(date, "dd/MM/yy, HH:mm");
}

const BY_PHONE_COMPACT = /^\+375\d{9}$/;

/** Normalize Belarus phone input to +375XXXXXXXXX or pass through short legacy values. */
export function normalizeBelarusPhone(phone: string | undefined | null): string | null {
  if (!phone?.trim()) return null;
  const digits = phone.replace(/\D/g, "");
  if (!digits) return null;
  if (digits.length === 12 && digits.startsWith("375")) {
    return `+${digits}`;
  }
  if (digits.length === 9) {
    return `+375${digits}`;
  }
  const compact = phone.replace(/\s/g, "");
  if (BY_PHONE_COMPACT.test(compact)) return compact;
  const trimmed = phone.trim();
  return trimmed.length <= 20 ? trimmed : null;
}

/** Returns an error message when the phone value is invalid, or null if OK. */
export function validateBelarusPhoneInput(phone: string | undefined | null): string | null {
  if (!phone?.trim()) return null;
  const digits = phone.replace(/\D/g, "");
  if (digits.startsWith("375") || phone.includes("+375")) {
    const normalized = normalizeBelarusPhone(phone);
    if (!normalized || !BY_PHONE_COMPACT.test(normalized)) {
      return "Введите корректный белорусский номер телефона";
    }
  }
  if (phone.trim().length > 20) {
    return "Номер телефона слишком длинный";
  }
  return null;
}
