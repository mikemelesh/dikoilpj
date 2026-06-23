/** Round to 2 decimal places for BYN amounts. */
export function roundMoney(value: number): number {
  return Math.round(value * 100) / 100;
}

export function getOrderSubtotal(order: {
  total_price?: number | string | null;
  final_price?: number | string | null;
  discount_amount?: number | string | null;
}): number {
  const total = Number(order.total_price);
  if (Number.isFinite(total)) return total;
  const final = Number(order.final_price ?? 0);
  const discount = Number(order.discount_amount ?? 0);
  const derived = final + discount;
  return Number.isFinite(derived) ? derived : 0;
}

export function finalFromDiscount(subtotal: number, discount: number): number {
  const d = Math.min(Math.max(discount, 0), subtotal);
  return roundMoney(subtotal - d);
}

export function discountFromFinal(subtotal: number, finalPrice: number): number {
  const f = Math.min(Math.max(finalPrice, 0), subtotal);
  return roundMoney(subtotal - f);
}

export function formatOrderMoney(value: number | string): string {
  const n = Number(value);
  return new Intl.NumberFormat("ru-RU", {
    style: "currency",
    currency: "BYN",
    minimumFractionDigits: 2,
  }).format(Number.isNaN(n) ? 0 : n);
}
