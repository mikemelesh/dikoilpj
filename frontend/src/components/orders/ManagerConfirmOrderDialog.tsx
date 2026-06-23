import { useEffect, useState } from "react";
import { useMutation } from "@tanstack/react-query";
import { toast } from "react-toastify";
import { getApiErrorMessage } from "@/lib/apiError";

import { updateOrderPricing, updateOrderStatus, assignTechnician } from "@/api/orders";
import type { Order, Technician } from "@/types";
import { TechnicianSelectOptions } from "@/components/manager/TechnicianSelectOptions";
import {
  MANAGER_REPLY_TEMPLATES,
  fillReplyTemplate,
} from "@/constants/managerReplyTemplates";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { formatDate } from "@/utils";
import {
  discountFromFinal,
  finalFromDiscount,
  formatOrderMoney,
  getOrderSubtotal,
  roundMoney,
} from "@/utils/orderPricing";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";

interface ManagerConfirmOrderDialogProps {
  order: Order | null;
  open: boolean;
  onClose: () => void;
  onSuccess: () => void;
  technicians?: Technician[];
}

export const ManagerConfirmOrderDialog = ({
  order,
  open,
  onClose,
  onSuccess,
  technicians,
}: ManagerConfirmOrderDialogProps) => {
  const [finalPrice, setFinalPrice] = useState("");
  const [discountAmount, setDiscountAmount] = useState("");
  const [templateId, setTemplateId] = useState(MANAGER_REPLY_TEMPLATES[0].id);
  const [message, setMessage] = useState("");
  const [technicianId, setTechnicianId] = useState<number | "">("");

  useEffect(() => {
    if (!order || !open) return;
    setFinalPrice(String(order.final_price ?? ""));
    setDiscountAmount(String(order.discount_amount ?? ""));
    setTechnicianId(order.technician_id ?? "");
    const tpl = MANAGER_REPLY_TEMPLATES[0];
    setTemplateId(tpl.id);
    setMessage(
      fillReplyTemplate(tpl.text, {
        order_number: order.order_number,
        final_price: formatOrderMoney(order.final_price),
        deadline: order.deadline
          ? formatDate(order.deadline)
          : undefined,
      })
    );
  }, [order, open]);

  const subtotal = order ? getOrderSubtotal(order) : 0;

  const handleFinalPriceChange = (value: string) => {
    setFinalPrice(value);
    if (!Number.isFinite(subtotal)) return;
    const parsed = parseFloat(value);
    if (!Number.isNaN(parsed)) {
      setDiscountAmount(String(discountFromFinal(subtotal, parsed)));
    }
  };

  const handleDiscountChange = (value: string) => {
    setDiscountAmount(value);
    if (!Number.isFinite(subtotal)) return;
    const parsed = parseFloat(value);
    if (!Number.isNaN(parsed)) {
      setFinalPrice(String(finalFromDiscount(subtotal, parsed)));
    }
  };

  const confirmMutation = useMutation({
    mutationFn: async () => {
      if (!order) return;
      const price = parseFloat(finalPrice);
      const discount = parseFloat(discountAmount);
      if (Number.isNaN(price) || price < 0) {
        throw new Error("Укажите корректную итоговую сумму");
      }
      if (Number.isNaN(discount) || discount < 0) {
        throw new Error("Укажите корректную скидку");
      }
      if (discount > subtotal) {
        throw new Error("Скидка не может превышать сумму без скидки");
      }
      await updateOrderPricing(order.id, {
        final_price: roundMoney(price),
        discount_amount: roundMoney(discount),
      });
      const managerComment = message.trim() || "Заказ подтверждён менеджером";
      if (technicianId) {
        if (order.status === "new") {
          await updateOrderStatus(order.id, {
            new_status: "confirmed",
            comment: managerComment,
          });
        }
        await assignTechnician(order.id, Number(technicianId));
      } else {
        await updateOrderStatus(order.id, {
          new_status: "confirmed",
          comment: managerComment,
        });
      }
    },
    onSuccess: () => {
      toast.success(
        technicianId ? "Заказ подтверждён и передан в работу" : "Заказ подтверждён"
      );
      onSuccess();
      onClose();
    },
    onError: (err: unknown) => {
      toast.error(getApiErrorMessage(err, "Ошибка подтверждения заказа"));
    },
  });

  const handleTemplateChange = (id: string) => {
    setTemplateId(id);
    const tpl = MANAGER_REPLY_TEMPLATES.find((t) => t.id === id);
    if (!tpl || !order) return;
    setMessage(
      fillReplyTemplate(tpl.text, {
        order_number: order.order_number,
        final_price: formatOrderMoney(parseFloat(finalPrice) || order.final_price),
        deadline: order.deadline
          ? formatDate(order.deadline)
          : undefined,
      })
    );
  };

  if (!order) return null;

  return (
    <Dialog open={open} onOpenChange={(v) => !v && onClose()}>
      <DialogContent className="max-w-lg">
        <DialogHeader>
          <DialogTitle>Подтверждение заказа {order.order_number}</DialogTitle>
        </DialogHeader>

        <div className="space-y-4">
          {order.notes?.trim() && (
            <div className="rounded-lg border bg-muted/40 p-3">
              <p className="text-xs font-medium text-muted-foreground">Примечания клиента</p>
              <p className="mt-1 whitespace-pre-wrap text-sm">{order.notes}</p>
            </div>
          )}
          <p className="text-sm text-muted-foreground">
            Сумма без скидки: <strong>{formatOrderMoney(subtotal)}</strong>
          </p>
          <div className="grid grid-cols-2 gap-4">
            <div>
              <Label htmlFor="final_price">Итоговая сумма (BYN)</Label>
              <Input
                id="final_price"
                type="number"
                step="0.01"
                min="0"
                max={subtotal}
                value={finalPrice}
                onChange={(e) => handleFinalPriceChange(e.target.value)}
              />
            </div>
            <div>
              <Label htmlFor="discount_amount">Скидка (BYN)</Label>
              <Input
                id="discount_amount"
                type="number"
                step="0.01"
                min="0"
                max={subtotal}
                value={discountAmount}
                onChange={(e) => handleDiscountChange(e.target.value)}
              />
            </div>
          </div>

          <div>
            <Label htmlFor="confirm_technician">Исполнитель</Label>
            <select
              id="confirm_technician"
              value={technicianId}
              onChange={(e) =>
                setTechnicianId(e.target.value ? Number(e.target.value) : "")
              }
              className="mt-1 flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
            >
              <option value="">Без назначения (только подтверждение)</option>
              <TechnicianSelectOptions
                technicians={technicians}
                currentTechnicianId={order.technician_id}
              />
            </select>
            <p className="mt-1 text-xs text-muted-foreground">
              При выборе исполнителя заказ сразу переходит в статус «В работе».
            </p>
          </div>

          <div>
            <Label>Шаблон ответа клиенту</Label>
            <select
              value={templateId}
              onChange={(e) => handleTemplateChange(e.target.value)}
              className="mt-1 flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
            >
              {MANAGER_REPLY_TEMPLATES.map((t) => (
                <option key={t.id} value={t.id}>
                  {t.label}
                </option>
              ))}
            </select>
          </div>

          <div>
            <Label htmlFor="manager_message">Сообщение (комментарий к заказу)</Label>
            <Textarea
              id="manager_message"
              rows={5}
              value={message}
              onChange={(e) => setMessage(e.target.value)}
              className="mt-1"
            />
          </div>

          <div className="flex justify-end gap-2">
            <Button variant="outline" onClick={onClose}>
              Отмена
            </Button>
            <Button
              onClick={() => confirmMutation.mutate()}
              disabled={confirmMutation.isPending}
            >
              {confirmMutation.isPending
                ? "Сохранение..."
                : technicianId
                  ? "Подтвердить и передать в работу"
                  : "Подтвердить заказ"}
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
};
