import { useState } from "react";
import { Link } from "react-router-dom";
import { useQuery } from "@tanstack/react-query";

import { getOrders } from "@/api/orders";
import { clientOrdersQueryOptions } from "@/lib/clientOrdersQuery";
import { SearchAndFilter, type FilterConfig } from "@/components/shared/SearchAndFilter";
import { ExportButton } from "@/components/shared/ExportButton";
import { Pagination } from "@/components/shared/Pagination";
import { StatusBadge } from "@/components/shared/StatusBadge";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Clock } from "lucide-react";
import type { Order } from "@/types";

export const ClientOrders = () => {
  const [page, setPage] = useState(1);
  const [search, setSearch] = useState("");
  const [filters, setFilters] = useState<Record<string, string | string[]>>({});
  const [sortBy, setSortBy] = useState<string>("created_at");
  const [sortDir, setSortDir] = useState<"asc" | "desc">("desc");
  const limit = 10;

  const { data, isLoading } = useQuery({
    queryKey: ["client-orders", page, search, filters, sortBy, sortDir],
    queryFn: () => getOrders({
      page,
      limit,
      status: (filters.status as string[]) || undefined,
      date_from: filters.date_from as string,
      date_to: filters.date_to as string,
      sort_by: sortBy,
      sort_dir: sortDir,
    }),
    ...clientOrdersQueryOptions,
  });

  const onChangeSortBy = (value: string) => {
    setSortBy(value);
    setPage(1);
  };

  const toggleSortDir = () => {
    setSortDir((d) => (d === "asc" ? "desc" : "asc"));
    setPage(1);
  };

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
        { value: "archived", label: "Архив" },
      ],
    },
    { key: "date_from", label: "Дата от", type: "date" },
    { key: "date_to", label: "Дата до", type: "date" },
  ];

  const exportFilters = {
    status: filters.status as string[],
    date_from: filters.date_from as string,
    date_to: filters.date_to as string,
    page: page,
    limit: limit,
  } as any;

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="text-3xl font-bold">Мои заказы</h1>
        <div className="flex gap-2">
          <ExportButton filters={exportFilters} title="Мои заказы" />
          <Link to="/client/orders/new">
            <Button>
              <span className="mr-2">+</span> Новый заказ
            </Button>
          </Link>
        </div>
      </div>

      <SearchAndFilter
        onSearch={setSearch}
        onFilter={setFilters}
        filters={filterConfigs}
        searchPlaceholder="Поиск по номеру заказа..."
      />

      <Card>
        <CardContent className="py-4 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
          <div className="text-sm text-muted-foreground">
            Сортировка
          </div>

          <div className="flex items-center gap-3">
            <label className="text-sm text-muted-foreground">Поле</label>
            <select
              value={sortBy}
              onChange={(e) => onChangeSortBy(e.target.value)}
              className="h-10 rounded-md border border-input bg-background px-3 text-sm"
            >
              <option value="created_at">Создан</option>
              <option value="deadline">Дедлайн</option>
              <option value="order_number">Номер</option>
              <option value="status">Статус</option>
              <option value="priority">Приоритет</option>
              <option value="final_price">Сумма</option>
            </select>

            <Button variant="outline" size="sm" onClick={toggleSortDir}>
              {sortDir === "asc" ? "↑" : "↓"}
            </Button>
          </div>
        </CardContent>
      </Card>

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
      ) : !data?.items.length ? (
        <Card>
          <CardContent className="py-12 text-center text-muted-foreground">
            <p>Заказы не найдены</p>
            <Link to="/client/orders/new">
              <Button variant="link">Создать первый заказ</Button>
            </Link>
          </CardContent>
        </Card>
      ) : (
        <>
          <div className="space-y-4">
            {data.items.map((order) => (
              <Link key={order.id} to={`/client/orders/${order.id}`}>
                <Card className="transition-shadow hover:shadow-md cursor-pointer">
                  <CardContent className="py-4">
                    <div className="flex flex-wrap items-center justify-between gap-4">
                      <div className="space-y-1">
                        <p className="font-medium text-lg">{order.order_number}</p>
                        <div className="flex items-center gap-2 text-sm text-muted-foreground">
                          <Clock className="h-3 w-3" />
                          {order.deadline
                            ? `Дедлайн: ${new Date(order.deadline).toLocaleDateString("ru-RU")}`
                            : "Без дедлайна"}
                        </div>
                        <p className="text-xs text-muted-foreground">
                          Создан: {new Date(order.created_at).toLocaleDateString("ru-RU")}
                        </p>
                      </div>
                      <div className="flex items-center gap-4">
                        <StatusBadge status={order.status} />
                        <div className="text-right">
                          <p className="text-xs text-muted-foreground">Итого</p>
                          <p className="font-semibold">
                            {new Intl.NumberFormat("ru-RU", {
                              style: "currency",
                              currency: "BYN",
                              minimumFractionDigits: 2,
                            }).format(Number(order.final_price))}
                          </p>
                        </div>
                      </div>
                    </div>
                  </CardContent>
                </Card>
              </Link>
            ))}
          </div>

          <Pagination
            total={data.total}
            page={page}
            limit={limit}
            onPageChange={setPage}
          />
        </>
      )}
    </div>
  );
};
