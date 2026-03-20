import { Loader2 } from "lucide-react";

export const LoadingScreen = () => {
  return (
    <div className="flex min-h-screen items-center justify-center bg-background">
      <div className="flex flex-col items-center gap-4">
        <Loader2 className="h-12 w-12 animate-spin text-primary" />
        <p className="text-muted-foreground">Загрузка...</p>
      </div>
    </div>
  );
};
