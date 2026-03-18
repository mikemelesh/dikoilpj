import { useParams, Link } from "react-router-dom";
import { useQuery } from "@tanstack/react-query";
import { apiClient } from "@/api/axios";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { ArrowLeft, Star, Award, CheckCircle } from "lucide-react";
import { BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, CartesianGrid } from "recharts";

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

export const ManagerTechnicianDetail = () => {
  const { id } = useParams<{ id: string }>();

  const { data: technician } = useQuery<Technician>({
    queryKey: ["technician-detail", id],
    queryFn: () => apiClient.get(`/technicians/${id}`).then(r => r.data),
  });

  const { data: stats } = useQuery<TechnicianStats>({
    queryKey: ["technician-stats", id],
    queryFn: () => apiClient.get(`/technicians/${id}/stats`).then(r => r.data),
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

  return (
    <div className="space-y-6">
      <div className="flex items-center gap-4">
        <Link to="/manager/technicians">
          <Button variant="ghost" size="icon">
            <ArrowLeft className="h-5 w-5" />
          </Button>
        </Link>
        <h1 className="text-3xl font-bold">{technician.first_name} {technician.last_name}</h1>
      </div>

      {/* Информация о технике */}
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
              <p className="text-sm text-muted-foreground">Статус</p>
              <Badge variant={technician.is_available ? "default" : "secondary"}>
                {technician.is_available ? "Доступен" : "Недоступен"}
              </Badge>
            </div>
          </div>

          <div className="flex items-center gap-2">
            <Star className="h-5 w-5 fill-yellow-400 text-yellow-400" />
            <span className="text-lg font-semibold">{technician.rating.toFixed(1)}</span>
            <span className="text-muted-foreground">({technician.completed_orders} выполненных заказов)</span>
          </div>
        </CardContent>
      </Card>

      {/* Статистика */}
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
    </div>
  );
};
