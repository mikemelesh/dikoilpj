import { Link, useLocation, useNavigate } from "react-router-dom";
import { useState } from "react";

import { Button } from "@/components/ui/button";
import { ArrowLeft, Building2, User, LogOut, ChevronDown } from "lucide-react";
import { useAuthStore } from "@/stores/authStore";
import { cn } from "@/utils";

interface PublicLayoutProps {
  children: React.ReactNode;
  title?: string;
}

export const PublicLayout = ({ children, title }: PublicLayoutProps) => {
  const location = useLocation();
  const navigate = useNavigate();
  const { user, logout, isAuthenticated } = useAuthStore();
  const [isDropdownOpen, setIsDropdownOpen] = useState(false);

  const handleLogout = () => {
    logout();
    navigate("/");
    setIsDropdownOpen(false);
  };

  const handleProfileClick = () => {
    if (user) {
      navigate(`/${user.role}/profile`);
    }
    setIsDropdownOpen(false);
  };

  const navItems = [
    { path: "/services", label: "Услуги" },
    { path: "/calculator", label: "Калькулятор" },
    { path: "/portfolio", label: "Портфолио" },
    { path: "/requirements", label: "Требования" },
    { path: "/articles", label: "Статьи" },
    { path: "/faq", label: "FAQ" },
  ];

  return (
    <div className="min-h-screen bg-background">
      {/* Header с навигацией */}
      <header className="sticky top-0 z-50 border-b bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/60">
        <div className="container mx-auto flex h-16 items-center justify-between px-4">
          <div className="flex items-center gap-4">
            <Link to="/">
              <Button variant="ghost" size="sm" className="gap-2">
                <ArrowLeft className="h-4 w-4" />
                На главную
              </Button>
            </Link>
            <Link to="/" className="flex items-center gap-2 hover:opacity-80 transition-opacity">
              <Building2 className="h-6 w-6 text-primary" />
              <span className="font-semibold text-lg hidden sm:inline-block">Dental Lab</span>
            </Link>
          </div>
          <div className="flex items-center gap-4">
            <nav className="hidden md:flex items-center gap-6">
              {navItems.map((item) => (
                <Link
                  key={item.path}
                  to={item.path}
                  className={`text-sm font-medium transition-colors ${
                    location.pathname === item.path
                      ? "text-foreground"
                      : "text-muted-foreground hover:text-foreground"
                  }`}
                >
                  {item.label}
                </Link>
              ))}
            </nav>
            {isAuthenticated && user ? (
              <div className="relative">
                <button
                  onClick={() => setIsDropdownOpen(!isDropdownOpen)}
                  className="flex items-center gap-2 rounded-lg hover:bg-accent px-3 py-2 transition-colors"
                >
                  <div className="flex h-8 w-8 items-center justify-center rounded-full bg-primary/10">
                    <User className="h-4 w-4 text-primary" />
                  </div>
                  <span className="hidden sm:inline-block text-sm font-medium">
                    {user.first_name || user.last_name || user.email}
                  </span>
                  <ChevronDown className={cn("h-4 w-4 transition-transform", isDropdownOpen && "rotate-180")} />
                </button>

                {isDropdownOpen && (
                  <>
                    <div
                      className="fixed inset-0 z-10"
                      onClick={() => setIsDropdownOpen(false)}
                    />
                    <div className="absolute right-0 mt-2 w-48 rounded-lg border bg-popover py-1 shadow-lg z-20">
                      <button
                        onClick={handleProfileClick}
                        className="flex w-full items-center gap-2 px-4 py-2 text-sm hover:bg-accent transition-colors"
                      >
                        <User className="h-4 w-4" />
                        Профиль
                      </button>
                      <button
                        onClick={handleLogout}
                        className="flex w-full items-center gap-2 px-4 py-2 text-sm text-destructive hover:bg-destructive/10 transition-colors"
                      >
                        <LogOut className="h-4 w-4" />
                        Выйти
                      </button>
                    </div>
                  </>
                )}
              </div>
            ) : (
              <div className="flex items-center gap-2">
                <Button variant="ghost" size="sm" onClick={() => navigate("/login")}>
                  Войти
                </Button>
                <Button size="sm" onClick={() => navigate("/register")}>
                  Регистрация
                </Button>
              </div>
            )}
          </div>
        </div>
      </header>

      {/* Контент */}
      <main className="container mx-auto px-4 py-8">
        {title && <h1 className="mb-8 text-3xl font-bold">{title}</h1>}
        {children}
      </main>

      {/* Footer */}
      <footer className="border-t py-8 mt-16">
        <div className="container mx-auto px-4 text-center text-sm text-muted-foreground">
          <p>© 2024 Dental Lab. Все права защищены.</p>
        </div>
      </footer>
    </div>
  );
};