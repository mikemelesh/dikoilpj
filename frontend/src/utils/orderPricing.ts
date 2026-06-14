/** Round to 2 decimal places for BYN amounts. */
export function roundMoney(value: number): number {
  return Math.round(value * 100) / 100;
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
