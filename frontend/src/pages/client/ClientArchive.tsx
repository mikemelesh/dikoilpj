import { useState } from "react";
import { Link } from "react-router-dom";
import { useQuery } from "@tanstack/react-query";

import { getOrders } from "@/api/orders";
import { clientOrdersQueryOptions } from "@/lib/clientOrdersQuery";
import { SearchAndFilter, type FilterConfig } from "@/components/shared/SearchAndFilter";
import { ExportButton, type ExportFilters } from "@/components/shared/ExportButton";
import { Pagination } from "@/components/shared/Pagination";
import { StatusBadge } from "@/components/shared/StatusBadge";
import { Card, CardContent } from "@/components/ui/card";
import { Clock, Plus } from "lucide-react";
import { duplicateOrder } from "@/api/orders";
import type { Order } from "@/types";
import { mutationOnError } from "@/lib/apiError";
import { useNavigate } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { toast } from "react-toastify";
import { formatDate } from "@/utils";

type OrderSortField = "created_at" | "deadline" | "order_number" | "final_price" | "priority";

export const ClientArchive = () => {
  const [page, setPage] = useState(1);
  const [filters, setFilters] = useState<Record<string, string>>({});
  const [sortBy, setSortBy] = useState<OrderSortField>("created_at");
  const [sortDir, setSortDir] = useState<"asc" | "desc">("desc");
  const limit = 10;
  const queryClient = useQueryClient();
  const navigate = useNavigate();

  const toggleSort = (next: OrderSortField) => {
    if (next === sortBy) {
      setSortDir((prev) => (prev === "asc" ? "desc" : "asc"));
    } else {
      setSortBy(next);
      setSortDir("asc");
    }
  };

  const { data, isLoading } = useQuery({
    queryKey: ["client-archive", page, filters],
    queryFn: () => getOrders({
      page,
      limit,
      status: filters.status ? [filters.status] : ["completed", "cancelled", "archived"],
      date_from: filters.date_from,
      date_to: filters.date_to,
    }),
    ...clientOrdersQueryOptions,
  });

  const orders = (data?.items ?? []) as Array<
    Order & {
      created_at?: string | null;
      deadline?: string | null;
      final_price?: number | string | null;
      priority?: string | null;
    }
  >;

  const sortedOrders = (() => {
    const items = [...orders];
    const dir = sortDir === "asc" ? 1 : -1;

    const toDateTs = (v: unknown) => {
      if (!v) return null;
      const t = new Date(v as string).getTime();
      return Number.isFinite(t) ? t : null;
    };

    const toNum = (v: unknown) => {
      const n = typeof v === "number" ? v : Number(v);
      return Number.isFinite(n) ? n : null;
    };

    const toStr = (v: unknown) => (v === null || v === undefined ? "" : String(v));

    const priorityRank: Record<string, number> = { critical: 0, urgent: 1, normal: 2 };

    const getVal = (o: (typeof orders)[number]) => {
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
          return priorityRank[o.priority ?? ""] ?? 999;
        default:
          return null;
      }
    };

    return items.sort((a, b) => {
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

  const duplicateMutation = useMutation({
    mutationFn: duplicateOrder,
    onSuccess: (newOrder) => {
      toast.success(`Повторён заказ ${newOrder.order_number}`);
      queryClient.invalidateQueries({ queryKey: ["client-archive"] });
      navigate(`/client/orders/${newOrder.id}`);
    },
    onError: mutationOnError("Ошибка повторения заказа"),
  });

  const filterConfigs: FilterConfig[] = [
    {
      key: "status",
      label: "Статус",
      type: "select",
      options: [
        { value: "completed", label: "Завершён" },
        { value: "cancelled", label: "Отменён" },
        { value: "archived", label: "Архив" },
      ],
    },
    { key: "date_from", label: "Дата от", type: "date" },
    { key: "date_to", label: "Дата до", type: "date" },
  ];

  const exportFilters: ExportFilters = {
    status: filters.status ? [filters.status] : ["completed", "cancelled", "archived"],
    date_from: filters.date_from,
    date_to: filters.date_to,
    page,
    limit,
  };

  return (
    <div className="space-y-6">
      <h1 className="text-3xl font-bold">Архив заказов</h1>

      <div className="flex gap-2">
        <SearchAndFilter onSearch={() => {}} onFilter={setFilters} filters={filterConfigs} />
        <ExportButton filters={exportFilters} title="Архив заказов" />
      </div>

      {!isLoading && !orders.length ? (
        <Card>
          <CardContent className="py-12 text-center text-muted-foreground">
            <p>В архиве нет заказов</p>
          </CardContent>
        </Card>
      ) : isLoading ? (
        <div className="space-y-4">
          {[...Array(5)].map((_, i) => (
            <Card key={i} className="animate-pulse">
              <CardContent className="py-6">
                <div className="h-6 w-3/4 bg-muted rounded" />
              </CardContent>
            </Card>
          ))}
        </div>
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

            {sortedOrders.map((order) => (
              <Link key={order.id} to={`/client/orders/${order.id}`}>
                <Card className="transition-shadow hover:shadow-md cursor-pointer">
                  <CardContent className="py-4">
                    <div className="flex flex-wrap items-center justify-between gap-4">
                      <div className="space-y-1">
                        <p className="font-medium">{order.order_number}</p>
                        <div className="flex items-center gap-2 text-sm text-muted-foreground">
                          <Clock className="h-3 w-3" />
                          {formatDate(order.created_at)}
                        </div>
                      </div>
                      <div className="flex items-center gap-4">
                        <StatusBadge status={order.status} />
                        <span className="font-semibold">
                          {new Intl.NumberFormat("ru-RU", { style: "currency", currency: "BYN", minimumFractionDigits: 2 }).format(Number(order.final_price))}
                        </span>
                        <Button
                          size="sm"
                          variant="outline"
                          onClick={(e) => {
                            e.preventDefault();
                            e.stopPropagation();
                            duplicateMutation.mutate(order.id);
                          }}
                          disabled={duplicateMutation.isPending}
                        >
                          <Plus className="w-4 h-4 mr-1" />
                          Повторить
                        </Button>
                      </div>
                    </div>
                  </CardContent>
                </Card>
              </Link>
            ))}
          </div>

          <Pagination total={data.total} page={page} limit={limit} onPageChange={setPage} />
        </>
      )}
    </div>
  );
};
