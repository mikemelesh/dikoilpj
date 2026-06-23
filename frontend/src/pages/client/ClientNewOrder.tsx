import { useState, useEffect } from "react";
import { useNavigate, useLocation } from "react-router-dom";
import { useForm, useFieldArray } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { useQuery, useMutation } from "@tanstack/react-query";
import { toast } from "react-toastify";
import { mutationOnError, showApiError } from "@/lib/apiError";

import { createOrder, uploadFile } from "@/api/orders";
import { getTemplates, type OrderTemplate } from "@/api/templates";
import { apiClient } from "@/api/axios";
import { authStore } from "@/stores/authStore";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { FileUpload } from "@/components/shared/FileUpload";
import { ChevronLeft, ChevronRight, Plus, Trash2 } from "lucide-react";
import type { Service, ServiceCategory } from "@/types";
import { formatPrice } from "@/utils";
import type { DiscountSource } from "@/utils/discountLabel";
import { ClientDiscountInfo } from "@/components/client/ClientDiscountInfo";
import { OrderDiscountSummary } from "@/components/client/OrderDiscountSummary";

// =============================================================================
// Схема формы
// =============================================================================

const orderSchema = z.object({
  items: z
    .array(
      z.object({
        service_id: z.number(),
        quantity: z.number().min(1, "Минимум 1"),
        specifications: z.record(z.string()).optional(),
      })
    )
    .min(1, "Заказ пуст: добавьте хотя бы одну услугу")
    .superRefine((items, ctx) => {
      if (!items.some((item) => item.service_id > 0)) {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          message: "Заказ пуст: выберите хотя бы одну услугу",
        });
      }
    }),
  notes: z.string().max(2000).optional(),
  deadline: z.string().optional(),
  priority: z.enum(["normal", "urgent", "critical"]).default("normal"),
});

type OrderFormData = z.infer<typeof orderSchema>;

const EMPTY_ORDER_MESSAGE = "Заказ пуст: выберите хотя бы одну услугу";

// =============================================================================
// Компонент ClientNewOrder
// =============================================================================

