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
  Edit2,
  Trash2,
  Tag,
  Download,
  Upload,
  MessageSquare,
  Kanban,
  User,
  Bot,
  Clock,
  Phone,
  ArrowLeft
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { useAuth } from '@/contexts/AuthContext';
import { Skeleton } from '@/components/ui/skeleton';
import { fetchContactHistory, ContactLogEntry, ContactEventType } from '@/lib/contactHistory';

interface ContactTimelineModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  phoneNumber: string;
  contactName: string | null;
  isDeleted: boolean;
}

const getEventIcon = (eventType: ContactEventType) => {
  const iconClass = "w-4 h-4";
  const icons: Record<ContactEventType, JSX.Element> = {
    created: <Plus className={`${iconClass} text-green-600`} />,
    updated: <Edit2 className={`${iconClass} text-blue-600`} />,
    deleted: <Trash2 className={`${iconClass} text-destructive`} />,
    tag_added: <Tag className={`${iconClass} text-pink-600`} />,
    tag_removed: <Tag className={`${iconClass} text-muted-foreground`} />,
    imported: <Upload className={`${iconClass} text-cyan-600`} />,
    exported: <Download className={`${iconClass} text-indigo-600`} />,
    conversation_started: <MessageSquare className={`${iconClass} text-orange-600`} />,
    crm_added: <Kanban className={`${iconClass} text-purple-600`} />
  };
  return icons[eventType] || <Clock className={iconClass} />;
};

const getEventLabel = (eventType: ContactEventType): string => {
  const labels: Record<ContactEventType, string> = {
    created: 'Contato Criado',
    updated: 'Contato Editado',
    deleted: 'Contato Excluído',
    tag_added: 'Tag Adicionada',
    tag_removed: 'Tag Removida',
    imported: 'Importado via CSV',
    exported: 'Exportado',
    conversation_started: 'Conversa Iniciada',
    crm_added: 'Adicionado ao CRM'
  };
  return labels[eventType] || eventType;
};

const renderEventDetails = (event: ContactLogEntry) => {
  const data = event.event_data as Record<string, any>;
  
  switch (event.event_type) {
    case 'created':
      return (
        <div className="text-sm text-muted-foreground mt-1 space-y-0.5">
          <p>• Nome: {event.contact_snapshot.name || 'Não informado'}</p>
          <p>• Telefone: {event.contact_snapshot.phone_number}</p>
          {event.contact_snapshot.email && <p>• E-mail: {event.contact_snapshot.email}</p>}
          {data.connection_name && <p>• Conexão: {data.connection_name}</p>}
        </div>
      );
    
    case 'updated':
      return (
        <div className="text-sm text-muted-foreground mt-1 space-y-0.5">
          {data.changes && Array.isArray(data.changes) && data.changes.map((change: any, i: number) => (
            <p key={i}>
              • {change.field}: <span className="line-through">{change.old_value || 'vazio'}</span>
              {' → '}
              <span className="font-medium text-foreground">{change.new_value || 'vazio'}</span>
            </p>
          ))}
          {!data.changes && <p>• Dados atualizados</p>}
        </div>
      );
    
    case 'deleted':
      return (
        <div className="text-sm text-muted-foreground mt-1 space-y-0.5">
          <p>• Contato removido permanentemente</p>
          <p className="text-xs italic">Dados no momento da exclusão:</p>
          <p className="text-xs">Nome: {event.contact_snapshot.name || 'Não informado'}</p>
          <p className="text-xs">Telefone: {event.contact_snapshot.phone_number}</p>
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
            {data.tag_name || 'Tag'}
          </Badge>
        </div>
      );
    
    case 'imported':
      return (
        <div className="text-sm text-muted-foreground mt-1">
          {data.source && <p>• Fonte: {data.source}</p>}
          {data.row_number && <p>• Linha: {data.row_number}</p>}
        </div>
      );
    
    case 'conversation_started':
      return (
        <div className="text-sm text-muted-foreground mt-1">
          {data.connection_name && <p>• Conexão: {data.connection_name}</p>}
        </div>
      );
    
    case 'crm_added':
      return (
        <div className="text-sm text-muted-foreground mt-1">
          {data.board_name && <p>• Quadro: {data.board_name}</p>}
          {data.column_name && <p>• Coluna: {data.column_name}</p>}
        </div>
      );
    
    default:
      return null;
  }
};

export function ContactTimelineModal({
  open,
  onOpenChange,
  phoneNumber,
  contactName,
  isDeleted
}: ContactTimelineModalProps) {
  const { profile } = useAuth();
  const [history, setHistory] = useState<ContactLogEntry[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (open && profile?.company_id && phoneNumber) {
      setLoading(true);
      fetchContactHistory(profile.company_id, phoneNumber)
        .then(setHistory)
        .finally(() => setLoading(false));
    }
  }, [open, profile?.company_id, phoneNumber]);

  const formatPhone = (phone: string) => {
    const digits = phone.replace(/\D/g, '');
    if (digits.length === 13) {
      return `+${digits.slice(0, 2)} (${digits.slice(2, 4)}) ${digits.slice(4, 9)}-${digits.slice(9)}`;
    }
    if (digits.length === 11) {
      return `(${digits.slice(0, 2)}) ${digits.slice(2, 7)}-${digits.slice(7)}`;
    }
    return phone;
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-lg max-h-[80vh]">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Button
              variant="ghost"
              size="icon"
              className="h-8 w-8"
              onClick={() => onOpenChange(false)}
            >
              <ArrowLeft className="w-4 h-4" />
            </Button>
            <div className="flex-1">
              <div className="flex items-center gap-2">
                <Clock className="w-5 h-5" />
                <span>Timeline do Contato</span>
              </div>
              <div className="flex items-center gap-2 text-sm font-normal text-muted-foreground mt-1">
                <span className={isDeleted ? 'line-through' : ''}>
                  {contactName || 'Sem nome'}
                </span>
                {isDeleted && (
                  <Badge variant="destructive" className="text-xs">
                    Excluído
                  </Badge>
                )}
              </div>
              <div className="flex items-center gap-1 text-xs text-muted-foreground">
                <Phone className="w-3 h-3" />
                {formatPhone(phoneNumber)}
              </div>
            </div>
          </DialogTitle>
        </DialogHeader>

        <ScrollArea className="max-h-[55vh] pr-4">
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
                    {getEventIcon(event.event_type as ContactEventType)}
                  </div>
                  
                  {/* Event content */}
                  <div className="bg-muted/50 rounded-lg p-3">
                    <div className="flex items-start justify-between gap-2">
                      <div className="flex-1">
                        <span className="font-semibold text-sm">
                          {getEventLabel(event.event_type as ContactEventType)}
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
