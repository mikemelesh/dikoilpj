import { Link } from "react-router-dom";
import { useQuery } from "@tanstack/react-query";

import { getOrders } from "@/api/orders";
import { authStore } from "@/stores/authStore";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { StatusBadge } from "@/components/shared/StatusBadge";
import { Package, Plus, Clock, ChevronRight } from "lucide-react";
import type { Order } from "@/types";

// =============================================================================
// Хелперы для уровней лояльности
// =============================================================================

const LOYALTY_TIERS = {
  bronze: { name: "Bronze", minOrders: 0, color: "bg-amber-700" },
  silver: { name: "Silver", minOrders: 5, color: "bg-gray-400" },
  gold: { name: "Gold", minOrders: 10, color: "bg-yellow-500" },
  platinum: { name: "Platinum", minOrders: 20, color: "bg-blue-400" },
};

const getLoyaltyProgress = (totalOrders: number, tier: string) => {
  const currentTier = LOYALTY_TIERS[tier as keyof typeof LOYALTY_TIERS];
  const nextTier = Object.entries(LOYALTY_TIERS).find(([, t]) => t.minOrders > totalOrders);
  
  if (!nextTier) return { next: null, progress: 100 };
  
  const prevMin = currentTier.minOrders;
  const nextMin = nextTier[1].minOrders;
  const progress = ((totalOrders - prevMin) / (nextMin - prevMin)) * 100;
  
  return { next: nextTier[0], progress: Math.min(100, progress) };
};

// =============================================================================
// Компонент ClientDashboard
// =============================================================================

export const ClientDashboard = () => {
  const { user } = authStore();
  const clientProfile = user?.client_profile;

  const { data: ordersData } = useQuery({
    queryKey: ["client-orders", { status: "new,confirmed,in_progress", limit: 5 }],
    queryFn: () => getOrders({ status: "new,confirmed,in_progress", limit: 5 }),
  });

  const orders = ordersData?.items || [];
  const totalOrders = clientProfile?.total_orders || 0;
  const loyaltyTier = clientProfile?.loyalty_tier || "bronze";
  const discountPercent = clientProfile?.discount_percent || 0;

  const { next, progress } = getLoyaltyProgress(totalOrders, loyaltyTier);
  const nextTier = next ? LOYALTY_TIERS[next as keyof typeof LOYALTY_TIERS] : null;

  return (
    <div className="space-y-8">
      {/* Приветствие + лояльность */}
      <div className="grid gap-6 md:grid-cols-2">
        <Card>
          <CardHeader>
            <CardTitle>Добро пожаловать{user?.first_name ? `, ${user.first_name}` : ""}!</CardTitle>
            <CardDescription>Управление вашими заказами</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="flex items-center gap-4">
              <Badge className={LOYALTY_TIERS[loyaltyTier as keyof typeof LOYALTY_TIERS]?.color}>
                {LOYALTY_TIERS[loyaltyTier as keyof typeof LOYALTY_TIERS]?.name}
              </Badge>
              <span className="text-sm text-muted-foreground">
                Скидка: {discountPercent}%
              </span>
            </div>
            <div className="mt-4">
              <div className="flex justify-between text-sm mb-1">
                <span>Прогресс до {nextTier?.name || "максимума"}</span>
                <span>{Math.round(progress)}%</span>
              </div>
              <div className="h-2 rounded-full bg-muted">
                <div
                  className="h-2 rounded-full bg-primary transition-all"
                  style={{ width: `${progress}%` }}
                />
              </div>
              <p className="mt-2 text-xs text-muted-foreground">
                Заказов: {totalOrders} {nextTier && `(следующий уровень: ${nextTier.minOrders})`}
              </p>
            </div>
          </CardContent>
        </Card>

        <Card className="flex flex-col justify-center">
          <CardContent className="pt-6">
            <Link to="/client/orders/new">
              <Button size="lg" className="w-full">
                <Plus className="mr-2 h-5 w-5" />
                Новый заказ
              </Button>
            </Link>
            <Link to="/client/orders">
              <Button variant="outline" className="w-full mt-2">
                Все заказы
              </Button>
            </Link>
          </CardContent>
        </Card>
      </div>

      {/* Активные заказы */}
      <Card>
        <CardHeader className="flex flex-row items-center justify-between">
          <div>
            <CardTitle>Активные заказы</CardTitle>
            <CardDescription>Последние 5 заказов в работе</CardDescription>
          </div>
          <Link to="/client/orders">
            <Button variant="ghost" size="sm">
              Все заказы
              <ChevronRight className="ml-1 h-4 w-4" />
            </Button>
          </Link>
        </CardHeader>
        <CardContent>
          {orders.length === 0 ? (
            <div className="text-center py-8 text-muted-foreground">
              <Package className="mx-auto h-12 w-12 mb-4 opacity-50" />
              <p>У вас пока нет активных заказов</p>
              <Link to="/client/orders/new">
                <Button variant="link">Создать первый заказ</Button>
              </Link>
            </div>
          ) : (
            <div className="space-y-4">
              {orders.map((order) => (
                <Link key={order.id} to={`/client/orders/${order.id}`}>
                  <Card className="transition-shadow hover:shadow-md cursor-pointer">
                    <CardContent className="py-4">
                      <div className="flex flex-wrap items-center justify-between gap-4">
                        <div className="space-y-1">
                          <p className="font-medium">{order.order_number}</p>
                          <div className="flex items-center gap-2 text-sm text-muted-foreground">
                            <Clock className="h-3 w-3" />
                            {order.deadline
                              ? `Дедлайн: ${new Date(order.deadline).toLocaleDateString("ru-RU")}`
                              : "Без дедлайна"}
                          </div>
                        </div>
                        <div className="flex items-center gap-4">
                          <StatusBadge status={order.status} />
                          <span className="font-semibold">
                            {new Intl.NumberFormat("ru-RU", {
                              style: "currency",
                              currency: "BYN",
                              minimumFractionDigits: 2,
                            }).format(Number(order.final_price))}
                          </span>
                        </div>
                      </div>
                    </CardContent>
                  </Card>
                </Link>
              ))}
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
};
