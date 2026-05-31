import { useState, useMemo } from "react";
import { useQuery } from "@tanstack/react-query";
import { Link } from "react-router-dom";

import { getTechnicians } from "@/api/manager";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Star, Download } from "lucide-react";
import { ExportButton } from "@/components/shared/ExportButton";
import { SearchAndFilter, type FilterConfig } from "@/components/shared/SearchAndFilter";
import { toExportFilters } from "@/lib/exportFilters";

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
  const [filters, setFilters] = useState<Record<string, string>>({});
  const [search, setSearch] = useState("");

  const [sortBy, setSortBy] = useState<"name" | "rating" | "completed_orders" | "is_available">("rating");
  const [sortDir, setSortDir] = useState<"asc" | "desc">("desc");

  const toggleSort = (nextSortBy: typeof sortBy) => {
    if (nextSortBy === sortBy) {
      setSortDir((prev) => (prev === "asc" ? "desc" : "asc"));
    } else {
      setSortBy(nextSortBy);
      setSortDir("asc");
    }
  };

  const { data: technicians, isLoading } = useQuery({
    queryKey: ["manager-technicians"],
    queryFn: getTechnicians,
  });

  const sortedTechnicians = useMemo(() => {
    const items = technicians ?? [];
    const dir = sortDir === "asc" ? 1 : -1;

    const getName = (t: any) => getTechnicianName(t);

    const toNum = (v: any) => {
      const n = typeof v === "number" ? v : Number(v);
      return Number.isFinite(n) ? n : null;
    };

    const toStr = (v: any) => (v === null || v === undefined ? "" : String(v));

    const getVal = (t: any) => {
      switch (sortBy) {
        case "name":
          return getName(t);
        case "rating":
          return toNum(t.rating);
        case "completed_orders":
          return toNum(t.completed_orders);
        case "is_available":
          // normalize to 0/1 so boolean sort is deterministic
          return t.is_available ? 1 : 0;
        default:
          return "";
      }
    };

    return [...items].sort((a: any, b: any) => {
      const va = getVal(a);
      const vb = getVal(b);

      // null/undefined last
      const aNull = va === null || va === undefined;
      const bNull = vb === null || vb === undefined;
      if (aNull && bNull) return 0;
      if (aNull) return 1;
      if (bNull) return -1;

      if (typeof va === "number" && typeof vb === "number") {
        return (va - vb) * dir;
      }

      return toStr(va).localeCompare(toStr(vb), "ru") * dir;
    });
  }, [technicians, sortBy, sortDir]);

  const filterConfigs: FilterConfig[] = [
    {
      key: "status",
      label: "Статус заказов",
      type: "select",
      options: [
        { value: "in_progress", label: "В работе" },
        { value: "review", label: "На проверке" },
        { value: "completed", label: "Завершён" },
      ],
    },
    { key: "date_from", label: "Период от", type: "date" },
    { key: "date_to", label: "Период до", type: "date" },
  ];

  const exportFilters = useMemo(
    () => toExportFilters({ filters, search }),
    [filters, search]
  );

  return (
    <div className="space-y-6">
      <div className="flex justify-between items-center">
        <h1 className="text-3xl font-bold">Сотрудники</h1>
        <ExportButton resource="orders-by-technician" filters={exportFilters} title="Сводка заказов по исполнителям" />
      </div>

      <SearchAndFilter
        onSearch={setSearch}
        onFilter={setFilters}
        filters={filterConfigs}
        searchPlaceholder="Поиск по имени техника или номеру заказа..."
      />

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
                  <TableHead className="cursor-pointer select-none" onClick={() => toggleSort("name")}>
                    Имя{sortBy === "name" ? (sortDir === "asc" ? " ▲" : " ▼") : ""}
                  </TableHead>
                  <TableHead>Специализация</TableHead>
                  <TableHead className="cursor-pointer select-none" onClick={() => toggleSort("rating")}>
                    Рейтинг{sortBy === "rating" ? (sortDir === "asc" ? " ▲" : " ▼") : ""}
                  </TableHead>
                  <TableHead className="cursor-pointer select-none" onClick={() => toggleSort("completed_orders")}>
                    Выполнено{sortBy === "completed_orders" ? (sortDir === "asc" ? " ▲" : " ▼") : ""}
                  </TableHead>
                  <TableHead className="cursor-pointer select-none" onClick={() => toggleSort("is_available")}>
                    Статус{sortBy === "is_available" ? (sortDir === "asc" ? " ▲" : " ▼") : ""}
                  </TableHead>
                  <TableHead></TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {sortedTechnicians.map((tech) => (
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