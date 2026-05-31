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
import { toast } from "react-toastify";
import { useNavigate } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { useMutation, useQueryClient } from "@tanstack/react-query";

export const ClientArchive = () => {
  const [page, setPage] = useState(1);
  const [filters, setFilters] = useState<Record<string, string>>({});
  const limit = 10;
  const queryClient = useQueryClient();
  const navigate = useNavigate();

  const { data } = useQuery({
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

  const duplicateMutation = useMutation({
    mutationFn: duplicateOrder,
    onSuccess: (newOrder) => {
      toast.success(`Повторён заказ ${newOrder.order_number}`);
      queryClient.invalidateQueries({ queryKey: ["client-archive"] });
      navigate(`/client/orders/${newOrder.id}`);
    },
    onError: () => {
      toast.error("Ошибка повторения заказа");
    },
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

      {!data?.items.length ? (
        <Card>
          <CardContent className="py-12 text-center text-muted-foreground">
            <p>В архиве нет заказов</p>
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
                        <p className="font-medium">{order.order_number}</p>
                        <div className="flex items-center gap-2 text-sm text-muted-foreground">
                          <Clock className="h-3 w-3" />
                          {new Date(order.created_at).toLocaleDateString("ru-RU")}
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
