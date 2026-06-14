import { useEffect, useState } from "react";
import { Link } from "react-router-dom";

import { PriceCalculator } from "@/components/services/PriceCalculator";
import { apiClient } from "@/api/axios";
import type { Service, ServiceCategory, Article } from "@/types";
import { toast } from "react-toastify";
import { showApiError } from "@/lib/apiError";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { formatPrice } from "@/utils";
import { Heart, Sparkles, Microscope, Wrench, Scissors } from "lucide-react";
import { PublicLayout } from "@/components/layout/PublicLayout";

const SERVICE_ICONS: Record<string, React.ComponentType<{ className?: string }>> = {
  "Металлокерамика": Sparkles,
  "Цирконий": Sparkles,
  "Виниры": Sparkles,
  "Бюгельный": Wrench,
  "Съемный": Scissors,
  "Имплант": Microscope,
};

export const ServicesPage = () => {
  const [services, setServices] = useState<Service[]>([]);
  const [categories, setCategories] = useState<{ id: number; name: string }[]>([]);
  const [articles, setArticles] = useState<Article[]>([]);

  useEffect(() => {
    Promise.all([
      apiClient.get<{ items: Service[]; total: number }>("/services?limit=100"),
      apiClient.get<ServiceCategory[]>("/services/categories"),
      apiClient.get<{ items: Article[]; total: number }>("/articles?limit=3"),
    ])
      .then(([servicesRes, categoriesRes, articlesRes]) => {
        setServices(servicesRes.data.items || []);
        const apiCategories = Array.isArray(categoriesRes.data) ? categoriesRes.data : [];
        setCategories(
          apiCategories.map((c) => ({ id: c.id, name: c.name }))
        );
        setArticles(articlesRes.data.items || []);
      })
      .catch((error) => showApiError(error, "Ошибка загрузки услуг"));
  }, []);

  return (
    <PublicLayout>
      {/* Hero секция */}
      <section className="bg-gradient-to-r from-primary/10 to-primary/5 py-16">
        <div className="container mx-auto px-4 text-center">
          <h1 className="text-4xl font-bold mb-4">Наши услуги</h1>
          <p className="text-lg text-muted-foreground max-w-2xl mx-auto">
            Полный спектр зуботехнических услуг от профессиональной лаборатории.
            Высокое качество, современные материалы и доступные цены.
          </p>
        </div>
      </section>

      {/* Калькулятор */}
      <section className="container mx-auto px-4 py-12">
        <div className="max-w-4xl mx-auto">
          <h2 className="text-2xl font-bold mb-6 text-center">Калькулятор стоимости</h2>
          <PriceCalculator services={services} />
        </div>
      </section>

      {/* Категории услуг */}
      <section className="container mx-auto px-4 py-12">
        <h2 className="text-2xl font-bold mb-8 text-center">Категории услуг</h2>
        <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-3">
          {categories.map((category) => {
            const categoryServices = services.filter((s) => s.category_id === category.id);
            const IconComponent = SERVICE_ICONS[category.name] || Sparkles;
            
            return (
              <Card key={category.id} className="transition-shadow hover:shadow-lg">
                <CardHeader>
                  <div className="flex items-center gap-3">
                    <div className="p-2 bg-primary/10 rounded-lg">
                      <IconComponent className="h-6 w-6 text-primary" />
                    </div>
                    <CardTitle className="text-xl">{category.name}</CardTitle>
                  </div>
                  <CardDescription>
                    {categoryServices.length} услуг в категории
                  </CardDescription>
                </CardHeader>
                <CardContent className="space-y-2">
                  {categoryServices.slice(0, 4).map((service) => (
                    <div key={service.id} className="flex justify-between items-center text-sm">
                      <span className="text-muted-foreground">{service.name}</span>
                      <Badge variant="secondary">{formatPrice(service.base_price)}</Badge>
                    </div>
                  ))}
                  {categoryServices.length > 4 && (
                    <p className="text-xs text-muted-foreground pt-2">
                      + ещё {categoryServices.length - 4} услуг
                    </p>
                  )}
                </CardContent>
              </Card>
            );
          })}
        </div>
      </section>

      {/* Преимущества */}
      <section className="bg-muted/50 py-16">
        <div className="container mx-auto px-4">
          <h2 className="text-2xl font-bold mb-8 text-center">Почему выбирают нас</h2>
          <div className="grid gap-8 md:grid-cols-2 lg:grid-cols-4">
            <div className="text-center">
              <div className="mx-auto w-16 h-16 bg-primary/10 rounded-full flex items-center justify-center mb-4">
                <Heart className="h-8 w-8 text-primary" />
              </div>
              <h3 className="font-semibold text-lg mb-2">Качество</h3>
              <p className="text-muted-foreground">
                Используем только сертифицированные материалы от ведущих производителей
              </p>
            </div>
            <div className="text-center">
              <div className="mx-auto w-16 h-16 bg-primary/10 rounded-full flex items-center justify-center mb-4">
                <Sparkles className="h-8 w-8 text-primary" />
              </div>
              <h3 className="font-semibold text-lg mb-2">Точность</h3>
              <p className="text-muted-foreground">
                Современное оборудование обеспечивает высокую точность изделий
              </p>
            </div>
            <div className="text-center">
              <div className="mx-auto w-16 h-16 bg-primary/10 rounded-full flex items-center justify-center mb-4">
                <Microscope className="h-8 w-8 text-primary" />
              </div>
              <h3 className="font-semibold text-lg mb-2">Технологии</h3>
              <p className="text-muted-foreground">
                CAD/CAM технологии и 3D-моделирование для лучших результатов
              </p>
            </div>
            <div className="text-center">
              <div className="mx-auto w-16 h-16 bg-primary/10 rounded-full flex items-center justify-center mb-4">
                <Microscope className="h-8 w-8 text-primary" />
              </div>
              <h3 className="font-semibold text-lg mb-2">Опыт</h3>
              <p className="text-muted-foreground">
                Команда квалифицированных техников с многолетним стажем
              </p>
            </div>
          </div>
        </div>
      </section>

      {/* Статьи */}
      <section className="container mx-auto px-4 py-16">
        <div className="flex justify-between items-center mb-8">
          <h2 className="text-2xl font-bold">Полезные статьи</h2>
          <Link to="/articles" className="text-primary hover:underline">
            Все статьи →
          </Link>
        </div>
        <div className="grid gap-6 md:grid-cols-3">
          {articles.map((article) => (
            <Link key={article.id} to={`/articles/${article.slug}`}>
              <Card className="h-full transition-shadow hover:shadow-lg">
                <CardHeader>
                  <CardTitle className="text-lg">{article.title}</CardTitle>
                  {article.category && (
                    <CardDescription>
                      <Badge variant="outline">{article.category}</Badge>
                    </CardDescription>
                  )}
                </CardHeader>
                <CardContent>
                  <p className="text-sm text-muted-foreground line-clamp-3">
                    {article.content.slice(0, 150)}...
                  </p>
                </CardContent>
              </Card>
            </Link>
          ))}
        </div>
      </section>

      {/* CTA секция */}
      <section className="bg-primary text-primary-foreground py-16">
        <div className="container mx-auto px-4 text-center">
          <h2 className="text-3xl font-bold mb-4">Готовы сделать заказ?</h2>
          <p className="text-lg mb-8 opacity-90">
            Зарегистрируйтесь или войдите, чтобы создать заказ и отслеживать его статус
          </p>
          <div className="flex justify-center gap-4">
            <Link
              to="/register"
              className="px-6 py-3 bg-white text-primary rounded-lg font-semibold hover:bg-gray-100 transition"
            >
              Регистрация
            </Link>
            <Link
              to="/login"
              className="px-6 py-3 border-2 border-white rounded-lg font-semibold hover:bg-white/10 transition"
            >
              Войти
            </Link>
          </div>
        </div>
      </section>
    </PublicLayout>
  );
};
