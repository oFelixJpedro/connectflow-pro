import { Eye, Lock } from 'lucide-react';
import { Alert, AlertDescription } from '@/components/ui/alert';

export function RestrictedAccessBanner() {
  return (
    <Alert className="bg-amber-50 border-amber-200 dark:bg-amber-950/30 dark:border-amber-800">
      <Eye className="h-4 w-4 text-amber-600 dark:text-amber-400" />
      <AlertDescription className="text-amber-800 dark:text-amber-200">
        <span className="font-medium">Visualização restrita</span> — você vê apenas conversas atribuídas a você
      </AlertDescription>
    </Alert>
  );
}
