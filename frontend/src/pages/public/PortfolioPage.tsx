import { useState, useEffect } from "react";
import { Link } from "react-router-dom";

import { apiClient } from "@/api/axios";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { SearchAndFilter, type FilterConfig } from "@/components/shared/SearchAndFilter";
import { Pagination } from "@/components/shared/Pagination";
import { PublicLayout } from "@/components/layout/PublicLayout";
import type { Technician } from "@/types";
import { toast } from "react-toastify";
import { Star, Calendar, Award, FileText, Users, Building2 } from "lucide-react";

export const PortfolioPage = () => {
  const [technicians, setTechnicians] = useState<Technician[]>([]);
  const [total, setTotal] = useState(0);
  const [page, setPage] = useState(1);
  const [search, setSearch] = useState("");
  const [specialization, setSpecialization] = useState("");
  const [availableOnly, setAvailableOnly] = useState(false);
  const limit = 10;

  useEffect(() => {
    const params = new URLSearchParams({ 
      page: String(page), 
      limit: String(limit),
      available_only: String(availableOnly)  // This will be 'true' or 'false' string
    });
    if (search) params.append("search", search);
    if (specialization) params.append("specialization", specialization);

      apiClient.get<{ items: Technician[]; total: number }>(`/technicians?${params}`)
      .then((res) => { 
        // Implement defensive handling of API response
        const techData = res.data?.items || [];
        const totalData = res.data?.total || 0;
        
        setTechnicians(techData); 
        setTotal(totalData); 
      })
      .catch((error) => {
        console.error("Error fetching technicians:", error);  // Better error logging
        toast.error("Ошибка загрузки специалистов");
      });
  }, [page, search, specialization, availableOnly]);

  const filters: FilterConfig[] = [
    { 
      key: "specialization", 
      label: "Специализация", 
      type: "select", 
      options: [
        { value: "orthopedist", label: "Ортопедический техник" },
        { value: "orthodontist", label: "Ортодонтический техник" },
        { value: "therapist", label: "Терапевтический техник" },
        { value: "surgeon", label: "Хирургический техник" },
      ]
    },
  ];

  return (
    <PublicLayout title="Портфолио специалистов">
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 mb-6">
        <SearchAndFilter
          onSearch={setSearch}
          onFilter={(f) => setSpecialization(f.specialization || "")}
          filters={filters}
        />
        <div className="flex items-center gap-2">
          <label className="flex items-center gap-2 text-sm">
            <input
              type="checkbox"
              checked={availableOnly}
              onChange={(e) => setAvailableOnly(e.target.checked)}
              className="rounded"
            />
            Только доступные
          </label>
        </div>
      </div>
      
      <div className="mt-6 grid gap-6 md:grid-cols-2 lg:grid-cols-3">
        {(!technicians || technicians.length === 0) ? (
          <div className="col-span-full text-center py-12">
            <p className="text-muted-foreground">Специалисты не найдены</p>
          </div>
        ) : (
          (technicians || []).map((tech) => (
            <Link key={tech?.id || Math.random()} to={`/portfolio/${tech?.id}`}>
              <Card className="transition-shadow hover:shadow-lg h-full flex flex-col">
                <CardHeader className="pb-3">
                  <div className="flex justify-between items-start">
                    <div className="flex items-center gap-3">
                      <div className="h-12 w-12 rounded-full bg-primary/10 flex items-center justify-center">
                        <Award className="h-6 w-6 text-primary" />
                      </div>
                      <div>
                        <CardTitle className="text-lg">
                          {tech?.first_name} {tech?.last_name}
                        </CardTitle>
                        <p className="text-xs text-muted-foreground mt-1">
                          {tech?.specialization || "Специалист"}
                        </p>
                      </div>
                    </div>
                    <Badge variant={tech?.is_available ? "default" : "secondary"}>
                      {tech?.is_available ? "Свободен" : "Занят"}
                    </Badge>
                  </div>
                </CardHeader>
                <CardContent className="flex-grow">
                  <div className="flex items-center gap-1 mb-2">
                    <Star className="h-4 w-4 fill-yellow-400 text-yellow-400" />
                    <span className="font-medium">{tech?.rating?.toFixed(1)}</span>
                    <span className="text-muted-foreground ml-2">
                      ({tech?.completed_orders} заказов)
                    </span>
                  </div>
                  
                  <div className="flex items-center gap-2 text-sm text-muted-foreground mb-3">
                    <Calendar className="h-4 w-4" />
                    <span>Опыт: {tech?.experience_years} лет</span>
                  </div>
                  
                  <p className="text-sm text-muted-foreground line-clamp-3">
                    {tech?.portfolio_description || "Информация о специалисте отсутствует."}
                  </p>
                  
                  <Button 
                    variant="outline" 
                    className="w-full mt-4"
                    onClick={(e) => {
                      e.preventDefault();
                      window.location.href = `/portfolio/${tech?.id}`;
                    }}
                  >
                    Подробнее
                  </Button>
                </CardContent>
              </Card>
            </Link>
          ))
        )}
      </div>
      
      {total > 0 && (
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