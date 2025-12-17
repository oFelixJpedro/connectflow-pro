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
import { 
  CalendarIcon, 
  Image, 
  Video, 
  FileText, 
  Mic, 
  File as FileIcon,
  Loader2, 
  X, 
  AlertTriangle,
  Square,
  Play,
  Pause,
  RotateCcw,
  Pencil
} from 'lucide-react';
import { cn } from '@/lib/utils';
import { format } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
import { toast } from '@/hooks/use-toast';
import { useAudioRecorder } from '@/hooks/useAudioRecorder';

interface ScheduledMessage {
  id: string;
  message_type: string;
  content: string | null;
  media_url: string | null;
  media_file_name: string | null;
  media_mime_type: string | null;
  scheduled_at: string;
  status: string;
}

interface ScheduledMessageEditModalProps {
  message: ScheduledMessage | null;
  onClose: () => void;
  onSaved: () => void;
  onCancelled: () => void;
}

const TYPE_LABELS: Record<string, string> = {
  text: 'Texto',
  image: 'Imagem',
  video: 'Vídeo',
  audio: 'Áudio',
  document: 'Documento',
};

const TYPE_ICONS: Record<string, React.ElementType> = {
  text: FileText,
  image: Image,
  video: Video,
  audio: Mic,
  document: FileIcon,
};

function formatRecordingTime(seconds: number): string {
  const mins = Math.floor(seconds / 60);
  const secs = seconds % 60;
  return `${mins.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`;
}

