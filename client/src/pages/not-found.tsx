import { useTranslation } from "react-i18next";
import { Card, CardContent } from "@/components/ui/card";
import { AlertCircle } from "lucide-react";

export default function NotFound() {
  const { t } = useTranslation();
  return (
    <div className="min-h-screen w-full flex items-center justify-center bg-background">
      <Card className="w-full max-w-md mx-4 bg-white dark:bg-gradient-to-br dark:from-purple-900/95 dark:to-purple-800/95 dark:border-pink-400/20">
        <CardContent className="pt-6">
          <div className="flex mb-4 gap-2">
            <AlertCircle className="h-8 w-8 text-pink-400" />
            <h1 className="text-2xl font-bold text-pink-200">{t('notFound.title')}</h1>
          </div>

          <p className="mt-4 text-sm text-pink-200/70">
            {t('notFound.didYouForget')}
          </p>
        </CardContent>
      </Card>
    </div>
  );
}
