import { useEffect, useState } from "react";
import { Link } from "react-router-dom";

import { apiClient } from "@/api/axios";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Star, Clock, Award, TrendingUp, ChevronRight, Building2 } from "lucide-react";
import { toast } from "react-toastify";

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
  user: {
    first_name?: string;
    last_name?: string;
  };
  specialization?: string;
  experience_years: number;
  rating: number;
  portfolio_description?: string;
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
          apiClient.get<Technician[]>("/technicians?limit=3"),
          apiClient.get<Promotion[]>("/promotions"),
          apiClient.get<Review[]>("/reviews?limit=5"),
        ]);

        setCategories(categoriesRes.data);
        setTechnicians(techniciansRes.data);
        setPromotions(promotionsRes.data);
        setReviews(reviewsRes.data);
      } catch (error) {
        toast.error("Ошибка загрузки данных");
        console.error(error);
      } finally {
        setIsLoading(false);
      }
    };

    fetchData();
  }, []);

  return (
    <div className="min-h-screen bg-background">
      {/* Header */}
      <header className="sticky top-0 z-50 border-b bg-background/95 backdrop-blur">
        <div className="container mx-auto flex h-16 items-center justify-between px-4">
          <div className="flex items-center gap-2">
            <Building2 className="h-6 w-6 text-primary" />
            <span className="font-semibold">Dental Lab</span>
          </div>
          <div className="flex items-center gap-4">
            <Link to="/login">
              <Button variant="outline" size="sm">Войти</Button>
            </Link>
            <Link to="/register">
              <Button size="sm">Регистрация</Button>
            </Link>
          </div>
        </div>
      </header>

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
              {isLoading ? (
                Array(6).fill(0).map((_, i) => (
                  <Card key={i} className="animate-pulse">
                    <CardHeader>
                      <div className="h-6 w-3/4 bg-muted rounded" />
                    </CardHeader>
                    <CardContent>
                      <div className="h-4 w-full bg-muted rounded" />
                    </CardContent>
                  </Card>
                ))
              ) : (
                categories.map((category) => (
                  <Card key={category.id} className="transition-shadow hover:shadow-lg">
                    <CardHeader>
                      <CardTitle>{category.name}</CardTitle>
                      {category.description && (
                        <CardDescription>{category.description}</CardDescription>
                      )}
                    </CardHeader>
                  </Card>
                ))
              )}
            </div>
          </div>
        </section>

        {/* Преимущества */}
        <section className="container mx-auto px-4 py-16">
          <h2 className="mb-8 text-center text-3xl font-bold">Почему выбирают нас</h2>
          <div className="grid gap-8 sm:grid-cols-2 lg:grid-cols-4">
            <div className="flex flex-col items-center text-center">
              <div className="mb-4 flex h-16 w-16 items-center justify-center rounded-full bg-primary/10">
                <Award className="h-8 w-8 text-primary" />
              </div>
              <h3 className="font-semibold">Высокое качество</h3>
              <p className="mt-2 text-sm text-muted-foreground">
                Используем только сертифицированные материалы
              </p>
            </div>
            <div className="flex flex-col items-center text-center">
              <div className="mb-4 flex h-16 w-16 items-center justify-center rounded-full bg-primary/10">
                <Clock className="h-8 w-8 text-primary" />
              </div>
              <h3 className="font-semibold">Соблюдение сроков</h3>
              <p className="mt-2 text-sm text-muted-foreground">
                95% заказов выполняем точно в срок
              </p>
            </div>
            <div className="flex flex-col items-center text-center">
              <div className="mb-4 flex h-16 w-16 items-center justify-center rounded-full bg-primary/10">
                <TrendingUp className="h-8 w-8 text-primary" />
              </div>
              <h3 className="font-semibold">Современные технологии</h3>
              <p className="mt-2 text-sm text-muted-foreground">
                CAD/CAM, 3D-печать, цифровое моделирование
              </p>
            </div>
            <div className="flex flex-col items-center text-center">
              <div className="mb-4 flex h-16 w-16 items-center justify-center rounded-full bg-primary/10">
                <Star className="h-8 w-8 text-primary" />
              </div>
              <h3 className="font-semibold">Опытные техники</h3>
              <p className="mt-2 text-sm text-muted-foreground">
                Средний стаж наших техников — 8 лет
              </p>
            </div>
          </div>
        </section>

        {/* Техники */}
        <section className="bg-muted/50 py-16">
          <div className="container mx-auto px-4">
            <h2 className="mb-8 text-center text-3xl font-bold">Наши специалисты</h2>
            <div className="grid gap-6 sm:grid-cols-2 lg:grid-cols-3">
              {technicians.map((tech) => (
                <Card key={tech.id}>
                  <CardHeader>
                    <div className="flex items-center gap-4">
                      <div className="flex h-12 w-12 items-center justify-center rounded-full bg-primary/10">
                        <span className="text-lg font-semibold text-primary">
                          {tech.user.first_name?.[0]}{tech.user.last_name?.[0]}
                        </span>
                      </div>
                      <div>
                        <CardTitle className="text-lg">
                          {tech.user.first_name} {tech.user.last_name}
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

        {/* Акции */}
        {promotions.length > 0 && (
          <section className="container mx-auto px-4 py-16">
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
                      Действует до {new Date(promo.end_date).toLocaleDateString('ru-RU')}
                    </p>
                  </CardContent>
                </Card>
              ))}
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
                        {new Date(review.created_at).toLocaleDateString('ru-RU')}
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
