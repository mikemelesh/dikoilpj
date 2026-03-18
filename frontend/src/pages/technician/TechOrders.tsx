import { useState } from "react";
import { Link } from "react-router-dom";
import { useQuery } from "@tanstack/react-query";

import { getTechnicianOrders } from "@/api/technicians";
import { SearchAndFilter, type FilterConfig } from "@/components/shared/SearchAndFilter";
import { Pagination } from "@/components/shared/Pagination";
import { StatusBadge } from "@/components/shared/StatusBadge";
import { Card, CardContent } from "@/components/ui/card";
import { Clock } from "lucide-react";

export const TechOrders = () => {
  const [page, setPage] = useState(1);
  const [filters, setFilters] = useState<Record<string, string>>({});
  const limit = 10;

  const { data, isLoading } = useQuery({
    queryKey: ["tech-orders", page, filters],
    queryFn: () => getTechnicianOrders({
      page,
      limit,
      status: filters.status || undefined,
    }),
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
    { key: "date_from", label: "Дата от", type: "date" },
    { key: "date_to", label: "Дата до", type: "date" },
  ];

  return (
    <div className="space-y-6">
      <h1 className="text-3xl font-bold">Мои заказы</h1>

      <SearchAndFilter onSearch={() => {}} onFilter={setFilters} filters={filterConfigs} />

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
      ) : !data?.items?.length ? (
        <Card>
          <CardContent className="py-12 text-center text-muted-foreground">
            <p>Заказы не найдены</p>
          </CardContent>
        </Card>
      ) : (
        <>
          <div className="space-y-4">
            {data.items.map((order) => (
              <Link key={order.id} to={`/technician/orders/${order.id}`}>
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
                      </div>
                      <div className="flex items-center gap-4">
                        <StatusBadge status={order.status} />
                        <span className={`text-sm font-medium ${order.priority === "critical" ? "text-red-600" : order.priority === "urgent" ? "text-orange-600" : "text-muted-foreground"}`}>
                          {order.priority === "normal" ? "Обычный" : order.priority === "urgent" ? "Срочный" : "Критичный"}
                        </span>
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
