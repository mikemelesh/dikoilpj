import { useEffect, useState } from "react";

import { apiClient } from "@/api/axios";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { PublicLayout } from "@/components/layout/PublicLayout";
import { toast } from "react-toastify";

interface FaqItem {
  id: number;
  question: string;
  answer: string;
  category?: string;
}

export const FaqPage = () => {
  const [faqs, setFaqs] = useState<FaqItem[]>([]);

  useEffect(() => {
    apiClient.get<FaqItem[]>("/faq")
      .then((res) => {
        setFaqs(res.data);
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
          faqs.map((faq) => (
            <Card key={faq.id}>
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
