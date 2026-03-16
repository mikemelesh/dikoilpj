import { cn } from "@/utils";
import { Check, X } from "lucide-react";

import type { OrderStatus } from "@/types";

// =============================================================================
// Конфигурация шагов
// =============================================================================

const STEPS: { status: OrderStatus; label: string }[] = [
  { status: "new", label: "Новый" },
  { status: "confirmed", label: "Подтверждён" },
  { status: "in_progress", label: "В работе" },
  { status: "review", label: "На проверке" },
  { status: "completed", label: "Завершён" },
];

const TERMINAL_STEPS: { status: OrderStatus; label: string; side: boolean }[] = [
  { status: "cancelled", label: "Отменён", side: true },
  { status: "archived", label: "Архив", side: true },
];

// =============================================================================
// Компонент OrderStatusTracker
// =============================================================================

interface OrderStatusTrackerProps {
  currentStatus: OrderStatus;
  className?: string;
}

export const OrderStatusTracker = ({
  currentStatus,
  className,
}: OrderStatusTrackerProps) => {
  // Определяем индекс текущего шага
  const currentStepIndex = STEPS.findIndex((s) => s.status === currentStatus);
  const isTerminal = currentStatus === "cancelled" || currentStatus === "archived";
  const terminalStep = TERMINAL_STEPS.find((s) => s.status === currentStatus);

  return (
    <div className={cn("w-full", className)}>
      {/* Основной прогресс-бар */}
      <div className="relative">
        {/* Линия прогресса */}
        <div className="absolute top-4 left-0 right-0 h-0.5 bg-muted" />
        <div
          className="absolute top-4 left-0 h-0.5 bg-primary transition-all duration-300"
          style={{
            width: `${(currentStepIndex / (STEPS.length - 1)) * 100}%`,
          }}
        />

        {/* Шаги */}
        <div className="relative flex justify-between">
          {STEPS.map((step, index) => {
            const isCompleted = index < currentStepIndex;
            const isCurrent = index === currentStepIndex;
            const isSkipped = index > currentStepIndex;

            return (
              <div key={step.status} className="flex flex-col items-center">
                {/* Кружок статуса */}
                <div
                  className={cn(
                    "flex h-8 w-8 items-center justify-center rounded-full border-2 transition-colors",
                    isCompleted && "border-primary bg-primary text-primary-foreground",
                    isCurrent && "border-primary bg-background text-primary",
                    isSkipped && "border-muted bg-muted text-muted-foreground"
                  )}
                >
                  {isCompleted ? (
                    <Check className="h-4 w-4" />
                  ) : isCurrent ? (
                    <div className="h-3 w-3 rounded-full bg-primary" />
                  ) : (
                    <span className="text-xs font-medium">{index + 1}</span>
                  )}
                </div>

                {/* Подпись */}
                <span
                  className={cn(
                    "mt-2 text-xs font-medium",
                    isCompleted && "text-primary",
                    isCurrent && "text-primary",
                    isSkipped && "text-muted-foreground"
                  )}
                >
                  {step.label}
                </span>
              </div>
            );
          })}
        </div>
      </div>

      {/* Боковые шаги (отменён/архив) */}
      {isTerminal && terminalStep && (
        <div className="mt-4 flex justify-center">
          <div
            className={cn(
              "flex items-center gap-2 rounded-lg border px-4 py-2",
              terminalStep.status === "cancelled"
                ? "border-destructive/50 bg-destructive/10"
                : "border-muted bg-muted/50"
            )}
          >
            <X className="h-4 w-4 text-destructive" />
            <span className="text-sm font-medium">{terminalStep.label}</span>
          </div>
        </div>
      )}
    </div>
  );
};
