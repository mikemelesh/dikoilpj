import { useQuery } from "@tanstack/react-query";
import { Link } from "react-router-dom";

import { getTechnicians } from "@/api/manager";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Star } from "lucide-react";

// Функция для получения имени техника
const getTechnicianName = (tech: any) => {
  if (tech.first_name && tech.last_name) {
    return `${tech.first_name} ${tech.last_name}`;
  }
  if (tech.user?.first_name && tech.user?.last_name) {
    return `${tech.user.first_name} ${tech.user.last_name}`;
  }
  return "Техник";
};

export const ManagerTechnicians = () => {
  const { data: technicians, isLoading } = useQuery({
    queryKey: ["manager-technicians"],
    queryFn: getTechnicians,
  });

  return (
    <div className="space-y-6">
      <h1 className="text-3xl font-bold">Сотрудники</h1>

      {isLoading ? (
        <div className="space-y-4">{[...Array(5)].map((_, i) => <Card key={i} className="animate-pulse"><CardContent className="py-6"><div className="h-6 w-3/4 bg-muted rounded" /></CardContent></Card>)}</div>
      ) : !technicians?.length ? (
        <Card><CardContent className="py-12 text-center text-muted-foreground"><p>Техники не найдены</p></CardContent></Card>
      ) : (
        <Card>
          <CardContent className="p-0">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Имя</TableHead>
                  <TableHead>Специализация</TableHead>
                  <TableHead>Рейтинг</TableHead>
                  <TableHead>Выполнено</TableHead>
                  <TableHead>Статус</TableHead>
                  <TableHead></TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {technicians.map((tech) => (
                  <TableRow key={tech.id}>
                    <TableCell>
                      <div>
                        <p className="font-medium">{getTechnicianName(tech)}</p>
                        <p className="text-sm text-muted-foreground">{tech.user?.email || tech.user_id}</p>
                      </div>
                    </TableCell>
                    <TableCell>{tech.specialization || "Универсал"}</TableCell>
                    <TableCell>
                      <div className="flex items-center gap-1">
                        <Star className="h-4 w-4 fill-yellow-400 text-yellow-400" />
                        <span>{tech.rating.toFixed(1)}</span>
                      </div>
                    </TableCell>
                    <TableCell>{tech.completed_orders}</TableCell>
                    <TableCell>
                      <Badge variant={tech.is_available ? "default" : "secondary"}>{tech.is_available ? "Доступен" : "Недоступен"}</Badge>
                    </TableCell>
                    <TableCell>
                      <Link to={`/manager/technicians/${tech.id}`}>
                        <Button variant="ghost" size="sm">Статистика</Button>
                      </Link>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </CardContent>
        </Card>
      )}
    </div>
  );
};
