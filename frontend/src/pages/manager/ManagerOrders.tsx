import { useState } from "react";
import { Link } from "react-router-dom";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { toast } from "react-toastify";

import { getOrders, assignTechnician, updateOrderStatus } from "@/api/orders";
import { getTechnicians } from "@/api/manager";
import { SearchAndFilter, type FilterConfig } from "@/components/shared/SearchAndFilter";
import { Pagination } from "@/components/shared/Pagination";
import { StatusBadge } from "@/components/shared/StatusBadge";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Clock, User, Check, X, Search } from "lucide-react";
import { Badge } from "@/components/ui/badge";

export const ManagerOrders = () => {
  const queryClient = useQueryClient();
  const [page, setPage] = useState(1);
  const [filters, setFilters] = useState<Record<string, string>>({});
  const [search, setSearch] = useState("");
  const [clientFilter, setClientFilter] = useState("");
  const [assignModal, setAssignModal] = useState<{ orderId: string; open: boolean }>({ orderId: "", open: false });
  const [selectedTechnician, setSelectedTechnician] = useState<number | "">("");
  const limit = 20;

  const { data, isLoading } = useQuery({
    queryKey: ["manager-orders", page, filters, search, clientFilter],
    queryFn: () => getOrders({
      page,
      limit,
      status: filters.status ? [filters.status] : undefined,
      priority: filters.priority,
      date_from: filters.date_from,
      date_to: filters.date_to,
      client_id: clientFilter ? Number(clientFilter) : undefined,
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
      updateOrderStatus(orderId, { new_status: status as any, comment: "Изменено менеджером" }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["manager-orders"] });
      toast.success("Статус обновлён");
    },
    onError: () => toast.error("Ошибка обновления"),
  });

  const filterConfigs: FilterConfig[] = [
    { key: "status", label: "Статус", type: "select", options: [
      { value: "new", label: "Новый" }, { value: "confirmed", label: "Подтверждён" },
      { value: "in_progress", label: "В работе" }, { value: "review", label: "На проверке" },
      { value: "completed", label: "Завершён" }, { value: "cancelled", label: "Отменён" },
    ]},
    { key: "priority", label: "Приоритет", type: "select", options: [
      { value: "normal", label: "Обычный" }, { value: "urgent", label: "Срочный" }, { value: "critical", label: "Критичный" },
    ]},
    { key: "date_from", label: "Дата от", type: "date" },
    { key: "date_to", label: "Дата до", type: "date" },
  ];

  const handleAssign = () => {
    if (selectedTechnician && assignModal.orderId) {
      assignMutation.mutate({ orderId: assignModal.orderId, technicianId: Number(selectedTechnician) });
    }
  };

  const handleConfirmOrder = (orderId: string) => {
    statusMutation.mutate({ orderId, status: "confirmed" });
  };

  const handleCompleteOrder = (orderId: string) => {
    statusMutation.mutate({ orderId, status: "completed" });
  };

  // Фильтрация заказов по поиску (номер заказа или клиент)
  const filteredOrders = data?.items?.filter((order) => {
    const searchLower = search.toLowerCase();
    const matchesSearch = !search || 
      order.order_number.toLowerCase().includes(searchLower) ||
      order.client_name?.toLowerCase().includes(searchLower);
    const matchesClient = !clientFilter || order.client_id?.toString() === clientFilter;
    return matchesSearch && matchesClient;
  }) || [];

  // Получаем уникальных клиентов для фильтра
  const uniqueClients = Array.from(
    new Map((data?.items || []).map((o) => [o.client_id, o.client_name || `Клиент #${o.client_id}`])).values()
  );

  return (
    <div className="space-y-6">
      <h1 className="text-3xl font-bold">Все заказы</h1>

      {/* Поиск и фильтры */}
      <div className="space-y-4">
        <div className="flex gap-4 items-end">
          <div className="flex-1">
            <label className="text-sm font-medium mb-2 block">Поиск</label>
            <div className="relative">
              <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
              <Input
                placeholder="Поиск по номеру заказа или клиенту..."
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                className="pl-10"
              />
            </div>
          </div>
          <div className="w-48">
            <label className="text-sm font-medium mb-2 block">Заказчик</label>
            <select
              value={clientFilter}
              onChange={(e) => setClientFilter(e.target.value)}
              className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
            >
              <option value="">Все клиенты</option>
              {uniqueClients.map((client, idx) => (
                <option key={idx} value={String(idx)}>{client}</option>
              ))}
            </select>
          </div>
        </div>

        <SearchAndFilter onSearch={() => {}} onFilter={setFilters} filters={filterConfigs} />
      </div>

      {isLoading ? (
        <div className="space-y-4">
          {[...Array(5)].map((_, i) => (
            <Card key={i} className="animate-pulse"><CardContent className="py-6"><div className="h-6 w-3/4 bg-muted rounded" /></CardContent></Card>
          ))}
        </div>
      ) : !filteredOrders.length ? (
        <Card><CardContent className="py-12 text-center text-muted-foreground"><p>Заказы не найдены</p></CardContent></Card>
      ) : (
        <>
          <div className="space-y-4">
            {filteredOrders.map((order) => (
              <Card key={order.id} className="cursor-pointer transition-shadow hover:shadow-md">
                <CardContent className="py-4">
                  <div className="flex flex-wrap items-center justify-between gap-4">
                    <div className="space-y-1">
                      <p className="font-medium text-lg">{order.order_number}</p>
                      <div className="flex items-center gap-4 text-sm text-muted-foreground">
                        <span className="flex items-center gap-1"><Clock className="h-3 w-3" /> {new Date(order.created_at).toLocaleDateString("ru-RU")}</span>
                        {order.deadline && <span className={new Date(order.deadline) < new Date() ? "text-red-500 font-medium" : ""}>Дедлайн: {new Date(order.deadline).toLocaleDateString("ru-RU")}</span>}
                        {order.technician_name ? (
                          <span className="flex items-center gap-1">
                            <User className="h-3 w-3" /> {order.technician_name}
                          </span>
                        ) : (
                          <span className="text-amber-500">Техник не назначен</span>
                        )}
                        {order.client_name && (
                          <span className="flex items-center gap-1">
                            <User className="h-3 w-3" /> {order.client_name}
                          </span>
                        )}
                      </div>
                    </div>
                    <div className="flex items-center gap-2">
                      {order.status === "new" && (
                        <Button
                          variant="outline"
                          size="sm"
                          onClick={(e) => { e.preventDefault(); handleConfirmOrder(order.id); }}
                          disabled={statusMutation.isPending}
                          className="gap-1"
                        >
                          <Check className="h-4 w-4 text-green-600" /> Подтвердить
                        </Button>
                      )}
                      {order.status === "review" && (
                        <Button
                          variant="outline"
                          size="sm"
                          onClick={(e) => { e.preventDefault(); handleCompleteOrder(order.id); }}
                          disabled={statusMutation.isPending}
                          className="gap-1"
                        >
                          <Check className="h-4 w-4 text-green-600" /> Завершить
                        </Button>
                      )}
                      <StatusBadge status={order.status} />
                      <Badge variant={order.priority === "critical" ? "destructive" : order.priority === "urgent" ? "default" : "secondary"}>
                        {order.priority === "normal" ? "Обычный" : order.priority === "urgent" ? "Срочный" : "Критичный"}
                      </Badge>
                      <span className="font-semibold">{new Intl.NumberFormat("ru-RU", { style: "currency", currency: "RUB", minimumFractionDigits: 0 }).format(Number(order.final_price))}</span>
                      <Link to={`/manager/orders/${order.id}`}><Button variant="ghost" size="sm">Детали</Button></Link>
                      {!order.technician && <Button variant="outline" size="sm" onClick={() => setAssignModal({ orderId: order.id, open: true })}>Назначить</Button>}
                    </div>
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>
          <Pagination total={data.total} page={page} limit={limit} onPageChange={setPage} />
        </>
      )}

      {/* Модал назначения техника */}
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
              {technicians?.filter((t) => t.is_available).map((t) => {
                const technicianName = t.first_name && t.last_name
                  ? `${t.first_name} ${t.last_name}`
                  : t.user?.first_name && t.user?.last_name
                  ? `${t.user.first_name} ${t.user.last_name}`
                  : "Техник";
                return (
                  <option key={t.id} value={t.id}>
                    {technicianName} — {t.specialization || "Универсал"}
                  </option>
                );
              })}
            </select>
            <div className="flex justify-end gap-2">
              <Button variant="outline" onClick={() => { setAssignModal({ orderId: "", open: false }); setSelectedTechnician(""); }}>Отмена</Button>
              <Button onClick={handleAssign} disabled={!selectedTechnician || assignMutation.isPending}>
                {assignMutation.isPending ? "Назначение..." : "Назначить"}
              </Button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
