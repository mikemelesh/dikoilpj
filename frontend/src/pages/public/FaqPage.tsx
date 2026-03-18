import { useEffect, useState } from "react";

import { apiClient } from "@/api/axios";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { PublicLayout } from "@/components/layout/PublicLayout";
import type { Article } from "@/types";
import { toast } from "react-toastify";

interface FaqItem {
  question: string;
  answer: string;
}

export const FaqPage = () => {
  const [faqs, setFaqs] = useState<FaqItem[]>([]);

  useEffect(() => {
    apiClient.get<{ items: Article[] }>(`/articles?category=faq&limit=50`)
      .then((res) => {
        const items = res.data.items.map((article) => ({
          question: article.title,
          answer: article.content,
        }));
        setFaqs(items);
      })
      .catch(() => toast.error("Ошибка загрузки FAQ"));
  }, []);

  return (
    <PublicLayout title="Часто задаваемые вопросы">
      <div className="space-y-4">
        {faqs.length === 0 ? (
          <Card>
            <CardContent className="py-12 text-center text-muted-foreground">
              Вопросы не найдены
            </CardContent>
          </Card>
        ) : (
          faqs.map((faq, index) => (
            <Card key={index}>
              <CardHeader>
                <CardTitle className="text-lg">{faq.question}</CardTitle>
              </CardHeader>
              <CardContent>
                <p className="text-muted-foreground whitespace-pre-wrap">{faq.answer}</p>
              </CardContent>
            </Card>
          ))
        )}
      </div>
    </PublicLayout>
  );
};
