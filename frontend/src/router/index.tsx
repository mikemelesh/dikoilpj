import type { ReactNode } from "react";
import { Navigate, Outlet, Route, Routes } from "react-router-dom";

import { authStore } from "@/stores/authStore";
import type { Role } from "@/types";

// Pages - Public
import { HomePage } from "@/pages/public/HomePage";
import { UnauthorizedPage } from "@/pages/public/UnauthorizedPage";

// Pages - Auth
import { LoginPage } from "@/pages/auth/LoginPage";
import { RegisterPage } from "@/pages/auth/RegisterPage";

// Pages - Dashboard
import { AdminDashboard } from "@/pages/admin/DashboardPage";
import { ManagerDashboard } from "@/pages/manager/ManagerDashboard";
import { ManagerOrders } from "@/pages/manager/ManagerOrders";
import { ManagerGantt } from "@/pages/manager/ManagerGantt";
import { ManagerClients } from "@/pages/manager/ManagerClients";
import { ManagerTechnicians } from "@/pages/manager/ManagerTechnicians";
import { ManagerServices } from "@/pages/manager/ManagerServices";
import { ManagerPromotions } from "@/pages/manager/ManagerPromotions";
// Pages - Admin
import { AdminDashboard } from "@/pages/admin/AdminDashboard";
import { AdminUsers } from "@/pages/admin/AdminUsers";
import { AdminContent } from "@/pages/admin/AdminContent";
import { AdminReviews } from "@/pages/admin/AdminReviews";
import { AdminLogs } from "@/pages/admin/AdminLogs";
import { AdminBackup } from "@/pages/admin/AdminBackup";
import { TechDashboard } from "@/pages/technician/TechDashboard";
import { TechOrders } from "@/pages/technician/TechOrders";
import { TechOrderDetail } from "@/pages/technician/TechOrderDetail";
import { TechStats } from "@/pages/technician/TechStats";
import { TechProfile } from "@/pages/technician/TechProfile";
import { TechMaterialRequests } from "@/pages/technician/TechMaterialRequests";
import { TechKnowledgeBase } from "@/pages/technician/TechKnowledgeBase";
import { ClientDashboard } from "@/pages/client/DashboardPage";
import { ClientOrders } from "@/pages/client/ClientOrders";
import { ClientOrderDetail } from "@/pages/client/ClientOrderDetail";
import { ClientNewOrder } from "@/pages/client/ClientNewOrder";
import { ClientArchive } from "@/pages/client/ClientArchive";
import { ClientProfile } from "@/pages/client/ClientProfile";

// =============================================================================
// Компоненты роутинга
// =============================================================================

interface ProtectedRouteProps {
  allowedRoles?: Role[];
  children?: ReactNode;
  redirectTo?: string;
}

/**
 * Защищённый роут с проверкой роли
 * - Неавторизованный → redirect /login
 * - Неверная роль → redirect /unauthorized
 * - После логина → redirect на дашборд своей роли
 */
export const ProtectedRoute = ({
  allowedRoles,
  children,
  redirectTo,
}: ProtectedRouteProps) => {
  const { user, isAuthenticated } = authStore();

  // Если не авторизован — redirect на login
  if (!isAuthenticated || !user) {
    return <Navigate to="/login" replace />;
  }

  // Если роль не входит в разрешённые — redirect на unauthorized
  if (allowedRoles && !allowedRoles.includes(user.role)) {
    return <Navigate to="/unauthorized" replace />;
  }

  return children ?? <Outlet />;
};

/**
 * Роут только для неавторизованных (login, register)
 * Если авторизован — редирект на дашборд
 */
export const PublicRoute = () => {
  const { user, isAuthenticated } = authStore();

  if (isAuthenticated && user) {
    // Редирект на дашборд в зависимости от роли
    const dashboardPaths: Record<Role, string> = {
      admin: "/admin",
      manager: "/manager",
      technician: "/technician",
      client: "/client",
      guest: "/",
    };
    return <Navigate to={dashboardPaths[user.role] || "/"} replace />;
  }

  return <Outlet />;
};

// =============================================================================
// Маршруты по ролям
// =============================================================================

