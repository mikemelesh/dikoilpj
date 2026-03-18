import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { useForm, useFieldArray } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { useQuery, useMutation } from "@tanstack/react-query";
import { toast } from "react-toastify";

import { createOrder } from "@/api/orders";
import { apiClient } from "@/api/axios";
import { authStore } from "@/stores/authStore";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { FileUpload } from "@/components/shared/FileUpload";
import { ChevronLeft, ChevronRight, Plus, Trash2 } from "lucide-react";
import type { Service, ServiceCategory } from "@/types";

// =============================================================================
// Схема формы
// =============================================================================

const orderSchema = z.object({
  items: z.array(z.object({
    service_id: z.number().min(1, "Выберите услугу"),
    quantity: z.number().min(1, "Минимум 1"),
    specifications: z.record(z.string()).optional(),
  })).min(1, "Добавьте хотя бы одну услугу"),
  notes: z.string().max(2000).optional(),
  deadline: z.string().optional(),
  priority: z.enum(["normal", "urgent", "critical"]).default("normal"),
});

type OrderFormData = z.infer<typeof orderSchema>;

// =============================================================================
// Компонент ClientNewOrder
// =============================================================================

export const ClientNewOrder = () => {
  const navigate = useNavigate();
  const { user } = authStore();
  const [step, setStep] = useState(1);
  const [calculatedTotal, setCalculatedTotal] = useState<number>(0);
  const [discountAmount, setDiscountAmount] = useState<number>(0);
  const [finalPrice, setFinalPrice] = useState<number>(0);

  // Загрузка данных из localStorage (из калькулятора)
  useEffect(() => {
    const pendingOrder = localStorage.getItem("pending_order");
    if (pendingOrder) {
      try {
        const orderData = JSON.parse(pendingOrder);
        if (orderData?.items && orderData.items.length > 0) {
          // Очищаем форму и добавляем услуги из калькулятора
          reset({
            items: orderData.items,
            notes: "",
            deadline: "",
            priority: "normal",
          });
          setStep(1);
          // Очищаем localStorage после загрузки
          localStorage.removeItem("pending_order");
          toast.success("Услуги добавлены из калькулятора");
        }
      } catch (e) {
        console.error("Ошибка загрузки данных из калькулятора:", e);
        localStorage.removeItem("pending_order");
      }
    }
  }, []);

  const { data: categoriesData } = useQuery({
    queryKey: ["service-categories"],
    queryFn: async () => {
      const res = await apiClient.get<ServiceCategory[]>("/services/categories");
      return res.data;
    },
  });

  const { data: servicesData } = useQuery({
    queryKey: ["services"],
    queryFn: async () => {
      const res = await apiClient.get<{ items: Service[] }>("/services?limit=100");
      return res.data;
    },
  });

  const categories = (categoriesData as ServiceCategory[]) || [];
  const services = (servicesData as { items: Service[] })?.items || [];

  const { register, control, handleSubmit, watch, formState: { errors } } = useForm<OrderFormData>({
    resolver: zodResolver(orderSchema),
    defaultValues: {
      items: [{ service_id: 0, quantity: 1, specifications: {} }],
      notes: "",
      deadline: "",
      priority: "normal",
    },
  });

  const { fields, append, remove } = useFieldArray({ control, name: "items" });
  const items = watch("items");

  // Расчёт стоимости при изменении items
  useQuery({
    queryKey: ["calculate", items],
    queryFn: async () => {
      const validItems = items.filter((i) => i.service_id > 0);
      if (validItems.length === 0) {
        setCalculatedTotal(0);
        setFinalPrice(0);
        return null;
      }

      const response = await apiClient.post("/calculator/calculate", {
        items: validItems.map((i) => ({ service_id: i.service_id, quantity: i.quantity })),
      });

      setCalculatedTotal(Number(response.data.subtotal));
      setDiscountAmount(Number(response.data.discount_amount));
      setFinalPrice(Number(response.data.final_price));
      return response.data;
    },
    enabled: items.some((i) => i.service_id > 0),
  });

  const createMutation = useMutation({
    mutationFn: (data: OrderFormData) => createOrder(data),
    onSuccess: (order) => {
      toast.success("Заказ создан");
      navigate(`/client/orders/${order.id}`);
    },
    onError: () => toast.error("Ошибка создания заказа"),
  });

  const onSubmit = (data: OrderFormData) => {
    // Фильтрация элементов с service_id <= 0
    const validData = {
      ...data,
      items: data.items.filter((i) => i.service_id > 0),
    };

    if (validData.items.length === 0) {
      toast.error("Добавьте хотя бы одну услугу");
      return;
    }

    createMutation.mutate(validData);
  };

  const formatPrice = (price: number) =>
    new Intl.NumberFormat("ru-RU", { style: "currency", currency: "RUB", minimumFractionDigits: 0 }).format(price);

  return (
    <div className="max-w-3xl mx-auto space-y-6">
      {/* Steps indicator */}
      <div className="flex justify-center gap-4">
        {[1, 2, 3].map((s) => (
          <div
            key={s}
            className={`flex items-center justify-center w-10 h-10 rounded-full font-semibold ${
              s <= step ? "bg-primary text-primary-foreground" : "bg-muted text-muted-foreground"
            }`}
          >
            {s}
          </div>
        ))}
      </div>

      <form onSubmit={handleSubmit(onSubmit)}>
        {step === 1 && (
          <Card>
            <CardHeader>
              <CardTitle>Выбор услуг</CardTitle>
              <CardDescription>Добавьте услуги в заказ</CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              {fields.map((field, index) => (
                <div key={field.id} className="flex items-end gap-4 p-4 border rounded-lg">
                  <div className="flex-1">
                    <Label>Услуга</Label>
                    <select
                      {...register(`items.${index}.service_id`, { valueAsNumber: true })}
                      className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
                    >
                      <option value={0}>Выберите услугу</option>
                      {categories.map((cat) => (
                        <optgroup key={cat.id} label={cat.name}>
                          {services.filter((s) => s.category_id === cat.id).map((svc) => (
                            <option key={svc.id} value={svc.id}>
                              {svc.name} — {formatPrice(Number(svc.base_price))}
                            </option>
                          ))}
                        </optgroup>
                      ))}
                    </select>
                  </div>
                  <div className="w-24">
                    <Label>Кол-во</Label>
                    <Input
                      type="number"
                      min="1"
                      {...register(`items.${index}.quantity`, { valueAsNumber: true })}
                    />
                  </div>
                  <Button
                    type="button"
                    variant="ghost"
                    size="icon"
                    onClick={() => remove(index)}
                    disabled={fields.length === 1}
                  >
                    <Trash2 className="h-4 w-4 text-destructive" />
                  </Button>
                </div>
              ))}

              <Button type="button" variant="outline" onClick={() => append({ service_id: 0, quantity: 1 })}>
                <Plus className="mr-2 h-4 w-4" /> Добавить услугу
              </Button>

              {finalPrice > 0 && (
                <div className="p-4 bg-muted rounded-lg space-y-2">
                  <div className="flex justify-between">
                    <span>Подытог:</span>
                    <span>{formatPrice(calculatedTotal)}</span>
                  </div>
                  {discountAmount > 0 && (
                    <div className="flex justify-between text-green-600">
                      <span>Скидка:</span>
                      <span>-{formatPrice(discountAmount)}</span>
                    </div>
                  )}
                  <div className="flex justify-between text-lg font-bold pt-2 border-t">
                    <span>Итого:</span>
                    <span>{formatPrice(finalPrice)}</span>
                  </div>
                </div>
              )}

              <div className="flex justify-end">
                <Button type="button" onClick={() => setStep(2)}>
                  Далее <ChevronRight className="ml-2 h-4 w-4" />
                </Button>
              </div>
            </CardContent>
          </Card>
        )}

        {step === 2 && (
          <Card>
            <CardHeader>
              <CardTitle>Детали заказа</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div>
                <Label htmlFor="notes">Примечания</Label>
                <Input id="notes" {...register("notes")} placeholder="Особые требования..." />
              </div>
              <div>
                <Label htmlFor="deadline">Дедлайн (необязательно)</Label>
                <Input type="date" id="deadline" {...register("deadline")} />
              </div>
              <div>
                <Label>Приоритет</Label>
                <select {...register("priority")} className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm">
                  <option value="normal">Обычный</option>
                  <option value="urgent">Срочный</option>
                  <option value="critical">Критичный</option>
                </select>
              </div>
              <div>
                <Label>Файлы (необязательно)</Label>
                <FileUpload onFilesChange={() => {}} maxFiles={5} />
              </div>
              <div className="flex justify-between">
                <Button type="button" variant="outline" onClick={() => setStep(1)}>
                  <ChevronLeft className="mr-2 h-4 w-4" /> Назад
                </Button>
                <Button type="button" onClick={() => setStep(3)}>
                  Далее <ChevronRight className="ml-2 h-4 w-4" />
                </Button>
              </div>
            </CardContent>
          </Card>
        )}

        {step === 3 && (
          <Card>
            <CardHeader>
              <CardTitle>Подтверждение заказа</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="p-4 bg-muted rounded-lg">
                <h4 className="font-semibold mb-2">Состав заказа:</h4>
                <ul className="space-y-1 text-sm">
                  {items.filter((i) => i.service_id > 0).map((item, idx) => {
                    const svc = services.find((s) => s.id === item.service_id);
                    return (
                      <li key={idx} className="flex justify-between">
                        <span>{svc?.name || "Услуга"} × {item.quantity}</span>
                      </li>
                    );
                  })}
                </ul>
              </div>
              <div className="flex justify-between text-lg font-bold">
                <span>Итого к оплате:</span>
                <span>{formatPrice(finalPrice)}</span>
              </div>
              <div className="flex justify-between pt-4">
                <Button type="button" variant="outline" onClick={() => setStep(2)}>
                  <ChevronLeft className="mr-2 h-4 w-4" /> Назад
                </Button>
                <Button type="submit" disabled={createMutation.isPending}>
                  {createMutation.isPending ? "Создание..." : "Оформить заказ"}
                </Button>
              </div>
            </CardContent>
          </Card>
        )}
      </form>
    </div>
  );
};
