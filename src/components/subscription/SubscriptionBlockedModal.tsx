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
  XCircle, 
  CreditCard, 
  MessageCircle,
  Loader2
} from 'lucide-react';

interface SubscriptionBlockedModalProps {
  open: boolean;
  companyName: string;
  reason: 'cancelled' | 'expired';
  onSubscribe: () => void;
}

export function SubscriptionBlockedModal({ 
  open, 
  companyName, 
  reason,
  onSubscribe 
}: SubscriptionBlockedModalProps) {
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

  const title = reason === 'cancelled' 
    ? 'Assinatura Cancelada' 
    : 'Assinatura Expirada';

  const description = reason === 'cancelled'
    ? 'Sua assinatura foi cancelada. Para continuar utilizando o ChatGo, reative sua assinatura.'
    : 'Sua assinatura expirou. Para continuar utilizando o ChatGo, renove sua assinatura.';

  return (
    <AlertDialog open={open}>
      <AlertDialogContent className="sm:max-w-md" onEscapeKeyDown={(e) => e.preventDefault()}>
        <AlertDialogHeader className="text-center">
          <div className="mx-auto w-16 h-16 rounded-full bg-destructive/10 flex items-center justify-center mb-4">
            <XCircle className="w-8 h-8 text-destructive" />
          </div>
          <AlertDialogTitle className="text-xl">
            {title}
          </AlertDialogTitle>
          <AlertDialogDescription asChild>
            <div className="space-y-4 text-center">
              <p className="text-muted-foreground">
                <strong>{companyName}</strong>
              </p>
              <p className="text-muted-foreground">
                {description}
              </p>

              <div className="text-xs text-muted-foreground">
                Seus dados e configurações estão salvos e serão mantidos após a reativação.
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
                {reason === 'cancelled' ? 'Reativar Assinatura' : 'Renovar Assinatura'}
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
