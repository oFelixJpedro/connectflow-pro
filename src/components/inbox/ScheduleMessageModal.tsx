import { useState, useRef, useEffect, useMemo } from 'react';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import { Label } from '@/components/ui/label';
import { Input } from '@/components/ui/input';
import { Calendar } from '@/components/ui/calendar';
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from '@/components/ui/popover';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Badge } from '@/components/ui/badge';
import { 
  CalendarIcon, 
  Image, 
  Video, 
  FileText, 
  Mic, 
  Paperclip,
  Loader2, 
  X, 
  AlertTriangle,
  Square,
  Play,
  Pause,
  RotateCcw,
  Zap,
  Search,
  Check
} from 'lucide-react';
import { cn } from '@/lib/utils';
import { format } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
import { toast } from '@/hooks/use-toast';
import { useAudioRecorder } from '@/hooks/useAudioRecorder';
import { useQuickRepliesData, QuickReply } from '@/hooks/useQuickRepliesData';

interface ScheduleMessageModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  contactId: string;
  contactName: string;
  conversationId?: string;
  assignedUserId?: string | null;
  currentUserId?: string;
}

type MessageType = 'text' | 'image' | 'video' | 'audio' | 'document' | 'quick-reply';

const MESSAGE_TYPES = [
  { type: 'text' as const, label: 'Texto', icon: FileText },
  { type: 'image' as const, label: 'Imagem', icon: Image },
  { type: 'video' as const, label: 'Vídeo', icon: Video },
  { type: 'audio' as const, label: 'Áudio', icon: Mic },
  { type: 'document' as const, label: 'Documento', icon: Paperclip },
  { type: 'quick-reply' as const, label: 'Rápida', icon: Zap },
];

function formatRecordingTime(seconds: number): string {
  const mins = Math.floor(seconds / 60);
  const secs = seconds % 60;
  return `${mins.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`;
}

