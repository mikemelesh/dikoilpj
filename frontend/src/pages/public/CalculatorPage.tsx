import { PriceCalculator } from "@/components/services/PriceCalculator";
import { useEffect, useState } from "react";
import { apiClient } from "@/api/axios";
import type { Service } from "@/types";
import { toast } from "react-toastify";

export const CalculatorPage = () => {
  const [services, setServices] = useState<Service[]>([]);

  useEffect(() => {
    apiClient.get<Service[]>("/services?limit=100")
      .then((res) => setServices(res.data))
      .catch(() => toast.error("Ошибка загрузки услуг"));
  }, []);

  return (
    <div className="container mx-auto max-w-4xl px-4 py-8">
      <h1 className="mb-8 text-3xl font-bold">Калькулятор стоимости</h1>
      <PriceCalculator services={services} />
    </div>
  );
};
