import { Link, useLocation } from "react-router-dom";

import { Button } from "@/components/ui/button";
import { ArrowLeft, Building2 } from "lucide-react";

interface PublicLayoutProps {
  children: React.ReactNode;
  title?: string;
}

export const PublicLayout = ({ children, title }: PublicLayoutProps) => {
  const location = useLocation();

  const navItems = [
    { path: "/services", label: "Услуги" },
    { path: "/calculator", label: "Калькулятор" },
    { path: "/portfolio", label: "Портфолио" },
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
