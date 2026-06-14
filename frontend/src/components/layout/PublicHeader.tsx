import { Link, useLocation, useNavigate } from "react-router-dom";
import { useState } from "react";

import { Button } from "@/components/ui/button";
import { ArrowLeft, Building2, User, LogOut, ChevronDown } from "lucide-react";
import { useAuthStore } from "@/stores/authStore";
import { cn } from "@/utils";

export const PUBLIC_NAV_ITEMS = [
  { path: "/services", label: "Услуги" },
  { path: "/calculator", label: "Калькулятор" },
  { path: "/portfolio", label: "Портфолио" },
  { path: "/requirements", label: "Требования" },
  { path: "/articles", label: "Статьи" },
  { path: "/faq", label: "FAQ" },
] as const;

interface PublicHeaderProps {
  /** Show «На главную» on inner public pages (not on home). */
  showBackLink?: boolean;
}

export const PublicHeader = ({ showBackLink = false }: PublicHeaderProps) => {
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

  return (
    <header className="sticky top-0 z-50 border-b bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/60">
      <div className="container mx-auto flex h-16 items-center justify-between px-4">
        <div className="flex items-center gap-4">
          {showBackLink && (
            <Link to="/">
              <Button variant="ghost" size="sm" className="gap-2">
                <ArrowLeft className="h-4 w-4" />
                <span className="hidden sm:inline">На главную</span>
              </Button>
            </Link>
          )}
          <Link to="/" className="flex items-center gap-2 hover:opacity-80 transition-opacity">
            <Building2 className="h-6 w-6 text-primary" />
            <span className="font-semibold text-lg hidden sm:inline-block">Dental Lab</span>
          </Link>
        </div>

        <div className="flex items-center gap-4">
          <nav className="hidden md:flex items-center gap-6">
            {PUBLIC_NAV_ITEMS.map((item) => (
              <Link
                key={item.path}
                to={item.path}
                className={cn(
                  "text-sm font-medium transition-colors",
                  location.pathname === item.path
                    ? "text-foreground"
                    : "text-muted-foreground hover:text-foreground"
                )}
              >
                {item.label}
              </Link>
            ))}
          </nav>

          {isAuthenticated && user ? (
            <div className="relative">
              <button
                type="button"
                onClick={() => setIsDropdownOpen(!isDropdownOpen)}
                className="flex items-center gap-2 rounded-lg hover:bg-accent px-3 py-2 transition-colors"
              >
                <div className="flex h-8 w-8 items-center justify-center rounded-full bg-primary/10">
                  <User className="h-4 w-4 text-primary" />
                </div>
                <span className="hidden sm:inline-block text-sm font-medium">
                  {user.first_name || user.last_name || user.email}
                </span>
                <ChevronDown
                  className={cn("h-4 w-4 transition-transform", isDropdownOpen && "rotate-180")}
                />
              </button>

              {isDropdownOpen && (
                <>
                  <div
                    className="fixed inset-0 z-10"
                    onClick={() => setIsDropdownOpen(false)}
                    aria-hidden
                  />
                  <div className="absolute right-0 mt-2 w-48 rounded-lg border bg-popover py-1 shadow-lg z-20">
                    <button
                      type="button"
                      onClick={handleProfileClick}
                      className="flex w-full items-center gap-2 px-4 py-2 text-sm hover:bg-accent transition-colors"
                    >
                      <User className="h-4 w-4" />
                      Профиль
                    </button>
                    <button
                      type="button"
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
  );
};
