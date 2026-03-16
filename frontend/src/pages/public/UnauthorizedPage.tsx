import { Link } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { AlertCircle, ArrowLeft } from "lucide-react";

export const UnauthorizedPage = () => (
  <div className="min-h-screen flex items-center justify-center bg-background p-4">
    <Card className="max-w-md w-full">
      <CardHeader className="text-center">
        <AlertCircle className="h-16 w-16 text-destructive mx-auto mb-4" />
        <CardTitle className="text-2xl">Доступ запрещён</CardTitle>
        <CardDescription>У вас недостаточно прав для доступа к этой странице</CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        <p className="text-center text-muted-foreground">
          Код ошибки: 403
        </p>
        <div className="flex gap-2 justify-center">
          <Link to="/">
            <Button variant="outline">
              <ArrowLeft className="mr-2 h-4 w-4" /> На главную
            </Button>
          </Link>
          <Link to="/login">
            <Button>Войти</Button>
          </Link>
        </div>
      </CardContent>
    </Card>
  </div>
);
