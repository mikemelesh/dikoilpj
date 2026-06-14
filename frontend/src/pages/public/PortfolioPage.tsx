import { useState, useEffect } from "react";
import { Link } from "react-router-dom";

import { getPublicTechnicians } from "@/api/technicians";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { SearchAndFilter } from "@/components/shared/SearchAndFilter";
import { Pagination } from "@/components/shared/Pagination";
import { PublicLayout } from "@/components/layout/PublicLayout";
import type { Technician } from "@/types";
import { toast } from "react-toastify";
import { showApiError } from "@/lib/apiError";
import { Star, Calendar, Award } from "lucide-react";

const getTechnicianName = (tech: Technician) => {
  const name = [tech.first_name, tech.last_name].filter(Boolean).join(" ").trim();
  return name || "Специалист";
};

export const PortfolioPage = () => {
  const [technicians, setTechnicians] = useState<Technician[]>([]);
  const [total, setTotal] = useState(0);
  const [page, setPage] = useState(1);
  const [search, setSearch] = useState("");
  const [availableOnly, setAvailableOnly] = useState(false);
  const [loading, setLoading] = useState(true);
  const limit = 9;

  useEffect(() => {
    setLoading(true);
    getPublicTechnicians({
      page,
      limit,
      search: search.trim() || undefined,
      available_only: availableOnly,
    })
      .then((res) => {
        setTechnicians(res.items);
        setTotal(res.total);
      })
      .catch((error) => {
        showApiError(error, "Ошибка загрузки специалистов");
      })
      .finally(() => setLoading(false));
  }, [page, search, availableOnly]);

  return (
    <PublicLayout title="Портфолио специалистов">
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 mb-6">
        <SearchAndFilter
          onSearch={(value) => {
            setPage(1);
            setSearch(value);
          }}
          onFilter={() => {}}
          filters={[]}
          searchPlaceholder="Поиск по имени или специализации..."
        />
        <label className="flex items-center gap-2 text-sm whitespace-nowrap">
          <input
            type="checkbox"
            checked={availableOnly}
            onChange={(e) => {
              setPage(1);
              setAvailableOnly(e.target.checked);
            }}
            className="rounded"
          />
          Только доступные
        </label>
      </div>

      {loading ? (
        <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-3">
          {[...Array(3)].map((_, i) => (
            <Card key={i} className="animate-pulse h-56" />
          ))}
        </div>
      ) : technicians.length === 0 ? (
        <div className="text-center py-12">
          <p className="text-muted-foreground">Специалисты не найдены</p>
        </div>
      ) : (
        <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-3">
          {technicians.map((tech) => (
            <Link key={tech.id} to={`/portfolio/${tech.id}`} className="block h-full">
              <Card className="transition-shadow hover:shadow-lg h-full flex flex-col">
                <CardHeader className="pb-3">
                  <div className="flex justify-between items-start gap-3">
                    <div className="flex items-center gap-3 min-w-0">
                      <div className="h-12 w-12 shrink-0 rounded-full bg-primary/10 flex items-center justify-center">
                        <Award className="h-6 w-6 text-primary" />
                      </div>
                      <div className="min-w-0">
                        <CardTitle className="text-lg truncate">
                          {getTechnicianName(tech)}
                        </CardTitle>
                        <p className="text-xs text-muted-foreground mt-1 truncate">
                          {tech.specialization || "Зубной техник"}
                        </p>
                      </div>
                    </div>
                    <Badge variant={tech.is_available ? "default" : "secondary"}>
                      {tech.is_available ? "Свободен" : "Занят"}
                    </Badge>
                  </div>
                </CardHeader>
                <CardContent className="flex-grow flex flex-col">
                  <div className="flex items-center gap-1 mb-2">
                    <Star className="h-4 w-4 fill-yellow-400 text-yellow-400" />
                    <span className="font-medium">{tech.rating.toFixed(1)}</span>
                    <span className="text-muted-foreground ml-2">
                      ({tech.completed_orders} заказов)
                    </span>
                  </div>

                  <div className="flex items-center gap-2 text-sm text-muted-foreground mb-3">
                    <Calendar className="h-4 w-4" />
                    <span>Опыт: {tech.experience_years} лет</span>
                  </div>

                  <p className="text-sm text-muted-foreground line-clamp-3 flex-grow">
                    {tech.portfolio_description || "Информация о специалисте отсутствует."}
                  </p>

                  <Button variant="outline" className="w-full mt-4 pointer-events-none">
                    Подробнее
                  </Button>
                </CardContent>
              </Card>
            </Link>
          ))}
        </div>
      )}

      {total > limit && (
        <div className="mt-8">
          <Pagination total={total} page={page} limit={limit} onPageChange={setPage} />
        </div>
      )}

      <div className="mt-12 p-6 bg-muted rounded-xl">
        <h2 className="text-xl font-bold mb-4">Требования к работе</h2>
        <p className="text-muted-foreground mb-4">
          Узнайте, какие требования мы предъявляем к изготовлению ортопедических конструкций,
          включая требования к снимкам и сроки изготовления.
        </p>
        <Link to="/requirements">
          <Button>Ознакомиться с требованиями</Button>
        </Link>
      </div>
    </PublicLayout>
  );
};
