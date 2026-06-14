import { Link } from "react-router-dom";
import { useQuery } from "@tanstack/react-query";
import { Percent } from "lucide-react";

import { getMyLoyalty } from "@/api/loyalty";
import { useAuthStore } from "@/stores/authStore";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { cn, formatPrice } from "@/utils";
import { getLoyaltyDiscountSummary } from "@/utils/discountLabel";
import { LOYALTY_TIER_LABELS, loyaltyProgressPercent } from "@/utils/loyalty";

type Variant = "banner" | "card" | "compact";

interface ClientDiscountInfoProps {
  variant?: Variant;
  className?: string;
  showProgress?: boolean;
}

export const ClientDiscountInfo = ({
  variant = "card",
  className,
  showProgress = variant === "card",
}: ClientDiscountInfoProps) => {
  const clientProfile = useAuthStore((s) => s.user?.client_profile);

  const { data: loyalty } = useQuery({
    queryKey: ["client-loyalty"],
    queryFn: getMyLoyalty,
    staleTime: 60_000,
  });

  const discountPercent = loyalty?.discount_percent ?? clientProfile?.discount_percent ?? 0;
  const totalSpent = loyalty?.total_spent ?? clientProfile?.total_spent ?? 0;
  const tier = loyalty?.loyalty_tier ?? clientProfile?.loyalty_tier ?? "bronze";
  const tierMeta = LOYALTY_TIER_LABELS[tier] || LOYALTY_TIER_LABELS.bronze;
  const summary = getLoyaltyDiscountSummary(discountPercent, totalSpent);
  const progressPct = loyaltyProgressPercent(totalSpent);

  if (variant === "compact") {
    return (
      <Link
        to="/client"
        className={cn(
          "hidden sm:flex items-center gap-2 rounded-lg border bg-primary/5 px-3 py-1.5 text-sm hover:bg-primary/10 transition-colors",
          className,
        )}
        title={summary}
      >
        <Percent className="h-4 w-4 text-primary shrink-0" />
        <span>
          Скидка <strong>{discountPercent}%</strong>
        </span>
      </Link>
    );
  }

  if (variant === "banner") {
    return (
      <div
        className={cn(
          "rounded-lg border border-primary/20 bg-primary/5 px-4 py-3 flex flex-wrap items-start gap-3",
          className,
        )}
      >
        <Percent className="h-5 w-5 text-primary shrink-0 mt-0.5" />
        <div className="flex-1 min-w-[200px] space-y-1">
          <p className="font-medium">
            Ваша скидка: <span className="text-primary">{discountPercent}%</span>
            <Badge className={cn("ml-2", tierMeta.color)} variant="secondary">
              {tierMeta.name}
            </Badge>
          </p>
          <p className="text-sm text-muted-foreground">{summary}</p>
        </div>
      </div>
    );
  }

  return (
    <Card className={className}>
      <CardHeader className="pb-2">
        <CardTitle className="text-lg flex items-center gap-2">
          <Percent className="h-5 w-5 text-primary" />
          Ваша скидка
        </CardTitle>
        <CardDescription>Программа лояльности</CardDescription>
      </CardHeader>
      <CardContent className="space-y-3">
        <div className="flex flex-wrap items-center gap-2">
          <span className="text-3xl font-bold text-primary">{discountPercent}%</span>
          <Badge className={tierMeta.color}>{tierMeta.name}</Badge>
        </div>
        <p className="text-sm text-muted-foreground leading-relaxed">{summary}</p>
        <p className="text-sm">
          Завершённые заказы: <strong>{formatPrice(totalSpent)}</strong>
        </p>
        {showProgress && (
          <div>
            <div className="flex justify-between text-xs text-muted-foreground mb-1">
              <span>До следующего уровня</span>
              <span>{Math.round(progressPct)}%</span>
            </div>
            <div className="h-2 rounded-full bg-muted">
              <div
                className="h-2 rounded-full bg-primary transition-all"
                style={{ width: `${progressPct}%` }}
              />
            </div>
          </div>
        )}
        <Link to="/client" className="text-sm text-primary hover:underline">
          Подробнее о программе лояльности →
        </Link>
      </CardContent>
    </Card>
  );
};
