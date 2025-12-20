import { Badge } from '@/components/ui/badge';
import { cn } from '@/lib/utils';
import type { User } from '@/types';

interface AssignmentBadgeProps {
  assignedUser?: User | null;
  currentUserId?: string;
  className?: string;
}

export function AssignmentBadge({ assignedUser, currentUserId, className }: AssignmentBadgeProps) {

  // Não atribuída - Vermelho pastel
  if (!assignedUser) {
    return (
      <Badge 
        variant="outline" 
        className={cn(
          "text-xs px-1.5 py-0 h-5 flex-shrink-0 max-w-[100px] truncate border-0 text-red-600",
          className
        )}
        style={{ backgroundColor: '#FECACA' }}
        title="Sem responsável"
      >
        Sem responsável
      </Badge>
    );
  }

  // Atribuída ao usuário logado
  if (assignedUser.id === currentUserId) {
    return (
      <Badge 
        variant="default" 
        className={cn(
          "text-xs px-1.5 py-0 h-5 bg-success/20 text-success border-0 flex-shrink-0 max-w-[60px] truncate",
          className
        )}
        title="Sua conversa"
      >
        Sua
      </Badge>
    );
  }

  const displayName = assignedUser.fullName?.split(' ')[0] || 'Atribuída';
  
  // Atribuída a outro - Amarelo pastel
  return (
    <Badge 
      variant="outline" 
      className={cn(
        "text-xs px-1.5 py-0 h-5 bg-warning/20 text-warning border-0 flex-shrink-0 max-w-[80px] truncate",
        className
      )}
      title={assignedUser.fullName || 'Atribuída'}
    >
      {displayName}
    </Badge>
  );
}
