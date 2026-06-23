import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { toast } from "react-toastify";
import { mutationOnError } from "@/lib/apiError";
import { Plus, Pencil, Trash2, FileText } from "lucide-react";

import { apiClient } from "@/api/axios";
import {
  createTemplate,
  deleteTemplate,
  getTemplates,
  updateTemplate,
  type OrderTemplate,
  type OrderTemplateItem,
} from "@/api/templates";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { formatDate } from "@/utils";
import type { Service } from "@/types";

const emptyItem = (): OrderTemplateItem => ({ service_id: 0, quantity: 1 });

export const ClientTemplates = () => {
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const [modalOpen, setModalOpen] = useState(false);
  const [editingTemplate, setEditingTemplate] = useState<OrderTemplate | null>(null);
  const [formData, setFormData] = useState({
    name: "",
    notes: "",
    items: [emptyItem()] as OrderTemplateItem[],
  });

  const { data: servicesData } = useQuery({
    queryKey: ["client-services"],
    queryFn: async () => {
      const res = await apiClient.get<{ items: Service[] }>("/services?limit=200&is_active=true");
      return res.data;
    },
  });

  const { data: templatesData, isLoading } = useQuery({
    queryKey: ["client-templates"],
    queryFn: () => getTemplates({ page: 1, limit: 100 }),
  });

  const services = servicesData?.items || [];
  const templates = templatesData?.items || [];

  const resetForm = () => {
    setFormData({
      name: "",
      notes: "",
      items: [emptyItem()],
    });
  };

  const openCreate = () => {
    setEditingTemplate(null);
    resetForm();
    setModalOpen(true);
  };

  const openEdit = (template: OrderTemplate) => {
    setEditingTemplate(template);
    setFormData({
      name: template.name,
      notes: template.notes || "",
      items: template.items.length > 0 ? template.items.map((item) => ({ ...item })) : [emptyItem()],
    });
    setModalOpen(true);
  };

  const createMutation = useMutation({
    mutationFn: createTemplate,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["client-templates"] });
      toast.success("Шаблон создан");
      setModalOpen(false);
      resetForm();
    },
    onError: mutationOnError("Ошибка создания шаблона"),
  });

  const updateMutation = useMutation({
    mutationFn: ({ id, data }: { id: number; data: Parameters<typeof updateTemplate>[1] }) =>
      updateTemplate(id, data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["client-templates"] });
      toast.success("Шаблон обновлён");
      setModalOpen(false);
      setEditingTemplate(null);
      resetForm();
    },
    onError: mutationOnError("Ошибка обновления шаблона"),
  });

  const deleteMutation = useMutation({
    mutationFn: (id: number) => deleteTemplate(id),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["client-templates"] });
      toast.success("Шаблон удалён");
    },
    onError: mutationOnError("Ошибка удаления шаблона"),
  });

  const updateItem = (index: number, patch: Partial<OrderTemplateItem>) => {
    setFormData((prev) => ({
      ...prev,
      items: prev.items.map((item, i) => (i === index ? { ...item, ...patch } : item)),
    }));
  };

  const addItem = () => {
    setFormData((prev) => ({ ...prev, items: [...prev.items, emptyItem()] }));
  };

  const removeItem = (index: number) => {
    setFormData((prev) => ({
      ...prev,
      items: prev.items.length > 1 ? prev.items.filter((_, i) => i !== index) : prev.items,
    }));
  };

  const handleSubmit = (event: React.FormEvent) => {
    event.preventDefault();

    if (!formData.name.trim()) {
      toast.error("Укажите название шаблона");
      return;
    }

    const validItems = formData.items.filter((item) => item.service_id > 0);
    if (validItems.length === 0) {
      toast.error("Добавьте хотя бы одну услугу");
      return;
    }

    const payload = {
      name: formData.name.trim(),
      notes: formData.notes.trim() || undefined,
      items: validItems,
    };

    if (editingTemplate) {
      updateMutation.mutate({ id: editingTemplate.id, data: payload });
    } else {
      createMutation.mutate(payload);
    }
  };

  const applyTemplate = (template: OrderTemplate) => {
    navigate("/client/orders/new", { state: { template } });
  };

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-4">
        <h1 className="text-3xl font-bold">Шаблоны заказов</h1>
        <Button onClick={openCreate}>
          <Plus className="mr-2 h-4 w-4" />
          Новый шаблон
        </Button>
      </div>

      <Card>
        <CardContent className="pt-6">
          {isLoading ? (
            <p className="text-muted-foreground">Загрузка...</p>
          ) : templates.length === 0 ? (
            <p className="text-muted-foreground">Шаблоны не найдены</p>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Название</TableHead>
                  <TableHead>Услуг</TableHead>
                  <TableHead>Создан</TableHead>
                  <TableHead></TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {templates.map((template) => (
                  <TableRow key={template.id}>
                    <TableCell className="font-medium">{template.name}</TableCell>
                    <TableCell>{template.items.length}</TableCell>
                    <TableCell>{formatDate(template.created_at)}</TableCell>
                    <TableCell className="space-x-2">
                      <Button variant="outline" size="sm" onClick={() => applyTemplate(template)}>
                        <FileText className="mr-1 h-4 w-4" />
                        Применить
                      </Button>
                      <Button variant="ghost" size="icon" onClick={() => openEdit(template)}>
                        <Pencil className="h-4 w-4" />
                      </Button>
                      <Button
                        variant="ghost"
                        size="icon"
                        onClick={() => {
                          if (window.confirm(`Удалить шаблон «${template.name}»?`)) {
                            deleteMutation.mutate(template.id);
                          }
                        }}
                      >
                        <Trash2 className="h-4 w-4" />
                      </Button>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>

      {modalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
          <Card className="w-full max-w-2xl max-h-[90vh] overflow-y-auto">
            <CardContent className="pt-6">
              <h2 className="mb-4 text-xl font-semibold">
                {editingTemplate ? "Редактировать шаблон" : "Новый шаблон"}
              </h2>
              <form onSubmit={handleSubmit} className="space-y-4">
                <div>
                  <Label htmlFor="template-name">Название *</Label>
                  <Input
                    id="template-name"
                    value={formData.name}
                    onChange={(event) => setFormData((prev) => ({ ...prev, name: event.target.value }))}
                  />
                </div>

                <div className="space-y-3">
                  <div className="flex items-center justify-between">
                    <Label>Услуги *</Label>
                    <Button type="button" variant="outline" size="sm" onClick={addItem}>
                      Добавить услугу
                    </Button>
                  </div>
                  {formData.items.map((item, index) => (
                    <div key={index} className="grid grid-cols-1 md:grid-cols-[1fr_120px_auto] gap-2 items-end">
                      <div>
                        <Label className="text-xs text-muted-foreground">Услуга</Label>
                        <select
                          value={item.service_id || ""}
                          onChange={(event) =>
                            updateItem(index, {
                              service_id: event.target.value ? Number(event.target.value) : 0,
                            })
                          }
                          className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
                        >
                          <option value="">Выберите услугу</option>
                          {services.map((service) => (
                            <option key={service.id} value={String(service.id)}>
                              {service.name}
                            </option>
                          ))}
                        </select>
                      </div>
                      <div>
                        <Label className="text-xs text-muted-foreground">Кол-во</Label>
                        <Input
                          type="number"
                          min={1}
                          value={item.quantity}
                          onChange={(event) =>
                            updateItem(index, { quantity: Math.max(1, Number(event.target.value) || 1) })
                          }
                        />
                      </div>
                      <Button type="button" variant="outline" onClick={() => removeItem(index)}>
                        Удалить
                      </Button>
                    </div>
                  ))}
                </div>

                <div>
                  <Label htmlFor="template-notes">Примечания</Label>
                  <Textarea
                    id="template-notes"
                    value={formData.notes}
                    onChange={(event) => setFormData((prev) => ({ ...prev, notes: event.target.value }))}
                  />
                </div>

                <div className="flex justify-end gap-2">
                  <Button type="button" variant="outline" onClick={() => setModalOpen(false)}>
                    Отмена
                  </Button>
                  <Button type="submit" disabled={createMutation.isPending || updateMutation.isPending}>
                    {createMutation.isPending || updateMutation.isPending ? "Сохранение..." : "Сохранить"}
                  </Button>
                </div>
              </form>
            </CardContent>
          </Card>
        </div>
      )}
    </div>
  );
};
