import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { toast } from "react-toastify";

import { getPromotions, createPromotion, updatePromotion, deletePromotion } from "@/api/manager";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { Plus, Pencil, Trash2 } from "lucide-react";

const promotionSchema = z.object({
  title: z.string().min(1, "Название обязательно"),
  description: z.string().optional(),
  discount_percent: z.coerce.number().min(0).max(100),
  start_date: z.string(),
  end_date: z.string(),
  applies_to: z.enum(["all", "service", "category"]),
  target_id: z.coerce.number().optional(),
});

type PromotionFormData = z.infer<typeof promotionSchema>;

export const ManagerPromotions = () => {
  const queryClient = useQueryClient();
  const [modalOpen, setModalOpen] = useState(false);
  const [editingPromotion, setEditingPromotion] = useState<any>(null);

  const { data: promotionsData } = useQuery({ queryKey: ["manager-promotions"], queryFn: getPromotions });

  const promotions = promotionsData?.items || [];

  const createMutation = useMutation({ mutationFn: createPromotion, onSuccess: () => { queryClient.invalidateQueries({ queryKey: ["manager-promotions"] }); toast.success("Акция создана"); setModalOpen(false); }, onError: () => toast.error("Ошибка создания") });
  const updateMutation = useMutation({ mutationFn: ({ id, data }: { id: number; data: any }) => updatePromotion(id, data), onSuccess: () => { queryClient.invalidateQueries({ queryKey: ["manager-promotions"] }); toast.success("Акция обновлена"); setModalOpen(false); setEditingPromotion(null); }, onError: () => toast.error("Ошибка обновления") });
  const deleteMutation = useMutation({ mutationFn: deletePromotion, onSuccess: () => { queryClient.invalidateQueries({ queryKey: ["manager-promotions"] }); toast.success("Акция удалена"); }, onError: () => toast.error("Ошибка удаления") });

  const { register, handleSubmit, reset, formState: { errors } } = useForm<PromotionFormData>({
    resolver: zodResolver(promotionSchema),
    defaultValues: { title: "", description: "", discount_percent: 10, start_date: "", end_date: "", applies_to: "all", target_id: undefined },
  });

  const openCreate = () => { setEditingPromotion(null); reset({ title: "", description: "", discount_percent: 10, start_date: new Date().toISOString().split("T")[0], end_date: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString().split("T")[0], applies_to: "all", target_id: undefined }); setModalOpen(true); };
  const openEdit = (p: any) => { setEditingPromotion(p); reset({ ...p, start_date: p.start_date.split("T")[0], end_date: p.end_date.split("T")[0] }); setModalOpen(true); };

  const onSubmit = (data: PromotionFormData) => {
    if (editingPromotion) updateMutation.mutate({ id: editingPromotion.id, data });
    else createMutation.mutate(data);
  };

  const today = new Date().toISOString().split("T")[0];
  const isActive = (p: any) => p.is_active && p.start_date <= today && p.end_date >= today;

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="text-3xl font-bold">Акции</h1>
        <Button onClick={openCreate}><Plus className="mr-2 h-4 w-4" /> Добавить акцию</Button>
      </div>

      <Card>
        <CardContent className="p-0">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Название</TableHead>
                <TableHead>Скидка</TableHead>
                <TableHead>Период</TableHead>
                <TableHead>Применяется к</TableHead>
                <TableHead>Статус</TableHead>
                <TableHead></TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {promotions?.map((p: any) => (
                <TableRow key={p.id}>
                  <TableCell>
                    <div>
                      <p className="font-medium">{p.title}</p>
                      {p.description && <p className="text-sm text-muted-foreground line-clamp-1">{p.description}</p>}
                    </div>
                  </TableCell>
                  <TableCell><Badge variant="default">{p.discount_percent}%</Badge></TableCell>
                  <TableCell>{new Date(p.start_date).toLocaleDateString("ru-RU")} — {new Date(p.end_date).toLocaleDateString("ru-RU")}</TableCell>
                  <TableCell><Badge variant="outline">{p.applies_to === "all" ? "Всё" : p.applies_to === "service" ? "Услуга" : "Категория"}</Badge></TableCell>
                  <TableCell><Badge variant={isActive(p) ? "success" : "secondary"}>{isActive(p) ? "Активна" : "Неактивна"}</Badge></TableCell>
                  <TableCell>
                    <div className="flex justify-end gap-1">
                      <Button variant="ghost" size="icon" onClick={() => openEdit(p)}><Pencil className="h-4 w-4" /></Button>
                      <Button variant="ghost" size="icon" onClick={() => { if (confirm("Удалить акцию?")) deleteMutation.mutate(p.id); }}><Trash2 className="h-4 w-4 text-destructive" /></Button>
                    </div>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </CardContent>
      </Card>

      {/* Модал */}
      {modalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50">
          <div className="bg-background rounded-lg p-6 w-full max-w-lg max-h-[90vh] overflow-y-auto">
            <h2 className="text-xl font-bold mb-4">{editingPromotion ? "Редактировать акцию" : "Новая акция"}</h2>
            <form onSubmit={handleSubmit(onSubmit)} className="space-y-4">
              <div><Label>Название</Label><Input {...register("title")} /></div>
              {errors.title && <p className="text-sm text-destructive">{errors.title.message}</p>}
              <div><Label>Описание</Label><textarea {...register("description")} className="flex min-h-[80px] w-full rounded-md border border-input bg-background px-3 py-2 text-sm" /></div>
              <div><Label>Скидка (%)</Label><Input type="number" min="0" max="100" {...register("discount_percent")} /></div>
              {errors.discount_percent && <p className="text-sm text-destructive">{errors.discount_percent.message}</p>}
              <div className="grid grid-cols-2 gap-4">
                <div><Label>Дата начала</Label><Input type="date" {...register("start_date")} /></div>
                <div><Label>Дата окончания</Label><Input type="date" {...register("end_date")} /></div>
              </div>
              <div><Label>Применяется к</Label>
                <select {...register("applies_to")} className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm">
                  <option value="all">Все услуги</option>
                  <option value="service">Конкретная услуга</option>
                  <option value="category">Категория</option>
                </select>
              </div>
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
