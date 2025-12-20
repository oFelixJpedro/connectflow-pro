import { useState, useRef, useEffect, useCallback } from 'react';
import { 
  Send, 
  Check,
  CheckCheck,
  Clock,
  CalendarClock,
  AlertCircle,
  Phone,
  Loader2,
  RotateCcw,
  ArrowDown,
  Reply,
  Mic,
  StickyNote,
  Camera,
  FileText,
  X,
  Trash2,
  Pencil,
  Bot
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { ContactAvatar } from '@/components/ui/contact-avatar';
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
import { MultiFilePreviewModal } from './MultiFilePreviewModal';
import { DropZone } from './DropZone';
import { MessageReactions } from './MessageReactions';
import { ReactionPicker } from './ReactionPicker';
import { EmojiMessagePicker } from './EmojiMessagePicker';
import { AIResponseButton } from './AIResponseButton';
import { QuickRepliesPicker } from './QuickRepliesPicker';
import { QuickReplyConfirmModal } from './QuickReplyConfirmModal';
import { DeletedMessageIndicator } from './DeletedMessageIndicator';
import { DeleteMessageModal } from './DeleteMessageModal';
import { InternalNoteAudioRecorder } from './InternalNoteAudioRecorder';
import { ScheduleMessageModal } from './ScheduleMessageModal';
import { QuickReply } from '@/hooks/useQuickRepliesData';
import { cn } from '@/lib/utils';
import type { Conversation, Message, QuotedMessage } from '@/types';
import { format } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import { useAuth } from '@/contexts/AuthContext';
import { supabase } from '@/integrations/supabase/client';
import { toast } from '@/hooks/use-toast';

// Import mentions
import { MentionPicker, MentionText } from '@/components/mentions';
import { useMentions, parseMentionsFromText } from '@/hooks/useMentions';
import { LinkifyText } from '@/components/ui/linkify-text';

interface ChatPanelProps {
  conversation: Conversation | null;
  messages: Message[];
  onSendMessage: (content: string, quotedMessageId?: string) => void | Promise<void>;
  onSendInternalNote?: (content: string, messageType?: 'text' | 'image' | 'video' | 'audio' | 'document', mediaUrl?: string, mediaMimeType?: string, metadata?: Record<string, unknown>, mentions?: string[]) => Promise<boolean>;
  onResendMessage?: (messageId: string) => void;
  onAssign: () => void;
  onClose: () => void;
  onRefresh?: () => void;
  onOpenContactDetails?: () => void;
  onSendReaction?: (messageId: string, emoji: string, remove?: boolean) => Promise<boolean>;
  onRegisterScrollToMessage?: (fn: (messageId: string) => void) => void;
  onMessagesUpdate?: (messages: Message[]) => void;
  isLoadingMessages?: boolean;
  isSendingMessage?: boolean;
  isRestricted?: boolean;
}

const statusIcons: Record<string, React.ReactNode> = {
  pending: <Clock className="w-3 h-3 animate-pulse" />,
  sent: <CheckCheck className="w-3 h-3" />,
  delivered: <CheckCheck className="w-3 h-3" />,
  read: <CheckCheck className="w-3 h-3" />,
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
  onMessagesUpdate,
  isLoadingMessages = false,
  isSendingMessage = false,
  isRestricted = false,
}: ChatPanelProps) {
  const { user, userRole, profile } = useAuth();
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
  const [pendingQuickReply, setPendingQuickReply] = useState<QuickReply | null>(null);
  const [isQuickReplyConfirmOpen, setIsQuickReplyConfirmOpen] = useState(false);
  const [isRecordingNoteAudio, setIsRecordingNoteAudio] = useState(false);
  const [isSendingNoteAudio, setIsSendingNoteAudio] = useState(false);
  const [noteAttachment, setNoteAttachment] = useState<{
    messageType: 'image' | 'video' | 'audio' | 'document';
    mediaUrl: string;
    mediaMimeType: string;
    metadata: Record<string, unknown>;
  } | null>(null);
  const [messageToDelete, setMessageToDelete] = useState<Message | null>(null);
  const [isDeleteModalOpen, setIsDeleteModalOpen] = useState(false);
  const [teamMembers, setTeamMembers] = useState<{ id: string; fullName: string }[]>([]);
  const [isCorrectingText, setIsCorrectingText] = useState(false);
  const [isGeneratingResponse, setIsGeneratingResponse] = useState(false);
  const [pendingMultiFiles, setPendingMultiFiles] = useState<File[]>([]);
  const [isMultiFilePreviewOpen, setIsMultiFilePreviewOpen] = useState(false);
  const [scheduleModalOpen, setScheduleModalOpen] = useState(false);
  
  // Mentions for internal notes
  const {
    showMentionPicker,
    mentionFilterText,
    handleInputChange: handleMentionInputChange,
    handleMentionSelect,
    closeMentionPicker,
    resetMentions,
  } = useMentions();
  
  const scrollContainerRef = useRef<HTMLDivElement>(null);
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const messageRefs = useRef<Record<string, HTMLDivElement | null>>({});
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const imageInputRef = useRef<HTMLInputElement>(null);
  
  // Load team members for mentions
  useEffect(() => {
    const loadTeamMembers = async () => {
      if (!profile?.company_id) return;
      const { data } = await supabase
        .from('profiles')
        .select('id, full_name')
        .eq('company_id', profile.company_id)
        .eq('active', true);
      if (data) {
        setTeamMembers(data.map(p => ({ id: p.id, fullName: p.full_name })));
      }
    };
    loadTeamMembers();
  }, [profile?.company_id]);

  const currentUserId = user?.id || '';
  const currentUserRole = userRole?.role || 'agent';
  const currentUserName = profile?.full_name || '';

  // Check if user can delete a message
  const canDeleteMessage = useCallback((message: Message): boolean => {
    // Conversation must be assigned to current user
    if (conversation?.assignedUserId !== currentUserId) {
      return false;
    }
    
    // Only outbound messages (sent by system/agent)
    if (message.direction !== 'outbound') {
      return false;
    }
    
    // Only messages from user (not system/bot)
    if (message.senderType !== 'user') {
      return false;
    }
    
    // Allow deletable message types (text, image, video, audio, document, sticker)
    const deletableTypes = ['text', 'image', 'video', 'audio', 'document', 'sticker'];
    if (!deletableTypes.includes(message.messageType)) {
      return false;
    }
    
    // Not already deleted
    if (message.isDeleted) {
      return false;
    }
    
    // Must have whatsapp_message_id
    if (!message.whatsappMessageId) {
      return false;
    }
    
    // Not internal notes
    if (message.isInternalNote) {
      return false;
    }
    
    return true;
  }, [conversation?.assignedUserId, currentUserId]);

  const handleDeleteMessage = (message: Message) => {
    setMessageToDelete(message);
    setIsDeleteModalOpen(true);
  };

  // Verificar se pode responder
  const blockInfo = useMessageBlocker(conversation, currentUserId);
  const canReply = !blockInfo.blocked;

  // Correct text with AI handler
  const handleCorrectText = async () => {
    if (!inputValue.trim() || isCorrectingText || isInternalNoteMode) return;
    
    setIsCorrectingText(true);
    try {
      const { data, error } = await supabase.functions.invoke('correct-text', {
        body: { text: inputValue }
      });
      
      if (error) throw error;
      
      if (data?.correctedText) {
        setInputValue(data.correctedText);
        if (data.hasChanges) {
          toast({ 
            title: 'Texto corrigido', 
            description: 'As correções foram aplicadas.' 
          });
        } else {
          toast({ 
            title: 'Sem correções', 
            description: 'O texto já está correto!' 
          });
        }
      }
    } catch (error: unknown) {
      const errorMessage = error instanceof Error ? error.message : 'Tente novamente';
      console.error('❌ Erro ao corrigir texto:', error);
      toast({ 
        title: 'Erro ao corrigir', 
        description: errorMessage,
        variant: 'destructive' 
      });
    } finally {
      setIsCorrectingText(false);
    }
  };

  // Generate AI response handler
  const handleGenerateAIResponse = async () => {
    if (!conversation || !messages.length || isGeneratingResponse || isInternalNoteMode) return;
    
    setIsGeneratingResponse(true);
    try {
      // Filter valid messages (exclude internal notes, deleted messages)
      const validMessages = messages.filter(msg => 
        !msg.isInternalNote && 
        !msg.isDeleted
      ).map(msg => ({
        content: msg.content,
        direction: msg.direction,
        messageType: msg.messageType,
        mediaUrl: msg.mediaUrl,
        metadata: msg.metadata,
      }));

      if (validMessages.length === 0) {
        toast({ 
          title: 'Sem mensagens', 
          description: 'Não há mensagens para analisar.',
          variant: 'destructive' 
        });
        return;
      }

      // Get additional context for AI
      const agentName = conversation.assignedUser?.fullName || profile?.full_name;
      const departmentName = conversation.department?.name;
      const conversationTags = conversation.tags || [];

      const { data, error } = await supabase.functions.invoke('generate-ai-response', {
        body: { 
          messages: validMessages,
          contactName: conversation.contact?.name || 'Cliente',
          agentName: agentName,
          department: departmentName,
          tags: conversationTags
        }
      });
      
      if (error) throw error;
      
      if (data?.response) {
        setInputValue(data.response);
        toast({ 
          title: 'Resposta gerada', 
          description: 'Revise e envie!' 
        });
      }
    } catch (error: unknown) {
      const errorMessage = error instanceof Error ? error.message : 'Tente novamente';
      console.error('❌ Erro ao gerar resposta:', error);
      toast({ 
        title: 'Erro ao gerar resposta', 
        description: errorMessage,
        variant: 'destructive' 
      });
    } finally {
      setIsGeneratingResponse(false);
    }
  };

  // Save transcription to message metadata
  const handleTranscriptionComplete = async (messageId: string, text: string) => {
    try {
      // Find the message to get current metadata
      const message = messages.find(m => m.id === messageId);
      const currentMetadata = (message?.metadata as Record<string, unknown>) || {};
      
      const updatedMetadata = { 
        ...currentMetadata, 
        transcription: text 
      };
      
      // Update message with transcription in metadata
      const { error } = await supabase
        .from('messages')
        .update({ metadata: updatedMetadata })
        .eq('id', messageId);
        
      if (error) {
        console.error('Erro ao salvar transcrição:', error);
        toast({
          title: 'Erro ao salvar transcrição',
          description: 'A transcrição pode não persistir após recarregar.',
          variant: 'destructive',
        });
        return;
      }
      
      // Update local state to persist transcription without reload
      if (onMessagesUpdate) {
        const updatedMessages = messages.map(m => 
          m.id === messageId 
            ? { ...m, metadata: updatedMetadata }
            : m
        );
        onMessagesUpdate(updatedMessages);
      }
      
      console.log('✅ Transcrição salva no banco de dados');
    } catch (error) {
      console.error('Erro ao salvar transcrição:', error);
      toast({
        title: 'Erro ao salvar transcrição',
        description: 'Ocorreu um erro inesperado.',
        variant: 'destructive',
      });
    }
  };

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

  // Handle multiple files selection (from drop zone or file picker)
  const handleMultipleFilesSelect = useCallback((files: File[]) => {
    if (files.length === 1) {
      // Single file - use existing handlers
      const file = files[0];
      if (file.type.startsWith('image/')) {
        handleImageSelect(file);
      } else if (file.type.startsWith('video/')) {
        handleVideoSelect(file);
      } else if (file.type.startsWith('audio/')) {
        handleAudioFileSelect(file);
      } else {
        handleDocumentSelect(file);
      }
    } else if (files.length > 1) {
      // Multiple files - open multi-file preview modal
      setPendingMultiFiles(files);
      setIsMultiFilePreviewOpen(true);
    }
  }, []);

  // Handle paste event for images
  const handlePaste = useCallback((e: React.ClipboardEvent) => {
    const items = e.clipboardData?.items;
    if (!items || (!canReply && !isInternalNoteMode)) return;

    for (const item of items) {
      if (item.type.startsWith('image/')) {
        e.preventDefault();
        const file = item.getAsFile();
        if (file) {
          // Create a named file for pasted image
          const extension = item.type.split('/')[1] || 'png';
          const pastedFile = new File([file], `imagem_colada_${Date.now()}.${extension}`, {
            type: item.type,
          });
          handleImageSelect(pastedFile);
        }
        break;
      }
    }
  }, [canReply, isInternalNoteMode]);

  // Handle sending multiple files sequentially
  const handleSendMultipleFiles = async (files: { file: File; caption: string }[]) => {
    if (!conversation) return;
    
    for (const { file, caption } of files) {
      const fileType = file.type.startsWith('image/') ? 'image' 
                     : file.type.startsWith('video/') ? 'video'
                     : file.type.startsWith('audio/') ? 'audio'
                     : 'document';
      
      try {
        // Convert file to base64
        const reader = new FileReader();
        const base64Promise = new Promise<string>((resolve, reject) => {
          reader.onload = () => resolve(reader.result as string);
          reader.onerror = reject;
        });
        reader.readAsDataURL(file);
        const base64Data = await base64Promise;

        const contactPhone = conversation.contact?.phoneNumber || '';

        if (fileType === 'image') {
          await supabase.functions.invoke('send-whatsapp-image', {
            body: {
              imageData: base64Data,
              fileName: file.name,
              mimeType: file.type,
              conversationId: conversation.id,
              connectionId: conversation.whatsappConnectionId,
              contactPhoneNumber: contactPhone,
              caption: caption || undefined,
            }
          });
        } else if (fileType === 'video') {
          await supabase.functions.invoke('send-whatsapp-video', {
            body: {
              videoData: base64Data,
              fileName: file.name,
              mimeType: file.type,
              conversationId: conversation.id,
              connectionId: conversation.whatsappConnectionId,
              contactPhoneNumber: contactPhone,
              text: caption || undefined,
            }
          });
        } else if (fileType === 'audio') {
          await supabase.functions.invoke('send-whatsapp-audio', {
            body: {
              audioData: base64Data,
              fileName: file.name,
              mimeType: file.type,
              conversationId: conversation.id,
            }
          });
        } else {
          await supabase.functions.invoke('send-whatsapp-document', {
            body: {
              documentData: base64Data,
              fileName: file.name,
              mimeType: file.type || 'application/octet-stream',
              conversationId: conversation.id,
              connectionId: conversation.whatsappConnectionId,
              contactPhoneNumber: contactPhone,
              text: caption || undefined,
            }
          });
        }
      } catch (error) {
        console.error(`Erro ao enviar ${file.name}:`, error);
        throw error;
      }
    }
    
    toast({
      title: 'Arquivos enviados',
      description: `${files.length} arquivo${files.length > 1 ? 's' : ''} enviado${files.length > 1 ? 's' : ''} com sucesso.`,
    });
    
    setIsMultiFilePreviewOpen(false);
    setPendingMultiFiles([]);
    onRefresh?.();
  };

  // Send internal note audio handler
  const handleSendNoteAudio = async (audioBlob: Blob, duration: number) => {
    if (!conversation || !onSendInternalNote) return;

    setIsSendingNoteAudio(true);
    try {
      // Upload to storage
      const profile = await supabase.auth.getUser();
      const companyId = (await supabase
        .from('profiles')
        .select('company_id')
        .eq('id', profile.data.user?.id)
        .single()).data?.company_id;

      if (!companyId) throw new Error('Company ID not found');

      const timestamp = Date.now();
      const sanitizedFileName = `voice-note-${timestamp}.webm`;
      const filePath = `${companyId}/${conversation.id}/${sanitizedFileName}`;

      const { data: uploadData, error: uploadError } = await supabase.storage
        .from('internal-notes-media')
        .upload(filePath, audioBlob, {
          contentType: audioBlob.type || 'audio/webm',
          upsert: false,
        });

      if (uploadError) throw uploadError;

      // Generate signed URL (bucket is private)
      const { data: signedUrlData, error: signedUrlError } = await supabase.storage
        .from('internal-notes-media')
        .createSignedUrl(filePath, 60 * 60 * 24 * 365); // 1 year expiry

      if (signedUrlError) throw signedUrlError;

      const mediaUrl = signedUrlData.signedUrl;

      // Send internal note with audio
      const success = await onSendInternalNote(
        '',
        'audio',
        mediaUrl,
        audioBlob.type || 'audio/webm',
        {
          fileName: sanitizedFileName,
          fileSize: audioBlob.size,
          duration,
          storagePath: filePath,
        }
      );

      if (success) {
        setIsRecordingNoteAudio(false);
      }
    } catch (error: any) {
      console.error('❌ Erro ao enviar nota de voz:', error);
      throw error;
    } finally {
      setIsSendingNoteAudio(false);
    }
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
    // Allow sending with attachment even without text
    const hasText = inputValue.trim().length > 0;
    const hasAttachment = !!noteAttachment;
    
    if ((!hasText && !hasAttachment) || isSendingMessage) return;
    
    if (isInternalNoteMode && onSendInternalNote) {
      // Parse mentions from text for internal notes
      const mentionedUserIds = parseMentionsFromText(inputValue.trim(), teamMembers);
      
      // Send as internal note (with optional attachment)
      const success = await onSendInternalNote(
        inputValue.trim(),
        noteAttachment?.messageType || 'text',
        noteAttachment?.mediaUrl,
        noteAttachment?.mediaMimeType,
        noteAttachment?.metadata,
        mentionedUserIds
      );
      if (success) {
        setInputValue('');
        setReplyingTo(null);
        setNoteAttachment(null);
        resetMentions();
        // Keep internal note mode active for convenience
        // Restore focus after state update
        setTimeout(() => textareaRef.current?.focus(), 0);
      }
    } else {
      // Send as WhatsApp message
      if (!canReply) return;
      const contentToSend = inputValue.trim();
      const quotedId = replyingTo?.id;
      
      // Clear input and reply immediately for better UX
      setInputValue('');
      setReplyingTo(null);
      
      // Await the send operation
      await onSendMessage(contentToSend, quotedId);
      
      // Restore focus after send completes
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
    // Don't handle Enter/Escape if mention picker is open
    if (showMentionPicker && isInternalNoteMode) {
      if (e.key === 'Escape') {
        e.preventDefault();
        closeMentionPicker();
        return;
      }
      // Let MentionPicker handle Arrow keys and Enter
      if (e.key === 'ArrowUp' || e.key === 'ArrowDown' || e.key === 'Enter') {
        return;
      }
    }
    
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

  // Handle input change to detect "/" trigger and "@" mentions
  const handleInputChange = (e: React.ChangeEvent<HTMLTextAreaElement>) => {
    const value = e.target.value;
    const cursorPosition = e.target.selectionStart || 0;
    setInputValue(value);
    
    // Show quick replies when typing "/" at the start or alone
    if (value.startsWith('/')) {
      setShowQuickReplies(true);
    } else {
      setShowQuickReplies(false);
    }
    
    // Handle mention detection for internal notes
    if (isInternalNoteMode) {
      handleMentionInputChange(value, cursorPosition);
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
      // For text messages, show confirmation modal instead of sending directly
      setPendingQuickReply(reply);
      setIsQuickReplyConfirmOpen(true);
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
    
    // Don't clear replyingTo here - let the preview modals/confirmation handle it after actual send
    textareaRef.current?.focus();
  };

  // Handle quick reply confirmation
  const handleQuickReplyConfirm = () => {
    if (!pendingQuickReply) return;
    
    onSendMessage(pendingQuickReply.message, replyingTo?.id);
    setPendingQuickReply(null);
    setIsQuickReplyConfirmOpen(false);
    setReplyingTo(null);
    textareaRef.current?.focus();
  };

  const handleQuickReplyCancel = () => {
    setPendingQuickReply(null);
    setIsQuickReplyConfirmOpen(false);
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

  // Group messages by 5-minute time intervals within same sender/direction
  const groupMessagesByTimeInterval = (messages: Message[]) => {
    const groups: { timestamp: string; messages: Message[] }[] = [];
    let currentGroup: { timestamp: string; messages: Message[] } | null = null;

    messages.forEach((message, index) => {
      const messageTime = new Date(message.createdAt).getTime();
      const isOutbound = message.direction === 'outbound';
      
      if (!currentGroup) {
        // Start first group
        currentGroup = {
          timestamp: message.createdAt,
          messages: [message]
        };
      } else {
        const lastMessage = currentGroup.messages[currentGroup.messages.length - 1];
        const lastMessageTime = new Date(lastMessage.createdAt).getTime();
        const lastIsOutbound = lastMessage.direction === 'outbound';
        const timeDiff = (messageTime - lastMessageTime) / 1000 / 60; // minutes
        
        // Same direction and within 5 minutes? Add to current group
        if (isOutbound === lastIsOutbound && timeDiff <= 5 && !message.isInternalNote && !lastMessage.isInternalNote) {
          currentGroup.messages.push(message);
        } else {
          // Different direction, more than 5 min apart, or internal note - start new group
          groups.push(currentGroup);
          currentGroup = {
            timestamp: message.createdAt,
            messages: [message]
          };
        }
      }
    });

    // Don't forget the last group
    if (currentGroup) {
      groups.push(currentGroup);
    }

    return groups;
  };

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
            <ContactAvatar
              imageUrl={conversation.contact?.avatarUrl}
              name={conversation.contact?.name}
              size="md"
            />
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
              currentUserRole={currentUserRole}
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
                  : "bg-warning/20 text-warning border-warning/30"
              )}
            >
              {conversation.assignedUserId === currentUserId 
                ? 'Atribuída a você'
                : `${conversation.assignedUser.fullName?.split(' ')[0]}`
              }
            </Badge>
          ) : (
            <Badge variant="outline" className="text-xs bg-destructive/20 text-destructive border-destructive/30">
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

      {/* Messages Area - wrapped with DropZone for drag and drop */}
      <DropZone 
        onFilesDropped={handleMultipleFilesSelect}
        disabled={!canReply && !isInternalNoteMode}
        className="flex-1 flex flex-col overflow-hidden"
      >
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

                  {/* Messages grouped by time intervals */}
                  <div className="space-y-1">
                    {groupMessagesByTimeInterval(dateMessages).map((timeGroup, groupIndex) => {
                      // Get the last outbound message status for this group
                      const lastOutboundMessage = timeGroup.messages
                        .filter(m => m.direction === 'outbound' && !m.isInternalNote)
                        .pop();
                      const isOutboundGroup = timeGroup.messages[0]?.direction === 'outbound';
                      
                      return (
                      <div key={`group-${groupIndex}`} className="space-y-0.5">
                        {/* Time group header - align based on message direction */}
                        <div className={cn(
                          "flex items-center gap-1 my-2",
                          isOutboundGroup ? 'justify-end' : 'justify-start'
                        )}>
                          <span className="text-[10px] text-muted-foreground">
                            {formatMessageTime(timeGroup.timestamp)}
                          </span>
                          {/* Status icons next to time for outbound messages */}
                          {isOutboundGroup && lastOutboundMessage && (
                            <Tooltip>
                              <TooltipTrigger asChild>
                                <span className={cn(
                                  'text-muted-foreground cursor-default',
                                  lastOutboundMessage.status === 'read' && 'text-primary',
                                  lastOutboundMessage.status === 'failed' && 'text-destructive'
                                )}>
                                  {statusIcons[lastOutboundMessage.status]}
                                </span>
                              </TooltipTrigger>
                              <TooltipContent side="left">
                                {statusTooltips[lastOutboundMessage.status] || lastOutboundMessage.status}
                              </TooltipContent>
                            </Tooltip>
                          )}
                        </div>
                        
                        {/* Messages in this time group */}
                        {timeGroup.messages.map((message, messageIndex) => {
                          const isLastInGroup = messageIndex === timeGroup.messages.length - 1;
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

                              {/* Delete button */}
                              {canDeleteMessage(message) && (
                                <Tooltip>
                                  <TooltipTrigger asChild>
                                    <Button
                                      variant="ghost"
                                      size="icon"
                                      className="h-7 w-7 rounded-full bg-destructive/80 hover:bg-destructive text-destructive-foreground"
                                      onClick={() => handleDeleteMessage(message)}
                                    >
                                      <Trash2 className="w-3.5 h-3.5" />
                                    </Button>
                                  </TooltipTrigger>
                                  <TooltipContent>Apagar para o cliente</TooltipContent>
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
                                onClick={() => scrollToMessage(message.quotedMessage!.id)}
                              />
                            )}

                            {/* Check if message is deleted first */}
                            {message.isDeleted ? (
                              <DeletedMessageIndicator
                                originalContent={message.originalContent || message.content}
                                deletedByType={message.deletedByType}
                                deletedByName={message.deletedByName}
                                deletedAt={message.deletedAt}
                                messageType={message.messageType}
                                mediaUrl={message.mediaUrl}
                                isOutbound={isOutbound}
                                canViewOriginal={true}
                              />
                            ) : message.messageType === 'audio' && message.mediaUrl ? (
                              /* Audio message */
                              <AudioPlayer
                                src={message.mediaUrl}
                                mimeType={message.mediaMimeType}
                                duration={(message.metadata as any)?.duration}
                                isOutbound={isOutbound}
                                status={message.status}
                                errorMessage={message.errorMessage}
                                variant={message.isInternalNote ? 'amber' : 'default'}
                                initialTranscription={(message.metadata as any)?.transcription}
                                onTranscriptionComplete={(text) => handleTranscriptionComplete(message.id, text)}
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
                              /* Text message content - use MentionText for internal notes */
                              message.isInternalNote ? (
                                <MentionText 
                                  text={message.content || ''} 
                                  className="text-sm" 
                                  variant="internal-note"
                                  knownMentionNames={
                                    message.mentions && message.mentions.length > 0
                                      ? message.mentions
                                          .map(id => teamMembers.find(m => m.id === id)?.fullName)
                                          .filter(Boolean) as string[]
                                      : undefined
                                  }
                                />
                              ) : (
                              <LinkifyText 
                                  text={message.content || ''} 
                                  className="text-sm [overflow-wrap:anywhere]"
                                />
                              )
                            )}
                            
                            {/* Status is now shown next to the time group header */}

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

        {/* Note attachment preview */}
        {isInternalNoteMode && noteAttachment && (
          <div className="mb-3 flex items-center gap-2 p-2 bg-amber-50 dark:bg-amber-950/30 rounded-lg border border-amber-200 dark:border-amber-800">
            <div className="flex-shrink-0">
              {noteAttachment.messageType === 'image' && <Camera className="w-4 h-4 text-amber-600" />}
              {noteAttachment.messageType === 'video' && <Camera className="w-4 h-4 text-amber-600" />}
              {noteAttachment.messageType === 'audio' && <Mic className="w-4 h-4 text-amber-600" />}
              {noteAttachment.messageType === 'document' && <FileText className="w-4 h-4 text-amber-600" />}
            </div>
            <div className="flex-1 min-w-0">
              <p className="text-xs font-medium truncate text-amber-900 dark:text-amber-100">
                {noteAttachment.messageType === 'image' && 'Imagem'}
                {noteAttachment.messageType === 'video' && 'Vídeo'}
                {noteAttachment.messageType === 'audio' && 'Áudio'}
                {noteAttachment.messageType === 'document' && 'Documento'}
              </p>
            </div>
            <Button
              type="button"
              variant="ghost"
              size="icon"
              className="h-6 w-6 text-amber-600 hover:text-amber-800 hover:bg-amber-100"
              onClick={() => setNoteAttachment(null)}
            >
              <X className="w-3 h-3" />
            </Button>
          </div>
        )}

        {/* Internal note audio recorder */}
        {isInternalNoteMode && isRecordingNoteAudio && (
          <div className="mb-3">
            <InternalNoteAudioRecorder
              onSend={handleSendNoteAudio}
              onCancel={() => setIsRecordingNoteAudio(false)}
              disabled={isSendingNoteAudio}
            />
          </div>
        )}

        {!isRecordingAudio && !audioFile && !isRecordingNoteAudio && (
          <div className="flex items-center gap-1.5">
            {/* 1. Agendar mensagem */}
            <Tooltip>
              <TooltipTrigger asChild>
                <Button
                  type="button"
                  variant="ghost"
                  size="icon"
                  onClick={() => setScheduleModalOpen(true)}
                  disabled={!conversation?.contact?.id}
                  className="h-9 w-9 flex-shrink-0"
                >
                  <CalendarClock className="w-5 h-5" />
                </Button>
              </TooltipTrigger>
              <TooltipContent>Agendar mensagem</TooltipContent>
            </Tooltip>

            {/* 2. Ativar nota interna */}
            <Tooltip>
              <TooltipTrigger asChild>
                <Button
                  type="button"
                  variant={isInternalNoteMode ? "default" : "ghost"}
                  size="icon"
                  onClick={() => {
                    setIsInternalNoteMode(!isInternalNoteMode);
                    if (isInternalNoteMode) {
                      setNoteAttachment(null);
                    }
                  }}
                  className={cn(
                    "h-9 w-9 flex-shrink-0",
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

            {/* 3. Corrigir texto com IA */}
            {inputValue.trim() && !isInternalNoteMode && (
              <Tooltip>
                <TooltipTrigger asChild>
                  <Button
                    type="button"
                    variant="ghost"
                    size="icon"
                    onClick={handleCorrectText}
                    disabled={isCorrectingText || !canReply}
                    className="h-9 w-9 flex-shrink-0"
                  >
                    {isCorrectingText ? (
                      <Loader2 className="w-4 h-4 animate-spin" />
                    ) : (
                      <Pencil className="w-4 h-4" />
                    )}
                  </Button>
                </TooltipTrigger>
                <TooltipContent>Corrigir texto com IA</TooltipContent>
              </Tooltip>
            )}

            {/* 4. Input de texto + emoji */}
            <div className="flex-1 relative min-w-0">
              <QuickRepliesPicker
                inputValue={inputValue}
                onSelect={handleQuickReplySelect}
                onClose={() => setShowQuickReplies(false)}
                isOpen={showQuickReplies && canReply}
              />
              
              {isInternalNoteMode && (
                <MentionPicker
                  isOpen={showMentionPicker}
                  onSelect={(member) => {
                    const cursorPosition = textareaRef.current?.selectionStart || inputValue.length;
                    const { newValue, newCursorPosition } = handleMentionSelect(member, inputValue, cursorPosition);
                    setInputValue(newValue);
                    setTimeout(() => {
                      if (textareaRef.current) {
                        textareaRef.current.focus();
                        textareaRef.current.setSelectionRange(newCursorPosition, newCursorPosition);
                      }
                    }, 0);
                  }}
                  onClose={closeMentionPicker}
                  filterText={mentionFilterText}
                />
              )}

              {/* AI Response Button - left side */}
              {!isInternalNoteMode && canReply && messages.length > 0 && (
                <AIResponseButton
                  onClick={handleGenerateAIResponse}
                  disabled={isGeneratingResponse || isCorrectingText || isSendingMessage}
                  isLoading={isGeneratingResponse}
                />
              )}

              <Textarea
                ref={textareaRef}
                value={inputValue}
                onChange={handleInputChange}
                onKeyDown={handleKeyDown}
                onPaste={handlePaste}
                placeholder={
                  isInternalNoteMode
                    ? "Digite sua nota interna... Use @ para mencionar"
                    : canReply 
                      ? "Digite / para respostas rápidas..." 
                      : blockInfo.message
                }
                className={cn(
                  "min-h-[44px] max-h-32 resize-none pr-10 transition-colors duration-200",
                  !isInternalNoteMode && canReply && messages.length > 0 && "pl-10",
                  !canReply && !isInternalNoteMode && "bg-muted/50 cursor-not-allowed",
                  isInternalNoteMode && "bg-amber-50 border-amber-300 focus-visible:ring-amber-400 placeholder:text-amber-600/70 text-slate-900"
                )}
                rows={1}
                disabled={isSendingMessage || isCorrectingText || isGeneratingResponse || (!canReply && !isInternalNoteMode)}
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
                disabled={(!canReply && !isInternalNoteMode) || isSendingMessage || isGeneratingResponse}
              />
            </div>

            {/* 4. Gravar áudio / Enviar */}
            {!inputValue.trim() && !noteAttachment && !isRecordingNoteAudio ? (
              <Tooltip>
                <TooltipTrigger asChild>
                  <Button 
                    onClick={() => {
                      if (isInternalNoteMode) {
                        setIsRecordingNoteAudio(true);
                      } else {
                        setIsRecordingAudio(true);
                      }
                    }}
                    disabled={!canReply && !isInternalNoteMode}
                    variant="ghost"
                    size="icon"
                    className={cn(
                      "h-9 w-9 flex-shrink-0",
                      isInternalNoteMode && "text-amber-600 hover:text-amber-700 hover:bg-amber-100"
                    )}
                  >
                    <Mic className="w-5 h-5" />
                  </Button>
                </TooltipTrigger>
                <TooltipContent>
                  {isInternalNoteMode ? 'Gravar nota de voz' : 'Gravar áudio'}
                </TooltipContent>
              </Tooltip>
            ) : (
              <Button 
                onClick={handleSend}
                disabled={(!inputValue.trim() && !noteAttachment) || isSendingMessage || (!canReply && !isInternalNoteMode)}
                size="icon"
                className={cn(
                  "h-9 w-9 flex-shrink-0",
                  isInternalNoteMode && "bg-amber-500 hover:bg-amber-600"
                )}
              >
                {isSendingMessage ? (
                  <Loader2 className="w-4 h-4 animate-spin" />
                ) : (
                  <Send className="w-4 h-4" />
                )}
              </Button>
            )}

            {/* 5. Anexar arquivo */}
            <AttachmentMenu
              onImageSelect={handleImageSelect}
              onVideoSelect={handleVideoSelect}
              onAudioSelect={handleAudioFileSelect}
              onDocumentSelect={handleDocumentSelect}
              onMultipleFilesSelect={handleMultipleFilesSelect}
              disabled={!canReply && !isInternalNoteMode}
              variant={isInternalNoteMode ? 'amber' : 'default'}
              onNoteAttachmentReady={isInternalNoteMode ? (messageType, mediaUrl, mediaMimeType, metadata) => {
                setNoteAttachment({ messageType, mediaUrl, mediaMimeType, metadata });
              } : undefined}
              conversationId={conversation?.id}
            />
          </div>
        )}
      </div>
      </DropZone>

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

      {/* Multi-File Preview Modal */}
      <MultiFilePreviewModal
        files={pendingMultiFiles}
        isOpen={isMultiFilePreviewOpen}
        onClose={() => {
          setIsMultiFilePreviewOpen(false);
          setPendingMultiFiles([]);
        }}
        onSendFiles={handleSendMultipleFiles}
      />

      {/* Quick Reply Confirmation Modal */}
      <QuickReplyConfirmModal
        isOpen={isQuickReplyConfirmOpen}
        onClose={handleQuickReplyCancel}
        onConfirm={handleQuickReplyConfirm}
        message={pendingQuickReply?.message || ''}
        title={pendingQuickReply?.title}
        isSending={isSendingMessage}
        quotedMessage={replyingTo}
      />

      {/* Delete Message Modal */}
      <DeleteMessageModal
        isOpen={isDeleteModalOpen}
        onClose={() => {
          setIsDeleteModalOpen(false);
          setMessageToDelete(null);
        }}
        message={messageToDelete}
        conversation={conversation}
        currentUserId={currentUserId}
        currentUserName={currentUserName}
        onDeleted={onRefresh}
      />

      {/* Schedule Message Modal */}
      {conversation?.contact?.id && (
        <ScheduleMessageModal
          open={scheduleModalOpen}
          onOpenChange={setScheduleModalOpen}
          contactId={conversation.contact.id}
          contactName={conversation.contact.name || 'Contato'}
          conversationId={conversation.id}
        />
      )}
    </div>
  );
}
