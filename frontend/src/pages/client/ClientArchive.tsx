import { useState } from "react";
import { Link } from "react-router-dom";
import { useQuery } from "@tanstack/react-query";

import { getOrders } from "@/api/orders";
import { SearchAndFilter, type FilterConfig } from "@/components/shared/SearchAndFilter";
import { Pagination } from "@/components/shared/Pagination";
import { StatusBadge } from "@/components/shared/StatusBadge";
import { Card, CardContent } from "@/components/ui/card";
import { Clock } from "lucide-react";

export const ClientArchive = () => {
  const [page, setPage] = useState(1);
  const [filters, setFilters] = useState<Record<string, string>>({});
  const limit = 10;

  const { data } = useQuery({
    queryKey: ["client-archive", page, filters],
    queryFn: () => getOrders({
      page,
      limit,
      status: filters.status ? [filters.status] : ["completed", "cancelled", "archived"],
      date_from: filters.date_from,
      date_to: filters.date_to,
    }),
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

  return (
    <div className="space-y-6">
      <h1 className="text-3xl font-bold">Архив заказов</h1>

      <SearchAndFilter onSearch={() => {}} onFilter={setFilters} filters={filterConfigs} />

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
