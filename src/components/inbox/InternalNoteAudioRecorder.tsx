import { useState, useRef, useEffect } from 'react';
import { 
  Mic, 
  Square, 
  X, 
  Pause, 
  Play,
  Send,
  Loader2,
  RotateCcw,
  AlertCircle
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Tooltip, TooltipContent, TooltipTrigger } from '@/components/ui/tooltip';
import { cn } from '@/lib/utils';
import { useAudioRecorder } from '@/hooks/useAudioRecorder';

interface InternalNoteAudioRecorderProps {
  onSend: (audioBlob: Blob, duration: number) => Promise<void>;
  onCancel: () => void;
  disabled?: boolean;
}

function formatTime(seconds: number): string {
  const mins = Math.floor(seconds / 60);
  const secs = seconds % 60;
  return `${mins.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`;
}

function formatBytes(bytes: number): string {
  if (bytes === 0) return '0 B';
  const k = 1024;
  const sizes = ['B', 'KB', 'MB'];
  const i = Math.floor(Math.log(bytes) / Math.log(k));
  return parseFloat((bytes / Math.pow(k, i)).toFixed(1)) + ' ' + sizes[i];
}

export function InternalNoteAudioRecorder({ onSend, onCancel, disabled }: InternalNoteAudioRecorderProps) {
  const {
    isRecording,
    isPaused,
    recordingTime,
    audioBlob,
    audioUrl,
    error,
    startRecording,
    stopRecording,
    pauseRecording,
    resumeRecording,
    cancelRecording,
    clearRecording,
  } = useAudioRecorder();

  const [isSending, setIsSending] = useState(false);
  const [previewPlaying, setPreviewPlaying] = useState(false);
  const audioPreviewRef = useRef<HTMLAudioElement | null>(null);

  // Start recording when component mounts
  useEffect(() => {
    startRecording();
    return () => {
      cancelRecording();
    };
  }, []);

  const handleSend = async () => {
    if (!audioBlob) return;

    setIsSending(true);
    try {
      await onSend(audioBlob, recordingTime);
    } catch (error) {
      console.error('❌ Erro ao enviar áudio:', error);
    } finally {
      setIsSending(false);
    }
  };

  const handleRerecord = () => {
    clearRecording();
    startRecording();
  };

  const togglePreviewPlayback = () => {
    if (!audioPreviewRef.current) return;

    if (previewPlaying) {
      audioPreviewRef.current.pause();
    } else {
      audioPreviewRef.current.play();
    }
  };

  // Handle audio preview events
  useEffect(() => {
    const audio = audioPreviewRef.current;
    if (!audio) return;

    const handlePlay = () => setPreviewPlaying(true);
    const handlePause = () => setPreviewPlaying(false);
    const handleEnded = () => setPreviewPlaying(false);

    audio.addEventListener('play', handlePlay);
    audio.addEventListener('pause', handlePause);
    audio.addEventListener('ended', handleEnded);

    return () => {
      audio.removeEventListener('play', handlePlay);
      audio.removeEventListener('pause', handlePause);
      audio.removeEventListener('ended', handleEnded);
    };
  }, [audioUrl]);

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

  // Recording state
  if (isRecording && !audioBlob) {
    return (
      <div className="flex items-center gap-3 p-3 bg-amber-50 rounded-lg border border-amber-300 animate-in fade-in slide-in-from-bottom-2">
        {/* Recording indicator */}
        <div className="relative flex-shrink-0">
          <div className={cn(
            "w-10 h-10 rounded-full bg-amber-500 flex items-center justify-center",
            !isPaused && "animate-pulse"
          )}>
            <Mic className="w-5 h-5 text-white" />
          </div>
          {!isPaused && (
            <div className="absolute inset-0 rounded-full bg-amber-500/50 animate-ping" />
          )}
        </div>

        {/* Timer */}
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2">
            <span className="font-mono text-lg font-semibold text-foreground">
              {formatTime(recordingTime)}
            </span>
            {isPaused && (
              <span className="text-xs text-muted-foreground">(pausado)</span>
            )}
          </div>
          <p className="text-xs text-amber-600">
            {isPaused ? 'Gravação pausada' : 'Gravando nota de voz...'}
          </p>
        </div>

        {/* Controls */}
        <div className="flex items-center gap-1 flex-shrink-0">
          {/* Pause/Resume */}
          <Tooltip>
            <TooltipTrigger asChild>
              <Button
                variant="ghost"
                size="icon"
                onClick={isPaused ? resumeRecording : pauseRecording}
                className="h-9 w-9"
              >
                {isPaused ? (
                  <Play className="w-4 h-4" />
                ) : (
                  <Pause className="w-4 h-4" />
                )}
              </Button>
            </TooltipTrigger>
            <TooltipContent>
              {isPaused ? 'Continuar' : 'Pausar'}
            </TooltipContent>
          </Tooltip>

          {/* Stop */}
          <Tooltip>
            <TooltipTrigger asChild>
              <Button
                variant="default"
                size="icon"
                onClick={stopRecording}
                className="h-9 w-9 bg-amber-500 hover:bg-amber-600"
              >
                <Square className="w-4 h-4" />
              </Button>
            </TooltipTrigger>
            <TooltipContent>Finalizar gravação</TooltipContent>
          </Tooltip>

          {/* Cancel */}
          <Tooltip>
            <TooltipTrigger asChild>
              <Button
                variant="ghost"
                size="icon"
                onClick={() => {
                  cancelRecording();
                  onCancel();
                }}
                className="h-9 w-9 text-muted-foreground hover:text-foreground"
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

  // Preview state (after recording finished)
  if (audioBlob && audioUrl) {
    return (
      <div className="flex items-center gap-3 p-3 bg-amber-50 rounded-lg border border-amber-300 animate-in fade-in slide-in-from-bottom-2">
        {/* Hidden audio element for preview */}
        <audio ref={audioPreviewRef} src={audioUrl} preload="metadata" />

        {/* Audio icon */}
        <div className="flex-shrink-0 w-10 h-10 rounded-full bg-amber-500/20 flex items-center justify-center">
          <Mic className="w-5 h-5 text-amber-600" />
        </div>

        {/* Info */}
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2">
            <span className="font-mono text-sm font-medium text-foreground">
              {formatTime(recordingTime)}
            </span>
            <span className="text-xs text-muted-foreground">
              ({formatBytes(audioBlob.size)})
            </span>
          </div>
          <p className="text-xs text-amber-600">
            Nota de voz pronta para envio
          </p>
        </div>

        {/* Controls */}
        <div className="flex items-center gap-1 flex-shrink-0">
          {/* Play preview */}
          <Tooltip>
            <TooltipTrigger asChild>
              <Button
                variant="ghost"
                size="icon"
                onClick={togglePreviewPlayback}
                className="h-9 w-9"
              >
                {previewPlaying ? (
                  <Pause className="w-4 h-4" />
                ) : (
                  <Play className="w-4 h-4" />
                )}
              </Button>
            </TooltipTrigger>
            <TooltipContent>
              {previewPlaying ? 'Pausar' : 'Ouvir'}
            </TooltipContent>
          </Tooltip>

          {/* Re-record */}
          <Tooltip>
            <TooltipTrigger asChild>
              <Button
                variant="ghost"
                size="icon"
                onClick={handleRerecord}
                className="h-9 w-9"
                disabled={isSending}
              >
                <RotateCcw className="w-4 h-4" />
              </Button>
            </TooltipTrigger>
            <TooltipContent>Regravar</TooltipContent>
          </Tooltip>

          {/* Send */}
          <Tooltip>
            <TooltipTrigger asChild>
              <Button
                variant="default"
                size="icon"
                onClick={handleSend}
                className="h-9 w-9 bg-amber-500 hover:bg-amber-600"
                disabled={isSending || disabled}
              >
                {isSending ? (
                  <Loader2 className="w-4 h-4 animate-spin" />
                ) : (
                  <Send className="w-4 h-4" />
                )}
              </Button>
            </TooltipTrigger>
            <TooltipContent>Enviar nota de voz</TooltipContent>
          </Tooltip>

          {/* Cancel */}
          <Tooltip>
            <TooltipTrigger asChild>
              <Button
                variant="ghost"
                size="icon"
                onClick={() => {
                  cancelRecording();
                  onCancel();
                }}
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

  // Loading state
  return (
    <div className="flex items-center gap-3 p-3 bg-amber-50 rounded-lg border border-amber-300">
      <Loader2 className="w-5 h-5 animate-spin text-amber-600" />
      <span className="text-sm text-amber-600">Iniciando gravação...</span>
    </div>
  );
}
