import { useState } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { useNavigate, Link } from "react-router-dom";
import { toast } from "react-toastify";
import { getApiErrorMessage } from "@/lib/apiError";

import { register as registerApi } from "@/api/auth";
import { authStore } from "@/stores/authStore";
import { getDashboardPath } from "@/router";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Building2, Mail, Lock, User, Phone, UserCheck } from "lucide-react";
import { PhoneInput } from "@/components/shared/PhoneInput";
import { PublicHeader } from "@/components/layout/PublicHeader";

// =============================================================================
// Схема валидации
// =============================================================================

const registerSchema = z.object({
  email: z.string().email("Некорректный email"),
  password: z
    .string()
    .min(8, "Минимум 8 символов")
    .regex(/[A-Za-z]/, "Должна быть хотя бы одна буква")
    .regex(/\d/, "Должна быть хотя бы одна цифра"),
  confirm_password: z.string(),
  first_name: z.string().min(1, "Введите имя"),
  last_name: z.string().min(1, "Введите фамилию"),
  phone: z.string()
    .regex(/^(\+375\d{9}|(\+375 \(\d{2}\) \d{3}-\d{2}-\d{2})?)$/, "Введите корректный белорусский номер телефона")
    .optional(),
  client_type: z.enum(["physical", "legal"], {
    errorMap: () => ({ message: "Выберите тип клиента" })
  }),
  clinic_name: z.string().optional(),
}).refine((data) => data.password === data.confirm_password, {
  message: "Пароли не совпадают",
  path: ["confirm_password"],
}).superRefine((data, ctx) => {
  if (data.client_type === "legal" && !data.clinic_name?.trim()) {
    ctx.addIssue({
      code: z.ZodIssueCode.custom,
      message: "Укажите название клиники",
      path: ["clinic_name"],
    });
  }
});

type RegisterFormData = z.infer<typeof registerSchema>;

// =============================================================================
// Компонент RegisterPage
// =============================================================================

