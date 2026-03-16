import { useState } from "react";
import { useParams, useNavigate, Link } from "react-router-dom";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { toast } from "react-toastify";

import { getOrder, uploadFile, deleteFile } from "@/api/orders";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { StatusBadge } from "@/components/shared/StatusBadge";
import { OrderStatusTracker } from "@/components/orders/OrderStatusTracker";
import { FileUpload } from "@/components/shared/FileUpload";
import { ArrowLeft, Download, Trash2, Star } from "lucide-react";
import type { Order, OrderFile } from "@/types";

// =============================================================================
// Схема отзыва
// =============================================================================

const reviewSchema = z.object({
  rating: z.number().min(1).max(5),
  text: z.string().max(2000).optional(),
});

type ReviewFormData = z.infer<typeof reviewSchema>;

// =============================================================================
// Компонент ClientOrderDetail
// =============================================================================

export const ClientOrderDetail = () => {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const [hoverRating, setHoverRating] = useState(0);
  const [reviewRating, setReviewRating] = useState(0);
  const [reviewText, setReviewText] = useState("");

  const { data: order, isLoading } = useQuery({
    queryKey: ["order", id],
    queryFn: () => getOrder(id!),
    enabled: !!id,
  });

  const uploadMutation = useMutation({
    mutationFn: ({ orderId, file }: { orderId: string; file: File }) =>
      uploadFile(orderId, file),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["order", id] });
      toast.success("Файл загружен");
    },
    onError: () => toast.error("Ошибка загрузки файла"),
  });

  const deleteMutation = useMutation({
    mutationFn: ({ orderId, fileId }: { orderId: string; fileId: number }) =>
      deleteFile(orderId, fileId),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["order", id] });
      toast.success("Файл удалён");
    },
    onError: () => toast.error("Ошибка удаления файла"),
  });

  const handleFilesChange = (files: File[]) => {
    if (!id) return;
    files.forEach((file) => {
      uploadMutation.mutate({ orderId: id, file });
    });
  };

  const isCompleted = order?.status === "completed";
  const canUpload = order && !["completed", "cancelled", "archived"].includes(order.status);

  if (isLoading) return <div className="p-8 text-center">Загрузка...</div>;
  if (!order) return <div className="p-8 text-center">Заказ не найден</div>;

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center gap-4">
        <Button variant="ghost" size="icon" onClick={() => navigate("/client/orders")}>
          <ArrowLeft className="h-5 w-5" />
        </Button>
        <div>
          <h1 className="text-2xl font-bold">{order.order_number}</h1>
          <div className="flex items-center gap-2 mt-1">
            <StatusBadge status={order.status} />
            <span className={`text-sm font-medium ${order.priority === "urgent" ? "text-red-500" : order.priority === "critical" ? "text-red-700" : "text-muted-foreground"}`}>
              {order.priority === "normal" ? "Обычный" : order.priority === "urgent" ? "Срочный" : "Критичный"}
            </span>
          </div>
        </div>
      </div>

      {/* Status Tracker */}
      <Card>
        <CardHeader>
          <CardTitle>Статус заказа</CardTitle>
        </CardHeader>
        <CardContent>
          <OrderStatusTracker currentStatus={order.status} />
          {order.deadline && (
            <p className="mt-4 text-sm text-muted-foreground">
              Дедлайн: {new Date(order.deadline).toLocaleDateString("ru-RU")}
            </p>
          )}
        </CardContent>
      </Card>

      {/* Состав заказа */}
      <Card>
        <CardHeader>
          <CardTitle>Состав заказа</CardTitle>
        </CardHeader>
        <CardContent>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Услуга</TableHead>
                <TableHead className="text-right">Кол-во</TableHead>
                <TableHead className="text-right">Цена</TableHead>
                <TableHead className="text-right">Сумма</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {order.items?.map((item) => (
                <TableRow key={item.id}>
                  <TableCell>{item.service?.name || `Услуга #${item.service_id}`}</TableCell>
                  <TableCell className="text-right">{item.quantity}</TableCell>
                  <TableCell className="text-right">
                    {new Intl.NumberFormat("ru-RU", { style: "currency", currency: "RUB", minimumFractionDigits: 0 }).format(Number(item.unit_price))}
                  </TableCell>
                  <TableCell className="text-right font-medium">
                    {new Intl.NumberFormat("ru-RU", { style: "currency", currency: "RUB", minimumFractionDigits: 0 }).format(Number(item.total_price))}
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
          <div className="mt-4 flex justify-between items-center pt-4 border-t">
            <span className="text-muted-foreground">
              {order.discount_amount > 0 && `Скидка: ${new Intl.NumberFormat("ru-RU", { style: "currency", currency: "RUB", minimumFractionDigits: 0 }).format(Number(order.discount_amount))}`}
            </span>
            <span className="text-xl font-bold">
              Итого: {new Intl.NumberFormat("ru-RU", { style: "currency", currency: "RUB", minimumFractionDigits: 0 }).format(Number(order.final_price))}
            </span>
          </div>
        </CardContent>
      </Card>

      {/* Файлы */}
      <Card>
        <CardHeader>
          <CardTitle>Файлы</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          {order.files && order.files.length > 0 ? (
            <div className="space-y-2">
              {order.files.map((file) => (
                <div key={file.id} className="flex items-center justify-between p-3 border rounded-lg">
                  <div className="flex items-center gap-3">
                    <Download className="h-5 w-5 text-muted-foreground" />
                    <div>
                      <p className="font-medium">{file.file_name}</p>
                      <p className="text-xs text-muted-foreground">
                        {new Date(file.created_at).toLocaleDateString("ru-RU")} • {(file.file_size / 1024).toFixed(1)} KB
                      </p>
                    </div>
                  </div>
                  <Button
                    variant="ghost"
                    size="icon"
                    onClick={() => deleteMutation.mutate({ orderId: order.id, fileId: file.id })}
                  >
                    <Trash2 className="h-4 w-4 text-destructive" />
                  </Button>
                </div>
              ))}
            </div>
          ) : (
            <p className="text-muted-foreground">Нет загруженных файлов</p>
          )}
          {canUpload && (
            <div className="pt-4 border-t">
              <FileUpload onFilesChange={handleFilesChange} maxFiles={5} />
            </div>
          )}
        </CardContent>
      </Card>

      {/* История статусов */}
      {order.status_history && order.status_history.length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle>История статусов</CardTitle>
          </CardHeader>
          <CardContent>
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Дата</TableHead>
                  <TableHead>Статус</TableHead>
                  <TableHead>Комментарий</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {order.status_history.map((h) => (
                  <TableRow key={h.id}>
                    <TableCell>{new Date(h.created_at).toLocaleString("ru-RU")}</TableCell>
                    <TableCell><StatusBadge status={h.new_status} /></TableCell>
                    <TableCell>{h.comment || "—"}</TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </CardContent>
        </Card>
      )}

      {/* Отзыв (если завершён) */}
      {isCompleted && (
        <Card>
          <CardHeader>
            <CardTitle>Оставить отзыв</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="flex gap-2">
              {[1, 2, 3, 4, 5].map((star) => (
                <button
                  key={star}
                  onClick={() => setReviewRating(star)}
                  onMouseEnter={() => setHoverRating(star)}
                  onMouseLeave={() => setHoverRating(0)}
                  className="transition-transform hover:scale-110"
                >
                  <Star
                    className={`h-8 w-8 ${star <= (hoverRating || reviewRating) ? "fill-yellow-400 text-yellow-400" : "text-muted-foreground"}`}
                  />
                </button>
              ))}
            </div>
            <div>
              <Label htmlFor="review-text">Комментарий (необязательно)</Label>
              <Input
                id="review-text"
                value={reviewText}
                onChange={(e) => setReviewText(e.target.value)}
                placeholder="Поделитесь впечатлениями..."
              />
            </div>
            <Button
              disabled={!reviewRating}
              onClick={() => {
                toast.success("Отзыв отправлен на модерацию");
                setReviewRating(0);
                setReviewText("");
              }}
            >
              Отправить отзыв
            </Button>
          </CardContent>
        </Card>
      )}
    </div>
  );
};
