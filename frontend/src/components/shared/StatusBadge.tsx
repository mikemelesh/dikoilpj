import { Badge, BadgeProps } from "@/components/ui/badge";
import { cn } from "@/utils";

import type { OrderStatus } from "@/types";

// =============================================================================
// Конфигурация статусов
// =============================================================================

const STATUS_CONFIG: Record<OrderStatus, { label: string; variant: BadgeProps["variant"] }> = {
  new: { label: "Новый", variant: "secondary" },
  confirmed: { label: "Подтверждён", variant: "default" },
  in_progress: { label: "В работе", variant: "warning" },
  review: { label: "На проверке", variant: "warning" },
  completed: { label: "Завершён", variant: "success" },
  cancelled: { label: "Отменён", variant: "destructive" },
  archived: { label: "Архив", variant: "outline" },
};

// =============================================================================
// Компонент StatusBadge
// =============================================================================

interface StatusBadgeProps {
  status: OrderStatus;
  className?: string;
}

export const StatusBadge = ({ status, className }: StatusBadgeProps) => {
  const config = STATUS_CONFIG[status] || STATUS_CONFIG.new;

  return (
    <Badge
      variant={config.variant}
      className={cn("min-w-[100px] justify-center", className)}
    >
      {config.label}
    </Badge>
  );
};

// =============================================================================
// Хелпер для получения конфигурации статуса
// =============================================================================

export const getStatusConfig = (status: OrderStatus) => {
  return STATUS_CONFIG[status] || STATUS_CONFIG.new;
};

export const getStatusLabel = (status: OrderStatus) => {
  return STATUS_CONFIG[status]?.label || status;
};
