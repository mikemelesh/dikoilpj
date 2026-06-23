import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { toast } from "react-toastify";
import { mutationOnError } from "@/lib/apiError";

import { getMaterials, approveMaterialRequest, getMaterialRequests } from "@/api/manager";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { AlertCircle, Check, X, Package } from "lucide-react";
import { formatDate, getMaterialRequestLabel } from "@/utils";

export const ManagerMaterials = () => {
  const queryClient = useQueryClient();
  const [search, setSearch] = useState("");
  const [lowStockOnly, setLowStockOnly] = useState(false);
  const [selectedRequest, setSelectedRequest] = useState<{ id: number; open: boolean }>({ id: 0, open: false });

  // Материалы
  const { data: materialsData } = useQuery({
    queryKey: ["manager-materials", search, lowStockOnly],
    queryFn: () => getMaterials({ search, low_stock_only: lowStockOnly }),
  });

  const materials = materialsData?.items || [];

  // Заявки на материалы
  const { data: pendingRequestsData } = useQuery({
    queryKey: ["manager-pending-requests"],
    queryFn: () => getMaterialRequests({ status: "pending" }),
  });

  const pendingRequests = pendingRequestsData?.items || [];

  const approveMutation = useMutation({
    mutationFn: ({ id, status }: { id: number; status: "approved" | "rejected" }) =>
      approveMaterialRequest(id, { status, comment: status === "approved" ? "Одобрено" : "Отклонено" }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["manager-pending-requests"] });
      toast.success("Заявка обработана");
      setSelectedRequest({ id: 0, open: false });
    },
    onError: mutationOnError("Ошибка обработки"),
  });

  const lowStockMaterials = materials?.filter((m) => m.quantity <= m.min_quantity) || [];
  const normalMaterials = materials?.filter((m) => m.quantity > m.min_quantity) || [];

  return (
    <div className="space-y-6">
      <h1 className="text-3xl font-bold">Материалы</h1>

      {/* Заявки на материалы */}
      {pendingRequests && pendingRequests.length > 0 && (
        <Card>
          <CardHeader>
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <AlertCircle className="h-5 w-5 text-amber-500" />
                <CardTitle>Заявки на материалы ({pendingRequests.length})</CardTitle>
              </div>
            </div>
          </CardHeader>
          <CardContent>
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Техник</TableHead>
                  <TableHead>Материал</TableHead>
                  <TableHead>Количество</TableHead>
                  <TableHead>Комментарий</TableHead>
                  <TableHead>Дата</TableHead>
                  <TableHead></TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {pendingRequests.map((request) => {
                  const materialUnit =
                    request.material?.unit ||
                    materials.find((m) => m.id === request.material_id)?.unit ||
                    "шт";

                  return (
                  <TableRow key={request.id}>
                    <TableCell>{request.technician_name || `${request.technician?.user?.first_name ?? ""} ${request.technician?.user?.last_name ?? ""}`.trim() || "—"}</TableCell>
                    <TableCell>{getMaterialRequestLabel(request)}</TableCell>
                    <TableCell>{request.quantity_requested} {materialUnit}</TableCell>
                    <TableCell className="max-w-xs truncate">{request.comment || "—"}</TableCell>
                    <TableCell>{formatDate(request.created_at)}</TableCell>
                    <TableCell>
                      <div className="flex gap-1">
                        <Button
                          variant="outline"
                          size="sm"
                          onClick={() => approveMutation.mutate({ id: request.id, status: "approved" })}
                        >
                          <Check className="h-4 w-4 text-green-600" />
                        </Button>
                        <Button
                          variant="outline"
                          size="sm"
                          onClick={() => approveMutation.mutate({ id: request.id, status: "rejected" })}
                        >
                          <X className="h-4 w-4 text-red-600" />
                        </Button>
                      </div>
                    </TableCell>
                  </TableRow>
                  );
                })}
              </TableBody>
            </Table>
          </CardContent>
        </Card>
      )}

      {/* Фильтры */}
      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <CardTitle>Склад материалов</CardTitle>
            <div className="flex items-center gap-4">
              <div className="flex items-center gap-2">
                <input
                  type="checkbox"
                  id="low-stock"
                  checked={lowStockOnly}
                  onChange={(e) => setLowStockOnly(e.target.checked)}
                  className="h-4 w-4"
                />
                <Label htmlFor="low-stock" className="text-sm">Только с низким остатком</Label>
              </div>
              <Input
                placeholder="Поиск материалов..."
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                className="w-64"
              />
            </div>
          </div>
        </CardHeader>
      </Card>

      {/* Материалы с низким остатком */}
      {(!lowStockOnly || lowStockMaterials.length > 0) && (
        <Card>
          <CardHeader>
            <div className="flex items-center gap-2">
              <AlertCircle className="h-5 w-5 text-red-500" />
              <CardTitle>Низкий остаток ({lowStockMaterials.length})</CardTitle>
            </div>
          </CardHeader>
          <CardContent>
            {lowStockMaterials.length === 0 ? (
              <p className="text-center text-muted-foreground py-8">Нет материалов с низким остатком</p>
            ) : (
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Название</TableHead>
                    <TableHead>Остаток</TableHead>
                    <TableHead>Мин. остаток</TableHead>
                    <TableHead>Цена</TableHead>
                    <TableHead>Поставщик</TableHead>
                    <TableHead>Статус</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {lowStockMaterials.map((material) => (
                    <TableRow key={material.id}>
                      <TableCell className="font-medium">{material.name}</TableCell>
                      <TableCell>
                        <span className="text-red-600 font-semibold">
                          {material.quantity} {material.unit}
                        </span>
                      </TableCell>
                      <TableCell>{material.min_quantity} {material.unit}</TableCell>
                      <TableCell>{new Intl.NumberFormat("ru-RU", { style: "currency", currency: "BYN", minimumFractionDigits: 2 }).format(material.price_per_unit)}</TableCell>
                      <TableCell>{material.supplier || "—"}</TableCell>
                      <TableCell>
                        <Badge variant="destructive">Заканчивается</Badge>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            )}
          </CardContent>
        </Card>
      )}

      {/* Все материалы */}
      {!lowStockOnly && (
        <Card>
          <CardHeader>
            <div className="flex items-center gap-2">
              <Package className="h-5 w-5 text-primary" />
              <CardTitle>Все материалы ({normalMaterials.length})</CardTitle>
            </div>
          </CardHeader>
          <CardContent>
            {normalMaterials.length === 0 ? (
              <p className="text-center text-muted-foreground py-8">Нет материалов</p>
            ) : (
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Название</TableHead>
                    <TableHead>Остаток</TableHead>
                    <TableHead>Мин. остаток</TableHead>
                    <TableHead>Цена</TableHead>
                    <TableHead>Поставщик</TableHead>
                    <TableHead>Статус</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {normalMaterials.map((material) => (
                    <TableRow key={material.id}>
                      <TableCell className="font-medium">{material.name}</TableCell>
                      <TableCell>{material.quantity} {material.unit}</TableCell>
                      <TableCell>{material.min_quantity} {material.unit}</TableCell>
                      <TableCell>{new Intl.NumberFormat("ru-RU", { style: "currency", currency: "BYN", minimumFractionDigits: 2 }).format(material.price_per_unit)}</TableCell>
                      <TableCell>{material.supplier || "—"}</TableCell>
                      <TableCell>
                        <Badge variant="success">В наличии</Badge>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            )}
          </CardContent>
        </Card>
      )}
    </div>
  );
};
