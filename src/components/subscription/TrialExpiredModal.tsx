import { useState } from 'react';
import {
  AlertDialog,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogHeader,
  AlertDialogTitle,
} from '@/components/ui/alert-dialog';
import { Button } from '@/components/ui/button';
import { 
  Clock, 
  CreditCard, 
  MessageCircle,
  Loader2,
  CheckCircle2
} from 'lucide-react';

interface TrialExpiredModalProps {
  open: boolean;
  companyName: string;
  onSubscribe: () => void;
}

export function TrialExpiredModal({ open, companyName, onSubscribe }: TrialExpiredModalProps) {
  const [isLoading, setIsLoading] = useState(false);

  const handleSubscribe = async () => {
    setIsLoading(true);
    try {
      onSubscribe();
    } finally {
      setIsLoading(false);
    }
  };

  const handleContact = () => {
    window.open('https://wa.me/5500000000000?text=Olá! Preciso de ajuda com minha assinatura do ChatGo.', '_blank');
  };

  return (
    <AlertDialog open={open}>
      <AlertDialogContent className="sm:max-w-md" onEscapeKeyDown={(e) => e.preventDefault()}>
        <AlertDialogHeader className="text-center">
          <div className="mx-auto w-16 h-16 rounded-full bg-amber-100 dark:bg-amber-900/30 flex items-center justify-center mb-4">
            <Clock className="w-8 h-8 text-amber-600 dark:text-amber-400" />
          </div>
          <AlertDialogTitle className="text-xl">
            Período de Teste Encerrado
          </AlertDialogTitle>
          <AlertDialogDescription asChild>
            <div className="space-y-4 text-center">
              <p className="text-muted-foreground">
                O período de teste gratuito da <strong>{companyName}</strong> chegou ao fim.
              </p>
              <p className="text-muted-foreground">
                Para continuar utilizando todas as funcionalidades do ChatGo, 
                assine um de nossos planos.
              </p>

              <div className="bg-muted/50 rounded-lg p-4 text-left space-y-2">
                <p className="text-sm font-medium">O que você terá ao assinar:</p>
                <ul className="text-sm text-muted-foreground space-y-1">
                  <li className="flex items-center gap-2">
                    <CheckCircle2 className="w-4 h-4 text-green-500" />
                    Acesso completo a todas as funcionalidades
                  </li>
                  <li className="flex items-center gap-2">
                    <CheckCircle2 className="w-4 h-4 text-green-500" />
                    Agentes de IA ilimitados
                  </li>
                  <li className="flex items-center gap-2">
                    <CheckCircle2 className="w-4 h-4 text-green-500" />
                    Usuários ilimitados
                  </li>
                  <li className="flex items-center gap-2">
                    <CheckCircle2 className="w-4 h-4 text-green-500" />
                    Suporte prioritário
                  </li>
                </ul>
              </div>

              <div className="text-xs text-muted-foreground">
                Seus dados e configurações estão salvos e serão mantidos após a assinatura.
              </div>
            </div>
          </AlertDialogDescription>
        </AlertDialogHeader>

        <div className="flex flex-col gap-2 mt-4">
          <Button 
            onClick={handleSubscribe} 
            className="w-full"
            disabled={isLoading}
          >
            {isLoading ? (
              <>
                <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                Carregando...
              </>
            ) : (
              <>
                <CreditCard className="w-4 h-4 mr-2" />
                Ver Planos e Assinar
              </>
            )}
          </Button>
          <Button 
            variant="outline" 
            onClick={handleContact}
            className="w-full"
          >
            <MessageCircle className="w-4 h-4 mr-2" />
            Falar com Suporte
          </Button>
        </div>
      </AlertDialogContent>
    </AlertDialog>
  );
}
