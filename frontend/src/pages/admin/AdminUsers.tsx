import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { toast } from "react-toastify";
import { apiClient } from "@/api/axios";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Search, X } from "lucide-react";

interface User { id: string; email: string; first_name?: string; last_name?: string; role: string; is_active: boolean; created_at: string }

const ROLE_COLORS: Record<string, string> = { admin: "bg-red-500", manager: "bg-blue-500", technician: "bg-green-500", client: "bg-gray-500", guest: "bg-gray-300" };

export const AdminUsers = () => {
  const queryClient = useQueryClient();
  const [page, setPage] = useState(1);
  const [search, setSearch] = useState("");
  const [roleFilter, setRoleFilter] = useState("");
  const [activeFilter, setActiveFilter] = useState("");
  const [editModal, setEditModal] = useState<{ user: User | null; open: boolean; role: string; is_active: boolean }>({ user: null, open: false, role: "client", is_active: true });
  const limit = 20;

  const { data, isLoading } = useQuery<{ items: User[]; total: number }>({
    queryKey: ["admin-users", page, search, roleFilter, activeFilter],
    queryFn: () => {
      const params = new URLSearchParams({ page: String(page), limit: String(limit) });
      if (search) params.append("search", search);
      if (roleFilter) params.append("role", roleFilter);
      if (activeFilter) params.append("is_active", activeFilter);
      return apiClient.get(`/admin/users?${params}`).then(r => r.data);
    },
  });

  const roleMutation = useMutation({
    mutationFn: ({ userId, role }: { userId: string; role: string }) => apiClient.patch(`/admin/users/${userId}/role`, { role }),
    onSuccess: () => { queryClient.invalidateQueries({ queryKey: ["admin-users"] }); toast.success("Роль изменена"); setEditModal({ user: null, open: false, role: "client", is_active: true }); },
    onError: () => toast.error("Ошибка изменения роли"),
  });

  const statusMutation = useMutation({
    mutationFn: ({ userId, is_active }: { userId: string; is_active: boolean }) => apiClient.patch(`/admin/users/${userId}/status`, { is_active }),
    onSuccess: () => { queryClient.invalidateQueries({ queryKey: ["admin-users"] }); toast.success("Статус изменён"); setEditModal({ user: null, open: false, role: "client", is_active: true }); },
    onError: () => toast.error("Ошибка изменения статуса"),
  });

  const handleSave = () => {
    if (!editModal.user) return;
    roleMutation.mutate({ userId: editModal.user.id, role: editModal.role });
    setTimeout(() => statusMutation.mutate({ userId: editModal.user.id, is_active: editModal.is_active }), 100);
  };

  const users = data?.items || [];

  return (
    <div className="space-y-6">
      <h1 className="text-3xl font-bold">Пользователи</h1>

      {/* Фильтры */}
      <Card>
        <CardContent className="pt-6">
          <div className="grid gap-4 md:grid-cols-4">
            <div className="md:col-span-2">
              <Label>Поиск</Label>
              <div className="relative">
                <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
                <Input placeholder="Поиск по имени, email..." className="pl-10" value={search} onChange={(e) => { setSearch(e.target.value); setPage(1); }} />
                {search && (
                  <button onClick={() => { setSearch(""); setPage(1); }} className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground">
                    <X className="h-4 w-4" />
                  </button>
                )}
              </div>
            </div>
            <div>
              <Label>Роль</Label>
              <select value={roleFilter} onChange={(e) => { setRoleFilter(e.target.value); setPage(1); }} className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm">
                <option value="">Все</option>
                <option value="admin">Admin</option>
                <option value="manager">Manager</option>
                <option value="technician">Technician</option>
                <option value="client">Client</option>
                <option value="guest">Guest</option>
              </select>
            </div>
            <div>
              <Label>Статус</Label>
              <select value={activeFilter} onChange={(e) => { setActiveFilter(e.target.value); setPage(1); }} className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm">
                <option value="">Все</option>
                <option value="true">Активен</option>
                <option value="false">Неактивен</option>
              </select>
            </div>
          </div>
        </CardContent>
      </Card>

      {isLoading ? (
        <div className="space-y-4">{[...Array(5)].map((_, i) => <Card key={i} className="animate-pulse"><CardContent className="py-6"><div className="h-6 w-3/4 bg-muted rounded" /></CardContent></Card>)}</div>
      ) : !users.length ? (
        <Card><CardContent className="py-12 text-center text-muted-foreground"><p>Пользователи не найдены</p></CardContent></Card>
      ) : (
        <>
          <Card>
            <CardContent className="p-0">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Имя</TableHead>
                    <TableHead>Email</TableHead>
                    <TableHead>Роль</TableHead>
                    <TableHead>Статус</TableHead>
                    <TableHead>Дата регистрации</TableHead>
                    <TableHead></TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {users.map((user) => (
                    <TableRow key={user.id}>
                      <TableCell>
                        <div>
                          <p className="font-medium">{user.first_name || "—"} {user.last_name || ""}</p>
                        </div>
                      </TableCell>
                      <TableCell>{user.email}</TableCell>
                      <TableCell><Badge className={ROLE_COLORS[user.role] || "bg-muted"}>{user.role}</Badge></TableCell>
                      <TableCell><Badge variant={user.is_active ? "default" : "secondary"}>{user.is_active ? "Активен" : "Неактивен"}</Badge></TableCell>
                      <TableCell>{new Date(user.created_at).toLocaleDateString("ru-RU")}</TableCell>
                      <TableCell>
                        <Button variant="outline" size="sm" onClick={() => setEditModal({ user, open: true, role: user.role, is_active: user.is_active })}>Изменить</Button>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </CardContent>
          </Card>

          <div className="flex justify-center gap-2">
            <Button variant="outline" size="sm" onClick={() => setPage(Math.max(1, page - 1))} disabled={page === 1}>Назад</Button>
            <span className="text-sm py-2">Стр. {page}</span>
            <Button variant="outline" size="sm" onClick={() => setPage(page + 1)} disabled={users.length < limit}>Вперёд</Button>
          </div>
        </>
      )}

      {/* Модал редактирования */}
      {editModal.open && editModal.user && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50">
          <div className="bg-background rounded-lg p-6 w-full max-w-md">
            <div className="flex items-center justify-between mb-4">
              <h2 className="text-xl font-bold">Редактировать пользователя</h2>
              <button onClick={() => setEditModal({ user: null, open: false, role: "client", is_active: true })}><X className="h-5 w-5" /></button>
            </div>
            <div className="space-y-4">
              <div>
                <Label>Роль</Label>
                <select value={editModal.role} onChange={(e) => setEditModal({ ...editModal, role: e.target.value })} className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm">
                  <option value="guest">Guest</option>
                  <option value="client">Client</option>
                  <option value="technician">Technician</option>
                  <option value="manager">Manager</option>
                  <option value="admin">Admin</option>
                </select>
              </div>
              <div className="flex items-center gap-2">
                <input type="checkbox" id="is_active" checked={editModal.is_active} onChange={(e) => setEditModal({ ...editModal, is_active: e.target.checked })} className="h-4 w-4" />
                <Label htmlFor="is_active">Активен</Label>
              </div>
            </div>
            <div className="flex justify-end gap-2 mt-6">
              <Button variant="outline" onClick={() => setEditModal({ user: null, open: false, role: "client", is_active: true })}>Отмена</Button>
              <Button onClick={handleSave} disabled={roleMutation.isPending || statusMutation.isPending}>{roleMutation.isPending || statusMutation.isPending ? "Сохранение..." : "Сохранить"}</Button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
