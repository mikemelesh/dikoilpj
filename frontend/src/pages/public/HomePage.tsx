import { useEffect, useState } from "react";
import { Link, useNavigate } from "react-router-dom";

import { apiClient } from "@/api/axios";
import { PublicHeader } from "@/components/layout/PublicHeader";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Star, Clock, Award, TrendingUp, ChevronRight } from "lucide-react";
import { toast } from "react-toastify";
import { showApiError } from "@/lib/apiError";
import { cn, formatDate } from "@/utils";

// =============================================================================
// Типы
// =============================================================================

interface ServiceCategory {
  id: number;
  name: string;
  description?: string;
  icon_url?: string;
}

interface Technician {
  id: number;
  first_name?: string;
  last_name?: string;
  specialization?: string;
  experience_years: number;
  rating: number;
  portfolio_description?: string;
  completed_orders?: number;
  is_available?: boolean;
}

interface Promotion {
  id: number;
  title: string;
  description?: string;
  discount_percent: number;
  start_date: string;
  end_date: string;
}

interface Review {
  id: number;
  client_name?: string;
  rating: number;
  text?: string;
  created_at: string;
}

// =============================================================================
// Компонент HomePage
// =============================================================================

export const HomePage = () => {
  const navigate = useNavigate();
  const [categories, setCategories] = useState<ServiceCategory[]>([]);
  const [technicians, setTechnicians] = useState<Technician[]>([]);
  const [promotions, setPromotions] = useState<Promotion[]>([]);
  const [reviews, setReviews] = useState<Review[]>([]);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    const fetchData = async () => {
      try {
        const [categoriesRes, techniciansRes, promotionsRes, reviewsRes] = await Promise.all([
          apiClient.get<ServiceCategory[]>("/services/categories"),
          apiClient.get<{ items: Technician[] }>("/technicians?available_only=false&limit=3"),
          apiClient.get<{ items: Promotion[] }>("/promotions"),
          apiClient.get<{ items: Review[]; total: number }>("/reviews?limit=5"),
        ]);

        setCategories(Array.isArray(categoriesRes.data) ? categoriesRes.data : []);
        setTechnicians(techniciansRes.data.items ?? []);
        setPromotions(promotionsRes.data.items ?? []);
        setReviews(reviewsRes.data.items ?? []);
      } catch (error) {
        showApiError(error, "Ошибка загрузки данных");
      } finally {
        setIsLoading(false);
      }
    };

    fetchData();
  }, []);

  return (
    <div className="min-h-screen bg-background">
      <PublicHeader />

      <main>
        {/* Hero Section */}
        <section className="container mx-auto px-4 py-16 lg:py-24">
          <div className="mx-auto max-w-3xl text-center">
            <h1 className="text-4xl font-bold tracking-tight sm:text-5xl lg:text-6xl">
              Зуботехническая лаборатория{" "}
              <span className="text-primary">полного цикла</span>
            </h1>
            <p className="mt-6 text-lg text-muted-foreground">
              Современные технологии, опытные техники и высокое качество изделий.
              Работаем с клиниками и частными клиентами по всей России.
            </p>
            <div className="mt-10 flex justify-center gap-4">
              <Link to="/calculator">
                <Button size="lg">
                  Рассчитать стоимость
                  <ChevronRight className="ml-2 h-4 w-4" />
                </Button>
              </Link>
              <Link to="/services">
                <Button variant="outline" size="lg">
                  Наши услуги
                </Button>
              </Link>
            </div>
          </div>
        </section>

        {/* Services Categories */}
        <section className="bg-muted/50 py-16">
          <div className="container mx-auto px-4">
            <h2 className="mb-8 text-center text-3xl font-bold">Наши услуги</h2>
            <div className="grid gap-6 sm:grid-cols-2 lg:grid-cols-3">
              {categories.slice(0, 6).map((category) => (
                <Card key={category.id} className="group">
                  <CardHeader>
                    <div className="flex items-start gap-4">
                      {category.icon_url ? (
                        <img
                          src={category.icon_url}
                          alt={category.name}
                          className="h-10 w-10 rounded-lg object-cover"
                        />
                      ) : (
                        <div className="h-10 w-10 rounded-lg bg-primary/10 flex items-center justify-center">
                          <TrendingUp className="h-5 w-5 text-primary" />
                        </div>
                      )}
                      <div>
                        <CardTitle className="text-lg">{category.name}</CardTitle>
                        <CardDescription className="mt-1">
                          {category.description}
                        </CardDescription>
                      </div>
                    </div>
                  </CardHeader>
                  <CardContent>
                    <Button
                      variant="outline"
                      className="w-full"
                      onClick={() => navigate("/services")}
                    >
                      Подробнее
                    </Button>
                  </CardContent>
                </Card>
              ))}
            </div>
            <div className="mt-8 text-center">
              <Link to="/services">
                <Button variant="outline">Все услуги</Button>
              </Link>
            </div>
          </div>
        </section>

        {/* Техники */}
        <section className="py-16">
          <div className="container mx-auto px-4">
            <h2 className="mb-8 text-center text-3xl font-bold">Наши специалисты</h2>
            <div className="grid gap-6 sm:grid-cols-2 lg:grid-cols-3">
              {technicians.map((tech) => (
                <Link key={tech.id} to={`/portfolio/${tech.id}`}>
                <Card className="transition-shadow hover:shadow-md h-full">
                  <CardHeader>
                    <div className="flex items-center gap-4">
                      <div className="flex h-12 w-12 items-center justify-center rounded-full bg-primary/10">
                        <span className="text-lg font-semibold text-primary">
                          {tech.first_name?.[0]}{tech.last_name?.[0]}
                        </span>
                      </div>
                      <div>
                        <CardTitle className="text-lg">
                          {tech.first_name} {tech.last_name}
                        </CardTitle>
                        {tech.specialization && (
                          <CardDescription>{tech.specialization}</CardDescription>
                        )}
                      </div>
                    </div>
                  </CardHeader>
                  <CardContent>
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-1">
                        <Star className="h-4 w-4 fill-yellow-400 text-yellow-400" />
                        <span className="font-medium">{tech.rating.toFixed(1)}</span>
                      </div>
                      <span className="text-sm text-muted-foreground">
                        {tech.experience_years} лет опыта
                      </span>
                    </div>
                    {tech.portfolio_description && (
                      <p className="mt-4 text-sm text-muted-foreground line-clamp-2">
                        {tech.portfolio_description}
                      </p>
                    )}
                  </CardContent>
                </Card>
                </Link>
              ))}
            </div>
            <div className="mt-8 text-center">
              <Link to="/portfolio">
                <Button variant="outline">
                  Все специалисты
                  <ChevronRight className="ml-2 h-4 w-4" />
                </Button>
              </Link>
            </div>
          </div>
        </section>

        {/* Requirements and Manufacturing Times Section */}
        <section className="bg-muted/50 py-16">
          <div className="container mx-auto px-4">
            <h2 className="mb-8 text-center text-3xl font-bold">Требования к работе</h2>
            <div className="grid gap-6 sm:grid-cols-2">
              <Card className="border-primary/20">
                <CardHeader>
                  <CardTitle className="flex items-center gap-2">
                    <TrendingUp className="h-5 w-5" />
                    Требования к снимкам
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  <p className="text-sm text-muted-foreground">
                    Узнайте, какие требования мы предъявляем к снимкам для изготовления точных ортопедических конструкций.
                  </p>
                  <Link to="/requirements">
                    <Button variant="outline" className="mt-4 w-full">
                      Подробнее
                    </Button>
                  </Link>
                </CardContent>
              </Card>
              
              <Card className="border-primary/20">
                <CardHeader>
                  <CardTitle className="flex items-center gap-2">
                    <Clock className="h-5 w-5" />
                    Сроки изготовления
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  <p className="text-sm text-muted-foreground">
                    Ознакомьтесь с установленными сроками изготовления различных типов ортопедических конструкций.
                  </p>
                  <Link to="/requirements">
                    <Button variant="outline" className="mt-4 w-full">
                      Подробнее
                    </Button>
                  </Link>
                </CardContent>
              </Card>
            </div>
          </div>
        </section>

        {/* Акции */}
        {promotions.length > 0 && (
          <section className="bg-muted/50 py-16">
            <div className="container mx-auto px-4">
              <h2 className="mb-8 text-center text-3xl font-bold">Акции</h2>
              <div className="grid gap-6 sm:grid-cols-2 lg:grid-cols-3">
                {promotions.map((promo) => (
                  <Card key={promo.id} className="border-primary/20">
                    <CardHeader>
                      <div className="flex items-center justify-between">
                        <CardTitle>{promo.title}</CardTitle>
                        <Badge variant="default" className="bg-green-500">
                          -{promo.discount_percent}%
                        </Badge>
                      </div>
                      {promo.description && (
                        <CardDescription>{promo.description}</CardDescription>
                      )}
                    </CardHeader>
                    <CardContent>
                      <p className="text-sm text-muted-foreground">
                        Действует до {formatDate(promo.end_date)}
                      </p>
                    </CardContent>
                  </Card>
                ))}
              </div>
            </div>
          </section>
        )}

        {/* Отзывы */}
        <section className="bg-muted/50 py-16">
          <div className="container mx-auto px-4">
            <h2 className="mb-8 text-center text-3xl font-bold">Отзывы клиентов</h2>
            <div className="grid gap-6 lg:grid-cols-2">
              {reviews.map((review) => (
                <Card key={review.id}>
                  <CardContent className="pt-6">
                    <div className="flex items-center gap-2 mb-4">
                      <div className="flex">
                        {[...Array(5)].map((_, i) => (
                          <Star
                            key={i}
                            className={cn(
                              "h-4 w-4",
                              i < review.rating
                                ? "fill-yellow-400 text-yellow-400"
                                : "text-muted-foreground"
                            )}
                          />
                        ))}
                      </div>
                      <span className="text-sm text-muted-foreground">
                        {formatDate(review.created_at)}
                      </span>
                    </div>
                    {review.text && (
                      <p className="text-muted-foreground">{review.text}</p>
                    )}
                    {review.client_name && (
                      <p className="mt-4 font-medium">— {review.client_name}</p>
                    )}
                  </CardContent>
                </Card>
              ))}
            </div>
          </div>
        </section>

        {/* CTA Section */}
        <section className="container mx-auto px-4 py-16">
          <Card className="bg-primary text-primary-foreground">
            <CardContent className="py-12 text-center">
              <h2 className="text-3xl font-bold">Рассчитать стоимость заказа</h2>
              <p className="mt-4 text-lg opacity-90">
                Используйте наш онлайн-калькулятор для быстрого расчёта стоимости услуг
              </p>
              <Link to="/calculator">
                <Button size="lg" variant="secondary" className="mt-8">
                  Перейти к калькулятору
                  <ChevronRight className="ml-2 h-4 w-4" />
                </Button>
              </Link>
            </CardContent>
          </Card>
        </section>
      </main>

      {/* Footer */}
      <footer className="border-t py-8">
        <div className="container mx-auto px-4 text-center text-sm text-muted-foreground">
          <p>© 2024 Dental Lab. Все права защищены.</p>
        </div>
      </footer>
    </div>
  );
};