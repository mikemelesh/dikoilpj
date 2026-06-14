import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { toast } from "react-toastify";
import { mutationOnError } from "@/lib/apiError";
import { Plus, Pencil, Trash2 } from "lucide-react";

import { getClients, getServices } from "@/api/manager";
import {
  createTemplate,
  deleteTemplate,
  getTemplates,
  updateTemplate,
  type OrderTemplate,
  type OrderTemplateItem,
} from "@/api/templates";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { formatDate } from "@/utils";

const emptyItem = (): OrderTemplateItem => ({ service_id: 0, quantity: 1 });

export const ManagerTemplates = () => {
  const queryClient = useQueryClient();
  const [clientFilter, setClientFilter] = useState<string>("");
  const [modalOpen, setModalOpen] = useState(false);
  const [editingTemplate, setEditingTemplate] = useState<OrderTemplate | null>(null);
  const [formData, setFormData] = useState({
    client_id: 0,
    name: "",
    notes: "",
    items: [emptyItem()] as OrderTemplateItem[],
  });

  const selectedClientId = clientFilter ? Number(clientFilter) : undefined;

  const { data: clientsData } = useQuery({
    queryKey: ["manager-clients-all"],
    queryFn: () => getClients({ page: 1, limit: 200 }),
  });

  const { data: servicesData } = useQuery({
    queryKey: ["manager-services"],
    queryFn: () => getServices({ limit: 200, is_active: true }),
  });

  const { data: templatesData, isLoading } = useQuery({
    queryKey: ["manager-templates", selectedClientId],
    queryFn: () => getTemplates({ page: 1, limit: 100, client_id: selectedClientId }),
  });

  const clients = clientsData?.items || [];
  const services = servicesData?.items || [];
  const templates = templatesData?.items || [];

  const resetForm = (clientId = 0) => {
    setFormData({
      client_id: clientId,
      name: "",
      notes: "",
      items: [emptyItem()],
    });
  };

  const openCreate = () => {
    setEditingTemplate(null);
    resetForm(selectedClientId ?? 0);
    setModalOpen(true);
  };

  const openEdit = (template: OrderTemplate) => {
    setEditingTemplate(template);
    setFormData({
      client_id: template.client_id,
      name: template.name,
      notes: template.notes || "",
      items: template.items.length > 0 ? template.items.map((item) => ({ ...item })) : [emptyItem()],
    });
    setModalOpen(true);
  };

  const createMutation = useMutation({
    mutationFn: createTemplate,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["manager-templates"] });
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
      queryClient.invalidateQueries({ queryKey: ["manager-templates"] });
      toast.success("Шаблон обновлён");
      setModalOpen(false);
      setEditingTemplate(null);
      resetForm();
    },
    onError: mutationOnError("Ошибка обновления шаблона"),
  });

  const deleteMutation = useMutation({
    mutationFn: ({ id, clientId }: { id: number; clientId: number }) => deleteTemplate(id, clientId),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["manager-templates"] });
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

    if (!formData.client_id) {
      toast.error("Выберите клиента");
      return;
    }
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
      client_id: formData.client_id,
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

  const clientLabel = (clientId: number) => {
    const client = clients.find((item) => item.id === clientId);
    if (!client) return `Клиент #${clientId}`;
    const name = `${client.first_name || ""} ${client.last_name || ""}`.trim();
    return client.clinic_name ? `${name} (${client.clinic_name})` : name;
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
        <CardHeader>
          <CardTitle>Фильтр</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="max-w-md">
            <Label>Клиент</Label>
            <Select value={clientFilter || "all"} onValueChange={(value) => setClientFilter(value === "all" ? "" : value)}>
              <SelectTrigger>
                <SelectValue placeholder="Все клиенты" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">Все клиенты</SelectItem>
                {clients.map((client) => (
                  <SelectItem key={client.id} value={String(client.id)}>
                    {clientLabel(client.id)}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        </CardContent>
      </Card>

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
                  <TableHead>Клиент</TableHead>
                  <TableHead>Услуг</TableHead>
                  <TableHead>Создан</TableHead>
                  <TableHead></TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {templates.map((template) => (
                  <TableRow key={template.id}>
                    <TableCell className="font-medium">{template.name}</TableCell>
                    <TableCell>{template.client_name || clientLabel(template.client_id)}</TableCell>
                    <TableCell>{template.items.length}</TableCell>
                    <TableCell>{formatDate(template.created_at)}</TableCell>
                    <TableCell className="space-x-2">
                      <Button variant="ghost" size="icon" onClick={() => openEdit(template)}>
                        <Pencil className="h-4 w-4" />
                      </Button>
                      <Button
                        variant="ghost"
                        size="icon"
                        onClick={() => {
                          if (window.confirm(`Удалить шаблон «${template.name}»?`)) {
                            deleteMutation.mutate({ id: template.id, clientId: template.client_id });
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
            <CardHeader>
              <CardTitle>{editingTemplate ? "Редактировать шаблон" : "Новый шаблон"}</CardTitle>
            </CardHeader>
            <CardContent>
              <form onSubmit={handleSubmit} className="space-y-4">
                <div>
                  <Label>Клиент *</Label>
                  <Select
                    value={formData.client_id ? String(formData.client_id) : ""}
                    onValueChange={(value) => setFormData((prev) => ({ ...prev, client_id: Number(value) }))}
                    disabled={Boolean(editingTemplate)}
                  >
                    <SelectTrigger>
                      <SelectValue placeholder="Выберите клиента" />
                    </SelectTrigger>
                    <SelectContent>
                      {clients.map((client) => (
                        <SelectItem key={client.id} value={String(client.id)}>
                          {clientLabel(client.id)}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>

                <div>
                  <Label>Название *</Label>
                  <Input
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
                        <Select
                          value={item.service_id ? String(item.service_id) : ""}
                          onValueChange={(value) => updateItem(index, { service_id: Number(value) })}
                        >
                          <SelectTrigger>
                            <SelectValue placeholder="Выберите услугу" />
                          </SelectTrigger>
                          <SelectContent>
                            {services.map((service) => (
                              <SelectItem key={service.id} value={String(service.id)}>
                                {service.name}
                              </SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
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
                  <Label>Примечания</Label>
                  <Textarea
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
