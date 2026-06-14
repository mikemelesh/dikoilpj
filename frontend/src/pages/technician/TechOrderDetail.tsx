import { useState } from "react";
import { useParams, useNavigate } from "react-router-dom";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { toast } from "react-toastify";
import { mutationOnError } from "@/lib/apiError";

import { getOrder, updateOrderStatus, uploadFile, deleteFile } from "@/api/orders";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { StatusBadge } from "@/components/shared/StatusBadge";
import { OrderStatusTracker } from "@/components/orders/OrderStatusTracker";
import { FileUpload } from "@/components/shared/FileUpload";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { ArrowLeft, Download, Trash2, Eye, FileText } from "lucide-react";
import { API_BASE_URL } from "@/api/axios";
import { formatDate, formatDateTime } from "@/utils";

// Схема для комментария
const statusChangeSchema = z.object({
  comment: z.string().max(1000).optional(),
});

type StatusChangeData = z.infer<typeof statusChangeSchema>;

// Доступные переходы статусов для техника
const ALLOWED_TRANSITIONS: Record<string, { to: string; label: string; variant?: string }[]> = {
  in_progress: [{ to: "review", label: "Отправить на проверку" }],
  review: [{ to: "in_progress", label: "Вернуть в работу" }],
};

export const TechOrderDetail = () => {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const [showStatusModal, setShowStatusModal] = useState(false);
  const [selectedStatus, setSelectedStatus] = useState<string | null>(null);
  const [viewFile, setViewFile] = useState<any | null>(null);

  const { data: order, isLoading } = useQuery({
    queryKey: ["order", id],
    queryFn: () => getOrder(id!),
    enabled: !!id,
  });

  const updateStatusMutation = useMutation({
    mutationFn: ({ orderId, status, comment }: { orderId: string; status: string; comment?: string }) =>
      updateOrderStatus(orderId, { new_status: status as any, comment }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["order", id] });
      toast.success("Статус обновлён");
      setShowStatusModal(false);
    },
    onError: mutationOnError("Ошибка обновления статуса"),
  });

  const uploadMutation = useMutation({
    mutationFn: ({ orderId, file }: { orderId: string; file: File }) => uploadFile(orderId, file),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["order", id] });
      toast.success("Файл загружен");
    },
    onError: mutationOnError("Ошибка загрузки файла"),
  });

  const deleteMutation = useMutation({
    mutationFn: ({ orderId, fileId }: { orderId: string; fileId: number }) => deleteFile(orderId, fileId),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["order", id] });
      toast.success("Файл удалён");
    },
    onError: mutationOnError("Ошибка удаления файла"),
  });

  const { register, handleSubmit, reset } = useForm<StatusChangeData>({
    resolver: zodResolver(statusChangeSchema),
  });

  const handleStatusChange = (newStatus: string) => {
    setSelectedStatus(newStatus);
    setShowStatusModal(true);
  };

  const onSubmitStatus = (data: StatusChangeData) => {
    if (!id || !selectedStatus) return;
    updateStatusMutation.mutate({ orderId: id, status: selectedStatus, comment: data.comment });
  };

  const handleFilesChange = (files: File[]) => {
    if (!id) return;
    files.forEach((file) => uploadMutation.mutate({ orderId: id, file }));
  };

  const currentStatus = order?.status;
  const availableTransitions = currentStatus ? ALLOWED_TRANSITIONS[currentStatus] || [] : [];
  const canUpload = order && !["completed", "cancelled", "archived"].includes(order.status);

  if (isLoading) return <div className="p-8 text-center">Загрузка...</div>;
  if (!order) return <div className="p-8 text-center">Заказ не найден</div>;

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-4">
          <Button variant="ghost" size="icon" onClick={() => navigate("/technician/orders")}>
            <ArrowLeft className="h-5 w-5" />
          </Button>
          <div>
            <h1 className="text-2xl font-bold">{order.order_number}</h1>
            <div className="flex items-center gap-2 mt-1">
              <StatusBadge status={order.status} />
            </div>
          </div>
        </div>

        {/* Кнопки смены статуса */}
        {availableTransitions.length > 0 && (
          <div className="flex gap-2">
            {availableTransitions.map((t) => (
              <Button
                key={t.to}
                onClick={() => handleStatusChange(t.to)}
                variant={t.variant || "default"}
              >
                {t.label}
              </Button>
            ))}
          </div>
        )}
      </div>

      {/* Status Tracker */}
      <Card>
        <CardHeader><CardTitle>Статус заказа</CardTitle></CardHeader>
        <CardContent>
          <OrderStatusTracker currentStatus={order.status} />
          {order.deadline && (
            <p className="mt-4 text-sm text-muted-foreground">
              Дедлайн: {formatDate(order.deadline)}
            </p>
          )}
        </CardContent>
      </Card>

      {/* Спецификация */}
      <Card>
        <CardHeader><CardTitle>Спецификация</CardTitle></CardHeader>
        <CardContent>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Услуга</TableHead>
                <TableHead className="text-right">Кол-во</TableHead>
                <TableHead className="text-right">Цена</TableHead>
                <TableHead className="text-right">Сумма</TableHead>
                <TableHead>Спецификации</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {order.items?.map((item) => (
                <TableRow key={item.id}>
                  <TableCell>{item.service?.name || `Услуга #${item.service_id}`}</TableCell>
                  <TableCell className="text-right">{item.quantity}</TableCell>
                  <TableCell className="text-right">
                    {new Intl.NumberFormat("ru-RU", { style: "currency", currency: "BYN", minimumFractionDigits: 2 }).format(Number(item.unit_price))}
                  </TableCell>
                  <TableCell className="text-right font-medium">
                    {new Intl.NumberFormat("ru-RU", { style: "currency", currency: "BYN", minimumFractionDigits: 2 }).format(Number(item.total_price))}
                  </TableCell>
                  <TableCell>
                    {item.specifications ? (
                      <div className="space-y-1 text-sm">
                        {Object.entries(item.specifications).map(([key, value]) => (
                          <p key={key} className="text-muted-foreground">
                            <span className="font-medium">{key}:</span> {value}
                          </p>
                        ))}
                      </div>
                    ) : (
                      "—"
                    )}
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </CardContent>
      </Card>

      {/* Файлы */}
      <Card>
        <CardHeader><CardTitle>Файлы</CardTitle></CardHeader>
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
                      <Button variant="ghost" size="icon" onClick={() => deleteMutation.mutate({ orderId: order.id, fileId: file.id })}>
                        <Trash2 className="h-4 w-4 text-destructive" />
                      </Button>
                    </div>
                  </div>
                );
              })}
            </div>
          ) : (
            <p className="text-muted-foreground">Нет файлов</p>
          )}
          {canUpload && (
            <div className="pt-4 border-t">
              <Label>Загрузить файл</Label>
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

      {/* История статусов */}
      {order.status_history && order.status_history.length > 0 && (
        <Card>
          <CardHeader><CardTitle>История статусов</CardTitle></CardHeader>
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
                    <TableCell>{h.comment || "—"}</TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </CardContent>
        </Card>
      )}

      {/* Модал подтверждения статуса */}
      {showStatusModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50">
          <div className="bg-background rounded-lg p-6 w-full max-w-md">
            <h2 className="text-xl font-bold mb-4">Подтверждение действия</h2>
            <p className="text-muted-foreground mb-4">
              Вы собираетесь изменить статус на <span className="font-medium">{selectedStatus}</span>
            </p>
            <form onSubmit={handleSubmit(onSubmitStatus)} className="space-y-4">
              <div>
                <Label htmlFor="comment">Комментарий (необязательно)</Label>
                <Input id="comment" {...register("comment")} placeholder="Введите комментарий..." />
              </div>
              <div className="flex justify-end gap-2">
                <Button type="button" variant="outline" onClick={() => setShowStatusModal(false)}>
                  Отмена
                </Button>
                <Button type="submit">Подтвердить</Button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};
