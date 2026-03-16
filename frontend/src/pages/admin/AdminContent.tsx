import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { toast } from "react-toastify";
import { apiClient } from "@/api/axios";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { Plus, Pencil, Trash2, X } from "lucide-react";

const articleSchema = z.object({
  title: z.string().min(1, "Заголовок обязателен"),
  slug: z.string().min(1, "Slug обязателен"),
  category: z.string().optional(),
  content: z.string().min(1, "Содержимое обязательно"),
  is_published: z.boolean().default(false),
});

type ArticleFormData = z.infer<typeof articleSchema>;
interface Article { id: number; title: string; slug: string; category?: string; is_published: boolean; created_at: string }

export const AdminContent = () => {
  const queryClient = useQueryClient();
  const [modalOpen, setModalOpen] = useState(false);
  const [editingArticle, setEditingArticle] = useState<Article | null>(null);

  const { data: articles } = useQuery<{ items: Article[]; total: number }>({ queryKey: ["admin-articles"], queryFn: () => apiClient.get("/articles?limit=100").then(r => r.data) });

  const createMutation = useMutation({
    mutationFn: (data: ArticleFormData) => apiClient.post("/articles", data),
    onSuccess: () => { queryClient.invalidateQueries({ queryKey: ["admin-articles"] }); toast.success("Статья создана"); setModalOpen(false); },
    onError: () => toast.error("Ошибка создания"),
  });

  const updateMutation = useMutation({
    mutationFn: ({ id, data }: { id: number; data: ArticleFormData }) => apiClient.put(`/articles/${id}`, data),
    onSuccess: () => { queryClient.invalidateQueries({ queryKey: ["admin-articles"] }); toast.success("Статья обновлена"); setModalOpen(false); setEditingArticle(null); },
    onError: () => toast.error("Ошибка обновления"),
  });

  const deleteMutation = useMutation({
    mutationFn: (id: number) => apiClient.delete(`/articles/${id}`),
    onSuccess: () => { queryClient.invalidateQueries({ queryKey: ["admin-articles"] }); toast.success("Статья удалена"); },
    onError: () => toast.error("Ошибка удаления"),
  });

  const { register, handleSubmit, reset, formState: { errors } } = useForm<ArticleFormData>({
    resolver: zodResolver(articleSchema),
    defaultValues: { title: "", slug: "", category: "", content: "", is_published: false },
  });

  const openCreate = () => { setEditingArticle(null); reset({ title: "", slug: "", category: "", content: "", is_published: false }); setModalOpen(true); };
  const openEdit = (article: Article) => { setEditingArticle(article); reset(article); setModalOpen(true); };

  const onSubmit = (data: ArticleFormData) => {
    if (editingArticle) updateMutation.mutate({ id: editingArticle.id, data });
    else createMutation.mutate(data);
  };

  const generateSlug = (title: string) => title.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/(^-|-$)/g, "");

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="text-3xl font-bold">Контент</h1>
        <Button onClick={openCreate}><Plus className="mr-2 h-4 w-4" /> Добавить статью</Button>
      </div>

      <Card>
        <CardContent className="p-0">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Заголовок</TableHead>
                <TableHead>Категория</TableHead>
                <TableHead>Статус</TableHead>
                <TableHead>Дата</TableHead>
                <TableHead></TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {articles?.items?.map((article) => (
                <TableRow key={article.id}>
                  <TableCell>
                    <div>
                      <p className="font-medium">{article.title}</p>
                      <p className="text-sm text-muted-foreground">{article.slug}</p>
                    </div>
                  </TableCell>
                  <TableCell><Badge variant="outline">{article.category || "—"}</Badge></TableCell>
                  <TableCell><Badge variant={article.is_published ? "success" : "secondary"}>{article.is_published ? "Опубликована" : "Черновик"}</Badge></TableCell>
                  <TableCell>{new Date(article.created_at).toLocaleDateString("ru-RU")}</TableCell>
                  <TableCell>
                    <div className="flex justify-end gap-1">
                      <Button variant="ghost" size="icon" onClick={() => openEdit(article)}><Pencil className="h-4 w-4" /></Button>
                      <Button variant="ghost" size="icon" onClick={() => { if (confirm("Удалить статью?")) deleteMutation.mutate(article.id); }}><Trash2 className="h-4 w-4 text-destructive" /></Button>
                    </div>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </CardContent>
      </Card>

      {/* Модал */}
      {modalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50">
          <div className="bg-background rounded-lg p-6 w-full max-w-2xl max-h-[90vh] overflow-y-auto">
            <div className="flex items-center justify-between mb-4">
              <h2 className="text-xl font-bold">{editingArticle ? "Редактировать статью" : "Новая статья"}</h2>
              <button onClick={() => setModalOpen(false)}><X className="h-5 w-5" /></button>
            </div>
            <form onSubmit={handleSubmit(onSubmit)} className="space-y-4">
              <div>
                <Label>Заголовок</Label>
                <Input {...register("title")} onChange={(e) => {
                  register("title").onChange(e);
                  const slugInput = document.getElementById("slug") as HTMLInputElement;
                  if (slugInput && !editingArticle) slugInput.value = generateSlug(e.target.value);
                }} />
                {errors.title && <p className="text-sm text-destructive">{errors.title.message}</p>}
              </div>
              <div>
                <Label>Slug (URL)</Label>
                <Input id="slug" {...register("slug")} />
                {errors.slug && <p className="text-sm text-destructive">{errors.slug.message}</p>}
              </div>
              <div>
                <Label>Категория</Label>
                <Input {...register("category")} placeholder="Например: технологии, материалы, FAQ" />
              </div>
              <div>
                <Label>Содержимое (Markdown)</Label>
                <textarea {...register("content")} className="flex min-h-[200px] w-full rounded-md border border-input bg-background px-3 py-2 text-sm font-mono" placeholder="# Заголовок&#10;&#10;Текст статьи..." />
                {errors.content && <p className="text-sm text-destructive">{errors.content.message}</p>}
              </div>
              <div className="flex items-center gap-2">
                <input type="checkbox" id="is_published" {...register("is_published")} className="h-4 w-4" />
                <Label htmlFor="is_published">Опубликовано</Label>
              </div>
              <div className="flex justify-end gap-2">
                <Button type="button" variant="outline" onClick={() => setModalOpen(false)}>Отмена</Button>
                <Button type="submit" disabled={createMutation.isPending || updateMutation.isPending}>{createMutation.isPending || updateMutation.isPending ? "Сохранение..." : "Сохранить"}</Button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};
