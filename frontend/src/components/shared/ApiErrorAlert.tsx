import { getApiErrorMessage } from "@/lib/apiError";
import { cn } from "@/utils";

interface ApiErrorAlertProps {
  error: unknown;
  fallback?: string;
  className?: string;
}

/** Блок предупреждения на странице (дополняет toast). */
export const ApiErrorAlert = ({
  error,
  fallback = "Не удалось загрузить данные",
  className,
}: ApiErrorAlertProps) => {
  if (!error) return null;

  return (
    <div
      role="alert"
      className={cn(
        "rounded-lg border border-destructive/40 bg-destructive/10 px-4 py-3 text-sm text-destructive",
        className,
      )}
    >
      {getApiErrorMessage(error, fallback)}
    </div>
  );
};
