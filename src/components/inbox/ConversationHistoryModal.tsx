import { useState, useEffect } from 'react';
import { format } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Badge } from '@/components/ui/badge';
import {
  Plus,
  UserPlus,
  ArrowRightLeft,
  Building2,
  ListOrdered,
  Tag,
  TagIcon,
  Smartphone,
  CheckCircle,
  RotateCcw,
  XCircle,
  Bot,
  User,
  AlertTriangle,
  Clock
} from 'lucide-react';
import { fetchConversationHistory, ConversationHistoryEntry, ConversationEventType } from '@/lib/conversationHistory';
import { Skeleton } from '@/components/ui/skeleton';

interface ConversationHistoryModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  conversationId: string;
  contactName?: string;
}

const getEventIcon = (eventType: ConversationEventType) => {
  const iconClass = "w-4 h-4";
  const icons: Record<ConversationEventType, JSX.Element> = {
    created: <Plus className={`${iconClass} text-green-600`} />,
    assigned: <UserPlus className={`${iconClass} text-blue-600`} />,
    transferred: <ArrowRightLeft className={`${iconClass} text-orange-600`} />,
    department_changed: <Building2 className={`${iconClass} text-purple-600`} />,
    status_changed: <ListOrdered className={`${iconClass} text-indigo-600`} />,
    tag_added: <Tag className={`${iconClass} text-pink-600`} />,
    tag_removed: <TagIcon className={`${iconClass} text-muted-foreground`} />,
    connection_changed: <Smartphone className={`${iconClass} text-cyan-600`} />,
    priority_changed: <AlertTriangle className={`${iconClass} text-yellow-600`} />,
    resolved: <CheckCircle className={`${iconClass} text-green-600`} />,
    reopened: <RotateCcw className={`${iconClass} text-yellow-600`} />,
    closed: <XCircle className={`${iconClass} text-muted-foreground`} />
  };
  return icons[eventType] || <Clock className={iconClass} />;
};

const getEventLabel = (eventType: ConversationEventType): string => {
  const labels: Record<ConversationEventType, string> = {
    created: 'Conversa Criada',
    assigned: 'Atribuída',
    transferred: 'Transferida',
    department_changed: 'Departamento Alterado',
    status_changed: 'Status Alterado',
    tag_added: 'Tag Adicionada',
    tag_removed: 'Tag Removida',
    connection_changed: 'Conexão Alterada',
    priority_changed: 'Prioridade Alterada',
    resolved: 'Resolvida',
    reopened: 'Reaberta',
    closed: 'Fechada'
  };
  return labels[eventType] || eventType;
};

const renderEventDetails = (event: ConversationHistoryEntry) => {
  const data = event.event_data as Record<string, string>;
  
  switch (event.event_type) {
    case 'created':
      return (
        <div className="text-sm text-muted-foreground mt-1 space-y-0.5">
          {data.connection_name && <p>• Conexão: {data.connection_name}</p>}
          {data.department_name && <p>• Departamento: {data.department_name}</p>}
          {data.contact_name && <p>• Contato: {data.contact_name}</p>}
          {data.contact_phone && <p>• Telefone: {data.contact_phone}</p>}
        </div>
      );
    
    case 'assigned':
      return (
        <div className="text-sm text-muted-foreground mt-1">
          <p>• Para: <span className="font-medium text-foreground">{data.to_user_name}</span></p>
        </div>
      );
    
    case 'transferred':
      return (
        <div className="text-sm text-muted-foreground mt-1 space-y-0.5">
          <p>• De: <span className="font-medium text-foreground">{data.from_user_name}</span></p>
          <p>• Para: <span className="font-medium text-foreground">{data.to_user_name}</span></p>
          {data.reason && <p>• Motivo: {data.reason}</p>}
        </div>
      );
    
    case 'department_changed':
      return (
        <div className="text-sm text-muted-foreground mt-1 space-y-0.5">
          <p>• De: <span className="font-medium text-foreground">{data.from_department_name}</span></p>
          <p>• Para: <span className="font-medium text-foreground">{data.to_department_name}</span></p>
        </div>
      );
    
    case 'status_changed':
      return (
        <div className="text-sm text-muted-foreground mt-1">
          <p>
            • <span className="font-medium text-foreground">{data.from_label || data.from_status}</span>
            {' → '}
            <span className="font-medium text-foreground">{data.to_label || data.to_status}</span>
          </p>
        </div>
      );
    
    case 'tag_added':
    case 'tag_removed':
      return (
        <div className="text-sm text-muted-foreground mt-1 flex items-center gap-2">
          <span>•</span>
          <Badge 
            variant="outline" 
            style={{ 
              backgroundColor: data.tag_color ? `${data.tag_color}20` : undefined,
              borderColor: data.tag_color || undefined
            }}
          >
            {data.tag_name}
          </Badge>
        </div>
      );
    
    case 'priority_changed':
      return (
        <div className="text-sm text-muted-foreground mt-1">
          <p>
            • <span className="font-medium text-foreground">{data.from_priority}</span>
            {' → '}
            <span className="font-medium text-foreground">{data.to_priority}</span>
          </p>
        </div>
      );
    
    case 'connection_changed':
      return (
        <div className="text-sm text-muted-foreground mt-1 space-y-0.5">
          <p>• De: <span className="font-medium text-foreground">{data.from_connection_name}</span></p>
          <p>• Para: <span className="font-medium text-foreground">{data.to_connection_name}</span></p>
        </div>
      );
    
    default:
      return null;
  }
};

