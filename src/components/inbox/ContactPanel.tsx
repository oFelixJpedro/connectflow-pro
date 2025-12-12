import { useState, useEffect, useCallback } from 'react';
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
  ChevronUp,
  Loader2,
  Check,
  StickyNote
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
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from '@/components/ui/popover';
import { cn } from '@/lib/utils';
import type { Conversation } from '@/types';
import { format } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import { supabase } from '@/integrations/supabase/client';
import { useToast } from '@/hooks/use-toast';
import { ContactFormModal } from '@/components/contacts/ContactFormModal';
import { ContactFormData } from '@/hooks/useContactsData';
import { ChatNotesModal } from './ChatNotesModal';

interface ContactPanelProps {
  conversation: Conversation | null;
  onClose: () => void;
  onContactUpdated?: () => void;
  onScrollToMessage?: (messageId: string) => void;
}

interface Tag {
  id: string;
  name: string;
  color: string;
}

interface ConversationHistory {
  id: string;
  status: string;
  createdAt: string;
  messageCount: number;
}

export function ContactPanel({ conversation, onClose, onContactUpdated, onScrollToMessage }: ContactPanelProps) {
  const { toast } = useToast();
  const [notesOpen, setNotesOpen] = useState(true);
  const [historyOpen, setHistoryOpen] = useState(true);
  const [notes, setNotes] = useState('');
  const [isSavingNotes, setIsSavingNotes] = useState(false);
  const [notesSaved, setNotesSaved] = useState(false);
  
  // Tags state
  const [contactTags, setContactTags] = useState<string[]>([]);
  const [availableTags, setAvailableTags] = useState<Tag[]>([]);
  const [isLoadingTags, setIsLoadingTags] = useState(false);
  const [tagPopoverOpen, setTagPopoverOpen] = useState(false);
  
  // Conversation history state
  const [conversationHistory, setConversationHistory] = useState<ConversationHistory[]>([]);
  const [isLoadingHistory, setIsLoadingHistory] = useState(false);

  // Edit modal state
  const [editModalOpen, setEditModalOpen] = useState(false);
  
  // Chat notes modal state
  const [chatNotesModalOpen, setChatNotesModalOpen] = useState(false);
  const [chatNotesCount, setChatNotesCount] = useState(0);

  // Last interaction state - for real-time updates
  const [lastInteraction, setLastInteraction] = useState<string | null>(null);

  const contact = conversation?.contact;

  // Load initial data
  useEffect(() => {
    if (contact) {
      setNotes(contact.notes || '');
      setContactTags(contact.tags || []);
      setLastInteraction(contact.lastInteractionAt || null);
      loadAvailableTags();
      loadConversationHistory();
      loadChatNotesCount();
    }
  }, [contact?.id]);

  // Realtime subscription for chat notes count AND last interaction
  useEffect(() => {
    if (!conversation?.id) return;

    const channel = supabase
      .channel(`contact-panel-${conversation.id}`)
      .on(
        'postgres_changes',
        {
          event: 'INSERT',
          schema: 'public',
          table: 'messages',
          filter: `conversation_id=eq.${conversation.id}`,
        },
        (payload: any) => {
          // Update last interaction timestamp with the new message's created_at
          if (payload.new?.created_at) {
            setLastInteraction(payload.new.created_at);
          }
          
          // Check if it's an internal note to update count
          if (payload.new?.is_internal_note) {
            loadChatNotesCount();
          }
        }
      )
      .on(
        'postgres_changes',
        {
          event: 'DELETE',
          schema: 'public',
          table: 'messages',
          filter: `conversation_id=eq.${conversation.id}`,
        },
        (payload: any) => {
          // Only reload chat notes count for deleted internal notes
          if (payload.old?.is_internal_note) {
            loadChatNotesCount();
          }
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [conversation?.id]);

  const loadChatNotesCount = async () => {
    if (!conversation?.id) return;
    try {
      const { count } = await supabase
        .from('messages')
        .select('*', { count: 'exact', head: true })
        .eq('conversation_id', conversation.id)
        .eq('is_internal_note', true);
      setChatNotesCount(count || 0);
    } catch (error) {
      console.error('[ContactPanel] Erro ao contar notas:', error);
    }
  };

  const loadAvailableTags = async () => {
    setIsLoadingTags(true);
    try {
      const { data, error } = await supabase
        .from('tags')
        .select('id, name, color')
        .order('name');

      if (error) throw error;
      setAvailableTags(data || []);
    } catch (error) {
      console.error('[ContactPanel] Erro ao carregar tags:', error);
    } finally {
      setIsLoadingTags(false);
    }
  };

  const loadConversationHistory = async () => {
    if (!contact?.id) return;
    
    setIsLoadingHistory(true);
    try {
      // Buscar todas as conversas deste contato
      const { data: conversations, error: convError } = await supabase
        .from('conversations')
        .select('id, status, created_at')
        .eq('contact_id', contact.id)
        .order('created_at', { ascending: false });

      if (convError) throw convError;

      // Para cada conversa, contar mensagens
      const historyWithCounts = await Promise.all(
        (conversations || []).map(async (conv) => {
          const { count } = await supabase
            .from('messages')
            .select('*', { count: 'exact', head: true })
            .eq('conversation_id', conv.id);

          return {
            id: conv.id,
            status: conv.status,
            createdAt: conv.created_at,
            messageCount: count || 0,
          };
        })
      );

      setConversationHistory(historyWithCounts);
    } catch (error) {
      console.error('[ContactPanel] Erro ao carregar histórico:', error);
    } finally {
      setIsLoadingHistory(false);
    }
  };

  // Auto-save notes with debounce
  useEffect(() => {
    if (!contact?.id) return;
    
    const timeoutId = setTimeout(() => {
      if (notes !== (contact.notes || '')) {
        saveNotes();
      }
    }, 1000);

    return () => clearTimeout(timeoutId);
  }, [notes]);

  const saveNotes = async () => {
    if (!contact?.id) return;
    
    setIsSavingNotes(true);
    try {
      const { error } = await supabase
        .from('contacts')
        .update({ notes })
        .eq('id', contact.id);

      if (error) throw error;
      
      setNotesSaved(true);
      setTimeout(() => setNotesSaved(false), 2000);
    } catch (error) {
      console.error('[ContactPanel] Erro ao salvar notas:', error);
      toast({
        title: 'Erro ao salvar notas',
        description: 'Não foi possível salvar as notas. Tente novamente.',
        variant: 'destructive',
      });
    } finally {
      setIsSavingNotes(false);
    }
  };

  const addTag = async (tagName: string) => {
    if (!contact?.id || contactTags.includes(tagName)) return;

    const newTags = [...contactTags, tagName];
    setContactTags(newTags);

    try {
      const { error } = await supabase
        .from('contacts')
        .update({ tags: newTags })
        .eq('id', contact.id);

      if (error) throw error;
      
      toast({
        title: 'Tag adicionada',
        description: `A tag "${tagName}" foi adicionada ao contato.`,
      });
    } catch (error) {
      console.error('[ContactPanel] Erro ao adicionar tag:', error);
      setContactTags(contactTags); // Reverter
      toast({
        title: 'Erro ao adicionar tag',
        variant: 'destructive',
      });
    }
    
    setTagPopoverOpen(false);
  };

  const removeTag = async (tagName: string) => {
    if (!contact?.id) return;

    const newTags = contactTags.filter(t => t !== tagName);
    setContactTags(newTags);

    try {
      const { error } = await supabase
        .from('contacts')
        .update({ tags: newTags })
        .eq('id', contact.id);

      if (error) throw error;
      
      toast({
        title: 'Tag removida',
        description: `A tag "${tagName}" foi removida do contato.`,
      });
    } catch (error) {
      console.error('[ContactPanel] Erro ao remover tag:', error);
      setContactTags(contactTags); // Reverter
      toast({
        title: 'Erro ao remover tag',
        variant: 'destructive',
      });
    }
  };

  const handleSaveContact = async (data: ContactFormData): Promise<boolean | string> => {
    if (!contact?.id) return false;

    try {
      const { error } = await supabase
        .from('contacts')
        .update({
          name: data.name || null,
          phone_number: data.phone_number.replace(/\D/g, ''),
          email: data.email || null,
          tags: data.tags,
          notes: data.notes || null,
          // Mark name as manually edited if name was changed
          name_manually_edited: data.name ? true : false,
        })
        .eq('id', contact.id);

      if (error) throw error;

      // Atualizar estados locais
      setContactTags(data.tags);
      setNotes(data.notes || '');

      toast({
        title: 'Contato atualizado',
        description: 'As informações do contato foram salvas com sucesso.',
      });

      // Notificar parent para refresh
      onContactUpdated?.();

      return true;
    } catch (error) {
      console.error('[ContactPanel] Erro ao salvar contato:', error);
      toast({
        title: 'Erro ao salvar',
        description: 'Não foi possível salvar as alterações.',
        variant: 'destructive',
      });
      return false;
    }
  };

  if (!conversation) {
    return null;
  }

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

  const formatShortDate = (date?: string) => {
    if (!date) return '-';
    return format(new Date(date), "dd/MM/yyyy", { locale: ptBR });
  };

  const getStatusBadge = (status: string, isCurrent: boolean) => {
    const statusConfig: Record<string, { label: string; className: string }> = {
      open: { label: 'Aberta', className: 'border-conv-open text-conv-open' },
      in_progress: { label: 'Em atendimento', className: 'border-conv-in_progress text-conv-in_progress' },
      pending: { label: 'Pendente', className: 'border-conv-pending text-conv-pending' },
      waiting: { label: 'Aguardando', className: 'border-yellow-500 text-yellow-500' },
      resolved: { label: 'Resolvida', className: 'border-conv-resolved text-conv-resolved' },
      closed: { label: 'Fechada', className: 'border-muted-foreground text-muted-foreground' },
    };

    const config = statusConfig[status] || { label: status, className: '' };
    
    return (
      <Badge variant="outline" className={cn('text-xs', config.className)}>
        {config.label}
      </Badge>
    );
  };

  // Tags que ainda não foram adicionadas ao contato
  const tagsNotInContact = availableTags.filter(
    tag => !contactTags.includes(tag.name)
  );

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
              <Button variant="outline" size="sm" onClick={() => setEditModalOpen(true)}>
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
                  <p className="text-foreground">{formatDate(lastInteraction || contact?.lastInteractionAt)}</p>
                </div>
              </div>
            </div>
          </div>

          <Separator />

          {/* Tags */}
          <div className="space-y-3">
            <div className="flex items-center justify-between">
              <h5 className="text-sm font-medium text-foreground">Tags</h5>
              <Popover open={tagPopoverOpen} onOpenChange={setTagPopoverOpen}>
                <PopoverTrigger asChild>
                  <Button variant="ghost" size="sm" className="h-7 px-2">
                    <Plus className="w-3 h-3 mr-1" />
                    Adicionar
                  </Button>
                </PopoverTrigger>
                <PopoverContent className="w-56 p-2" align="end">
                  <div className="space-y-1">
                    <p className="text-xs font-medium text-muted-foreground px-2 py-1">
                      Selecione uma tag
                    </p>
                    {isLoadingTags ? (
                      <div className="flex items-center justify-center py-4">
                        <Loader2 className="w-4 h-4 animate-spin text-muted-foreground" />
                      </div>
                    ) : tagsNotInContact.length === 0 ? (
                      <p className="text-xs text-muted-foreground px-2 py-2">
                        Todas as tags já foram adicionadas
                      </p>
                    ) : (
                      tagsNotInContact.map((tag) => (
                        <button
                          key={tag.id}
                          onClick={() => addTag(tag.name)}
                          className="w-full flex items-center gap-2 px-2 py-1.5 text-sm rounded-md hover:bg-muted transition-colors text-left"
                        >
                          <div
                            className="w-3 h-3 rounded-full"
                            style={{ backgroundColor: tag.color }}
                          />
                          <span>{tag.name}</span>
                        </button>
                      ))
                    )}
                  </div>
                </PopoverContent>
              </Popover>
            </div>
            <div className="flex flex-wrap gap-2">
              {contactTags.length > 0 ? (
                contactTags.map((tagName) => {
                  const tagData = availableTags.find(t => t.name === tagName);
                  return (
                    <Badge 
                      key={tagName} 
                      variant="secondary" 
                      className="text-xs"
                      style={tagData ? { 
                        backgroundColor: `${tagData.color}20`,
                        borderColor: tagData.color,
                        color: tagData.color
                      } : undefined}
                    >
                      {tagName}
                      <button 
                        className="ml-1 hover:text-destructive"
                        onClick={() => removeTag(tagName)}
                      >
                        <X className="w-3 h-3" />
                      </button>
                    </Badge>
                  );
                })
              ) : (
                <p className="text-sm text-muted-foreground">Nenhuma tag</p>
              )}
            </div>
          </div>

          <Separator />

          {/* Chat Notes */}
          <div className="space-y-3">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <h5 className="text-sm font-medium text-foreground">Notas de Chat</h5>
                {chatNotesCount > 0 && (
                  <Badge variant="secondary" className="text-xs bg-amber-100 text-amber-700 dark:bg-amber-950 dark:text-amber-300">
                    {chatNotesCount}
                  </Badge>
                )}
              </div>
              <Button 
                variant="ghost" 
                size="sm" 
                className="h-7 px-2"
                onClick={() => setChatNotesModalOpen(true)}
              >
                <StickyNote className="w-3 h-3 mr-1 text-amber-500" />
                Ver notas
              </Button>
            </div>
            <p className="text-xs text-muted-foreground">
              Notas feitas diretamente no chat para contexto rápido
            </p>
          </div>

          <Separator />

          {/* Notes */}
          <Collapsible open={notesOpen} onOpenChange={setNotesOpen}>
            <CollapsibleTrigger className="flex items-center justify-between w-full">
              <div className="flex items-center gap-2">
                <h5 className="text-sm font-medium text-foreground">Notas Internas</h5>
                {isSavingNotes && (
                  <Loader2 className="w-3 h-3 animate-spin text-muted-foreground" />
                )}
                {notesSaved && (
                  <Check className="w-3 h-3 text-green-500" />
                )}
              </div>
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
                Notas são visíveis apenas para a equipe • Salvamento automático
              </p>
            </CollapsibleContent>
          </Collapsible>

          <Separator />

          {/* History */}
          <Collapsible open={historyOpen} onOpenChange={setHistoryOpen}>
            <CollapsibleTrigger className="flex items-center justify-between w-full">
              <div className="flex items-center gap-2">
                <h5 className="text-sm font-medium text-foreground">Histórico de Conversas</h5>
                {isLoadingHistory && (
                  <Loader2 className="w-3 h-3 animate-spin text-muted-foreground" />
                )}
              </div>
              {historyOpen ? (
                <ChevronUp className="w-4 h-4 text-muted-foreground" />
              ) : (
                <ChevronDown className="w-4 h-4 text-muted-foreground" />
              )}
            </CollapsibleTrigger>
            <CollapsibleContent className="pt-3 space-y-2">
              {conversationHistory.length === 0 && !isLoadingHistory ? (
                <p className="text-sm text-muted-foreground text-center py-4">
                  Nenhuma conversa encontrada
                </p>
              ) : (
                conversationHistory.map((conv, index) => {
                  const isCurrent = conv.id === conversation.id;
                  return (
                    <div 
                      key={conv.id}
                      className={cn(
                        "p-3 rounded-lg",
                        isCurrent 
                          ? "bg-primary/5 border border-primary/20" 
                          : "bg-muted/50"
                      )}
                    >
                      <div className="flex items-center justify-between">
                        <p className={cn(
                          "text-sm",
                          isCurrent ? "font-medium text-foreground" : "text-foreground"
                        )}>
                          {isCurrent ? 'Conversa atual' : `Conversa ${index === 0 ? '' : 'anterior'}`}
                        </p>
                        {getStatusBadge(conv.status, isCurrent)}
                      </div>
                      <p className="text-xs text-muted-foreground mt-1">
                        {formatShortDate(conv.createdAt)} - {conv.messageCount} mensage{conv.messageCount === 1 ? 'm' : 'ns'}
                      </p>
                    </div>
                  );
                })
              )}
            </CollapsibleContent>
          </Collapsible>
        </div>
      </ScrollArea>

      {/* Edit Contact Modal */}
      <ContactFormModal
        open={editModalOpen}
        onOpenChange={setEditModalOpen}
        contact={contact ? {
          id: contact.id,
          company_id: contact.companyId || '',
          phone_number: contact.phoneNumber || '',
          name: contact.name || null,
          email: contact.email || null,
          avatar_url: contact.avatarUrl || null,
          tags: contactTags,
          notes: notes || null,
          custom_fields: (contact.customFields as any) || null,
          last_interaction_at: contact.lastInteractionAt || null,
          created_at: contact.createdAt || null,
          updated_at: contact.updatedAt || null,
        } : null}
        tags={availableTags}
        onSave={handleSaveContact}
      />

      {/* Chat Notes Modal */}
      {conversation && (
        <ChatNotesModal
          open={chatNotesModalOpen}
          onOpenChange={setChatNotesModalOpen}
          conversationId={conversation.id}
          onNoteClick={(noteId) => {
            onScrollToMessage?.(noteId);
          }}
        />
      )}
    </div>
  );
}
