import { useEffect, useState } from "react";
import { useParams, useNavigate, Link } from "react-router-dom";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { toast } from "react-toastify";
import { mutationOnError } from "@/lib/apiError";
import { ApiErrorAlert } from "@/components/shared/ApiErrorAlert";

import { getOrder, uploadFile, deleteFile } from "@/api/orders";
import { clientOrdersQueryOptions } from "@/lib/clientOrdersQuery";
import { createOrderReview } from "@/api/reviews";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { StatusBadge } from "@/components/shared/StatusBadge";
import { OrderStatusTracker } from "@/components/orders/OrderStatusTracker";
import { FileUpload } from "@/components/shared/FileUpload";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { ArrowLeft, Download, Trash2, Star, Eye, FileText } from "lucide-react";
import type { Order, OrderFile } from "@/types";
import { API_BASE_URL } from "@/api/axios";
import { formatDate, formatDateTime, getOrderItemServiceLabel } from "@/utils";

const SYSTEM_STATUS_COMMENTS = new Set(["Заказ создан"]);

function getLabMessages(history: Order["status_history"]) {
  if (!history?.length) return [];
  return history.filter(
    (entry) => entry.comment && !SYSTEM_STATUS_COMMENTS.has(entry.comment)
  );
}

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
  const [reviewSubmitted, setReviewSubmitted] = useState(false);
  const [viewFile, setViewFile] = useState<OrderFile | null>(null);

  const { data: order, isLoading, isError, error } = useQuery({
    queryKey: ["order", id],
    queryFn: () => getOrder(id!),
    enabled: !!id,
    ...clientOrdersQueryOptions,
    meta: { skipErrorToast: true },
  });

  useEffect(() => {
    setReviewSubmitted(false);
    setReviewRating(0);
    setReviewText("");
  }, [id]);

  const uploadMutation = useMutation({
    mutationFn: ({ orderId, file }: { orderId: string; file: File }) =>
      uploadFile(orderId, file),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["order", id] });
      toast.success("Файл загружен");
    },
    onError: mutationOnError("Ошибка загрузки файла"),
  });

  const deleteMutation = useMutation({
    mutationFn: ({ orderId, fileId }: { orderId: string; fileId: number }) =>
      deleteFile(orderId, fileId),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["order", id] });
      toast.success("Файл удалён");
    },
    onError: mutationOnError("Ошибка удаления файла"),
  });

  const createReviewMutation = useMutation({
    mutationFn: async (payload: { rating: number; text?: string }) => {
      if (!id) {
        throw new Error("Не найден ID заказа");
      }
      return createOrderReview({
        order_id: id,
        rating: payload.rating,
        text: payload.text,
      });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["order", id] });
      toast.success("Отзыв отправлен на модерацию");
      setReviewRating(0);
      setReviewText("");
      setReviewSubmitted(true);
    },
    onError: mutationOnError("Ошибка отправки отзыва"),
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
  if (isError) {
    return (
      <div className="p-8 max-w-lg mx-auto">
        <ApiErrorAlert error={error} fallback="Не удалось загрузить заказ" />
      </div>
    );
  }
  if (!order) return <div className="p-8 text-center">Заказ не найден</div>;

  const labMessages = getLabMessages(order.status_history);

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
              Дедлайн: {formatDate(order.deadline)}
            </p>
          )}
        </CardContent>
      </Card>

      {labMessages.length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle>Сообщения от лаборатории</CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            {[...labMessages].reverse().map((entry) => (
              <div key={entry.id} className="rounded-lg border bg-muted/30 p-4 text-sm">
                <p className="whitespace-pre-wrap">{entry.comment}</p>
                <p className="mt-2 text-xs text-muted-foreground">
                  {formatDateTime(entry.created_at)}
                  {entry.new_status === "confirmed" ? " · Подтверждение заказа" : ""}
                </p>
              </div>
            ))}
          </CardContent>
        </Card>
      )}

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
                  <TableCell>{getOrderItemServiceLabel(item)}</TableCell>
                  <TableCell className="text-right">{item.quantity}</TableCell>
                  <TableCell className="text-right">
                    {new Intl.NumberFormat("ru-RU", { style: "currency", currency: "BYN", minimumFractionDigits: 2 }).format(Number(item.unit_price))}
                  </TableCell>
                  <TableCell className="text-right font-medium">
                    {new Intl.NumberFormat("ru-RU", { style: "currency", currency: "BYN", minimumFractionDigits: 2 }).format(Number(item.total_price))}
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
          <div className="mt-4 flex justify-between items-center pt-4 border-t">
            <span className="text-muted-foreground">
              {order.discount_amount > 0 && `Скидка: ${new Intl.NumberFormat("ru-RU", { style: "currency", currency: "BYN", minimumFractionDigits: 2 }).format(Number(order.discount_amount))}`}
            </span>
            <span className="text-xl font-bold">
              Итого: {new Intl.NumberFormat("ru-RU", { style: "currency", currency: "BYN", minimumFractionDigits: 2 }).format(Number(order.final_price))}
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
              {order.files.map((file) => {
                const fileUrl = `${API_BASE_URL.replace('/api', '')}${file.file_path}`;
                const isImage = file.file_type.startsWith('image/');
                const isPDF = file.file_type === 'application/pdf';
                const canView = isImage || isPDF;
                
                return (
                  <div key={file.id} className="flex items-center justify-between p-3 border rounded-lg">
                    <div className="flex items-center gap-3">
                      {isImage ? (
                        <FileText className="h-5 w-5 text-blue-500" />
                      ) : isPDF ? (
                        <FileText className="h-5 w-5 text-red-500" />
                      ) : (
                        <Download className="h-5 w-5 text-muted-foreground" />
                      )}
                      <div>
                        <p className="font-medium">{file.file_name}</p>
                        <p className="text-xs text-muted-foreground">
                          {formatDate(file.created_at)} • {(file.file_size / 1024).toFixed(1)} KB
                        </p>
                      </div>
                    </div>
                    <div className="flex items-center gap-1">
                      {canView && (
                        <Button
                          variant="ghost"
                          size="icon"
                          onClick={() => setViewFile(file)}
                        >
                          <Eye className="h-4 w-4" />
                        </Button>
                      )}
                      <a
                        href={fileUrl}
                        download={file.file_name}
                        className="inline-flex items-center justify-center h-10 w-10 rounded-md hover:bg-accent transition-colors"
                      >
                        <Download className="h-4 w-4" />
                      </a>
                      <Button
                        variant="ghost"
                        size="icon"
                        onClick={() => deleteMutation.mutate({ orderId: order.id, fileId: file.id })}
                      >
                        <Trash2 className="h-4 w-4 text-destructive" />
                      </Button>
                    </div>
                  </div>
                );
              })}
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

      {/* Модальное окно просмотра файла */}
      <Dialog open={!!viewFile} onOpenChange={() => setViewFile(null)}>
        <DialogContent className="max-w-4xl">
          <DialogHeader>
            <DialogTitle>{viewFile?.file_name}</DialogTitle>
          </DialogHeader>
          {viewFile && (
            <div className="mt-4">
              {viewFile.file_type.startsWith('image/') ? (
                <img
                  src={`${API_BASE_URL.replace('/api', '')}${viewFile.file_path.startsWith('/') ? viewFile.file_path : '/' + viewFile.file_path}`}
                  alt={viewFile.file_name}
                  className="w-full h-auto max-h-[70vh] object-contain"
                  onError={(e) => {
                    const target = e.target as HTMLImageElement;
                    target.onerror = null;
                    target.src = '';
                  }}
                />
              ) : viewFile.file_type === 'application/pdf' ? (
                <iframe
                  src={`${API_BASE_URL.replace('/api', '')}${viewFile.file_path.startsWith('/') ? viewFile.file_path : '/' + viewFile.file_path}`}
                  className="w-full h-[70vh] border rounded"
                  title={viewFile.file_name}
                />
              ) : (
                <p className="text-center text-muted-foreground py-8">
                  Предпросмотр недоступен для этого типа файла
                </p>
              )}
            </div>
          )}
        </DialogContent>
      </Dialog>

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
                    <TableCell>{formatDateTime(h.created_at)}</TableCell>
                    <TableCell><StatusBadge status={h.new_status} /></TableCell>
                    <TableCell className="whitespace-pre-wrap">{h.comment || "—"}</TableCell>
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
            {reviewSubmitted ? (
              <p className="text-sm text-muted-foreground">
                Спасибо! Отзыв отправлен и появится на сайте после проверки администратором.
              </p>
            ) : (
            <>
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
              disabled={!reviewRating || createReviewMutation.isPending}
              onClick={() => {
                createReviewMutation.mutate({
                  rating: reviewRating,
                  text: reviewText.trim() ? reviewText : undefined,
                });
              }}
            >
              {createReviewMutation.isPending ? "Отправка..." : "Отправить отзыв"}
            </Button>
            </>
            )}
          </CardContent>
        </Card>
      )}
    </div>
  );
};
