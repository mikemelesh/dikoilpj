import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { getKnowledgeBase, getKnowledgeArticle } from "@/api/technicians";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { SearchAndFilter, type FilterConfig } from "@/components/shared/SearchAndFilter";
import { BookOpen, X } from "lucide-react";

export const TechKnowledgeBase = () => {
  const [search, setSearch] = useState("");
  const [filters, setFilters] = useState<Record<string, string>>({});
  const [selectedArticle, setSelectedArticle] = useState<number | null>(null);

  const { data: articlesData, isLoading } = useQuery({
    queryKey: ["knowledge-base", search, filters],
    queryFn: () => getKnowledgeBase({
      search: search || undefined,
      category: filters.category || undefined,
    }),
  });

  const articles = articlesData?.items || [];

  const { data: fullArticle } = useQuery({
    queryKey: ["knowledge-article", selectedArticle],
    queryFn: () => getKnowledgeArticle(selectedArticle!),
    enabled: !!selectedArticle,
  });

  const filterConfigs: FilterConfig[] = [
    {
      key: "category",
      label: "Категория",
      type: "select",
      options: [
        { value: "technology", label: "Технологии" },
        { value: "materials", label: "Материалы" },
        { value: "techniques", label: "Техники" },
        { value: "troubleshooting", label: "Решение проблем" },
      ],
    },
  ];

  return (
    <div className="space-y-6">
      <div className="flex items-center gap-2">
        <BookOpen className="h-8 w-8 text-primary" />
        <h1 className="text-3xl font-bold">База знаний</h1>
      </div>

      <SearchAndFilter
        onSearch={setSearch}
        onFilter={setFilters}
        filters={filterConfigs}
        searchPlaceholder="Поиск по статьям..."
      />

      {isLoading ? (
        <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
          {[...Array(6)].map((_, i) => (
            <Card key={i} className="animate-pulse">
              <CardHeader>
                <div className="h-6 w-3/4 bg-muted rounded" />
              </CardHeader>
              <CardContent>
                <div className="h-4 w-full bg-muted rounded" />
              </CardContent>
            </Card>
          ))}
        </div>
      ) : !articlesData || !articles.length ? (
        <Card>
          <CardContent className="py-12 text-center text-muted-foreground">
            <p>Статьи не найдены</p>
          </CardContent>
        </Card>
      ) : (
        <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
          {articles.map((article) => (
            <Card
              key={article.id}
              className="cursor-pointer transition-shadow hover:shadow-md"
              onClick={() => setSelectedArticle(article.id)}
            >
              <CardHeader>
                <CardTitle className="line-clamp-2">{article.title}</CardTitle>
                {article.category && (
                  <CardDescription>Категория: {article.category}</CardDescription>
                )}
              </CardHeader>
              <CardContent>
                <p className="text-sm text-muted-foreground line-clamp-3">
                  {article.content?.slice(0, 150) || "Нет описания"}...
                </p>
                {article.tags && article.tags.length > 0 && (
                  <div className="flex flex-wrap gap-1 mt-4">
                    {article.tags.slice(0, 3).map((tag, i) => (
                      <span key={i} className="text-xs bg-muted px-2 py-1 rounded">
                        {tag}
                      </span>
                    ))}
                  </div>
                )}
              </CardContent>
            </Card>
          ))}
        </div>
      )}

      {/* Модал со статьёй */}
      {selectedArticle && fullArticle && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
          <div className="bg-background rounded-lg max-w-3xl w-full max-h-[80vh] overflow-y-auto">
            <div className="sticky top-0 flex items-center justify-between border-b p-4 bg-background">
              <h2 className="text-xl font-bold">{fullArticle.title}</h2>
              <Button variant="ghost" size="icon" onClick={() => setSelectedArticle(null)}>
                <X className="h-5 w-5" />
              </Button>
            </div>
            <div className="p-6 space-y-4">
              {fullArticle.category && (
                <p className="text-sm text-muted-foreground">Категория: {fullArticle.category}</p>
              )}
              {fullArticle.tags && fullArticle.tags.length > 0 && (
                <div className="flex flex-wrap gap-2">
                  {fullArticle.tags.map((tag, i) => (
                    <span key={i} className="text-xs bg-primary/10 text-primary px-2 py-1 rounded">
                      {tag}
                    </span>
                  ))}
                </div>
              )}
              <div className="prose max-w-none dark:prose-invert">
                <p className="whitespace-pre-wrap">{fullArticle.content}</p>
              </div>
              <div className="flex justify-end pt-4 border-t">
                <Button onClick={() => setSelectedArticle(null)}>Закрыть</Button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
