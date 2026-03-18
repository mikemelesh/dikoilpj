import { useQuery } from "@tanstack/react-query";
import { getTechnicianStats } from "@/api/technicians";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Star, Clock, TrendingUp, Award } from "lucide-react";
import { BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, CartesianGrid } from "recharts";

export const TechStats = () => {
  const { data: stats, isLoading } = useQuery({
    queryKey: ["tech-stats"],
    queryFn: getTechnicianStats,
  });

  if (isLoading) return <div className="p-8 text-center">Загрузка...</div>;
  if (!stats) return <div className="p-8 text-center">Ошибка загрузки</div>;

  return (
    <div className="space-y-6">
      <h1 className="text-3xl font-bold">Моя статистика</h1>

      {/* Основные метрики */}
      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-sm font-medium">Рейтинг</CardTitle>
            <Star className="h-4 w-4 text-yellow-500" />
          </CardHeader>
          <CardContent>
            <div className="flex items-baseline gap-2">
              <span className="text-3xl font-bold">{stats.rating.toFixed(1)}</span>
              <span className="text-sm text-muted-foreground">/ 5.0</span>
            </div>
            <div className="flex mt-2">
              {[...Array(5)].map((_, i) => (
                <Star
                  key={i}
                  className={`h-4 w-4 ${i < Math.round(stats.rating) ? "fill-yellow-400 text-yellow-400" : "text-muted-foreground"}`}
                />
              ))}
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-sm font-medium">Ср. время</CardTitle>
            <Clock className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">
              {stats.average_completion_days?.toFixed(1) || "—"}
            </div>
            <p className="text-xs text-muted-foreground">дней на заказ</p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-sm font-medium">Выполнено</CardTitle>
            <Award className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{stats.completed_orders}</div>
            <p className="text-xs text-muted-foreground">всего заказов</p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-sm font-medium">В работе</CardTitle>
            <TrendingUp className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{stats.in_progress_orders}</div>
            <p className="text-xs text-muted-foreground">активных заказов</p>
          </CardContent>
        </Card>
      </div>

      {/* График по месяцам */}
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
                  <Tooltip
                    formatter={(value: number) => [`${value} заказов`, "Выполнено"]}
                    labelFormatter={(label) => `Месяц: ${label}`}
                  />
                  <Bar dataKey="count" fill="hsl(var(--primary))" radius={[4, 4, 0, 0]} />
                </BarChart>
              </ResponsiveContainer>
            </div>
          ) : (
            <p className="text-center text-muted-foreground py-8">Нет данных</p>
          )}
        </CardContent>
      </Card>

      {/* Доход */}
      {stats.total_earnings > 0 && (
        <Card>
          <CardHeader>
            <CardTitle>Общий доход</CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-3xl font-bold">
              {new Intl.NumberFormat("ru-RU", { style: "currency", currency: "BYN", minimumFractionDigits: 2 }).format(stats.total_earnings)}
            </p>
            <p className="text-sm text-muted-foreground">За все выполненные заказы</p>
          </CardContent>
        </Card>
      )}
    </div>
  );
};
