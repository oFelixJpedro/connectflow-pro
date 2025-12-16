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
          "text-xs px-1.5 py-0 h-5 bg-destructive/20 text-destructive border-destructive/30",
          className
        )}
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
          "text-xs px-1.5 py-0 h-5 bg-success/20 text-success border-success/30",
          className
        )}
      >
        Sua
      </Badge>
    );
  }

  // Atribuída a outro - Amarelo pastel
  return (
    <Badge 
      variant="outline" 
      className={cn(
        "text-xs px-1.5 py-0 h-5 bg-warning/20 text-warning border-warning/30",
        className
      )}
    >
      {assignedUser.fullName?.split(' ')[0] || 'Atribuída'}
    </Badge>
  );
}
