import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { Badge } from '@/components/ui/badge';
import { cn } from '@/lib/utils';
import type { User } from '@/types';

interface AssignmentBadgeProps {
  assignedUser?: User | null;
  currentUserId?: string;
  className?: string;
}

export function AssignmentBadge({ assignedUser, currentUserId, className }: AssignmentBadgeProps) {
  const getInitials = (name?: string) => {
    if (!name) return '?';
    return name
      .split(' ')
      .map((n) => n[0])
      .join('')
      .toUpperCase()
      .slice(0, 2);
  };

  // Não atribuída
  if (!assignedUser) {
    return (
      <Badge 
        variant="outline" 
        className={cn(
          "text-xs px-1.5 py-0 h-5 bg-muted/50 text-muted-foreground border-muted",
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

  // Atribuída a outro
  return (
    <div className={cn("flex items-center gap-1", className)}>
      <Avatar className="w-4 h-4">
        <AvatarImage src={assignedUser.avatarUrl} className="object-cover object-top" />
        <AvatarFallback className="text-[8px] bg-muted">
          {getInitials(assignedUser.fullName)}
        </AvatarFallback>
      </Avatar>
      <span className="text-xs text-muted-foreground truncate max-w-[80px]">
        {assignedUser.fullName?.split(' ')[0] || 'Atendente'}
      </span>
    </div>
  );
}
