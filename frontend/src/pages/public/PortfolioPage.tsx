import { useEffect, useState } from "react";
import { Link } from "react-router-dom";

import { apiClient } from "@/api/axios";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Star } from "lucide-react";
import { toast } from "react-toastify";
import { PublicLayout } from "@/components/layout/PublicLayout";

interface Technician {
  id: number;
  user_id?: string;
  user?: { first_name?: string; last_name?: string };
  first_name?: string;
  last_name?: string;
  specialization?: string;
  experience_years: number;
  rating: number;
  completed_orders: number;
  portfolio_description?: string;
}

export const PortfolioPage = () => {
  const [technicians, setTechnicians] = useState<Technician[]>([]);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    apiClient.get<Technician[]>("/technicians?available_only=false")
      .then((res) => setTechnicians(res.data))
      .catch(() => toast.error("Ошибка загрузки"))
      .finally(() => setIsLoading(false));
  }, []);

  // Функция для получения имени техника
  const getTechnicianName = (tech: Technician) => {
    if (tech.first_name && tech.last_name) {
      return `${tech.first_name} ${tech.last_name}`;
    }
    if (tech.user?.first_name && tech.user?.last_name) {
      return `${tech.user.first_name} ${tech.user.last_name}`;
    }
    return "Техник";
  };

  const getInitials = (tech: Technician) => {
    const name = getTechnicianName(tech);
    const parts = name.split(" ");
    return (parts[0]?.[0] || "Т") + (parts[1]?.[0] || "");
  };

  return (
    <PublicLayout title="Наши специалисты">
        <div className="grid gap-6 sm:grid-cols-2 lg:grid-cols-3">
          {isLoading ? (
            Array(6).fill(0).map((_, i) => (
              <Card key={i} className="animate-pulse">
                <CardHeader>
                  <div className="h-12 w-12 rounded-full bg-muted" />
                </CardHeader>
                <CardContent className="space-y-2">
                  <div className="h-4 w-3/4 bg-muted rounded" />
                  <div className="h-3 w-1/2 bg-muted rounded" />
                </CardContent>
              </Card>
            ))
          ) : (
            technicians.map((tech) => (
              <Card key={tech.id}>
                <CardHeader>
                  <div className="flex items-center gap-4">
                    <div className="flex h-12 w-12 items-center justify-center rounded-full bg-primary/10">
                      <span className="text-lg font-semibold text-primary">
                        {getInitials(tech)}
                      </span>
                    </div>
                    <div>
                      <CardTitle>{getTechnicianName(tech)}</CardTitle>
                      <CardDescription>{tech.specialization || "Универсал"}</CardDescription>
                    </div>
                  </div>
                </CardHeader>
                <CardContent className="space-y-4">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-1">
                      <Star className="h-4 w-4 fill-yellow-400 text-yellow-400" />
                      <span className="font-medium">{tech.rating.toFixed(1)}</span>
                    </div>
                    <Badge variant="outline">{tech.experience_years} лет опыта</Badge>
                  </div>
                  <p className="text-sm text-muted-foreground">
                    Выполнено заказов: <span className="font-medium">{tech.completed_orders}</span>
                  </p>
                  {tech.portfolio_description && (
                    <p className="text-sm text-muted-foreground line-clamp-3">
                      {tech.portfolio_description}
                    </p>
                  )}
                </CardContent>
              </Card>
            ))
          )}
        </div>
    </PublicLayout>
  );
};
