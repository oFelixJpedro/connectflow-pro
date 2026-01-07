import { Card, CardContent, CardHeader } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Switch } from '@/components/ui/switch';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger
} from '@/components/ui/dropdown-menu';
import {
  FileText,
  CheckCircle,
  Calendar,
  Settings,
  MoreVertical,
  Pencil,
  Trash2,
  Users,
  Phone
} from 'lucide-react';
import type { WhatsAppNotification, NotificationType } from '@/types/notifications';
import { formatPhoneForDisplay } from '@/lib/phoneUtils';

interface NotificationCardProps {
  notification: WhatsAppNotification;
  onEdit: () => void;
  onDelete: () => void;
  onToggleStatus: () => void;
  onManageRecipients: () => void;
}

const TYPE_CONFIG: Record<NotificationType | 'custom', { icon: typeof FileText; label: string; color: string }> = {
  contract_sent: {
    icon: FileText,
    label: 'Contrato Enviado',
    color: 'bg-blue-500/10 text-blue-600 dark:text-blue-400'
  },
  contract_signed: {
    icon: CheckCircle,
    label: 'Contrato Assinado',
    color: 'bg-green-500/10 text-green-600 dark:text-green-400'
  },
  meeting_scheduled: {
    icon: Calendar,
    label: 'Reunião Agendada',
    color: 'bg-purple-500/10 text-purple-600 dark:text-purple-400'
  },
  custom: {
    icon: Settings,
    label: 'Personalizada',
    color: 'bg-gray-500/10 text-gray-600 dark:text-gray-400'
  }
};

export function NotificationCard({
  notification,
  onEdit,
  onDelete,
  onToggleStatus,
  onManageRecipients
}: NotificationCardProps) {
  const config = TYPE_CONFIG[notification.notification_type] || TYPE_CONFIG.custom;
  const Icon = config.icon;
  const recipientCount = notification.recipients?.filter(r => r.is_active).length || 0;

  return (
    <Card className={`transition-all ${!notification.is_active ? 'opacity-60' : ''}`}>
      <CardHeader className="pb-3">
        <div className="flex items-start justify-between">
          <div className="flex items-center gap-3">
            <div className={`h-10 w-10 rounded-lg flex items-center justify-center ${config.color}`}>
              <Icon className="h-5 w-5" />
            </div>
            <div className="flex-1 min-w-0">
              <h4 className="font-semibold truncate">{notification.name}</h4>
              <Badge variant="secondary" className={`text-xs ${config.color}`}>
                {config.label}
              </Badge>
            </div>
          </div>
          
          <div className="flex items-center gap-2">
            <Switch
              checked={notification.is_active}
              onCheckedChange={onToggleStatus}
              aria-label="Ativar/desativar notificação"
            />
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button variant="ghost" size="icon" className="h-8 w-8">
                  <MoreVertical className="h-4 w-4" />
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end">
                <DropdownMenuItem onClick={onEdit}>
                  <Pencil className="h-4 w-4 mr-2" />
                  Editar
                </DropdownMenuItem>
                <DropdownMenuItem onClick={onManageRecipients}>
                  <Users className="h-4 w-4 mr-2" />
                  Destinatários
                </DropdownMenuItem>
                <DropdownMenuSeparator />
                <DropdownMenuItem onClick={onDelete} className="text-destructive">
                  <Trash2 className="h-4 w-4 mr-2" />
                  Excluir
                </DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>
          </div>
        </div>
      </CardHeader>

      <CardContent className="space-y-3">
        {/* Connection info */}
        <div className="flex items-center gap-2 text-sm text-muted-foreground">
          <Phone className="h-4 w-4" />
          <span>
            {notification.connection?.phone_number
              ? formatPhoneForDisplay(notification.connection.phone_number)
              : 'Conexão não encontrada'}
          </span>
        </div>

        {/* Recipients count */}
        <div className="flex items-center gap-2 text-sm">
          <Users className="h-4 w-4 text-muted-foreground" />
          <span>
            {recipientCount === 0 ? (
              <span className="text-amber-600 dark:text-amber-400">
                Nenhum destinatário configurado
              </span>
            ) : (
              <span className="text-muted-foreground">
                {recipientCount} destinatário{recipientCount !== 1 ? 's' : ''}
              </span>
            )}
          </span>
        </div>

        {/* Message preview */}
        <div className="bg-muted/50 rounded-lg p-3">
          <p className="text-xs text-muted-foreground line-clamp-3 whitespace-pre-wrap">
            {notification.message_template}
          </p>
        </div>

        {/* Quick action */}
        <Button
          variant="outline"
          size="sm"
          className="w-full"
          onClick={onManageRecipients}
        >
          <Users className="h-4 w-4 mr-2" />
          Gerenciar Destinatários
        </Button>
      </CardContent>
    </Card>
  );
}
