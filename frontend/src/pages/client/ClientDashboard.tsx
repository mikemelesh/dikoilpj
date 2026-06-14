import { Link } from "react-router-dom";
import { useQuery } from "@tanstack/react-query";

import { getOrders } from "@/api/orders";
import { useAuthStore } from "@/stores/authStore";
import { ClientDiscountInfo } from "@/components/client/ClientDiscountInfo";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { StatusBadge } from "@/components/shared/StatusBadge";
import { ExportButton } from "@/components/shared/ExportButton";
import { Package, Plus, Clock, ChevronRight } from "lucide-react";
import type { Order } from "@/types";
import { formatDate, formatPrice } from "@/utils";

export const ClientDashboard = () => {
  const { user } = useAuthStore();

  const { data: ordersData } = useQuery({
    queryKey: ["client-orders", { status: "new,confirmed,in_progress", limit: 5 }],
    queryFn: () => getOrders({ status: "new,confirmed,in_progress", limit: 5 }),
  });

  const orders = ordersData?.items || [];

  const exportFilters = {
    status: ["new", "confirmed", "in_progress"],
    limit: 5,
  };

  return (
    <div className="space-y-8">
      <div>
        <h1 className="text-2xl font-bold">
          Добро пожаловать{user?.first_name ? `, ${user.first_name}` : ""}!
        </h1>
        <p className="text-muted-foreground mt-1">Личный кабинет клиента</p>
      </div>

      <div className="grid gap-6 md:grid-cols-2">
        <ClientDiscountInfo showProgress />

        <Card className="flex flex-col justify-center">
          <CardContent className="pt-6">
            <Link to="/client/orders/new">
              <Button size="lg" className="w-full">
                <Plus className="mr-2 h-5 w-5" />
                Новый заказ
              </Button>
            </Link>
            <ExportButton filters={exportFilters} title="Активные заказы" className="w-full mt-2" />
            <Link to="/client/orders">
              <Button variant="outline" className="w-full mt-2">
                Все заказы
              </Button>
            </Link>
          </CardContent>
        </Card>
      </div>

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
              {orders.map((order: Order) => (
                <Link key={order.id} to={`/client/orders/${order.id}`}>
                  <Card className="transition-shadow hover:shadow-md cursor-pointer">
                    <CardContent className="py-4">
                      <div className="flex flex-wrap items-center justify-between gap-4">
                        <div className="space-y-1">
                          <p className="font-medium">{order.order_number}</p>
                          <div className="flex items-center gap-2 text-sm text-muted-foreground">
                            <Clock className="h-3 w-3" />
                            {order.deadline
                              ? `Дедлайн: ${formatDate(order.deadline)}`
                              : "Без дедлайна"}
                          </div>
                        </div>
                        <div className="flex items-center gap-4">
                          <StatusBadge status={order.status} />
                          <span className="font-semibold">
                            {formatPrice(Number(order.final_price))}
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
