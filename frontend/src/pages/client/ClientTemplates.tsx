import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Plus, Edit, Trash2, FileText } from "lucide-react";

interface OrderTemplate {
  id: number;
  name: string;
  items: any[];
  notes?: string;
  created_at: string;
}

export const ClientTemplates = () => {
  const queryClient = useQueryClient();
  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const [editingId, setEditingId] = useState<number | null>(null);
  const [formData, setFormData] = useState({ name: '', items: [], notes: '' });

  const { data: templates } = useQuery<OrderTemplate[]>({
    queryKey: ['client-templates'],
    queryFn: async () => {
      const res = await fetch('/api/templates?page=1&limit=50');
      const data = await res.json();
      return data.items;
    },
  });

  const createMutation = useMutation({
    mutationFn: (data: typeof formData) => fetch('/api/templates', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(data),
    }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['client-templates'] });
      setIsDialogOpen(false);
      setFormData({ name: '', items: [], notes: '' });
    },
  });

  const deleteMutation = useMutation({
    mutationFn: (id: number) => fetch(`/api/templates/${id}`, { method: 'DELETE' }),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['client-templates'] }),
  });

  const openCreateDialog = () => {
    setEditingId(null);
    setFormData({ name: '', items: [], notes: '' });
    setIsDialogOpen(true);
  };

  const openEditDialog = (template: OrderTemplate) => {
    setEditingId(template.id);
    setFormData({
      name: template.name,
      items: template.items,
      notes: template.notes || '',
    });
    setIsDialogOpen(true);
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (editingId) {
      // Update
    } else {
      createMutation.mutate(formData);
    }
  };

  return (
    <div className="space-y-6">
      <div className="flex justify-between items-center">
        <h1 className="text-3xl font-bold">Шаблоны заказов</h1>
        <Dialog open={isDialogOpen} onOpenChange={setIsDialogOpen}>
          <DialogTrigger asChild>
            <Button>
              <Plus className="mr-2 h-4 w-4" />
              Новый шаблон
            </Button>
          </DialogTrigger>
          <DialogContent className="max-w-2xl">
            <DialogHeader>
              <DialogTitle>{editingId ? 'Редактировать шаблон' : 'Новый шаблон'}</DialogTitle>
            </DialogHeader>
            <form onSubmit={handleSubmit} className="space-y-4">
              <div>
                <Label>Название</Label>
                <Input value={formData.name} onChange={(e) => setFormData({...formData, name: e.target.value})} />
              </div>
              <div>
                <Label>Услуги (JSON)</Label>
                <Input value={JSON.stringify(formData.items, null, 2)} onChange={(e) => setFormData({...formData, items: JSON.parse(e.target.value || '[]')})} />
              </div>
              <div>
                <Label>Примечания</Label>
                <Input value={formData.notes} onChange={(e) => setFormData({...formData, notes: e.target.value})} />
              </div>
              <div className="flex justify-end gap-2">
                <Button type="button" variant="outline" onClick={() => setIsDialogOpen(false)}>
                  Отмена
                </Button>
                <Button type="submit">Сохранить</Button>
              </div>
            </form>
          </DialogContent>
        </Dialog>
      </div>

      <Card>
        <CardContent className="pt-6">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Название</TableHead>
                <TableHead>Услуг</TableHead>
                <TableHead>Создан</TableHead>
                <TableHead>Действия</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {templates?.map((template) => (
                <TableRow key={template.id}>
                  <TableCell>{template.name}</TableCell>
                  <TableCell>{template.items.length}</TableCell>
                  <TableCell>{new Date(template.created_at).toLocaleDateString("ru-RU")}</TableCell>
                  <TableCell className="space-x-2">
                    <Button variant="ghost" size="icon" onClick={() => openEditDialog(template)}>
                      <Edit className="h-4 w-4" />
                    </Button>
                    <Button variant="ghost" size="icon" onClick={() => deleteMutation.mutate(template.id)}>
                      <Trash2 className="h-4 w-4" />
                    </Button>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </CardContent>
      </Card>
    </div>
  );
};

