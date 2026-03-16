import { useEffect, useState } from "react";

import { apiClient } from "@/api/axios";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
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
    <div className="container mx-auto max-w-3xl px-4 py-8">
      <h1 className="mb-8 text-3xl font-bold">Часто задаваемые вопросы</h1>
      <div className="space-y-4">
        {faqs.map((faq, index) => (
          <Card key={index}>
            <CardHeader>
              <CardTitle className="text-lg">{faq.question}</CardTitle>
            </CardHeader>
            <CardContent>
              <p className="text-muted-foreground whitespace-pre-wrap">{faq.answer}</p>
            </CardContent>
          </Card>
        ))}
      </div>
    </div>
  );
};
