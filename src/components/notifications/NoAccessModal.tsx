import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Lock, Building2, User } from 'lucide-react';

export type AccessDeniedReason = 'no_connection' | 'no_department' | 'not_assigned';

interface NoAccessModalProps {
  isOpen: boolean;
  onClose: () => void;
  reason: AccessDeniedReason;
}

const accessDeniedConfig: Record<AccessDeniedReason, {
  title: string;
  description: string;
  icon: typeof Lock;
}> = {
  no_connection: {
    title: 'Sem acesso à conexão',
    description: 'Você não tem permissão para acessar conversas desta conexão do WhatsApp. Entre em contato com um administrador para solicitar acesso.',
    icon: Lock,
  },
  no_department: {
    title: 'Sem acesso ao departamento',
    description: 'Você não tem permissão para acessar conversas deste departamento. Entre em contato com um administrador para solicitar acesso.',
    icon: Building2,
  },
  not_assigned: {
    title: 'Conversa não atribuída',
    description: 'Esta conversa não foi atribuída para você. Você só pode visualizar conversas da sua fila "Minhas".',
    icon: User,
  },
};

export function NoAccessModal({ isOpen, onClose, reason }: NoAccessModalProps) {
  const config = accessDeniedConfig[reason];
  const Icon = config.icon;

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader className="text-center sm:text-left">
          <div className="flex justify-center sm:justify-start mb-4">
            <div className="w-12 h-12 rounded-full bg-destructive/10 flex items-center justify-center">
              <Icon className="w-6 h-6 text-destructive" />
            </div>
          </div>
          <DialogTitle>{config.title}</DialogTitle>
          <DialogDescription className="text-sm">
            {config.description}
          </DialogDescription>
        </DialogHeader>
        <DialogFooter className="sm:justify-end">
          <Button variant="outline" onClick={onClose}>
            Entendi
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