export function ScheduleMessageModal({
  open,
  onOpenChange,
  contactId,
  contactName,
  conversationId,
}: ScheduleMessageModalProps) {
  const { profile } = useAuth();
  const [messageType, setMessageType] = useState<MessageType>('text');
  const [content, setContent] = useState('');
  const [selectedDate, setSelectedDate] = useState<Date | undefined>(undefined);
  const [hour, setHour] = useState('09');
  const [minute, setMinute] = useState('00');
  const [loading, setLoading] = useState(false);
  
  // Media state
  const [mediaFile, setMediaFile] = useState<File | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  
  // Audio recording state
  const [isRecordingAudio, setIsRecordingAudio] = useState(false);
  const [showAudioChoice, setShowAudioChoice] = useState(false);
  const audioRecorder = useAudioRecorder();
  const audioPreviewRef = useRef<HTMLAudioElement | null>(null);
  const [audioPreviewPlaying, setAudioPreviewPlaying] = useState(false);

  // Quick reply state
  const { quickReplies, loading: loadingQuickReplies, incrementUseCount } = useQuickRepliesData();
  const [quickReplySearch, setQuickReplySearch] = useState('');
  const [selectedQuickReply, setSelectedQuickReply] = useState<QuickReply | null>(null);

  // Filter quick replies based on search
  const filteredQuickReplies = useMemo(() => {
    if (!quickReplySearch.trim()) return quickReplies;
    const search = quickReplySearch.toLowerCase();
    return quickReplies.filter(qr =>
      qr.title.toLowerCase().includes(search) ||
      qr.shortcut.toLowerCase().includes(search) ||
      qr.message.toLowerCase().includes(search)
    );
  }, [quickReplies, quickReplySearch]);

  // Reset state when modal opens/closes
  useEffect(() => {
    if (open) {
      setMessageType('text');
      setContent('');
      setSelectedDate(undefined);
      setHour('09');
      setMinute('00');
      setMediaFile(null);
      setIsRecordingAudio(false);
      setShowAudioChoice(false);
      audioRecorder.cancelRecording();
      setQuickReplySearch('');
      setSelectedQuickReply(null);
    }
  }, [open]);

  // Handle quick reply selection
  const handleSelectQuickReply = async (qr: QuickReply) => {
    setSelectedQuickReply(qr);
    setContent(qr.message);

    // If quick reply has media, download and set the file
    if (qr.media_url && qr.media_type && qr.media_type !== 'text') {
      try {
        const response = await fetch(qr.media_url);
        const blob = await response.blob();
        const fileName = qr.media_url.split('/').pop() || `media.${qr.media_type}`;
        const file = new File([blob], fileName, { type: blob.type });
        setMediaFile(file);
      } catch (error) {
        console.error('[ScheduleMessageModal] Error downloading quick reply media:', error);
      }
    } else {
      setMediaFile(null);
    }
  };

  const handleFileSelect = (type: MessageType) => {
    if (type === 'audio') {
      setShowAudioChoice(true);
      return;
    }
    
    if (fileInputRef.current) {
      const acceptMap: Record<string, string> = {
        image: 'image/*',
        video: 'video/*',
        document: '*/*',
      };
      fileInputRef.current.accept = acceptMap[type] || '*/*';
      fileInputRef.current.click();
    }
  };

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      setMediaFile(file);
    }
    if (fileInputRef.current) {
      fileInputRef.current.value = '';
    }
  };

  const handleAudioChoiceRecord = () => {
    setShowAudioChoice(false);
    setIsRecordingAudio(true);
    audioRecorder.startRecording();
  };

  const handleAudioChoiceFile = () => {
    setShowAudioChoice(false);
    if (fileInputRef.current) {
      fileInputRef.current.accept = 'audio/*';
      fileInputRef.current.click();
    }
  };

  const handleStopRecording = () => {
    audioRecorder.stopRecording();
  };

  const handleCancelRecording = () => {
    audioRecorder.cancelRecording();
    setIsRecordingAudio(false);
    setAudioPreviewPlaying(false);
  };

  const handleSaveRecording = () => {
    if (audioRecorder.audioBlob) {
      const file = new File([audioRecorder.audioBlob], `audio_${Date.now()}.webm`, {
        type: 'audio/webm'
      });
      setMediaFile(file);
      setIsRecordingAudio(false);
      audioRecorder.clearRecording();
    }
  };

  const toggleAudioPreview = () => {
    if (!audioRecorder.audioUrl || !audioPreviewRef.current) return;
    
    if (audioPreviewPlaying) {
      audioPreviewRef.current.pause();
    } else {
      audioPreviewRef.current.play();
    }
    setAudioPreviewPlaying(!audioPreviewPlaying);
  };

  const handleSchedule = async () => {
    if (!profile?.company_id || !contactId) return;
    
    if (!selectedDate) {
      toast({
        title: 'Data obrigatória',
        description: 'Selecione uma data para o envio.',
        variant: 'destructive',
      });
      return;
    }

    if (messageType === 'quick-reply' && !selectedQuickReply) {
      toast({
        title: 'Resposta rápida obrigatória',
        description: 'Selecione uma resposta rápida para agendar.',
        variant: 'destructive',
      });
      return;
    }

    if (messageType === 'text' && !content.trim()) {
      toast({
        title: 'Mensagem obrigatória',
        description: 'Digite o conteúdo da mensagem.',
        variant: 'destructive',
      });
      return;
    }

    if (messageType !== 'text' && messageType !== 'quick-reply' && !mediaFile) {
      toast({
        title: 'Arquivo obrigatório',
        description: 'Selecione um arquivo para enviar.',
        variant: 'destructive',
      });
      return;
    }

    // Build scheduled datetime
    const scheduledAt = new Date(selectedDate);
    scheduledAt.setHours(parseInt(hour), parseInt(minute), 0, 0);

    // Validate it's in the future
    if (scheduledAt <= new Date()) {
      toast({
        title: 'Data inválida',
        description: 'A data de envio deve ser no futuro.',
        variant: 'destructive',
      });
      return;
    }

    setLoading(true);

    try {
      let mediaUrl: string | null = null;
      let mediaMimeType: string | null = null;
      let mediaFileName: string | null = null;

      // Upload media if present
      if (mediaFile) {
        const fileExt = mediaFile.name.split('.').pop();
        const fileName = `${profile.company_id}/${contactId}/${Date.now()}.${fileExt}`;
        
        const { error: uploadError } = await supabase.storage
          .from('scheduled-messages-media')
          .upload(fileName, mediaFile);

        if (uploadError) {
          throw new Error('Erro ao fazer upload do arquivo');
        }

        const { data: urlData } = supabase.storage
          .from('scheduled-messages-media')
          .getPublicUrl(fileName);

        mediaUrl = urlData.publicUrl;
        mediaMimeType = mediaFile.type;
        mediaFileName = mediaFile.name;
      }

      // Determine actual message type for quick replies
      let actualMessageType: string = messageType;
      if (messageType === 'quick-reply' && selectedQuickReply) {
        // Use the media type of the quick reply, or 'text' if no media
        actualMessageType = selectedQuickReply.media_type && selectedQuickReply.media_type !== 'text' 
          ? selectedQuickReply.media_type 
          : 'text';
      }

      // Create scheduled message
      const { error } = await supabase
        .from('scheduled_messages')
        .insert({
          company_id: profile.company_id,
          contact_id: contactId,
          conversation_id: conversationId || null,
          message_type: actualMessageType,
          content: content.trim() || null,
          media_url: mediaUrl,
          media_mime_type: mediaMimeType,
          media_file_name: mediaFileName,
          scheduled_at: scheduledAt.toISOString(),
          created_by: profile.id,
        });

      if (error) throw error;

      // Increment use count for quick reply
      if (messageType === 'quick-reply' && selectedQuickReply) {
        await incrementUseCount(selectedQuickReply.id);
      }

      toast({
        title: 'Mensagem agendada',
        description: `Mensagem será enviada em ${format(scheduledAt, "dd/MM/yyyy 'às' HH:mm", { locale: ptBR })}`,
      });

      onOpenChange(false);
    } catch (error: any) {
      console.error('[ScheduleMessageModal] Error:', error);
      toast({
        title: 'Erro ao agendar',
        description: error.message || 'Não foi possível agendar a mensagem.',
        variant: 'destructive',
      });
    } finally {
      setLoading(false);
    }
  };

  const hours = Array.from({ length: 24 }, (_, i) => i.toString().padStart(2, '0'));
  const minutes = Array.from({ length: 60 }, (_, i) => i.toString().padStart(2, '0'));

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-lg max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <CalendarIcon className="w-5 h-5" />
            Agendar Mensagem para {contactName}
          </DialogTitle>
        </DialogHeader>

        <div className="space-y-4 py-4">
          {/* Message Type Tabs */}
          <Tabs value={messageType} onValueChange={(v) => {
            setMessageType(v as MessageType);
            setMediaFile(null);
            setIsRecordingAudio(false);
            audioRecorder.cancelRecording();
            if (v !== 'quick-reply') {
              setSelectedQuickReply(null);
              setContent('');
            }
          }}>
            <TabsList className="w-full grid grid-cols-6">
              {MESSAGE_TYPES.map(({ type, label, icon: Icon }) => (
                <TabsTrigger key={type} value={type} className="text-xs min-w-0 px-1.5">
                  <Icon className="w-4 h-4 mr-1 flex-shrink-0" />
                  <span className="truncate hidden sm:inline">{label}</span>
                </TabsTrigger>
              ))}
            </TabsList>

            {/* Text Content */}
            <TabsContent value="text" className="mt-4">
              <div className="space-y-2">
                <Label>Mensagem</Label>
                <Textarea
                  value={content}
                  onChange={(e) => setContent(e.target.value)}
                  placeholder="Digite sua mensagem..."
                  className="min-h-[100px]"
                />
              </div>
            </TabsContent>

            {/* Image */}
            <TabsContent value="image" className="mt-4 space-y-4">
              <div className="space-y-2">
                <Label>Imagem</Label>
                {mediaFile ? (
                  <div className="relative">
                    <img
                      src={URL.createObjectURL(mediaFile)}
                      alt="Preview"
                      className="w-full h-40 object-cover rounded-lg"
                    />
                    <Button
                      variant="destructive"
                      size="icon"
                      className="absolute top-2 right-2 h-6 w-6"
                      onClick={() => setMediaFile(null)}
                    >
                      <X className="w-4 h-4" />
                    </Button>
                  </div>
                ) : (
                  <Button
                    variant="outline"
                    className="w-full h-20"
                    onClick={() => handleFileSelect('image')}
                  >
                    <Image className="w-6 h-6 mr-2" />
                    Selecionar Imagem
                  </Button>
                )}
              </div>
              <div className="space-y-2">
                <Label>Legenda (opcional)</Label>
                <Textarea
                  value={content}
                  onChange={(e) => setContent(e.target.value)}
                  placeholder="Adicione uma legenda..."
                  className="min-h-[60px]"
                />
              </div>
            </TabsContent>

            {/* Video */}
            <TabsContent value="video" className="mt-4 space-y-4">
              <div className="space-y-2">
                <Label>Vídeo</Label>
                {mediaFile ? (
                  <div className="relative">
                    <video
                      src={URL.createObjectURL(mediaFile)}
                      className="w-full h-40 object-cover rounded-lg"
                      controls
                    />
                    <Button
                      variant="destructive"
                      size="icon"
                      className="absolute top-2 right-2 h-6 w-6"
                      onClick={() => setMediaFile(null)}
                    >
                      <X className="w-4 h-4" />
                    </Button>
                  </div>
                ) : (
                  <Button
                    variant="outline"
                    className="w-full h-20"
                    onClick={() => handleFileSelect('video')}
                  >
                    <Video className="w-6 h-6 mr-2" />
                    Selecionar Vídeo
                  </Button>
                )}
              </div>
              <div className="space-y-2">
                <Label>Legenda (opcional)</Label>
                <Textarea
                  value={content}
                  onChange={(e) => setContent(e.target.value)}
                  placeholder="Adicione uma legenda..."
                  className="min-h-[60px]"
                />
              </div>
            </TabsContent>

            {/* Audio */}
            <TabsContent value="audio" className="mt-4 space-y-4">
              <div className="space-y-2">
                <Label>Áudio</Label>
                
                {showAudioChoice && (
                  <div className="flex gap-2">
                    <Button variant="outline" className="flex-1" onClick={handleAudioChoiceRecord}>
                      <Mic className="w-4 h-4 mr-2" />
                      Gravar
                    </Button>
                    <Button variant="outline" className="flex-1" onClick={handleAudioChoiceFile}>
                      <FileText className="w-4 h-4 mr-2" />
                      Arquivo
                    </Button>
                  </div>
                )}

                {isRecordingAudio && (
                  <div className="p-4 bg-muted rounded-lg space-y-3">
                    {audioRecorder.isRecording ? (
                      <>
                        <div className="flex items-center justify-center gap-2">
                          <div className="w-3 h-3 bg-red-500 rounded-full animate-pulse" />
                          <span className="text-lg font-mono">
                            {formatRecordingTime(audioRecorder.recordingTime)}
                          </span>
                        </div>
                        <div className="flex justify-center gap-2">
                          <Button variant="outline" size="sm" onClick={handleCancelRecording}>
                            <X className="w-4 h-4 mr-1" />
                            Cancelar
                          </Button>
                          <Button variant="default" size="sm" onClick={handleStopRecording}>
                            <Square className="w-4 h-4 mr-1" />
                            Parar
                          </Button>
                        </div>
                      </>
                    ) : audioRecorder.audioUrl ? (
                      <>
                        <audio 
                          ref={audioPreviewRef} 
                          src={audioRecorder.audioUrl}
                          onEnded={() => setAudioPreviewPlaying(false)}
                        />
                        <div className="flex items-center justify-center gap-2">
                          <Button variant="ghost" size="icon" onClick={toggleAudioPreview}>
                            {audioPreviewPlaying ? <Pause className="w-5 h-5" /> : <Play className="w-5 h-5" />}
                          </Button>
                          <span className="text-sm text-muted-foreground">
                            {formatRecordingTime(audioRecorder.recordingTime)}
                          </span>
                        </div>
                        <div className="flex justify-center gap-2">
                          <Button variant="outline" size="sm" onClick={handleCancelRecording}>
                            <RotateCcw className="w-4 h-4 mr-1" />
                            Regravar
                          </Button>
                          <Button variant="default" size="sm" onClick={handleSaveRecording}>
                            Usar áudio
                          </Button>
                        </div>
                      </>
                    ) : null}
                  </div>
                )}

                {mediaFile && !isRecordingAudio && (
                  <div className="flex items-center gap-2 p-3 bg-muted rounded-lg">
                    <Mic className="w-5 h-5 text-muted-foreground" />
                    <span className="flex-1 text-sm truncate">{mediaFile.name}</span>
                    <Button
                      variant="ghost"
                      size="icon"
                      className="h-6 w-6"
                      onClick={() => setMediaFile(null)}
                    >
                      <X className="w-4 h-4" />
                    </Button>
                  </div>
                )}

                {!mediaFile && !isRecordingAudio && !showAudioChoice && (
                  <Button
                    variant="outline"
                    className="w-full h-20"
                    onClick={() => setShowAudioChoice(true)}
                  >
                    <Mic className="w-6 h-6 mr-2" />
                    Gravar ou Selecionar Áudio
                  </Button>
                )}
              </div>
            </TabsContent>

            {/* Document */}
            <TabsContent value="document" className="mt-4 space-y-4">
              <div className="space-y-2">
                <Label>Documento</Label>
                {mediaFile ? (
                  <div className="flex items-center gap-2 p-3 bg-muted rounded-lg">
                    <FileText className="w-5 h-5 text-muted-foreground" />
                    <span className="flex-1 text-sm truncate">{mediaFile.name}</span>
                    <Button
                      variant="ghost"
                      size="icon"
                      className="h-6 w-6"
                      onClick={() => setMediaFile(null)}
                    >
                      <X className="w-4 h-4" />
                    </Button>
                  </div>
                ) : (
                  <Button
                    variant="outline"
                    className="w-full h-20"
                    onClick={() => handleFileSelect('document')}
                  >
                    <FileText className="w-6 h-6 mr-2" />
                    Selecionar Documento
                  </Button>
                )}
              </div>
              <div className="space-y-2">
                <Label>Legenda (opcional)</Label>
                <Textarea
                  value={content}
                  onChange={(e) => setContent(e.target.value)}
                  placeholder="Adicione uma legenda..."
                  className="min-h-[60px]"
                />
              </div>
            </TabsContent>

            {/* Quick Reply */}
            <TabsContent value="quick-reply" className="mt-4 space-y-4">
              {selectedQuickReply ? (
                <div className="space-y-3">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      <Check className="w-4 h-4 text-green-500" />
                      <span className="text-sm font-medium">Resposta selecionada</span>
                    </div>
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => {
                        setSelectedQuickReply(null);
                        setContent('');
                        setMediaFile(null);
                      }}
                    >
                      Trocar
                    </Button>
                  </div>
                  <div className="p-3 bg-muted rounded-lg space-y-2">
                    <div className="flex items-center gap-2">
                      <Badge variant="secondary" className="font-mono text-xs">
                        {selectedQuickReply.shortcut}
                      </Badge>
                      <span className="font-medium text-sm">{selectedQuickReply.title}</span>
                      {selectedQuickReply.media_type && selectedQuickReply.media_type !== 'text' && (
                        <Badge variant="outline" className="text-xs capitalize">
                          {selectedQuickReply.media_type}
                        </Badge>
                      )}
                    </div>
                    <p className="text-sm text-muted-foreground line-clamp-3">
                      {selectedQuickReply.message}
                    </p>
                    {selectedQuickReply.media_url && selectedQuickReply.media_type === 'image' && (
                      <img
                        src={selectedQuickReply.media_url}
                        alt="Preview"
                        className="w-full h-32 object-cover rounded-md mt-2"
                      />
                    )}
                  </div>
                </div>
              ) : (
                <div className="space-y-3">
                  <div className="relative">
                    <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
                    <Input
                      value={quickReplySearch}
                      onChange={(e) => setQuickReplySearch(e.target.value)}
                      placeholder="Buscar resposta rápida..."
                      className="pl-9"
                    />
                  </div>
                  <ScrollArea className="h-[200px]">
                    {loadingQuickReplies ? (
                      <div className="flex items-center justify-center h-full">
                        <Loader2 className="w-5 h-5 animate-spin text-muted-foreground" />
                      </div>
                    ) : filteredQuickReplies.length === 0 ? (
                      <div className="flex flex-col items-center justify-center h-full text-muted-foreground">
                        <Zap className="w-8 h-8 mb-2 opacity-50" />
                        <p className="text-sm">
                          {quickReplySearch ? 'Nenhuma resposta encontrada' : 'Nenhuma resposta rápida disponível'}
                        </p>
                      </div>
                    ) : (
                      <div className="space-y-1">
                        {filteredQuickReplies.map((qr) => (
                          <button
                            key={qr.id}
                            className="w-full p-3 text-left rounded-lg hover:bg-muted transition-colors border border-transparent hover:border-border"
                            onClick={() => handleSelectQuickReply(qr)}
                          >
                            <div className="flex items-center gap-2 mb-1">
                              <Badge variant="secondary" className="font-mono text-xs">
                                {qr.shortcut}
                              </Badge>
                              <span className="font-medium text-sm truncate">{qr.title}</span>
                              {qr.media_type && qr.media_type !== 'text' && (
                                <Badge variant="outline" className="text-xs capitalize ml-auto">
                                  {qr.media_type === 'image' && <Image className="w-3 h-3 mr-1" />}
                                  {qr.media_type === 'video' && <Video className="w-3 h-3 mr-1" />}
                                  {qr.media_type === 'audio' && <Mic className="w-3 h-3 mr-1" />}
                                  {qr.media_type === 'document' && <FileText className="w-3 h-3 mr-1" />}
                                  {qr.media_type}
                                </Badge>
                              )}
                            </div>
                            <p className="text-sm text-muted-foreground line-clamp-2">
                              {qr.message}
                            </p>
                          </button>
                        ))}
                      </div>
                    )}
                  </ScrollArea>
                </div>
              )}
            </TabsContent>
          </Tabs>

          {/* Date and Time Selection */}
          <div className="space-y-2">
            <Label>Data e Hora do Envio</Label>
            <div className="flex gap-2">
              <Popover>
                <PopoverTrigger asChild>
                  <Button
                    variant="outline"
                    className={cn(
                      "flex-1 justify-start text-left font-normal",
                      !selectedDate && "text-muted-foreground"
                    )}
                  >
                    <CalendarIcon className="mr-2 h-4 w-4" />
                    {selectedDate ? (
                      format(selectedDate, "dd/MM/yyyy", { locale: ptBR })
                    ) : (
                      "Selecionar data"
                    )}
                  </Button>
                </PopoverTrigger>
                <PopoverContent className="w-auto p-0" align="start">
                  <Calendar
                    mode="single"
                    selected={selectedDate}
                    onSelect={setSelectedDate}
                    disabled={(date) => date < new Date(new Date().setHours(0, 0, 0, 0))}
                    locale={ptBR}
                  />
                </PopoverContent>
              </Popover>

              <Select value={hour} onValueChange={setHour}>
                <SelectTrigger className="w-20">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {hours.map((h) => (
                    <SelectItem key={h} value={h}>{h}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
              <span className="flex items-center">:</span>
              <Select value={minute} onValueChange={setMinute}>
                <SelectTrigger className="w-20">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {minutes.map((m) => (
                    <SelectItem key={m} value={m}>{m}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>

          {/* Warning */}
          <div className="flex items-start gap-2 p-3 bg-amber-50 dark:bg-amber-950/30 rounded-lg text-amber-700 dark:text-amber-300 text-sm">
            <AlertTriangle className="w-4 h-4 mt-0.5 flex-shrink-0" />
            <span>
              A mensagem será enviada pela conexão e departamento que o contato estiver no momento do envio.
            </span>
          </div>
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            Cancelar
          </Button>
          <Button onClick={handleSchedule} disabled={loading}>
            {loading && <Loader2 className="w-4 h-4 mr-2 animate-spin" />}
            Agendar Mensagem
          </Button>
        </DialogFooter>

        {/* Hidden file input */}
        <input
          type="file"
          ref={fileInputRef}
          className="hidden"
          onChange={handleFileChange}
        />
      </DialogContent>
    </Dialog>
  );
}