const DASHBOARD_ROUTES: Record<Role, string> = {
  admin: "/admin",
  manager: "/manager",
  technician: "/technician",
  client: "/client",
  guest: "/",
};

export const AppRouter = () => (
  <Routes>
    {/* Публичные маршруты */}
    <Route path="/" element={<HomePage />} />
    <Route path="/unauthorized" element={<UnauthorizedPage />} />
    
    {/* Маршруты авторизации (только для неавторизованных) */}
    <Route element={<PublicRoute />}>
      <Route path="/login" element={<LoginPage />} />
      <Route path="/register" element={<RegisterPage />} />
    </Route>
    
    {/* Админ панель */}
    <Route
      path="/admin/*"
      element={
        <ProtectedRoute allowedRoles={["admin"]}>
          <AdminRoutes />
        </ProtectedRoute>
      }
    />
    
    {/* Менеджер панель */}
    <Route
      path="/manager/*"
      element={
        <ProtectedRoute allowedRoles={["manager", "admin"]}>
          <ManagerRoutes />
        </ProtectedRoute>
      }
    />
    
    {/* Техник панель */}
    <Route
      path="/technician/*"
      element={
        <ProtectedRoute allowedRoles={["technician", "manager", "admin"]}>
          <TechnicianRoutes />
        </ProtectedRoute>
      }
    />
    
    {/* Клиент панель */}
    <Route
      path="/client/*"
      element={
        <ProtectedRoute allowedRoles={["client", "manager", "admin"]}>
          <ClientRoutes />
        </ProtectedRoute>
      }
    />
    
    {/* Catch-all — 404 */}
    <Route path="*" element={<NotFoundPage />} />
  </Routes>
);

// =============================================================================
// Admin Routes (вложенные маршруты)
// =============================================================================

const AdminRoutes = () => (
  <Routes>
    <Route index element={<AdminDashboard />} />
    <Route path="users" element={<AdminUsers />} />
    <Route path="content" element={<AdminContent />} />
    <Route path="reviews" element={<AdminReviews />} />
    <Route path="logs" element={<AdminLogs />} />
    <Route path="backup" element={<AdminBackup />} />
  </Routes>
);

// =============================================================================
// Client Routes (вложенные маршруты)
// =============================================================================

const ClientRoutes = () => (
  <Routes>
    <Route index element={<ClientDashboard />} />
    <Route path="orders" element={<ClientOrders />} />
    <Route path="orders/new" element={<ClientNewOrder />} />
    <Route path="orders/:id" element={<ClientOrderDetail />} />
    <Route path="archive" element={<ClientArchive />} />
    <Route path="profile" element={<ClientProfile />} />
  </Routes>
);

// =============================================================================
// Manager Routes (вложенные маршруты)
// =============================================================================

const ManagerRoutes = () => (
  <Routes>
    <Route index element={<ManagerDashboard />} />
    <Route path="orders" element={<ManagerOrders />} />
    <Route path="orders/:id" element={<TechOrderDetail />} />
    <Route path="gantt" element={<ManagerGantt />} />
    <Route path="clients" element={<ManagerClients />} />
    <Route path="technicians" element={<ManagerTechnicians />} />
    <Route path="services" element={<ManagerServices />} />
    <Route path="promotions" element={<ManagerPromotions />} />
  </Routes>
);

// =============================================================================
// Technician Routes (вложенные маршруты)
// =============================================================================

const TechnicianRoutes = () => (
  <Routes>
    <Route index element={<TechDashboard />} />
    <Route path="orders" element={<TechOrders />} />
    <Route path="orders/:id" element={<TechOrderDetail />} />
    <Route path="stats" element={<TechStats />} />
    <Route path="profile" element={<TechProfile />} />
    <Route path="materials" element={<TechMaterialRequests />} />
    <Route path="knowledge" element={<TechKnowledgeBase />} />
  </Routes>
);

// =============================================================================
// Хелпер для получения пути дашборда по роли
// =============================================================================

export const getDashboardPath = (role: Role): string => {
  return DASHBOARD_ROUTES[role] || "/";
};

