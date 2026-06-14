import { formatPrice } from "@/utils";
import { LOYALTY_RULES } from "@/utils/loyalty";

export type DiscountSource = "none" | "loyalty" | "promotion" | "combined";

/** Короткое пояснение, откуда взялась скидка в расчёте заказа. */
export function getAppliedDiscountDescription(
  source: DiscountSource,
  percent: number,
  options?: {
    loyaltyPercent?: number;
    promotionPercent?: number;
    promotionTitle?: string | null;
    totalSpent?: number;
  },
): string {
  if (percent <= 0 || source === "none") {
    return `Скидка по программе лояльности начинается от ${formatPrice(LOYALTY_RULES.thresholdSpent)} суммы завершённых заказов.`;
  }

  if (source === "combined") {
    const loyalty = options?.loyaltyPercent ?? 0;
    const promo = options?.promotionPercent ?? Math.max(percent - loyalty, 0);
    const promoLabel = options?.promotionTitle ? `акция «${options.promotionTitle}»` : "акция";
    return `Суммарная скидка −${percent}%: лояльность −${loyalty}% + ${promoLabel} −${promo}%.`;
  }

  if (source === "promotion" && options?.promotionTitle) {
    return `Применена акция «${options.promotionTitle}» (−${percent}%).`;
  }

  if (source === "loyalty") {
    const spent =
      options?.totalSpent != null
        ? ` (завершённые заказы на ${formatPrice(options.totalSpent)})`
        : " (сумма завершённых заказов)";
    return `Программа лояльности${spent}: −${percent}%.`;
  }

  return `Скидка −${percent}%.`;
}

/** Текст для карточки «ваша скидка» в личном кабинете. */
export function getLoyaltyDiscountSummary(discountPercent: number, totalSpent: number): string {
  if (discountPercent <= 0) {
    return `Скидка появится после ${formatPrice(LOYALTY_RULES.thresholdSpent)} в завершённых заказах. Сейчас потрачено ${formatPrice(totalSpent)}.`;
  }
  return `Скидка ${discountPercent}% за программу лояльности — от суммы завершённых заказов (${formatPrice(totalSpent)}). Складывается с действующими акциями при оформлении заказа.`;
}