export function ConversationHistoryModal({
  open,
  onOpenChange,
  conversationId,
  contactName
}: ConversationHistoryModalProps) {
  const [history, setHistory] = useState<ConversationHistoryEntry[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (open && conversationId) {
      setLoading(true);
      fetchConversationHistory(conversationId)
        .then(setHistory)
        .finally(() => setLoading(false));
    }
  }, [open, conversationId]);

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-lg max-h-[80vh]">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Clock className="w-5 h-5" />
            Histórico da Conversa
            {contactName && (
              <span className="text-muted-foreground font-normal">
                - {contactName}
              </span>
            )}
          </DialogTitle>
        </DialogHeader>

        <ScrollArea className="max-h-[60vh] pr-4">
          {loading ? (
            <div className="space-y-4">
              {[1, 2, 3].map((i) => (
                <div key={i} className="flex gap-3">
                  <Skeleton className="w-8 h-8 rounded-full flex-shrink-0" />
                  <div className="flex-1 space-y-2">
                    <Skeleton className="h-4 w-32" />
                    <Skeleton className="h-3 w-48" />
                    <Skeleton className="h-3 w-24" />
                  </div>
                </div>
              ))}
            </div>
          ) : history.length === 0 ? (
            <div className="text-center py-8 text-muted-foreground">
              <Clock className="w-12 h-12 mx-auto mb-3 opacity-50" />
              <p>Nenhum histórico registrado</p>
              <p className="text-sm">
                Eventos futuros aparecerão aqui
              </p>
            </div>
          ) : (
            <div className="relative">
              {history.map((event, index) => (
                <div 
                  key={event.id} 
                  className="relative pl-10 pb-6 last:pb-0"
                >
                  {/* Timeline line */}
                  {index < history.length - 1 && (
                    <div className="absolute left-[15px] top-8 h-[calc(100%-16px)] w-0.5 bg-border" />
                  )}
                  
                  {/* Event icon */}
                  <div className="absolute left-0 top-0 w-8 h-8 rounded-full bg-background border-2 border-border flex items-center justify-center">
                    {getEventIcon(event.event_type as ConversationEventType)}
                  </div>
                  
                  {/* Event content */}
                  <div className="bg-muted/50 rounded-lg p-3">
                    <div className="flex items-start justify-between gap-2">
                      <div className="flex-1">
                        <span className="font-semibold text-sm">
                          {getEventLabel(event.event_type as ConversationEventType)}
                        </span>
                        {renderEventDetails(event)}
                      </div>
                      
                      <div className="text-xs text-muted-foreground whitespace-nowrap">
                        {format(new Date(event.created_at), "dd/MM/yy HH:mm", { locale: ptBR })}
                      </div>
                    </div>
                    
                    <div className="text-xs text-muted-foreground mt-2 flex items-center gap-1">
                      {event.is_automatic ? (
                        <>
                          <Bot className="w-3 h-3" />
                          <span>Automático</span>
                        </>
                      ) : (
                        <>
                          <User className="w-3 h-3" />
                          <span>por {event.performed_by_name}</span>
                        </>
                      )}
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </ScrollArea>
      </DialogContent>
    </Dialog>
  );
}
