import { useEffect, useState } from "react";
import { useParams, useNavigate } from "react-router-dom";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { toast } from "react-toastify";

import {
  getOrder,
  updateOrderPricing,
  updateOrderStatus,
  assignTechnician,
} from "@/api/orders";
import { getTechnicians } from "@/api/manager";
import { ManagerConfirmOrderDialog } from "@/components/orders/ManagerConfirmOrderDialog";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { StatusBadge } from "@/components/shared/StatusBadge";
import { OrderStatusTracker } from "@/components/orders/OrderStatusTracker";
import { ArrowLeft } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { cn } from "@/utils";

export const ManagerOrderDetail = () => {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const [confirmOpen, setConfirmOpen] = useState(false);
  const [finalPrice, setFinalPrice] = useState("");
  const [discountAmount, setDiscountAmount] = useState("");
  const [selectedTechnician, setSelectedTechnician] = useState<number | "">("");

  const { data: order, isLoading } = useQuery({
    queryKey: ["order", id],
    queryFn: () => getOrder(id!),
    enabled: !!id,
  });

  const { data: technicians } = useQuery({
    queryKey: ["technicians-all"],
    queryFn: getTechnicians,
  });

  const pricingMutation = useMutation({
    mutationFn: () => {
      if (!id) throw new Error("Нет ID заказа");
      const price = parseFloat(finalPrice);
      const discount = parseFloat(discountAmount);
      if (Number.isNaN(price)) throw new Error("Некорректная сумма");
      return updateOrderPricing(id, {
        final_price: price,
        discount_amount: Number.isNaN(discount) ? undefined : discount,
      });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["order", id] });
      queryClient.invalidateQueries({ queryKey: ["manager-orders"] });
      toast.success("Цена сохранена");
    },
    onError: () => toast.error("Ошибка сохранения цены"),
  });

  const assignMutation = useMutation({
    mutationFn: (technicianId: number) => assignTechnician(id!, technicianId),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["order", id] });
      toast.success("Техник назначен");
    },
    onError: () => toast.error("Ошибка назначения"),
  });

  const completeMutation = useMutation({
    mutationFn: () =>
      updateOrderStatus(id!, {
        new_status: "completed",
        comment: "Завершено менеджером",
      }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["order", id] });
      queryClient.invalidateQueries({ queryKey: ["manager-orders"] });
      toast.success("Заказ завершён");
    },
    onError: () => toast.error("Ошибка"),
  });

  useEffect(() => {
    if (order) {
      setFinalPrice(String(order.final_price));
      setDiscountAmount(String(order.discount_amount));
    }
  }, [order?.id, order?.final_price, order?.discount_amount]);

  if (isLoading) return <div className="p-8 text-center">Загрузка...</div>;
  if (!order) return <div className="p-8 text-center">Заказ не найден</div>;

  const isNew = order.status === "new";
  const isReview = order.status === "review";
  const isOverdue =
    order.deadline && new Date(order.deadline) < new Date() && !["completed", "cancelled", "archived"].includes(order.status);

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-4">
        <div className="flex items-center gap-4">
          <Button variant="ghost" size="icon" onClick={() => navigate("/manager/orders")}>
            <ArrowLeft className="h-5 w-5" />
          </Button>
          <div>
            <h1 className="text-2xl font-bold">{order.order_number}</h1>
            <div className="mt-1 flex flex-wrap items-center gap-2">
              <StatusBadge status={order.status} />
              <Badge variant={order.priority === "critical" ? "destructive" : "secondary"}>
                {order.priority === "critical"
                  ? "Критичный"
                  : order.priority === "urgent"
                    ? "Срочный"
                    : "Обычный"}
              </Badge>
              {isOverdue && <Badge variant="destructive">Просрочен дедлайн</Badge>}
            </div>
          </div>
        </div>
        <div className="flex flex-wrap gap-2">
          {isNew && (
            <Button onClick={() => setConfirmOpen(true)}>Подтвердить заказ</Button>
          )}
          {isReview && (
            <Button onClick={() => completeMutation.mutate()} disabled={completeMutation.isPending}>
              Завершить
            </Button>
          )}
        </div>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Статус</CardTitle>
        </CardHeader>
        <CardContent>
          <OrderStatusTracker currentStatus={order.status} />
          {order.deadline && (
            <p
              className={cn(
                "mt-3 text-sm",
                isOverdue ? "font-medium text-destructive" : "text-muted-foreground"
              )}
            >
              Дедлайн: {new Date(order.deadline).toLocaleDateString("ru-RU")}
            </p>
          )}
        </CardContent>
      </Card>

      {isNew && (
        <Card>
          <CardHeader>
            <CardTitle>Цена до подтверждения</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="grid gap-4 sm:grid-cols-2">
              <div>
                <Label>Сумма без скидки</Label>
                <p className="text-lg font-medium">
                  {formatMoney(order.total_price)}
                </p>
              </div>
              <div>
                <Label>Итоговая сумма (BYN)</Label>
                <Input
                  type="number"
                  step="0.01"
                  value={finalPrice}
                  onChange={(e) => setFinalPrice(e.target.value)}
                />
              </div>
              <div>
                <Label>Скидка (BYN)</Label>
                <Input
                  type="number"
                  step="0.01"
                  value={discountAmount}
                  onChange={(e) => setDiscountAmount(e.target.value)}
                />
              </div>
            </div>
            <Button
              variant="outline"
              onClick={() => pricingMutation.mutate()}
              disabled={pricingMutation.isPending}
            >
              Сохранить цену
            </Button>
          </CardContent>
        </Card>
      )}

      <Card>
        <CardHeader>
          <CardTitle>Позиции заказа</CardTitle>
        </CardHeader>
        <CardContent className="p-0">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Услуга</TableHead>
                <TableHead>Кол-во</TableHead>
                <TableHead>Цена</TableHead>
                <TableHead>Сумма</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {order.items?.map((item) => (
                <TableRow key={item.id}>
                  <TableCell>{item.service_name ?? `Услуга #${item.service_id}`}</TableCell>
                  <TableCell>{item.quantity}</TableCell>
                  <TableCell>{formatMoney(item.unit_price)}</TableCell>
                  <TableCell>{formatMoney(item.total_price)}</TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </CardContent>
      </Card>

      {!order.technician_id && order.status !== "cancelled" && (
        <Card>
          <CardHeader>
            <CardTitle>Назначить техника</CardTitle>
          </CardHeader>
          <CardContent className="flex flex-wrap gap-2">
            <select
              value={selectedTechnician}
              onChange={(e) =>
                setSelectedTechnician(e.target.value ? Number(e.target.value) : "")
              }
              className="flex h-10 min-w-[240px] rounded-md border border-input bg-background px-3 py-2 text-sm"
            >
              <option value="">Выберите техника</option>
              {technicians
                ?.filter((t) => t.is_available)
                .map((t) => (
                  <option key={t.id} value={t.id}>
                    {t.first_name} {t.last_name} — {t.specialization || "Универсал"}
                  </option>
                ))}
            </select>
            <Button
              disabled={!selectedTechnician || assignMutation.isPending}
              onClick={() => assignMutation.mutate(Number(selectedTechnician))}
            >
              Назначить
            </Button>
          </CardContent>
        </Card>
      )}

      {order.status_history && order.status_history.length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle>История и сообщения</CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            {order.status_history.map((h) => (
              <div key={h.id} className="rounded-lg border p-3 text-sm">
                <p className="font-medium">
                  {h.old_status} → {h.new_status}
                </p>
                {h.comment && <p className="mt-1 text-muted-foreground">{h.comment}</p>}
                <p className="mt-1 text-xs text-muted-foreground">
                  {new Date(h.created_at).toLocaleString("ru-RU")}
                </p>
              </div>
            ))}
          </CardContent>
        </Card>
      )}

      <ManagerConfirmOrderDialog
        order={order}
        open={confirmOpen}
        onClose={() => setConfirmOpen(false)}
        onSuccess={() => {
          queryClient.invalidateQueries({ queryKey: ["order", id] });
          queryClient.invalidateQueries({ queryKey: ["manager-orders"] });
        }}
      />
    </div>
  );
};

function formatMoney(value: number | string) {
  return new Intl.NumberFormat("ru-RU", {
    style: "currency",
    currency: "BYN",
    minimumFractionDigits: 2,
  }).format(Number(value));
}
