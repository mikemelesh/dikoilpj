import { useState } from "react";
import { Link } from "react-router-dom";
import { useQuery } from "@tanstack/react-query";
import { Gantt, Task, ViewMode } from "gantt-task-react";
import "gantt-task-react/dist/index.css";

import { getOrders } from "@/api/orders";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { StatusBadge } from "@/components/shared/StatusBadge";
import { X } from "lucide-react";

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

  const { data: ordersData } = useQuery({
    queryKey: ["gantt-orders"],
    queryFn: () => getOrders({ status: "confirmed,in_progress,review", limit: 100 }),
  });

  const orders = ordersData?.items || [];

  // Преобразование в формат Gantt
  const tasks: Task[] = orders.map((order) => {
    const created = new Date(order.created_at);
    const deadline = order.deadline ? new Date(order.deadline) : new Date(created.getTime() + 7 * 24 * 60 * 60 * 1000);
    
    return {
      id: order.id,
      name: `${order.order_number} — ${order.client?.user?.first_name || "Клиент"}`,
      start: created,
      end: deadline,
      progress: statusToProgress(order.status),
      type: "task",
      project: order.technician ? `${order.technician.user.first_name} ${order.technician.user.last_name}` : "Не назначен",
      styles: { progressColor: statusColor(order.status), progressSelectedColor: statusColor(order.status) },
    } as Task;
  });

  const selectedTask = selectedOrder ? tasks.find((t) => t.id === selectedOrder) : null;
  const selectedOrderData = selectedOrder ? orders.find((o) => o.id === selectedOrder) : null;

  return (
    <div className="space-y-6">
      <h1 className="text-3xl font-bold">Диаграмма Ганта</h1>

      <Card>
        <CardHeader><CardTitle>Заказы в работе</CardTitle></CardHeader>
        <CardContent>
          {tasks.length === 0 ? (
            <p className="text-center text-muted-foreground py-8">Нет активных заказов</p>
          ) : (
            <div className="overflow-x-auto">
              <Gantt
                tasks={tasks}
                viewMode={ViewMode.Day}
                columnWidth={60}
                listCellWidth="150px"
                barCornerRadius={4}
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
              <p><span className="font-medium">Клиент:</span> {selectedOrderData.client?.user?.first_name} {selectedOrderData.client?.user?.last_name}</p>
              <p><span className="font-medium">Техник:</span> {selectedOrderData.technician ? `${selectedOrderData.technician.user.first_name} ${selectedOrderData.technician.user.last_name}` : "Не назначен"}</p>
              <p><span className="font-medium">Создан:</span> {new Date(selectedOrderData.created_at).toLocaleDateString("ru-RU")}</p>
              {selectedOrderData.deadline && <p><span className="font-medium">Дедлайн:</span> {new Date(selectedOrderData.deadline).toLocaleDateString("ru-RU")}</p>}
              <p><span className="font-medium">Сумма:</span> {new Intl.NumberFormat("ru-RU", { style: "currency", currency: "RUB", minimumFractionDigits: 0 }).format(Number(selectedOrderData.final_price))}</p>
            </div>

            {selectedOrderData.items && selectedOrderData.items.length > 0 && (
              <div>
                <h3 className="font-semibold mb-2">Состав заказа</h3>
                <ul className="space-y-1 text-sm">
                  {selectedOrderData.items.map((item) => (
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
