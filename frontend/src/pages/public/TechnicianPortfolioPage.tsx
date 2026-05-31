import { useState, useEffect } from "react";
import { Link, useParams } from "react-router-dom";
import { Star, Calendar, Award, FileText, Users, Building2, MapPin, Mail, Phone, Wrench, CheckCircle } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { apiClient } from "@/api/axios";

interface Technician {
  id: number;
  user: {
    id: number;
    first_name?: string;
    last_name?: string;
    email: string;
    phone?: string;
  };
  specialization?: string;
  experience_years: number;
  rating: number;
  portfolio_description?: string;
  completed_orders: number;
  is_available: boolean;
  skills?: string[];
  education?: string;
  certifications?: string[];
  address?: string;
  recent_works?: Array<{
    order_number: string;
    completed_at: string;
    final_price: number;
    items_count: number;
  }>;
}

interface Order {
  id: number;
  client_name: string;
  service_name: string;
  status: string;
  created_at: string;
  completed_at?: string;
}

export const TechnicianPortfolioPage = () => {
  const { id } = useParams<{ id: string }>();
  const [technician, setTechnician] = useState<Technician | null>(null);
  const [orders, setOrders] = useState<Order[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const fetchData = async () => {
      try {
        // Now using the main technician endpoint since it's public
        const techResponse = await apiClient.get(`/technicians/${id}`);
        setTechnician(techResponse.data);

        // Get the technician portfolio data for recent works
        const portfolioResponse = await apiClient.get(`/technicians/${id}/portfolio`);
        setTechnician(prev => prev ? {
          ...prev,
          recent_works: portfolioResponse.data.recent_works
        } : null);
      } catch (error) {
        console.error("Error fetching technician data:", error);
      } finally {
        setLoading(false);
      }
    };

    if (id) {
      fetchData();
    }
  }, [id]);

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="text-xl">Загрузка...</div>
      </div>
    );
  }

  if (!technician) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="text-xl text-destructive">Специалист не найден</div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background">
      <div className="bg-gradient-to-r from-primary/5 to-secondary/5 py-12">
        <div className="container mx-auto px-4">
          <div className="max-w-6xl mx-auto">
            <div className="mb-8">
              <Link to="/portfolio" className="inline-flex items-center gap-2 text-primary hover:underline">
                <Building2 className="h-4 w-4" />
                <span>Все специалисты</span>
              </Link>
            </div>

            <div className="flex flex-col lg:flex-row gap-8">
              <div className="lg:w-1/3">
                <Card className="overflow-hidden">
                  <div className="bg-primary p-6 text-white">
                    <div className="flex flex-col items-center text-center">
                      <div className="h-20 w-20 rounded-full bg-primary-foreground/20 flex items-center justify-center mb-4">
                        <Wrench className="h-10 w-10" />
                      </div>
                      <h1 className="text-2xl font-bold">
                        {technician.user.first_name} {technician.user.last_name}
                      </h1>
                      <p className="opacity-90 mt-1">
                        {technician.specialization || "Зубной техник"}
                      </p>
                    </div>
                  </div>
                  <CardContent className="pt-6">
                    <div className="space-y-4">
                      <div className="flex items-center gap-2">
                        <Calendar className="h-4 w-4 text-muted-foreground" />
                        <span>Опыт: {technician.experience_years} лет</span>
                      </div>
                      
                      <div className="flex items-center gap-2">
                        <Star className="h-4 w-4 text-yellow-500" />
                        <span>Рейтинг: {technician.rating.toFixed(1)}</span>
                      </div>
                      
                      <div className="flex items-center gap-2">
                        <FileText className="h-4 w-4 text-muted-foreground" />
                        <span>Выполнено заказов: {technician.completed_orders}</span>
                      </div>
                      
                      <div className="pt-2">
                        <Badge variant={technician.is_available ? "default" : "secondary"}>
                          {technician.is_available ? "Доступен для новых заказов" : "Занят"}
                        </Badge>
                      </div>
                      
                      {technician.education && (
                        <div className="pt-2">
                          <p className="text-sm font-medium flex items-center gap-2">
                            <Award className="h-4 w-4" />
                            Образование:
                          </p>
                          <p className="text-sm">{technician.education}</p>
                        </div>
                      )}
                      
                      {technician.address && (
                        <div className="pt-2">
                          <p className="text-sm font-medium flex items-center gap-2">
                            <MapPin className="h-4 w-4" />
                            Адрес:
                          </p>
                          <p className="text-sm">{technician.address}</p>
                        </div>
                      )}
                      
                      {technician.user.phone && (
                        <div className="pt-2">
                          <p className="text-sm font-medium flex items-center gap-2">
                            <Phone className="h-4 w-4" />
                            Телефон:
                          </p>
                          <p className="text-sm">{technician.user.phone}</p>
                        </div>
                      )}
                      
                      {technician.user.email && (
                        <div className="pt-2">
                          <p className="text-sm font-medium flex items-center gap-2">
                            <Mail className="h-4 w-4" />
                            Email:
                          </p>
                          <p className="text-sm">{technician.user.email}</p>
                        </div>
                      )}
                    </div>
                    
                    {technician.certifications && technician.certifications.length > 0 && (
                      <div className="pt-4">
                        <p className="text-sm font-medium mb-2">Сертификаты:</p>
                        <div className="flex flex-wrap gap-2">
                          {technician.certifications.map((cert, idx) => (
                            <Badge key={idx} variant="outline" className="flex items-center gap-1">
                              <CheckCircle className="h-3 w-3" />
                              {cert}
                            </Badge>
                          ))}
                        </div>
                      </div>
                    )}
                    
                    {technician.skills && technician.skills.length > 0 && (
                      <div className="pt-4">
                        <p className="text-sm font-medium mb-2">Навыки:</p>
                        <div className="flex flex-wrap gap-2">
                          {technician.skills.map((skill, idx) => (
                            <Badge key={idx} variant="secondary">{skill}</Badge>
                          ))}
                        </div>
                      </div>
                    )}
                  </CardContent>
                </Card>
                
                <Card className="mt-6">
                  <CardHeader>
                    <CardTitle>Последние работы</CardTitle>
                  </CardHeader>
                  <CardContent>
                    {technician.recent_works && technician.recent_works.length > 0 ? (
                      <div className="space-y-3">
                        {technician.recent_works.map((work, idx) => (
                          <div key={idx} className="border rounded-lg p-3">
                            <div className="flex justify-between">
                              <h4 className="font-medium">Заказ #{work.order_number}</h4>
                              <span className="text-sm">{work.items_count} поз.</span>
                            </div>
                            <p className="text-sm text-muted-foreground mt-1">
                              Цена: {work.final_price} руб.
                            </p>
                            <p className="text-xs text-muted-foreground mt-1">
                              Выполнен: {new Date(work.completed_at).toLocaleDateString()}
                            </p>
                          </div>
                        ))}
                      </div>
                    ) : (
                      <p className="text-muted-foreground">Нет информации о последних работах</p>
                    )}
                  </CardContent>
                </Card>
              </div>
              
              <div className="lg:w-2/3">
                <Card>
                  <CardHeader>
                    <CardTitle>О специалисте</CardTitle>
                  </CardHeader>
                  <CardContent>
                    <p className="text-muted-foreground whitespace-pre-line">
                      {technician.portfolio_description || "Информация о специалисте отсутствует."}
                    </p>
                  </CardContent>
                </Card>
                
                <div className="mt-6 flex gap-4">
                  <Button className="flex-1" asChild>
                    <Link to="/contact">Связаться с нами</Link>
                  </Button>
                  <Button variant="outline" className="flex-1" asChild>
                    <Link to="/services">Посмотреть услуги</Link>
                  </Button>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};