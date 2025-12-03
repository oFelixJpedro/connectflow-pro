import { useState } from 'react';
import { 
  X, 
  Phone, 
  Mail, 
  Calendar, 
  Tag, 
  Edit2,
  MessageSquare,
  Clock,
  Plus,
  ChevronDown,
  ChevronUp
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { Separator } from '@/components/ui/separator';
import { Textarea } from '@/components/ui/textarea';
import { ScrollArea } from '@/components/ui/scroll-area';
import {
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from '@/components/ui/collapsible';
import { cn } from '@/lib/utils';
import type { Conversation } from '@/types';
import { format } from 'date-fns';
import { ptBR } from 'date-fns/locale';

interface ContactPanelProps {
  conversation: Conversation | null;
  onClose: () => void;
}

export function ContactPanel({ conversation, onClose }: ContactPanelProps) {
  const [notesOpen, setNotesOpen] = useState(true);
  const [historyOpen, setHistoryOpen] = useState(true);
  const [notes, setNotes] = useState(conversation?.contact?.notes || '');

  if (!conversation) {
    return null;
  }

  const contact = conversation.contact;

  const getInitials = (name?: string) => {
    if (!name) return '?';
    return name
      .split(' ')
      .map((n) => n[0])
      .join('')
      .toUpperCase()
      .slice(0, 2);
  };

  const formatDate = (date?: string) => {
    if (!date) return '-';
    return format(new Date(date), "dd/MM/yyyy 'às' HH:mm", { locale: ptBR });
  };

  return (
    <div className="w-80 border-l border-border bg-card flex flex-col h-full">
      {/* Header */}
      <div className="h-16 px-4 border-b border-border flex items-center justify-between">
        <h3 className="font-semibold text-foreground">Detalhes do Contato</h3>
        <Button variant="ghost" size="icon" onClick={onClose}>
          <X className="w-4 h-4" />
        </Button>
      </div>

      <ScrollArea className="flex-1">
        <div className="p-4 space-y-6">
          {/* Contact Info */}
          <div className="flex flex-col items-center text-center">
            <Avatar className="w-20 h-20">
              <AvatarImage src={contact?.avatarUrl} />
              <AvatarFallback className="bg-primary/10 text-primary text-xl font-medium">
                {getInitials(contact?.name)}
              </AvatarFallback>
            </Avatar>
            <h4 className="mt-3 font-semibold text-foreground">
              {contact?.name || 'Sem nome'}
            </h4>
            <p className="text-sm text-muted-foreground">
              {contact?.phoneNumber}
            </p>
            <div className="flex items-center gap-2 mt-3">
              <Button variant="outline" size="sm">
                <Edit2 className="w-4 h-4 mr-2" />
                Editar
              </Button>
            </div>
          </div>

          <Separator />

          {/* Contact Details */}
          <div className="space-y-3">
            <h5 className="text-sm font-medium text-foreground">Informações</h5>
            
            <div className="space-y-3">
              <div className="flex items-center gap-3 text-sm">
                <div className="w-8 h-8 bg-muted rounded-lg flex items-center justify-center">
                  <Phone className="w-4 h-4 text-muted-foreground" />
                </div>
                <div>
                  <p className="text-xs text-muted-foreground">Telefone</p>
                  <p className="text-foreground">{contact?.phoneNumber}</p>
                </div>
              </div>

              {contact?.email && (
                <div className="flex items-center gap-3 text-sm">
                  <div className="w-8 h-8 bg-muted rounded-lg flex items-center justify-center">
                    <Mail className="w-4 h-4 text-muted-foreground" />
                  </div>
                  <div>
                    <p className="text-xs text-muted-foreground">E-mail</p>
                    <p className="text-foreground">{contact.email}</p>
                  </div>
                </div>
              )}

              <div className="flex items-center gap-3 text-sm">
                <div className="w-8 h-8 bg-muted rounded-lg flex items-center justify-center">
                  <Calendar className="w-4 h-4 text-muted-foreground" />
                </div>
                <div>
                  <p className="text-xs text-muted-foreground">Primeiro contato</p>
                  <p className="text-foreground">{formatDate(contact?.createdAt)}</p>
                </div>
              </div>

              <div className="flex items-center gap-3 text-sm">
                <div className="w-8 h-8 bg-muted rounded-lg flex items-center justify-center">
                  <Clock className="w-4 h-4 text-muted-foreground" />
                </div>
                <div>
                  <p className="text-xs text-muted-foreground">Última interação</p>
                  <p className="text-foreground">{formatDate(contact?.lastInteractionAt)}</p>
                </div>
              </div>
            </div>
          </div>

          <Separator />

          {/* Tags */}
          <div className="space-y-3">
            <div className="flex items-center justify-between">
              <h5 className="text-sm font-medium text-foreground">Tags</h5>
              <Button variant="ghost" size="sm" className="h-7 px-2">
                <Plus className="w-3 h-3 mr-1" />
                Adicionar
              </Button>
            </div>
            <div className="flex flex-wrap gap-2">
              {contact?.tags && contact.tags.length > 0 ? (
                contact.tags.map((tag) => (
                  <Badge key={tag} variant="secondary" className="text-xs">
                    {tag}
                    <button className="ml-1 hover:text-destructive">
                      <X className="w-3 h-3" />
                    </button>
                  </Badge>
                ))
              ) : (
                <p className="text-sm text-muted-foreground">Nenhuma tag</p>
              )}
            </div>
          </div>

          <Separator />

          {/* Notes */}
          <Collapsible open={notesOpen} onOpenChange={setNotesOpen}>
            <CollapsibleTrigger className="flex items-center justify-between w-full">
              <h5 className="text-sm font-medium text-foreground">Notas Internas</h5>
              {notesOpen ? (
                <ChevronUp className="w-4 h-4 text-muted-foreground" />
              ) : (
                <ChevronDown className="w-4 h-4 text-muted-foreground" />
              )}
            </CollapsibleTrigger>
            <CollapsibleContent className="pt-3">
              <Textarea
                value={notes}
                onChange={(e) => setNotes(e.target.value)}
                placeholder="Adicione notas sobre este contato..."
                className="min-h-[80px] resize-none"
              />
              <p className="text-xs text-muted-foreground mt-2">
                Notas são visíveis apenas para a equipe
              </p>
            </CollapsibleContent>
          </Collapsible>

          <Separator />

          {/* History */}
          <Collapsible open={historyOpen} onOpenChange={setHistoryOpen}>
            <CollapsibleTrigger className="flex items-center justify-between w-full">
              <h5 className="text-sm font-medium text-foreground">Histórico de Conversas</h5>
              {historyOpen ? (
                <ChevronUp className="w-4 h-4 text-muted-foreground" />
              ) : (
                <ChevronDown className="w-4 h-4 text-muted-foreground" />
              )}
            </CollapsibleTrigger>
            <CollapsibleContent className="pt-3 space-y-2">
              {/* Current conversation */}
              <div className="p-3 bg-primary/5 rounded-lg border border-primary/20">
                <div className="flex items-center justify-between">
                  <p className="text-sm font-medium text-foreground">Conversa atual</p>
                  <Badge variant="outline" className="text-xs border-conv-open text-conv-open">
                    Aberta
                  </Badge>
                </div>
                <p className="text-xs text-muted-foreground mt-1">
                  Iniciada em {formatDate(conversation.createdAt)}
                </p>
              </div>

              {/* Previous conversations */}
              <div className="p-3 bg-muted/50 rounded-lg">
                <div className="flex items-center justify-between">
                  <p className="text-sm text-foreground">Conversa anterior</p>
                  <Badge variant="outline" className="text-xs">
                    Resolvida
                  </Badge>
                </div>
                <p className="text-xs text-muted-foreground mt-1">
                  28/11/2024 - 12 mensagens
                </p>
              </div>

              <div className="p-3 bg-muted/50 rounded-lg">
                <div className="flex items-center justify-between">
                  <p className="text-sm text-foreground">Conversa anterior</p>
                  <Badge variant="outline" className="text-xs">
                    Resolvida
                  </Badge>
                </div>
                <p className="text-xs text-muted-foreground mt-1">
                  15/11/2024 - 8 mensagens
                </p>
              </div>
            </CollapsibleContent>
          </Collapsible>
        </div>
      </ScrollArea>
    </div>
  );
}
