import type { Order } from "@/types";

export type OrderSortField =
  | "created_at"
  | "deadline"
  | "order_number"
  | "final_price"
  | "priority";

type SortableOrder = Order & {
  created_at?: string | null;
  deadline?: string | null;
  final_price?: number | string | null;
  priority?: string | null;
};

const PRIORITY_RANK: Record<string, number> = {
  critical: 0,
  urgent: 1,
  normal: 2,
};

function toDateTs(value: unknown): number | null {
  if (!value) return null;
  const timestamp = new Date(value as string).getTime();
  return Number.isFinite(timestamp) ? timestamp : null;
}

function toNum(value: unknown): number | null {
  const num = typeof value === "number" ? value : Number(value);
  return Number.isFinite(num) ? num : null;
}

function toStr(value: unknown): string {
  return value === null || value === undefined ? "" : String(value);
}

function getSortValue(order: SortableOrder, sortBy: OrderSortField): string | number | null {
  switch (sortBy) {
    case "created_at":
      return toDateTs(order.created_at);
    case "deadline":
      return toDateTs(order.deadline);
    case "order_number":
      return toStr(order.order_number);
    case "final_price":
      return toNum(order.final_price);
    case "priority":
      return PRIORITY_RANK[order.priority ?? ""] ?? 999;
    default:
      return null;
  }
}

export function sortOrders<T extends SortableOrder>(
  orders: T[],
  sortBy: OrderSortField,
  sortDir: "asc" | "desc",
): T[] {
  const dir = sortDir === "asc" ? 1 : -1;

  return [...orders].sort((a, b) => {
    const valueA = getSortValue(a, sortBy);
    const valueB = getSortValue(b, sortBy);

    const aNull = valueA === null || valueA === undefined;
    const bNull = valueB === null || valueB === undefined;
    if (aNull && bNull) return 0;
    if (aNull) return 1;
    if (bNull) return -1;

    if (typeof valueA === "number" && typeof valueB === "number") {
      return (valueA - valueB) * dir;
    }

    return toStr(valueA).localeCompare(toStr(valueB), "ru") * dir;
  });
}

export function isOrderUrgent(order: SortableOrder): boolean {
  const overdue =
    order.deadline &&
    new Date(order.deadline) < new Date() &&
    !["completed", "cancelled", "archived"].includes(order.status);

  return order.priority === "critical" || order.priority === "urgent" || !!overdue;
}
