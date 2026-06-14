import { useState } from "react";
import { useParams, Link } from "react-router-dom";
import { useQuery } from "@tanstack/react-query";
import { apiClient } from "@/api/axios";
import { getOrders } from "@/api/orders";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { StatusBadge } from "@/components/shared/StatusBadge";
import { ArrowLeft, Star, Award, CheckCircle } from "lucide-react";
import { BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, CartesianGrid } from "recharts";
import { formatDate } from "@/utils";
import { formatOrderMoney } from "@/utils/orderPricing";
import { getTechnicianLoadColorClass, formatTechnicianLoadLabel } from "@/utils/technicianLoad";

interface Technician {
  id: number;
  user_id: string;
  first_name: string;
  last_name: string;
  email: string;
  specialization?: string;
  experience_years: number;
  rating: number;
  completed_orders: number;
  is_available: boolean;
  today_load?: number;
}

interface TechnicianStats {
  total_orders: number;
  completed_orders: number;
  in_progress_orders: number;
  average_completion_days?: number;
  rating: number;
  total_earnings: number;
  monthly_completed: { month: string; count: number }[];
}

const ORDER_STATUS_FILTERS = [
  { value: "in_progress", label: "В работе" },
  { value: "confirmed,in_progress,review", label: "Активные" },
  { value: "", label: "Все" },
  { value: "confirmed", label: "Подтверждён" },
  { value: "review", label: "На проверке" },
  { value: "completed", label: "Завершён" },
  { value: "new", label: "Новый" },
  { value: "cancelled", label: "Отменён" },
] as const;

