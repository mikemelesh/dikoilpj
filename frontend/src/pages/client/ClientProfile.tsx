import { useState } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { useMutation } from "@tanstack/react-query";
import { toast } from "react-toastify";

import { apiClient } from "@/api/axios";
import { authStore } from "@/stores/authStore";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { User, Mail, Phone } from "lucide-react";

// =============================================================================
// Схемы форм
// =============================================================================

const profileSchema = z.object({
  first_name: z.string().min(1, "Введите имя"),
  last_name: z.string().min(1, "Введите фамилию"),
  phone: z.string().optional(),
});

const passwordSchema = z.object({
  current_password: z.string().min(1, "Введите текущий пароль"),
  new_password: z
    .string()
    .min(8, "Минимум 8 символов")
    .regex(/[A-Za-z]/, "Должна быть буква")
    .regex(/\d/, "Должна быть цифра"),
  confirm_password: z.string(),
}).refine((d) => d.new_password === d.confirm_password, {
  message: "Пароли не совпадают",
  path: ["confirm_password"],
});

type ProfileFormData = z.infer<typeof profileSchema>;
type PasswordFormData = z.infer<typeof passwordSchema>;

// =============================================================================
// Компонент ClientProfile
// =============================================================================

export const ClientProfile = () => {
  const { user, updateUser } = authStore();
  const [isEditing, setIsEditing] = useState(false);

  const { register: registerProfile, handleSubmit: handleSubmitProfile, formState: { errors: profileErrors } } = useForm<ProfileFormData>({
    resolver: zodResolver(profileSchema),
    defaultValues: {
      first_name: user?.first_name || "",
      last_name: user?.last_name || "",
      phone: user?.phone || "",
    },
  });

  const { register: registerPassword, handleSubmit: handleSubmitPassword, reset: resetPassword, formState: { errors: passwordErrors } } = useForm<PasswordFormData>({
    resolver: zodResolver(passwordSchema),
  });

  const updateProfileMutation = useMutation({
    mutationFn: (data: ProfileFormData) => apiClient.put("/auth/me", data),
    onSuccess: (res) => {
      updateUser(res.data);
      toast.success("Профиль обновлён");
      setIsEditing(false);
    },
    onError: () => toast.error("Ошибка обновления профиля"),
  });

  const changePasswordMutation = useMutation({
    mutationFn: (data: { current_password: string; new_password: string }) =>
      apiClient.put("/auth/change-password", data),
    onSuccess: () => {
      toast.success("Пароль изменён");
      resetPassword();
    },
    onError: () => toast.error("Ошибка смены пароля"),
  });

  return (
    <div className="max-w-2xl mx-auto space-y-6">
      <h1 className="text-3xl font-bold">Профиль</h1>

      {/* Основная информация */}
      <Card>
        <CardHeader>
          <CardTitle>Личная информация</CardTitle>
          <CardDescription>Ваши контактные данные</CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <form onSubmit={handleSubmitProfile((data) => updateProfileMutation.mutate(data))}>
            <div className="space-y-4">
              <div className="grid gap-4 sm:grid-cols-2">
                <div>
                  <Label htmlFor="first_name">Имя</Label>
                  <div className="relative">
                    <User className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
                    <Input
                      id="first_name"
                      className="pl-10"
                      {...registerProfile("first_name")}
                      disabled={!isEditing}
                    />
                  </div>
                  {profileErrors.first_name && <p className="text-sm text-destructive">{profileErrors.first_name.message}</p>}
                </div>
                <div>
                  <Label htmlFor="last_name">Фамилия</Label>
                  <div className="relative">
                    <User className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
                    <Input
                      id="last_name"
                      className="pl-10"
                      {...registerProfile("last_name")}
                      disabled={!isEditing}
                    />
                  </div>
                  {profileErrors.last_name && <p className="text-sm text-destructive">{profileErrors.last_name.message}</p>}
                </div>
              </div>

              <div>
                <Label htmlFor="email">Email</Label>
                <div className="relative">
                  <Mail className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
                  <Input id="email" value={user?.email || ""} disabled className="pl-10" />
                </div>
                <p className="text-xs text-muted-foreground mt-1">Email нельзя изменить</p>
              </div>

              <div>
                <Label htmlFor="phone">Телефон</Label>
                <div className="relative">
                  <Phone className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
                  <Input
                    id="phone"
                    className="pl-10"
                    {...registerProfile("phone")}
                    disabled={!isEditing}
                  />
                </div>
              </div>
            </div>

            <div className="flex gap-4 mt-6">
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

      {/* Смена пароля */}
      <Card>
        <CardHeader>
          <CardTitle>Смена пароля</CardTitle>
        </CardHeader>
        <CardContent>
          <form
            onSubmit={handleSubmitPassword((data) => changePasswordMutation.mutate({
              current_password: data.current_password,
              new_password: data.new_password,
            }))}
            className="space-y-4"
          >
            <div>
              <Label htmlFor="current_password">Текущий пароль</Label>
              <Input type="password" id="current_password" {...registerPassword("current_password")} />
              {passwordErrors.current_password && <p className="text-sm text-destructive">{passwordErrors.current_password.message}</p>}
            </div>
            <div>
              <Label htmlFor="new_password">Новый пароль</Label>
              <Input type="password" id="new_password" {...registerPassword("new_password")} />
              {passwordErrors.new_password && <p className="text-sm text-destructive">{passwordErrors.new_password.message}</p>}
            </div>
            <div>
              <Label htmlFor="confirm_password">Подтверждение пароля</Label>
              <Input type="password" id="confirm_password" {...registerPassword("confirm_password")} />
              {passwordErrors.confirm_password && <p className="text-sm text-destructive">{passwordErrors.confirm_password.message}</p>}
            </div>
            <Button type="submit" disabled={changePasswordMutation.isPending}>
              {changePasswordMutation.isPending ? "Изменение..." : "Изменить пароль"}
            </Button>
          </form>
        </CardContent>
      </Card>
    </div>
  );
};
