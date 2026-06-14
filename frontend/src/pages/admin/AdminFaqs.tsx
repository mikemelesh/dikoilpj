import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { toast } from "react-toastify";
import { mutationOnError } from "@/lib/apiError";
import { apiClient } from "@/api/axios";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Switch } from "@/components/ui/switch";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Badge } from "@/components/ui/badge";
import { Plus, Edit, Trash2, Eye, Download } from "lucide-react";
import { ExportButton } from "@/components/shared/ExportButton";

interface FaqItem {
  id: number;
  question: string;
  answer: string;
  category?: string;
  sort_order: number;
  is_published: boolean;
  created_at: string;
  updated_at: string;
}

const faqSchema = z.object({
  question: z.string().min(1, "Вопрос обязателен").max(500, "Максимум 500 символов"),
  answer: z.string().min(1, "Ответ обязателен").max(5000, "Максимум 5000 символов"),
  category: z.string().optional(),
  sort_order: z.number().min(0).default(0),
  is_published: z.boolean().default(true),
});

type FaqFormData = z.infer<typeof faqSchema>;

export const AdminFaqs = () => {
  const queryClient = useQueryClient();
  const [editingFaq, setEditingFaq] = useState<FaqItem | null>(null);
  const [isDialogOpen, setIsDialogOpen] = useState(false);

  const [sortBy, setSortBy] = useState<"sort_order" | "question" | "category" | "is_published" | "created_at">("sort_order");
  const [sortDir, setSortDir] = useState<"asc" | "desc">("asc");

  const toggleSort = (nextSortBy: typeof sortBy) => {
    setSortBy((prevSortBy) => {
      const isSame = prevSortBy === nextSortBy;
      setSortDir((prevDir) => {
        if (!isSame) return "asc";
        return prevDir === "asc" ? "desc" : "asc";
      });
      return isSame ? prevSortBy : nextSortBy;
    });
  };

  const { data: faqs = [] } = useQuery<FaqItem[]>({
    queryKey: ["admin-faqs", sortBy, sortDir],
    queryFn: () => {
      const params = new URLSearchParams({
        sort_by: sortBy,
        sort_dir: sortDir,
      });
      return apiClient.get(`/faq?${params}`).then((r) => r.data);
    },
  });

  const createMutation = useMutation({
    mutationFn: (data: FaqFormData) => apiClient.post("/faq", data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["admin-faqs"] });
      toast.success("FAQ создан");
      setIsDialogOpen(false);
      reset();
    },
    onError: mutationOnError("Ошибка создания FAQ"),
  });

  const updateMutation = useMutation({
    mutationFn: ({ id, data }: { id: number; data: Partial<FaqFormData> }) =>
      apiClient.put(`/faq/${id}`, data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["admin-faqs"] });
      toast.success("FAQ обновлён");
      setIsDialogOpen(false);
      setEditingFaq(null);
      reset();
    },
    onError: mutationOnError("Ошибка обновления FAQ"),
  });

  const deleteMutation = useMutation({
    mutationFn: (id: number) => apiClient.delete(`/faq/${id}`),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["admin-faqs"] });
      toast.success("FAQ удалён");
    },
    onError: mutationOnError("Ошибка удаления FAQ"),
  });

  const { register, handleSubmit, reset, watch, setValue } = useForm<FaqFormData>({
    resolver: zodResolver(faqSchema),
    defaultValues: {
      question: "",
      answer: "",
      category: "",
      sort_order: 0,
      is_published: true,
    },
  });

  const openCreateDialog = () => {
    setEditingFaq(null);
    reset({
      question: "",
      answer: "",
      category: "",
      sort_order: 0,
      is_published: true,
    });
    setIsDialogOpen(true);
  };

  const openEditDialog = (faq: FaqItem) => {
    setEditingFaq(faq);
    reset({
      question: faq.question,
      answer: faq.answer,
      category: faq.category || "",
      sort_order: faq.sort_order,
      is_published: faq.is_published,
    });
    setIsDialogOpen(true);
  };

  const onSubmit = (data: FaqFormData) => {
    if (editingFaq) {
      updateMutation.mutate({ id: editingFaq.id, data });
    } else {
      createMutation.mutate(data);
    }
  };

  return (
    <div className="space-y-6">
      <div className="flex justify-between items-center">
        <h1 className="text-3xl font-bold">FAQ</h1>
        <div className="flex space-x-2">
          <ExportButton resource="faqs" title="Часто задаваемые вопросы" />
          <Dialog open={isDialogOpen} onOpenChange={setIsDialogOpen}>
            <DialogTrigger asChild>
              <Button><Plus className="mr-2 h-4 w-4" /> Добавить</Button>
            </DialogTrigger>
            <DialogContent className="max-w-3xl max-h-[90vh] overflow-y-auto">
              <CreateEditFaqForm
                defaultValues={editingFaq || { question: "", answer: "", category: "", sort_order: 0, is_published: true }}
                onSubmit={onSubmit}
                onCancel={() => { setIsDialogOpen(false); setEditingFaq(null); }}
              />
            </DialogContent>
          </Dialog>
        </div>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Список FAQ</CardTitle>
          <CardDescription>
            Найдено: {faqs.length}
          </CardDescription>
        </CardHeader>
        <CardContent>
          {faqs.length === 0 ? (
            <p className="text-center text-muted-foreground py-8">FAQ не найдены</p>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead
                    className="w-12 cursor-pointer select-none"
                    onClick={() => toggleSort("sort_order")}
                  >
                    №{sortBy === "sort_order" ? (sortDir === "asc" ? " ▲" : " ▼") : ""}
                  </TableHead>

                  <TableHead
                    className="cursor-pointer select-none"
                    onClick={() => toggleSort("question")}
                  >
                    Вопрос{sortBy === "question" ? (sortDir === "asc" ? " ▲" : " ▼") : ""}
                  </TableHead>

                  <TableHead
                    className="cursor-pointer select-none"
                    onClick={() => toggleSort("category")}
                  >
                    Категория{sortBy === "category" ? (sortDir === "asc" ? " ▲" : " ▼") : ""}
                  </TableHead>

                  <TableHead
                    className="cursor-pointer select-none"
                    onClick={() => toggleSort("is_published")}
                  >
                    Статус{sortBy === "is_published" ? (sortDir === "asc" ? " ▲" : " ▼") : ""}
                  </TableHead>

                  <TableHead className="text-right">Действия</TableHead>
                </TableRow>
              </TableHeader>

              <TableBody>
                {faqs.map((faq) => (
                  <TableRow key={faq.id}>
                    <TableCell className="text-muted-foreground">{faq.sort_order}</TableCell>
                    <TableCell className="font-medium">{faq.question}</TableCell>
                    <TableCell>
                      {faq.category ? (
                        <Badge variant="outline">{faq.category}</Badge>
                      ) : (
                        <span className="text-muted-foreground">—</span>
                      )}
                    </TableCell>
                    <TableCell>
                      <Badge variant={faq.is_published ? "default" : "secondary"}>
                        {faq.is_published ? "Опубликован" : "Черновик"}
                      </Badge>
                    </TableCell>
                    <TableCell className="text-right">
                      <div className="flex justify-end gap-2">
                        <Button variant="ghost" size="icon" onClick={() => openEditDialog(faq)}>
                          <Edit className="h-4 w-4" />
                        </Button>
                        <Button
                          variant="ghost"
                          size="icon"
                          onClick={() => deleteMutation.mutate(faq.id)}
                        >
                          <Trash2 className="h-4 w-4 text-destructive" />
                        </Button>
                      </div>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>

    </div>
  );
};

const CreateEditFaqForm = ({ defaultValues, onSubmit, onCancel }: { 
  defaultValues: Partial<FaqItem> | { question: string; answer: string; category: string; sort_order: number; is_published: boolean };
  onSubmit: (data: FaqFormData) => void;
  onCancel: () => void;
}) => {
  const { register, handleSubmit, formState: { errors }, setValue, watch } = useForm<FaqFormData>({
    resolver: zodResolver(faqSchema),
    defaultValues: {
      question: defaultValues.question || "",
      answer: defaultValues.answer || "",
      category: defaultValues.category || "",
      sort_order: defaultValues.sort_order || 0,
      is_published: defaultValues.is_published || false,
    }
  });

  const isPublished = watch('is_published');

  return (
    <form onSubmit={handleSubmit(onSubmit)} className="space-y-4">
      <DialogHeader>
        <DialogTitle>{defaultValues.id ? "Редактировать FAQ" : "Добавить FAQ"}</DialogTitle>
      </DialogHeader>
      
      <div className="space-y-4">
        <div>
          <Label htmlFor="question">Вопрос *</Label>
          <Input
            id="question"
            {...register('question')}
          />
          {errors.question && <p className="text-destructive text-sm mt-1">{errors.question.message}</p>}
        </div>
        
        <div>
          <Label htmlFor="answer">Ответ *</Label>
          <Textarea
            id="answer"
            {...register('answer')}
            rows={4}
          />
          {errors.answer && <p className="text-destructive text-sm mt-1">{errors.answer.message}</p>}
        </div>
        
        <div>
          <Label htmlFor="category">Категория</Label>
          <Input
            id="category"
            {...register('category')}
          />
        </div>
        
        <div className="grid grid-cols-2 gap-4">
          <div>
            <Label htmlFor="sort_order">Порядок сортировки</Label>
            <Input
              id="sort_order"
              type="number"
              {...register('sort_order', { valueAsNumber: true })}
            />
          </div>
          
          <div className="flex items-center pt-6">
            <Switch
              id="is_published"
              checked={isPublished}
              onCheckedChange={(checked) => setValue('is_published', checked, { shouldDirty: true })}
            />
            <Label htmlFor="is_published" className="ml-2">Опубликован</Label>
          </div>
        </div>
      </div>
      
      <div className="flex justify-end gap-2 pt-4">
        <Button type="button" variant="outline" onClick={onCancel}>Отмена</Button>
        <Button type="submit">Сохранить</Button>
      </div>
    </form>
  );
};
