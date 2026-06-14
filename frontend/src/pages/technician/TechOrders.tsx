import { useState } from "react";
import { Link } from "react-router-dom";
import { useQuery } from "@tanstack/react-query";

import { getTechnicianOrders } from "@/api/technicians";
import { SearchAndFilter, type FilterConfig } from "@/components/shared/SearchAndFilter";
import { Pagination } from "@/components/shared/Pagination";
import { StatusBadge } from "@/components/shared/StatusBadge";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { ExportButton } from "@/components/shared/ExportButton";
import { toExportFilters } from "@/lib/exportFilters";
import { isOrderUrgent, sortOrders, type OrderSortField } from "@/lib/sortOrders";
import { Clock } from "lucide-react";
import { cn, formatDate, formatPrice } from "@/utils";
import type { Order } from "@/types";

export const TechOrders = () => {
  const [page, setPage] = useState(1);
  const [filters, setFilters] = useState<Record<string, string>>({});
  const [search, setSearch] = useState("");
  const [sortBy, setSortBy] = useState<OrderSortField>("created_at");
  const [sortDir, setSortDir] = useState<"asc" | "desc">("desc");
  const limit = 20;

  const toggleSort = (next: OrderSortField) => {
    if (next === sortBy) {
      setSortDir((prev) => (prev === "asc" ? "desc" : "asc"));
    } else {
      setSortBy(next);
      setSortDir("asc");
    }
  };

  const { data, isLoading } = useQuery({
    queryKey: ["tech-orders", page, filters, search],
    queryFn: () =>
      getTechnicianOrders({
        page,
        limit,
        status: filters.status || undefined,
        priority: filters.priority,
        date_from: filters.date_from,
        date_to: filters.date_to,
        search: search.trim() || undefined,
      }),
  });

  const exportFilters = toExportFilters({ filters, search });

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

  const orders = (data?.items ?? []) as Array<
    Order & {
      client_name?: string | null;
      created_at?: string | null;
      deadline?: string | null;
      final_price?: number | string | null;
      priority?: string | null;
    }
  >;

  const sortedOrders = sortOrders(orders, sortBy, sortDir);

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="text-3xl font-bold">Мои заказы</h1>
        <ExportButton resource="technician-orders" filters={exportFilters} title="Мои заказы — выгрузка" />
      </div>

      <SearchAndFilter
        onSearch={setSearch}
        onFilter={setFilters}
        filters={filterConfigs}
        searchPlaceholder="Поиск по номеру заказа или клинике..."
      />

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

              <Button variant="outline" size="sm" onClick={() => toggleSort("created_at")} className="gap-2">
                Дата создания{sortBy === "created_at" ? (sortDir === "asc" ? " ▲" : " ▼") : ""}
              </Button>
              <Button variant="outline" size="sm" onClick={() => toggleSort("deadline")} className="gap-2">
                Дедлайн{sortBy === "deadline" ? (sortDir === "asc" ? " ▲" : " ▼") : ""}
              </Button>
              <Button variant="outline" size="sm" onClick={() => toggleSort("order_number")} className="gap-2">
                Номер заказа{sortBy === "order_number" ? (sortDir === "asc" ? " ▲" : " ▼") : ""}
              </Button>
              <Button variant="outline" size="sm" onClick={() => toggleSort("final_price")} className="gap-2">
                Сумма{sortBy === "final_price" ? (sortDir === "asc" ? " ▲" : " ▼") : ""}
              </Button>
              <Button variant="outline" size="sm" onClick={() => toggleSort("priority")} className="gap-2">
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
                <Link key={order.id} to={`/technician/orders/${order.id}`}>
                  <Card
                    className={cn(
                      "transition-shadow hover:shadow-md cursor-pointer",
                      urgent && "border-destructive/60 ring-1 ring-destructive/30",
                    )}
                  >
                    <CardContent className="py-4">
                      <div className="flex flex-wrap items-center justify-between gap-4">
                        <div className="space-y-1">
                          <p className="font-medium text-lg">{order.order_number}</p>
                          {order.client_name && (
                            <p className="text-sm text-muted-foreground">{order.client_name}</p>
                          )}
                          <div className="flex items-center gap-2 text-sm text-muted-foreground">
                            <Clock className="h-3 w-3" />
                            {order.deadline
                              ? `Дедлайн: ${formatDate(order.deadline)}${overdue ? " (просрочен)" : ""}`
                              : "Без дедлайна"}
                          </div>
                          {order.created_at && (
                            <p className="text-xs text-muted-foreground">
                              Создан: {formatDate(order.created_at)}
                            </p>
                          )}
                        </div>
                        <div className="flex items-center gap-4">
                          <StatusBadge status={order.status} />
                          <span
                            className={cn(
                              "text-sm font-medium",
                              order.priority === "critical"
                                ? "text-red-600"
                                : order.priority === "urgent"
                                  ? "text-orange-600"
                                  : "text-muted-foreground",
                            )}
                          >
                            {order.priority === "normal"
                              ? "Обычный"
                              : order.priority === "urgent"
                                ? "Срочный"
                                : "Критичный"}
                          </span>
                          <span className="font-semibold">{formatPrice(Number(order.final_price))}</span>
                        </div>
                      </div>
                    </CardContent>
                  </Card>
                </Link>
              );
            })}
          </div>

          <Pagination total={data?.total ?? 0} page={page} limit={limit} onPageChange={setPage} />
        </>
      )}
    </div>
  );
};
