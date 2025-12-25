import { AlertTriangle, Lock, CheckCircle, ShieldOff } from 'lucide-react';
import { cn } from '@/lib/utils';
import type { Conversation, User } from '@/types';

interface MessageInputBlockerProps {
  conversation: Conversation;
  currentUserId: string;
}

interface BlockInfo {
  blocked: boolean;
  message: string;
  icon: React.ReactNode;
  variant: 'warning' | 'error' | 'info';
}

export function useMessageBlocker(
  conversation: Conversation | null,
  currentUserId: string
): BlockInfo {
  if (!conversation) {
    return {
      blocked: true,
      message: 'Selecione uma conversa',
      icon: <Lock className="w-4 h-4" />,
      variant: 'info',
    };
  }

  // Contato bloqueado
  if (conversation.status === 'blocked') {
    return {
      blocked: true,
      message: 'Este contato está bloqueado',
      icon: <ShieldOff className="w-4 h-4" />,
      variant: 'error',
    };
  }

  // Conversa fechada
  if (conversation.status === 'closed') {
    return {
      blocked: true,
      message: 'Esta conversa está fechada',
      icon: <CheckCircle className="w-4 h-4" />,
      variant: 'info',
    };
  }

  // Não atribuída
  if (!conversation.assignedUserId) {
    return {
      blocked: true,
      message: 'Atribua esta conversa para responder',
      icon: <AlertTriangle className="w-4 h-4" />,
      variant: 'warning',
    };
  }

  // Atribuída a outro
  if (conversation.assignedUserId !== currentUserId) {
    const assignedName = conversation.assignedUser?.fullName?.split(' ')[0] || 'outro atendente';
    return {
      blocked: true,
      message: `Esta conversa está sendo atendida por ${assignedName}`,
      icon: <Lock className="w-4 h-4" />,
      variant: 'error',
    };
  }

  // Pode responder
  return {
    blocked: false,
    message: '',
    icon: null,
    variant: 'info',
  };
}

export function MessageInputBlocker({ conversation, currentUserId }: MessageInputBlockerProps) {
  const blockInfo = useMessageBlocker(conversation, currentUserId);

  if (!blockInfo.blocked) {
    return null;
  }

  const variantStyles = {
    warning: 'bg-warning/10 text-warning border-warning/30',
    error: 'bg-destructive/10 text-destructive border-destructive/30',
    info: 'bg-muted text-muted-foreground border-muted',
  };

  return (
    <div
      className={cn(
        'flex items-center gap-2 px-3 py-2 text-sm rounded-md border mb-2',
        variantStyles[blockInfo.variant]
      )}
    >
      {blockInfo.icon}
      <span>{blockInfo.message}</span>
    </div>
  );
}
