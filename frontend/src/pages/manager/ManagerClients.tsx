import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { toast } from "react-toastify";

import { getClients, updateClientLoyalty } from "@/api/manager";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { ExportButton } from "@/components/shared/ExportButton";
import { SearchAndFilter, type FilterConfig } from "@/components/shared/SearchAndFilter";
import { toExportFilters } from "@/lib/exportFilters";

const TIER_COLORS: Record<string, string> = {
  bronze: "bg-amber-700", silver: "bg-gray-400", gold: "bg-yellow-500", platinum: "bg-blue-400",
};

export const ManagerClients = () => {
  const queryClient = useQueryClient();
  const [page, setPage] = useState(1);
  const [search, setSearch] = useState("");
  const [filters, setFilters] = useState<Record<string, string>>({});
  const [editModal, setEditModal] = useState<{ clientId: number; open: boolean; discount: number; tier: string }>({ clientId: 0, open: false, discount: 0, tier: "bronze" });
  const limit = 20;

  const [sortBy, setSortBy] = useState<"client_name" | "clinic_name" | "total_orders" | "loyalty_tier" | "discount_percent" | "created_at">("created_at");
  const [sortDir, setSortDir] = useState<"asc" | "desc">("desc");

  const toggleSort = (nextSortBy: typeof sortBy) => {
    setPage(1);
    if (nextSortBy === sortBy) {
      setSortDir((prev) => (prev === "asc" ? "desc" : "asc"));
    } else {
      setSortBy(nextSortBy);
      setSortDir("asc");
    }
  };

  const { data, isLoading } = useQuery({
    queryKey: ["manager-clients", page, search, sortBy, sortDir],
    queryFn: () => getClients({ page, limit, search, sort_by: sortBy, sort_dir: sortDir }),
  });

  const updateMutation = useMutation({
    mutationFn: ({ clientId, data }: { clientId: number; data: { discount_percent?: number; loyalty_tier?: string } }) =>
      updateClientLoyalty(clientId, data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["manager-clients"] });
      toast.success("Данные обновлены");
      setEditModal({ clientId: 0, open: false, discount: 0, tier: "bronze" });
    },
    onError: () => toast.error("Ошибка обновления"),
  });

  const handleSave = () => {
    updateMutation.mutate({ clientId: editModal.clientId, data: { discount_percent: editModal.discount, loyalty_tier: editModal.tier } });
  };

  const clients = data?.items || [];

  const filterConfigs: FilterConfig[] = [
    {
      key: "status",
      label: "Статус заказов",
      type: "select",
      options: [
        { value: "new", label: "Новый" },
        { value: "confirmed", label: "Подтверждён" },
        { value: "in_progress", label: "В работе" },
        { value: "completed", label: "Завершён" },
      ],
    },
    { key: "date_from", label: "Период от", type: "date" },
    { key: "date_to", label: "Период до", type: "date" },
  ];

  const exportFilters = toExportFilters({ filters, search });

  return (
    <div className="space-y-6">
      <div className="flex justify-between items-center">
        <h1 className="text-3xl font-bold">Клиенты</h1>
        <ExportButton resource="orders-by-client" filters={exportFilters} title="Сводка заказов по клиентам" />
      </div>

      <SearchAndFilter
        onSearch={setSearch}
        onFilter={setFilters}
        filters={filterConfigs}
        searchPlaceholder="Поиск по имени, email, клинике..."
      />

      {isLoading ? (
        <div className="space-y-4">{[...Array(5)].map((_, i) => <Card key={i} className="animate-pulse"><CardContent className="py-6"><div className="h-6 w-3/4 bg-muted rounded" /></CardContent></Card>)}</div>
      ) : !clients.length ? (
        <Card><CardContent className="py-12 text-center text-muted-foreground"><p>Клиенты не найдены</p></CardContent></Card>
      ) : (
        <>
          <Card>
            <CardContent className="p-0">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead className="cursor-pointer select-none" onClick={() => toggleSort("client_name")}>
                      Клиент{sortBy === "client_name" ? (sortDir === "asc" ? " ▲" : " ▼") : ""}
                    </TableHead>
                    <TableHead className="cursor-pointer select-none" onClick={() => toggleSort("clinic_name")}>
                      Клиника{sortBy === "clinic_name" ? (sortDir === "asc" ? " ▲" : " ▼") : ""}
                    </TableHead>
                    <TableHead className="cursor-pointer select-none" onClick={() => toggleSort("total_orders")}>
                      Заказов{sortBy === "total_orders" ? (sortDir === "asc" ? " ▲" : " ▼") : ""}
                    </TableHead>
                    <TableHead className="cursor-pointer select-none" onClick={() => toggleSort("loyalty_tier")}>
                      Лояльность{sortBy === "loyalty_tier" ? (sortDir === "asc" ? " ▲" : " ▼") : ""}
                    </TableHead>
                    <TableHead className="cursor-pointer select-none" onClick={() => toggleSort("discount_percent")}>
                      Скидка{sortBy === "discount_percent" ? (sortDir === "asc" ? " ▲" : " ▼") : ""}
                    </TableHead>
                    <TableHead className="cursor-pointer select-none" onClick={() => toggleSort("created_at")}>
                      Дата регистрации{sortBy === "created_at" ? (sortDir === "asc" ? " ▲" : " ▼") : ""}
                    </TableHead>
                    <TableHead></TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {clients.map((client: any) => (
                    <TableRow key={client.id}>
                      <TableCell>
                        <div>
                          <p className="font-medium">{client.first_name} {client.last_name}</p>
                          <p className="text-sm text-muted-foreground">{client.email}</p>
                        </div>
                      </TableCell>
                      <TableCell>{client.clinic_name || "—"}</TableCell>
                      <TableCell>{client.total_orders}</TableCell>
                      <TableCell><Badge className={TIER_COLORS[client.loyalty_tier] || "bg-muted"}>{client.loyalty_tier}</Badge></TableCell>
                      <TableCell>{client.discount_percent}%</TableCell>
                      <TableCell>{client.created_at ? new Date(client.created_at).toLocaleDateString("ru-RU") : "—"}</TableCell>
                      <TableCell>
                        <Button variant="outline" size="sm" onClick={() => setEditModal({ clientId: client.id, open: true, discount: client.discount_percent, tier: client.loyalty_tier })}>Изменить</Button>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </CardContent>
          </Card>

          <div className="flex justify-center">
            <div className="flex items-center gap-2">
              <Button variant="outline" size="sm" onClick={() => setPage(Math.max(1, page - 1))} disabled={page === 1}>Назад</Button>
              <span className="text-sm">Стр. {page}</span>
              <Button variant="outline" size="sm" onClick={() => setPage(page + 1)} disabled={clients.length < limit}>Вперёд</Button>
            </div>
          </div>
        </>
      )}

      {/* Модал редактирования */}
      {editModal.open && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50">
          <div className="bg-background rounded-lg p-6 w-full max-w-md">
            <h2 className="text-xl font-bold mb-4">Редактировать клиента</h2>
            <div className="space-y-4">
              <div>
                <Label>Скидка (%)</Label>
                <Input type="number" min="0" max="100" value={editModal.discount} onChange={(e) => setEditModal({ ...editModal, discount: Number(e.target.value) })} />
              </div>
              <div>
                <Label>Уровень лояльности</Label>
                <select value={editModal.tier} onChange={(e) => setEditModal({ ...editModal, tier: e.target.value })} className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm">
                  <option value="bronze">Bronze</option>
                  <option value="silver">Silver</option>
                  <option value="gold">Gold</option>
                  <option value="platinum">Platinum</option>
                </select>
              </div>
            </div>
            <div className="flex justify-end gap-2 mt-6">
              <Button variant="outline" onClick={() => setEditModal({ clientId: 0, open: false, discount: 0, tier: "bronze" })}>Отмена</Button>
              <Button onClick={handleSave} disabled={updateMutation.isPending}>{updateMutation.isPending ? "Сохранение..." : "Сохранить"}</Button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};