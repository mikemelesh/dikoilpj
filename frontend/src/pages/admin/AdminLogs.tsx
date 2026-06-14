import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { toast } from "react-toastify";
import { apiClient } from "@/api/axios";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { Download, Search } from "lucide-react";
import { formatDateTime } from "@/utils";

interface ActionLog { id: number; user_id?: string; user_email?: string; action_type: string; entity_type: string; entity_id?: string; description?: string; ip_address?: string; created_at: string }

export const AdminLogs = () => {
  const [page, setPage] = useState(1);
  const [filters, setFilters] = useState({ action_type: "", user_email: "", date_from: "", date_to: "" });
  const limit = 50;

  const { data, isLoading, error } = useQuery<{ items: ActionLog[]; total: number }>({
    queryKey: ["admin-logs", page, filters],
    queryFn: () => {
      const params = new URLSearchParams({ page: String(page), limit: String(limit) });
      if (filters.action_type) params.append("action_type", filters.action_type);
      if (filters.user_email) params.append("user_id", filters.user_email);
      if (filters.date_from) params.append("date_from", filters.date_from);
      if (filters.date_to) params.append("date_to", filters.date_to);
      return apiClient.get(`/admin/logs?${params}`).then(r => r.data);
    },
    retry: (failureCount, error) => {
      if (error.response && error.response.status >= 400 && error.response.status < 500) {
        return false;
      }
      return failureCount < 3;
    },
  });

  const exportCSV = () => {
    if (!data?.items?.length) { toast.error("Нет данных для экспорта"); return; }
    const headers = ["ID", "Дата", "Пользователь", "Действие", "Сущность", "ID сущности", "Описание", "IP"];
    const rows = data.items.map((log) => [
      log.id, formatDateTime(log.created_at), log.user_email || "Система", log.action_type, log.entity_type, log.entity_id || "—", log.description || "—", log.ip_address || "—",
    ]);
    const csv = [headers, ...rows].map((row) => row.map((cell) => `"${String(cell).replace(/"/g, '""')}"`).join(",")).join("\n");
    const blob = new Blob([csv], { type: "text/csv;charset=utf-8;" });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = url;
    link.download = `logs_${new Date().toISOString().split("T")[0]}.csv`;
    link.click();
    URL.revokeObjectURL(url);
    toast.success("CSV экспортирован");
  };

  const logs = data?.items || [];

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="text-3xl font-bold">Логи действий</h1>
        <Button onClick={exportCSV}><Download className="mr-2 h-4 w-4" /> Экспорт CSV</Button>
      </div>

      {/* Фильтры */}
      <Card>
        <CardContent className="pt-6">
          <div className="grid gap-4 md:grid-cols-5">
            <div className="md:col-span-2">
              <Label>Поиск по email пользователя</Label>
              <div className="relative">
                <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
                <Input
                  placeholder="user@example.com"
                  value={filters.user_email}
                  onChange={(e) => setFilters({ ...filters, user_email: e.target.value })}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter') {
                      // Поиск по нажатию Enter
                    }
                  }}
                />
              </div>
            </div>
            <div>
              <Label>Тип действия</Label>
              <Input
                value={filters.action_type}
                onChange={(e) => setFilters({ ...filters, action_type: e.target.value })}
                placeholder="login, create_order..."
              />
            </div>
            <div>
              <Label>Дата от</Label>
              <Input type="date" value={filters.date_from} onChange={(e) => setFilters({ ...filters, date_from: e.target.value })} />
            </div>
            <div>
              <Label>Дата до</Label>
              <Input type="date" value={filters.date_to} onChange={(e) => setFilters({ ...filters, date_to: e.target.value })} />
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Обработка ошибки */}
      {error && (
        <Card>
          <CardContent className="py-6">
            <p className="text-destructive text-center">
              Ошибка загрузки: {(error as any).message || "Проверьте подключение к серверу"}
            </p>
          </CardContent>
        </Card>
      )}

      {isLoading ? (
        <div className="space-y-4">{[...Array(10)].map((_, i) => <Card key={i} className="animate-pulse"><CardContent className="py-6"><div className="h-6 w-3/4 bg-muted rounded" /></CardContent></Card>)}</div>
      ) : !logs.length ? (
        <Card><CardContent className="py-12 text-center text-muted-foreground"><p>Логи не найдены</p></CardContent></Card>
      ) : (
        <>
          <Card>
            <CardContent className="p-0">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Дата</TableHead>
                    <TableHead>Пользователь</TableHead>
                    <TableHead>Действие</TableHead>
                    <TableHead>Сущность</TableHead>
                    <TableHead>ID</TableHead>
                    <TableHead>Описание</TableHead>
                    <TableHead>IP</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {logs.map((log) => (
                    <TableRow key={log.id}>
                      <TableCell className="text-sm">{formatDateTime(log.created_at)}</TableCell>
                      <TableCell>{log.user_email || "Система"}</TableCell>
                      <TableCell><Badge variant="outline">{log.action_type}</Badge></TableCell>
                      <TableCell>{log.entity_type}</TableCell>
                      <TableCell className="text-sm text-muted-foreground">{log.entity_id || "—"}</TableCell>
                      <TableCell className="max-w-xs truncate text-sm">{log.description || "—"}</TableCell>
                      <TableCell className="text-sm text-muted-foreground">{log.ip_address || "—"}</TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </CardContent>
          </Card>

          <div className="flex justify-center gap-2">
            <Button variant="outline" size="sm" onClick={() => setPage(Math.max(1, page - 1))} disabled={page === 1}>Назад</Button>
            <span className="text-sm py-2">Стр. {page}</span>
            <Button variant="outline" size="sm" onClick={() => setPage(page + 1)} disabled={logs.length < limit}>Вперёд</Button>
          </div>
        </>
      )}
    </div>
  );
};
