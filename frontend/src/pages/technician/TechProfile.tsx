import { useEffect, useState } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { toast } from "react-toastify";
import { mutationOnError } from "@/lib/apiError";

import { getCurrentTechnician, updateTechnicianProfile } from "@/api/technicians";
import { authStore } from "@/stores/authStore";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { FileUpload } from "@/components/shared/FileUpload";
import { User } from "lucide-react";

const profileSchema = z.object({
  specialization: z.string().optional(),
  experience_years: z.coerce.number().min(0).optional(),
  portfolio_description: z.string().max(2000).optional(),
});

type ProfileFormData = z.infer<typeof profileSchema>;

export const TechProfile = () => {
  const { user } = authStore();
  const queryClient = useQueryClient();
  const [isEditing, setIsEditing] = useState(false);

  const { data: technician } = useQuery({
    queryKey: ["current-technician"],
    queryFn: getCurrentTechnician,
  });

  const { register, handleSubmit, reset, formState: { errors } } = useForm<ProfileFormData>({
    resolver: zodResolver(profileSchema),
    defaultValues: {
      specialization: "",
      experience_years: 0,
      portfolio_description: "",
    },
  });

  useEffect(() => {
    if (!technician) return;
    reset({
      specialization: technician.specialization || "",
      experience_years: technician.experience_years ?? 0,
      portfolio_description: technician.portfolio_description || "",
    });
  }, [technician, reset]);

  const updateMutation = useMutation({
    mutationFn: (data: ProfileFormData) =>
      updateTechnicianProfile({
        specialization: data.specialization?.trim() || undefined,
        experience_years: data.experience_years,
        portfolio_description: data.portfolio_description?.trim() || undefined,
      }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["current-technician"] });
      queryClient.invalidateQueries({ queryKey: ["current-technician-full"] });
      toast.success("Профиль обновлён");
      setIsEditing(false);
    },
    onError: mutationOnError("Ошибка обновления профиля"),
  });

  const onSubmitProfile = (data: ProfileFormData) => {
    updateMutation.mutate(data);
  };

  const handleCancelEdit = () => {
    if (technician) {
      reset({
        specialization: technician.specialization || "",
        experience_years: technician.experience_years ?? 0,
        portfolio_description: technician.portfolio_description || "",
      });
    }
    setIsEditing(false);
  };

  const handleStartEdit = () => {
    if (technician) {
      reset({
        specialization: technician.specialization || "",
        experience_years: technician.experience_years ?? 0,
        portfolio_description: technician.portfolio_description || "",
      });
    }
    window.setTimeout(() => setIsEditing(true), 0);
  };

  return (
    <div className="max-w-2xl mx-auto space-y-6">
      <h1 className="text-3xl font-bold">Профиль техника</h1>

      <Card>
        <CardHeader>
          <CardTitle>Личная информация</CardTitle>
          <CardDescription>Ваши контактные данные и специализация</CardDescription>
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

          <form
            onSubmit={handleSubmit(onSubmitProfile, () => toast.error("Проверьте правильность данных"))}
            className="space-y-4"
          >
            <div>
              <Label htmlFor="specialization">Специализация</Label>
              <Input
                id="specialization"
                {...register("specialization")}
                disabled={!isEditing || updateMutation.isPending}
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
                disabled={!isEditing || updateMutation.isPending}
              />
              {errors.experience_years && (
                <p className="text-sm text-destructive">{errors.experience_years.message}</p>
              )}
            </div>

            <div>
              <Label htmlFor="portfolio_description">О портфолио</Label>
              <textarea
                id="portfolio_description"
                {...register("portfolio_description")}
                disabled={!isEditing || updateMutation.isPending}
                className="flex min-h-[100px] w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
                placeholder="Расскажите о своих навыках и достижениях..."
              />
              {errors.portfolio_description && (
                <p className="text-sm text-destructive">{errors.portfolio_description.message}</p>
              )}
            </div>

            <p className="text-sm text-muted-foreground">
              Назначение заказов выполняет менеджер. Статус «в работе» также выставляет менеджер.
            </p>

            <div className="flex gap-4">
              {isEditing ? (
                <>
                  <Button type="submit" disabled={updateMutation.isPending}>
                    {updateMutation.isPending ? "Сохранение..." : "Сохранить"}
                  </Button>
                  <Button
                    type="button"
                    variant="outline"
                    onClick={handleCancelEdit}
                    disabled={updateMutation.isPending}
                  >
                    Отмена
                  </Button>
                </>
              ) : (
                <Button type="button" onClick={handleStartEdit}>
                  Редактировать
                </Button>
              )}
            </div>
          </form>
        </CardContent>
      </Card>

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