export const ClientNewOrder = () => {
  const navigate = useNavigate();
  const location = useLocation();
  const { user } = authStore();
  const [step, setStep] = useState(1);
  const clientId = user?.client_profile?.id;
  const totalSpent = Number(user?.client_profile?.total_spent ?? 0);
  const [calculatedTotal, setCalculatedTotal] = useState<number>(0);
  const [discountAmount, setDiscountAmount] = useState<number>(0);
  const [discountPercent, setDiscountPercent] = useState<number>(0);
  const [discountSource, setDiscountSource] = useState<DiscountSource>("none");
  const [loyaltyPercent, setLoyaltyPercent] = useState<number>(0);
  const [promotionPercent, setPromotionPercent] = useState<number>(0);
  const [promotionTitle, setPromotionTitle] = useState<string | null>(null);
  const [finalPrice, setFinalPrice] = useState<number>(0);
  const [files, setFiles] = useState<File[]>([]);
  const [selectedTemplateId, setSelectedTemplateId] = useState("");

  const { reset, register, control, handleSubmit, watch, trigger, formState: { errors } } = useForm<OrderFormData>({
    resolver: zodResolver(orderSchema),
    defaultValues: {
      items: [{ service_id: 0, quantity: 1, specifications: {} }],
      notes: "",
      deadline: "",
      priority: "normal",
    },
  });

  const applyTemplateToForm = (template: OrderTemplate) => {
    const validItems = template.items
      .filter((item) => item.service_id > 0)
      .map((item) => ({
        service_id: item.service_id,
        quantity: item.quantity || 1,
        specifications: item.specifications || {},
      }));

    if (validItems.length === 0) {
      toast.error("В шаблоне нет корректных услуг");
      return;
    }

    reset({
      items: validItems,
      notes: template.notes || "",
      deadline: "",
      priority: "normal",
    });
    setSelectedTemplateId(String(template.id));
    setStep(1);
    toast.success(`Шаблон «${template.name}» применён`);
  };

  // Загрузка данных из localStorage (из калькулятора) или шаблона
  useEffect(() => {
    const templateFromNav = (location.state as { template?: OrderTemplate } | null)?.template;
    if (templateFromNav) {
      applyTemplateToForm(templateFromNav);
      navigate(location.pathname, { replace: true, state: {} });
      return;
    }

    const pendingOrder = localStorage.getItem("pending_order");
    if (pendingOrder) {
      try {
        const orderData = JSON.parse(pendingOrder);
        if (orderData?.items && orderData.items.length > 0) {
          // Фильтруем элементы с service_id <= 0 перед установкой
          const validItems = orderData.items.filter((item: { service_id: number }) => item.service_id > 0);
          if (validItems.length > 0) {
            // Очищаем форму и добавляем услуги из калькулятора
            reset({
              items: validItems,
              notes: "",
              deadline: "",
              priority: "normal",
            });
            setStep(1);
            // Очищаем localStorage после загрузки
            localStorage.removeItem("pending_order");
            toast.success("Услуги добавлены из калькулятора");
          } else {
            localStorage.removeItem("pending_order");
            toast.error("Нет корректных услуг в заказе");
          }
        } else {
          localStorage.removeItem("pending_order");
        }
      } catch (e) {
        localStorage.removeItem("pending_order");
        showApiError(e, "Ошибка загрузки данных из калькулятора");
      }
    }
  }, [reset, navigate, location.pathname, location.state]);

  const { data: templatesData } = useQuery({
    queryKey: ["client-templates"],
    queryFn: () => getTemplates({ page: 1, limit: 100 }),
  });

  const templates = templatesData?.items || [];

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

  const { fields, append, remove } = useFieldArray({ control, name: "items" });
  const items = watch("items");
  const validItemCount = items.filter((item) => item.service_id > 0).length;

  const ensureItemsSelected = async () => {
    const isValid = await trigger("items");
    if (!isValid) {
      toast.error(EMPTY_ORDER_MESSAGE);
    }
    return isValid;
  };

  // Расчёт стоимости при изменении items
  useQuery({
    queryKey: ["calculate", items],
    queryFn: async () => {
      const validItems = items.filter((i) => i.service_id > 0);
      if (validItems.length === 0) {
        setCalculatedTotal(0);
        setDiscountAmount(0);
        setDiscountPercent(0);
        setDiscountSource("none");
        setLoyaltyPercent(0);
        setPromotionPercent(0);
        setPromotionTitle(null);
        setFinalPrice(0);
        return null;
      }

      const response = await apiClient.post("/calculator/calculate", {
        items: validItems.map((i) => ({ service_id: i.service_id, quantity: i.quantity })),
        ...(clientId ? { client_id: clientId } : {}),
      });

      setCalculatedTotal(Number(response.data.subtotal));
      setDiscountAmount(Number(response.data.discount_amount));
      setDiscountPercent(Number(response.data.discount_percent));
      setDiscountSource(response.data.discount_source ?? "none");
      setLoyaltyPercent(Number(response.data.loyalty_discount_percent ?? 0));
      setPromotionPercent(Number(response.data.promotion_discount_percent ?? 0));
      setPromotionTitle(response.data.applied_promotion_title ?? null);
      setFinalPrice(Number(response.data.final_price));
      return response.data;
    },
    enabled: items.some((i) => i.service_id > 0),
  });

  const createMutation = useMutation({
    mutationFn: (data: OrderFormData) => createOrder(data),
    onSuccess: async (order) => {
      // Upload files after order creation
      if (files.length > 0) {
        try {
          await Promise.all(files.map((file) => uploadFile(order.id, file)));
          toast.success(`Заказ создан и файлы загружены (${files.length})`);
        } catch (error) {
          showApiError(error, "Заказ создан, но произошла ошибка при загрузке файлов");
        }
      } else {
        toast.success("Заказ создан");
      }
      navigate(`/client/orders/${order.id}`);
    },
    onError: mutationOnError("Ошибка создания заказа"),
  });

  const onSubmit = (data: OrderFormData) => {
    // Фильтрация элементов с service_id <= 0 и нормализация спецификаций
    const validData = {
      ...data,
      items: data.items
        .filter((i) => i.service_id > 0)
        .map((i) => ({
          service_id: i.service_id,
          quantity: i.quantity,
          specifications: i.specifications || {},
        })),
    };

    if (validData.items.length === 0) {
      toast.error(EMPTY_ORDER_MESSAGE);
      setStep(1);
      return;
    }

    createMutation.mutate(validData);
  };

  return (
    <div className="max-w-3xl mx-auto space-y-6">
      <ClientDiscountInfo variant="banner" />

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
              {templates.length > 0 && (
                <div>
                  <Label htmlFor="order-template">Шаблон заказа</Label>
                  <select
                    id="order-template"
                    value={selectedTemplateId}
                    onChange={(event) => {
                      const value = event.target.value;
                      setSelectedTemplateId(value);
                      if (!value) return;
                      const template = templates.find((item) => String(item.id) === value);
                      if (template) applyTemplateToForm(template);
                    }}
                    className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
                  >
                    <option value="">Без шаблона</option>
                    {templates.map((template) => (
                      <option key={template.id} value={String(template.id)}>
                        {template.name}
                      </option>
                    ))}
                  </select>
                </div>
              )}

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

              {errors.items?.message && (
                <p className="text-sm text-destructive">{String(errors.items.message)}</p>
              )}

              {!errors.items?.message && validItemCount === 0 && (
                <p className="text-sm text-muted-foreground">
                  Заказ пока пуст — выберите услугу из списка.
                </p>
              )}

              {finalPrice > 0 && (
                <div className="p-4 bg-muted rounded-lg">
                  <OrderDiscountSummary
                    subtotal={calculatedTotal}
                    discountAmount={discountAmount}
                    discountPercent={discountPercent}
                    finalPrice={finalPrice}
                    discountSource={discountSource}
                    loyaltyPercent={loyaltyPercent}
                    promotionPercent={promotionPercent}
                    promotionTitle={promotionTitle}
                    totalSpent={totalSpent}
                  />
                </div>
              )}

              <div className="flex justify-end">
                <Button
                  type="button"
                  onClick={async () => {
                    if (await ensureItemsSelected()) {
                      setStep(2);
                    }
                  }}
                >
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
                <FileUpload onFilesChange={(newFiles) => setFiles(newFiles)} maxFiles={5} />
              </div>
              <div className="flex justify-between">
                <Button type="button" variant="outline" onClick={() => setStep(1)}>
                  <ChevronLeft className="mr-2 h-4 w-4" /> Назад
                </Button>
                <Button
                  type="button"
                  onClick={async () => {
                    if (await ensureItemsSelected()) {
                      setStep(3);
                    }
                  }}
                >
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
                {validItemCount === 0 ? (
                  <p className="text-sm text-destructive">
                    Заказ пуст. Вернитесь на предыдущий шаг и добавьте услуги.
                  </p>
                ) : (
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
                )}
              </div>
              {finalPrice > 0 && (
                <OrderDiscountSummary
                  subtotal={calculatedTotal}
                  discountAmount={discountAmount}
                  discountPercent={discountPercent}
                  finalPrice={finalPrice}
                  discountSource={discountSource}
                  loyaltyPercent={loyaltyPercent}
                  promotionPercent={promotionPercent}
                  promotionTitle={promotionTitle}
                  totalSpent={totalSpent}
                />
              )}
              <div className="flex justify-between pt-4">
                <Button type="button" variant="outline" onClick={() => setStep(2)}>
                  <ChevronLeft className="mr-2 h-4 w-4" /> Назад
                </Button>
                <Button type="submit" disabled={createMutation.isPending || validItemCount === 0}>
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
