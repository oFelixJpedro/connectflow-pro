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
import { AlertTriangle, CalendarClock } from 'lucide-react';

interface ScheduledMessageWarningModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  pendingCount: number;
  onConfirm: () => void;
  onCancel: () => void;
}

export function ScheduledMessageWarningModal({
  open,
  onOpenChange,
  pendingCount,
  onConfirm,
  onCancel,
}: ScheduledMessageWarningModalProps) {
  return (
    <AlertDialog open={open} onOpenChange={onOpenChange}>
      <AlertDialogContent>
        <AlertDialogHeader>
          <AlertDialogTitle className="flex items-center gap-2">
            <AlertTriangle className="w-5 h-5 text-amber-500" />
            Atenção: Mensagens Agendadas
          </AlertDialogTitle>
          <AlertDialogDescription asChild>
            <div className="space-y-3">
              <div className="flex items-center gap-2 text-foreground">
                <CalendarClock className="w-4 h-4" />
                <span>
                  Este contato possui <strong>{pendingCount}</strong> mensage{pendingCount === 1 ? 'm' : 'ns'} agendada{pendingCount === 1 ? '' : 's'}.
                </span>
              </div>
              <p>
                Ao migrar o contato para outra conexão/departamento, as mensagens agendadas serão enviadas pela <strong>NOVA</strong> conexão e departamento, não pela conexão atual.
              </p>
              <p className="text-muted-foreground">
                Deseja continuar com a migração?
              </p>
            </div>
          </AlertDialogDescription>
        </AlertDialogHeader>
        <AlertDialogFooter>
          <AlertDialogCancel onClick={onCancel}>Cancelar</AlertDialogCancel>
          <AlertDialogAction onClick={onConfirm}>
            Confirmar Migração
          </AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  );
}
