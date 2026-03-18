import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { toast } from "react-toastify";

import { getMyMaterialRequests, getMaterials, createMaterialRequest } from "@/api/technicians";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { StatusBadge } from "@/components/shared/StatusBadge";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Plus } from "lucide-react";

// Схема заявки
const requestSchema = z.object({
  material_id: z.number().min(1, "Выберите материал"),
  quantity_requested: z.coerce.number().min(0.1, "Минимум 0.1"),
  comment: z.string().max(500).optional(),
});

type RequestFormData = z.infer<typeof requestSchema>;

export const TechMaterialRequests = () => {
  const queryClient = useQueryClient();
  const [showModal, setShowModal] = useState(false);

  const { data: requestsData } = useQuery({
    queryKey: ["my-material-requests"],
    queryFn: getMyMaterialRequests,
  });

  const requests = requestsData?.items || [];

  const { data: materialsData } = useQuery({
    queryKey: ["materials-list"],
    queryFn: getMaterials,
  });

  const materials = materialsData?.items || [];

  const createMutation = useMutation({
    mutationFn: (data: RequestFormData) => createMaterialRequest(data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["my-material-requests"] });
      toast.success("Заявка создана");
      setShowModal(false);
      reset();
    },
    onError: () => toast.error("Ошибка создания заявки"),
  });

  const { register, handleSubmit, reset, formState: { errors } } = useForm<RequestFormData>({
    resolver: zodResolver(requestSchema),
  });

  const onSubmit = (data: RequestFormData) => {
    createMutation.mutate(data);
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="text-3xl font-bold">Заявки на материалы</h1>
        <Button onClick={() => setShowModal(true)}>
          <Plus className="mr-2 h-4 w-4" /> Новая заявка
        </Button>
      </div>

      <Card>
        <CardHeader><CardTitle>Мои заявки</CardTitle></CardHeader>
        <CardContent>
          {!requests || requests.length === 0 ? (
            <p className="text-center text-muted-foreground py-8">Нет заявок</p>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Материал</TableHead>
                  <TableHead className="text-right">Кол-во</TableHead>
                  <TableHead>Статус</TableHead>
                  <TableHead>Дата</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {requests.map((req) => (
                  <TableRow key={req.id}>
                    <TableCell>{req.material?.name || `Материал #${req.material_id}`}</TableCell>
                    <TableCell className="text-right">
                      {req.quantity_requested} {req.material?.unit || "шт"}
                    </TableCell>
                    <TableCell><StatusBadge status={req.status} /></TableCell>
                    <TableCell>{new Date(req.created_at).toLocaleDateString("ru-RU")}</TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>

      {/* Модал новой заявки */}
      {showModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50">
          <div className="bg-background rounded-lg p-6 w-full max-w-md">
            <h2 className="text-xl font-bold mb-4">Новая заявка на материал</h2>
            <form onSubmit={handleSubmit(onSubmit)} className="space-y-4">
              <div>
                <Label htmlFor="material_id">Материал</Label>
                <select
                  id="material_id"
                  {...register("material_id", { valueAsNumber: true })}
                  className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
                >
                  <option value={0}>Выберите материал</option>
                  {materials?.map((m) => (
                    <option key={m.id} value={m.id}>
                      {m.name} (остаток: {Number(m.quantity)} {m.unit})
                    </option>
                  ))}
                </select>
                {errors.material_id && <p className="text-sm text-destructive">{errors.material_id.message}</p>}
              </div>

              <div>
                <Label htmlFor="quantity_requested">Количество</Label>
                <Input
                  id="quantity_requested"
                  type="number"
                  step="0.1"
                  min="0.1"
                  {...register("quantity_requested")}
                />
                {errors.quantity_requested && <p className="text-sm text-destructive">{errors.quantity_requested.message}</p>}
              </div>

              <div>
                <Label htmlFor="comment">Комментарий (необязательно)</Label>
                <Input id="comment" {...register("comment")} placeholder="Для чего нужен материал..." />
              </div>

              <div className="flex justify-end gap-2">
                <Button type="button" variant="outline" onClick={() => setShowModal(false)}>
                  Отмена
                </Button>
                <Button type="submit" disabled={createMutation.isPending}>
                  {createMutation.isPending ? "Создание..." : "Создать заявку"}
                </Button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};
