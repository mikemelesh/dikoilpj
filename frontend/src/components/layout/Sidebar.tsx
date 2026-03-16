import { NavLink } from "react-router-dom";
import { useNavigate } from "react-router-dom";

import { authStore } from "@/stores/authStore";
import { cn } from "@/utils";

import {
  LayoutDashboard,
  Package,
  PackagePlus,
  Archive,
  User,
  ClipboardList,
  TrendingUp,
  FileText,
  BookOpen,
  Users,
  Calendar,
  Wrench,
  Tag,
  Box,
  Shield,
  MessageSquare,
  FileBox,
  Settings,
  LogOut,
} from "lucide-react";

// =============================================================================
// Конфигурация меню по ролям
// =============================================================================

interface MenuItem {
  label: string;
  path: string;
  icon: React.ComponentType<{ className?: string }>;
}

const MENU_CONFIG: Record<string, MenuItem[]> = {
  client: [
    { label: "Дашборд", path: "/client", icon: LayoutDashboard },
    { label: "Мои заказы", path: "/client/orders", icon: ClipboardList },
    { label: "Новый заказ", path: "/client/orders/new", icon: PackagePlus },
    { label: "Архив", path: "/client/archive", icon: Archive },
    { label: "Профиль", path: "/client/profile", icon: User },
  ],
  technician: [
    { label: "Дашборд", path: "/technician", icon: LayoutDashboard },
    { label: "Заказы", path: "/technician/orders", icon: ClipboardList },
    { label: "Моя статистика", path: "/technician/stats", icon: TrendingUp },
    { label: "Заявки на материалы", path: "/technician/materials", icon: FileText },
    { label: "База знаний", path: "/technician/knowledge", icon: BookOpen },
    { label: "Профиль", path: "/technician/profile", icon: User },
  ],
  manager: [
    { label: "Дашборд", path: "/manager", icon: LayoutDashboard },
    { label: "Заказы", path: "/manager/orders", icon: ClipboardList },
    { label: "Gantt", path: "/manager/gantt", icon: Calendar },
    { label: "Клиенты", path: "/manager/clients", icon: Users },
    { label: "Сотрудники", path: "/manager/technicians", icon: User },
    { label: "Услуги", path: "/manager/services", icon: Wrench },
    { label: "Акции", path: "/manager/promotions", icon: Tag },
    { label: "Материалы", path: "/manager/materials", icon: Box },
  ],
  admin: [
    { label: "Дашборд", path: "/admin", icon: LayoutDashboard },
    { label: "Пользователи", path: "/admin/users", icon: Users },
    { label: "Контент", path: "/admin/content", icon: FileBox },
    { label: "Отзывы", path: "/admin/reviews", icon: MessageSquare },
    { label: "Логи", path: "/admin/logs", icon: FileText },
    { label: "Резервные копии", path: "/admin/backup", icon: Archive },
    { label: "Настройки", path: "/admin/settings", icon: Settings },
  ],
};

// =============================================================================
// Компонент Sidebar
// =============================================================================

interface SidebarProps {
  isOpen?: boolean;
  onClose?: () => void;
}

export const Sidebar = ({ isOpen = true, onClose }: SidebarProps) => {
  const navigate = useNavigate();
  const { user, logout } = authStore();
  
  const role = user?.role;
  const menuItems = role ? MENU_CONFIG[role] || [] : [];

  const handleLogout = () => {
    logout();
    navigate("/login");
  };

  return (
    <>
      {/* Overlay для mobile */}
      <div
        className={cn(
          "fixed inset-0 z-40 bg-black/50 lg:hidden transition-opacity",
          isOpen ? "opacity-100" : "opacity-0 pointer-events-none"
        )}
        onClick={onClose}
      />
      
      {/* Sidebar */}
      <aside
        className={cn(
          "fixed top-0 left-0 z-50 h-full w-64 bg-background border-r transition-transform duration-300 lg:translate-x-0 lg:static lg:z-auto",
          isOpen ? "translate-x-0" : "-translate-x-full"
        )}
      >
        {/* Logo */}
        <div className="flex h-16 items-center border-b px-6">
          <LayoutDashboard className="h-6 w-6 text-primary mr-2" />
          <span className="font-semibold text-lg">Dental Lab</span>
        </div>

        {/* Navigation */}
        <nav className="flex-1 overflow-y-auto p-4">
          <ul className="space-y-1">
            {menuItems.map((item) => (
              <li key={item.path}>
                <NavLink
                  to={item.path}
                  className={({ isActive }) =>
                    cn(
                      "flex items-center gap-3 rounded-lg px-3 py-2.5 text-sm font-medium transition-colors",
                      isActive
                        ? "bg-primary text-primary-foreground"
                        : "text-muted-foreground hover:bg-accent hover:text-accent-foreground"
                    )
                  }
                  onClick={() => onClose?.()}
                >
                  <item.icon className="h-5 w-5" />
                  {item.label}
                </NavLink>
              </li>
            ))}
          </ul>
        </nav>

        {/* User section + Logout */}
        <div className="border-t p-4">
          {user && (
            <div className="mb-4 flex items-center gap-3 px-3 py-2">
              <div className="flex h-10 w-10 items-center justify-center rounded-full bg-primary/10">
                <User className="h-5 w-5 text-primary" />
              </div>
              <div className="flex-1 overflow-hidden">
                <p className="truncate text-sm font-medium">
                  {user.first_name || user.email}
                </p>
                <p className="truncate text-xs text-muted-foreground capitalize">
                  {user.role}
                </p>
              </div>
            </div>
          )}
          
          <button
            onClick={handleLogout}
            className="flex w-full items-center gap-3 rounded-lg px-3 py-2.5 text-sm font-medium text-destructive hover:bg-destructive/10 transition-colors"
          >
            <LogOut className="h-5 w-5" />
            Выйти
          </button>
        </div>
      </aside>
    </>
  );
};
