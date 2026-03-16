import { useCallback, useState } from "react";
import { useDropzone, FileRejection } from "react-dropzone";

import { cn, formatPrice } from "@/utils";
import { Upload, File as FileIcon, X, Image, FileText, Package } from "lucide-react";
import { Button } from "@/components/ui/button";

// =============================================================================
// Типы
// =============================================================================

interface FileUploadProps {
  onFilesChange: (files: File[]) => void;
  maxFiles?: number;
  maxSize?: number; // в байтах
  acceptedTypes?: Record<string, string[]>;
  disabled?: boolean;
}

// =============================================================================
// Константы
// =============================================================================

const DEFAULT_ACCEPTED_TYPES = {
  "image/jpeg": [".jpg", ".jpeg"],
  "image/png": [".png"],
  "application/pdf": [".pdf"],
  "application/sla": [".stl"],
  "application/dicom": [".dcm"],
};

const MAX_FILE_SIZE = 10 * 1024 * 1024; // 10MB

// =============================================================================
// Компонент FileUpload
// =============================================================================

export const FileUpload = ({
  onFilesChange,
  maxFiles = 10,
  maxSize = MAX_FILE_SIZE,
  acceptedTypes = DEFAULT_ACCEPTED_TYPES,
  disabled = false,
}: FileUploadProps) => {
  const [files, setFiles] = useState<File[]>([]);
  const [previews, setPreviews] = useState<Record<string, string>>({});
  const [error, setError] = useState<string | null>(null);

  const onDrop = useCallback(
    (acceptedFiles: File[], rejectedFiles: FileRejection[]) => {
      setError(null);

      // Обработка ошибок
      if (rejectedFiles.length > 0) {
        const rejection = rejectedFiles[0];
        if (rejection.errors[0]?.code === "file-too-large") {
          setError(`Файл "${rejection.file.name}" слишком большой (макс. 10MB)`);
          return;
        }
        if (rejection.errors[0]?.code === "file-invalid-type") {
          setError(`Недопустимый тип файла "${rejection.file.name}"`);
          return;
        }
      }

      // Проверка на максимальное количество файлов
      if (files.length + acceptedFiles.length > maxFiles) {
        setError(`Можно загрузить максимум ${maxFiles} файлов`);
        return;
      }

      // Добавление файлов
      const newFiles = [...files, ...acceptedFiles];
      setFiles(newFiles);
      onFilesChange(newFiles);

      // Создание превью для изображений
      acceptedFiles.forEach((file) => {
        if (file.type.startsWith("image/")) {
          const url = URL.createObjectURL(file);
          setPreviews((prev) => ({ ...prev, [file.name]: url }));
        }
      });
    },
    [files, maxFiles, onFilesChange]
  );

  const { getRootProps, getInputProps, isDragActive } = useDropzone({
    onDrop,
    accept: acceptedTypes,
    maxSize,
    maxFiles: maxFiles - files.length,
    disabled,
  });

  const removeFile = (fileName: string) => {
    const newFiles = files.filter((f) => f.name !== fileName);
    setFiles(newFiles);
    onFilesChange(newFiles);

    // Очистка превью
    if (previews[fileName]) {
      URL.revokeObjectURL(previews[fileName]);
      setPreviews((prev) => {
        const newPreviews = { ...prev };
        delete newPreviews[fileName];
        return newPreviews;
      });
    }
  };

  const getFileIcon = (file: File) => {
    if (file.type.startsWith("image/")) {
      return <Image className="h-8 w-8 text-primary" />;
    }
    if (file.type === "application/pdf") {
      return <FileText className="h-8 w-8 text-red-500" />;
    }
    if (file.type === "application/sla" || file.type === "application/dicom") {
      return <Package className="h-8 w-8 text-blue-500" />;
    }
    return <FileIcon className="h-8 w-8 text-muted-foreground" />;
  };

  const formatFileSize = (bytes: number) => {
    if (bytes < 1024) return bytes + " B";
    if (bytes < 1024 * 1024) return (bytes / 1024).toFixed(1) + " KB";
    return (bytes / (1024 * 1024)).toFixed(1) + " MB";
  };

  return (
    <div className="space-y-4">
      {/* Dropzone */}
      <div
        {...getRootProps()}
        className={cn(
          "flex cursor-pointer flex-col items-center justify-center rounded-lg border-2 border-dashed p-8 text-center transition-colors",
          isDragActive
            ? "border-primary bg-primary/5"
            : "border-muted-foreground/25 hover:border-primary/50 hover:bg-accent/50",
          disabled && "cursor-not-allowed opacity-50"
        )}
      >
        <input {...getInputProps()} />
        <Upload className="mb-4 h-12 w-12 text-muted-foreground" />
        {isDragActive ? (
          <p className="text-sm text-primary">Перетащите файлы сюда...</p>
        ) : (
          <>
            <p className="text-sm font-medium">
              Перетащите файлы или кликните для загрузки
            </p>
            <p className="mt-1 text-xs text-muted-foreground">
              Поддерживаются: .jpg, .jpeg, .png, .pdf, .stl, .dcm (макс. 10MB)
            </p>
          </>
        )}
      </div>

      {/* Ошибка */}
      {error && (
        <p className="text-sm text-destructive">{error}</p>
      )}

      {/* Список файлов */}
      {files.length > 0 && (
        <div className="space-y-2">
          <p className="text-sm font-medium">
            Загружено файлов: {files.length} / {maxFiles}
          </p>
          <ul className="grid grid-cols-1 gap-2 sm:grid-cols-2 lg:grid-cols-3">
            {files.map((file) => (
              <li
                key={file.name}
                className="group relative flex items-center gap-3 rounded-lg border p-3 transition-colors hover:bg-accent/50"
              >
                {/* Превью или иконка */}
                {previews[file.name] ? (
                  <img
                    src={previews[file.name]}
                    alt={file.name}
                    className="h-12 w-12 rounded object-cover"
                  />
                ) : (
                  getFileIcon(file)
                )}

                {/* Информация о файле */}
                <div className="flex-1 overflow-hidden">
                  <p className="truncate text-sm font-medium">{file.name}</p>
                  <p className="text-xs text-muted-foreground">
                    {formatFileSize(file.size)}
                  </p>
                </div>

                {/* Кнопка удаления */}
                {!disabled && (
                  <button
                    onClick={() => removeFile(file.name)}
                    className="absolute -right-2 -top-2 flex h-6 w-6 items-center justify-center rounded-full bg-destructive text-white opacity-0 transition-opacity group-hover:opacity-100"
                    aria-label={`Удалить ${file.name}`}
                  >
                    <X className="h-3 w-3" />
                  </button>
                )}
              </li>
            ))}
          </ul>
        </div>
      )}
    </div>
  );
};
