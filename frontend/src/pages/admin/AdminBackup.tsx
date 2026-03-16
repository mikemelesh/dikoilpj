import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { toast } from "react-toastify";
import { apiClient } from "@/api/axios";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { Download, HardDrive, RefreshCw } from "lucide-react";

interface Backup { filename: string; size: number; created_at: string }

export const AdminBackup = () => {
  const queryClient = useQueryClient();
  const [isCreating, setIsCreating] = useState(false);

  const { data: backups } = useQuery<Backup[]>({ queryKey: ["admin-backups"], queryFn: () => apiClient.get("/admin/backups").then(r => r.data).catch(() => []) });

  const createBackupMutation = useMutation({
    mutationFn: () => apiClient.post("/admin/backup"),
    onMutate: () => { setIsCreating(true); toast.info("Создание резервной копии..."); },
    onSuccess: (data) => {
      queryClient.invalidateQueries({ queryKey: ["admin-backups"] });
      toast.success(`Бэкап создан: ${data.data.filename}`);
    },
    onError: () => toast.error("Ошибка создания бэкапа"),
    onSettled: () => setIsCreating(false),
  });

  const formatSize = (bytes: number) => {
    if (bytes < 1024) return bytes + " B";
    if (bytes < 1024 * 1024) return (bytes / 1024).toFixed(1) + " KB";
    if (bytes < 1024 * 1024 * 1024) return (bytes / (1024 * 1024)).toFixed(1) + " MB";
    return (bytes / (1024 * 1024 * 1024)).toFixed(2) + " GB";
  };

  const downloadBackup = (filename: string) => {
    const link = document.createElement("a");
    link.href = `/api/admin/backups/${filename}`;
    link.download = filename;
    link.click();
    toast.success("Загрузка началась");
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="text-3xl font-bold">Резервные копии</h1>
        <Button onClick={() => createBackupMutation.mutate()} disabled={isCreating}>
          <RefreshCw className={`mr-2 h-4 w-4 ${isCreating ? "animate-spin" : ""}`} />
          {isCreating ? "Создание..." : "Создать бэкап"}
        </Button>
      </div>

      <Card>
        <CardHeader>
          <div className="flex items-center gap-2">
            <HardDrive className="h-6 w-6 text-primary" />
            <CardTitle>Существующие бэкапы</CardTitle>
          </div>
        </CardHeader>
        <CardContent>
          {!backups || backups.length === 0 ? (
            <p className="text-center text-muted-foreground py-8">Нет резервных копий</p>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Имя файла</TableHead>
                  <TableHead>Размер</TableHead>
                  <TableHead>Дата создания</TableHead>
                  <TableHead>Статус</TableHead>
                  <TableHead></TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {backups.map((backup) => (
                  <TableRow key={backup.filename}>
                    <TableCell className="font-mono text-sm">{backup.filename}</TableCell>
                    <TableCell>{formatSize(backup.size)}</TableCell>
                    <TableCell>{new Date(backup.created_at).toLocaleString("ru-RU")}</TableCell>
                    <TableCell><Badge variant="success">Готов</Badge></TableCell>
                    <TableCell>
                      <Button variant="outline" size="sm" onClick={() => downloadBackup(backup.filename)}>
                        <Download className="mr-2 h-4 w-4" /> Скачать
                      </Button>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>

      {/* Информация */}
      <Card>
        <CardHeader><CardTitle>Информация</CardTitle></CardHeader>
        <CardContent className="space-y-2 text-sm text-muted-foreground">
          <p>• Бэкапы создаются с помощью pg_dump</p>
          <p>• Файлы хранятся в директории /backups/</p>
          <p>• Рекомендуется создавать бэкап перед крупными изменениями</p>
          <p>• Автоматическое удаление старых бэкапов не реализовано</p>
        </CardContent>
      </Card>
    </div>
  );
};
