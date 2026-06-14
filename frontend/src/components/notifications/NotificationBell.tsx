import { useEffect, useRef } from "react";
import { useNavigate } from "react-router-dom";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Bell, CheckCheck } from "lucide-react";

import {
  getNotifications,
  markAllNotificationsRead,
  markNotificationRead,
} from "@/api/notifications";
import { CLIENT_ORDER_QUERY_KEYS } from "@/lib/clientOrdersQuery";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { mutationOnError } from "@/lib/apiError";
import { cn, formatDateTime } from "@/utils";

const NOTIFICATIONS_REFETCH_MS = 30_000;
/** ~10 rows visible; scroll for the rest (up to 30 in API). */
const DROPDOWN_LIST_MAX_HEIGHT = "max-h-[420px]";

export const NotificationBell = () => {
  const navigate = useNavigate();
  const queryClient = useQueryClient();

  const { data, isLoading } = useQuery({
    queryKey: ["notifications"],
    queryFn: getNotifications,
    refetchInterval: NOTIFICATIONS_REFETCH_MS,
    refetchOnWindowFocus: true,
    staleTime: 10_000,
    meta: { skipErrorToast: true },
  });

  const invalidateClientOrders = () => {
    for (const key of CLIENT_ORDER_QUERY_KEYS) {
      queryClient.invalidateQueries({ queryKey: [key] });
    }
  };

  const markReadMutation = useMutation({
    mutationFn: markNotificationRead,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["notifications"] });
      invalidateClientOrders();
    },
    onError: mutationOnError("Не удалось отметить уведомление"),
  });

  const markAllReadMutation = useMutation({
    mutationFn: markAllNotificationsRead,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["notifications"] });
      invalidateClientOrders();
    },
    onError: mutationOnError("Не удалось отметить уведомления прочитанными"),
  });

  const unreadCount = data?.unread_count ?? 0;
  const items = data?.items ?? [];
  const prevUnreadRef = useRef(unreadCount);

  useEffect(() => {
    if (unreadCount > prevUnreadRef.current) {
      invalidateClientOrders();
    }
    prevUnreadRef.current = unreadCount;
  }, [unreadCount, queryClient]);

  const handleNotificationClick = (id: number, orderId: string | null, isRead: boolean) => {
    if (!isRead) {
      markReadMutation.mutate(id);
    }
    if (orderId) {
      navigate(`/client/orders/${orderId}`);
    }
  };

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button variant="ghost" size="icon" className="relative h-9 w-9" aria-label="Уведомления">
          <Bell className="h-5 w-5" />
          {unreadCount > 0 && (
            <span className="absolute -right-0.5 -top-0.5 flex h-4 min-w-4 items-center justify-center rounded-full bg-destructive px-1 text-[10px] font-bold text-destructive-foreground">
              {unreadCount > 9 ? "9+" : unreadCount}
            </span>
          )}
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" className="w-80">
        <div className="flex items-center justify-between px-2 py-1.5">
          <DropdownMenuLabel className="p-0">Уведомления</DropdownMenuLabel>
          {unreadCount > 0 && (
            <Button
              variant="ghost"
              size="sm"
              className="h-7 gap-1 text-xs"
              onClick={() => markAllReadMutation.mutate()}
              disabled={markAllReadMutation.isPending}
            >
              <CheckCheck className="h-3 w-3" />
              Прочитать все
            </Button>
          )}
        </div>
        <DropdownMenuSeparator />
        <div className={cn("overflow-y-auto", DROPDOWN_LIST_MAX_HEIGHT)}>
          {isLoading ? (
            <p className="px-3 py-6 text-center text-sm text-muted-foreground">Загрузка…</p>
          ) : items.length === 0 ? (
            <p className="px-3 py-6 text-center text-sm text-muted-foreground">Нет уведомлений</p>
          ) : (
            items.map((n) => (
              <DropdownMenuItem
                key={n.id}
                className={cn(
                  "cursor-pointer flex flex-col items-start gap-0.5 py-2.5",
                  !n.is_read && "bg-accent/50"
                )}
                onClick={() => handleNotificationClick(n.id, n.order_id, n.is_read)}
              >
                <span className="text-sm font-medium leading-snug">{n.title}</span>
                <span className="text-sm leading-snug text-muted-foreground">{n.message}</span>
                <span className="text-xs text-muted-foreground">
                  {formatDateTime(n.created_at)}
                </span>
              </DropdownMenuItem>
            ))
          )}
        </div>
      </DropdownMenuContent>
    </DropdownMenu>
  );
};
