import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { toast } from "react-toastify";
import { apiClient } from "@/api/axios";
import { useAuthStore } from "@/stores/authStore";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { X } from "lucide-react";
import { ExportButton } from "@/components/shared/ExportButton";

interface User {
  id: string;
  email: string;
  first_name?: string;
  last_name?: string;
  role: string;
  is_active: boolean;
  created_at: string;
}

const ROLE_LABELS: Record<string, string> = {
  admin: "Администратор",
  manager: "Менеджер",
  technician: "Техник",
  client: "Клиент",
  guest: "Гость",
};

const ROLE_COLORS: Record<string, string> = {
  admin: "bg-red-500",
  manager: "bg-blue-500",
  technician: "bg-green-500",
  client: "bg-gray-500",
  guest: "bg-gray-300",
};

const ASSIGNABLE_ROLES = ["guest", "client", "technician", "manager", "admin"] as const;

export const ManagerUsers = () => {
  const queryClient = useQueryClient();
  const currentRole = useAuthStore((s) => s.user?.role);
  const isAdmin = currentRole === "admin";

  const [page, setPage] = useState(1);
  const [search, setSearch] = useState("");
  const [roleFilter, setRoleFilter] = useState("");
  const [activeFilter, setActiveFilter] = useState("");

  const [sortBy, setSortBy] = useState<"name" | "email" | "role" | "is_active" | "created_at">("created_at");
  const [sortDir, setSortDir] = useState<"asc" | "desc">("desc");

  const toggleSort = (nextSortBy: typeof sortBy) => {
    setPage(1);

    if (nextSortBy === sortBy) {
      setSortDir(sortDir === "asc" ? "desc" : "asc");
    } else {
      setSortBy(nextSortBy);
      setSortDir("asc");
    }
  };
  const [editModal, setEditModal] = useState<{
    user: User | null;
    open: boolean;
    role: string;
    is_active: boolean;
  }>({ user: null, open: false, role: "client", is_active: true });
  const limit = 20;

  const roleOptions = isAdmin
    ? ASSIGNABLE_ROLES
    : ASSIGNABLE_ROLES.filter((r) => r !== "admin");

  const { data, isLoading } = useQuery<{ items: User[]; total: number }>({
    queryKey: ["manager-users", page, search, roleFilter, activeFilter, sortBy, sortDir],
    queryFn: () => {
      const params = new URLSearchParams({
        page: String(page),
        limit: String(limit),
        sort_by: sortBy,
        sort_dir: sortDir,
      });
      if (search) params.append("search", search);
      if (roleFilter) params.append("role", roleFilter);
      if (activeFilter) params.append("is_active", activeFilter);
      return apiClient.get(`/admin/users?${params}`).then((r) => r.data);
    },
  });

  const roleMutation = useMutation({
    mutationFn: ({ userId, role }: { userId: string; role: string }) =>
      apiClient.patch(`/admin/users/${userId}/role`, { role }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["manager-users"] });
      toast.success("Роль изменена");
      setEditModal({ user: null, open: false, role: "client", is_active: true });
    },
    onError: () => toast.error("Ошибка изменения роли"),
  });

  const statusMutation = useMutation({
    mutationFn: ({ userId, is_active }: { userId: string; is_active: boolean }) =>
      apiClient.patch(`/admin/users/${userId}/status`, { is_active }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["manager-users"] });
      toast.success("Статус изменён");
      setEditModal({ user: null, open: false, role: "client", is_active: true });
    },
    onError: () => toast.error("Ошибка изменения статуса"),
  });

  const handleSave = () => {
    if (!editModal.user) return;
    roleMutation.mutate({ userId: editModal.user.id, role: editModal.role });
    setTimeout(
      () =>
        statusMutation.mutate({
          userId: editModal.user!.id,
          is_active: editModal.is_active,
        }),
      100
    );
  };

  const users = data?.items || [];

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="text-3xl font-bold">Пользователи</h1>
        <ExportButton resource="users" title="Список пользователей" />
      </div>

      <Card>
        <CardContent className="pt-6">
          <div className="grid gap-4 md:grid-cols-4">
            <div className="md:col-span-2">
              <Label>Поиск</Label>
              <Input
                placeholder="Имя, email..."
                value={search}
                onChange={(e) => {
                  setSearch(e.target.value);
                  setPage(1);
                }}
              />
            </div>
            <div>
              <Label>Роль</Label>
              <select
                value={roleFilter}
                onChange={(e) => {
                  setRoleFilter(e.target.value);
                  setPage(1);
                }}
                className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
              >
                <option value="">Все</option>
                {roleOptions.map((r) => (
                  <option key={r} value={r}>
                    {ROLE_LABELS[r] ?? r}
                  </option>
                ))}
              </select>
            </div>
            <div>
              <Label>Статус</Label>
              <select
                value={activeFilter}
                onChange={(e) => {
                  setActiveFilter(e.target.value);
                  setPage(1);
                }}
                className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
              >
                <option value="">Все</option>
                <option value="true">Активен</option>
                <option value="false">Неактивен</option>
              </select>
            </div>
          </div>
        </CardContent>
      </Card>

      {isLoading ? (
        <Card>
          <CardContent className="py-12 text-center text-muted-foreground">
            Загрузка...
          </CardContent>
        </Card>
      ) : !users.length ? (
        <Card>
          <CardContent className="py-12 text-center text-muted-foreground">
            Пользователи не найдены
          </CardContent>
        </Card>
      ) : (
        <>
          <Card>
            <CardContent className="p-0">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead
                      className="cursor-pointer select-none"
                      onClick={() => toggleSort("name")}
                    >
                      Имя{sortBy === "name" ? (sortDir === "asc" ? " ▲" : " ▼") : ""}
                    </TableHead>
                    <TableHead
                      className="cursor-pointer select-none"
                      onClick={() => toggleSort("email")}
                    >
                      Email{sortBy === "email" ? (sortDir === "asc" ? " ▲" : " ▼") : ""}
                    </TableHead>
                    <TableHead
                      className="cursor-pointer select-none"
                      onClick={() => toggleSort("role")}
                    >
                      Роль{sortBy === "role" ? (sortDir === "asc" ? " ▲" : " ▼") : ""}
                    </TableHead>
                    <TableHead
                      className="cursor-pointer select-none"
                      onClick={() => toggleSort("is_active")}
                    >
                      Статус{sortBy === "is_active" ? (sortDir === "asc" ? " ▲" : " ▼") : ""}
                    </TableHead>
                    <TableHead
                      className="cursor-pointer select-none"
                      onClick={() => toggleSort("created_at")}
                    >
                      Регистрация
                      {sortBy === "created_at" ? (sortDir === "asc" ? " ▲" : " ▼") : ""}
                    </TableHead>
                    <TableHead />
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {users.map((user) => (
                    <TableRow key={user.id}>
                      <TableCell>
                        {user.first_name || "—"} {user.last_name || ""}
                      </TableCell>
                      <TableCell>{user.email}</TableCell>
                      <TableCell>
                        <Badge className={ROLE_COLORS[user.role] || "bg-muted"}>
                          {ROLE_LABELS[user.role] ?? user.role}
                        </Badge>
                      </TableCell>
                      <TableCell>
                        <Badge variant={user.is_active ? "default" : "secondary"}>
                          {user.is_active ? "Активен" : "Неактивен"}
                        </Badge>
                      </TableCell>
                      <TableCell>
                        {new Date(user.created_at).toLocaleDateString("ru-RU")}
                      </TableCell>
                      <TableCell>
                        <Button
                          variant="outline"
                          size="sm"
                          disabled={!isAdmin && user.role === "admin"}
                          onClick={() =>
                            setEditModal({
                              user,
                              open: true,
                              role: user.role,
                              is_active: user.is_active,
                            })
                          }
                        >
                          Изменить
                        </Button>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </CardContent>
          </Card>

          <div className="flex justify-center gap-2">
            <Button
              variant="outline"
              size="sm"
              onClick={() => setPage(Math.max(1, page - 1))}
              disabled={page === 1}
            >
              Назад
            </Button>
            <span className="text-sm py-2">Стр. {page}</span>
            <Button
              variant="outline"
              size="sm"
              onClick={() => setPage(page + 1)}
              disabled={users.length < limit}
            >
              Вперёд
            </Button>
          </div>
        </>
      )}

      {editModal.open && editModal.user && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50">
          <div className="bg-background rounded-lg p-6 w-full max-w-md">
            <div className="flex items-center justify-between mb-4">
              <h2 className="text-xl font-bold">Редактировать пользователя</h2>
              <button
                onClick={() =>
                  setEditModal({ user: null, open: false, role: "client", is_active: true })
                }
              >
                <X className="h-5 w-5" />
              </button>
            </div>
            <p className="text-sm text-muted-foreground mb-4">{editModal.user.email}</p>
            <div className="space-y-4">
              <div>
                <Label>Роль</Label>
                <select
                  value={editModal.role}
                  onChange={(e) => setEditModal({ ...editModal, role: e.target.value })}
                  className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
                >
                  {roleOptions.map((r) => (
                    <option key={r} value={r}>
                      {ROLE_LABELS[r] ?? r}
                    </option>
                  ))}
                </select>
              </div>
              <div className="flex items-center gap-2">
                <input
                  type="checkbox"
                  id="is_active"
                  checked={editModal.is_active}
                  onChange={(e) =>
                    setEditModal({ ...editModal, is_active: e.target.checked })
                  }
                  className="h-4 w-4"
                />
                <Label htmlFor="is_active">Активен</Label>
              </div>
            </div>
            <div className="flex justify-end gap-2 mt-6">
              <Button
                variant="outline"
                onClick={() =>
                  setEditModal({ user: null, open: false, role: "client", is_active: true })
                }
              >
                Отмена
              </Button>
              <Button
                onClick={handleSave}
                disabled={roleMutation.isPending || statusMutation.isPending}
              >
                {roleMutation.isPending || statusMutation.isPending
                  ? "Сохранение..."
                  : "Сохранить"}
              </Button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
