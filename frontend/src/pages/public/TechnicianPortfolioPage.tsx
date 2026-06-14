import { useEffect, useState } from "react";
import { Link, useParams } from "react-router-dom";
import {
  Star,
  Calendar,
  Award,
  FileText,
  Clock,
  Wrench,
  CheckCircle,
  ArrowLeft,
} from "lucide-react";

import { getTechnicianPortfolio, type TechnicianPortfolio } from "@/api/technicians";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { PublicLayout } from "@/components/layout/PublicLayout";
import { formatDate } from "@/utils";
import { showApiError } from "@/lib/apiError";

const getTechnicianName = (tech: TechnicianPortfolio) =>
  [tech.first_name, tech.last_name].filter(Boolean).join(" ").trim() || "Специалист";

export const TechnicianPortfolioPage = () => {
  const { id } = useParams<{ id: string }>();
  const [technician, setTechnician] = useState<TechnicianPortfolio | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(false);

  useEffect(() => {
    const fetchData = async () => {
      if (!id) return;
      setLoading(true);
      setError(false);
      try {
        const data = await getTechnicianPortfolio(Number(id));
        setTechnician(data);
      } catch (err) {
        setError(true);
        showApiError(err, "Не удалось загрузить портфолио специалиста");
      } finally {
        setLoading(false);
      }
    };

    fetchData();
  }, [id]);

  if (loading) {
    return (
      <PublicLayout title="Портфолио специалиста">
        <div className="py-16 text-center text-muted-foreground">Загрузка...</div>
      </PublicLayout>
    );
  }

  if (error || !technician) {
    return (
      <PublicLayout title="Портфолио специалиста">
        <div className="py-16 text-center space-y-4">
          <p className="text-destructive text-lg">Специалист не найден</p>
          <Link to="/portfolio">
            <Button variant="outline">
              <ArrowLeft className="mr-2 h-4 w-4" />
              К списку специалистов
            </Button>
          </Link>
        </div>
      </PublicLayout>
    );
  }

  return (
    <PublicLayout title={`Портфолио — ${getTechnicianName(technician)}`}>
      <div className="mb-6">
        <Link to="/portfolio" className="inline-flex items-center gap-2 text-primary hover:underline">
          <ArrowLeft className="h-4 w-4" />
          <span>Все специалисты</span>
        </Link>
      </div>

      <div className="grid gap-8 lg:grid-cols-3">
        <div className="lg:col-span-1 space-y-6">
          <Card className="overflow-hidden">
            <div className="bg-primary p-6 text-primary-foreground">
              <div className="flex flex-col items-center text-center">
                <div className="h-20 w-20 rounded-full bg-primary-foreground/20 flex items-center justify-center mb-4">
                  <Wrench className="h-10 w-10" />
                </div>
                <h1 className="text-2xl font-bold">{getTechnicianName(technician)}</h1>
                <p className="opacity-90 mt-1">
                  {technician.specialization || "Зубной техник"}
                </p>
              </div>
            </div>
            <CardContent className="pt-6 space-y-4">
              <div className="flex items-center gap-2">
                <Star className="h-4 w-4 text-yellow-500" />
                <span>Рейтинг: <strong>{technician.rating.toFixed(1)}</strong></span>
              </div>

              <div className="flex items-center gap-2">
                <Calendar className="h-4 w-4 text-muted-foreground" />
                <span>Опыт: {technician.experience_years} лет</span>
              </div>

              <div className="flex items-center gap-2">
                <FileText className="h-4 w-4 text-muted-foreground" />
                <span>Выполнено заказов: {technician.completed_orders}</span>
              </div>

              {technician.in_progress_orders > 0 && (
                <div className="flex items-center gap-2">
                  <CheckCircle className="h-4 w-4 text-muted-foreground" />
                  <span>В работе: {technician.in_progress_orders}</span>
                </div>
              )}

              {technician.average_completion_days != null && (
                <div className="flex items-center gap-2">
                  <Clock className="h-4 w-4 text-muted-foreground" />
                  <span>
                    Среднее время выполнения:{" "}
                    <strong>{technician.average_completion_days.toFixed(1)} дн.</strong>
                  </span>
                </div>
              )}

              <Badge variant={technician.is_available ? "default" : "secondary"}>
                {technician.is_available ? "Доступен для новых заказов" : "Занят"}
              </Badge>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>Последние работы</CardTitle>
            </CardHeader>
            <CardContent>
              {technician.recent_works.length > 0 ? (
                <div className="space-y-3">
                  {technician.recent_works.map((work) => (
                    <div key={work.order_number} className="border rounded-lg p-3">
                      <div className="flex justify-between gap-2">
                        <h4 className="font-medium">Заказ {work.order_number}</h4>
                        <span className="text-sm text-muted-foreground shrink-0">
                          {work.items_count} поз.
                        </span>
                      </div>
                      {work.completion_days != null && (
                        <p className="text-sm text-muted-foreground mt-1">
                          Срок выполнения: {work.completion_days} дн.
                        </p>
                      )}
                      {work.completed_at && (
                        <p className="text-xs text-muted-foreground mt-1">
                          Завершён: {formatDate(work.completed_at)}
                        </p>
                      )}
                    </div>
                  ))}
                </div>
              ) : (
                <p className="text-muted-foreground">Пока нет завершённых работ</p>
              )}
            </CardContent>
          </Card>
        </div>

        <div className="lg:col-span-2 space-y-6">
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Award className="h-5 w-5" />
                О специалисте
              </CardTitle>
            </CardHeader>
            <CardContent>
              <p className="text-muted-foreground whitespace-pre-line">
                {technician.portfolio_description || "Информация о специалисте отсутствует."}
              </p>
            </CardContent>
          </Card>

          <div className="grid gap-4 sm:grid-cols-3">
            <Card>
              <CardContent className="pt-6 text-center">
                <p className="text-3xl font-bold text-primary">{technician.rating.toFixed(1)}</p>
                <p className="text-sm text-muted-foreground mt-1">Рейтинг</p>
              </CardContent>
            </Card>
            <Card>
              <CardContent className="pt-6 text-center">
                <p className="text-3xl font-bold text-primary">{technician.completed_orders}</p>
                <p className="text-sm text-muted-foreground mt-1">Выполнено заказов</p>
              </CardContent>
            </Card>
            <Card>
              <CardContent className="pt-6 text-center">
                <p className="text-3xl font-bold text-primary">
                  {technician.average_completion_days != null
                    ? `${technician.average_completion_days.toFixed(1)}`
                    : "—"}
                </p>
                <p className="text-sm text-muted-foreground mt-1">Сред. время (дней)</p>
              </CardContent>
            </Card>
          </div>

          <div className="flex flex-col sm:flex-row gap-4">
            <Button className="flex-1" asChild>
              <Link to="/contact">Связаться с нами</Link>
            </Button>
            <Button variant="outline" className="flex-1" asChild>
              <Link to="/services">Посмотреть услуги</Link>
            </Button>
          </div>
        </div>
      </div>
    </PublicLayout>
  );
};
