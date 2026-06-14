import { useState } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { useMutation } from "@tanstack/react-query";
import { toast } from "react-toastify";
import { mutationOnError } from "@/lib/apiError";

import { updateProfile } from "@/api/auth";
import { apiClient } from "@/api/axios";
import { authStore } from "@/stores/authStore";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { User, Mail, Phone, Building2, MapPin } from "lucide-react";
import { PhoneInput } from "@/components/shared/PhoneInput";
import { ClientDiscountInfo } from "@/components/client/ClientDiscountInfo";

const profileSchema = z.object({
  first_name: z.string().min(1, "Введите имя"),
  last_name: z.string().min(1, "Введите фамилию"),
  phone: z.string()
    .regex(/^(\+375\d{9}|(\+375 \(\d{2}\) \d{3}-\d{2}-\d{2})?)$/, "Введите корректный белорусский номер телефона")
    .optional(),
  clinic_name: z.string().optional(),
  address: z.string().optional(),
}).superRefine((data, ctx) => {
  // validated in component based on client type
  if (data.clinic_name !== undefined && data.clinic_name !== null && !data.clinic_name.trim()) {
    ctx.addIssue({
      code: z.ZodIssueCode.custom,
      message: "Укажите название клиники",
      path: ["clinic_name"],
    });
  }
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

const clientTypeLabel = (type?: string) => {
  if (type === "legal") return "Юр. лицо";
  if (type === "physical") return "Физ. лицо";
  return "—";
};

export const ClientProfile = () => {
  const { user, updateUser } = authStore();
  const clientProfile = user?.client_profile;
  const isLegalEntity = clientProfile?.client_type === "legal";

  const [isEditing, setIsEditing] = useState(false);
  const [phoneValue, setPhoneValue] = useState(user?.phone || "");

  const defaultValues: ProfileFormData = {
    first_name: user?.first_name || "",
    last_name: user?.last_name || "",
    phone: user?.phone || "",
    clinic_name: clientProfile?.clinic_name || "",
    address: clientProfile?.address || "",
  };

  const {
    register: registerProfile,
    handleSubmit: handleSubmitProfile,
    reset: resetProfile,
    formState: { errors: profileErrors },
  } = useForm<ProfileFormData>({
    resolver: zodResolver(profileSchema),
    defaultValues,
  });

  const { register: registerPassword, handleSubmit: handleSubmitPassword, reset: resetPassword, formState: { errors: passwordErrors } } = useForm<PasswordFormData>({
    resolver: zodResolver(passwordSchema),
  });

  const updateMutation = useMutation({
    mutationFn: (data: ProfileFormData) => {
      const payload = {
        first_name: data.first_name,
        last_name: data.last_name,
        phone: phoneValue || null,
        clinic_name: isLegalEntity ? (data.clinic_name?.trim() || null) : undefined,
        address: data.address?.trim() || null,
      };
      return updateProfile(payload);
    },
    onSuccess: (response) => {
      updateUser({
        first_name: response.user.first_name,
        last_name: response.user.last_name,
        phone: response.user.phone,
        client_profile: response.client_profile ?? user?.client_profile,
      });
      toast.success("Профиль обновлён");
      setIsEditing(false);
    },
    onError: mutationOnError("Ошибка обновления профиля"),
  });

  const changePasswordMutation = useMutation({
    mutationFn: (data: { current_password: string; new_password: string }) =>
      apiClient.put("/auth/change-password", data),
    onSuccess: () => {
      toast.success("Пароль изменён");
      resetPassword();
    },
    onError: mutationOnError("Ошибка смены пароля"),
  });

  const handleCancelEdit = () => {
    resetProfile(defaultValues);
    setPhoneValue(user?.phone || "");
    setIsEditing(false);
  };

  const handleStartEdit = () => {
    resetProfile(defaultValues);
    setPhoneValue(user?.phone || "");
    window.setTimeout(() => setIsEditing(true), 0);
  };

  return (
    <div className="max-w-2xl mx-auto space-y-6">
      <h1 className="text-3xl font-bold">Профиль</h1>

      <ClientDiscountInfo variant="banner" />

      <Card>
        <CardHeader>
          <CardTitle>Личная информация</CardTitle>
          <CardDescription>Ваши контактные данные и данные клиники</CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <form onSubmit={handleSubmitProfile((data) => updateMutation.mutate(data))}>
            <div className="space-y-4">
              <div>
                <Label>Тип клиента</Label>
                <Input value={clientTypeLabel(clientProfile?.client_type)} disabled />
              </div>

              {isLegalEntity && (
                <div>
                  <Label htmlFor="clinic_name">Название клиники</Label>
                  <div className="relative">
                    <Building2 className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
                    <Input
                      id="clinic_name"
                      className="pl-10"
                      {...registerProfile("clinic_name")}
                      disabled={!isEditing}
                      placeholder="Название клиники"
                    />
                  </div>
                  {profileErrors.clinic_name && (
                    <p className="text-sm text-destructive">{profileErrors.clinic_name.message}</p>
                  )}
                </div>
              )}

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
                  {profileErrors.first_name && (
                    <p className="text-sm text-destructive">{profileErrors.first_name.message}</p>
                  )}
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
                  {profileErrors.last_name && (
                    <p className="text-sm text-destructive">{profileErrors.last_name.message}</p>
                  )}
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
                  <PhoneInput
                    id="phone"
                    className="pl-10"
                    value={phoneValue}
                    onChange={setPhoneValue}
                    disabled={!isEditing}
                    placeholder="+375 (XX) XXX-XX-XX"
                  />
                </div>
                {profileErrors.phone && (
                  <p className="text-sm text-destructive">{profileErrors.phone.message}</p>
                )}
              </div>

              {isLegalEntity && (
                <div>
                  <Label htmlFor="address">Адрес клиники</Label>
                  <div className="relative">
                    <MapPin className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
                    <Input
                      id="address"
                      className="pl-10"
                      {...registerProfile("address")}
                      disabled={!isEditing}
                      placeholder="г. Минск, ул. Примерная, 1"
                    />
                  </div>
                </div>
              )}
            </div>

            <div className="flex gap-4 mt-6">
              {isEditing ? (
                <>
                  <Button type="submit" disabled={updateMutation.isPending}>
                    {updateMutation.isPending ? "Сохранение..." : "Сохранить"}
                  </Button>
                  <Button type="button" variant="outline" onClick={handleCancelEdit}>
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
              {passwordErrors.current_password && (
                <p className="text-sm text-destructive">{passwordErrors.current_password.message}</p>
              )}
            </div>
            <div>
              <Label htmlFor="new_password">Новый пароль</Label>
              <Input type="password" id="new_password" {...registerPassword("new_password")} />
              {passwordErrors.new_password && (
                <p className="text-sm text-destructive">{passwordErrors.new_password.message}</p>
              )}
            </div>
            <div>
              <Label htmlFor="confirm_password">Подтверждение пароля</Label>
              <Input type="password" id="confirm_password" {...registerPassword("confirm_password")} />
              {passwordErrors.confirm_password && (
                <p className="text-sm text-destructive">{passwordErrors.confirm_password.message}</p>
              )}
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
