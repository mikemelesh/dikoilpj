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
import { Search } from "lucide-react";

const TIER_COLORS: Record<string, string> = {
  bronze: "bg-amber-700", silver: "bg-gray-400", gold: "bg-yellow-500", platinum: "bg-blue-400",
};

export const ManagerClients = () => {
  const queryClient = useQueryClient();
  const [page, setPage] = useState(1);
  const [search, setSearch] = useState("");
  const [editModal, setEditModal] = useState<{ clientId: number; open: boolean; discount: number; tier: string }>({ clientId: 0, open: false, discount: 0, tier: "bronze" });
  const limit = 20;

  const { data, isLoading } = useQuery({
    queryKey: ["manager-clients", page, search],
    queryFn: () => getClients({ page, limit, search }),
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

  return (
    <div className="space-y-6">
      <h1 className="text-3xl font-bold">Клиенты</h1>

      <Card>
        <CardHeader>
          <div className="relative">
            <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
            <Input placeholder="Поиск по имени, email, клинике..." className="pl-10" value={search} onChange={(e) => setSearch(e.target.value)} />
          </div>
        </CardHeader>
      </Card>

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
                    <TableHead>Клиент</TableHead>
                    <TableHead>Клиника</TableHead>
                    <TableHead>Заказов</TableHead>
                    <TableHead>Лояльность</TableHead>
                    <TableHead>Скидка</TableHead>
                    <TableHead>Дата регистрации</TableHead>
                    <TableHead></TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {clients.map((client: any) => (
                    <TableRow key={client.id}>
                      <TableCell>
                        <div>
                          <p className="font-medium">{client.user?.first_name} {client.user?.last_name}</p>
                          <p className="text-sm text-muted-foreground">{client.user?.email}</p>
                        </div>
                      </TableCell>
                      <TableCell>{client.clinic_name || "—"}</TableCell>
                      <TableCell>{client.total_orders}</TableCell>
                      <TableCell><Badge className={TIER_COLORS[client.loyalty_tier] || "bg-muted"}>{client.loyalty_tier}</Badge></TableCell>
                      <TableCell>{client.discount_percent}%</TableCell>
                      <TableCell>{new Date(client.user?.created_at).toLocaleDateString("ru-RU")}</TableCell>
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
