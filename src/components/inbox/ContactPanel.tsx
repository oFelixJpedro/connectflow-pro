import { useState, useEffect, useCallback, useRef } from 'react';
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
  StickyNote,
  History,
  Sparkles,
  Pencil,
  Ban,
  ShieldCheck,
  Settings,
  FileText,
  Hash,
  Link,
  Building,
  User,
  MapPin,
  Briefcase
} from 'lucide-react';
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from '@/components/ui/tooltip';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { ContactAvatar } from '@/components/ui/contact-avatar';
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
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '@/components/ui/alert-dialog';
import { cn } from '@/lib/utils';
import type { Conversation } from '@/types';
import { format } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import { supabase } from '@/integrations/supabase/client';
import { useToast } from '@/hooks/use-toast';
import { ContactFormModal } from '@/components/contacts/ContactFormModal';
import { ContactFormData } from '@/hooks/useContactsData';
import { ChatNotesModal } from './ChatNotesModal';
import { ConversationHistoryModal } from './ConversationHistoryModal';
import { ScheduledMessagesList } from './ScheduledMessagesList';
import { useScheduledMessagesCount } from './ScheduledMessagesList';
import { logConversationEvent } from '@/lib/conversationHistory';
import { useAuth } from '@/contexts/AuthContext';
import { AIAgentActions } from './AIAgentActions';
import { ChatSummary } from './ChatSummary';
import { ManageCustomFieldsModal } from './ManageCustomFieldsModal';
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

interface CustomFieldDefinition {
  id: string;
  name: string;
  field_key: string;
  field_type: string;
  icon: string;
  position: number;
}

