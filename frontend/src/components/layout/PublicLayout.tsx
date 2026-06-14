import { PublicHeader } from "@/components/layout/PublicHeader";

interface PublicLayoutProps {
  children: React.ReactNode;
  title?: string;
}

export const PublicLayout = ({ children, title }: PublicLayoutProps) => {
  return (
    <div className="min-h-screen bg-background">
      <PublicHeader showBackLink />

      <main className="container mx-auto px-4 py-8">
        {title && <h1 className="mb-8 text-3xl font-bold">{title}</h1>}
        {children}
      </main>

      <footer className="border-t py-8 mt-16">
        <div className="container mx-auto px-4 text-center text-sm text-muted-foreground">
          <p>© 2024 Dental Lab. Все права защищены.</p>
        </div>
      </footer>
    </div>
  );
};
