import { useState, useRef, useEffect, useCallback } from 'react';
import { 
  Send, 
  Check,
  CheckCheck,
  Clock,
  AlertCircle,
  Phone,
  Loader2,
  RotateCcw,
  ArrowDown,
  Reply,
  Mic,
  StickyNote
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { Badge } from '@/components/ui/badge';
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from '@/components/ui/tooltip';
import { AssignButton } from './AssignButton';
import { ConversationActions } from './ConversationActions';
import { MessageInputBlocker, useMessageBlocker } from './MessageInputBlocker';
import { AudioPlayer } from './AudioPlayer';
import { ImageMessage } from './ImageMessage';
import { VideoMessage } from './VideoMessage';
import StickerMessage from './StickerMessage';
import { DocumentMessage } from './DocumentMessage';
import { QuotedMessagePreview, ReplyInputPreview } from './QuotedMessagePreview';
import { AudioRecorder } from './AudioRecorder';
import { AudioFilePreview } from './AudioFilePreview';
import { AttachmentMenu } from './AttachmentMenu';
import { ImagePreviewModal } from './ImagePreviewModal';
import { VideoPreviewModal } from './VideoPreviewModal';
import { DocumentPreviewModal } from './DocumentPreviewModal';
import { MessageReactions } from './MessageReactions';
import { ReactionPicker } from './ReactionPicker';
import { EmojiMessagePicker } from './EmojiMessagePicker';
import { QuickRepliesPicker } from './QuickRepliesPicker';
import { QuickReply } from '@/hooks/useQuickRepliesData';
import { cn } from '@/lib/utils';
import type { Conversation, Message, QuotedMessage } from '@/types';
import { format } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import { useAuth } from '@/contexts/AuthContext';
import { supabase } from '@/integrations/supabase/client';
import { toast } from '@/hooks/use-toast';

interface ChatPanelProps {
  conversation: Conversation | null;
  messages: Message[];
  onSendMessage: (content: string, quotedMessageId?: string) => void;
  onSendInternalNote?: (content: string, messageType?: 'text' | 'image' | 'video' | 'audio' | 'document', mediaUrl?: string, mediaMimeType?: string, metadata?: Record<string, unknown>) => Promise<boolean>;
  onResendMessage?: (messageId: string) => void;
  onAssign: () => void;
  onClose: () => void;
  onRefresh?: () => void;
  onOpenContactDetails?: () => void;
  onSendReaction?: (messageId: string, emoji: string, remove?: boolean) => Promise<boolean>;
  onRegisterScrollToMessage?: (fn: (messageId: string) => void) => void;
  isLoadingMessages?: boolean;
  isSendingMessage?: boolean;
  isRestricted?: boolean;
}

const statusIcons = {
  pending: <Clock className="w-3 h-3 animate-pulse" />,
  sent: <Check className="w-3 h-3" />,
  delivered: <CheckCheck className="w-3 h-3" />,
  read: <CheckCheck className="w-3 h-3 text-primary" />,
  failed: <AlertCircle className="w-3 h-3 text-destructive" />,
};

const statusTooltips: Record<string, string> = {
  pending: 'Enviando...',
  sent: 'Enviada',
  delivered: 'Entregue',
  read: 'Lida',
  failed: 'Falha ao enviar',
};

export function ChatPanel({
  conversation,
  messages,
  onSendMessage,
  onSendInternalNote,
  onResendMessage,
  onAssign,
  onClose,
  onRefresh,
  onOpenContactDetails,
  onSendReaction,
  onRegisterScrollToMessage,
  isLoadingMessages = false,
  isSendingMessage = false,
  isRestricted = false,
}: ChatPanelProps) {
  const { user, userRole } = useAuth();
  const [inputValue, setInputValue] = useState('');
  const [showScrollButton, setShowScrollButton] = useState(false);
  const [replyingTo, setReplyingTo] = useState<Message | null>(null);
  const [isRecordingAudio, setIsRecordingAudio] = useState(false);
  const [audioFile, setAudioFile] = useState<File | null>(null);
  const [isSendingAudio, setIsSendingAudio] = useState(false);
  const [imageFile, setImageFile] = useState<File | null>(null);
  const [isImagePreviewOpen, setIsImagePreviewOpen] = useState(false);
  const [isSendingImage, setIsSendingImage] = useState(false);
  const [videoFile, setVideoFile] = useState<File | null>(null);
  const [isVideoPreviewOpen, setIsVideoPreviewOpen] = useState(false);
  const [isSendingVideo, setIsSendingVideo] = useState(false);
  const [documentFile, setDocumentFile] = useState<File | null>(null);
  const [isDocumentPreviewOpen, setIsDocumentPreviewOpen] = useState(false);
  const [isSendingDocument, setIsSendingDocument] = useState(false);
  const [sendingReactionMessageId, setSendingReactionMessageId] = useState<string | null>(null);
  const [showQuickReplies, setShowQuickReplies] = useState(false);
  const [isInternalNoteMode, setIsInternalNoteMode] = useState(false);
  const scrollContainerRef = useRef<HTMLDivElement>(null);
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const messageRefs = useRef<Record<string, HTMLDivElement | null>>({});
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const imageInputRef = useRef<HTMLInputElement>(null);

  const currentUserId = user?.id || '';
  const currentUserRole = userRole?.role || 'agent';

  // Verificar se pode responder
  const blockInfo = useMessageBlocker(conversation, currentUserId);
  const canReply = !blockInfo.blocked;

  // Send audio handler
  const handleSendAudio = async (audioBlob: Blob, duration: number) => {
    if (!conversation) return;

    setIsSendingAudio(true);
    try {
      // Convert blob to base64
      const reader = new FileReader();
      const base64Promise = new Promise<string>((resolve, reject) => {
        reader.onload = () => resolve(reader.result as string);
        reader.onerror = reject;
      });
      reader.readAsDataURL(audioBlob);
      const base64Data = await base64Promise;

      console.log('📤 Enviando áudio para Edge Function...');

      const { data, error } = await supabase.functions.invoke('send-whatsapp-audio', {
        body: {
          audioData: base64Data,
          fileName: `audio_${Date.now()}.webm`,
          mimeType: audioBlob.type || 'audio/webm',
          duration,
          conversationId: conversation.id,
          quotedMessageId: replyingTo?.id,
        }
      });

      if (error) throw error;

      if (!data?.success) {
        throw new Error(data?.error || 'Erro ao enviar áudio');
      }

      console.log('✅ Áudio enviado com sucesso!');
      setIsRecordingAudio(false);
      setReplyingTo(null);
      onRefresh?.();

    } catch (error: any) {
      console.error('❌ Erro ao enviar áudio:', error);
      toast({
        title: 'Erro ao enviar áudio',
        description: error.message || 'Tente novamente',
        variant: 'destructive',
      });
    } finally {
      setIsSendingAudio(false);
    }
  };

  // Send audio file handler
  const handleSendAudioFile = async (file: File, duration: number) => {
    if (!conversation) return;

    setIsSendingAudio(true);
    try {
      const reader = new FileReader();
      const base64Promise = new Promise<string>((resolve, reject) => {
        reader.onload = () => resolve(reader.result as string);
        reader.onerror = reject;
      });
      reader.readAsDataURL(file);
      const base64Data = await base64Promise;

      const { data, error } = await supabase.functions.invoke('send-whatsapp-audio', {
        body: {
          audioData: base64Data,
          fileName: file.name,
          mimeType: file.type,
          duration,
          conversationId: conversation.id,
          quotedMessageId: replyingTo?.id,
        }
      });

      if (error) throw error;
      if (!data?.success) throw new Error(data?.error || 'Erro ao enviar áudio');

      setAudioFile(null);
      setReplyingTo(null);
      onRefresh?.();

    } catch (error: any) {
      console.error('❌ Erro ao enviar áudio:', error);
      toast({
        title: 'Erro ao enviar áudio',
        description: error.message || 'Tente novamente',
        variant: 'destructive',
      });
    } finally {
      setIsSendingAudio(false);
    }
  };

  const handleAudioFileSelect = (file: File) => {
    setAudioFile(file);
  };

  // Send image handler
  const handleSendImage = async (file: File, caption: string) => {
    if (!conversation) return;

    setIsSendingImage(true);
    try {
      // Convert file to base64
      const reader = new FileReader();
      const base64Promise = new Promise<string>((resolve, reject) => {
        reader.onload = () => resolve(reader.result as string);
        reader.onerror = reject;
      });
      reader.readAsDataURL(file);
      const base64Data = await base64Promise;

      console.log('📤 Enviando imagem para Edge Function...');

      // Get contact phone from conversation
      const contactPhone = conversation.contact?.phoneNumber || '';

      const { data, error } = await supabase.functions.invoke('send-whatsapp-image', {
        body: {
          imageData: base64Data,
          fileName: file.name,
          mimeType: file.type,
          conversationId: conversation.id,
          connectionId: conversation.whatsappConnectionId,
          contactPhoneNumber: contactPhone,
          caption: caption || undefined,
          quotedMessageId: replyingTo?.id,
        }
      });

      if (error) throw error;

      if (!data?.success) {
        throw new Error(data?.error || 'Erro ao enviar imagem');
      }

      console.log('✅ Imagem enviada com sucesso!');
      toast({
        title: 'Imagem enviada',
        description: 'A imagem foi enviada com sucesso.',
      });

      setImageFile(null);
      setIsImagePreviewOpen(false);
      setReplyingTo(null);
      onRefresh?.();

    } catch (error: any) {
      console.error('❌ Erro ao enviar imagem:', error);
      throw error; // Re-throw to be handled by ImagePreviewModal
    } finally {
      setIsSendingImage(false);
    }
  };

  const handleImageSelect = (file: File) => {
    setImageFile(file);
    setIsImagePreviewOpen(true);
  };

  // Send video handler
  const handleSendVideo = async (file: File, text: string, duration: number) => {
    if (!conversation) return;

    setIsSendingVideo(true);
    try {
      // Convert file to base64
      const reader = new FileReader();
      const base64Promise = new Promise<string>((resolve, reject) => {
        reader.onload = () => resolve(reader.result as string);
        reader.onerror = reject;
      });
      reader.readAsDataURL(file);
      const base64Data = await base64Promise;

      console.log('📤 Enviando vídeo para Edge Function...');

      // Get contact phone from conversation
      const contactPhone = conversation.contact?.phoneNumber || '';

      const { data, error } = await supabase.functions.invoke('send-whatsapp-video', {
        body: {
          videoData: base64Data,
          fileName: file.name,
          mimeType: file.type,
          conversationId: conversation.id,
          connectionId: conversation.whatsappConnectionId,
          contactPhoneNumber: contactPhone,
          text: text || undefined,
          duration: duration || undefined,
          quotedMessageId: replyingTo?.id,
        }
      });

      if (error) throw error;

      if (!data?.success) {
        throw new Error(data?.error || 'Erro ao enviar vídeo');
      }

      console.log('✅ Vídeo enviado com sucesso!');
      toast({
        title: 'Vídeo enviado',
        description: 'O vídeo foi enviado com sucesso.',
      });

      setVideoFile(null);
      setIsVideoPreviewOpen(false);
      setReplyingTo(null);
      onRefresh?.();

    } catch (error: any) {
      console.error('❌ Erro ao enviar vídeo:', error);
      throw error; // Re-throw to be handled by VideoPreviewModal
    } finally {
      setIsSendingVideo(false);
    }
  };

  const handleVideoSelect = (file: File) => {
    setVideoFile(file);
    setIsVideoPreviewOpen(true);
  };

  // Send document handler
  const handleSendDocument = async (file: File, text: string) => {
    if (!conversation) return;

    setIsSendingDocument(true);
    try {
      // Convert file to base64
      const reader = new FileReader();
      const base64Promise = new Promise<string>((resolve, reject) => {
        reader.onload = () => resolve(reader.result as string);
        reader.onerror = reject;
      });
      reader.readAsDataURL(file);
      const base64Data = await base64Promise;

      console.log('📤 Enviando documento para Edge Function...');

      // Get contact phone from conversation
      const contactPhone = conversation.contact?.phoneNumber || '';

      const { data, error } = await supabase.functions.invoke('send-whatsapp-document', {
        body: {
          documentData: base64Data,
          fileName: file.name,
          mimeType: file.type || 'application/octet-stream',
          conversationId: conversation.id,
          connectionId: conversation.whatsappConnectionId,
          contactPhoneNumber: contactPhone,
          text: text || undefined,
          quotedMessageId: replyingTo?.id,
        }
      });

      if (error) throw error;

      if (!data?.success) {
        throw new Error(data?.error || 'Erro ao enviar documento');
      }

      console.log('✅ Documento enviado com sucesso!');
      toast({
        title: 'Documento enviado',
        description: 'O documento foi enviado com sucesso.',
      });

      setDocumentFile(null);
      setIsDocumentPreviewOpen(false);
      setReplyingTo(null);
      onRefresh?.();

    } catch (error: any) {
      console.error('❌ Erro ao enviar documento:', error);
      throw error; // Re-throw to be handled by DocumentPreviewModal
    } finally {
      setIsSendingDocument(false);
    }
  };

  const handleDocumentSelect = (file: File) => {
    setDocumentFile(file);
    setIsDocumentPreviewOpen(true);
  };

  // Scroll para o final
  const scrollToBottom = useCallback((behavior: ScrollBehavior = 'smooth') => {
    const container = scrollContainerRef.current;
    if (container) {
      container.scrollTop = container.scrollHeight;
    }
  }, []);

  // Verificar se está no final do scroll
  const checkScrollPosition = useCallback(() => {
    const container = scrollContainerRef.current;
    if (!container) return;
    
    const { scrollTop, scrollHeight, clientHeight } = container;
    const isAtBottom = scrollHeight - scrollTop - clientHeight < 100;
    setShowScrollButton(!isAtBottom);
  }, []);

  // Auto-scroll para última mensagem quando conversa muda ou mensagens carregam
  useEffect(() => {
    if (conversation?.id && messages.length > 0 && !isLoadingMessages) {
      // Usar requestAnimationFrame para garantir que o DOM atualizou
      requestAnimationFrame(() => {
        const container = scrollContainerRef.current;
        if (container) {
          container.scrollTop = container.scrollHeight;
        }
      });
    }
  }, [conversation?.id, messages.length, isLoadingMessages]);

  // Auto-scroll quando novas mensagens chegam (se já estava no final)
  useEffect(() => {
    const container = scrollContainerRef.current;
    if (!container) return;
    
    const { scrollTop, scrollHeight, clientHeight } = container;
    const wasAtBottom = scrollHeight - scrollTop - clientHeight < 100;
    
    if (wasAtBottom) {
      scrollToBottom('smooth');
    } else {
      // Se não estava no final, mostrar botão
      setShowScrollButton(true);
    }
  }, [messages, scrollToBottom]);

  const handleSend = async () => {
    if (!inputValue.trim() || isSendingMessage) return;
    
    if (isInternalNoteMode && onSendInternalNote) {
      // Send as internal note
      const success = await onSendInternalNote(inputValue.trim());
      if (success) {
        setInputValue('');
        setReplyingTo(null);
        // Keep internal note mode active for convenience
        // Restore focus after state update
        setTimeout(() => textareaRef.current?.focus(), 0);
      }
    } else {
      // Send as WhatsApp message
      if (!canReply) return;
      onSendMessage(inputValue.trim(), replyingTo?.id);
      setInputValue('');
      setReplyingTo(null);
      // Restore focus after state update
      setTimeout(() => textareaRef.current?.focus(), 0);
    }
  };

  const handleReply = (message: Message) => {
    setReplyingTo(message);
    textareaRef.current?.focus();
  };

  const handleReaction = async (messageId: string, emoji: string, remove: boolean = false) => {
    if (!onSendReaction) return;
    
    console.log(`😀 ${remove ? 'Removendo' : 'Enviando'} reação:`, emoji);
    setSendingReactionMessageId(messageId);
    
    try {
      await onSendReaction(messageId, emoji, remove);
    } finally {
      setSendingReactionMessageId(null);
    }
  };

  const getUserReactionForMessage = (message: Message): string | undefined => {
    if (!user?.id || !message.reactions) return undefined;
    const userReaction = message.reactions.find(
      r => r.reactorId === user.id && r.reactorType === 'user'
    );
    return userReaction?.emoji;
  };

  const scrollToMessage = (messageId: string) => {
    const element = messageRefs.current[messageId];
    if (element) {
      element.scrollIntoView({ behavior: 'smooth', block: 'center' });
      // Add highlight animation
      element.classList.add('animate-pulse');
      setTimeout(() => {
        element.classList.remove('animate-pulse');
      }, 1500);
    }
  };

  // Register scrollToMessage with parent
  useEffect(() => {
    onRegisterScrollToMessage?.(scrollToMessage);
  }, [onRegisterScrollToMessage]);

  const handleKeyDown = (e: React.KeyboardEvent) => {
    // Don't handle Enter/Escape if quick replies picker is open
    if (showQuickReplies) {
      if (e.key === 'Escape') {
        e.preventDefault();
        setShowQuickReplies(false);
      }
      // Let QuickRepliesPicker handle Arrow keys and Enter
      if (e.key === 'ArrowUp' || e.key === 'ArrowDown' || e.key === 'Enter') {
        return;
      }
    }
    
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleSend();
    }
  };

  // Handle input change to detect "/" trigger
  const handleInputChange = (e: React.ChangeEvent<HTMLTextAreaElement>) => {
    const value = e.target.value;
    setInputValue(value);
    
    // Show quick replies when typing "/" at the start or alone
    if (value.startsWith('/')) {
      setShowQuickReplies(true);
    } else {
      setShowQuickReplies(false);
    }
  };

  // Handle quick reply selection
  const handleQuickReplySelect = async (reply: QuickReply) => {
    console.log('📝 Resposta rápida selecionada:', reply.id, 'Tipo:', reply.media_type);
    setShowQuickReplies(false);
    setInputValue('');
    
    const mediaType = reply.media_type || 'text';
    
    // Handle different media types
    if (mediaType === 'text' || !reply.media_url) {
      // Send as text message
      onSendMessage(reply.message, replyingTo?.id);
    } else if (mediaType === 'image' && reply.media_url) {
      // Send image with caption
      try {
        const response = await fetch(reply.media_url);
        const blob = await response.blob();
        const file = new File([blob], `quick-reply-image.${blob.type.split('/')[1] || 'jpg'}`, { type: blob.type });
        setImageFile(file);
        setIsImagePreviewOpen(true);
        // Pre-fill caption with message if exists
        // Note: ImagePreviewModal will handle the actual sending
      } catch (error) {
        console.error('Erro ao carregar imagem:', error);
        toast({
          title: 'Erro ao carregar imagem',
          description: 'Não foi possível carregar a imagem da resposta rápida.',
          variant: 'destructive',
        });
      }
    } else if (mediaType === 'video' && reply.media_url) {
      // Send video
      try {
        const response = await fetch(reply.media_url);
        const blob = await response.blob();
        const file = new File([blob], `quick-reply-video.${blob.type.split('/')[1] || 'mp4'}`, { type: blob.type });
        setVideoFile(file);
        setIsVideoPreviewOpen(true);
      } catch (error) {
        console.error('Erro ao carregar vídeo:', error);
        toast({
          title: 'Erro ao carregar vídeo',
          description: 'Não foi possível carregar o vídeo da resposta rápida.',
          variant: 'destructive',
        });
      }
    } else if (mediaType === 'audio' && reply.media_url) {
      // Send audio
      try {
        const response = await fetch(reply.media_url);
        const blob = await response.blob();
        const file = new File([blob], `quick-reply-audio.${blob.type.split('/')[1] || 'mp3'}`, { type: blob.type });
        setAudioFile(file);
      } catch (error) {
        console.error('Erro ao carregar áudio:', error);
        toast({
          title: 'Erro ao carregar áudio',
          description: 'Não foi possível carregar o áudio da resposta rápida.',
          variant: 'destructive',
        });
      }
    } else if (mediaType === 'document' && reply.media_url) {
      // Send document
      try {
        const response = await fetch(reply.media_url);
        const blob = await response.blob();
        const fileName = reply.media_url.split('/').pop() || 'document';
        const file = new File([blob], fileName, { type: blob.type || 'application/octet-stream' });
        setDocumentFile(file);
        setIsDocumentPreviewOpen(true);
      } catch (error) {
        console.error('Erro ao carregar documento:', error);
        toast({
          title: 'Erro ao carregar documento',
          description: 'Não foi possível carregar o documento da resposta rápida.',
          variant: 'destructive',
        });
      }
    }
    
    setReplyingTo(null);
    textareaRef.current?.focus();
  };

  const getInitials = (name?: string) => {
    if (!name) return '?';
    return name
      .split(' ')
      .map((n) => n[0])
      .join('')
      .toUpperCase()
      .slice(0, 2);
  };

  const formatMessageTime = (date: string) => {
    return format(new Date(date), 'HH:mm', { locale: ptBR });
  };

  const formatMessageDate = (date: string) => {
    return format(new Date(date), "dd 'de' MMMM", { locale: ptBR });
  };

  // Group messages by date
  const groupedMessages = messages.reduce((groups, message) => {
    const date = format(new Date(message.createdAt), 'yyyy-MM-dd');
    if (!groups[date]) {
      groups[date] = [];
    }
    groups[date].push(message);
    return groups;
  }, {} as Record<string, Message[]>);

  if (!conversation) {
    return (
      <div className="flex-1 flex items-center justify-center bg-muted/30">
        <div className="text-center">
          <div className="w-16 h-16 bg-muted rounded-full flex items-center justify-center mx-auto mb-4">
            <Phone className="w-8 h-8 text-muted-foreground" />
          </div>
          <h3 className="text-lg font-medium text-foreground">
            Selecione uma conversa
          </h3>
          <p className="text-sm text-muted-foreground mt-1">
            Escolha uma conversa da lista para começar
          </p>
        </div>
      </div>
    );
  }

  return (
    <div className="flex-1 flex flex-col bg-background h-full">
      {/* Chat Header */}
      <div className="px-4 py-3 border-b border-border bg-card">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3 min-w-0">
            <Avatar className="w-10 h-10 flex-shrink-0">
              <AvatarImage src={conversation.contact?.avatarUrl} />
              <AvatarFallback className="bg-primary/10 text-primary text-sm">
                {getInitials(conversation.contact?.name)}
              </AvatarFallback>
            </Avatar>
            <div className="min-w-0">
              <p className="font-medium text-sm text-foreground truncate">
                {conversation.contact?.name || conversation.contact?.phoneNumber}
              </p>
              <p className="text-xs text-muted-foreground">
                {conversation.contact?.phoneNumber}
              </p>
            </div>
          </div>
          
          <div className="flex items-center gap-2 flex-shrink-0">
            {/* Botão de atribuição */}
            <AssignButton
              conversation={conversation}
              currentUserId={currentUserId}
              onAssigned={onRefresh || onAssign}
              isRestricted={isRestricted}
            />
            
            {/* Menu de ações */}
            <ConversationActions
              conversation={conversation}
              currentUserId={currentUserId}
              currentUserRole={currentUserRole}
              onAction={onRefresh || onAssign}
              onOpenContactDetails={onOpenContactDetails}
            />
          </div>
        </div>

        {/* Badges de status */}
        <div className="flex items-center gap-2 mt-2">
          {/* Badge de atribuição */}
          {conversation.assignedUser ? (
            <Badge 
              variant="outline" 
              className={cn(
                "text-xs",
                conversation.assignedUserId === currentUserId 
                  ? "bg-success/10 text-success border-success/30"
                  : "bg-muted text-muted-foreground"
              )}
            >
              {conversation.assignedUserId === currentUserId 
                ? 'Atribuída a você'
                : `Atribuída a ${conversation.assignedUser.fullName?.split(' ')[0]}`
              }
            </Badge>
          ) : (
            <Badge variant="outline" className="text-xs bg-warning/10 text-warning border-warning/30">
              Sem responsável
            </Badge>
          )}

          {/* Badge de status */}
          <Badge 
            variant="outline" 
            className={cn(
              "text-xs",
              conversation.status === 'closed' && "bg-muted text-muted-foreground",
              conversation.status === 'open' && "bg-primary/10 text-primary border-primary/30",
              conversation.status === 'in_progress' && "bg-success/10 text-success border-success/30"
            )}
          >
            {conversation.status === 'open' && 'Aberta'}
            {conversation.status === 'in_progress' && 'Em atendimento'}
            {conversation.status === 'closed' && 'Fechada'}
            {conversation.status === 'pending' && 'Pendente'}
            {conversation.status === 'waiting' && 'Aguardando'}
            {conversation.status === 'resolved' && 'Resolvida'}
          </Badge>

          {/* Badge de departamento */}
          {conversation.department && (
            <Badge variant="secondary" className="text-xs">
              {conversation.department.name}
            </Badge>
          )}
        </div>
      </div>

      {/* Messages Area */}
      <div className="flex-1 relative overflow-hidden">
        <div 
          ref={scrollContainerRef}
          onScroll={checkScrollPosition}
          className="h-full overflow-y-auto px-4"
        >
          {isLoadingMessages ? (
            <div className="flex items-center justify-center h-full">
              <Loader2 className="w-6 h-6 animate-spin text-muted-foreground" />
            </div>
          ) : messages.length === 0 ? (
            <div className="flex items-center justify-center h-full">
              <p className="text-muted-foreground text-sm">
                Nenhuma mensagem ainda
              </p>
            </div>
          ) : (
            <div className="py-4 space-y-4">
              {Object.entries(groupedMessages).map(([date, dateMessages]) => (
                <div key={date}>
                  {/* Date separator */}
                  <div className="flex items-center justify-center my-4">
                    <Badge variant="secondary" className="text-xs font-normal">
                      {formatMessageDate(dateMessages[0].createdAt)}
                    </Badge>
                  </div>

                  {/* Messages */}
                  <div className="space-y-3">
                    {dateMessages.map((message) => {
                      const isOutbound = message.direction === 'outbound';
                      const isFailed = message.status === 'failed';
                      
                      return (
                        <div
                          key={message.id}
                          ref={(el) => { messageRefs.current[message.id] = el; }}
                          className={cn(
                            'flex items-center gap-2 group/message',
                            isOutbound ? 'justify-end' : 'justify-start'
                          )}
                        >
                          {/* Action buttons - LEFT side for outbound messages */}
                          {isOutbound && (
                            <div className="flex items-center gap-1 opacity-0 group-hover/message:opacity-100 transition-opacity duration-200">
                              {/* Reply button */}
                              {canReply && (
                                <Tooltip>
                                  <TooltipTrigger asChild>
                                    <Button
                                      variant="ghost"
                                      size="icon"
                                      className="h-7 w-7 rounded-full bg-muted/80 hover:bg-muted"
                                      onClick={() => handleReply(message)}
                                    >
                                      <Reply className="w-3.5 h-3.5" />
                                    </Button>
                                  </TooltipTrigger>
                                  <TooltipContent>Responder</TooltipContent>
                                </Tooltip>
                              )}
                              
                              {/* Reaction button */}
                              {onSendReaction && message.whatsappMessageId && (
                                <ReactionPicker
                                  onSelect={(emoji) => handleReaction(message.id, emoji)}
                                  onRemove={() => {
                                    const currentEmoji = getUserReactionForMessage(message);
                                    if (currentEmoji) {
                                      handleReaction(message.id, currentEmoji, true);
                                    }
                                  }}
                                  currentUserReaction={getUserReactionForMessage(message)}
                                  isLoading={sendingReactionMessageId === message.id}
                                  isOutbound={isOutbound}
                                />
                              )}
                            </div>
                          )}
                          
                          <div
                            className={cn(
                              'max-w-[70%] group relative',
                              message.messageType !== 'audio' && (
                                message.isInternalNote 
                                  ? 'message-bubble-internal-note'
                                  : isOutbound 
                                    ? 'message-bubble-outgoing' 
                                    : 'message-bubble-incoming'
                              ),
                              isFailed && 'opacity-80'
                            )}
                          >
                            {/* Internal note indicator */}
                            {message.isInternalNote && (
                              <div className="flex items-center gap-1 mb-1 text-amber-600 dark:text-amber-400">
                                <StickyNote className="w-3 h-3" />
                                <span className="text-[10px] font-medium uppercase tracking-wide">Nota interna</span>
                              </div>
                            )}
                            {/* Quoted message preview */}
                            {message.quotedMessage && (
                              <QuotedMessagePreview
                                quotedMessage={message.quotedMessage}
                                isOutbound={isOutbound}
                                onClick={() => message.quotedMessageId && scrollToMessage(message.quotedMessageId)}
                              />
                            )}
                            {/* Audio message */}
                            {message.messageType === 'audio' && message.mediaUrl ? (
                              <AudioPlayer
                                src={message.mediaUrl}
                                mimeType={message.mediaMimeType}
                                duration={(message.metadata as any)?.duration}
                                isOutbound={isOutbound}
                                status={message.status}
                                errorMessage={message.errorMessage}
                              />
                            ) : message.messageType === 'audio' ? (
                              // Audio without URL (loading or failed)
                              <div className={cn(
                                "flex items-center gap-2 p-3 rounded-xl min-w-[200px]",
                                isOutbound ? "bg-primary/20" : "bg-muted/80"
                              )}>
                                {isFailed ? (
                                  <>
                                    <AlertCircle className="w-5 h-5 text-destructive" />
                                    <span className="text-xs text-destructive">
                                      Falha ao carregar áudio
                                    </span>
                                  </>
                                ) : (
                                  <>
                                    <Loader2 className="w-5 h-5 animate-spin text-muted-foreground" />
                                    <span className="text-xs text-muted-foreground">
                                      Carregando áudio...
                                    </span>
                                  </>
                                )}
                              </div>
                            ) : message.messageType === 'image' && message.mediaUrl ? (
                              // Image message
                              <ImageMessage
                                src={message.mediaUrl}
                                isOutbound={isOutbound}
                                width={(message.metadata as any)?.width}
                                height={(message.metadata as any)?.height}
                                fileSize={(message.metadata as any)?.fileSize}
                                status={message.status}
                                errorMessage={message.errorMessage}
                                caption={message.content}
                              />
                            ) : message.messageType === 'image' ? (
                              // Image without URL (loading or failed)
                              <div className={cn(
                                "flex items-center gap-2 p-3 rounded-xl min-w-[200px]",
                                isOutbound ? "bg-primary/20" : "bg-muted/80"
                              )}>
                                {isFailed ? (
                                  <>
                                    <AlertCircle className="w-5 h-5 text-destructive" />
                                    <span className="text-xs text-destructive">
                                      Falha ao carregar imagem
                                    </span>
                                  </>
                                ) : (
                                  <>
                                    <Loader2 className="w-5 h-5 animate-spin text-muted-foreground" />
                                    <span className="text-xs text-muted-foreground">
                                      Carregando imagem...
                                    </span>
                                  </>
                                )}
                              </div>
                            ) : message.messageType === 'video' && message.mediaUrl ? (
                              // Video message
                              <VideoMessage
                                src={message.mediaUrl}
                                isOutbound={isOutbound}
                                width={(message.metadata as any)?.width}
                                height={(message.metadata as any)?.height}
                                duration={(message.metadata as any)?.duration}
                                fileSize={(message.metadata as any)?.fileSize}
                                status={message.status}
                                errorMessage={message.errorMessage}
                                caption={message.content}
                              />
                            ) : message.messageType === 'video' ? (
                              // Video without URL (loading or failed)
                              <div className={cn(
                                "flex items-center gap-2 p-3 rounded-xl min-w-[200px]",
                                isOutbound ? "bg-primary/20" : "bg-muted/80"
                              )}>
                                {isFailed ? (
                                  <>
                                    <AlertCircle className="w-5 h-5 text-destructive" />
                                    <span className="text-xs text-destructive">
                                      Falha ao carregar vídeo
                                    </span>
                                  </>
                                ) : (
                                  <>
                                    <Loader2 className="w-5 h-5 animate-spin text-muted-foreground" />
                                    <span className="text-xs text-muted-foreground">
                                      Carregando vídeo...
                                    </span>
                                  </>
                                )}
                              </div>
                            ) : message.messageType === 'sticker' && message.mediaUrl ? (
                              // Sticker message
                              <StickerMessage
                                mediaUrl={message.mediaUrl}
                                isAnimated={(message.metadata as any)?.isAnimated}
                              />
                            ) : message.messageType === 'sticker' ? (
                              // Sticker without URL (loading or failed)
                              <div className={cn(
                                "flex items-center gap-2 p-3 rounded-lg min-w-[150px]",
                                isOutbound ? "bg-primary/10" : "bg-muted/50"
                              )}>
                                {isFailed ? (
                                  <>
                                    <AlertCircle className="w-5 h-5 text-destructive" />
                                    <span className="text-xs text-destructive">
                                      Falha ao carregar figurinha
                                    </span>
                                  </>
                                ) : (
                                  <>
                                    <Loader2 className="w-5 h-5 animate-spin text-muted-foreground" />
                                    <span className="text-xs text-muted-foreground">
                                      Carregando figurinha...
                                    </span>
                                  </>
                                )}
                              </div>
                            ) : message.messageType === 'document' && message.mediaUrl ? (
                              // Document message
                              <DocumentMessage
                                src={message.mediaUrl}
                                isOutbound={isOutbound}
                                fileName={(message.metadata as any)?.fileName || (message.metadata as any)?.originalFileName}
                                fileSize={(message.metadata as any)?.fileSize}
                                mimeType={message.mediaMimeType || (message.metadata as any)?.originalMimetype}
                                pageCount={(message.metadata as any)?.pageCount}
                                status={message.status}
                                errorMessage={message.errorMessage}
                                caption={message.content}
                              />
                            ) : message.messageType === 'document' ? (
                              // Document without URL (loading or failed)
                              <div className={cn(
                                "flex items-center gap-2 p-3 rounded-xl min-w-[200px]",
                                isOutbound ? "bg-primary/20" : "bg-muted/80"
                              )}>
                                {isFailed ? (
                                  <>
                                    <AlertCircle className="w-5 h-5 text-destructive" />
                                    <span className="text-xs text-destructive">
                                      Falha ao carregar documento
                                    </span>
                                  </>
                                ) : (
                                  <>
                                    <Loader2 className="w-5 h-5 animate-spin text-muted-foreground" />
                                    <span className="text-xs text-muted-foreground">
                                      Carregando documento...
                                    </span>
                                  </>
                                )}
                              </div>
                            ) : (
                              /* Text message content */
                              <p className="text-sm whitespace-pre-wrap break-words">
                                {message.content}
                              </p>
                            )}
                            
                            {/* Message footer - only for non-audio/image/video or audio/image/video without URL */}
                            {((message.messageType !== 'audio' && message.messageType !== 'image' && message.messageType !== 'video' && message.messageType !== 'document') || (!message.mediaUrl)) && (
                              <div className={cn(
                                'flex items-center gap-1 mt-1',
                                isOutbound ? 'justify-end' : 'justify-start'
                              )}>
                                <span className={cn(
                                  'text-xs',
                                  isOutbound ? 'text-primary-foreground/70' : 'text-muted-foreground'
                                )}>
                                  {formatMessageTime(message.createdAt)}
                                </span>
                                {isOutbound && (
                                  <Tooltip>
                                    <TooltipTrigger asChild>
                                      <span className={cn(
                                        'text-primary-foreground/70 cursor-default',
                                        message.status === 'read' && 'text-primary-foreground',
                                        message.status === 'failed' && 'text-destructive'
                                      )}>
                                        {statusIcons[message.status]}
                                      </span>
                                    </TooltipTrigger>
                                    <TooltipContent side="left">
                                      {statusTooltips[message.status] || message.status}
                                    </TooltipContent>
                                  </Tooltip>
                                )}
                              </div>
                            )}

                            {/* Message reactions */}
                            {message.reactions && message.reactions.length > 0 && (
                              <MessageReactions
                                reactions={message.reactions}
                                isOutbound={isOutbound}
                              />
                            )}
                            {/* Resend button for failed messages */}
                            {isOutbound && isFailed && onResendMessage && (
                              <div className="mt-2 pt-2 border-t border-destructive/20">
                                <Button
                                  variant="ghost"
                                  size="sm"
                                  onClick={() => onResendMessage(message.id)}
                                  className="h-6 px-2 text-xs text-destructive hover:text-destructive hover:bg-destructive/10"
                                >
                                  <RotateCcw className="w-3 h-3 mr-1" />
                                  Reenviar
                                </Button>
                              </div>
                            )}
                          </div>
                          
                          {/* Action buttons - RIGHT side for inbound messages */}
                          {!isOutbound && (
                            <div className="flex items-center gap-1 opacity-0 group-hover/message:opacity-100 transition-opacity duration-200">
                              {/* Reply button */}
                              {canReply && (
                                <Tooltip>
                                  <TooltipTrigger asChild>
                                    <Button
                                      variant="ghost"
                                      size="icon"
                                      className="h-7 w-7 rounded-full bg-muted/80 hover:bg-muted"
                                      onClick={() => handleReply(message)}
                                    >
                                      <Reply className="w-3.5 h-3.5" />
                                    </Button>
                                  </TooltipTrigger>
                                  <TooltipContent>Responder</TooltipContent>
                                </Tooltip>
                              )}
                              
                              {/* Reaction button - to the right of reply */}
                              {onSendReaction && message.whatsappMessageId && (
                                <ReactionPicker
                                  onSelect={(emoji) => handleReaction(message.id, emoji)}
                                  onRemove={() => {
                                    const currentEmoji = getUserReactionForMessage(message);
                                    if (currentEmoji) {
                                      handleReaction(message.id, currentEmoji, true);
                                    }
                                  }}
                                  currentUserReaction={getUserReactionForMessage(message)}
                                  isLoading={sendingReactionMessageId === message.id}
                                  isOutbound={isOutbound}
                                />
                              )}
                            </div>
                          )}
                        </div>
                      );
                    })}
                  </div>
                </div>
              ))}
              {/* Elemento invisível para scroll */}
              <div ref={messagesEndRef} />
            </div>
          )}
        </div>

        {/* Botão Scroll to Bottom */}
        {showScrollButton && (
          <Button
            onClick={() => scrollToBottom('smooth')}
            size="icon"
            className="absolute bottom-4 right-4 h-10 w-10 rounded-full shadow-lg bg-primary hover:bg-primary/90 animate-fade-in"
          >
            <ArrowDown className="w-5 h-5" />
          </Button>
        )}
      </div>

      {/* Input Area */}
      <div className="p-4 border-t border-border bg-card">
        {/* Reply preview */}
        {replyingTo && (
          <ReplyInputPreview
            quotedMessage={{
              id: replyingTo.id,
              content: replyingTo.content,
              messageType: replyingTo.messageType,
              senderType: replyingTo.senderType,
              mediaUrl: replyingTo.mediaUrl,
              createdAt: replyingTo.createdAt,
            }}
            onCancel={() => setReplyingTo(null)}
          />
        )}
        
        {/* Blocker message */}
        <MessageInputBlocker
          conversation={conversation}
          currentUserId={currentUserId}
        />

        {/* Audio recorder */}
        {isRecordingAudio && (
          <div className="mb-3">
            <AudioRecorder
              onSend={handleSendAudio}
              onCancel={() => setIsRecordingAudio(false)}
              disabled={isSendingAudio}
            />
          </div>
        )}

        {/* Audio file preview */}
        {audioFile && !isRecordingAudio && (
          <div className="mb-3">
            <AudioFilePreview
              file={audioFile}
              onSend={handleSendAudioFile}
              onCancel={() => setAudioFile(null)}
              disabled={isSendingAudio}
            />
          </div>
        )}

        {!isRecordingAudio && !audioFile && (
          <div className="flex items-end gap-2">
            <AttachmentMenu
              onImageSelect={handleImageSelect}
              onVideoSelect={handleVideoSelect}
              onAudioSelect={handleAudioFileSelect}
              onDocumentSelect={handleDocumentSelect}
              disabled={!canReply}
            />
            
            <div className="flex-1 relative">
              {/* Quick Replies Picker */}
              <QuickRepliesPicker
                inputValue={inputValue}
                onSelect={handleQuickReplySelect}
                onClose={() => setShowQuickReplies(false)}
                isOpen={showQuickReplies && canReply}
              />
              
              {/* Internal Note Toggle Button */}
              <Tooltip>
                <TooltipTrigger asChild>
                  <Button
                    type="button"
                    variant={isInternalNoteMode ? "default" : "ghost"}
                    size="icon"
                    onClick={() => setIsInternalNoteMode(!isInternalNoteMode)}
                    className={cn(
                      "h-8 w-8 flex-shrink-0",
                      isInternalNoteMode && "bg-amber-500 hover:bg-amber-600 text-white"
                    )}
                  >
                    <StickyNote className="w-4 h-4" />
                  </Button>
                </TooltipTrigger>
                <TooltipContent>
                  {isInternalNoteMode ? 'Desativar nota interna' : 'Ativar nota interna'}
                </TooltipContent>
              </Tooltip>

              <Textarea
                ref={textareaRef}
                value={inputValue}
                onChange={handleInputChange}
                onKeyDown={handleKeyDown}
                placeholder={
                  isInternalNoteMode
                    ? "Digite sua nota interna (não será enviado ao cliente)..."
                    : canReply 
                      ? "Digite / para respostas rápidas..." 
                      : blockInfo.message
                }
                className={cn(
                  "min-h-[44px] max-h-32 resize-none pr-12 transition-colors duration-200",
                  !canReply && !isInternalNoteMode && "bg-muted/50 cursor-not-allowed",
                  isInternalNoteMode && "bg-amber-50 border-amber-300 focus-visible:ring-amber-400 placeholder:text-amber-600/70"
                )}
                rows={1}
                disabled={isSendingMessage || (!canReply && !isInternalNoteMode)}
              />
              <EmojiMessagePicker
                onSelect={(emoji) => {
                  if (isInternalNoteMode && onSendInternalNote) {
                    onSendInternalNote(emoji);
                  } else {
                    console.log('📤 Enviando emoji como mensagem:', emoji);
                    onSendMessage(emoji, replyingTo?.id);
                    setReplyingTo(null);
                  }
                }}
                disabled={(!canReply && !isInternalNoteMode) || isSendingMessage}
              />
            </div>

            {/* Mic button - show when no text */}
            {!inputValue.trim() ? (
              <Tooltip>
                <TooltipTrigger asChild>
                  <Button 
                    onClick={() => setIsRecordingAudio(true)}
                    disabled={!canReply}
                    variant="ghost"
                    className="flex-shrink-0"
                  >
                    <Mic className="w-5 h-5" />
                  </Button>
                </TooltipTrigger>
                <TooltipContent>Gravar áudio</TooltipContent>
              </Tooltip>
            ) : (
              <Button 
                onClick={handleSend}
                disabled={!inputValue.trim() || isSendingMessage || !canReply}
                className="flex-shrink-0"
              >
                {isSendingMessage ? (
                  <Loader2 className="w-4 h-4 animate-spin" />
                ) : (
                  <Send className="w-4 h-4" />
                )}
              </Button>
            )}
          </div>
        )}
      </div>

      {/* Image Preview Modal */}
      <ImagePreviewModal
        file={imageFile}
        isOpen={isImagePreviewOpen}
        onClose={() => {
          setIsImagePreviewOpen(false);
          setImageFile(null);
        }}
        onSend={handleSendImage}
        onChangeFile={() => {
          const input = document.createElement('input');
          input.type = 'file';
          input.accept = 'image/jpeg,image/png,image/gif,image/webp,.jpg,.jpeg,.png,.gif,.webp';
          input.onchange = (e) => {
            const file = (e.target as HTMLInputElement).files?.[0];
            if (file) {
              setImageFile(file);
            }
          };
          input.click();
        }}
      />

      {/* Video Preview Modal */}
      <VideoPreviewModal
        file={videoFile}
        isOpen={isVideoPreviewOpen}
        onClose={() => {
          setIsVideoPreviewOpen(false);
          setVideoFile(null);
        }}
        onSend={handleSendVideo}
        onChangeFile={() => {
          // Trigger file selection again
          const input = document.createElement('input');
          input.type = 'file';
          input.accept = 'video/mp4,video/avi,video/x-msvideo,video/quicktime,video/x-matroska,video/webm,.mp4,.avi,.mov,.mkv,.webm';
          input.onchange = (e) => {
            const file = (e.target as HTMLInputElement).files?.[0];
            if (file) {
              setVideoFile(file);
            }
          };
          input.click();
        }}
      />

      {/* Document Preview Modal */}
      <DocumentPreviewModal
        file={documentFile}
        isOpen={isDocumentPreviewOpen}
        onClose={() => {
          setIsDocumentPreviewOpen(false);
          setDocumentFile(null);
        }}
        onSend={handleSendDocument}
        onChangeFile={() => {
          const input = document.createElement('input');
          input.type = 'file';
          input.accept = '.pdf,.doc,.docx,.xls,.xlsx,.ppt,.pptx,.txt,.csv,.md,.zip,.rar,application/pdf,application/msword,application/vnd.openxmlformats-officedocument.wordprocessingml.document,application/vnd.ms-excel,application/vnd.openxmlformats-officedocument.spreadsheetml.sheet';
          input.onchange = (e) => {
            const file = (e.target as HTMLInputElement).files?.[0];
            if (file) {
              setDocumentFile(file);
            }
          };
          input.click();
        }}
      />
    </div>
  );
}