export const RegisterPage = () => {
  const navigate = useNavigate();
  const login = authStore((state) => state.login);
  const [isLoading, setIsLoading] = useState(false);
  const [selectedType, setSelectedType] = useState<RegisterFormData["client_type"]>("physical");
  const [phoneValue, setPhoneValue] = useState("");

  const {
    register,
    handleSubmit,
    setValue,
    formState: { errors },
  } = useForm<RegisterFormData>({
    resolver: zodResolver(registerSchema),
    defaultValues: {
      email: "",
      password: "",
      confirm_password: "",
      first_name: "",
      last_name: "",
      phone: "",
      client_type: "physical",
      clinic_name: "",
    },
  });

  const onSubmit = async (data: RegisterFormData) => {
    setIsLoading(true);

    try {
      const { confirm_password, ...registerData } = data;
      // Override phone with formatted value
      const submitData = {
        ...registerData,
        phone: phoneValue || undefined,
        clinic_name: data.client_type === "legal" ? data.clinic_name?.trim() : undefined,
      };

      const response = await registerApi(submitData);

      // Проверяем, что пользователь есть в ответе
      if (!response.user) {
        throw new Error("Не удалось получить данные пользователя");
      }

      // Объединяем user с профилями (клиент или техник)
      const userWithProfile = {
        ...response.user,
        client_profile: response.client_profile,
        technician_profile: response.technician_profile,
      };

      // Автологин после регистрации
      login(
        { access_token: response.access_token, refresh_token: response.refresh_token },
        userWithProfile
      );

      toast.success("Регистрация успешна");

      // Редирект на дашборд согласно роли
      const dashboardPath = getDashboardPath(response.user.role);
      navigate(dashboardPath, { replace: true });
    } catch (error: unknown) {
      toast.error(getApiErrorMessage(error, "Ошибка регистрации"));
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-background">
      <PublicHeader />
      
      <div className="flex min-h-[calc(100vh-4rem)] items-center justify-center bg-background p-4">
        <Card className="w-full max-w-md">
          <CardHeader className="space-y-1">
            <div className="flex justify-center mb-4">
              <Building2 className="h-12 w-12 text-primary" />
            </div>
            <CardTitle className="text-2xl text-center">Регистрация</CardTitle>
            <CardDescription className="text-center">
              Создайте аккаунт для доступа к личному кабинету. Выберите роль при регистрации.
            </CardDescription>
          </CardHeader>
          <CardContent>
            <form onSubmit={handleSubmit(onSubmit)} className="space-y-4">
              {/* Email */}
              <div className="space-y-2">
                <Label htmlFor="email">Email</Label>
                <div className="relative">
                  <Mail className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
                  <Input
                    id="email"
                    type="email"
                    placeholder="name@example.com"
                    className="pl-10"
                    {...register("email")}
                  />
                </div>
                {errors.email && (
                  <p className="text-sm text-destructive">{errors.email.message}</p>
                )}
              </div>

              {/* First Name */}
              <div className="space-y-2">
                <Label htmlFor="first_name">Имя</Label>
                <div className="relative">
                  <User className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
                  <Input
                    id="first_name"
                    placeholder="Иван"
                    className="pl-10"
                    {...register("first_name")}
                  />
                </div>
                {errors.first_name && (
                  <p className="text-sm text-destructive">{errors.first_name.message}</p>
                )}
              </div>

              {/* Last Name */}
              <div className="space-y-2">
                <Label htmlFor="last_name">Фамилия</Label>
                <div className="relative">
                  <User className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
                  <Input
                    id="last_name"
                    placeholder="Иванов"
                    className="pl-10"
                    {...register("last_name")}
                  />
                </div>
                {errors.last_name && (
                  <p className="text-sm text-destructive">{errors.last_name.message}</p>
                )}
              </div>

              {/* Phone */}
              <div className="space-y-2">
                <Label htmlFor="phone">Телефон (необязательно)</Label>
                <div className="relative">
                  <Phone className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
                  <PhoneInput
                    id="phone"
                    className="pl-10"
                    value={phoneValue}
                    onChange={setPhoneValue}
                    placeholder="+375 (XX) XXX-XX-XX"
                  />
                </div>
                {errors.phone && (
                  <p className="text-sm text-destructive">{errors.phone.message}</p>
                )}
              </div>

              {/* Role Selection */}
              <div className="space-y-2">
                <Label htmlFor="client_type">Тип клиента</Label>
                <div className="relative">
                  <UserCheck className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
                  <Select
                    value={selectedType}
                    onValueChange={(value) => {
                      setSelectedType(value as RegisterFormData["client_type"]);
                      setValue("client_type", value as RegisterFormData["client_type"], {
                        shouldValidate: true,
                        shouldDirty: true,
                      });
                      if (value === "physical") {
                        setValue("clinic_name", "", { shouldValidate: true });
                      }
                    }}
                  >
                    <SelectTrigger className="pl-10">
                      <SelectValue placeholder="Выберите тип" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="physical">Физ. лицо</SelectItem>
                      <SelectItem value="legal">Юр. лицо</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                {errors.client_type && (
                  <p className="text-sm text-destructive">{errors.client_type.message}</p>
                )}
              </div>

              {selectedType === "legal" && (
                <div className="space-y-2">
                  <Label htmlFor="clinic_name">Название клиники</Label>
                  <div className="relative">
                    <Building2 className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
                    <Input
                      id="clinic_name"
                      placeholder="Стоматология «Улыбка»"
                      className="pl-10"
                      {...register("clinic_name")}
                    />
                  </div>
                  {errors.clinic_name && (
                    <p className="text-sm text-destructive">{errors.clinic_name.message}</p>
                  )}
                </div>
              )}

              {/* Password */}
              <div className="space-y-2">
                <Label htmlFor="password">Пароль</Label>
                <div className="relative">
                  <Lock className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
                  <Input
                    id="password"
                    type="password"
                    placeholder="••••••••"
                    className="pl-10"
                    {...register("password")}
                  />
                </div>
                {errors.password && (
                  <p className="text-sm text-destructive">{errors.password.message}</p>
                )}
              </div>

              {/* Confirm Password */}
              <div className="space-y-2">
                <Label htmlFor="confirm_password">Подтверждение пароля</Label>
                <div className="relative">
                  <Lock className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
                  <Input
                    id="confirm_password"
                    type="password"
                    placeholder="••••••••"
                    className="pl-10"
                    {...register("confirm_password")}
                  />
                </div>
                {errors.confirm_password && (
                  <p className="text-sm text-destructive">{errors.confirm_password.message}</p>
                )}
              </div>

              {/* Submit button */}
              <Button type="submit" className="w-full" disabled={isLoading}>
                {isLoading ? "Регистрация..." : "Зарегистрироваться"}
              </Button>

              {/* Login link */}
              <p className="text-center text-sm text-muted-foreground">
                Уже есть аккаунт?{" "}
                <Link to="/login" className="text-primary hover:underline">
                  Войти
                </Link>
              </p>
            </form>
          </CardContent>
        </Card>
      </div>
    </div>
  );
};