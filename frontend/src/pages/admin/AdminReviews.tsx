import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { toast } from "react-toastify";
import { apiClient } from "@/api/axios";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Star, Check, X } from "lucide-react";

interface Review { id: number; client_id: number; client_name?: string; order_id?: number; order_number?: string; rating: number; text?: string; is_moderated: boolean; is_published: boolean; created_at: string }

export const AdminReviews = () => {
  const queryClient = useQueryClient();
  const [tab, setTab] = useState<"pending" | "all">("pending");

  const { data: pendingData } = useQuery<{ items: Review[]; total: number }>({ queryKey: ["admin-reviews-pending"], queryFn: () => apiClient.get("/reviews/pending").then(r => r.data) });
  const { data: allData } = useQuery<{ items: Review[]; total: number }>({ queryKey: ["admin-reviews-all"], queryFn: () => apiClient.get("/reviews?limit=100").then(r => r.data) });

  const moderateMutation = useMutation({
    mutationFn: ({ id, is_published }: { id: number; is_published: boolean }) => apiClient.patch(`/reviews/${id}/moderate`, { is_published }),
    onSuccess: () => { queryClient.invalidateQueries({ queryKey: ["admin-reviews-pending", "admin-reviews-all"] }); toast.success("Отзыв обновлён"); },
    onError: () => toast.error("Ошибка обновления"),
  });

  const reviews = tab === "pending" ? pendingData?.items?.filter(r => !r.is_published) || [] : allData?.items || [];

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="text-3xl font-bold">Отзывы</h1>
        <div className="flex gap-2">
          <Button variant={tab === "pending" ? "default" : "outline"} size="sm" onClick={() => setTab("pending")}>На модерации</Button>
          <Button variant={tab === "all" ? "default" : "outline"} size="sm" onClick={() => setTab("all")}>Все отзывы</Button>
        </div>
      </div>

      <Card>
        <CardHeader><CardTitle>{tab === "pending" ? "Отзывы на модерации" : "Все отзывы"}</CardTitle></CardHeader>
        <CardContent>
          {reviews.length === 0 ? (
            <p className="text-center text-muted-foreground py-8">Нет отзывов</p>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Автор</TableHead>
                  <TableHead>Заказ</TableHead>
                  <TableHead>Рейтинг</TableHead>
                  <TableHead>Текст</TableHead>
                  <TableHead>Дата</TableHead>
                  <TableHead>Статус</TableHead>
                  {tab === "pending" && <TableHead></TableHead>}
                </TableRow>
              </TableHeader>
              <TableBody>
                {reviews.map((review) => (
                  <TableRow key={review.id}>
                    <TableCell>{review.client_name || "Аноним"}</TableCell>
                    <TableCell>{review.order_number || "—"}</TableCell>
                    <TableCell>
                      <div className="flex">
                        {[...Array(5)].map((_, i) => (
                          <Star key={i} className={`h-4 w-4 ${i < review.rating ? "fill-yellow-400 text-yellow-400" : "text-muted-foreground"}`} />
                        ))}
                      </div>
                    </TableCell>
                    <TableCell className="max-w-xs truncate">{review.text || "—"}</TableCell>
                    <TableCell>{new Date(review.created_at).toLocaleDateString("ru-RU")}</TableCell>
                    <TableCell>
                      <Badge variant={review.is_published ? "success" : "secondary"}>{review.is_published ? "Опубликован" : review.is_moderated ? "Отклонён" : "На модерации"}</Badge>
                    </TableCell>
                    {tab === "pending" && (
                      <TableCell>
                        <div className="flex gap-1">
                          <Button variant="outline" size="sm" onClick={() => moderateMutation.mutate({ id: review.id, is_published: true })}><Check className="h-4 w-4 text-green-600" /></Button>
                          <Button variant="outline" size="sm" onClick={() => moderateMutation.mutate({ id: review.id, is_published: false })}><X className="h-4 w-4 text-red-600" /></Button>
                        </div>
                      </TableCell>
                    )}
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>
    </div>
  );
};
