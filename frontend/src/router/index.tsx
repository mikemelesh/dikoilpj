import type { ReactNode } from "react";
import { Navigate, Outlet, Route, Routes } from "react-router-dom";

import { useAuthStore, useAuthHydration } from "@/stores/authStore";
import type { Role } from "@/types";
import { Layout } from "@/components/layout/Layout";
import { LoadingScreen } from "@/components/shared/LoadingScreen";

// Pages - Public
import { HomePage } from "@/pages/public/HomePage";
import { UnauthorizedPage } from "@/pages/public/UnauthorizedPage";
import { NotFoundPage } from "@/pages/public/NotFoundPage";
import { CalculatorPage } from "@/pages/public/CalculatorPage";
import { PortfolioPage } from "@/pages/public/PortfolioPage";
import { ArticlesPage } from "@/pages/public/ArticlesPage";
import { ArticleDetailPage } from "@/pages/public/ArticleDetailPage";
import { FaqPage } from "@/pages/public/FaqPage";
import { ServicesPage } from "@/pages/public/ServicesPage";
import { TechnicianPortfolioPage } from "@/pages/public/TechnicianPortfolioPage";
import { RequirementsPage } from "@/pages/public/RequirementsPage";

// Pages - Auth
import { LoginPage } from "@/pages/auth/LoginPage";
import { RegisterPage } from "@/pages/auth/RegisterPage";

// Pages - Dashboard
import { ManagerDashboard } from "@/pages/manager/ManagerDashboard";
import { ManagerOrders } from "@/pages/manager/ManagerOrders";
import { ManagerOrderDetail } from "@/pages/manager/ManagerOrderDetail";
import { ManagerUsers } from "@/pages/manager/ManagerUsers";
import { ManagerGantt } from "@/pages/manager/ManagerGantt";
import { ManagerClients } from "@/pages/manager/ManagerClients";
import { ManagerTechnicians } from "@/pages/manager/ManagerTechnicians";
import { ManagerTechnicianDetail } from "@/pages/manager/ManagerTechnicianDetail";
import { ManagerServices } from "@/pages/manager/ManagerServices";
import { ManagerPromotions } from "@/pages/manager/ManagerPromotions";
import { ManagerMaterials } from "@/pages/manager/ManagerMaterials";
import { ManagerProfile } from "@/pages/manager/ManagerProfile";
import { ManagerTemplates } from "@/pages/manager/ManagerTemplates";
import { SampleOrders } from "@/pages/manager/SampleOrders";

// Pages - Admin
import { AdminDashboard } from "@/pages/admin/AdminDashboard";
import { AdminUsers } from "@/pages/admin/AdminUsers";
import { AdminContent } from "@/pages/admin/AdminContent";
import { AdminFaqs } from "@/pages/admin/AdminFaqs";
import { AdminReviews } from "@/pages/admin/AdminReviews";
import { AdminLogs } from "@/pages/admin/AdminLogs";
import { AdminBackup } from "@/pages/admin/AdminBackup";
import { AdminProfile } from "@/pages/admin/AdminProfile";
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
import { ClientTemplates } from "@/pages/client/ClientTemplates";
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
  const { user, isAuthenticated } = useAuthStore();
  const hasHydrated = useAuthHydration();

  // Ждём завершения гидратации перед проверкой авторизации
  if (!hasHydrated) {
    return <LoadingScreen />;
  }

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

export const AppRouter = () => {
  const { user, isAuthenticated } = useAuthStore();
  const hasHydrated = useAuthHydration();

  // Ждём завершения гидратации перед рендерингом маршрутов
  if (!hasHydrated) {
    return <LoadingScreen />;
  }

  return (
    <Routes>
      {/* Публичные маршруты — всегда доступны (без Layout) */}
      <Route path="/" element={<HomePage />} />
      <Route path="/calculator" element={<CalculatorPage />} />
      <Route path="/portfolio" element={<PortfolioPage />} />
      <Route path="/portfolio/:id" element={<TechnicianPortfolioPage />} />
      <Route path="/articles" element={<ArticlesPage />} />
      <Route path="/articles/:slug" element={<ArticleDetailPage />} />
      <Route path="/faq" element={<FaqPage />} />
      <Route path="/requirements" element={<RequirementsPage />} />
      <Route path="/services" element={<ServicesPage />} />
      <Route path="/unauthorized" element={<UnauthorizedPage />} />

      {/* Маршруты авторизации — только для неавторизованных (без Layout) */}
      <Route path="/login" element={
        !isAuthenticated
          ? <LoginPage />
          : <Navigate to={user?.role ? getDashboardPath(user.role) : "/client"} replace />
      } />
      <Route path="/register" element={
        !isAuthenticated
          ? <RegisterPage />
          : <Navigate to={user?.role ? getDashboardPath(user.role) : "/client"} replace />
      } />

      {/* Авторизованные маршруты — с Layout */}
      <Route element={<Layout />}>
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
            <ProtectedRoute allowedRoles={["technician"]}>
              <TechnicianRoutes />
            </ProtectedRoute>
          }
        />

        {/* Клиент панель */}
        <Route
          path="/client/*"
          element={
            <ProtectedRoute allowedRoles={["client"]}>
              <ClientRoutes />
            </ProtectedRoute>
          }
        />
      </Route>

      {/* Catch-all — 404 */}
      <Route path="*" element={<NotFoundPage />} />
    </Routes>
  );
};

// =============================================================================
// Admin Routes (вложенные маршруты)
// =============================================================================

const AdminRoutes = () => (
  <Routes>
    <Route index element={<AdminDashboard />} />
    <Route path="users" element={<AdminUsers />} />
    <Route path="content" element={<AdminContent />} />
    <Route path="faqs" element={<AdminFaqs />} />
    <Route path="reviews" element={<AdminReviews />} />
    <Route path="logs" element={<AdminLogs />} />
    <Route path="backup" element={<AdminBackup />} />
    <Route path="profile" element={<AdminProfile />} />
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
    <Route path="templates" element={<ClientTemplates />} />
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
    <Route path="sample-orders" element={<SampleOrders />} />
    <Route path="orders/:id" element={<ManagerOrderDetail />} />
    <Route path="users" element={<ManagerUsers />} />
    <Route path="gantt" element={<ManagerGantt />} />
    <Route path="clients" element={<ManagerClients />} />
    <Route path="technicians" element={<ManagerTechnicians />} />
    <Route path="technicians/:id" element={<ManagerTechnicianDetail />} />
    <Route path="services" element={<ManagerServices />} />
    <Route path="promotions" element={<ManagerPromotions />} />
    <Route path="materials" element={<ManagerMaterials />} />
    <Route path="templates" element={<ManagerTemplates />} />
    <Route path="profile" element={<ManagerProfile />} />
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