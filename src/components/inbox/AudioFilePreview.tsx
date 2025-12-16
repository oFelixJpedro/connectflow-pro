import { useState, useRef, useEffect } from 'react';
import { 
  Mic, 
  X, 
  Play,
  Pause,
  Send,
  Loader2,
  AlertCircle,
  FileAudio
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Tooltip, TooltipContent, TooltipTrigger } from '@/components/ui/tooltip';
import { cn } from '@/lib/utils';

interface AudioFilePreviewProps {
  file: File;
  onSend: (file: File, duration: number) => Promise<void>;
  onCancel: () => void;
  disabled?: boolean;
}

function formatBytes(bytes: number): string {
  if (bytes === 0) return '0 B';
  const k = 1024;
  const sizes = ['B', 'KB', 'MB'];
  const i = Math.floor(Math.log(bytes) / Math.log(k));
  return parseFloat((bytes / Math.pow(k, i)).toFixed(1)) + ' ' + sizes[i];
}

function formatTime(seconds: number): string {
  const mins = Math.floor(seconds / 60);
  const secs = Math.floor(seconds % 60);
  return `${mins.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`;
}

const MAX_FILE_SIZE = 16 * 1024 * 1024; // 16MB

export function AudioFilePreview({ file, onSend, onCancel, disabled }: AudioFilePreviewProps) {
  const [isSending, setIsSending] = useState(false);
  const [isPlaying, setIsPlaying] = useState(false);
  const [duration, setDuration] = useState(0);
  const [error, setError] = useState<string | null>(null);
  const [audioUrl, setAudioUrl] = useState<string | null>(null);
  const audioRef = useRef<HTMLAudioElement | null>(null);

  // Validate file and create URL
  useEffect(() => {
    // Validate size
    if (file.size > MAX_FILE_SIZE) {
      setError(`Arquivo muito grande. O limite é ${formatBytes(MAX_FILE_SIZE)}.`);
      return;
    }

    // Validate type
    const validTypes = [
      'audio/mpeg', 'audio/mp3', 'audio/ogg', 'audio/wav', 
      'audio/webm', 'audio/aac', 'audio/x-m4a', 'audio/mp4'
    ];
    if (!validTypes.some(type => file.type.includes(type.split('/')[1])) && 
        !file.name.match(/\.(mp3|ogg|wav|webm|aac|m4a)$/i)) {
      setError('Formato não suportado. Use MP3, OGG, AAC, WAV ou WebM.');
      return;
    }

    const url = URL.createObjectURL(file);
    setAudioUrl(url);

    return () => {
      URL.revokeObjectURL(url);
    };
  }, [file]);

  // Get duration when audio loads
  useEffect(() => {
    const audio = audioRef.current;
    if (!audio) return;

    const handleLoadedMetadata = () => {
      if (isFinite(audio.duration)) {
        setDuration(audio.duration);
      }
    };

    const handlePlay = () => setIsPlaying(true);
    const handlePause = () => setIsPlaying(false);
    const handleEnded = () => setIsPlaying(false);

    audio.addEventListener('loadedmetadata', handleLoadedMetadata);
    audio.addEventListener('play', handlePlay);
    audio.addEventListener('pause', handlePause);
    audio.addEventListener('ended', handleEnded);

    return () => {
      audio.removeEventListener('loadedmetadata', handleLoadedMetadata);
      audio.removeEventListener('play', handlePlay);
      audio.removeEventListener('pause', handlePause);
      audio.removeEventListener('ended', handleEnded);
    };
  }, [audioUrl]);

  const handleSend = async () => {
    setIsSending(true);
    try {
      console.log('📤 Enviando arquivo de áudio...');
      await onSend(file, duration);
    } catch (error) {
      console.error('❌ Erro ao enviar áudio:', error);
    } finally {
      setIsSending(false);
    }
  };

  const togglePlayback = () => {
    if (!audioRef.current) return;

    if (isPlaying) {
      audioRef.current.pause();
    } else {
      audioRef.current.play();
    }
  };

  // Error state
  if (error) {
    return (
      <div className="flex items-center gap-3 p-3 bg-destructive/10 rounded-lg border border-destructive/20">
        <AlertCircle className="w-5 h-5 text-destructive flex-shrink-0" />
        <div className="flex-1 min-w-0">
          <p className="text-sm text-destructive">{error}</p>
        </div>
        <Button
          variant="ghost"
          size="sm"
          onClick={onCancel}
          className="flex-shrink-0"
        >
          Fechar
        </Button>
      </div>
    );
  }

  return (
    <div className="flex items-center gap-3 p-3 bg-muted/50 rounded-lg border border-border animate-in fade-in slide-in-from-bottom-2">
      {/* Hidden audio element */}
      {audioUrl && <audio ref={audioRef} src={audioUrl} preload="metadata" />}

      {/* Audio icon */}
      <div className="flex-shrink-0 w-10 h-10 rounded-full bg-primary/20 flex items-center justify-center">
        <FileAudio className="w-5 h-5 text-primary" />
      </div>

      {/* Info */}
      <div className="flex-1 min-w-0">
        <p className="text-sm font-medium text-foreground">
          Áudio
        </p>
        <div className="flex items-center gap-2 text-xs text-muted-foreground">
          <span>{formatBytes(file.size)}</span>
          {duration > 0 && (
            <>
              <span>•</span>
              <span>{formatTime(duration)}</span>
            </>
          )}
        </div>
      </div>

      {/* Controls */}
      <div className="flex items-center gap-1 flex-shrink-0">
        {/* Play preview */}
        <Tooltip>
          <TooltipTrigger asChild>
            <Button
              variant="ghost"
              size="icon"
              onClick={togglePlayback}
              className="h-9 w-9"
              disabled={!audioUrl}
            >
              {isPlaying ? (
                <Pause className="w-4 h-4" />
              ) : (
                <Play className="w-4 h-4" />
              )}
            </Button>
          </TooltipTrigger>
          <TooltipContent>
            {isPlaying ? 'Pausar' : 'Ouvir'}
          </TooltipContent>
        </Tooltip>

        {/* Send */}
        <Tooltip>
          <TooltipTrigger asChild>
            <Button
              variant="default"
              size="icon"
              onClick={handleSend}
              className="h-9 w-9"
              disabled={isSending || disabled}
            >
              {isSending ? (
                <Loader2 className="w-4 h-4 animate-spin" />
              ) : (
                <Send className="w-4 h-4" />
              )}
            </Button>
          </TooltipTrigger>
          <TooltipContent>Enviar áudio</TooltipContent>
        </Tooltip>

        {/* Cancel */}
        <Tooltip>
          <TooltipTrigger asChild>
            <Button
              variant="ghost"
              size="icon"
              onClick={onCancel}
              className="h-9 w-9 text-muted-foreground hover:text-foreground"
              disabled={isSending}
            >
              <X className="w-4 h-4" />
            </Button>
          </TooltipTrigger>
          <TooltipContent>Cancelar</TooltipContent>
        </Tooltip>
      </div>
    </div>
  );
}
