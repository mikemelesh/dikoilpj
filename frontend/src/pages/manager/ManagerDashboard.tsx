import { useState } from "react";
import { Link } from "react-router-dom";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { toast } from "react-toastify";
import { mutationOnError } from "@/lib/apiError";

import { getOrderAnalytics, assignTechnician, getMaterialRequests, approveMaterialRequest, getTechnicians } from "@/api/manager";
import { TechnicianSelectOptions } from "@/components/manager/TechnicianSelectOptions";
import { getOrders, updateOrderStatus } from "@/api/orders";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { StatusBadge } from "@/components/shared/StatusBadge";
import { Package, Clock, AlertCircle, TrendingUp, Check, User, X } from "lucide-react";
import type { Order } from "@/types";
import { formatDate, getMaterialRequestLabel } from "@/utils";

export const ManagerDashboard = () => {
  const queryClient = useQueryClient();
  const [selectedTechnicians, setSelectedTechnicians] = useState<Record<string, string>>({});
  const today = new Date();
  const monthStart = new Date(today.getFullYear(), today.getMonth(), 1).toISOString().split("T")[0];

  // KPI данные - получаем все заказы за месяц
  const { data: analytics, isLoading: analyticsLoading } = useQuery({
    queryKey: ["manager-analytics", monthStart],
    queryFn: () => getOrderAnalytics({ date_from: monthStart }),
    retry: 2,
  });

  // Новые заказы (только новые, которые ожидают подтверждения)
  const { data: newOrdersData } = useQuery({
    queryKey: ["manager-new-orders"],
    queryFn: () => getOrders({ status: ["new"], limit: 10 }),
  });

  // Заявки на материалы (pending)
  const { data: materialRequests } = useQuery({
    queryKey: ["manager-pending-requests"],
    queryFn: () => getMaterialRequests({ status: "pending" }),
  });

  // Техники для назначения
  const { data: technicians } = useQuery({
    queryKey: ["technicians-list"],
    queryFn: getTechnicians,
  });

  const invalidateOrderQueries = () => {
    queryClient.invalidateQueries({ queryKey: ["manager-new-orders"] });
    queryClient.invalidateQueries({ queryKey: ["manager-orders"] });
    queryClient.invalidateQueries({ queryKey: ["manager-analytics"] });
    queryClient.invalidateQueries({ queryKey: ["technicians-list"] });
    queryClient.invalidateQueries({ queryKey: ["technicians-all"] });
  };

  const approveMutation = useMutation({
    mutationFn: async ({
      orderId,
      technicianId,
    }: {
      orderId: string;
      technicianId?: number;
    }) => {
      if (technicianId) {
        return assignTechnician(orderId, technicianId);
      }
      return updateOrderStatus(orderId, {
        new_status: "confirmed",
        comment: "Подтверждено менеджером",
      });
    },
    onSuccess: (_data, variables) => {
      invalidateOrderQueries();
      setSelectedTechnicians((prev) => {
        const next = { ...prev };
        delete next[variables.orderId];
        return next;
      });
      toast.success(
        variables.technicianId
          ? "Заказ передан в работу"
          : "Заказ подтверждён"
      );
    },
    onError: mutationOnError("Ошибка подтверждения заказа"),
  });

  const approveRequestMutation = useMutation({
    mutationFn: ({ id, status }: { id: number; status: "approved" | "rejected" }) =>
      approveMaterialRequest(id, { status, comment: status === "approved" ? "Одобрено" : "Отклонено" }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["manager-pending-requests"] });
      toast.success("Заявка обработана");
    },
    onError: mutationOnError("Ошибка обработки"),
  });

  const newOrders = newOrdersData?.items || [];
  const pendingRequests = materialRequests?.items || [];

  const revenue = analytics?.by_status ?
    new Intl.NumberFormat("ru-RU", { style: "currency", currency: "BYN", minimumFractionDigits: 2 }).format(
      Object.values(analytics.by_status).reduce((a, b) => a + b, 0) * 1000 // заглушка
    ) : "—";

  return (
    <div className="space-y-6">
      <h1 className="text-3xl font-bold">Панель менеджера</h1>

      {/* KPI карточки */}
      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-sm font-medium">Новые заказы</CardTitle>
            <Package className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{analytics?.by_status?.new || 0}</div>
            <p className="text-xs text-muted-foreground">Ожидают подтверждения</p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-sm font-medium">В работе</CardTitle>
            <Clock className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{analytics?.by_status?.in_progress || 0}</div>
            <p className="text-xs text-muted-foreground">Активных заказов</p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-sm font-medium">Просроченные</CardTitle>
            <AlertCircle className="h-4 w-4 text-destructive" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-destructive">
              {newOrders.filter((o) => o.deadline && new Date(o.deadline) < new Date()).length}
            </div>
            <p className="text-xs text-muted-foreground">Требуют внимания</p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-sm font-medium">Выручка месяца</CardTitle>
            <TrendingUp className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{revenue}</div>
            <p className="text-xs text-muted-foreground">За текущий месяц</p>
          </CardContent>
        </Card>
      </div>

      {/* Новые заказы */}
      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <div>
              <CardTitle>Новые заказы</CardTitle>
              <CardDescription>Требуют подтверждения и назначения техника</CardDescription>
            </div>
            <Link to="/manager/orders">
              <Button variant="outline" size="sm">Все заказы</Button>
            </Link>
          </div>
        </CardHeader>
        <CardContent>
          {newOrders.length === 0 ? (
            <p className="text-center text-muted-foreground py-8">Нет новых заказов</p>
          ) : (
            <div className="space-y-4">
              {newOrders.map((order) => {
                const selectedTech = selectedTechnicians[order.id] ?? "";
                const resolvedTechId =
                  order.technician_id ??
                  (selectedTech ? Number(selectedTech) : undefined);

                return (
                <div key={order.id} className="flex flex-wrap items-center justify-between gap-4 p-4 border rounded-lg">
                  <div className="space-y-1">
                    <div className="flex flex-wrap items-center gap-2">
                      <p className="font-medium">{order.order_number}</p>
                      <StatusBadge status={order.status} />
                    </div>
                    <p className="text-sm text-muted-foreground">
                      {new Intl.NumberFormat("ru-RU", { style: "currency", currency: "BYN", minimumFractionDigits: 2 }).format(Number(order.final_price))}
                      {order.deadline && (
                        <span className={new Date(order.deadline) < new Date() ? " text-red-500 font-medium" : ""}>
                          {" • "}Дедлайн: {formatDate(order.deadline)}
                        </span>
                      )}
                    </p>
                    {order.technician_name ? (
                      <p className="flex items-center gap-1 text-sm text-primary">
                        <User className="h-3 w-3" />
                        Исполнитель: {order.technician_name}
                      </p>
                    ) : (
                      <select
                        value={selectedTech}
                        onChange={(e) =>
                          setSelectedTechnicians((prev) => ({
                            ...prev,
                            [order.id]: e.target.value,
                          }))
                        }
                        disabled={approveMutation.isPending}
                        className="mt-1 flex h-9 w-full max-w-sm rounded-md border border-input bg-background px-3 text-sm"
                      >
                        <option value="">Выберите исполнителя</option>
                        <TechnicianSelectOptions technicians={technicians} />
                      </select>
                    )}
                  </div>
                  <div className="flex items-center gap-2">
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() =>
                        approveMutation.mutate({
                          orderId: order.id,
                          technicianId: resolvedTechId,
                        })
                      }
                      disabled={approveMutation.isPending}
                    >
                      <Check className="mr-1 h-4 w-4" />
                      {resolvedTechId ? "Подтвердить и в работу" : "Подтвердить"}
                    </Button>
                    <Link to={`/manager/orders/${order.id}`}>
                      <Button variant="ghost" size="sm">Детали</Button>
                    </Link>
                  </div>
                </div>
              );
              })}
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
            <Link to="/manager/materials">
              <Button variant="outline" size="sm">Все заявки</Button>
            </Link>
          </div>
        </CardHeader>
        <CardContent>
          {pendingRequests.length === 0 ? (
            <p className="text-center text-muted-foreground py-8">Нет незакрытых заявок</p>
          ) : (
            <div className="space-y-4">
              {pendingRequests.map((req) => (
                <div key={req.id} className="flex flex-wrap items-center justify-between gap-4 p-4 border rounded-lg">
                  <div>
                    <p className="font-medium">{getMaterialRequestLabel(req)}</p>
                    <p className="text-sm text-muted-foreground">
                      {req.quantity_requested} {req.material?.unit || "шт"} • {req.technician_name || `${req.technician?.user?.first_name ?? ""} ${req.technician?.user?.last_name ?? ""}`.trim() || "Техник"}
                    </p>
                  </div>
                  <div className="flex items-center gap-2">
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => approveRequestMutation.mutate({ id: req.id, status: "approved" })}
                    >
                      <Check className="mr-1 h-4 w-4" /> Одобрить
                    </Button>
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => approveRequestMutation.mutate({ id: req.id, status: "rejected" })}
                    >
                      <X className="mr-1 h-4 w-4" /> Отклонить
                    </Button>
                  </div>
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
};
