import { Button } from "@/components/ui/button";
import { cn } from "@/utils";

import { ChevronLeft, ChevronRight, ChevronsLeft, ChevronsRight } from "lucide-react";

// =============================================================================
// Типы
// =============================================================================

interface PaginationProps {
  total: number;
  page: number;
  limit: number;
  onPageChange: (page: number) => void;
  onLimitChange?: (limit: number) => void;
  showSizeChanger?: boolean;
  pageSizeOptions?: number[];
}

// =============================================================================
// Компонент Pagination
// =============================================================================

export const Pagination = ({
  total,
  page,
  limit,
  onPageChange,
  onLimitChange,
  showSizeChanger = false,
  pageSizeOptions = [10, 20, 50, 100],
}: PaginationProps) => {
  const totalPages = Math.ceil(total / limit);
  const start = (page - 1) * limit + 1;
  const end = Math.min(page * limit, total);

  const handlePageChange = (newPage: number) => {
    const clampedPage = Math.max(1, Math.min(newPage, totalPages));
    if (clampedPage !== page) {
      onPageChange(clampedPage);
    }
  };

  return (
    <div className="flex flex-col items-center justify-between gap-4 border-t pt-4 sm:flex-row">
      {/* Информация о показе */}
      <div className="text-sm text-muted-foreground">
        {total > 0 ? (
          <>
            Показано <span className="font-medium">{start}</span>-
            <span className="font-medium">{end}</span> из{" "}
            <span className="font-medium">{total}</span>
          </>
        ) : (
          "Нет записей"
        )}
      </div>

      {/* Контролы пагинации */}
      <div className="flex items-center gap-2">
        {/* Кнопка "В начало" */}
        <Button
          variant="outline"
          size="icon"
          onClick={() => handlePageChange(1)}
          disabled={page === 1}
          aria-label="Первая страница"
        >
          <ChevronsLeft className="h-4 w-4" />
        </Button>

        {/* Кнопка "Назад" */}
        <Button
          variant="outline"
          size="icon"
          onClick={() => handlePageChange(page - 1)}
          disabled={page === 1}
          aria-label="Предыдущая страница"
        >
          <ChevronLeft className="h-4 w-4" />
        </Button>

        {/* Номер страницы */}
        <span className="flex h-10 w-10 items-center justify-center text-sm font-medium">
          {page} / {totalPages || 1}
        </span>

        {/* Кнопка "Вперёд" */}
        <Button
          variant="outline"
          size="icon"
          onClick={() => handlePageChange(page + 1)}
          disabled={page >= totalPages}
          aria-label="Следующая страница"
        >
          <ChevronRight className="h-4 w-4" />
        </Button>

        {/* Кнопка "В конец" */}
        <Button
          variant="outline"
          size="icon"
          onClick={() => handlePageChange(totalPages)}
          disabled={page >= totalPages}
          aria-label="Последняя страница"
        >
          <ChevronsRight className="h-4 w-4" />
        </Button>

        {/* Переключатель размера страницы */}
        {showSizeChanger && onLimitChange && (
          <>
            <div className="h-6 w-px bg-border" />
            <select
              value={limit}
              onChange={(e) => onLimitChange(Number(e.target.value))}
              className="flex h-10 rounded-md border border-input bg-background px-3 py-2 text-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
              aria-label="Размер страницы"
            >
              {pageSizeOptions.map((size) => (
                <option key={size} value={size}>
                  {size} / стр.
                </option>
              ))}
            </select>
          </>
        )}
      </div>
    </div>
  );
};
