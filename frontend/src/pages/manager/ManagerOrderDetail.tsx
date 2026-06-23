import { useEffect, useState } from "react";
import { useParams, useNavigate } from "react-router-dom";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { toast } from "react-toastify";
import { getApiErrorMessage, mutationOnError } from "@/lib/apiError";
import { ApiErrorAlert } from "@/components/shared/ApiErrorAlert";

import {
  getOrder,
  updateOrderPricing,
  updateOrderStatus,
  assignTechnician,
} from "@/api/orders";
import { getTechnicians } from "@/api/manager";
import { TechnicianSelectOptions } from "@/components/manager/TechnicianSelectOptions";
import { ManagerConfirmOrderDialog } from "@/components/orders/ManagerConfirmOrderDialog";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { StatusBadge } from "@/components/shared/StatusBadge";
import { OrderStatusTracker } from "@/components/orders/OrderStatusTracker";
import { ArrowLeft, User } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { cn, formatDate, formatDateTime, getOrderItemServiceLabel } from "@/utils";
import {
  discountFromFinal,
  finalFromDiscount,
  formatOrderMoney,
  roundMoney,
} from "@/utils/orderPricing";

export const ManagerOrderDetail = () => {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const [confirmOpen, setConfirmOpen] = useState(false);
  const [finalPrice, setFinalPrice] = useState("");
  const [discountAmount, setDiscountAmount] = useState("");
  const [selectedTechnician, setSelectedTechnician] = useState<number | "">("");

  const { data: order, isLoading, isError, error } = useQuery({
    queryKey: ["order", id],
    queryFn: () => getOrder(id!),
    enabled: !!id,
    meta: { skipErrorToast: true },
  });

  const { data: technicians } = useQuery({
    queryKey: ["technicians-all"],
    queryFn: getTechnicians,
  });

  const subtotal = order ? Number(order.total_price) : 0;

  const handleFinalPriceChange = (value: string) => {
    setFinalPrice(value);
    const parsed = parseFloat(value);
    if (!Number.isNaN(parsed)) {
      setDiscountAmount(String(discountFromFinal(subtotal, parsed)));
    }
  };

  const handleDiscountChange = (value: string) => {
    setDiscountAmount(value);
    const parsed = parseFloat(value);
    if (!Number.isNaN(parsed)) {
      setFinalPrice(String(finalFromDiscount(subtotal, parsed)));
    }
  };

  const pricingMutation = useMutation({
    mutationFn: () => {
      if (!id) throw new Error("Нет ID заказа");
      const price = parseFloat(finalPrice);
      const discount = parseFloat(discountAmount);
      if (Number.isNaN(price) || price < 0) throw new Error("Некорректная итоговая сумма");
      if (Number.isNaN(discount) || discount < 0) throw new Error("Некорректная скидка");
      if (discount > subtotal) throw new Error("Скидка не может превышать сумму без скидки");
      return updateOrderPricing(id, {
        final_price: roundMoney(price),
        discount_amount: roundMoney(discount),
      });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["order", id] });
      queryClient.invalidateQueries({ queryKey: ["manager-orders"] });
      toast.success("Цена сохранена");
    },
    onError: (err: unknown) => {
      toast.error(getApiErrorMessage(err, "Ошибка сохранения цены"));
    },
  });

  const assignMutation = useMutation({
    mutationFn: (technicianId: number) => assignTechnician(id!, technicianId),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["order", id] });
      queryClient.invalidateQueries({ queryKey: ["manager-orders"] });
      queryClient.invalidateQueries({ queryKey: ["manager-new-orders"] });
      queryClient.invalidateQueries({ queryKey: ["technicians-all"] });
      toast.success("Исполнитель назначен, заказ в работе");
      setSelectedTechnician("");
    },
    onError: mutationOnError("Ошибка назначения"),
  });

  const startWorkMutation = useMutation({
    mutationFn: () =>
      updateOrderStatus(id!, {
        new_status: "in_progress",
        comment: "Взято в работу менеджером",
      }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["order", id] });
      queryClient.invalidateQueries({ queryKey: ["manager-orders"] });
      queryClient.invalidateQueries({ queryKey: ["technicians-all"] });
      toast.success("Заказ в работе");
    },
    onError: mutationOnError("Ошибка смены статуса"),
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
    onError: mutationOnError("Ошибка"),
  });

  useEffect(() => {
    if (order) {
      setFinalPrice(String(order.final_price));
      setDiscountAmount(String(order.discount_amount));
    }
  }, [order?.id, order?.final_price, order?.discount_amount]);

  if (isLoading) return <div className="p-8 text-center">Загрузка...</div>;
  if (isError) {
    return (
      <div className="p-8 max-w-lg mx-auto">
        <ApiErrorAlert error={error} fallback="Не удалось загрузить заказ" />
      </div>
    );
  }
  if (!order) return <div className="p-8 text-center">Заказ не найден</div>;

  const isNew = order.status === "new";
  const isConfirmed = order.status === "confirmed";
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
          {isConfirmed && order.technician_id && (
            <Button
              onClick={() => startWorkMutation.mutate()}
              disabled={startWorkMutation.isPending}
            >
              Взять в работу
            </Button>
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
              Дедлайн: {formatDate(order.deadline)}
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
                  {formatOrderMoney(subtotal)}
                </p>
              </div>
              <div>
                <Label>Итоговая сумма (BYN)</Label>
                <Input
                  type="number"
                  step="0.01"
                  min="0"
                  max={subtotal}
                  value={finalPrice}
                  onChange={(e) => handleFinalPriceChange(e.target.value)}
                />
              </div>
              <div>
                <Label>Скидка (BYN)</Label>
                <Input
                  type="number"
                  step="0.01"
                  min="0"
                  max={subtotal}
                  value={discountAmount}
                  onChange={(e) => handleDiscountChange(e.target.value)}
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

      {order.notes?.trim() && (
        <Card>
          <CardHeader>
            <CardTitle>Примечания клиента</CardTitle>
          </CardHeader>
          <CardContent>
            <p className="whitespace-pre-wrap text-sm">{order.notes}</p>
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
                  <TableCell>{getOrderItemServiceLabel(item)}</TableCell>
                  <TableCell>{item.quantity}</TableCell>
                  <TableCell>{formatOrderMoney(item.unit_price)}</TableCell>
                  <TableCell>{formatOrderMoney(item.total_price)}</TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </CardContent>
      </Card>

      {order.technician_name && (
        <Card>
          <CardHeader>
            <CardTitle>Исполнитель</CardTitle>
          </CardHeader>
          <CardContent>
            <p className="flex items-center gap-2 text-sm">
              <User className="h-4 w-4 text-muted-foreground" />
              {order.technician_name}
            </p>
          </CardContent>
        </Card>
      )}

      {!order.technician_id && (order.status === "new" || order.status === "confirmed") && (
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
              <TechnicianSelectOptions technicians={technicians} />
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
                  {formatDateTime(h.created_at)}
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
        technicians={technicians}
        onSuccess={() => {
          queryClient.invalidateQueries({ queryKey: ["order", id] });
          queryClient.invalidateQueries({ queryKey: ["manager-orders"] });
          queryClient.invalidateQueries({ queryKey: ["manager-new-orders"] });
          queryClient.invalidateQueries({ queryKey: ["manager-analytics"] });
          queryClient.invalidateQueries({ queryKey: ["technicians-all"] });
        }}
      />
    </div>
  );
};