export const ManagerTechnicianDetail = () => {
  const { id } = useParams<{ id: string }>();
  const technicianId = Number(id);
  const [statusFilter, setStatusFilter] = useState<string>("in_progress");

  const { data: technician } = useQuery<Technician>({
    queryKey: ["technician-detail", id],
    queryFn: () => apiClient.get(`/technicians/${id}`).then((r) => r.data),
    enabled: !!id,
  });

  const { data: stats } = useQuery<TechnicianStats>({
    queryKey: ["technician-stats", id],
    queryFn: () => apiClient.get(`/technicians/${id}/stats`).then((r) => r.data),
    enabled: !!id,
  });

  const orderStatusParam = statusFilter
    ? statusFilter.includes(",")
      ? statusFilter.split(",")
      : statusFilter
    : undefined;

  const { data: ordersData, isLoading: ordersLoading } = useQuery({
    queryKey: ["technician-orders", id, statusFilter],
    queryFn: () =>
      getOrders({
        technician_id: technicianId,
        status: orderStatusParam,
        limit: 50,
        sort_by: "deadline",
        sort_dir: "asc",
      }),
    enabled: Number.isFinite(technicianId),
  });

  if (!technician) {
    return (
      <div className="p-8 text-center">
        <p className="text-muted-foreground">Техник не найден</p>
        <Link to="/manager/technicians">
          <Button className="mt-4">
            <ArrowLeft className="mr-2 h-4 w-4" /> Назад
          </Button>
        </Link>
      </div>
    );
  }

  const load = technician.today_load ?? 0;
  const nameClass = getTechnicianLoadColorClass(load);

  return (
    <div className="space-y-6">
      <div className="flex items-center gap-4">
        <Link to="/manager/technicians">
          <Button variant="ghost" size="icon">
            <ArrowLeft className="h-5 w-5" />
          </Button>
        </Link>
        <div>
          <h1 className={`text-3xl font-bold ${nameClass}`}>
            {technician.first_name} {technician.last_name}
          </h1>
          <p className="text-sm text-muted-foreground">
            Загрузка на сегодня: {formatTechnicianLoadLabel(load)}
          </p>
        </div>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Основная информация</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid gap-4 md:grid-cols-2">
            <div>
              <p className="text-sm text-muted-foreground">Email</p>
              <p className="font-medium">{technician.email}</p>
            </div>
            <div>
              <p className="text-sm text-muted-foreground">Специализация</p>
              <p className="font-medium">{technician.specialization || "Универсал"}</p>
            </div>
            <div>
              <p className="text-sm text-muted-foreground">Опыт работы</p>
              <p className="font-medium">{technician.experience_years} лет</p>
            </div>
            <div>
              <p className="text-sm text-muted-foreground">Загрузка</p>
              <Badge variant="outline">{formatTechnicianLoadLabel(load)}</Badge>
            </div>
          </div>

          <div className="flex items-center gap-2">
            <Star className="h-5 w-5 fill-yellow-400 text-yellow-400" />
            <span className="text-lg font-semibold">{technician.rating.toFixed(1)}</span>
            <span className="text-muted-foreground">({technician.completed_orders} выполненных заказов)</span>
          </div>
        </CardContent>
      </Card>

      {stats && (
        <>
          <div className="grid gap-4 md:grid-cols-4">
            <Card>
              <CardHeader className="flex flex-row items-center justify-between pb-2">
                <CardTitle className="text-sm font-medium">Всего заказов</CardTitle>
                <Award className="h-4 w-4 text-muted-foreground" />
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold">{stats.total_orders}</div>
              </CardContent>
            </Card>

            <Card>
              <CardHeader className="flex flex-row items-center justify-between pb-2">
                <CardTitle className="text-sm font-medium">Выполнено</CardTitle>
                <CheckCircle className="h-4 w-4 text-green-500" />
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold">{stats.completed_orders}</div>
              </CardContent>
            </Card>

            <Card>
              <CardHeader className="flex flex-row items-center justify-between pb-2">
                <CardTitle className="text-sm font-medium">В работе</CardTitle>
                <Award className="h-4 w-4 text-yellow-500" />
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold">{stats.in_progress_orders}</div>
              </CardContent>
            </Card>

            <Card>
              <CardHeader className="flex flex-row items-center justify-between pb-2">
                <CardTitle className="text-sm font-medium">Ср. время</CardTitle>
                <Award className="h-4 w-4 text-muted-foreground" />
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold">
                  {stats.average_completion_days?.toFixed(1) || "—"}
                </div>
                <p className="text-xs text-muted-foreground">дней</p>
              </CardContent>
            </Card>
          </div>

          <Card>
            <CardHeader>
              <CardTitle>Выполнено заказов по месяцам</CardTitle>
            </CardHeader>
            <CardContent>
              {stats.monthly_completed && stats.monthly_completed.length > 0 ? (
                <div className="h-64">
                  <ResponsiveContainer width="100%" height="100%">
                    <BarChart data={stats.monthly_completed}>
                      <CartesianGrid strokeDasharray="3 3" />
                      <XAxis dataKey="month" />
                      <YAxis allowDecimals={false} />
                      <Tooltip formatter={(value: number) => [`${value} заказов`, "Выполнено"]} />
                      <Bar dataKey="count" fill="hsl(var(--primary))" radius={[4, 4, 0, 0]} />
                    </BarChart>
                  </ResponsiveContainer>
                </div>
              ) : (
                <p className="text-center text-muted-foreground py-8">Нет данных</p>
              )}
            </CardContent>
          </Card>
        </>
      )}

      <Card>
        <CardHeader className="flex flex-row flex-wrap items-center justify-between gap-4">
          <CardTitle>Заказы техника</CardTitle>
          <select
            value={statusFilter}
            onChange={(e) => setStatusFilter(e.target.value)}
            className="flex h-9 rounded-md border border-input bg-background px-3 text-sm"
          >
            {ORDER_STATUS_FILTERS.map((opt) => (
              <option key={opt.value || "all"} value={opt.value}>
                {opt.label}
              </option>
            ))}
          </select>
        </CardHeader>
        <CardContent className="p-0">
          {ordersLoading ? (
            <p className="p-6 text-muted-foreground">Загрузка заказов...</p>
          ) : !ordersData?.items?.length ? (
            <p className="p-6 text-center text-muted-foreground">Заказы не найдены</p>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Номер</TableHead>
                  <TableHead>Статус</TableHead>
                  <TableHead>Дедлайн</TableHead>
                  <TableHead>Сумма</TableHead>
                  <TableHead></TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {ordersData.items.map((order) => (
                  <TableRow key={order.id}>
                    <TableCell className="font-medium">{order.order_number}</TableCell>
                    <TableCell>
                      <StatusBadge status={order.status} />
                    </TableCell>
                    <TableCell>{order.deadline ? formatDate(order.deadline) : "—"}</TableCell>
                    <TableCell>{formatOrderMoney(order.final_price)}</TableCell>
                    <TableCell>
                      <Link to={`/manager/orders/${order.id}`}>
                        <Button variant="ghost" size="sm">
                          Открыть
                        </Button>
                      </Link>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>
    </div>
  );
};
