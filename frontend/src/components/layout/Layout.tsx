import { useState } from "react";
import { Outlet } from "react-router-dom";

import { Header } from "./Header";
import { Sidebar } from "./Sidebar";
import { ProfileSync } from "@/components/ProfileSync";
import { useAuthStore } from "@/stores/authStore";

// =============================================================================
// Компонент Layout
// =============================================================================

export const Layout = () => {
  const { isAuthenticated } = useAuthStore();
  const [isSidebarOpen, setIsSidebarOpen] = useState(false);

  // Если не авторизован — показываем только Header + контент
  if (!isAuthenticated) {
    return (
      <div className="min-h-screen bg-background">
        <Header />
        <main className="container mx-auto px-4 py-6">
          <Outlet />
        </main>
      </div>
    );
  }

  // Для авторизованных — полный layout с Sidebar
  return (
    <div className="flex min-h-screen bg-background">
      <ProfileSync />
      <Sidebar
        isOpen={isSidebarOpen}
        onClose={() => setIsSidebarOpen(false)}
      />

      <div className="flex flex-1 flex-col lg:ml-0">
        <Header onMenuClick={() => setIsSidebarOpen(true)} />

        <main className="flex-1 p-4 lg:p-6">
          <Outlet />
        </main>
      </div>
    </div>
  );
};
