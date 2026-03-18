import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { toast } from "react-toastify";

import { getServices, createService, updateService, deleteService } from "@/api/manager";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { Plus, Pencil, Trash2 } from "lucide-react";

const serviceSchema = z.object({
  name: z.string().min(1, "Название обязательно"),
  category_id: z.coerce.number().min(1, "Выберите категорию"),
  description: z.string().optional(),
  base_price: z.coerce.number().min(0, "Минимум 0"),
  unit: z.string().min(1, "Единица обязательна"),
  duration_days: z.coerce.number().min(0, "Минимум 0"),
  is_active: z.boolean().default(true),
});

type ServiceFormData = z.infer<typeof serviceSchema>;

export const ManagerServices = () => {
  const queryClient = useQueryClient();
  const [modalOpen, setModalOpen] = useState(false);
  const [editingService, setEditingService] = useState<any>(null);

  const { data: servicesData } = useQuery({ queryKey: ["manager-services"], queryFn: getServices });

  const services = servicesData?.items || [];

  const createMutation = useMutation({
    mutationFn: createService,
    onSuccess: () => { queryClient.invalidateQueries({ queryKey: ["manager-services"] }); toast.success("Услуга создана"); setModalOpen(false); },
    onError: () => toast.error("Ошибка создания"),
  });

  const updateMutation = useMutation({
    mutationFn: ({ id, data }: { id: number; data: any }) => updateService(id, data),
    onSuccess: () => { queryClient.invalidateQueries({ queryKey: ["manager-services"] }); toast.success("Услуга обновлена"); setModalOpen(false); setEditingService(null); },
    onError: () => toast.error("Ошибка обновления"),
  });

  const deleteMutation = useMutation({
    mutationFn: deleteService,
    onSuccess: () => { queryClient.invalidateQueries({ queryKey: ["manager-services"] }); toast.success("Услуга удалена"); },
    onError: () => toast.error("Ошибка удаления"),
  });

  const { register, handleSubmit, reset, formState: { errors } } = useForm<ServiceFormData>({
    resolver: zodResolver(serviceSchema),
    defaultValues: { name: "", category_id: 1, description: "", base_price: 0, unit: "шт", duration_days: 1, is_active: true },
  });

  const openCreate = () => { setEditingService(null); reset({ name: "", category_id: 1, description: "", base_price: 0, unit: "шт", duration_days: 1, is_active: true }); setModalOpen(true); };
  const openEdit = (service: any) => { setEditingService(service); reset(service); setModalOpen(true); };

  const onSubmit = (data: ServiceFormData) => {
    if (editingService) {
      updateMutation.mutate({ id: editingService.id, data });
    } else {
      createMutation.mutate(data);
    }
  };

  const categories = [...new Set(services?.map((s: any) => s.category?.name || "Без категории"))];

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="text-3xl font-bold">Услуги</h1>
        <Button onClick={openCreate}><Plus className="mr-2 h-4 w-4" /> Добавить услугу</Button>
      </div>

      <Card>
        <CardContent className="p-0">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Название</TableHead>
                <TableHead>Категория</TableHead>
                <TableHead className="text-right">Цена</TableHead>
                <TableHead>Срок</TableHead>
                <TableHead>Статус</TableHead>
                <TableHead></TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {services?.map((s: any) => (
                <TableRow key={s.id}>
                  <TableCell>
                    <div>
                      <p className="font-medium">{s.name}</p>
                      {s.description && <p className="text-sm text-muted-foreground line-clamp-1">{s.description}</p>}
                    </div>
                  </TableCell>
                  <TableCell><Badge variant="outline">{s.category?.name || "Без категории"}</Badge></TableCell>
                  <TableCell className="text-right">{new Intl.NumberFormat("ru-RU", { style: "currency", currency: "RUB", minimumFractionDigits: 0 }).format(Number(s.base_price))}</TableCell>
                  <TableCell>{s.duration_days} дн.</TableCell>
                  <TableCell><Badge variant={s.is_active ? "default" : "secondary"}>{s.is_active ? "Активна" : "Неактивна"}</Badge></TableCell>
                  <TableCell>
                    <div className="flex justify-end gap-1">
                      <Button variant="ghost" size="icon" onClick={() => openEdit(s)}><Pencil className="h-4 w-4" /></Button>
                      <Button variant="ghost" size="icon" onClick={() => { if (confirm("Удалить услугу?")) deleteMutation.mutate(s.id); }}><Trash2 className="h-4 w-4 text-destructive" /></Button>
                    </div>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </CardContent>
      </Card>

      {/* Модал создания/редактирования */}
      {modalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50">
          <div className="bg-background rounded-lg p-6 w-full max-w-lg max-h-[90vh] overflow-y-auto">
            <h2 className="text-xl font-bold mb-4">{editingService ? "Редактировать услугу" : "Новая услуга"}</h2>
            <form onSubmit={handleSubmit(onSubmit)} className="space-y-4">
              <div><Label>Название</Label><Input {...register("name")} /></div>
              {errors.name && <p className="text-sm text-destructive">{errors.name.message}</p>}
              <div><Label>Категория</Label>
                <select {...register("category_id")} className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm">
                  <option value="1">Основная</option>
                  <option value="2">Дополнительная</option>
                </select>
              </div>
              <div><Label>Описание</Label><textarea {...register("description")} className="flex min-h-[80px] w-full rounded-md border border-input bg-background px-3 py-2 text-sm" /></div>
              <div className="grid grid-cols-2 gap-4">
                <div><Label>Цена</Label><Input type="number" step="0.01" {...register("base_price")} /></div>
                <div><Label>Единица</Label><Input {...register("unit")} placeholder="шт, этап, работа" /></div>
              </div>
              <div><Label>Срок выполнения (дней)</Label><Input type="number" {...register("duration_days")} /></div>
              <div className="flex items-center gap-2"><input type="checkbox" {...register("is_active")} className="h-4 w-4" /><Label>Активна</Label></div>
              <div className="flex justify-end gap-2">
                <Button type="button" variant="outline" onClick={() => setModalOpen(false)}>Отмена</Button>
                <Button type="submit" disabled={createMutation.isPending || updateMutation.isPending}>{createMutation.isPending || updateMutation.isPending ? "Сохранение..." : "Сохранить"}</Button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};
