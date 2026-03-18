import { useEffect } from "react";
import { Link } from "react-router-dom";
import { useQuery } from "@tanstack/react-query";
import { apiClient } from "@/api/axios";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Clock, Package, CheckCircle } from "lucide-react";
import { StatusBadge } from "@/components/shared/StatusBadge";

interface OrderSummary {
  id: string;
  order_number: string;
  status: string;
  final_price: number;
  created_at: string;
}

export const ClientDashboard = () => {
  const { data: ordersData, isLoading } = useQuery({
    queryKey: ["client-dashboard-orders"],
    queryFn: () => apiClient.get<{ items: OrderSummary[]; total: number }>("/orders?limit=5").then(r => r.data),
    retry: 2,
  });

  const orders = ordersData?.items || [];
  const newOrders = orders.filter((o) => o.status === "new" || o.status === "confirmed").length;
  const inProgress = orders.filter((o) => o.status === "in_progress" || o.status === "review").length;
  const completed = orders.filter((o) => o.status === "completed").length;

  console.log("Client Dashboard Data:", { ordersData, orders });

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="text-3xl font-bold">Личный кабинет</h1>
        <Link to="/client/orders/new">
          <Button>
            <span className="mr-2">+</span> Новый заказ
          </Button>
        </Link>
      </div>

      {/* KPI карточки */}
      <div className="grid gap-4 md:grid-cols-4">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-sm font-medium">Всего заказов</CardTitle>
            <Package className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{orders.length}</div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-sm font-medium">Новые</CardTitle>
            <Clock className="h-4 w-4 text-blue-500" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{newOrders}</div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-sm font-medium">В работе</CardTitle>
            <Package className="h-4 w-4 text-yellow-500" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{inProgress}</div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-sm font-medium">Завершено</CardTitle>
            <CheckCircle className="h-4 w-4 text-green-500" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{completed}</div>
          </CardContent>
        </Card>
      </div>

      {/* Последние заказы */}
      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <div>
              <CardTitle>Последние заказы</CardTitle>
            </div>
            <Link to="/client/orders">
              <Button variant="outline" size="sm">Все заказы</Button>
            </Link>
          </div>
        </CardHeader>
        <CardContent>
          {orders.length > 0 ? (
            <div className="space-y-4">
              {orders.map((order) => (
                <Link key={order.id} to={`/client/orders/${order.id}`}>
                  <div className="flex items-center justify-between p-4 border rounded-lg hover:bg-accent/50 transition-colors">
                    <div>
                      <p className="font-medium">{order.order_number}</p>
                      <p className="text-sm text-muted-foreground">{new Date(order.created_at).toLocaleDateString("ru-RU")}</p>
                    </div>
                    <div className="flex items-center gap-4">
                      <StatusBadge status={order.status} />
                      <span className="font-semibold">
                        {new Intl.NumberFormat("ru-RU", { style: "currency", currency: "BYN", minimumFractionDigits: 2 }).format(order.final_price)}
                      </span>
                    </div>
                  </div>
                </Link>
              ))}
            </div>
          ) : (
            <div className="text-center py-8">
              <p className="text-muted-foreground mb-4">У вас пока нет заказов</p>
              <Link to="/client/orders/new">
                <Button>Создать первый заказ</Button>
              </Link>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
};
