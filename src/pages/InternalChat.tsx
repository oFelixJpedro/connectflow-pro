import { useState, useRef, useEffect } from 'react';
import { X, MessageSquare, Users, Send, Circle, Mic, Paperclip, Image, Video, FileText, Loader2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Badge } from '@/components/ui/badge';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { useInternalChat, ChatMessage } from '@/hooks/useInternalChat';
import { useNavigate } from 'react-router-dom';
import { format } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import { toast } from '@/hooks/use-toast';

// Import media components
import { AudioPlayer } from '@/components/inbox/AudioPlayer';
import { AudioRecorder } from '@/components/inbox/AudioRecorder';
import { ImageMessage } from '@/components/inbox/ImageMessage';
import { VideoMessage } from '@/components/inbox/VideoMessage';
import { DocumentMessage } from '@/components/inbox/DocumentMessage';
import { ImagePreviewModal } from '@/components/inbox/ImagePreviewModal';
import { VideoPreviewModal } from '@/components/inbox/VideoPreviewModal';
import { DocumentPreviewModal } from '@/components/inbox/DocumentPreviewModal';
import { AudioFilePreview } from '@/components/inbox/AudioFilePreview';

export default function InternalChat() {
  const navigate = useNavigate();
  const {
    rooms,
    messages,
    teamMembers,
    selectedRoom,
    setSelectedRoom,
    isLoading,
    isLoadingMessages,
    sendMessage,
    sendMediaMessage,
    getOrCreateDirectRoom,
    loadTeamMembers,
    loadRooms,
  } = useInternalChat();

  const [messageInput, setMessageInput] = useState('');
  const [isSending, setIsSending] = useState(false);
  const [isRecordingAudio, setIsRecordingAudio] = useState(false);
  const [audioFile, setAudioFile] = useState<File | null>(null);
  const [imageFile, setImageFile] = useState<File | null>(null);
  const [isImagePreviewOpen, setIsImagePreviewOpen] = useState(false);
  const [videoFile, setVideoFile] = useState<File | null>(null);
  const [isVideoPreviewOpen, setIsVideoPreviewOpen] = useState(false);
  const [documentFile, setDocumentFile] = useState<File | null>(null);
  const [isDocumentPreviewOpen, setIsDocumentPreviewOpen] = useState(false);
  const [attachmentMenuOpen, setAttachmentMenuOpen] = useState(false);
  
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const imageInputRef = useRef<HTMLInputElement>(null);
  const videoInputRef = useRef<HTMLInputElement>(null);
  const audioInputRef = useRef<HTMLInputElement>(null);
  const documentInputRef = useRef<HTMLInputElement>(null);

  // Load data on mount
  useEffect(() => {
    loadTeamMembers();
    loadRooms();
  }, [loadTeamMembers, loadRooms]);

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  };

  useEffect(() => {
    if (messages.length > 0) {
      scrollToBottom();
    }
  }, [messages]);

  const handleSendMessage = async () => {
    if (!messageInput.trim() || isSending) return;

    setIsSending(true);
    const success = await sendMessage(messageInput.trim());
    setIsSending(false);
    
    if (success) {
      setMessageInput('');
    }
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleSendMessage();
    }
  };

  const handleSelectTeamMember = async (memberId: string) => {
    await getOrCreateDirectRoom(memberId);
  };

  const handleClose = () => {
    navigate(-1);
  };

  // Audio handlers
  const handleSendAudio = async (audioBlob: Blob, duration: number) => {
    const file = new File([audioBlob], `audio_${Date.now()}.webm`, { type: audioBlob.type || 'audio/webm' });
    const success = await sendMediaMessage(file, 'audio');
    if (success) {
      setIsRecordingAudio(false);
      toast({ title: 'Áudio enviado', description: 'O áudio foi enviado com sucesso.' });
    } else {
      toast({ title: 'Erro ao enviar áudio', variant: 'destructive' });
    }
  };

  const handleSendAudioFile = async (file: File) => {
    const success = await sendMediaMessage(file, 'audio');
    if (success) {
      setAudioFile(null);
      toast({ title: 'Áudio enviado', description: 'O áudio foi enviado com sucesso.' });
    } else {
      toast({ title: 'Erro ao enviar áudio', variant: 'destructive' });
    }
  };

  // Image handlers
  const handleImageSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      setImageFile(file);
      setIsImagePreviewOpen(true);
      setAttachmentMenuOpen(false);
    }
    e.target.value = '';
  };

  const handleSendImage = async (file: File, caption: string) => {
    const success = await sendMediaMessage(file, 'image', caption || undefined);
    if (success) {
      setImageFile(null);
      setIsImagePreviewOpen(false);
      toast({ title: 'Imagem enviada', description: 'A imagem foi enviada com sucesso.' });
    } else {
      throw new Error('Erro ao enviar imagem');
    }
  };

  // Video handlers
  const handleVideoSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      setVideoFile(file);
      setIsVideoPreviewOpen(true);
      setAttachmentMenuOpen(false);
    }
    e.target.value = '';
  };

  const handleSendVideo = async (file: File, text: string, duration: number) => {
    const success = await sendMediaMessage(file, 'video', text || undefined);
    if (success) {
      setVideoFile(null);
      setIsVideoPreviewOpen(false);
      toast({ title: 'Vídeo enviado', description: 'O vídeo foi enviado com sucesso.' });
    } else {
      throw new Error('Erro ao enviar vídeo');
    }
  };

  // Audio file select handler
  const handleAudioFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      setAudioFile(file);
      setAttachmentMenuOpen(false);
    }
    e.target.value = '';
  };

  // Document handlers
  const handleDocumentSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      setDocumentFile(file);
      setIsDocumentPreviewOpen(true);
      setAttachmentMenuOpen(false);
    }
    e.target.value = '';
  };

  const handleSendDocument = async (file: File, text: string) => {
    const success = await sendMediaMessage(file, 'document', text || undefined);
    if (success) {
      setDocumentFile(null);
      setIsDocumentPreviewOpen(false);
      toast({ title: 'Documento enviado', description: 'O documento foi enviado com sucesso.' });
    } else {
      throw new Error('Erro ao enviar documento');
    }
  };

  const getInitials = (name: string) => {
    return name
      .split(' ')
      .map((n) => n[0])
      .join('')
      .toUpperCase()
      .slice(0, 2);
  };

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'online':
        return 'text-green-500';
      case 'away':
        return 'text-yellow-500';
      case 'busy':
        return 'text-red-500';
      default:
        return 'text-gray-400';
    }
  };

  const formatMessageTime = (dateString: string) => {
    const date = new Date(dateString);
    const today = new Date();
    const isToday = date.toDateString() === today.toDateString();

    if (isToday) {
      return format(date, 'HH:mm', { locale: ptBR });
    }
    return format(date, 'dd/MM HH:mm', { locale: ptBR });
  };

  // Render message content based on type
  const renderMessageContent = (msg: ChatMessage) => {
    switch (msg.messageType) {
      case 'audio':
        if (msg.mediaUrl) {
          return (
            <AudioPlayer
              src={msg.mediaUrl}
              mimeType={msg.mediaMimeType || undefined}
              isOutbound={msg.isOwnMessage}
            />
          );
        }
        return <p className="text-sm text-muted-foreground italic">[Áudio indisponível]</p>;

      case 'image':
        if (msg.mediaUrl) {
          return (
            <ImageMessage
              src={msg.mediaUrl}
              isOutbound={msg.isOwnMessage}
              caption={msg.content}
            />
          );
        }
        return <p className="text-sm text-muted-foreground italic">[Imagem indisponível]</p>;

      case 'video':
        if (msg.mediaUrl) {
          return (
            <VideoMessage
              src={msg.mediaUrl}
              isOutbound={msg.isOwnMessage}
              caption={msg.content}
            />
          );
        }
        return <p className="text-sm text-muted-foreground italic">[Vídeo indisponível]</p>;

      case 'document':
        if (msg.mediaUrl) {
          // Extract filename from URL or use default
          const fileName = msg.mediaUrl.split('/').pop() || 'Documento';
          return (
            <DocumentMessage
              src={msg.mediaUrl}
              isOutbound={msg.isOwnMessage}
              fileName={fileName}
              mimeType={msg.mediaMimeType || undefined}
              caption={msg.content}
            />
          );
        }
        return <p className="text-sm text-muted-foreground italic">[Documento indisponível]</p>;

      case 'text':
      default:
        return <p className="text-sm break-words whitespace-pre-wrap">{msg.content}</p>;
    }
  };

  const getLastMessagePreview = (content: string | undefined, messageType: string | undefined) => {
    if (!messageType || messageType === 'text') {
      return content || '';
    }
    const typeLabels: Record<string, string> = {
      audio: '🎤 Áudio',
      image: '📷 Imagem',
      video: '🎬 Vídeo',
      document: '📄 Documento',
    };
    return typeLabels[messageType] || content || '';
  };

  // Sort rooms: general first, then direct rooms by last message
  const sortedRooms = [...rooms].sort((a, b) => {
    if (a.type === 'general') return -1;
    if (b.type === 'general') return 1;
    
    const aTime = a.lastMessage?.createdAt ? new Date(a.lastMessage.createdAt).getTime() : 0;
    const bTime = b.lastMessage?.createdAt ? new Date(b.lastMessage.createdAt).getTime() : 0;
    return bTime - aTime;
  });

  // Team members not in direct chat yet
  const membersWithoutChat = teamMembers.filter(member => 
    !rooms.some(room => 
      room.type === 'direct' && 
      room.participants?.some(p => p.id === member.id)
    )
  );

  return (
    <div className="fixed inset-0 z-50 bg-background flex flex-col">
      {/* Header */}
      <div className="internal-chat-header h-14 px-4 flex items-center justify-between shrink-0 border-b">
        <div className="flex items-center gap-3">
          <MessageSquare className="w-6 h-6 text-white" />
          <h1 className="text-lg font-semibold text-white">Chat da Equipe</h1>
        </div>
        <Button
          variant="ghost"
          size="icon"
          onClick={handleClose}
          className="text-white hover:bg-white/20"
        >
          <X className="w-5 h-5" />
        </Button>
      </div>

      {/* Main content - two columns */}
      <div className="flex flex-1 min-h-0">
        {/* Left column - Chat list */}
        <div className="w-80 border-r bg-card flex flex-col">
          <div className="p-3 border-b">
            <h2 className="font-medium text-sm text-muted-foreground">Conversas</h2>
          </div>
          
          <ScrollArea className="flex-1">
            {isLoading ? (
              <div className="flex items-center justify-center h-32">
                <div className="animate-spin rounded-full h-6 w-6 border-b-2 border-emerald-600" />
              </div>
            ) : (
              <div className="divide-y">
                {/* Sorted rooms list */}
                {sortedRooms.map((room) => (
                  <button
                    key={room.id}
                    className={`w-full p-3 text-left transition-colors flex items-center gap-3 ${
                      selectedRoom?.id === room.id 
                        ? 'bg-emerald-50 dark:bg-emerald-950/30 border-l-2 border-emerald-600' 
                        : 'hover:bg-muted/50'
                    }`}
                    onClick={() => setSelectedRoom(room)}
                  >
                    <Avatar className="w-10 h-10">
                      {room.type === 'general' ? (
                        <AvatarFallback className="bg-emerald-100 text-emerald-700">
                          <Users className="w-5 h-5" />
                        </AvatarFallback>
                      ) : (
                        <>
                          <AvatarImage
                            src={room.participants?.find(p => p.id !== room.id)?.avatarUrl || undefined}
                          />
                          <AvatarFallback className="bg-emerald-100 text-emerald-700">
                            {getInitials(room.name || 'CD')}
                          </AvatarFallback>
                        </>
                      )}
                    </Avatar>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center justify-between">
                        <p className="font-medium text-sm truncate">
                          {room.type === 'general' ? '👥 Chat Geral' : room.name || 'Chat Direto'}
                        </p>
                        <div className="flex items-center gap-2">
                          {room.lastMessage && (
                            <span className="text-xs text-muted-foreground">
                              {formatMessageTime(room.lastMessage.createdAt)}
                            </span>
                          )}
                          {room.unreadCount && room.unreadCount > 0 && (
                            <Badge 
                              variant="default" 
                              className="bg-emerald-600 hover:bg-emerald-600 text-white text-xs px-1.5 py-0 h-5 min-w-5 flex items-center justify-center"
                            >
                              {room.unreadCount > 99 ? '99+' : room.unreadCount}
                            </Badge>
                          )}
                        </div>
                      </div>
                      {room.lastMessage && (
                        <p className="text-xs text-muted-foreground truncate">
                          {room.type === 'general' && (
                            <span className="font-medium">{room.lastMessage.senderName}: </span>
                          )}
                          {getLastMessagePreview(room.lastMessage.content, room.lastMessage.messageType)}
                        </p>
                      )}
                    </div>
                  </button>
                ))}

                {/* Section for team members without direct chat */}
                {membersWithoutChat.length > 0 && (
                  <>
                    <div className="px-3 py-2 bg-muted/30">
                      <p className="text-xs font-medium text-muted-foreground">Iniciar conversa</p>
                    </div>
                    {membersWithoutChat.map((member) => (
                      <button
                        key={member.id}
                        className="w-full p-3 text-left hover:bg-muted/50 transition-colors flex items-center gap-3"
                        onClick={() => handleSelectTeamMember(member.id)}
                      >
                        <div className="relative">
                          <Avatar className="w-10 h-10">
                            <AvatarImage src={member.avatarUrl || undefined} />
                            <AvatarFallback className="bg-gray-100 text-gray-700">
                              {getInitials(member.fullName)}
                            </AvatarFallback>
                          </Avatar>
                          <Circle
                            className={`absolute bottom-0 right-0 w-3 h-3 fill-current ${getStatusColor(member.status)}`}
                          />
                        </div>
                        <div className="flex-1 min-w-0">
                          <p className="font-medium text-sm truncate">{member.fullName}</p>
                          <p className="text-xs text-muted-foreground truncate">{member.email}</p>
                        </div>
                      </button>
                    ))}
                  </>
                )}
              </div>
            )}
          </ScrollArea>
        </div>

        {/* Right column - Chat area */}
        <div className="flex-1 flex flex-col bg-muted/20">
          {selectedRoom ? (
            <>
              {/* Chat header */}
              <div className="h-14 px-4 flex items-center gap-3 border-b bg-card">
                <Avatar className="w-10 h-10">
                  {selectedRoom.type === 'general' ? (
                    <AvatarFallback className="bg-emerald-100 text-emerald-700">
                      <Users className="w-5 h-5" />
                    </AvatarFallback>
                  ) : (
                    <>
                      <AvatarImage
                        src={selectedRoom.participants?.find(p => p.id !== selectedRoom.id)?.avatarUrl || undefined}
                      />
                      <AvatarFallback className="bg-emerald-100 text-emerald-700">
                        {getInitials(selectedRoom.name || 'CD')}
                      </AvatarFallback>
                    </>
                  )}
                </Avatar>
                <div>
                  <h2 className="font-semibold">
                    {selectedRoom.type === 'general' ? 'Chat Geral' : selectedRoom.name || 'Chat Direto'}
                  </h2>
                  {selectedRoom.type === 'general' && (
                    <p className="text-xs text-muted-foreground">
                      {teamMembers.length + 1} membros
                    </p>
                  )}
                </div>
              </div>

              {/* Messages area */}
              <ScrollArea className="flex-1 p-4">
                {isLoadingMessages ? (
                  <div className="flex items-center justify-center h-full">
                    <div className="animate-spin rounded-full h-6 w-6 border-b-2 border-emerald-600" />
                  </div>
                ) : messages.length === 0 ? (
                  <div className="flex flex-col items-center justify-center h-full text-muted-foreground">
                    <MessageSquare className="w-12 h-12 mb-3 opacity-50" />
                    <p className="text-sm">Nenhuma mensagem ainda</p>
                    <p className="text-xs">Seja o primeiro a enviar!</p>
                  </div>
                ) : (
                  <div className="space-y-4 max-w-3xl mx-auto">
                    {messages.map((msg) => (
                      <div
                        key={msg.id}
                        className={`flex gap-3 ${msg.isOwnMessage ? 'flex-row-reverse' : ''}`}
                      >
                        {!msg.isOwnMessage && (
                          <Avatar className="w-9 h-9 flex-shrink-0">
                            <AvatarImage src={msg.senderAvatar || undefined} />
                            <AvatarFallback className="bg-emerald-100 text-emerald-700 text-xs">
                              {getInitials(msg.senderName)}
                            </AvatarFallback>
                          </Avatar>
                        )}
                        <div
                          className={`max-w-[70%] ${
                            msg.isOwnMessage
                              ? 'internal-chat-message-own'
                              : 'internal-chat-message-other'
                          }`}
                        >
                          {!msg.isOwnMessage && selectedRoom.type === 'general' && (
                            <p className="text-xs font-medium text-emerald-700 mb-1">
                              {msg.senderName}
                            </p>
                          )}
                          {renderMessageContent(msg)}
                          <p
                            className={`text-xs mt-1 ${
                              msg.isOwnMessage ? 'text-emerald-100' : 'text-muted-foreground'
                            }`}
                          >
                            {formatMessageTime(msg.createdAt)}
                          </p>
                        </div>
                      </div>
                    ))}
                    <div ref={messagesEndRef} />
                  </div>
                )}
              </ScrollArea>

              {/* Message input area */}
              <div className="p-4 border-t bg-card">
                {/* Audio recorder */}
                {isRecordingAudio && (
                  <div className="mb-3 max-w-3xl mx-auto">
                    <AudioRecorder
                      onSend={handleSendAudio}
                      onCancel={() => setIsRecordingAudio(false)}
                    />
                  </div>
                )}

                {/* Audio file preview */}
                {audioFile && !isRecordingAudio && (
                  <div className="mb-3 max-w-3xl mx-auto">
                    <AudioFilePreview
                      file={audioFile}
                      onSend={handleSendAudioFile}
                      onCancel={() => setAudioFile(null)}
                    />
                  </div>
                )}

                {/* Normal input when not recording */}
                {!isRecordingAudio && !audioFile && (
                  <div className="flex gap-3 max-w-3xl mx-auto">
                    {/* Attachment menu */}
                    <Popover open={attachmentMenuOpen} onOpenChange={setAttachmentMenuOpen}>
                      <PopoverTrigger asChild>
                        <Button
                          variant="ghost"
                          size="icon"
                          className="flex-shrink-0 text-muted-foreground hover:text-foreground"
                        >
                          <Paperclip className="w-5 h-5" />
                        </Button>
                      </PopoverTrigger>
                      <PopoverContent className="w-48 p-2" align="start">
                        <div className="space-y-1">
                          <button
                            onClick={() => imageInputRef.current?.click()}
                            className="w-full flex items-center gap-3 px-3 py-2 text-sm rounded-md hover:bg-muted transition-colors"
                          >
                            <Image className="w-4 h-4 text-blue-500" />
                            <span>Imagem</span>
                          </button>
                          <button
                            onClick={() => videoInputRef.current?.click()}
                            className="w-full flex items-center gap-3 px-3 py-2 text-sm rounded-md hover:bg-muted transition-colors"
                          >
                            <Video className="w-4 h-4 text-purple-500" />
                            <span>Vídeo</span>
                          </button>
                          <button
                            onClick={() => audioInputRef.current?.click()}
                            className="w-full flex items-center gap-3 px-3 py-2 text-sm rounded-md hover:bg-muted transition-colors"
                          >
                            <Mic className="w-4 h-4 text-orange-500" />
                            <span>Áudio</span>
                          </button>
                          <button
                            onClick={() => documentInputRef.current?.click()}
                            className="w-full flex items-center gap-3 px-3 py-2 text-sm rounded-md hover:bg-muted transition-colors"
                          >
                            <FileText className="w-4 h-4 text-green-500" />
                            <span>Documento</span>
                          </button>
                        </div>
                      </PopoverContent>
                    </Popover>

                    {/* Hidden file inputs */}
                    <input
                      ref={imageInputRef}
                      type="file"
                      accept="image/*"
                      onChange={handleImageSelect}
                      className="hidden"
                    />
                    <input
                      ref={videoInputRef}
                      type="file"
                      accept="video/*"
                      onChange={handleVideoSelect}
                      className="hidden"
                    />
                    <input
                      ref={audioInputRef}
                      type="file"
                      accept="audio/*"
                      onChange={handleAudioFileSelect}
                      className="hidden"
                    />
                    <input
                      ref={documentInputRef}
                      type="file"
                      accept=".pdf,.doc,.docx,.xls,.xlsx,.ppt,.pptx,.txt,.csv,.md,.zip,.rar"
                      onChange={handleDocumentSelect}
                      className="hidden"
                    />

                    <Input
                      value={messageInput}
                      onChange={(e) => setMessageInput(e.target.value)}
                      onKeyDown={handleKeyDown}
                      placeholder="Digite sua mensagem..."
                      className="flex-1 internal-chat-input"
                      disabled={isSending}
                    />

                    {/* Mic button (when no text) */}
                    {!messageInput.trim() && (
                      <Button
                        variant="ghost"
                        size="icon"
                        onClick={() => setIsRecordingAudio(true)}
                        className="flex-shrink-0 text-muted-foreground hover:text-foreground"
                      >
                        <Mic className="w-5 h-5" />
                      </Button>
                    )}

                    {/* Send button */}
                    <Button
                      onClick={handleSendMessage}
                      disabled={!messageInput.trim() || isSending}
                      className="internal-chat-send-button"
                    >
                      {isSending ? (
                        <Loader2 className="w-4 h-4 animate-spin" />
                      ) : (
                        <>
                          <Send className="w-4 h-4 mr-2" />
                          Enviar
                        </>
                      )}
                    </Button>
                  </div>
                )}
              </div>
            </>
          ) : (
            <div className="flex-1 flex items-center justify-center">
              <div className="text-center">
                <div className="w-16 h-16 bg-emerald-100 rounded-full flex items-center justify-center mx-auto mb-4">
                  <MessageSquare className="w-8 h-8 text-emerald-600" />
                </div>
                <h3 className="font-medium text-foreground mb-2">Selecione uma conversa</h3>
                <p className="text-sm text-muted-foreground">
                  Escolha uma conversa da lista ao lado para começar
                </p>
              </div>
            </div>
          )}
        </div>
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
        onChangeFile={() => imageInputRef.current?.click()}
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
        onChangeFile={() => videoInputRef.current?.click()}
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
        onChangeFile={() => documentInputRef.current?.click()}
      />
    </div>
  );
}
