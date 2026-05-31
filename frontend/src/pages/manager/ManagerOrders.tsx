import { useState } from "react";
import { Link } from "react-router-dom";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { toast } from "react-toastify";

import { getOrders, assignTechnician, updateOrderStatus } from "@/api/orders";
import { getTechnicians } from "@/api/manager";
import { SearchAndFilter, type FilterConfig } from "@/components/shared/SearchAndFilter";
import { Pagination } from "@/components/shared/Pagination";
import { StatusBadge } from "@/components/shared/StatusBadge";
import { ExportButton } from "@/components/shared/ExportButton";
import { ManagerConfirmOrderDialog } from "@/components/orders/ManagerConfirmOrderDialog";
import { toExportFilters } from "@/lib/exportFilters";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Clock, User, Check, Plus } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { cn } from "@/utils";
import type { Order } from "@/types";

function isOrderUrgent(order: Order & { deadline?: string | null }) {
  const overdue =
    order.deadline &&
    new Date(order.deadline) < new Date() &&
    !["completed", "cancelled", "archived"].includes(order.status);
  return order.priority === "critical" || order.priority === "urgent" || !!overdue;
}

export const ManagerOrders = () => {
  const queryClient = useQueryClient();
  const [page, setPage] = useState(1);
  const [filters, setFilters] = useState<Record<string, string>>({});
  const [search, setSearch] = useState("");
  const [clientFilter, setClientFilter] = useState("");

  // Sorting (UI-side) for card list since orders UI is card-based (not a table)
  const [sortBy, setSortBy] = useState<"created_at" | "deadline" | "order_number" | "final_price" | "priority">("created_at");
  const [sortDir, setSortDir] = useState<"asc" | "desc">("desc");

  const toggleSort = (next: typeof sortBy) => {
    if (next === sortBy) {
      setSortDir((prev) => (prev === "asc" ? "desc" : "asc"));
    } else {
      setSortBy(next);
      setSortDir("asc");
    }
  };
  const [assignModal, setAssignModal] = useState<{ orderId: string; open: boolean }>({
    orderId: "",
    open: false,
  });
  const [confirmOrder, setConfirmOrder] = useState<Order | null>(null);
  const [selectedTechnician, setSelectedTechnician] = useState<number | "">("");
  const limit = 20;

  const { data, isLoading } = useQuery({
    queryKey: ["manager-orders", page, filters, search, clientFilter],
    queryFn: () =>
      getOrders({
        page,
        limit,
        status: filters.status ? [filters.status] : undefined,
        priority: filters.priority,
        date_from: filters.date_from,
        date_to: filters.date_to,
        client_id: clientFilter ? Number(clientFilter) : undefined,
        search: search.trim() || undefined,
      }),
  });

  const { data: technicians } = useQuery({
    queryKey: ["technicians-all"],
    queryFn: getTechnicians,
  });

  const assignMutation = useMutation({
    mutationFn: ({ orderId, technicianId }: { orderId: string; technicianId: number }) =>
      assignTechnician(orderId, technicianId),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["manager-orders"] });
      toast.success("Техник назначен");
      setAssignModal({ orderId: "", open: false });
      setSelectedTechnician("");
    },
    onError: () => toast.error("Ошибка назначения"),
  });

  const statusMutation = useMutation({
    mutationFn: ({ orderId, status }: { orderId: string; status: string }) =>
      updateOrderStatus(orderId, {
        new_status: status as Order["status"],
        comment: "Изменено менеджером",
      }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["manager-orders"] });
      toast.success("Статус обновлён");
    },
    onError: () => toast.error("Ошибка обновления"),
  });

  const filterConfigs: FilterConfig[] = [
    {
      key: "status",
      label: "Статус",
      type: "select",
      options: [
        { value: "new", label: "Новый" },
        { value: "confirmed", label: "Подтверждён" },
        { value: "in_progress", label: "В работе" },
        { value: "review", label: "На проверке" },
        { value: "completed", label: "Завершён" },
        { value: "cancelled", label: "Отменён" },
      ],
    },
    {
      key: "priority",
      label: "Приоритет",
      type: "select",
      options: [
        { value: "critical", label: "Критичный" },
        { value: "urgent", label: "Срочный" },
        { value: "normal", label: "Обычный" },
      ],
    },
    { key: "date_from", label: "Дата от", type: "date" },
    { key: "date_to", label: "Дата до", type: "date" },
  ];

  const handleAssign = () => {
    if (selectedTechnician && assignModal.orderId) {
      assignMutation.mutate({
        orderId: assignModal.orderId,
        technicianId: Number(selectedTechnician),
      });
    }
  };

  const orders = (data?.items ?? []) as Array<
    Order & {
      client_name?: string | null;
      technician_name?: string | null;
      created_at?: string | null;
      deadline?: string | null;
      final_price?: number | string | null;
      priority?: string | null;
    }
  >;

  const sortedOrders = (() => {
    const items = [...orders];
    const dir = sortDir === "asc" ? 1 : -1;

    const toDateTs = (v: any) => {
      if (!v) return null;
      const t = new Date(v).getTime();
      return Number.isFinite(t) ? t : null;
    };

    const toNum = (v: any) => {
      const n = typeof v === "number" ? v : Number(v);
      return Number.isFinite(n) ? n : null;
    };

    const toStr = (v: any) => (v === null || v === undefined ? "" : String(v));

    const priorityRank: Record<string, number> = { critical: 0, urgent: 1, normal: 2 };

    const getVal = (o: any) => {
      switch (sortBy) {
        case "created_at":
          return toDateTs(o.created_at);
        case "deadline":
          return toDateTs(o.deadline);
        case "order_number":
          return toStr(o.order_number);
        case "final_price":
          return toNum(o.final_price);
        case "priority":
          return priorityRank[o.priority] ?? 999;
        default:
          return null;
      }
    };

    return items.sort((a: any, b: any) => {
      const va = getVal(a);
      const vb = getVal(b);

      const aNull = va === null || va === undefined;
      const bNull = vb === null || vb === undefined;
      if (aNull && bNull) return 0;
      if (aNull) return 1;
      if (bNull) return -1;

      if (typeof va === "number" && typeof vb === "number") {
        return (va - vb) * dir;
      }

      return toStr(va).localeCompare(toStr(vb), "ru") * dir;
    });
  })();

  const uniqueClients = Array.from(
    new Map(
      (data?.items as any[] | undefined || [])
        .filter((o) => o.client_id != null)
        .map((o) => [o.client_id, o.client_name || `Клиент #${o.client_id}`])
    ).entries()
  );

  const exportFilters = toExportFilters({
    filters,
    search,
    clientId: clientFilter ? Number(clientFilter) : undefined,
  });

  const openConfirm = async (orderId: string) => {
    const full = orders.find((o) => o.id === orderId);
    if (full) {
      setConfirmOrder(full as Order);
      return;
    }
    try {
      const { getOrder } = await import("@/api/orders");
      const o = await getOrder(orderId);
      setConfirmOrder(o);
    } catch {
      toast.error("Не удалось загрузить заказ");
    }
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between gap-4">
        <h1 className="text-3xl font-bold">Заказы</h1>
        <div className="flex gap-2">
          <Link to="/manager/sample-orders">
            <Button variant="outline" className="gap-2">
              <Plus className="h-4 w-4" />
              Образцы заказов
            </Button>
          </Link>
          <ExportButton resource="orders" filters={exportFilters} title="Журнал заказов" />
        </div>
      </div>

      <SearchAndFilter
        onSearch={setSearch}
        onFilter={setFilters}
        filters={filterConfigs}
        searchPlaceholder="Поиск по номеру заказа или клиенту..."
      />

      <div className="w-full max-w-xs">
        <label className="text-sm font-medium mb-2 block">Заказчик</label>
        <select
          value={clientFilter}
          onChange={(e) => {
            setClientFilter(e.target.value);
            setPage(1);
          }}
          className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
        >
          <option value="">Все клиенты</option>
          {uniqueClients.map(([id, name]) => (
            <option key={id} value={String(id)}>
              {name}
            </option>
          ))}
        </select>
      </div>

      {isLoading ? (
        <div className="space-y-4">
          {[...Array(5)].map((_, i) => (
            <Card key={i} className="animate-pulse">
              <CardContent className="py-6">
                <div className="h-6 w-3/4 bg-muted rounded" />
              </CardContent>
            </Card>
          ))}
        </div>
      ) : !orders.length ? (
        <Card>
          <CardContent className="py-12 text-center text-muted-foreground">
            <p>Заказы не найдены</p>
          </CardContent>
        </Card>
      ) : (
        <>
          <div className="space-y-4">
            <div className="flex flex-wrap gap-3 items-center">
              <span className="text-sm font-medium text-muted-foreground">Сортировка:</span>

              <Button
                variant="outline"
                size="sm"
                onClick={() => toggleSort("created_at")}
                className="gap-2"
              >
                Дата создания{sortBy === "created_at" ? (sortDir === "asc" ? " ▲" : " ▼") : ""}
              </Button>

              <Button
                variant="outline"
                size="sm"
                onClick={() => toggleSort("deadline")}
                className="gap-2"
              >
                Дедлайн{sortBy === "deadline" ? (sortDir === "asc" ? " ▲" : " ▼") : ""}
              </Button>

              <Button
                variant="outline"
                size="sm"
                onClick={() => toggleSort("order_number")}
                className="gap-2"
              >
                Номер заказа{sortBy === "order_number" ? (sortDir === "asc" ? " ▲" : " ▼") : ""}
              </Button>

              <Button
                variant="outline"
                size="sm"
                onClick={() => toggleSort("final_price")}
                className="gap-2"
              >
                Сумма{sortBy === "final_price" ? (sortDir === "asc" ? " ▲" : " ▼") : ""}
              </Button>

              <Button
                variant="outline"
                size="sm"
                onClick={() => toggleSort("priority")}
                className="gap-2"
              >
                Приоритет{sortBy === "priority" ? (sortDir === "asc" ? " ▲" : " ▼") : ""}
              </Button>
            </div>

            {sortedOrders.map((order) => {
              const urgent = isOrderUrgent(order);
              const overdue =
                order.deadline &&
                new Date(order.deadline) < new Date() &&
                !["completed", "cancelled", "archived"].includes(order.status);

              return (
                <Card
                  key={order.id}
                  className={cn(
                    "transition-shadow hover:shadow-md",
                    urgent && "border-destructive/60 ring-1 ring-destructive/30"
                  )}
                >
                  <CardContent className="py-4">
                    <div className="flex flex-wrap items-center justify-between gap-4">
                      <div className="space-y-1">
                        <p className="font-medium text-lg">{order.order_number}</p>
                        <div className="flex flex-wrap items-center gap-4 text-sm text-muted-foreground">
                          <span className="flex items-center gap-1">
                            <Clock className="h-3 w-3" />
                            {new Date(order.created_at).toLocaleDateString("ru-RU")}
                          </span>
                          {order.deadline && (
                            <span
                              className={cn(
                                overdue && "text-destructive font-semibold"
                              )}
                            >
                              Дедлайн:{" "}
                              {new Date(order.deadline).toLocaleDateString("ru-RU")}
                            </span>
                          )}
                          {order.technician_name ? (
                            <span className="flex items-center gap-1">
                              <User className="h-3 w-3" /> {order.technician_name}
                            </span>
                          ) : (
                            <span className="text-amber-600">Техник не назначен</span>
                          )}
                          {order.client_name && (
                            <span className="flex items-center gap-1">
                              <User className="h-3 w-3" /> {order.client_name}
                            </span>
                          )}
                        </div>
                      </div>
                      <div className="flex flex-wrap items-center gap-2">
                        {order.status === "new" && (
                          <Button
                            variant="outline"
                            size="sm"
                            onClick={() => openConfirm(order.id)}
                            className="gap-1"
                          >
                            <Check className="h-4 w-4 text-green-600" /> Подтвердить
                          </Button>
                        )}
                        {order.status === "review" && (
                          <Button
                            variant="outline"
                            size="sm"
                            onClick={() =>
                              statusMutation.mutate({
                                orderId: order.id,
                                status: "completed",
                              })
                            }
                            disabled={statusMutation.isPending}
                            className="gap-1"
                          >
                            <Check className="h-4 w-4 text-green-600" /> Завершить
                          </Button>
                        )}
                        <StatusBadge status={order.status} />
                        <Badge
                          variant={
                            order.priority === "critical"
                              ? "destructive"
                              : order.priority === "urgent"
                                ? "default"
                                : "secondary"
                          }
                        >
                          {order.priority === "critical"
                            ? "Критичный"
                            : order.priority === "urgent"
                              ? "Срочный"
                              : "Обычный"}
                        </Badge>
                        <span className="font-semibold">
                          {new Intl.NumberFormat("ru-RU", {
                            style: "currency",
                            currency: "BYN",
                            minimumFractionDigits: 2,
                          }).format(Number(order.final_price))}
                        </span>
                        <Link to={`/manager/orders/${order.id}`}>
                          <Button variant="ghost" size="sm">
                            Детали
                          </Button>
                        </Link>
                        {!order.technician_id && (
                          <Button
                            variant="outline"
                            size="sm"
                            onClick={() =>
                              setAssignModal({ orderId: order.id, open: true })
                            }
                          >
                            Назначить
                          </Button>
                        )}
                      </div>
                    </div>
                  </CardContent>
                </Card>
              );
            })}
          </div>
          <Pagination
            total={data?.total ?? 0}
            page={page}
            limit={limit}
            onPageChange={setPage}
          />
        </>
      )}

      <ManagerConfirmOrderDialog
        order={confirmOrder}
        open={!!confirmOrder}
        onClose={() => setConfirmOrder(null)}
        onSuccess={() => queryClient.invalidateQueries({ queryKey: ["manager-orders"] })}
      />

      {assignModal.open && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50">
          <div className="bg-background rounded-lg p-6 w-full max-w-md">
            <h2 className="text-xl font-bold mb-4">Назначить техника</h2>
            <select
              value={selectedTechnician}
              onChange={(e) => setSelectedTechnician(e.target.value as number | "")}
              className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm mb-4"
            >
              <option value="">Выберите техника</option>
              {technicians?.filter((t) => t.is_available).map((t) => (
                <option key={t.id} value={t.id}>
                  {t.first_name} {t.last_name} — {t.specialization || "Универсал"}
                </option>
              ))}
            </select>
            <div className="flex justify-end gap-2">
              <Button
                variant="outline"
                onClick={() => {
                  setAssignModal({ orderId: "", open: false });
                  setSelectedTechnician("");
                }}
              >
                Отмена
              </Button>
              <Button
                onClick={handleAssign}
                disabled={!selectedTechnician || assignMutation.isPending}
              >
                {assignMutation.isPending ? "Назначение..." : "Назначить"}
              </Button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
