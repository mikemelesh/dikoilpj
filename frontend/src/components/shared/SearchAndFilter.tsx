import { useEffect, useMemo, useState } from "react";

import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { X } from "lucide-react";

// =============================================================================
// Типы
// =============================================================================

export interface FilterConfig {
  key: string;
  label: string;
  type: "select" | "text" | "number" | "date";
  options?: { value: string; label: string }[];
  placeholder?: string;
}

interface SearchAndFilterProps {
  onSearch: (value: string) => void;
  onFilter: (filters: Record<string, string>) => void;
  filters?: FilterConfig[];
  searchPlaceholder?: string;
  debounceMs?: number;
}

// =============================================================================
// Компонент SearchAndFilter
// =============================================================================

export const SearchAndFilter = ({
  onSearch,
  onFilter,
  filters = [],
  searchPlaceholder = "Поиск...",
  debounceMs = 300,
}: SearchAndFilterProps) => {
  const [searchValue, setSearchValue] = useState("");
  const [filterValues, setFilterValues] = useState<Record<string, string>>({});

  // Debounce для поиска
  const debouncedSearch = useMemo(() => {
    const handler = setTimeout(() => {
      onSearch(searchValue);
    }, debounceMs);

    return () => clearTimeout(handler);
  }, [searchValue, debounceMs, onSearch]);

  // Применение фильтров
  useEffect(() => {
    onFilter(filterValues);
  }, [filterValues, onFilter]);

  const handleFilterChange = (key: string, value: string) => {
    setFilterValues((prev) => ({ ...prev, [key]: value }));
  };

  const handleReset = () => {
    setSearchValue("");
    setFilterValues({});
    onSearch("");
    onFilter({});
  };

  const hasActiveFilters = searchValue || Object.keys(filterValues).length > 0;

  return (
    <div className="space-y-4 rounded-lg border bg-card p-4 shadow-sm">
      {/* Поиск */}
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center">
        <div className="flex-1">
          <Label htmlFor="search">Поиск</Label>
          <div className="relative">
            <Input
              id="search"
              value={searchValue}
              onChange={(e) => setSearchValue(e.target.value)}
              placeholder={searchPlaceholder}
              className="pr-10"
            />
            {searchValue && (
              <button
                onClick={() => setSearchValue("")}
                className="absolute right-2 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
                aria-label="Очистить поиск"
              >
                <X className="h-4 w-4" />
              </button>
            )}
          </div>
        </div>

        {hasActiveFilters && (
          <div className="flex items-end">
            <Button variant="outline" size="sm" onClick={handleReset}>
              Сбросить
            </Button>
          </div>
        )}
      </div>

      {/* Фильтры */}
      {filters.length > 0 && (
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
          {filters.map((filter) => (
            <div key={filter.key}>
              <Label htmlFor={filter.key}>{filter.label}</Label>
              
              {filter.type === "select" ? (
                <select
                  id={filter.key}
                  value={filterValues[filter.key] || ""}
                  onChange={(e) => handleFilterChange(filter.key, e.target.value)}
                  className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-50"
                >
                  <option value="">Все</option>
                  {filter.options?.map((opt) => (
                    <option key={opt.value} value={opt.value}>
                      {opt.label}
                    </option>
                  ))}
                </select>
              ) : filter.type === "number" ? (
                <Input
                  id={filter.key}
                  type="number"
                  value={filterValues[filter.key] || ""}
                  onChange={(e) => handleFilterChange(filter.key, e.target.value)}
                  placeholder={filter.placeholder}
                />
              ) : filter.type === "date" ? (
                <Input
                  id={filter.key}
                  type="date"
                  value={filterValues[filter.key] || ""}
                  onChange={(e) => handleFilterChange(filter.key, e.target.value)}
                />
              ) : (
                <Input
                  id={filter.key}
                  type="text"
                  value={filterValues[filter.key] || ""}
                  onChange={(e) => handleFilterChange(filter.key, e.target.value)}
                  placeholder={filter.placeholder}
                />
              )}
            </div>
          ))}
        </div>
      )}
    </div>
  );
};
