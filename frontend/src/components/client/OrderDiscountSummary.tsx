import { formatPrice } from "@/utils";
import { getAppliedDiscountDescription, type DiscountSource } from "@/utils/discountLabel";

interface OrderDiscountSummaryProps {
  subtotal: number;
  discountAmount: number;
  discountPercent: number;
  finalPrice: number;
  discountSource?: DiscountSource;
  loyaltyPercent?: number;
  promotionPercent?: number;
  promotionTitle?: string | null;
  totalSpent?: number;
}

export const OrderDiscountSummary = ({
  subtotal,
  discountAmount,
  discountPercent,
  finalPrice,
  discountSource = "none",
  loyaltyPercent = 0,
  promotionPercent = 0,
  promotionTitle,
  totalSpent,
}: OrderDiscountSummaryProps) => {
  const description = getAppliedDiscountDescription(discountSource, discountPercent, {
    loyaltyPercent,
    promotionPercent,
    promotionTitle,
    totalSpent,
  });

  return (
    <div className="space-y-2 text-sm">
      <div className="flex justify-between">
        <span>Подытог:</span>
        <span>{formatPrice(subtotal)}</span>
      </div>
      {discountAmount > 0 && (
        <>
          <div className="flex justify-between text-green-600 font-medium">
            <span>Скидка ({discountPercent}%):</span>
            <span>−{formatPrice(discountAmount)}</span>
          </div>
          <p className="text-xs text-muted-foreground leading-relaxed">{description}</p>
        </>
      )}
      {discountAmount === 0 && discountSource === "none" && (
        <p className="text-xs text-muted-foreground leading-relaxed">{description}</p>
      )}
      <div className="flex justify-between text-lg font-bold pt-2 border-t">
        <span>Итого:</span>
        <span>{formatPrice(finalPrice)}</span>
      </div>
    </div>
  );
};
