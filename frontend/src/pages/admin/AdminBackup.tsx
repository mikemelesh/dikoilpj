import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { toast } from "react-toastify";
import { getApiErrorMessage, mutationOnError } from "@/lib/apiError";
import { apiClient } from "@/api/axios";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { Download, HardDrive, RefreshCw, RotateCcw } from "lucide-react";
import { formatDateTime } from "@/utils";

interface Backup { filename: string; size: number; created_at: string }

export const AdminBackup = () => {
  const queryClient = useQueryClient();
  const [isCreating, setIsCreating] = useState(false);
  const [selectedBackup, setSelectedBackup] = useState<string | null>(null);

  const { data: backups } = useQuery<Backup[]>({
    queryKey: ["admin-backups"],
    queryFn: () => apiClient.get("/admin/backups").then((r) => r.data),
  });

  const createBackupMutation = useMutation({
    mutationFn: () => apiClient.post("/admin/backup"),
    onMutate: () => { setIsCreating(true); toast.info("Создание резервной копии..."); },
    onSuccess: (data) => {
      queryClient.invalidateQueries({ queryKey: ["admin-backups"] });
      toast.success(`Бэкап создан: ${data.data.filename}`);
    },
    onError: mutationOnError("Ошибка создания бэкапа"),
    onSettled: () => setIsCreating(false),
  });

  const restoreBackupMutation = useMutation({
    mutationFn: (filename: string) => apiClient.post(`/admin/backups/${filename}/restore`),
    onMutate: () => toast.info("Восстановление базы данных..."),
    onSuccess: (data) => {
      queryClient.invalidateQueries({ queryKey: ["admin-backups"] });
      toast.success(data.data.message || `База восстановлена: ${data.data.filename}`);
      setSelectedBackup(null);
    },
    onError: (error: unknown) => {
      toast.error(getApiErrorMessage(error, "Ошибка восстановления из бэкапа"));
    },
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

  const handleRestore = () => {
    if (!selectedBackup) return;

    const confirmed = window.confirm(
      `Восстановить базу данных из «${selectedBackup}»?\n\n` +
      "Текущие данные будут полностью заменены. Это действие нельзя отменить."
    );
    if (confirmed) {
      restoreBackupMutation.mutate(selectedBackup);
    }
  };

  const isRestoring = restoreBackupMutation.isPending;

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between gap-4 flex-wrap">
        <h1 className="text-3xl font-bold">Резервные копии</h1>
        <div className="flex items-center gap-2">
          <Button
            variant="destructive"
            onClick={handleRestore}
            disabled={!selectedBackup || isRestoring || isCreating}
          >
            <RotateCcw className={`mr-2 h-4 w-4 ${isRestoring ? "animate-spin" : ""}`} />
            {isRestoring ? "Восстановление..." : "Откатить к выбранной копии"}
          </Button>
          <Button onClick={() => createBackupMutation.mutate()} disabled={isCreating || isRestoring}>
            <RefreshCw className={`mr-2 h-4 w-4 ${isCreating ? "animate-spin" : ""}`} />
            {isCreating ? "Создание..." : "Создать бэкап"}
          </Button>
        </div>
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
                  <TableHead className="w-12"></TableHead>
                  <TableHead>Имя файла</TableHead>
                  <TableHead>Размер</TableHead>
                  <TableHead>Дата создания</TableHead>
                  <TableHead>Статус</TableHead>
                  <TableHead></TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {backups.map((backup) => (
                  <TableRow
                    key={backup.filename}
                    className={selectedBackup === backup.filename ? "bg-muted/50" : "cursor-pointer"}
                    onClick={() => setSelectedBackup(backup.filename)}
                  >
                    <TableCell>
                      <input
                        type="radio"
                        name="selected-backup"
                        checked={selectedBackup === backup.filename}
                        onChange={() => setSelectedBackup(backup.filename)}
                        disabled={isRestoring}
                        className="h-4 w-4"
                      />
                    </TableCell>
                    <TableCell className="font-mono text-sm">{backup.filename}</TableCell>
                    <TableCell>{formatSize(backup.size)}</TableCell>
                    <TableCell>{formatDateTime(backup.created_at)}</TableCell>
                    <TableCell><Badge variant="success">Готов</Badge></TableCell>
                    <TableCell>
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={(e) => {
                          e.stopPropagation();
                          downloadBackup(backup.filename);
                        }}
                        disabled={isRestoring}
                      >
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

      <Card>
        <CardHeader><CardTitle>Информация</CardTitle></CardHeader>
        <CardContent className="space-y-2 text-sm text-muted-foreground">
          <p>• Бэкапы создаются с помощью pg_dump</p>
          <p>• Файлы хранятся в директории /backups/</p>
          <p>• Рекомендуется создавать бэкап перед крупными изменениями</p>
          <p>• Восстановление полностью заменяет текущую базу данных выбранной копией</p>
          <p>• Автоматическое удаление старых бэкапов не реализовано</p>
        </CardContent>
      </Card>
    </div>
  );
};
