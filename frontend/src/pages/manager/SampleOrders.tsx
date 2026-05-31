import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { toast } from "react-toastify";

import { getOrders, createOrder, assignTechnician } from "@/api/orders";
import { getClients, getTechnicians } from "@/api/manager";
import { getUsers } from "@/api/auth"; // Importing from auth API
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { apiClient } from "@/api/axios";

const clientSchema = z.object({
  first_name: z.string().min(1, "Имя обязательно"),
  last_name: z.string().min(1, "Фамилия обязательна"),
  email: z.string().email("Некорректный email"),
  phone: z.string().optional(),
});

const technicianSchema = z.object({
  technician_id: z.number().positive("Зуботехник обязателен"),
});

const orderSchema = z.object({
  client_id: z.number().positive("Клиент обязателен"),
  technician_id: z.number().optional(),
  notes: z.string().optional(),
  deadline: z.string().optional(),
  priority: z.enum(["normal", "urgent", "critical"]).default("normal"),
});

type ClientFormData = z.infer<typeof clientSchema>;
type TechnicianFormData = z.infer<typeof technicianSchema>;
type OrderFormData = z.infer<typeof orderSchema>;

export const SampleOrders = () => {
  const queryClient = useQueryClient();
  const [activeTab, setActiveTab] = useState("orders");

  // Forms
  const { register: registerClient, handleSubmit: handleSubmitClient, formState: { errors: clientErrors }, reset: resetClient, setValue: setClientValue } = useForm<ClientFormData>({
    resolver: zodResolver(clientSchema),
  });

  const { register: registerTechnician, handleSubmit: handleSubmitTechnician, formState: { errors: technicianErrors }, setValue: setTechnicianValue } = useForm<TechnicianFormData>({
    resolver: zodResolver(technicianSchema),
  });

  const { register: registerOrder, handleSubmit: handleSubmitOrder, formState: { errors: orderErrors }, reset: resetOrder, setValue: setOrderValue } = useForm<OrderFormData>({
    resolver: zodResolver(orderSchema),
  });

  // Queries
  const { data: clients } = useQuery({
    queryKey: ["manager-clients"],
    queryFn: () => getClients({ page: 1, limit: 100 }),
  });

  const { data: technicians } = useQuery({
    queryKey: ["technicians"],
    queryFn: () => getTechnicians(), // Remove parameters since getTechnicians doesn't accept any
  });

  const { data: managers } = useQuery({
    queryKey: ["managers"],
    queryFn: () => getUsers({ role: "manager", page: 1, limit: 100 }).then(res => res.items),
  });

  // Mutations
  const createClientMutation = useMutation({
    mutationFn: (data: ClientFormData) => apiClient.post("/auth/register", {
      ...data,
      password: "TempPass123!",
      client_type: "physical"
    }),
    onSuccess: () => {
      toast.success("Клиент успешно добавлен");
      resetClient();
      queryClient.invalidateQueries({ queryKey: ["manager-clients"] });
    },
    onError: (err: any) => {
      console.error("Error creating client:", err);
      toast.error(err.response?.data?.detail || "Ошибка при добавлении клиента");
    }
  });

  const assignTechnicianMutation = useMutation({
    mutationFn: ({ orderId, technicianId }: { orderId: string; technicianId: number }) => 
      assignTechnician(orderId, technicianId),
    onSuccess: () => {
      toast.success("Зуботехник успешно назначен");
      queryClient.invalidateQueries({ queryKey: ["manager-orders"] });
    },
    onError: (err: any) => {
      console.error("Error assigning technician:", err);
      toast.error(err.response?.data?.detail || "Ошибка при назначении зуботехника");
    }
  });

  const createOrderMutation = useMutation({
    mutationFn: (data: OrderFormData) => {
      // Create a sample order with minimal required data
      return createOrder({
        items: [{ service_id: 1, quantity: 1, specifications: {} }],
        notes: data.notes,
        deadline: data.deadline,
        priority: data.priority
      })
    },
    onSuccess: (response) => {
      toast.success("Заказ успешно создан");
      resetOrder();
      
      // If technician is assigned, update the order
      if(response.id && registerOrder("technician_id").ref?.value) {
        assignTechnicianMutation.mutate({
          orderId: response.id,
          technicianId: parseInt(registerOrder("technician_id").ref?.value)
        });
      }
      
      queryClient.invalidateQueries({ queryKey: ["manager-orders"] });
    },
    onError: (err: any) => {
      console.error("Error creating order:", err);
      toast.error(err.response?.data?.detail || "Ошибка при создании заказа");
    }
  });

  const onClientSubmit = (data: ClientFormData) => {
    createClientMutation.mutate(data);
  };

  const onOrderSubmit = (data: OrderFormData) => {
    createOrderMutation.mutate(data);
  };

  return (
    <div className="space-y-6">
      <h1 className="text-3xl font-bold">Образцы заказов</h1>

      <Tabs value={activeTab} onValueChange={setActiveTab} className="w-full">
        <TabsList className="grid w-full grid-cols-3">
          <TabsTrigger value="orders">Заказы</TabsTrigger>
          <TabsTrigger value="add-client">Добавить клиента</TabsTrigger>
          <TabsTrigger value="assign-technician">Назначить зуботехника</TabsTrigger>
        </TabsList>

        <TabsContent value="orders" className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle>Создание образцового заказа</CardTitle>
            </CardHeader>
            <CardContent>
              <form onSubmit={handleSubmitOrder(onOrderSubmit)} className="space-y-4">
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div>
                    <Label htmlFor="client_id">Клиент</Label>
                    <Select 
                      onValueChange={(value) => setOrderValue("client_id", parseInt(value))}
                    >
                      <SelectTrigger>
                        <SelectValue placeholder="Выберите клиента" />
                      </SelectTrigger>
                      <SelectContent>
                        {clients?.items?.map((client: any) => (
                          <SelectItem key={client.id} value={client.id.toString()}>
                            {(client.first_name || '') + ' ' + (client.last_name || '')}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                    {orderErrors.client_id && (
                      <p className="text-destructive text-sm mt-1">{orderErrors.client_id.message}</p>
                    )}
                  </div>

                  <div>
                    <Label htmlFor="technician_id">Зуботехник</Label>
                    <Select 
                      onValueChange={(value) => setOrderValue("technician_id", parseInt(value))}
                    >
                      <SelectTrigger>
                        <SelectValue placeholder="Выберите зуботехника" />
                      </SelectTrigger>
                      <SelectContent>
                        {technicians?.map((tech: any) => (
                          <SelectItem key={tech.id} value={tech.id.toString()}>
                            {(tech.user?.first_name || tech.first_name) + ' ' + (tech.user?.last_name || tech.last_name)}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                </div>

                <div>
                  <Label htmlFor="priority">Приоритет</Label>
                  <Select 
                    onValueChange={(value) => setOrderValue("priority", value as "normal"|"urgent"|"critical")}
                  >
                    <SelectTrigger>
                      <SelectValue placeholder="Выберите приоритет" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="normal">Обычный</SelectItem>
                      <SelectItem value="urgent">Срочный</SelectItem>
                      <SelectItem value="critical">Критический</SelectItem>
                    </SelectContent>
                  </Select>
                </div>

                <div>
                  <Label htmlFor="deadline">Дедлайн</Label>
                  <Input
                    id="deadline"
                    type="datetime-local"
                    {...registerOrder("deadline")}
                  />
                </div>

                <div>
                  <Label htmlFor="notes">Примечания</Label>
                  <Textarea
                    id="notes"
                    {...registerOrder("notes")}
                  />
                </div>

                <Button 
                  type="submit" 
                  disabled={createOrderMutation.isPending}
                  className="w-full"
                >
                  {createOrderMutation.isPending ? "Создание..." : "Создать заказ"}
                </Button>
              </form>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="add-client" className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle>Добавить нового клиента</CardTitle>
            </CardHeader>
            <CardContent>
              <form onSubmit={handleSubmitClient(onClientSubmit)} className="space-y-4">
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div>
                    <Label htmlFor="first_name">Имя *</Label>
                    <Input
                      id="first_name"
                      {...registerClient("first_name")}
                    />
                    {clientErrors.first_name && (
                      <p className="text-destructive text-sm mt-1">{clientErrors.first_name.message}</p>
                    )}
                  </div>

                  <div>
                    <Label htmlFor="last_name">Фамилия *</Label>
                    <Input
                      id="last_name"
                      {...registerClient("last_name")}
                    />
                    {clientErrors.last_name && (
                      <p className="text-destructive text-sm mt-1">{clientErrors.last_name.message}</p>
                    )}
                  </div>
                </div>

                <div>
                  <Label htmlFor="email">Email *</Label>
                  <Input
                    id="email"
                    type="email"
                    {...registerClient("email")}
                  />
                  {clientErrors.email && (
                    <p className="text-destructive text-sm mt-1">{clientErrors.email.message}</p>
                  )}
                </div>

                <div>
                  <Label htmlFor="phone">Телефон</Label>
                  <Input
                    id="phone"
                    {...registerClient("phone")}
                  />
                </div>

                <Button 
                  type="submit" 
                  disabled={createClientMutation.isPending}
                  className="w-full"
                >
                  {createClientMutation.isPending ? "Добавление..." : "Добавить клиента"}
                </Button>
              </form>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="assign-technician" className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle>Назначить зуботехника на существующий заказ</CardTitle>
            </CardHeader>
            <CardContent>
              <p className="text-muted-foreground mb-4">
                Используйте эту вкладку для назначения зуботехников на существующие заказы
              </p>
              
              <form onSubmit={handleSubmitTechnician(() => {
                toast.info("Для назначения зуботехника используйте вкладку 'Заказы'");
              })} className="space-y-4">
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div>
                    <Label htmlFor="order-select">Заказ</Label>
                    <Select>
                      <SelectTrigger>
                        <SelectValue placeholder="Выберите заказ" />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="order1">Заказ #001</SelectItem>
                        <SelectItem value="order2">Заказ #002</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>

                  <div>
                    <Label htmlFor="technician-select">Зуботехник</Label>
                    <Select>
                      <SelectTrigger>
                        <SelectValue placeholder="Выберите зуботехника" />
                      </SelectTrigger>
                      <SelectContent>
                        {technicians?.map((tech: any) => (
                          <SelectItem key={tech.id} value={tech.id.toString()}>
                            {tech.first_name} {tech.last_name}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                </div>

                <Button type="submit" className="w-full">
                  Назначить зуботехника
                </Button>
              </form>
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  );
};