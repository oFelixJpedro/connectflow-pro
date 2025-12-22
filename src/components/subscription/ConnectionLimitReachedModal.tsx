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
import { Wifi, MessageCircle } from 'lucide-react';

interface ConnectionLimitReachedModalProps {
  open: boolean;
  onClose: () => void;
  currentConnections: number;
  maxConnections: number;
}

export function ConnectionLimitReachedModal({ 
  open, 
  onClose, 
  currentConnections, 
  maxConnections 
}: ConnectionLimitReachedModalProps) {
  const handleContact = () => {
    window.open('https://wa.me/5500000000000?text=Olá! Gostaria de adicionar mais conexões WhatsApp ao meu plano do ChatGo.', '_blank');
  };

  return (
    <AlertDialog open={open} onOpenChange={onClose}>
      <AlertDialogContent className="sm:max-w-md">
        <AlertDialogHeader className="text-center">
          <div className="mx-auto w-16 h-16 rounded-full bg-amber-100 dark:bg-amber-900/30 flex items-center justify-center mb-4">
            <Wifi className="w-8 h-8 text-amber-600 dark:text-amber-400" />
          </div>
          <AlertDialogTitle className="text-xl">
            Limite de Conexões Atingido
          </AlertDialogTitle>
          <AlertDialogDescription asChild>
            <div className="space-y-4 text-center">
              <p className="text-muted-foreground">
                Você está utilizando <strong>{currentConnections}</strong> de <strong>{maxConnections}</strong> conexões WhatsApp disponíveis no seu plano.
              </p>
              <p className="text-muted-foreground">
                Para adicionar mais conexões, entre em contato com nosso suporte.
              </p>
              <div className="bg-muted/50 rounded-lg p-4 text-center">
                <p className="text-sm font-medium">Conexão Adicional</p>
                <p className="text-2xl font-bold text-primary">R$ 97,00<span className="text-sm font-normal text-muted-foreground">/mês</span></p>
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
            Contratar Mais Conexões
          </AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  );
}
