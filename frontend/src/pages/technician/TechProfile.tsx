import { useState } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { toast } from "react-toastify";

import { getCurrentTechnician, updateTechnicianProfile, getMaterials, createMaterialRequest } from "@/api/technicians";
import { authStore } from "@/stores/authStore";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { FileUpload } from "@/components/shared/FileUpload";
import { StatusBadge } from "@/components/shared/StatusBadge";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Plus, User } from "lucide-react";

// Схема профиля
const profileSchema = z.object({
  specialization: z.string().optional(),
  experience_years: z.coerce.number().min(0).optional(),
  portfolio_description: z.string().max(2000).optional(),
  is_available: z.boolean().default(true),
});

type ProfileFormData = z.infer<typeof profileSchema>;

// Схема заявки на материал
const materialRequestSchema = z.object({
  material_id: z.number().min(1, "Выберите материал"),
  quantity_requested: z.coerce.number().min(0.1, "Минимум 0.1"),
  comment: z.string().max(500).optional(),
});

type MaterialRequestData = z.infer<typeof materialRequestSchema>;

export const TechProfile = () => {
  const { user, updateUser } = authStore();
  const queryClient = useQueryClient();
  const [isEditing, setIsEditing] = useState(false);
  const [showMaterialModal, setShowMaterialModal] = useState(false);

  const { data: technician } = useQuery({
    queryKey: ["current-technician"],
    queryFn: getCurrentTechnician,
  });

  const { data: materials } = useQuery({
    queryKey: ["materials"],
    queryFn: getMaterials,
  });

  const updateProfileMutation = useMutation({
    mutationFn: (data: ProfileFormData) => updateTechnicianProfile(data),
    onSuccess: (res) => {
      updateUser(res.user);
      queryClient.invalidateQueries({ queryKey: ["current-technician"] });
      toast.success("Профиль обновлён");
      setIsEditing(false);
    },
    onError: () => toast.error("Ошибка обновления профиля"),
  });

  const createRequestMutation = useMutation({
    mutationFn: (data: MaterialRequestData) => createMaterialRequest(data),
    onSuccess: () => {
      toast.success("Заявка создана");
      setShowMaterialModal(false);
      resetRequest();
    },
    onError: () => toast.error("Ошибка создания заявки"),
  });

  const { register, handleSubmit, formState: { errors } } = useForm<ProfileFormData>({
    resolver: zodResolver(profileSchema),
    defaultValues: {
      specialization: technician?.specialization || "",
      experience_years: technician?.experience_years || 0,
      portfolio_description: technician?.portfolio_description || "",
      is_available: technician?.is_available ?? true,
    },
  });

  const { register: registerRequest, handleSubmit: handleSubmitRequest, reset: resetRequest, formState: { errors: requestErrors } } = useForm<MaterialRequestData>({
    resolver: zodResolver(materialRequestSchema),
  });

  const onSubmitProfile = (data: ProfileFormData) => {
    updateProfileMutation.mutate(data);
  };

  const onSubmitRequest = (data: MaterialRequestData) => {
    createRequestMutation.mutate(data);
  };

  return (
    <div className="max-w-2xl mx-auto space-y-6">
      <h1 className="text-3xl font-bold">Профиль техника</h1>

      {/* Основная информация */}
      <Card>
        <CardHeader>
          <CardTitle>Личная информация</CardTitle>
          <CardDescription>Ваши контактные данные</CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="flex items-center gap-4 mb-4">
            <div className="flex h-16 w-16 items-center justify-center rounded-full bg-primary/10">
              <User className="h-8 w-8 text-primary" />
            </div>
            <div>
              <p className="font-semibold text-lg">{user?.first_name} {user?.last_name}</p>
              <p className="text-muted-foreground">{user?.email}</p>
            </div>
          </div>

          <form onSubmit={handleSubmit(onSubmitProfile)} className="space-y-4">
            <div>
              <Label htmlFor="specialization">Специализация</Label>
              <Input
                id="specialization"
                {...register("specialization")}
                disabled={!isEditing}
                placeholder="Например: коронки, мосты"
              />
            </div>

            <div>
              <Label htmlFor="experience_years">Опыт работы (лет)</Label>
              <Input
                id="experience_years"
                type="number"
                min="0"
                {...register("experience_years")}
                disabled={!isEditing}
              />
            </div>

            <div>
              <Label htmlFor="portfolio_description">О портфолио</Label>
              <textarea
                id="portfolio_description"
                {...register("portfolio_description")}
                disabled={!isEditing}
                className="flex min-h-[100px] w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
                placeholder="Расскажите о своих навыках и достижениях..."
              />
            </div>

            <div className="flex items-center gap-2">
              <input
                type="checkbox"
                id="is_available"
                {...register("is_available")}
                disabled={!isEditing}
                className="h-4 w-4"
              />
              <Label htmlFor="is_available">Доступен для новых заказов</Label>
            </div>

            <div className="flex gap-4">
              {isEditing ? (
                <>
                  <Button type="submit">Сохранить</Button>
                  <Button type="button" variant="outline" onClick={() => setIsEditing(false)}>
                    Отмена
                  </Button>
                </>
              ) : (
                <Button type="button" onClick={() => setIsEditing(true)}>
                  Редактировать
                </Button>
              )}
            </div>
          </form>
        </CardContent>
      </Card>

      {/* Аватар */}
      <Card>
        <CardHeader>
          <CardTitle>Аватар</CardTitle>
          <CardDescription>Загрузите ваше фото</CardDescription>
        </CardHeader>
        <CardContent>
          <FileUpload
            onFilesChange={() => {}}
            maxFiles={1}
            acceptedTypes={{ "image/*": [".jpg", ".jpeg", ".png"] }}
          />
          <p className="text-xs text-muted-foreground mt-2">
            Поддерживаются: .jpg, .jpeg, .png (макс. 10MB)
          </p>
        </CardContent>
      </Card>
    </div>
  );
};
