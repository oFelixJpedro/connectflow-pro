import { useState, useRef, useEffect } from 'react';
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
import { 
  CalendarIcon, 
  Image, 
  Video, 
  FileText, 
  Mic, 
  Loader2, 
  X, 
  AlertTriangle,
  Square,
  Play,
  Pause,
  RotateCcw
} from 'lucide-react';
import { cn } from '@/lib/utils';
import { format } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
import { toast } from '@/hooks/use-toast';
import { useAudioRecorder } from '@/hooks/useAudioRecorder';

interface ScheduleMessageModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  contactId: string;
  contactName: string;
  conversationId?: string;
}

type MessageType = 'text' | 'image' | 'video' | 'audio' | 'document';

const MESSAGE_TYPES = [
  { type: 'text' as const, label: 'Texto', icon: FileText },
  { type: 'image' as const, label: 'Imagem', icon: Image },
  { type: 'video' as const, label: 'Vídeo', icon: Video },
  { type: 'audio' as const, label: 'Áudio', icon: Mic },
  { type: 'document' as const, label: 'Documento', icon: FileText },
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
    }
  }, [open]);

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

    if (messageType === 'text' && !content.trim()) {
      toast({
        title: 'Mensagem obrigatória',
        description: 'Digite o conteúdo da mensagem.',
        variant: 'destructive',
      });
      return;
    }

    if (messageType !== 'text' && !mediaFile) {
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

      // Create scheduled message
      const { error } = await supabase
        .from('scheduled_messages')
        .insert({
          company_id: profile.company_id,
          contact_id: contactId,
          conversation_id: conversationId || null,
          message_type: messageType,
          content: content.trim() || null,
          media_url: mediaUrl,
          media_mime_type: mediaMimeType,
          media_file_name: mediaFileName,
          scheduled_at: scheduledAt.toISOString(),
          created_by: profile.id,
        });

      if (error) throw error;

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
          }}>
            <TabsList className="w-full grid grid-cols-5">
              {MESSAGE_TYPES.map(({ type, label, icon: Icon }) => (
                <TabsTrigger key={type} value={type} className="text-xs">
                  <Icon className="w-4 h-4 mr-1" />
                  {label}
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
