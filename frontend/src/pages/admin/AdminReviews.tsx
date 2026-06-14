import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { toast } from "react-toastify";
import { mutationOnError } from "@/lib/apiError";
import { apiClient } from "@/api/axios";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Star, Check, X, RefreshCw } from "lucide-react";
import { ExportButton } from "@/components/shared/ExportButton";
import { cn, formatDate, formatDateTime } from "@/utils";

const REVIEWS_REFETCH_MS = 30_000;

const reviewsQueryOptions = {
  refetchInterval: REVIEWS_REFETCH_MS,
  refetchOnWindowFocus: true,
  staleTime: 10_000,
} as const;

interface Review {
  id: number;
  client_id: number;
  client_name?: string;
  order_id?: string;
  order_number?: string;
  rating: number;
  text?: string;
  is_moderated: boolean;
  is_published: boolean;
  created_at: string;
}

function invalidateAdminReviews(queryClient: ReturnType<typeof useQueryClient>) {
  queryClient.invalidateQueries({ queryKey: ["admin-reviews-pending"] });
  queryClient.invalidateQueries({ queryKey: ["admin-reviews-all"] });
  queryClient.invalidateQueries({ queryKey: ["admin-pending-reviews"] });
}

export const AdminReviews = () => {
  const queryClient = useQueryClient();
  const [tab, setTab] = useState<"pending" | "all">("pending");

  const {
    data: pendingData,
    isFetching: isPendingFetching,
    dataUpdatedAt: pendingUpdatedAt,
    refetch: refetchPending,
  } = useQuery<{ items: Review[]; total: number }>({
    queryKey: ["admin-reviews-pending"],
    queryFn: () => apiClient.get("/reviews/pending").then((r) => r.data),
    ...reviewsQueryOptions,
  });

  const {
    data: allData,
    isFetching: isAllFetching,
    dataUpdatedAt: allUpdatedAt,
    refetch: refetchAll,
  } = useQuery<{ items: Review[]; total: number }>({
    queryKey: ["admin-reviews-all"],
    queryFn: () => apiClient.get("/reviews?limit=100").then((r) => r.data),
    ...reviewsQueryOptions,
  });

  const moderateMutation = useMutation({
    mutationFn: ({ id, is_published }: { id: number; is_published: boolean }) =>
      apiClient.patch(`/reviews/${id}/moderate`, { is_published }),
    onSuccess: () => {
      invalidateAdminReviews(queryClient);
      toast.success("Отзыв обновлён");
    },
    onError: mutationOnError("Ошибка обновления"),
  });

  const handleRefresh = () => {
    void Promise.all([refetchPending(), refetchAll()]);
  };

  const isFetching = tab === "pending" ? isPendingFetching : isAllFetching;
  const lastUpdatedAt = tab === "pending" ? pendingUpdatedAt : allUpdatedAt;
  const pendingCount = pendingData?.items?.filter((r) => !r.is_moderated).length ?? pendingData?.total ?? 0;

  const reviews =
    tab === "pending"
      ? pendingData?.items?.filter((r) => !r.is_moderated) || []
      : allData?.items || [];

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-4">
        <h1 className="text-3xl font-bold">Отзывы</h1>
        <div className="flex flex-wrap items-center gap-2">
          <span className="text-xs text-muted-foreground hidden sm:inline">
            {lastUpdatedAt > 0 && `Обновлено: ${formatDateTime(new Date(lastUpdatedAt))}`}
          </span>
          <Button
            variant="outline"
            size="sm"
            onClick={handleRefresh}
            disabled={isFetching}
            className="gap-2"
          >
            <RefreshCw className={cn("h-4 w-4", isFetching && "animate-spin")} />
            Обновить
          </Button>
          <ExportButton resource="reviews" title="Отзывы" />
          <Button
            variant={tab === "pending" ? "default" : "outline"}
            size="sm"
            onClick={() => setTab("pending")}
          >
            На модерации
            {pendingCount > 0 && (
              <Badge variant="secondary" className="ml-2 px-1.5 py-0">
                {pendingCount}
              </Badge>
            )}
          </Button>
          <Button
            variant={tab === "all" ? "default" : "outline"}
            size="sm"
            onClick={() => setTab("all")}
          >
            Все отзывы
          </Button>
        </div>
      </div>

      <Card>
        <CardHeader className="flex flex-row items-center justify-between gap-2">
          <CardTitle>{tab === "pending" ? "Отзывы на модерации" : "Все отзывы"}</CardTitle>
          {isFetching && (
            <span className="text-xs text-muted-foreground animate-pulse">Загрузка…</span>
          )}
        </CardHeader>
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
                          <Star
                            key={i}
                            className={`h-4 w-4 ${i < review.rating ? "fill-yellow-400 text-yellow-400" : "text-muted-foreground"}`}
                          />
                        ))}
                      </div>
                    </TableCell>
                    <TableCell className="max-w-xs truncate">{review.text || "—"}</TableCell>
                    <TableCell>{formatDate(review.created_at)}</TableCell>
                    <TableCell>
                      <Badge
                        variant={
                          review.is_published
                            ? "success"
                            : review.is_moderated
                              ? "secondary"
                              : "outline"
                        }
                      >
                        {review.is_published
                          ? "Опубликован"
                          : review.is_moderated
                            ? "Отклонён"
                            : "На модерации"}
                      </Badge>
                    </TableCell>
                    {tab === "pending" && (
                      <TableCell>
                        <div className="flex gap-1">
                          <Button
                            variant="outline"
                            size="sm"
                            disabled={moderateMutation.isPending}
                            onClick={() =>
                              moderateMutation.mutate({ id: review.id, is_published: true })
                            }
                            title="Одобрить"
                          >
                            <Check className="h-4 w-4 text-green-600" />
                          </Button>
                          <Button
                            variant="outline"
                            size="sm"
                            disabled={moderateMutation.isPending}
                            onClick={() =>
                              moderateMutation.mutate({ id: review.id, is_published: false })
                            }
                            title="Отклонить"
                          >
                            <X className="h-4 w-4 text-red-600" />
                          </Button>
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
