import { useEffect, useState } from "react";
import { Link } from "react-router-dom";

import { apiClient } from "@/api/axios";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { SearchAndFilter, type FilterConfig } from "@/components/shared/SearchAndFilter";
import { Pagination } from "@/components/shared/Pagination";
import { PublicLayout } from "@/components/layout/PublicLayout";
import type { Article } from "@/types";
import { toast } from "react-toastify";

export const ArticlesPage = () => {
  const [articles, setArticles] = useState<Article[]>([]);
  const [total, setTotal] = useState(0);
  const [page, setPage] = useState(1);
  const [search, setSearch] = useState("");
  const [category, setCategory] = useState("");
  const limit = 10;

  useEffect(() => {
    const params = new URLSearchParams({ page: String(page), limit: String(limit) });
    if (search) params.append("search", search);
    if (category) params.append("category", category);

    apiClient.get<{ items: Article[]; total: number }>(`/articles?${params}`)
      .then((res) => { setArticles(res.data.items); setTotal(res.data.total); })
      .catch(() => toast.error("Ошибка загрузки"));
  }, [page, search, category]);

  const filters: FilterConfig[] = [
    { key: "category", label: "Категория", type: "select", options: [
      { value: "technology", label: "Технологии" },
      { value: "materials", label: "Материалы" },
      { value: "faq", label: "FAQ" },
    ]},
  ];

  return (
    <PublicLayout title="Статьи">
      <SearchAndFilter
        onSearch={setSearch}
        onFilter={(f) => setCategory(f.category || "")}
        filters={filters}
      />
      <div className="mt-6 grid gap-6 md:grid-cols-2">
        {articles.length === 0 ? (
          <div className="col-span-full text-center py-12">
            <p className="text-muted-foreground">Статьи не найдены</p>
          </div>
        ) : (
          articles.map((article) => (
            <Link key={article.id} to={`/articles/${article.slug}`}>
              <Card className="transition-shadow hover:shadow-lg">
                <CardHeader>
                  <CardTitle>{article.title}</CardTitle>
                  {article.category && (
                    <CardDescription>Категория: {article.category}</CardDescription>
                  )}
                </CardHeader>
                <CardContent>
                  <p className="text-sm text-muted-foreground line-clamp-3">
                    {article.content.slice(0, 200)}...
                  </p>
                  <p className="mt-4 text-xs text-muted-foreground">
                    {new Date(article.created_at).toLocaleDateString('ru-RU')}
                  </p>
                </CardContent>
              </Card>
            </Link>
          ))
        )}
      </div>
      {total > 0 && (
        <div className="mt-8">
          <Pagination total={total} page={page} limit={limit} onPageChange={setPage} />
        </div>
      )}
    </PublicLayout>
  );
};
