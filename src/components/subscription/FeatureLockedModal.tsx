import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '@/components/ui/alert-dialog';
import { Lock, MessageCircle, TrendingUp, CheckCircle2 } from 'lucide-react';

interface FeatureLockedModalProps {
  open: boolean;
  onClose: () => void;
  featureName: string;
  featureDescription: string;
  price: string;
  benefits: string[];
}

export function FeatureLockedModal({ 
  open, 
  onClose, 
  featureName,
  featureDescription,
  price,
  benefits
}: FeatureLockedModalProps) {
  const handleContact = () => {
    window.open(`https://wa.me/5500000000000?text=Olá! Gostaria de contratar o recurso "${featureName}" no ChatGo.`, '_blank');
  };

  return (
    <AlertDialog open={open} onOpenChange={onClose}>
      <AlertDialogContent className="sm:max-w-md">
        <AlertDialogHeader className="text-center">
          <div className="mx-auto w-16 h-16 rounded-full bg-primary/10 flex items-center justify-center mb-4">
            <Lock className="w-8 h-8 text-primary" />
          </div>
          <AlertDialogTitle className="text-xl">
            {featureName}
          </AlertDialogTitle>
          <AlertDialogDescription asChild>
            <div className="space-y-4 text-center">
              <p className="text-muted-foreground">
                {featureDescription}
              </p>
              
              <div className="bg-muted/50 rounded-lg p-4 text-left space-y-3">
                <p className="text-sm font-medium text-center">O que você terá:</p>
                <ul className="text-sm text-muted-foreground space-y-2">
                  {benefits.map((benefit, index) => (
                    <li key={index} className="flex items-start gap-2">
                      <CheckCircle2 className="w-4 h-4 text-green-500 mt-0.5 flex-shrink-0" />
                      <span>{benefit}</span>
                    </li>
                  ))}
                </ul>
              </div>

              <div className="bg-primary/5 rounded-lg p-4 text-center border border-primary/20">
                <p className="text-sm font-medium">Valor Adicional</p>
                <p className="text-2xl font-bold text-primary">{price}<span className="text-sm font-normal text-muted-foreground">/mês</span></p>
              </div>
            </div>
          </AlertDialogDescription>
        </AlertDialogHeader>
        <AlertDialogFooter className="flex-col sm:flex-row gap-2">
          <AlertDialogCancel className="w-full sm:w-auto">
            Fechar
          </AlertDialogCancel>
          <AlertDialogAction onClick={handleContact} className="w-full sm:w-auto">
            <MessageCircle className="w-4 h-4 mr-2" />
            Contratar Recurso
          </AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  );
}
