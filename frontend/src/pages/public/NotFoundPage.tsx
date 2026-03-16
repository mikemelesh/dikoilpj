import { Link } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { FileQuestion, ArrowLeft } from "lucide-react";

export const NotFoundPage = () => (
  <div className="min-h-screen flex items-center justify-center bg-background p-4">
    <Card className="max-w-md w-full">
      <CardHeader className="text-center">
        <FileQuestion className="h-16 w-16 text-muted-foreground mx-auto mb-4" />
        <CardTitle className="text-2xl">Страница не найдена</CardTitle>
        <CardDescription>Запрошенная страница не существует или была перемещена</CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        <p className="text-center text-muted-foreground">
          Код ошибки: 404
        </p>
        <div className="flex gap-2 justify-center">
          <Link to="/">
            <Button>
              <ArrowLeft className="mr-2 h-4 w-4" /> На главную
            </Button>
          </Link>
        </div>
      </CardContent>
    </Card>
  </div>
);
