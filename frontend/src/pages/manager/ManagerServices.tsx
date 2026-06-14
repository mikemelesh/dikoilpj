import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useForm, Controller } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { toast } from "react-toastify";
import { mutationOnError } from "@/lib/apiError";

import { getServices, createService, updateService, deleteService, getServiceCategories } from "@/api/manager";
import type { Service, ServiceCategory } from "@/types";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Plus, Pencil, Trash2 } from "lucide-react";

const serviceSchema = z.object({
  name: z.string().min(1, "Название обязательно"),
  category_id: z.coerce.number().min(1, "Выберите категорию"),
  description: z.string().optional(),
  base_price: z.coerce.number().min(0, "Отрицательные значения недопустимы"),
  unit: z.string().min(1, "Единица обязательна"),
  duration_days: z.coerce.number().min(0, "Отрицательные значения недопустимы"),
  is_active: z.boolean().default(true),
});

type ServiceFormData = z.infer<typeof serviceSchema>;

const getCategoryLabel = (service: Service) =>
  service.category?.name ?? service.category_name ?? "Без категории";

export const ManagerServices = () => {
  const queryClient = useQueryClient();
  const [modalOpen, setModalOpen] = useState(false);
  const [editingService, setEditingService] = useState<Service | null>(null);

  const { data: servicesData, isLoading: servicesLoading } = useQuery({
    queryKey: ["manager-services"],
    queryFn: () => getServices({ limit: 100 }),
  });

  const { data: categories = [], isLoading: categoriesLoading } = useQuery({
    queryKey: ["service-categories"],
    queryFn: getServiceCategories,
  });

  const services = servicesData?.items ?? [];

  const createMutation = useMutation({
    mutationFn: createService,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["manager-services"] });
      toast.success("Услуга создана");
      setModalOpen(false);
    },
    onError: mutationOnError("Ошибка создания услуги"),
  });

  const updateMutation = useMutation({
    mutationFn: ({ id, data }: { id: number; data: ServiceFormData }) => updateService(id, data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["manager-services"] });
      toast.success("Услуга обновлена");
      setModalOpen(false);
      setEditingService(null);
    },
    onError: mutationOnError("Ошибка обновления услуги"),
  });

  const deleteMutation = useMutation({
    mutationFn: deleteService,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["manager-services"] });
      toast.success("Услуга удалена");
    },
    onError: mutationOnError("Ошибка удаления"),
  });

  const {
    register,
    handleSubmit,
    reset,
    control,
    formState: { errors },
  } = useForm<ServiceFormData>({
    resolver: zodResolver(serviceSchema),
    defaultValues: {
      name: "",
      category_id: 0,
      description: "",
      base_price: 0,
      unit: "шт",
      duration_days: 1,
      is_active: true,
    },
  });

  const defaultCategoryId = categories[0]?.id ?? 0;

  const openCreate = () => {
    if (!categories.length) {
      toast.error("Категории услуг не загружены. Обновите страницу.");
      return;
    }
    setEditingService(null);
    reset({
      name: "",
      category_id: defaultCategoryId,
      description: "",
      base_price: 0,
      unit: "шт",
      duration_days: 1,
      is_active: true,
    });
    setModalOpen(true);
  };

  const openEdit = (service: Service) => {
    setEditingService(service);
    reset({
      name: service.name,
      category_id: service.category_id,
      description: service.description ?? "",
      base_price: Number(service.base_price),
      unit: service.unit,
      duration_days: service.duration_days,
      is_active: service.is_active,
    });
    setModalOpen(true);
  };

  const onSubmit = (data: ServiceFormData) => {
    if (editingService) {
      updateMutation.mutate({ id: editingService.id, data });
    } else {
      createMutation.mutate(data);
    }
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold">Услуги</h1>
          <p className="text-sm text-muted-foreground mt-1">
            Категория выбирается из фиксированного списка лаборатории
          </p>
        </div>
        <Button onClick={openCreate} disabled={categoriesLoading || !categories.length}>
          <Plus className="mr-2 h-4 w-4" /> Добавить услугу
        </Button>
      </div>

      <Card>
        <CardContent className="p-0">
          {servicesLoading ? (
            <p className="p-6 text-muted-foreground">Загрузка...</p>
          ) : (
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
                {services.map((service) => (
                  <TableRow key={service.id}>
                    <TableCell>
                      <div>
                        <p className="font-medium">{service.name}</p>
                        {service.description && (
                          <p className="text-sm text-muted-foreground line-clamp-1">
                            {service.description}
                          </p>
                        )}
                      </div>
                    </TableCell>
                    <TableCell>
                      <Badge variant="outline">{getCategoryLabel(service)}</Badge>
                    </TableCell>
                    <TableCell className="text-right">
                      {new Intl.NumberFormat("ru-RU", {
                        style: "currency",
                        currency: "BYN",
                        minimumFractionDigits: 2,
                      }).format(Number(service.base_price))}
                    </TableCell>
                    <TableCell>{service.duration_days} дн.</TableCell>
                    <TableCell>
                      <Badge variant={service.is_active ? "default" : "secondary"}>
                        {service.is_active ? "Активна" : "Неактивна"}
                      </Badge>
                    </TableCell>
                    <TableCell>
                      <div className="flex justify-end gap-1">
                        <Button variant="ghost" size="icon" onClick={() => openEdit(service)}>
                          <Pencil className="h-4 w-4" />
                        </Button>
                        <Button
                          variant="ghost"
                          size="icon"
                          onClick={() => {
                            if (confirm("Удалить услугу?")) deleteMutation.mutate(service.id);
                          }}
                        >
                          <Trash2 className="h-4 w-4 text-destructive" />
                        </Button>
                      </div>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>

      {modalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50">
          <div className="bg-background rounded-lg p-6 w-full max-w-lg max-h-[90vh] overflow-y-auto">
            <h2 className="text-xl font-bold mb-4">
              {editingService ? "Редактировать услугу" : "Новая услуга"}
            </h2>
            <form onSubmit={handleSubmit(onSubmit)} className="space-y-4">
              <div>
                <Label>Название</Label>
                <Input {...register("name")} />
                {errors.name && (
                  <p className="text-sm text-destructive">{errors.name.message}</p>
                )}
              </div>

              <div>
                <Label>Категория</Label>
                <Controller
                  name="category_id"
                  control={control}
                  render={({ field }) => (
                    <Select
                      value={field.value ? String(field.value) : undefined}
                      onValueChange={(value) => field.onChange(Number(value))}
                      disabled={categoriesLoading || !categories.length}
                    >
                      <SelectTrigger>
                        <SelectValue placeholder="Выберите категорию" />
                      </SelectTrigger>
                      <SelectContent>
                        {categories.map((category: ServiceCategory) => (
                          <SelectItem key={category.id} value={String(category.id)}>
                            {category.name}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  )}
                />
                {errors.category_id && (
                  <p className="text-sm text-destructive">{errors.category_id.message}</p>
                )}
              </div>

              <div>
                <Label>Описание</Label>
                <textarea
                  {...register("description")}
                  className="flex min-h-[80px] w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
                />
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <Label>Цена</Label>
                  <Input type="number" step="0.01" min={0} {...register("base_price")} />
                  {errors.base_price && (
                    <p className="text-sm text-destructive">{errors.base_price.message}</p>
                  )}
                </div>
                <div>
                  <Label>Единица</Label>
                  <Input {...register("unit")} placeholder="шт, этап, работа" />
                  {errors.unit && (
                    <p className="text-sm text-destructive">{errors.unit.message}</p>
                  )}
                </div>
              </div>

              <div>
                <Label>Срок выполнения (дней)</Label>
                <Input type="number" min={0} {...register("duration_days")} />
                {errors.duration_days && (
                  <p className="text-sm text-destructive">{errors.duration_days.message}</p>
                )}
              </div>

              <div className="flex items-center gap-2">
                <input type="checkbox" {...register("is_active")} className="h-4 w-4" />
                <Label>Активна</Label>
              </div>

              <div className="flex justify-end gap-2">
                <Button type="button" variant="outline" onClick={() => setModalOpen(false)}>
                  Отмена
                </Button>
                <Button
                  type="submit"
                  disabled={createMutation.isPending || updateMutation.isPending}
                >
                  {createMutation.isPending || updateMutation.isPending
                    ? "Сохранение..."
                    : "Сохранить"}
                </Button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};
