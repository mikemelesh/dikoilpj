import { useState } from "react";
import { Button } from "../ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "../ui/dropdown-menu";
import { Download, FileSpreadsheet, FileText } from "lucide-react";
import { toast } from "react-toastify";

import {
  exportClients,
  exportGantt,
  exportMaterials,
  exportOrders,
  exportTechnicians,
  exportOrdersByClient,
  exportOrdersByTechnician,
  exportTechnicianOrders,
  exportUsers,
  exportFaqs,
  exportReviews,
  exportArticles,
  type ExportFilters,
  type ExportFormat,
} from "../../api/export";

type ExportResource = "orders" | "clients" | "technicians" | "materials" | "gantt" | "orders-by-client" | "orders-by-technician" | "technician-orders" | "users" | "faqs" | "reviews" | "articles";

interface ExportButtonProps {
  resource?: ExportResource;
  filters?: ExportFilters;
  title?: string;
  className?: string;
}

export const ExportButton = ({
  resource = "orders",
  filters = {},
  title = "Orders Report",
  className = "",
}: ExportButtonProps) => {
  const [isExporting, setIsExporting] = useState(false);

  const handleExport = async (format: ExportFormat) => {
    try {
      setIsExporting(true);

      let blob: Blob;
      if (resource === "orders") blob = await exportOrders(filters, format);
      else if (resource === "clients") blob = await exportClients(format);
      else if (resource === "technicians") blob = await exportTechnicians(format, true);
      else if (resource === "materials") blob = await exportMaterials(format, filters);
      else if (resource === "gantt") blob = await exportGantt(format, filters);
      else if (resource === "orders-by-client") blob = await exportOrdersByClient(format, filters);
      else if (resource === "orders-by-technician") blob = await exportOrdersByTechnician(format, filters);
      else if (resource === "technician-orders") blob = await exportTechnicianOrders(format, filters);
      else if (resource === "users") blob = await exportUsers(format, filters);
      else if (resource === "faqs") blob = await exportFaqs(format, filters);
      else if (resource === "reviews") blob = await exportReviews(format, filters);
      else if (resource === "articles") blob = await exportArticles(format, filters);
      else blob = await exportOrders(filters, format); // default fallback

      const url = window.URL.createObjectURL(blob);
      const link = document.createElement("a");
      link.href = url;

      const extension = format === "excel" ? "xlsx" : "docx";
      link.download = `${title.replace(/\s+/g, "_").toLowerCase()}.${extension}`;

      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);

      window.URL.revokeObjectURL(url);
      toast.success(`Отчёт ${format === "excel" ? "Excel" : "Word"} скачан`);
    } catch {
      toast.error("Ошибка экспорта");
    } finally {
      setIsExporting(false);
    }
  };

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button
          variant="outline"
          size="sm"
          className={className}
          disabled={isExporting}
        >
          <Download className="mr-2 h-4 w-4" />
          {isExporting ? "Экспорт..." : "Отчёт"}
        </Button>
      </DropdownMenuTrigger>

      <DropdownMenuContent align="end">
        <DropdownMenuItem onClick={() => handleExport("excel")}>
          <FileSpreadsheet className="mr-2 h-4 w-4" />
          Excel
        </DropdownMenuItem>

        <DropdownMenuItem onClick={() => handleExport("docx")}>
          <FileText className="mr-2 h-4 w-4" />
          Word
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  );
};