import { useSortable } from '@dnd-kit/sortable';
import { CSS } from '@dnd-kit/utilities';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { Badge } from '@/components/ui/badge';
import { Phone, CheckSquare } from 'lucide-react';
import { cn } from '@/lib/utils';
import type { KanbanCard as KanbanCardType } from '@/hooks/useKanbanData';

interface KanbanCardProps {
  card: KanbanCardType;
  isDragging?: boolean;
  onClick: () => void;
}

const priorityConfig = {
  low: { label: 'Baixa', color: 'bg-slate-500' },
  medium: { label: 'Média', color: 'bg-blue-500' },
  high: { label: 'Alta', color: 'bg-orange-500' },
  urgent: { label: 'Urgente', color: 'bg-red-500' },
};

export function KanbanCard({ card, isDragging, onClick }: KanbanCardProps) {
  const {
    attributes,
    listeners,
    setNodeRef,
    transform,
    transition,
    isDragging: isSortableDragging,
  } = useSortable({
    id: card.id,
    data: { type: 'card', card, columnId: card.column_id },
  });

  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
  };

  const getInitials = (name: string) => {
    return name
      .split(' ')
      .map((n) => n[0])
      .join('')
      .toUpperCase()
      .slice(0, 2);
  };

  const formatPhone = (phone: string) => {
    if (!phone) return '';
    const cleaned = phone.replace(/\D/g, '');
    if (cleaned.length === 13) {
      return `+${cleaned.slice(0, 2)} (${cleaned.slice(2, 4)}) ${cleaned.slice(4, 9)}-${cleaned.slice(9)}`;
    }
    if (cleaned.length === 12) {
      return `+${cleaned.slice(0, 2)} (${cleaned.slice(2, 4)}) ${cleaned.slice(4, 8)}-${cleaned.slice(8)}`;
    }
    return phone;
  };

  const priority = priorityConfig[card.priority];
  const completedItems = card.checklist_items?.filter(i => i.completed).length || 0;
  const totalItems = card.checklist_items?.length || 0;

  return (
    <div
      ref={setNodeRef}
      style={style}
      {...attributes}
      {...listeners}
      onClick={onClick}
      className={cn(
        'bg-card rounded-lg border p-3 cursor-pointer hover:shadow-md transition-shadow',
        (isDragging || isSortableDragging) && 'opacity-50 shadow-lg'
      )}
    >
      {/* Priority Indicator */}
      <div className="flex items-center gap-2 mb-2">
        <div className={cn('w-2 h-2 rounded-full', priority.color)} />
        <span className="text-xs text-muted-foreground">{priority.label}</span>
      </div>

      {/* Contact Name */}
      <h4 className="font-medium truncate mb-1">
        {card.contact?.name || 'Sem nome'}
      </h4>

      {/* Phone */}
      <div className="flex items-center gap-1 text-xs text-muted-foreground mb-2">
        <Phone className="w-3 h-3" />
        <span>{formatPhone(card.contact?.phone_number || '')}</span>
      </div>

      {/* Tags */}
      {card.tags && card.tags.length > 0 && (
        <div className="flex flex-wrap gap-1 mb-2">
          {card.tags.slice(0, 3).map(tag => (
            <Badge
              key={tag.id}
              variant="secondary"
              className="text-xs px-1.5 py-0"
              style={{ backgroundColor: tag.color, color: '#000' }}
            >
              {tag.name}
            </Badge>
          ))}
          {card.tags.length > 3 && (
            <Badge variant="secondary" className="text-xs px-1.5 py-0">
              +{card.tags.length - 3}
            </Badge>
          )}
        </div>
      )}

      {/* Footer */}
      <div className="flex items-center justify-between mt-2 pt-2 border-t">
        {/* Checklist Progress */}
        {totalItems > 0 && (
          <div className="flex items-center gap-1 text-xs text-muted-foreground">
            <CheckSquare className="w-3 h-3" />
            <span>{completedItems}/{totalItems}</span>
          </div>
        )}
        
        {totalItems === 0 && <div />}

        {/* Assigned User */}
        {card.assigned_user ? (
          <Avatar className="w-6 h-6">
            <AvatarImage src={card.assigned_user.avatar_url || undefined} />
            <AvatarFallback className="text-xs">
              {getInitials(card.assigned_user.full_name)}
            </AvatarFallback>
          </Avatar>
        ) : (
          <div className="w-6 h-6 rounded-full bg-muted border-2 border-dashed border-muted-foreground/30" />
        )}
      </div>
    </div>
  );
}