export function ContactPanel({ conversation, onClose, onContactUpdated, onScrollToMessage }: ContactPanelProps) {
  const { toast } = useToast();
  const { profile } = useAuth();
  const [notesOpen, setNotesOpen] = useState(true);
  const [historyOpen, setHistoryOpen] = useState(true);
  const [notes, setNotes] = useState('');
  const [isSavingNotes, setIsSavingNotes] = useState(false);
  const [notesSaved, setNotesSaved] = useState(false);
  const [isCorrectingNotes, setIsCorrectingNotes] = useState(false);
  const notesTextareaRef = useRef<HTMLTextAreaElement>(null);
  
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
  
  // Block confirmation modal state
  const [blockConfirmOpen, setBlockConfirmOpen] = useState(false);
  const [isBlocking, setIsBlocking] = useState(false);
  
  // Chat notes modal state
  const [chatNotesModalOpen, setChatNotesModalOpen] = useState(false);
  const [chatNotesCount, setChatNotesCount] = useState(0);
  
  // Conversation history modal state
  const [historyModalOpen, setHistoryModalOpen] = useState(false);

  // Last interaction state - for real-time updates
  const [lastInteraction, setLastInteraction] = useState<string | null>(null);

  // Custom fields state
  const [customFieldDefs, setCustomFieldDefs] = useState<CustomFieldDefinition[]>([]);
  const [customFieldValues, setCustomFieldValues] = useState<Record<string, string>>({});
  const [editingFieldKey, setEditingFieldKey] = useState<string | null>(null);
  const [editingFieldValue, setEditingFieldValue] = useState('');
  const [manageFieldsModalOpen, setManageFieldsModalOpen] = useState(false);
  const [isAdminOrOwner, setIsAdminOrOwner] = useState(false);

  const contact = conversation?.contact;
  
  // Scheduled messages count
  const scheduledMessagesCount = useScheduledMessagesCount(contact?.id);

  // Load initial data
  useEffect(() => {
    if (contact) {
      setNotes(contact.notes || '');
      setContactTags(contact.tags || []);
      setLastInteraction(contact.lastInteractionAt || null);
      setCustomFieldValues((contact.customFields as Record<string, string>) || {});
      loadAvailableTags();
      loadConversationHistory();
      loadChatNotesCount();
      loadCustomFieldDefinitions();
    }
  }, [contact?.id]);

  // Check if user is admin or owner
  useEffect(() => {
    const checkRole = async () => {
      if (!profile?.id) return;
      const { data } = await supabase
        .from('user_roles')
        .select('role')
        .eq('user_id', profile.id)
        .maybeSingle();
      
      setIsAdminOrOwner(data?.role === 'owner' || data?.role === 'admin');
    };
    checkRole();
  }, [profile?.id]);

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

  const loadCustomFieldDefinitions = async () => {
    try {
      const { data, error } = await supabase
        .from('custom_field_definitions')
        .select('id, name, field_key, field_type, icon, position')
        .eq('active', true)
        .order('position', { ascending: true });

      if (error) throw error;
      setCustomFieldDefs(data || []);
    } catch (error) {
      console.error('[ContactPanel] Erro ao carregar campos personalizados:', error);
    }
  };

  const saveCustomFieldValue = async (fieldKey: string, value: string) => {
    if (!contact?.id) return;

    const newValues = { ...customFieldValues, [fieldKey]: value };
    setCustomFieldValues(newValues);
    setEditingFieldKey(null);

    try {
      const { error } = await supabase
        .from('contacts')
        .update({ custom_fields: newValues })
        .eq('id', contact.id);

      if (error) throw error;
      
      toast({
        title: 'Campo atualizado',
        description: 'O valor foi salvo com sucesso.',
      });
    } catch (error) {
      console.error('[ContactPanel] Erro ao salvar campo:', error);
      toast({
        title: 'Erro ao salvar',
        description: 'Não foi possível salvar o campo.',
        variant: 'destructive',
      });
    }
  };

  const getFieldIcon = (iconName: string) => {
    const icons: Record<string, React.ReactNode> = {
      FileText: <FileText className="w-4 h-4 text-muted-foreground" />,
      Mail: <Mail className="w-4 h-4 text-muted-foreground" />,
      Phone: <Phone className="w-4 h-4 text-muted-foreground" />,
      Calendar: <Calendar className="w-4 h-4 text-muted-foreground" />,
      Hash: <Hash className="w-4 h-4 text-muted-foreground" />,
      Link: <Link className="w-4 h-4 text-muted-foreground" />,
      Building: <Building className="w-4 h-4 text-muted-foreground" />,
      User: <User className="w-4 h-4 text-muted-foreground" />,
      MapPin: <MapPin className="w-4 h-4 text-muted-foreground" />,
      Briefcase: <Briefcase className="w-4 h-4 text-muted-foreground" />,
    };
    return icons[iconName] || <FileText className="w-4 h-4 text-muted-foreground" />;
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
    const tagData = availableTags.find(t => t.name === tagName);

    try {
      const { error } = await supabase
        .from('contacts')
        .update({ tags: newTags })
        .eq('id', contact.id);

      if (error) throw error;
      
      // Log history event if we have a conversation
      if (conversation?.id && profile) {
        await logConversationEvent({
          conversationId: conversation.id,
          eventType: 'tag_added',
          eventData: {
            tag_name: tagName,
            tag_color: tagData?.color || '#3B82F6'
          },
          performedBy: profile.id,
          performedByName: profile.full_name
        });
      }
      
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
    const tagData = availableTags.find(t => t.name === tagName);

    try {
      const { error } = await supabase
        .from('contacts')
        .update({ tags: newTags })
        .eq('id', contact.id);

      if (error) throw error;
      
      // Log history event if we have a conversation
      if (conversation?.id && profile) {
        await logConversationEvent({
          conversationId: conversation.id,
          eventType: 'tag_removed',
          eventData: {
            tag_name: tagName,
            tag_color: tagData?.color || '#3B82F6'
          },
          performedBy: profile.id,
          performedByName: profile.full_name
        });
      }
      
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

  const handleBlockContact = async () => {
    if (!conversation) return;
    
    setIsBlocking(true);
    const isCurrentlyBlocked = conversation.status === 'blocked';
    
    try {
      const { data, error } = await supabase.functions.invoke('conversation-management', {
        body: {
          action: isCurrentlyBlocked ? 'unblock' : 'block',
          conversationId: conversation.id,
          connectionSessionId: (conversation as any).whatsappConnection?.sessionId
        }
      });
      
      if (error) throw error;
      
      toast({
        title: isCurrentlyBlocked ? 'Contato desbloqueado' : 'Contato bloqueado',
        description: isCurrentlyBlocked 
          ? 'O contato foi desbloqueado e a conversa foi reaberta.'
          : 'O contato foi bloqueado e não poderá mais enviar mensagens.',
      });
      
      onContactUpdated?.();
      setBlockConfirmOpen(false);
    } catch (error) {
      console.error('[ContactPanel] Erro ao bloquear/desbloquear:', error);
      toast({
        title: 'Erro',
        description: `Não foi possível ${isCurrentlyBlocked ? 'desbloquear' : 'bloquear'} o contato.`,
        variant: 'destructive',
      });
    } finally {
      setIsBlocking(false);
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
            <ContactAvatar
              imageUrl={contact?.avatarUrl}
              name={contact?.name}
              size="xl"
              className="w-20 h-20"
              fallbackClassName="text-xl"
            />
            <h4 className="mt-3 font-semibold text-foreground">
              {contact?.name || 'Sem nome'}
            </h4>
            <p className="text-sm text-muted-foreground">
              {contact?.phoneNumber}
            </p>
            <TooltipProvider>
              <div className="flex items-center gap-2 mt-3">
                <Tooltip>
                  <TooltipTrigger asChild>
                    <Button 
                      variant="outline" 
                      size="icon"
                      className="h-8 w-8"
                      onClick={() => setEditModalOpen(true)}
                    >
                      <Edit2 className="w-4 h-4" />
                    </Button>
                  </TooltipTrigger>
                  <TooltipContent>
                    <p>Editar contato</p>
                  </TooltipContent>
                </Tooltip>

                <Tooltip>
                  <TooltipTrigger asChild>
                    <Button 
                      variant="outline" 
                      size="icon"
                      className={cn(
                        "h-8 w-8",
                        conversation.status === 'blocked' 
                          ? "text-green-500 hover:text-green-600 hover:border-green-500" 
                          : "text-destructive hover:text-destructive hover:border-destructive"
                      )}
                      onClick={() => setBlockConfirmOpen(true)}
                    >
                      {conversation.status === 'blocked' ? (
                        <ShieldCheck className="w-4 h-4" />
                      ) : (
                        <Ban className="w-4 h-4" />
                      )}
                    </Button>
                  </TooltipTrigger>
                  <TooltipContent>
                    <p>{conversation.status === 'blocked' ? 'Desbloquear contato' : 'Bloquear contato'}</p>
                  </TooltipContent>
                </Tooltip>
              </div>
            </TooltipProvider>
          </div>

          <Separator />

          {/* AI Agent Actions */}
          <AIAgentActions conversationId={conversation.id} whatsappConnectionId={conversation.whatsappConnectionId} />

          <Separator />

          {/* Contact Details */}
          <div className="space-y-3">
            <div className="flex items-center justify-between">
              <h5 className="text-sm font-medium text-foreground">Informações</h5>
              {isAdminOrOwner && (
                <Button 
                  variant="ghost" 
                  size="sm" 
                  className="h-7 px-2"
                  onClick={() => setManageFieldsModalOpen(true)}
                >
                  <Settings className="w-3 h-3 mr-1" />
                  Campos
                </Button>
              )}
            </div>
            
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

              {/* Custom Fields */}
              {customFieldDefs.map((field) => {
                const value = customFieldValues[field.field_key] || '';
                const isEditing = editingFieldKey === field.field_key;
                
                return (
                  <div key={field.id} className="flex items-center gap-3 text-sm group">
                    <div className="w-8 h-8 bg-muted rounded-lg flex items-center justify-center">
                      {getFieldIcon(field.icon)}
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="text-xs text-muted-foreground">{field.name}</p>
                      {isEditing ? (
                        <div className="flex items-center gap-1 mt-1">
                          <input
                            type={field.field_type === 'email' ? 'email' : field.field_type === 'number' ? 'number' : 'text'}
                            className="flex-1 bg-background border border-input rounded px-2 py-1 text-sm focus:outline-none focus:ring-2 focus:ring-ring"
                            value={editingFieldValue}
                            onChange={(e) => setEditingFieldValue(e.target.value)}
                            onKeyDown={(e) => {
                              if (e.key === 'Enter') {
                                saveCustomFieldValue(field.field_key, editingFieldValue);
                              } else if (e.key === 'Escape') {
                                setEditingFieldKey(null);
                              }
                            }}
                            autoFocus
                          />
                          <Button
                            variant="ghost"
                            size="icon"
                            className="h-6 w-6"
                            onClick={() => saveCustomFieldValue(field.field_key, editingFieldValue)}
                          >
                            <Check className="w-3 h-3" />
                          </Button>
                          <Button
                            variant="ghost"
                            size="icon"
                            className="h-6 w-6"
                            onClick={() => setEditingFieldKey(null)}
                          >
                            <X className="w-3 h-3" />
                          </Button>
                        </div>
                      ) : (
                        <div className="flex items-center gap-1">
                          <p className="text-foreground truncate">
                            {value || <span className="text-muted-foreground italic">Não definido</span>}
                          </p>
                          <Button
                            variant="ghost"
                            size="icon"
                            className="h-5 w-5 opacity-0 group-hover:opacity-100 transition-opacity"
                            onClick={() => {
                              setEditingFieldKey(field.field_key);
                              setEditingFieldValue(value);
                            }}
                          >
                            <Pencil className="w-3 h-3" />
                          </Button>
                        </div>
                      )}
                    </div>
                  </div>
                );
              })}
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

          {/* Scheduled Messages */}
          <div className="space-y-3">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <h5 className="text-sm font-medium text-foreground">Mensagens Agendadas</h5>
                {scheduledMessagesCount > 0 && (
                  <Badge variant="secondary" className="text-xs bg-primary/10 text-primary">
                    {scheduledMessagesCount}
                  </Badge>
                )}
              </div>
            </div>
            {contact?.id && <ScheduledMessagesList contactId={contact.id} />}
          </div>

          <Separator />

          {/* Notes */}
          <Collapsible open={notesOpen} onOpenChange={setNotesOpen}>
            <CollapsibleTrigger className="flex items-center justify-between w-full">
              <div className="flex items-center gap-2">
                <h5 className="text-sm font-medium text-foreground">Anotações/Observações</h5>
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
              <div className="flex gap-2">
                <Textarea
                  ref={notesTextareaRef}
                  value={notes}
                  onChange={(e) => setNotes(e.target.value)}
                  placeholder="Adicione notas sobre este contato..."
                  className="min-h-[80px] resize-none bg-[#FFFBEB] text-slate-900 placeholder:text-slate-500 border-amber-200 flex-1"
                />
                {notes.trim() && (
                  <Button
                    variant="ghost"
                    size="icon"
                    onClick={async () => {
                      if (isCorrectingNotes) return;
                      setIsCorrectingNotes(true);
                      try {
                        const { data, error } = await supabase.functions.invoke('correct-text', {
                          body: { text: notes }
                        });
                        if (error) throw error;
                        if (data?.correctedText) {
                          setNotes(data.correctedText);
                          setTimeout(() => notesTextareaRef.current?.focus(), 100);
                          if (data.hasChanges) {
                            toast({ title: 'Texto corrigido' });
                          } else {
                            toast({ title: 'Texto já está correto' });
                          }
                        }
                      } catch (error) {
                        toast({ title: 'Erro ao corrigir', variant: 'destructive' });
                      } finally {
                        setIsCorrectingNotes(false);
                      }
                    }}
                    className="flex-shrink-0 h-8 w-8"
                    disabled={isCorrectingNotes}
                    title="Corrigir texto"
                  >
                    {isCorrectingNotes ? (
                      <Loader2 className="w-4 h-4 animate-spin" />
                    ) : (
                      <Pencil className="w-4 h-4" />
                    )}
                  </Button>
                )}
              </div>
              <p className="text-xs text-muted-foreground mt-2">
                Notas são visíveis apenas para a equipe • Salvamento automático
              </p>
            </CollapsibleContent>
          </Collapsible>

          <Separator />

          {/* Chat Summary */}
          {conversation && (
            <ChatSummary 
              conversationId={conversation.id}
              contactId={contact?.id}
            />
          )}

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
              {/* Button to view detailed timeline */}
              <Button
                variant="outline"
                size="sm"
                className="w-full justify-start gap-2"
                onClick={() => setHistoryModalOpen(true)}
              >
                <History className="w-4 h-4" />
                Ver timeline detalhada
              </Button>
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

      {/* Conversation History Modal */}
      {conversation && (
        <ConversationHistoryModal
          open={historyModalOpen}
          onOpenChange={setHistoryModalOpen}
          conversationId={conversation.id}
          contactName={contact?.name}
        />
      )}

      {/* Block Confirmation Modal */}
      <AlertDialog open={blockConfirmOpen} onOpenChange={setBlockConfirmOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>
              {conversation?.status === 'blocked' ? 'Desbloquear contato?' : 'Bloquear contato?'}
            </AlertDialogTitle>
            <AlertDialogDescription>
              {conversation?.status === 'blocked' 
                ? 'O contato será desbloqueado e a conversa será reaberta e atribuída a você.'
                : 'O contato será bloqueado e não poderá mais enviar mensagens. A conversa será fechada.'}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={isBlocking}>Cancelar</AlertDialogCancel>
            <AlertDialogAction 
              onClick={handleBlockContact}
              disabled={isBlocking}
              className={conversation?.status === 'blocked' ? "" : "bg-destructive text-destructive-foreground hover:bg-destructive/90"}
            >
              {isBlocking && <Loader2 className="w-4 h-4 animate-spin mr-2" />}
              {conversation?.status === 'blocked' ? 'Desbloquear' : 'Bloquear'}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {/* Manage Custom Fields Modal */}
      <ManageCustomFieldsModal
        open={manageFieldsModalOpen}
        onOpenChange={setManageFieldsModalOpen}
        onFieldsChanged={loadCustomFieldDefinitions}
      />
    </div>
  );
}
