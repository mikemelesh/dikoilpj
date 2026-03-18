import { Link, useNavigate } from "react-router-dom";
import { useQuery } from "@tanstack/react-query";
import { useAuthStore } from "@/stores/authStore";
import { getTechnicianOrders, getMyMaterialRequests, getTechnicianStats } from "@/api/technicians";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { StatusBadge } from "@/components/shared/StatusBadge";
import { Clock, Package, TrendingUp, Star, AlertCircle, Plus } from "lucide-react";
import { BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer } from "recharts";

export const TechDashboard = () => {
  const { user } = useAuthStore();

  // Заказы в работе - используем правильный статус
  const { data: ordersData, isLoading: ordersLoading } = useQuery({
    queryKey: ["tech-orders-dashboard"],
    queryFn: () => getTechnicianOrders({ status: ["in_progress", "confirmed", "review", "new"], limit: 50 }),
    retry: 2,
  });

  // Заявки на материалы
  const { data: materialRequestsData } = useQuery({
    queryKey: ["tech-material-requests"],
    queryFn: getMyMaterialRequests,
    retry: 2,
  });

  const materialRequests = materialRequestsData?.items || [];
  const pendingRequests = materialRequests.filter((r) => r.status === "pending");

  // Статистика - с обработкой ошибок
  const { data: stats, isLoading: statsLoading, error: statsError } = useQuery({
    queryKey: ["tech-stats"],
    queryFn: getTechnicianStats,
    retry: 2,
  });

  const orders = ordersData?.items || [];

  console.log("Tech Dashboard Debug:", {
    user,
    stats,
    statsError,
    orders,
    ordersLoading,
    statsLoading
  });

  // Заказы с дедлайном сегодня или просроченные
  const today = new Date();
  today.setHours(23, 59, 59, 999);
  const urgentOrders = orders.filter((o) => {
    if (!o.deadline) return false;
    const deadline = new Date(o.deadline);
    return deadline <= today;
  }).sort((a, b) => {
    const priorityOrder = { critical: 0, urgent: 1, normal: 2 };
    return priorityOrder[a.priority] - priorityOrder[b.priority];
  });

  return (
    <div className="space-y-6">
      <h1 className="text-3xl font-bold">Панель техника</h1>

      {/* Статистика */}
      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-sm font-medium">Выполнено за месяц</CardTitle>
            <Package className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{stats?.completed_orders || 0}</div>
            <p className="text-xs text-muted-foreground">Заказов выполнено</p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-sm font-medium">Рейтинг</CardTitle>
            <Star className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{stats?.rating?.toFixed(1) || "0.0"}</div>
            <div className="flex items-center gap-1">
              {[...Array(5)].map((_, i) => (
                <Star
                  key={i}
                  className={`h-3 w-3 ${i < Math.round(stats?.rating || 0) ? "fill-yellow-400 text-yellow-400" : "text-muted-foreground"}`}
                />
              ))}
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-sm font-medium">В работе</CardTitle>
            <Clock className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{stats?.in_progress_orders || 0}</div>
            <p className="text-xs text-muted-foreground">Незакрытые заказы</p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-sm font-medium">Заявки</CardTitle>
            <AlertCircle className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{pendingRequests.length}</div>
            <p className="text-xs text-muted-foreground">Ожидают подтверждения</p>
          </CardContent>
        </Card>
      </div>

      {/* Задачи на сегодня */}
      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <div>
              <CardTitle>Задачи на сегодня</CardTitle>
              <CardDescription>Заказы с дедлайном сегодня или просроченные</CardDescription>
            </div>
            <Link to="/technician/orders">
              <Button variant="outline" size="sm">Все заказы</Button>
            </Link>
          </div>
        </CardHeader>
        <CardContent>
          {urgentOrders.length === 0 ? (
            <p className="text-center text-muted-foreground py-8">Нет срочных задач</p>
          ) : (
            <div className="space-y-4">
              {urgentOrders.map((order) => (
                <Link key={order.id} to={`/technician/orders/${order.id}`}>
                  <Card className="cursor-pointer transition-shadow hover:shadow-md">
                    <CardContent className="py-4">
                      <div className="flex flex-wrap items-center justify-between gap-4">
                        <div className="space-y-1">
                          <p className="font-medium">{order.order_number}</p>
                          <div className="flex items-center gap-2 text-sm">
                            <Clock className={`h-3 w-3 ${new Date(order.deadline!) < new Date() ? "text-red-500" : ""}`} />
                            <span className={new Date(order.deadline!) < new Date() ? "text-red-500 font-medium" : "text-muted-foreground"}>
                              {new Date(order.deadline!).toLocaleDateString("ru-RU")}
                              {new Date(order.deadline!) < new Date() && " (просрочено)"}
                            </span>
                          </div>
                        </div>
                        <div className="flex items-center gap-4">
                          <Badge variant={order.priority === "critical" ? "destructive" : order.priority === "urgent" ? "default" : "secondary"}>
                            {order.priority === "critical" ? "Критичный" : order.priority === "urgent" ? "Срочный" : "Обычный"}
                          </Badge>
                          <StatusBadge status={order.status} />
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

      {/* Заявки на материалы */}
      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <div>
              <CardTitle>Заявки на материалы</CardTitle>
              <CardDescription>Ожидают подтверждения</CardDescription>
            </div>
            <Link to="/technician/materials">
              <Button>
                <Plus className="mr-2 h-4 w-4" /> Новая заявка
              </Button>
            </Link>
          </div>
        </CardHeader>
        <CardContent>
          {pendingRequests.length === 0 ? (
            <p className="text-center text-muted-foreground py-8">Нет ожидающих заявок</p>
          ) : (
            <div className="space-y-2">
              {pendingRequests.map((req) => (
                <div key={req.id} className="flex items-center justify-between p-3 border rounded-lg">
                  <div>
                    <p className="font-medium">{req.material?.name || `Материал #${req.material_id}`}</p>
                    <p className="text-sm text-muted-foreground">
                      {req.quantity_requested} {req.material?.unit || "шт"} • {new Date(req.created_at).toLocaleDateString("ru-RU")}
                    </p>
                  </div>
                  <StatusBadge status={req.status} />
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
};
