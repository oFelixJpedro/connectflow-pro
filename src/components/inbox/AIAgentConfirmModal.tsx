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
import { Loader2, StopCircle, RotateCcw } from 'lucide-react';

interface AIAgentConfirmModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onConfirm: () => Promise<void>;
  isLoading?: boolean;
  type: 'stop' | 'restart';
}

const CONFIG = {
  stop: {
    title: 'Parar IA Permanentemente',
    description: 'Tem certeza que deseja parar a IA permanentemente nesta conversa? A IA não responderá mais automaticamente até que você clique em "Iniciar" novamente.',
    warning: 'Esta ação pode ser desfeita a qualquer momento clicando em "Iniciar".',
    confirmText: 'Parar IA',
    icon: StopCircle,
    iconColor: 'text-red-500',
    buttonClass: 'bg-red-500 hover:bg-red-600 text-white',
  },
  restart: {
    title: 'Reiniciar IA',
    description: 'Tem certeza que deseja reiniciar a IA nesta conversa? Isso irá limpar todo o histórico de contexto da IA para este contato.',
    warning: 'A IA perderá a "memória" desta conversa e começará como se fosse o primeiro contato.',
    confirmText: 'Reiniciar IA',
    icon: RotateCcw,
    iconColor: 'text-blue-500',
    buttonClass: 'bg-blue-500 hover:bg-blue-600 text-white',
  },
};

export function AIAgentConfirmModal({
  open,
  onOpenChange,
  onConfirm,
  isLoading = false,
  type,
}: AIAgentConfirmModalProps) {
  const config = CONFIG[type];
  const Icon = config.icon;

  const handleConfirm = async () => {
    await onConfirm();
    onOpenChange(false);
  };

  return (
    <AlertDialog open={open} onOpenChange={onOpenChange}>
      <AlertDialogContent>
        <AlertDialogHeader>
          <AlertDialogTitle className="flex items-center gap-2">
            <Icon className={`w-5 h-5 ${config.iconColor}`} />
            {config.title}
          </AlertDialogTitle>
          <AlertDialogDescription className="space-y-2">
            <p>{config.description}</p>
            <p className="text-muted-foreground text-sm font-medium">
              ⚠️ {config.warning}
            </p>
          </AlertDialogDescription>
        </AlertDialogHeader>
        <AlertDialogFooter>
          <AlertDialogCancel disabled={isLoading}>Cancelar</AlertDialogCancel>
          <AlertDialogAction
            onClick={handleConfirm}
            disabled={isLoading}
            className={config.buttonClass}
          >
            {isLoading ? (
              <>
                <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                Processando...
              </>
            ) : (
              <>
                <Icon className="w-4 h-4 mr-2" />
                {config.confirmText}
              </>
            )}
          </AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  );
}
