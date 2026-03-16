import { useEffect, useState } from "react";
import { Link } from "react-router-dom";

import { apiClient } from "@/api/axios";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Star } from "lucide-react";
import { toast } from "react-toastify";

interface Technician {
  id: number;
  user: { first_name?: string; last_name?: string };
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

  return (
    <div className="container mx-auto px-4 py-8">
      <h1 className="mb-8 text-3xl font-bold">Наши специалисты</h1>
      <div className="grid gap-6 sm:grid-cols-2 lg:grid-cols-3">
        {technicians.map((tech) => (
          <Card key={tech.id}>
            <CardHeader>
              <div className="flex items-center gap-4">
                <div className="flex h-12 w-12 items-center justify-center rounded-full bg-primary/10">
                  <span className="text-lg font-semibold">
                    {tech.user.first_name?.[0]}{tech.user.last_name?.[0]}
                  </span>
                </div>
                <div>
                  <CardTitle>{tech.user.first_name} {tech.user.last_name}</CardTitle>
                  <CardDescription>{tech.specialization}</CardDescription>
                </div>
              </div>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-1">
                  <Star className="h-4 w-4 fill-yellow-400 text-yellow-400" />
                  <span>{tech.rating.toFixed(1)}</span>
                </div>
                <Badge variant="outline">{tech.experience_years} лет опыта</Badge>
              </div>
              <p className="text-sm text-muted-foreground">
                Выполнено заказов: {tech.completed_orders}
              </p>
              {tech.portfolio_description && (
                <p className="text-sm text-muted-foreground line-clamp-3">
                  {tech.portfolio_description}
                </p>
              )}
            </CardContent>
          </Card>
        ))}
      </div>
    </div>
  );
};
