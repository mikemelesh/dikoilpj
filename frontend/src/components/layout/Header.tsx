import { useState } from "react";
import { useNavigate } from "react-router-dom";

import { authStore } from "@/stores/authStore";
import { cn } from "@/utils";

import { Menu, User, LogOut, ChevronDown, Building2 } from "lucide-react";
import { Button } from "@/components/ui/button";

// =============================================================================
// Компонент Header
// =============================================================================

interface HeaderProps {
  onMenuClick?: () => void;
}

export const Header = ({ onMenuClick }: HeaderProps) => {
  const navigate = useNavigate();
  const { user, logout, isAuthenticated } = authStore();
  const [isDropdownOpen, setIsDropdownOpen] = useState(false);

  const handleLogout = () => {
    logout();
    navigate("/login");
    setIsDropdownOpen(false);
  };

  const handleProfileClick = () => {
    if (user) {
      navigate(`/${user.role}/profile`);
    }
    setIsDropdownOpen(false);
  };

  return (
    <header className="sticky top-0 z-30 flex h-16 items-center justify-between border-b bg-background px-4 lg:px-6">
      {/* Left: Menu button (mobile) + Logo */}
      <div className="flex items-center gap-4">
        <button
          onClick={onMenuClick}
          className="lg:hidden p-2 hover:bg-accent rounded-lg transition-colors"
          aria-label="Открыть меню"
        >
          <Menu className="h-5 w-5" />
        </button>
        
        <div className="flex items-center gap-2">
          <Building2 className="h-6 w-6 text-primary" />
          <span className="font-semibold text-lg hidden sm:inline-block">
            Dental Lab
          </span>
        </div>
      </div>

      {/* Right: Auth buttons or User dropdown */}
      <div className="flex items-center gap-4">
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

            {/* Dropdown menu */}
            {isDropdownOpen && (
              <>
                {/* Backdrop */}
                <div
                  className="fixed inset-0 z-10"
                  onClick={() => setIsDropdownOpen(false)}
                />
                
                {/* Menu */}
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
            <Button
              variant="outline"
              size="sm"
              onClick={() => navigate("/login")}
            >
              Войти
            </Button>
            <Button
              size="sm"
              onClick={() => navigate("/register")}
            >
              Регистрация
            </Button>
          </div>
        )}
      </div>
    </header>
  );
};
