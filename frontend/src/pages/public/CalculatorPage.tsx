import { PriceCalculator } from "@/components/services/PriceCalculator";
import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { apiClient } from "@/api/axios";
import type { Service, Article } from "@/types";
import { toast } from "react-toastify";
import { showApiError } from "@/lib/apiError";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { formatPrice } from "@/utils";
import { Calculator, Info, TrendingUp, Clock, Shield } from "lucide-react";
import { PublicLayout } from "@/components/layout/PublicLayout";

export const CalculatorPage = () => {
  const [services, setServices] = useState<Service[]>([]);
  const [articles, setArticles] = useState<Article[]>([]);

  useEffect(() => {
    apiClient.get<{ items: Service[]; total: number }>("/services?limit=100")
      .then((res) => setServices(res.data.items || []))
      .catch((error) => showApiError(error, "Ошибка загрузки услуг"));

    apiClient.get<{ items: Article[]; total: number }>("/articles?limit=3")
      .then((res) => setArticles(res.data.items || []))
      .catch(() => {});
  }, []);

  return (
    <PublicLayout>
      {/* Hero секция */}
      <section className="bg-gradient-to-r from-primary/10 to-primary/5 py-12">
        <div className="container mx-auto px-4">
          <div className="flex items-center gap-3 mb-4">
            <div className="p-3 bg-primary/10 rounded-lg">
              <Calculator className="h-8 w-8 text-primary" />
            </div>
            <h1 className="text-4xl font-bold">Калькулятор стоимости</h1>
          </div>
          <p className="text-lg text-muted-foreground max-w-2xl">
            Рассчитайте стоимость зуботехнических услуг онлайн. 
            Выберите нужные услуги и укажите количество для получения точного расчёта.
          </p>
        </div>
      </section>

      {/* Калькулятор */}
      <section className="container mx-auto px-4 py-12">
        <div className="max-w-4xl mx-auto">
          <PriceCalculator services={services} />
        </div>
      </section>

      {/* Информация о расчёте */}
      <section className="container mx-auto px-4 py-12">
        <div className="max-w-4xl mx-auto">
          <h2 className="text-2xl font-bold mb-6">Как работает калькулятор</h2>
          <div className="grid gap-6 md:grid-cols-3">
            <Card>
              <CardHeader>
                <div className="flex items-center gap-3">
                  <div className="p-2 bg-primary/10 rounded-lg">
                    <TrendingUp className="h-5 w-5 text-primary" />
                  </div>
                  <CardTitle className="text-lg">Точный расчёт</CardTitle>
                </div>
              </CardHeader>
              <CardContent>
                <p className="text-muted-foreground">
                  Калькулятор учитывает базовую стоимость услуг, количество и применяет 
                  индивидуальные скидки в зависимости от статуса клиента.
                </p>
              </CardContent>
            </Card>
            <Card>
              <CardHeader>
                <div className="flex items-center gap-3">
                  <div className="p-2 bg-primary/10 rounded-lg">
                    <Clock className="h-5 w-5 text-primary" />
                  </div>
                  <CardTitle className="text-lg">Сроки изготовления</CardTitle>
                </div>
              </CardHeader>
              <CardContent>
                <p className="text-muted-foreground">
                  Для каждой услуги указаны ориентировочные сроки изготовления. 
                  Срочные заказы могут выполняться с наценкой.
                </p>
              </CardContent>
            </Card>
            <Card>
              <CardHeader>
                <div className="flex items-center gap-3">
                  <div className="p-2 bg-primary/10 rounded-lg">
                    <Shield className="h-5 w-5 text-primary" />
                  </div>
                  <CardTitle className="text-lg">Гарантия качества</CardTitle>
                </div>
              </CardHeader>
              <CardContent>
                <p className="text-muted-foreground">
                  Все работы выполняются квалифицированными техниками с использованием 
                  сертифицированных материалов и имеют гарантию.
                </p>
              </CardContent>
            </Card>
          </div>
        </div>
      </section>

      {/* Популярные услуги */}
      <section className="bg-muted/50 py-12">
        <div className="container mx-auto px-4">
          <div className="max-w-4xl mx-auto">
            <h2 className="text-2xl font-bold mb-6">Популярные услуги</h2>
            <div className="grid gap-4 md:grid-cols-2">
              {services.slice(0, 4).map((service) => (
                <Card key={service.id}>
                  <CardHeader className="pb-3">
                    <div className="flex justify-between items-start">
                      <CardTitle className="text-base">{service.name}</CardTitle>
                      <Badge variant="secondary">{formatPrice(service.base_price)}</Badge>
                    </div>
                    {service.category && (
                      <CardDescription>{service.category.name}</CardDescription>
                    )}
                  </CardHeader>
                  {service.description && (
                    <CardContent>
                      <p className="text-sm text-muted-foreground line-clamp-2">
                        {service.description}
                      </p>
                    </CardContent>
                  )}
                </Card>
              ))}
            </div>
            <div className="mt-6 text-center">
              <Link to="/services" className="text-primary hover:underline">
                Смотреть все услуги →
              </Link>
            </div>
          </div>
        </div>
      </section>

      {/* Статьи */}
      <section className="container mx-auto px-4 py-12">
        <div className="max-w-4xl mx-auto">
          <div className="flex items-center gap-2 mb-6">
            <Info className="h-6 w-6 text-primary" />
            <h2 className="text-2xl font-bold">Полезная информация</h2>
          </div>
          <div className="grid gap-6 md:grid-cols-3">
            {articles.map((article) => (
              <Link key={article.id} to={`/articles/${article.slug}`}>
                <Card className="h-full transition-shadow hover:shadow-lg">
                  <CardHeader>
                    <div className="flex items-center gap-2">
                      <CardTitle className="text-base">{article.title}</CardTitle>
                      {article.category && (
                        <Badge variant="outline">{article.category}</Badge>
                      )}
                    </div>
                  </CardHeader>
                  <CardContent>
                    <p className="text-sm text-muted-foreground line-clamp-3">
                      {article.content.slice(0, 120)}...
                    </p>
                  </CardContent>
                </Card>
              </Link>
            ))}
          </div>
          <div className="mt-6 text-center">
            <Link to="/articles" className="text-primary hover:underline">
              Все статьи →
            </Link>
          </div>
        </div>
      </section>

      {/* CTA */}
      <section className="bg-primary text-primary-foreground py-12">
        <div className="container mx-auto px-4 text-center max-w-4xl">
          <h2 className="text-2xl font-bold mb-4">Остались вопросы?</h2>
          <p className="mb-6 opacity-90">
            Наши менеджеры готовы проконсультировать вас по всем вопросам и помочь с оформлением заказа
          </p>
          <Link
            to="/contact"
            className="inline-block px-6 py-3 bg-white text-primary rounded-lg font-semibold hover:bg-gray-100 transition"
          >
            Связаться с нами
          </Link>
        </div>
      </section>
    </PublicLayout>
  );
};
