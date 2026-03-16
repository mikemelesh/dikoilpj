import { useEffect, useState } from "react";
import { useParams, Link } from "react-router-dom";
import ReactMarkdown from "react-markdown";

import { apiClient } from "@/api/axios";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import type { Article } from "@/types";
import { ArrowLeft } from "lucide-react";
import { toast } from "react-toastify";

export const ArticleDetailPage = () => {
  const { slug } = useParams<{ slug: string }>();
  const [article, setArticle] = useState<Article | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    if (!slug) return;
    apiClient.get<Article>(`/articles/${slug}`)
      .then((res) => setArticle(res.data))
      .catch(() => toast.error("Статья не найдена"))
      .finally(() => setIsLoading(false));
  }, [slug]);

  if (isLoading) return <div className="p-8 text-center">Загрузка...</div>;
  if (!article) return <div className="p-8 text-center">Статья не найдена</div>;

  return (
    <div className="container mx-auto max-w-3xl px-4 py-8">
      <Link to="/articles">
        <Button variant="ghost" className="mb-4">
          <ArrowLeft className="mr-2 h-4 w-4" />
          Назад к статьям
        </Button>
      </Link>
      <Card>
        <CardHeader>
          <CardTitle className="text-3xl">{article.title}</CardTitle>
          {article.category && (
            <p className="text-sm text-muted-foreground">Категория: {article.category}</p>
          )}
        </CardHeader>
        <CardContent className="prose prose-sm max-w-none dark:prose-invert">
          <ReactMarkdown>{article.content}</ReactMarkdown>
        </CardContent>
      </Card>
    </div>
  );
};
