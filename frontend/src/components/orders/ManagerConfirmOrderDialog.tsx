import { useEffect, useState } from "react";
import { useMutation } from "@tanstack/react-query";
import { toast } from "react-toastify";

import { updateOrderPricing, updateOrderStatus } from "@/api/orders";
import type { Order } from "@/types";
import {
  MANAGER_REPLY_TEMPLATES,
  fillReplyTemplate,
} from "@/constants/managerReplyTemplates";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
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
}

export const ManagerConfirmOrderDialog = ({
  order,
  open,
  onClose,
  onSuccess,
}: ManagerConfirmOrderDialogProps) => {
  const [finalPrice, setFinalPrice] = useState("");
  const [discountAmount, setDiscountAmount] = useState("");
  const [templateId, setTemplateId] = useState(MANAGER_REPLY_TEMPLATES[0].id);
  const [message, setMessage] = useState("");

  useEffect(() => {
    if (!order || !open) return;
    setFinalPrice(String(order.final_price ?? ""));
    setDiscountAmount(String(order.discount_amount ?? ""));
    const tpl = MANAGER_REPLY_TEMPLATES[0];
    setTemplateId(tpl.id);
    setMessage(
      fillReplyTemplate(tpl.text, {
        order_number: order.order_number,
        final_price: formatMoney(order.final_price),
        deadline: order.deadline
          ? new Date(order.deadline).toLocaleDateString("ru-RU")
          : undefined,
      })
    );
  }, [order, open]);

  const confirmMutation = useMutation({
    mutationFn: async () => {
      if (!order) return;
      const price = parseFloat(finalPrice);
      const discount = parseFloat(discountAmount);
      if (Number.isNaN(price) || price < 0) {
        throw new Error("Укажите корректную итоговую сумму");
      }
      await updateOrderPricing(order.id, {
        final_price: price,
        discount_amount: Number.isNaN(discount) ? undefined : discount,
      });
      await updateOrderStatus(order.id, {
        new_status: "confirmed",
        comment: message.trim() || "Заказ подтверждён менеджером",
      });
    },
    onSuccess: () => {
      toast.success("Заказ подтверждён");
      onSuccess();
      onClose();
    },
    onError: (err: unknown) => {
      const msg = err instanceof Error ? err.message : "Ошибка подтверждения";
      toast.error(msg);
    },
  });

  const handleTemplateChange = (id: string) => {
    setTemplateId(id);
    const tpl = MANAGER_REPLY_TEMPLATES.find((t) => t.id === id);
    if (!tpl || !order) return;
    setMessage(
      fillReplyTemplate(tpl.text, {
        order_number: order.order_number,
        final_price: formatMoney(parseFloat(finalPrice) || order.final_price),
        deadline: order.deadline
          ? new Date(order.deadline).toLocaleDateString("ru-RU")
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
          <div className="grid grid-cols-2 gap-4">
            <div>
              <Label htmlFor="final_price">Итоговая сумма (BYN)</Label>
              <Input
                id="final_price"
                type="number"
                step="0.01"
                min="0"
                value={finalPrice}
                onChange={(e) => setFinalPrice(e.target.value)}
              />
            </div>
            <div>
              <Label htmlFor="discount_amount">Скидка (BYN)</Label>
              <Input
                id="discount_amount"
                type="number"
                step="0.01"
                min="0"
                value={discountAmount}
                onChange={(e) => setDiscountAmount(e.target.value)}
              />
            </div>
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
              {confirmMutation.isPending ? "Сохранение..." : "Подтвердить заказ"}
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
};

function formatMoney(value: number | string): string {
  const n = Number(value);
  return new Intl.NumberFormat("ru-RU", {
    style: "currency",
    currency: "BYN",
    minimumFractionDigits: 2,
  }).format(Number.isNaN(n) ? 0 : n);
}
