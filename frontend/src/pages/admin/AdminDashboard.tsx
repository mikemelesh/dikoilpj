import { useQuery } from "@tanstack/react-query";
import { Link } from "react-router-dom";
import { apiClient } from "@/api/axios";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Users, Package, TrendingUp, MessageSquare, Star, Download } from "lucide-react";
import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer } from "recharts";
import { ExportButton } from "@/components/shared/ExportButton";
import { formatDate, formatDateTime } from "@/utils";

interface OrderAnalytics { total: number; by_status: Record<string, number>; by_priority: Record<string, number>; avg_completion_days?: number }
interface RevenueAnalytics { total: number; by_period: { date: string; amount: number }[]; by_service_category: { category_id: number; category_name: string; total: number }[] }
interface UserAnalytics { total: number; by_role: Record<string, number>; active: number }
interface ActionLog { id: number; user_id?: string; user_email?: string; action_type: string; entity_type: string; entity_id?: string; description?: string; ip_address?: string; created_at: string }
interface Review { id: number; client_name?: string; order_id?: number; order_number?: string; rating: number; text?: string; is_moderated: boolean; is_published: boolean; created_at: string }

export const AdminDashboard = () => {
  const { data: orderAnalytics } = useQuery<OrderAnalytics>({ queryKey: ["admin-order-analytics"], queryFn: () => apiClient.get("/analytics/orders").then(r => r.data) });
  const { data: revenueAnalytics } = useQuery<RevenueAnalytics>({ queryKey: ["admin-revenue-analytics"], queryFn: () => apiClient.get("/analytics/revenue").then(r => r.data) });
  const { data: userAnalytics } = useQuery<UserAnalytics>({ queryKey: ["admin-user-analytics"], queryFn: () => apiClient.get("/analytics/users").then(r => r.data) });
  const { data: logs } = useQuery<{ items: ActionLog[]; total: number }>({ queryKey: ["admin-logs-dashboard"], queryFn: () => apiClient.get("/admin/logs?limit=10").then(r => r.data) });
  const { data: pendingReviews } = useQuery<{ items: Review[]; total: number }>({ queryKey: ["admin-pending-reviews"], queryFn: () => apiClient.get("/reviews/pending").then(r => r.data) });

  const totalOrders = orderAnalytics?.total || 0;
  const totalRevenue = revenueAnalytics?.total || 0;
  const totalUsers = userAnalytics?.total || 0;
  const logsCount = logs?.total || 0;
  const pendingReviewsCount = pendingReviews?.total || 0;

  // Данные для графика (последние 30 дней)
  const chartData = revenueAnalytics?.by_period?.slice(-30).map((d) => ({
    date: formatDate(d.date),
    amount: d.amount,
  })) || [];

  return (
    <div className="space-y-6">
      <div className="flex justify-between items-center">
        <h1 className="text-3xl font-bold">Панель администратора</h1>
        <ExportButton resource="orders" title="Отчёт по всем заказам" />
      </div>

      {/* KPI карточки */}
      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-sm font-medium">Пользователей</CardTitle>
            <Users className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{totalUsers > 0 ? totalUsers : "—"}</div>
            <p className="text-xs text-muted-foreground">Всего в системе</p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-sm font-medium">Заказов за месяц</CardTitle>
            <Package className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{orderAnalytics?.by_status ? Object.values(orderAnalytics.by_status).reduce((a, b) => a + b, 0) : "—"}</div>
            <p className="text-xs text-muted-foreground">Активных заказов</p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-sm font-medium">Выручка</CardTitle>
            <TrendingUp className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{new Intl.NumberFormat("ru-RU", { style: "currency", currency: "BYN", minimumFractionDigits: 2 }).format(totalRevenue)}</div>
            <p className="text-xs text-muted-foreground">За всё время</p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-sm font-medium">Отзывов</CardTitle>
            <MessageSquare className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{pendingReviewsCount}</div>
            <p className="text-xs text-muted-foreground">Ожидают модерации</p>
          </CardContent>
        </Card>
      </div>

      {/* График выручки */}
      <Card>
        <CardHeader>
          <CardTitle>Динамика выручки (30 дней)</CardTitle>
        </CardHeader>
        <CardContent>
          {chartData.length > 0 ? (
            <div className="h-64">
              <ResponsiveContainer width="100%" height="100%">
                <LineChart data={chartData}>
                  <CartesianGrid strokeDasharray="3 3" />
                  <XAxis dataKey="date" />
                  <YAxis />
                  <Tooltip formatter={(value: number) => new Intl.NumberFormat("ru-RU", { style: "currency", currency: "BYN", minimumFractionDigits: 2 }).format(value)} />
                  <Line type="monotone" dataKey="amount" stroke="hsl(var(--primary))" strokeWidth={2} />
                </LineChart>
              </ResponsiveContainer>
            </div>
          ) : (
            <p className="text-center text-muted-foreground py-8">Нет данных</p>
          )}
        </CardContent>
      </Card>

      {/* Последние логи */}
      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <div>
              <CardTitle>Последние действия</CardTitle>
              <CardDescription>10 последних записей логов</CardDescription>
            </div>
            <Link to="/admin/logs">
              <Button variant="outline" size="sm">Все логи</Button>
            </Link>
          </div>
        </CardHeader>
        <CardContent>
          {logs?.items && logs.items.length > 0 ? (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Дата</TableHead>
                  <TableHead>Пользователь</TableHead>
                  <TableHead>Действие</TableHead>
                  <TableHead>Описание</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {logs.items.map((log) => (
                  <TableRow key={log.id}>
                    <TableCell className="text-sm">{formatDateTime(log.created_at)}</TableCell>
                    <TableCell>{log.user_email || "Система"}</TableCell>
                    <TableCell><Badge variant="outline">{log.action_type}</Badge></TableCell>
                    <TableCell className="text-sm text-muted-foreground">{log.description || "—"}</TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          ) : (
            <p className="text-center text-muted-foreground py-8">Нет записей</p>
          )}
        </CardContent>
      </Card>

      {/* Непроверенные отзывы */}
      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <div>
              <CardTitle>Отзывы на модерации</CardTitle>
              <CardDescription>Требуют проверки</CardDescription>
            </div>
            <Link to="/admin/reviews">
              <Button variant="outline" size="sm">Все отзывы</Button>
            </Link>
          </div>
        </CardHeader>
        <CardContent>
          {pendingReviews?.items && pendingReviews.items.length > 0 ? (
            <div className="space-y-4">
              {pendingReviews.items.slice(0, 5).map((review) => (
                <div key={review.id} className="flex items-start justify-between gap-4 p-4 border rounded-lg">
                  <div className="space-y-1">
                    <div className="flex items-center gap-2">
                      <div className="flex">
                        {[...Array(5)].map((_, i) => (
                          <Star key={i} className={`h-4 w-4 ${i < review.rating ? "fill-yellow-400 text-yellow-400" : "text-muted-foreground"}`} />
                        ))}
                      </div>
                      <span className="text-sm text-muted-foreground">{formatDate(review.created_at)}</span>
                    </div>
                    <p className="font-medium">{review.client_name || "Аноним"}</p>
                    {review.text && <p className="text-sm text-muted-foreground line-clamp-2">{review.text}</p>}
                  </div>
                  <Link to="/admin/reviews">
                    <Button variant="outline" size="sm">Проверить</Button>
                  </Link>
                </div>
              ))}
            </div>
          ) : (
            <p className="text-center text-muted-foreground py-8">Нет отзывов на модерации</p>
          )}
        </CardContent>
      </Card>
    </div>
  );
};
