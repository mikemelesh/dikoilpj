/** Правила программы лояльности (синхронно с backend/app/utils/loyalty.py). */
export const LOYALTY_RULES = {
  thresholdSpent: 10_000,
  baseDiscountPercent: 5,
  stepSpent: 5_000,
  stepDiscountPercent: 1,
  maxDiscountPercent: 12,
  currency: "BYN",
} as const;

export function calculateDiscountFromSpent(totalSpent: number): number {
  if (totalSpent < LOYALTY_RULES.thresholdSpent) return 0;
  const extraSteps = Math.floor(
    (totalSpent - LOYALTY_RULES.thresholdSpent) / LOYALTY_RULES.stepSpent,
  );
  return Math.min(
    LOYALTY_RULES.maxDiscountPercent,
    LOYALTY_RULES.baseDiscountPercent + extraSteps,
  );
}

export interface LoyaltyProgress {
  current_discount_percent: number;
  next_discount_percent: number | null;
  next_threshold_spent: number | null;
  amount_to_next: number;
  is_max_tier: boolean;
}

export function getLoyaltyProgress(totalSpent: number): LoyaltyProgress {
  const current = calculateDiscountFromSpent(totalSpent);

  if (totalSpent < LOYALTY_RULES.thresholdSpent) {
    return {
      current_discount_percent: current,
      next_discount_percent: LOYALTY_RULES.baseDiscountPercent,
      next_threshold_spent: LOYALTY_RULES.thresholdSpent,
      amount_to_next: LOYALTY_RULES.thresholdSpent - totalSpent,
      is_max_tier: false,
    };
  }

  if (current >= LOYALTY_RULES.maxDiscountPercent) {
    return {
      current_discount_percent: current,
      next_discount_percent: null,
      next_threshold_spent: null,
      amount_to_next: 0,
      is_max_tier: true,
    };
  }

  const nextDiscount = current + 1;
  const stepsForNext = nextDiscount - LOYALTY_RULES.baseDiscountPercent;
  const nextThreshold =
    LOYALTY_RULES.thresholdSpent + LOYALTY_RULES.stepSpent * stepsForNext;

  return {
    current_discount_percent: current,
    next_discount_percent: nextDiscount,
    next_threshold_spent: nextThreshold,
    amount_to_next: Math.max(0, nextThreshold - totalSpent),
    is_max_tier: false,
  };
}

export function loyaltyProgressPercent(totalSpent: number): number {
  const p = getLoyaltyProgress(totalSpent);
  if (p.is_max_tier || p.next_threshold_spent == null) return 100;
  if (p.next_discount_percent === LOYALTY_RULES.baseDiscountPercent) {
    return Math.min(100, (totalSpent / LOYALTY_RULES.thresholdSpent) * 100);
  }
  const prevThreshold =
    LOYALTY_RULES.thresholdSpent +
    LOYALTY_RULES.stepSpent * (p.current_discount_percent - LOYALTY_RULES.baseDiscountPercent);
  const span = p.next_threshold_spent - prevThreshold;
  if (span <= 0) return 100;
  return Math.min(100, ((totalSpent - prevThreshold) / span) * 100);
}

export const LOYALTY_TIER_LABELS: Record<string, { name: string; color: string }> = {
  bronze: { name: "Bronze", color: "bg-amber-700" },
  silver: { name: "Silver", color: "bg-gray-400" },
  gold: { name: "Gold", color: "bg-yellow-500" },
  platinum: { name: "Platinum", color: "bg-blue-400" },
};
