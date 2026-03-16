import { format, parseISO } from "date-fns";

export const formatCurrency = (value: number, currency = "BYN") =>
  new Intl.NumberFormat("ru-BY", { style: "currency", currency }).format(value);

export const formatDate = (iso: string) => {
  const date = parseISO(iso);
  return format(date, "dd.MM.yyyy");
};

