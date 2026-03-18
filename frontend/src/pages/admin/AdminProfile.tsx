import { useState } from "react";
import { useMutation } from "@tanstack/react-query";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { toast } from "react-toastify";
import { apiClient } from "@/api/axios";
import { useAuthStore } from "@/stores/authStore";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { User, Mail, Phone, Save, X, Shield } from "lucide-react";

const profileSchema = z.object({
  first_name: z.string().optional(),
  last_name: z.string().optional(),
  phone: z.string().optional(),
});

type ProfileFormData = z.infer<typeof profileSchema>;

export const AdminProfile = () => {
  const { user } = useAuthStore();
  const [isEditing, setIsEditing] = useState(false);

  const { register, handleSubmit, reset } = useForm<ProfileFormData>({
    resolver: zodResolver(profileSchema),
    defaultValues: {
      first_name: user?.first_name || "",
      last_name: user?.last_name || "",
      phone: user?.phone || "",
    },
  });

  const updateMutation = useMutation({
    mutationFn: (data: ProfileFormData) => apiClient.put("/auth/profile", data),
    onSuccess: () => {
      toast.success("Профиль обновлён");
      setIsEditing(false);
    },
    onError: () => toast.error("Ошибка обновления"),
  });

  const onSubmit = (data: ProfileFormData) => {
    updateMutation.mutate(data);
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center gap-4">
        <div className="flex h-16 w-16 items-center justify-center rounded-full bg-primary/10">
          <Shield className="h-8 w-8 text-primary" />
        </div>
        <div>
          <h1 className="text-3xl font-bold">{user?.first_name || user?.last_name || user?.email}</h1>
          <p className="text-muted-foreground">Администратор</p>
        </div>
      </div>

      {/* Profile Card */}
      <Card>
        <CardHeader>
          <CardTitle>Личная информация</CardTitle>
          <CardDescription>Обновите ваши личные данные</CardDescription>
        </CardHeader>
        <CardContent>
          <form onSubmit={handleSubmit(onSubmit)} className="space-y-6">
            <div className="grid gap-6 md:grid-cols-2">
              <div className="space-y-2">
                <Label htmlFor="first_name">Имя</Label>
                <div className="relative">
                  <User className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
                  <Input
                    id="first_name"
                    {...register("first_name")}
                    disabled={!isEditing || updateMutation.isPending}
                    className="pl-10"
                    placeholder="Введите имя"
                  />
                </div>
              </div>

              <div className="space-y-2">
                <Label htmlFor="last_name">Фамилия</Label>
                <div className="relative">
                  <User className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
                  <Input
                    id="last_name"
                    {...register("last_name")}
                    disabled={!isEditing || updateMutation.isPending}
                    className="pl-10"
                    placeholder="Введите фамилию"
                  />
                </div>
              </div>
            </div>

            <div className="space-y-2">
              <Label htmlFor="email">Email</Label>
              <div className="relative">
                <Mail className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
                <Input id="email" value={user?.email} disabled className="pl-10 bg-muted" />
              </div>
              <p className="text-xs text-muted-foreground">Email нельзя изменить</p>
            </div>

            <div className="space-y-2">
              <Label htmlFor="phone">Телефон</Label>
              <div className="relative">
                <Phone className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
                <Input
                  id="phone"
                  {...register("phone")}
                  disabled={!isEditing || updateMutation.isPending}
                  className="pl-10"
                  placeholder="+7 (___) ___-__-__"
                />
              </div>
            </div>

            <div className="flex gap-3 pt-4">
              {isEditing ? (
                <>
                  <Button type="submit" disabled={updateMutation.isPending} className="gap-2">
                    <Save className="h-4 w-4" />
                    {updateMutation.isPending ? "Сохранение..." : "Сохранить"}
                  </Button>
                  <Button
                    type="button"
                    variant="outline"
                    onClick={() => { reset(); setIsEditing(false); }}
                    className="gap-2"
                  >
                    <X className="h-4 w-4" />
                    Отмена
                  </Button>
                </>
              ) : (
                <Button type="button" onClick={() => setIsEditing(true)} className="gap-2">
                  <User className="h-4 w-4" />
                  Редактировать
                </Button>
              )}
            </div>
          </form>
        </CardContent>
      </Card>
    </div>
  );
};
