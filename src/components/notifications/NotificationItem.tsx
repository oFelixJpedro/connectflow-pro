import { formatDistanceToNow } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import { cn } from '@/lib/utils';
import { MessageSquare, AtSign, UserPlus, ArrowRightLeft, Lock } from 'lucide-react';

export interface NotificationData {
  id: string;
  type: 'message' | 'mention' | 'assignment' | 'transfer';
  source: 'whatsapp' | 'internal';
  title: string;
  preview: string;
  createdAt: string;
  isRead: boolean;
  
  // Para redirecionamento
  conversationId?: string;
  roomId?: string;
  messageId?: string;
  
  // Acesso
  hasAccess: boolean;
  accessDeniedReason?: 'no_connection' | 'no_department' | 'not_assigned';
  
  // Dados extras
  mentionerName?: string;
  contactName?: string;
}

interface NotificationItemProps {
  notification: NotificationData;
  onClick: (notification: NotificationData) => void;
}

const typeIcons = {
  message: MessageSquare,
  mention: AtSign,
  assignment: UserPlus,
  transfer: ArrowRightLeft,
};

export function NotificationItem({ notification, onClick }: NotificationItemProps) {
  const Icon = typeIcons[notification.type];
  
  const timeAgo = formatDistanceToNow(new Date(notification.createdAt), {
    addSuffix: true,
    locale: ptBR,
  });

  return (
    <button
      onClick={() => onClick(notification)}
      className={cn(
        'w-full p-3 flex items-start gap-3 text-left transition-colors rounded-lg',
        'hover:bg-muted/50',
        !notification.isRead && 'bg-primary/5',
        !notification.hasAccess && 'opacity-75'
      )}
    >
      {/* Icon */}
      <div className={cn(
        'w-9 h-9 rounded-full flex items-center justify-center flex-shrink-0',
        notification.type === 'mention' 
          ? 'bg-violet-100 dark:bg-violet-900/30 text-violet-600 dark:text-violet-400'
          : notification.source === 'internal'
            ? 'bg-emerald-100 dark:bg-emerald-900/30 text-emerald-600 dark:text-emerald-400'
            : 'bg-blue-100 dark:bg-blue-900/30 text-blue-600 dark:text-blue-400'
      )}>
        <Icon className="w-4 h-4" />
      </div>

      {/* Content */}
      <div className="flex-1 min-w-0 space-y-1">
        <div className="flex items-center gap-2">
          <p className={cn(
            'text-sm truncate',
            !notification.isRead && 'font-semibold'
          )}>
            {notification.title}
          </p>
          {!notification.hasAccess && (
            <Lock className="w-3 h-3 text-muted-foreground flex-shrink-0" />
          )}
        </div>
        <p className="text-xs text-muted-foreground line-clamp-2">
          {notification.preview}
        </p>
        <p className="text-xs text-muted-foreground/70">
          {timeAgo}
        </p>
      </div>

      {/* Unread indicator */}
      {!notification.isRead && (
        <div className="w-2 h-2 rounded-full bg-red-500 flex-shrink-0 mt-2" />
      )}
    </button>
  );
}
