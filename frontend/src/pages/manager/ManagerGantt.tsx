import { useState } from "react";
import { Link } from "react-router-dom";
import "gantt-task-react/dist/index.css";
import { useQuery } from "@tanstack/react-query";
import { Gantt, Task, ViewMode } from "gantt-task-react";

import { getOrders } from "../../api/orders";
import { Card, CardContent, CardHeader, CardTitle } from "../../components/ui/card";
import { Badge } from "../../components/ui/badge";
import { Button } from "../../components/ui/button";
import { StatusBadge } from "../../components/shared/StatusBadge";
import { X } from "lucide-react";
import { ExportButton } from "../../components/shared/ExportButton";
import { SearchAndFilter, type FilterConfig } from "../../components/shared/SearchAndFilter";
import { toExportFilters } from "@/lib/exportFilters";
import { formatDate } from "@/utils";

// Преобразование статуса в прогресс
const statusToProgress = (status: string): number => {
  const map: Record<string, number> = {
    new: 0, confirmed: 25, in_progress: 50, review: 75, completed: 100, cancelled: 0, archived: 100,
  };
  return map[status] || 0;
};

// Цвет по статусу
const statusColor = (status: string): string => {
  const map: Record<string, string> = {
    new: "#6b7280", confirmed: "#3b82f6", in_progress: "#eab308", review: "#f97316", completed: "#22c55e", cancelled: "#ef4444", archived: "#6b7280",
  };
  return map[status] || "#6b7280";
};