export function ScheduledMessageEditModal({
  message,
  onClose,
  onSaved,
  onCancelled,
}: ScheduledMessageEditModalProps) {
  const { profile } = useAuth();
  const [content, setContent] = useState('');
  const [selectedDate, setSelectedDate] = useState<Date | undefined>(undefined);
  const [hour, setHour] = useState('09');
  const [minute, setMinute] = useState('00');
  const [loading, setLoading] = useState(false);
  const [showCancelConfirm, setShowCancelConfirm] = useState(false);
  const [cancelling, setCancelling] = useState(false);
  
  // Media state
  const [mediaFile, setMediaFile] = useState<File | null>(null);
  const [currentMediaUrl, setCurrentMediaUrl] = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  
  // Audio recording state
  const [isRecordingAudio, setIsRecordingAudio] = useState(false);
  const audioRecorder = useAudioRecorder();
  const audioPreviewRef = useRef<HTMLAudioElement | null>(null);
  const [audioPreviewPlaying, setAudioPreviewPlaying] = useState(false);

  // Initialize state when message changes
  useEffect(() => {
    if (message) {
      setContent(message.content || '');
      setCurrentMediaUrl(message.media_url);
      setMediaFile(null);
      
      const date = new Date(message.scheduled_at);
      setSelectedDate(date);
      setHour(date.getHours().toString().padStart(2, '0'));
      setMinute(date.getMinutes().toString().padStart(2, '0'));
      
      setIsRecordingAudio(false);
      audioRecorder.cancelRecording();
    }
  }, [message]);

  const handleFileSelect = () => {
    if (!message) return;
    
    if (message.message_type === 'audio') {
      if (fileInputRef.current) {
        fileInputRef.current.accept = 'audio/*';
        fileInputRef.current.click();
      }
      return;
    }
    
    if (fileInputRef.current) {
      const acceptMap: Record<string, string> = {
        image: 'image/*',
        video: 'video/*',
        document: '*/*',
      };
      fileInputRef.current.accept = acceptMap[message.message_type] || '*/*';
      fileInputRef.current.click();
    }
  };

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      setMediaFile(file);
      setCurrentMediaUrl(null);
    }
    if (fileInputRef.current) {
      fileInputRef.current.value = '';
    }
  };

  const handleStartRecording = () => {
    setIsRecordingAudio(true);
    audioRecorder.startRecording();
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
      setCurrentMediaUrl(null);
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

  const handleSave = async () => {
    if (!message || !profile?.company_id) return;
    
    if (!selectedDate) {
      toast({
        title: 'Data obrigatória',
        description: 'Selecione uma data para o envio.',
        variant: 'destructive',
      });
      return;
    }

    if (message.message_type === 'text' && !content.trim()) {
      toast({
        title: 'Mensagem obrigatória',
        description: 'Digite o conteúdo da mensagem.',
        variant: 'destructive',
      });
      return;
    }

    if (message.message_type !== 'text' && !mediaFile && !currentMediaUrl) {
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
      let mediaUrl = currentMediaUrl;
      let mediaMimeType = message.media_mime_type;
      let mediaFileName = message.media_file_name;

      // Upload new media if changed
      if (mediaFile) {
        const fileExt = mediaFile.name.split('.').pop();
        const fileName = `${profile.company_id}/${message.id}/${Date.now()}.${fileExt}`;
        
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

      // Update scheduled message
      const { error } = await supabase
        .from('scheduled_messages')
        .update({
          content: content.trim() || null,
          media_url: mediaUrl,
          media_mime_type: mediaMimeType,
          media_file_name: mediaFileName,
          scheduled_at: scheduledAt.toISOString(),
        })
        .eq('id', message.id);

      if (error) throw error;

      toast({
        title: 'Mensagem atualizada',
        description: `Mensagem será enviada em ${format(scheduledAt, "dd/MM/yyyy 'às' HH:mm", { locale: ptBR })}`,
      });

      onSaved();
      onClose();
    } catch (error: any) {
      console.error('[ScheduledMessageEditModal] Error:', error);
      toast({
        title: 'Erro ao atualizar',
        description: error.message || 'Não foi possível atualizar a mensagem.',
        variant: 'destructive',
      });
    } finally {
      setLoading(false);
    }
  };

  const handleCancelMessage = async () => {
    if (!message || !profile?.id) return;

    setCancelling(true);
    try {
      const { error } = await supabase
        .from('scheduled_messages')
        .update({
          status: 'cancelled',
          cancelled_at: new Date().toISOString(),
          cancelled_by: profile.id,
        })
        .eq('id', message.id);

      if (error) throw error;

      toast({
        title: 'Mensagem cancelada',
        description: 'A mensagem agendada foi cancelada com sucesso.',
      });

      onCancelled();
      onClose();
    } catch (error: any) {
      console.error('[ScheduledMessageEditModal] Error cancelling:', error);
      toast({
        title: 'Erro ao cancelar',
        description: error.message || 'Não foi possível cancelar a mensagem.',
        variant: 'destructive',
      });
    } finally {
      setCancelling(false);
      setShowCancelConfirm(false);
    }
  };

  const hours = Array.from({ length: 24 }, (_, i) => i.toString().padStart(2, '0'));
  const minutes = Array.from({ length: 60 }, (_, i) => i.toString().padStart(2, '0'));

  if (!message) return null;

  const Icon = TYPE_ICONS[message.message_type] || FileText;

  const renderMediaPreview = () => {
    const mediaSource = mediaFile ? URL.createObjectURL(mediaFile) : currentMediaUrl;
    
    if (!mediaSource && message.message_type !== 'text') {
      return (
        <Button
          variant="outline"
          className="w-full h-20"
          onClick={handleFileSelect}
        >
          <Icon className="w-6 h-6 mr-2" />
          Selecionar {TYPE_LABELS[message.message_type]}
        </Button>
      );
    }

    switch (message.message_type) {
      case 'image':
        return (
          <div className="relative">
            <img
              src={mediaSource!}
              alt="Preview"
              className="w-full h-40 object-cover rounded-lg"
            />
            <Button
              variant="secondary"
              size="sm"
              className="absolute bottom-2 right-2"
              onClick={handleFileSelect}
            >
              <Pencil className="w-4 h-4 mr-1" />
              Trocar
            </Button>
          </div>
        );
      
      case 'video':
        return (
          <div className="relative">
            <video
              src={mediaSource!}
              className="w-full h-40 object-cover rounded-lg"
              controls
            />
            <Button
              variant="secondary"
              size="sm"
              className="absolute bottom-2 right-2"
              onClick={handleFileSelect}
            >
              <Pencil className="w-4 h-4 mr-1" />
              Trocar
            </Button>
          </div>
        );
      
      case 'audio':
        if (isRecordingAudio) {
          return (
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
          );
        }
        
        return (
          <div className="space-y-2">
            <div className="flex items-center gap-2 p-3 bg-muted rounded-lg">
              <Mic className="w-5 h-5 text-muted-foreground" />
              <span className="flex-1 text-sm">Áudio</span>
            </div>
            <div className="flex gap-2">
              <Button variant="outline" size="sm" onClick={handleStartRecording}>
                <Mic className="w-4 h-4 mr-1" />
                Gravar
              </Button>
              <Button variant="outline" size="sm" onClick={handleFileSelect}>
                <FileIcon className="w-4 h-4 mr-1" />
                Arquivo
              </Button>
            </div>
            {mediaSource && (
              <audio src={mediaSource} controls className="w-full mt-2" />
            )}
          </div>
        );
      
      case 'document':
        return (
          <div className="flex items-center gap-2 p-3 bg-muted rounded-lg">
            <FileIcon className="w-5 h-5 text-muted-foreground" />
            <span className="flex-1 text-sm truncate">
              {mediaFile?.name || message.media_file_name || 'Documento'}
            </span>
            <Button
              variant="secondary"
              size="sm"
              onClick={handleFileSelect}
            >
              <Pencil className="w-4 h-4 mr-1" />
              Trocar
            </Button>
          </div>
        );
      
      default:
        return null;
    }
  };

  return (
    <>
      <Dialog open={!!message} onOpenChange={(open) => !open && onClose()}>
        <DialogContent className="max-w-lg max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Icon className="w-5 h-5" />
              Editar Mensagem Agendada
            </DialogTitle>
          </DialogHeader>

          <div className="space-y-4 py-4">
            {/* Message Type Badge */}
            <div className="flex items-center gap-2 text-sm text-muted-foreground">
              <span>Tipo:</span>
              <span className="font-medium text-foreground">
                {TYPE_LABELS[message.message_type] || message.message_type}
              </span>
            </div>

            {/* Media Preview/Edit */}
            {message.message_type !== 'text' && (
              <div className="space-y-2">
                <Label>{TYPE_LABELS[message.message_type]}</Label>
                {renderMediaPreview()}
              </div>
            )}

            {/* Content/Caption */}
            <div className="space-y-2">
              <Label>
                {message.message_type === 'text' ? 'Mensagem' : 'Legenda (opcional)'}
              </Label>
              <Textarea
                value={content}
                onChange={(e) => setContent(e.target.value)}
                placeholder={message.message_type === 'text' ? 'Digite sua mensagem...' : 'Adicione uma legenda...'}
                className="min-h-[80px]"
              />
            </div>

            {/* Date/Time Selection */}
            <div className="space-y-2">
              <Label>Data e Hora de Envio</Label>
              <div className="flex gap-2">
                <Popover>
                  <PopoverTrigger asChild>
                    <Button
                      variant="outline"
                      className={cn(
                        'flex-1 justify-start text-left font-normal',
                        !selectedDate && 'text-muted-foreground'
                      )}
                    >
                      <CalendarIcon className="mr-2 h-4 w-4" />
                      {selectedDate ? format(selectedDate, 'dd/MM/yyyy', { locale: ptBR }) : 'Selecionar data'}
                    </Button>
                  </PopoverTrigger>
                  <PopoverContent className="w-auto p-0" align="start">
                    <Calendar
                      mode="single"
                      selected={selectedDate}
                      onSelect={setSelectedDate}
                      disabled={(date) => date < new Date(new Date().setHours(0, 0, 0, 0))}
                      locale={ptBR}
                      initialFocus
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
                <span className="self-center">:</span>
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

            <input
              ref={fileInputRef}
              type="file"
              className="hidden"
              onChange={handleFileChange}
            />
          </div>

          <DialogFooter className="flex-col sm:flex-row gap-2">
            <Button
              variant="destructive"
              onClick={() => setShowCancelConfirm(true)}
              disabled={loading}
            >
              Cancelar Envio
            </Button>
            <div className="flex gap-2 flex-1 justify-end">
              <Button variant="outline" onClick={onClose} disabled={loading}>
                Fechar
              </Button>
              <Button onClick={handleSave} disabled={loading}>
                {loading && <Loader2 className="w-4 h-4 mr-2 animate-spin" />}
                Salvar Alterações
              </Button>
            </div>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Cancel Confirmation Dialog */}
      <AlertDialog open={showCancelConfirm} onOpenChange={setShowCancelConfirm}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle className="flex items-center gap-2">
              <AlertTriangle className="w-5 h-5 text-destructive" />
              Cancelar Mensagem Agendada
            </AlertDialogTitle>
            <AlertDialogDescription>
              Tem certeza que deseja cancelar esta mensagem agendada? Esta ação não pode ser desfeita.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={cancelling}>Voltar</AlertDialogCancel>
            <AlertDialogAction
              onClick={handleCancelMessage}
              disabled={cancelling}
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
            >
              {cancelling && <Loader2 className="w-4 h-4 mr-2 animate-spin" />}
              Cancelar Mensagem
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  );
}
