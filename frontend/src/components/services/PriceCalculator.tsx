import { useState } from "react";
import { useNavigate } from "react-router-dom";

import { apiClient } from "@/api/axios";
import { authStore } from "@/stores/authStore";
import { formatPrice } from "@/utils";
import type { DiscountSource } from "@/utils/discountLabel";
import type { Service } from "@/types";
import { ClientDiscountInfo } from "@/components/client/ClientDiscountInfo";
import { OrderDiscountSummary } from "@/components/client/OrderDiscountSummary";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Plus, Trash2, Calculator, ShoppingCart } from "lucide-react";
import { toast } from "react-toastify";
import { showApiError } from "@/lib/apiError";

interface CalculatedItem {
  service_id: number;
  service_name: string;
  quantity: number;
  unit_price: number;
  total: number;
}

// =============================================================================
// Типы
// =============================================================================

interface CalculatorRow {
  service_id: number;
  service_name: string;
  quantity: number;
  unit_price: number;
  total: number;
}

interface PriceCalculatorProps {
  services: Service[];
}

// =============================================================================
// Компонент PriceCalculator
// =============================================================================

export const PriceCalculator = ({ services }: PriceCalculatorProps) => {
  const navigate = useNavigate();
  const isAuthenticated = authStore((state) => state.isAuthenticated);
  const user = authStore((state) => state.user);
  const clientId = user?.client_profile?.id;
  const totalSpent = Number(user?.client_profile?.total_spent ?? 0);
  const isClient = isAuthenticated && user?.role === "client";
  
  const [rows, setRows] = useState<CalculatorRow[]>([
    { service_id: 0, service_name: "", quantity: 1, unit_price: 0, total: 0 },
  ]);
  const [calculatedItems, setCalculatedItems] = useState<CalculatedItem[]>([]);
  const [subtotal, setSubtotal] = useState<number>(0);
  const [discountAmount, setDiscountAmount] = useState<number>(0);
  const [discountPercent, setDiscountPercent] = useState<number>(0);
  const [finalPrice, setFinalPrice] = useState<number>(0);
  const [activePromotions, setActivePromotions] = useState<Array<{ id: number; title: string; discount_percent: number }>>([]);
  const [discountSource, setDiscountSource] = useState<DiscountSource>("none");
  const [loyaltyPercent, setLoyaltyPercent] = useState(0);
  const [promotionPercent, setPromotionPercent] = useState(0);
  const [promotionTitle, setPromotionTitle] = useState<string | null>(null);
  const [isCalculating, setIsCalculating] = useState(false);

  const addRow = () => {
    setRows([...rows, { service_id: 0, service_name: "", quantity: 1, unit_price: 0, total: 0 }]);
  };

  const removeRow = (index: number) => {
    if (rows.length === 1) return;
    const newRows = rows.filter((_, i) => i !== index);
    setRows(newRows);
  };

  const updateRow = (index: number, field: keyof CalculatorRow, value: number | string) => {
    const newRows = [...rows];
    const row = { ...newRows[index], [field]: value };

    // Обновление названия и цены при выборе услуги
    if (field === "service_id") {
      const service = services.find((s) => s.id === Number(value));
      if (service) {
        row.service_name = service.name;
        row.unit_price = Number(service.base_price);
        row.total = row.unit_price * row.quantity;
      }
    }

    // Пересчёт total при изменении количества
    if (field === "quantity") {
      row.total = row.unit_price * Number(value);
    }

    newRows[index] = row;
    setRows(newRows);
  };

  const calculateTotal = async () => {
    // Валидация
    const validRows = rows.filter((r) => r.service_id > 0);
    if (validRows.length === 0) {
      toast.error("Выберите хотя бы одну услугу");
      return;
    }

    setIsCalculating(true);

    try {
      const response = await apiClient.post("/calculator/calculate", {
        items: validRows.map((r) => ({
          service_id: r.service_id,
          quantity: r.quantity,
        })),
        ...(clientId ? { client_id: clientId } : {}),
      });

      const {
        items,
        subtotal,
        discount_percent,
        discount_amount,
        final_price,
        active_promotions,
        discount_source,
        loyalty_discount_percent,
        applied_promotion_title,
        promotion_discount_percent,
      } = response.data;

      setCalculatedItems(items);
      setSubtotal(Number(subtotal));
      setDiscountPercent(Number(discount_percent));
      setDiscountAmount(Number(discount_amount));
      setFinalPrice(Number(final_price));
      setActivePromotions(active_promotions || []);
      setDiscountSource(discount_source ?? "none");
      setLoyaltyPercent(Number(loyalty_discount_percent ?? 0));
      setPromotionPercent(Number(promotion_discount_percent ?? 0));
      setPromotionTitle(applied_promotion_title ?? null);

      toast.success("Расчёт выполнен");
    } catch (error) {
      showApiError(error, "Ошибка при расчёте");
    } finally {
      setIsCalculating(false);
    }
  };

  const handleCreateOrder = () => {
    if (!isAuthenticated) {
      toast.info("Войдите для оформления заказа");
      navigate("/login");
      return;
    }

    const validItems = rows
      .filter((r) => r.service_id > 0)
      .map((r) => ({
        service_id: r.service_id,
        quantity: r.quantity,
      }));

    if (validItems.length === 0) {
      toast.error("Заказ пуст: выберите хотя бы одну услугу");
      return;
    }

    // Сохранение данных в localStorage для передачи на страницу создания заказа
    const orderData = {
      items: validItems,
      calculatedTotal: finalPrice,
    };

    localStorage.setItem("pending_order", JSON.stringify(orderData));
    navigate("/client/orders/new");
  };

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <Calculator className="h-5 w-5" />
          Калькулятор стоимости
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        {isClient && <ClientDiscountInfo variant="banner" />}

        {/* Таблица услуг */}
        <div className="overflow-x-auto">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead className="w-[40%]">Услуга</TableHead>
                <TableHead className="w-[20%]">Количество</TableHead>
                <TableHead className="w-[20%]">Цена</TableHead>
                <TableHead className="w-[15%]">Сумма</TableHead>
                <TableHead className="w-[5%]"></TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {rows.map((row, index) => (
                <TableRow key={index}>
                  <TableCell>
                    <select
                      value={row.service_id}
                      onChange={(e) => updateRow(index, "service_id", Number(e.target.value))}
                      className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                    >
                      <option value={0}>Выберите услугу</option>
                      {services.map((service) => (
                        <option key={service.id} value={service.id}>
                          {service.name}
                        </option>
                      ))}
                    </select>
                  </TableCell>
                  <TableCell>
                    <Input
                      type="number"
                      min="1"
                      value={row.quantity}
                      onChange={(e) => updateRow(index, "quantity", Number(e.target.value))}
                      className="w-24"
                    />
                  </TableCell>
                  <TableCell>
                    <span className="text-sm">{formatPrice(row.unit_price)}</span>
                  </TableCell>
                  <TableCell>
                    <span className="font-medium">{formatPrice(row.total)}</span>
                  </TableCell>
                  <TableCell>
                    <Button
                      variant="ghost"
                      size="icon"
                      onClick={() => removeRow(index)}
                      disabled={rows.length === 1}
                    >
                      <Trash2 className="h-4 w-4 text-destructive" />
                    </Button>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </div>

        {/* Кнопки */}
        <div className="flex justify-between">
          <Button variant="outline" onClick={addRow}>
            <Plus className="mr-2 h-4 w-4" />
            Добавить услугу
          </Button>
          <Button onClick={calculateTotal} disabled={isCalculating}>
            <Calculator className="mr-2 h-4 w-4" />
            {isCalculating ? "Расчёт..." : "Рассчитать"}
          </Button>
        </div>

        {/* Результаты расчёта */}
        {calculatedItems.length > 0 && (
          <div className="space-y-4 rounded-lg border bg-muted/50 p-4">
            <div>
              <h4 className="mb-2 font-medium">Позиции:</h4>
              <ul className="space-y-1 text-sm">
                {calculatedItems.map((item, i) => (
                  <li key={i} className="flex justify-between">
                    <span>{item.service_name} × {item.quantity}</span>
                    <span>{formatPrice(Number(item.total))}</span>
                  </li>
                ))}
              </ul>
            </div>

            {activePromotions.length > 0 && (
              <div>
                <h4 className="mb-2 font-medium text-green-600">Активные акции:</h4>
                <ul className="space-y-1 text-sm">
                  {activePromotions.map((promo) => (
                    <li key={promo.id} className="text-green-600">
                      {promo.title} (-{promo.discount_percent}%)
                    </li>
                  ))}
                </ul>
              </div>
            )}

            <div className="border-t pt-4">
              <OrderDiscountSummary
                subtotal={subtotal}
                discountAmount={discountAmount}
                discountPercent={discountPercent}
                finalPrice={finalPrice}
                discountSource={discountSource}
                loyaltyPercent={loyaltyPercent}
                promotionPercent={promotionPercent}
                promotionTitle={promotionTitle}
                totalSpent={isClient ? totalSpent : undefined}
              />
            </div>

            {/* Кнопка оформления заказа */}
            <div className="space-y-2">
              <p className="text-sm text-muted-foreground">
                Услуги будут перенесены в форму создания заказа
              </p>
              <Button className="w-full" onClick={handleCreateOrder}>
                <ShoppingCart className="mr-2 h-4 w-4" />
                Оформить заказ
              </Button>
            </div>
          </div>
        )}
      </CardContent>
    </Card>
  );
};