export const ManagerGantt = () => {
  const [selectedOrder, setSelectedOrder] = useState<string | null>(null);
  const [filters, setFilters] = useState<Record<string, string>>({});
  const [search, setSearch] = useState("");

  const ganttStatuses = filters.status
    ? [filters.status]
    : ["confirmed", "in_progress", "review"];

  const { data: ordersData } = useQuery({
    queryKey: ["gantt-orders", filters, search],
    queryFn: () =>
      getOrders({
        status: ganttStatuses,
        date_from: filters.date_from,
        date_to: filters.date_to,
        search: search.trim() || undefined,
        limit: 100,
      }),
  });

  const filterConfigs: FilterConfig[] = [
    {
      key: "status",
      label: "Статус",
      type: "select",
      options: [
        { value: "confirmed", label: "Подтверждён" },
        { value: "in_progress", label: "В работе" },
        { value: "review", label: "На проверке" },
      ],
    },
    { key: "date_from", label: "Дата от", type: "date" },
    { key: "date_to", label: "Дата до", type: "date" },
  ];

  const exportFilters = toExportFilters({
    filters,
    search,
    status: ganttStatuses,
  });

  const orders: any[] = ordersData?.items || [];

  // Преобразование в формат Gantt (защита от отсутствующих/невалидных дат)
  const tasks: Task[] = (orders || [])
    .map((order: any) => {
      const createdAtRaw = order?.created_at;
      if (!createdAtRaw) return null;

      const startMs = Date.parse(String(createdAtRaw));
      if (!Number.isFinite(startMs)) return null;

      const deadlineRaw = order?.deadline;
      const deadlineMs = deadlineRaw ? Date.parse(String(deadlineRaw)) : null;

      let endMs =
        deadlineMs !== null && Number.isFinite(deadlineMs)
          ? deadlineMs
          : startMs + 7 * 24 * 60 * 60 * 1000;

      if (!Number.isFinite(endMs)) return null;

      // gantt-task-react can crash if end == start (dates array may end up with length 1)
      if (endMs <= startMs) {
        endMs = startMs + 1; // +1ms minimal non-zero duration
      }

      const progress = statusToProgress(order?.status);
      const progressValid = Number.isFinite(progress);

      const start = new Date(startMs);
      const end = new Date(endMs);

      // Strictly ensure start/end are present and have getTime()
      if (!(start && typeof (start as any).getTime === "function")) return null;
      if (!(end && typeof (end as any).getTime === "function")) return null;

      // Also ensure they are not invalid dates
      if (!Number.isFinite(start.getTime())) return null;
      if (!Number.isFinite(end.getTime())) return null;

      return {
        id: order?.id,
        name: `${order?.order_number ?? "—"} — ${order?.client_name || "Клиент"}`,
        start,
        end,
        progress: progressValid ? progress : 0,
        type: "task",
        project: order?.technician_name || "Не назначен",
        styles: {
          progressColor: statusColor(order?.status),
          progressSelectedColor: statusColor(order?.status),
        },
      } as Task;
    })
    .filter((t): t is Task => {
      return (
        t !== null &&
        t.start &&
        t.end &&
        typeof (t.start as any).getTime === "function" &&
        typeof (t.end as any).getTime === "function" &&
        Number.isFinite((t.start as any).getTime()) &&
        Number.isFinite((t.end as any).getTime())
      );
    });

  const selectedTask = selectedOrder ? tasks.find((t) => t.id === selectedOrder) : null;
  const selectedOrderData = selectedOrder ? orders.find((o: any) => o.id === selectedOrder) : null;

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between gap-4">
        <h1 className="text-3xl font-bold">Диаграмма Ганта</h1>
        <ExportButton resource="gantt" filters={exportFilters} title="График сроков выполнения" />
      </div>

      <SearchAndFilter
        onSearch={setSearch}
        onFilter={setFilters}
        filters={filterConfigs}
        searchPlaceholder="Поиск по номеру заказа или клиенту..."
      />

      <Card className="bg-white text-black">
        <CardHeader>
          <CardTitle>Заказы в работе</CardTitle>
        </CardHeader>
        <CardContent className="bg-white">
          {tasks.length === 0 ? (
            <p className="text-center text-muted-foreground py-8">Нет активных заказов</p>
          ) : (
            <div
              className="!bg-white w-full"
              style={{ minWidth: 900, backgroundColor: "#fff" }}
            >
              <Gantt
                tasks={tasks}
                viewMode={ViewMode.Day}
                columnWidth={60}
                listCellWidth="220px"
                ganttHeight={600}
                barCornerRadius={4}
                // Force light theme friendly gantt visuals
                locale="ru-RU"
                rtl={false}
                arrowColor="rgba(0,0,0,0.35)"
                barBackgroundColor="#e5e7eb"
                barBackgroundSelectedColor="#d1d5db"
                barProgressColor="#3b82f6"
                barProgressSelectedColor="#1d4ed8"
                milestoneBackgroundColor="#f59e0b"
                milestoneBackgroundSelectedColor="#d97706"
                todayColor="rgba(59, 130, 246, 0.15)"
                onDoubleClick={(task) => setSelectedOrder(task.id)}
                onClick={(task) => setSelectedOrder(task.id)}
              />
            </div>
          )}
        </CardContent>
      </Card>

      {/* Drawer с деталями */}
      {selectedOrderData && (
        <div className="fixed inset-y-0 right-0 w-full max-w-md bg-background border-l shadow-lg z-50 overflow-y-auto">
          <div className="p-6 space-y-4">
            <div className="flex items-center justify-between">
              <h2 className="text-xl font-bold">{selectedOrderData.order_number}</h2>
              <button onClick={() => setSelectedOrder(null)} className="p-2 hover:bg-accent rounded-lg">
                <X className="h-5 w-5" />
              </button>
            </div>

            <div className="flex items-center gap-2">
              <StatusBadge status={selectedOrderData.status} />
              <Badge variant={selectedOrderData.priority === "critical" ? "destructive" : selectedOrderData.priority === "urgent" ? "default" : "secondary"}>
                {selectedOrderData.priority}
              </Badge>
            </div>

            <div className="space-y-2">
              <p><span className="font-medium">Клиент:</span> {selectedOrderData.client_name || "Не указан"}</p>
              <p><span className="font-medium">Техник:</span> {selectedOrderData.technician_name || "Не назначен"}</p>
              <p><span className="font-medium">Создан:</span> {formatDate(selectedOrderData.created_at)}</p>
              {selectedOrderData.deadline && <p><span className="font-medium">Дедлайн:</span> {formatDate(selectedOrderData.deadline)}</p>}
              <p><span className="font-medium">Сумма:</span> {new Intl.NumberFormat("ru-RU", { style: "currency", currency: "BYN", minimumFractionDigits: 2 }).format(Number(selectedOrderData.final_price))}</p>
            </div>

            {selectedOrderData.items && selectedOrderData.items.length > 0 && (
              <div>
                <h3 className="font-semibold mb-2">Состав заказа</h3>
                <ul className="space-y-1 text-sm">
                  {selectedOrderData.items.map((item: any) => (
                    <li key={item.id} className="flex justify-between">
                      <span>{item.service?.name || `Услуга #${item.service_id}`}</span>
                      <span>{item.quantity} шт</span>
                    </li>
                  ))}
                </ul>
              </div>
            )}

            <Link to={`/manager/orders/${selectedOrderData.id}`}>
              <Button className="w-full">Открыть детали</Button>
            </Link>
          </div>
        </div>
      )}
    </div>
  );
};
