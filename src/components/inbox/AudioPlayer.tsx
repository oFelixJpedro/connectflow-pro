import { useState, useRef, useEffect, useCallback } from 'react';
import { Play, Pause, Mic, Download, AlertCircle, Loader2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Slider } from '@/components/ui/slider';
import { cn } from '@/lib/utils';

interface AudioPlayerProps {
  src: string;
  mimeType?: string;
  duration?: number;
  isOutbound?: boolean;
  status?: string;
  errorMessage?: string;
}

function formatTime(seconds: number): string {
  if (!isFinite(seconds) || seconds < 0) return '0:00';
  const mins = Math.floor(seconds / 60);
  const secs = Math.floor(seconds % 60);
  return `${mins}:${secs.toString().padStart(2, '0')}`;
}

export function AudioPlayer({
  src,
  mimeType,
  duration: initialDuration = 0,
  isOutbound = false,
  status,
  errorMessage,
}: AudioPlayerProps) {
  const audioRef = useRef<HTMLAudioElement>(null);
  const [isPlaying, setIsPlaying] = useState(false);
  const [currentTime, setCurrentTime] = useState(0);
  const [duration, setDuration] = useState(initialDuration);
  const [isLoading, setIsLoading] = useState(true);
  const [hasError, setHasError] = useState(false);
  const [playbackRate, setPlaybackRate] = useState(1);

  const togglePlayback = useCallback(() => {
    const audio = audioRef.current;
    if (!audio) return;

    if (isPlaying) {
      audio.pause();
    } else {
      audio.play().catch((e) => {
        console.error('Error playing audio:', e);
        setHasError(true);
      });
    }
  }, [isPlaying]);

  const handleSeek = useCallback((value: number[]) => {
    const audio = audioRef.current;
    if (!audio) return;
    
    const newTime = value[0];
    audio.currentTime = newTime;
    setCurrentTime(newTime);
  }, []);

  const cyclePlaybackRate = useCallback(() => {
    const rates = [1, 1.5, 2];
    const currentIndex = rates.indexOf(playbackRate);
    const nextIndex = (currentIndex + 1) % rates.length;
    const newRate = rates[nextIndex];
    
    setPlaybackRate(newRate);
    if (audioRef.current) {
      audioRef.current.playbackRate = newRate;
    }
  }, [playbackRate]);

  const handleDownload = useCallback(() => {
    const link = document.createElement('a');
    link.href = src;
    link.download = `audio_${Date.now()}.${mimeType?.split('/')[1] || 'ogg'}`;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  }, [src, mimeType]);

  useEffect(() => {
    const audio = audioRef.current;
    if (!audio) return;

    const handleLoadedMetadata = () => {
      setDuration(audio.duration);
      setIsLoading(false);
    };

    const handleTimeUpdate = () => {
      setCurrentTime(audio.currentTime);
    };

    const handlePlay = () => setIsPlaying(true);
    const handlePause = () => setIsPlaying(false);
    const handleEnded = () => {
      setIsPlaying(false);
      setCurrentTime(0);
    };

    const handleError = () => {
      setHasError(true);
      setIsLoading(false);
    };

    const handleCanPlay = () => {
      setIsLoading(false);
    };

    audio.addEventListener('loadedmetadata', handleLoadedMetadata);
    audio.addEventListener('timeupdate', handleTimeUpdate);
    audio.addEventListener('play', handlePlay);
    audio.addEventListener('pause', handlePause);
    audio.addEventListener('ended', handleEnded);
    audio.addEventListener('error', handleError);
    audio.addEventListener('canplay', handleCanPlay);

    return () => {
      audio.removeEventListener('loadedmetadata', handleLoadedMetadata);
      audio.removeEventListener('timeupdate', handleTimeUpdate);
      audio.removeEventListener('play', handlePlay);
      audio.removeEventListener('pause', handlePause);
      audio.removeEventListener('ended', handleEnded);
      audio.removeEventListener('error', handleError);
      audio.removeEventListener('canplay', handleCanPlay);
    };
  }, []);

  // If message failed to process
  if (status === 'failed' || hasError) {
    return (
      <div className={cn(
        "flex items-center gap-2 p-3 rounded-xl min-w-[200px] max-w-[280px]",
        isOutbound ? "bg-destructive/20" : "bg-destructive/10"
      )}>
        <AlertCircle className="w-5 h-5 text-destructive flex-shrink-0" />
        <div className="flex-1 min-w-0">
          <p className="text-xs text-destructive font-medium">
            Falha ao carregar áudio
          </p>
          {errorMessage && (
            <p className="text-xs text-destructive/70 truncate">
              {errorMessage}
            </p>
          )}
        </div>
        {src && (
          <Button
            variant="ghost"
            size="icon"
            className="h-8 w-8 flex-shrink-0"
            onClick={handleDownload}
            title="Baixar áudio"
          >
            <Download className="w-4 h-4" />
          </Button>
        )}
      </div>
    );
  }

  return (
    <div className={cn(
      "flex items-center gap-2 p-3 rounded-xl min-w-[220px] max-w-[300px]",
      isOutbound 
        ? "bg-primary/20 text-primary-foreground" 
        : "bg-muted/80"
    )}>
      {/* Hidden audio element */}
      <audio ref={audioRef} src={src} preload="metadata" />

      {/* Mic icon */}
      <div className={cn(
        "flex-shrink-0 w-8 h-8 rounded-full flex items-center justify-center",
        isOutbound ? "bg-primary/30" : "bg-muted"
      )}>
        <Mic className={cn(
          "w-4 h-4",
          isOutbound ? "text-primary-foreground/70" : "text-muted-foreground"
        )} />
      </div>

      {/* Play/Pause button */}
      <Button
        variant="ghost"
        size="icon"
        className={cn(
          "h-10 w-10 rounded-full flex-shrink-0",
          isOutbound 
            ? "hover:bg-primary/30 text-primary-foreground" 
            : "hover:bg-muted"
        )}
        onClick={togglePlayback}
        disabled={isLoading}
      >
        {isLoading ? (
          <Loader2 className="w-5 h-5 animate-spin" />
        ) : isPlaying ? (
          <Pause className="w-5 h-5" />
        ) : (
          <Play className="w-5 h-5 ml-0.5" />
        )}
      </Button>

      {/* Progress area */}
      <div className="flex-1 min-w-0 flex flex-col gap-1">
        {/* Slider */}
        <Slider
          value={[currentTime]}
          min={0}
          max={duration || 100}
          step={0.1}
          onValueChange={handleSeek}
          className={cn(
            "w-full cursor-pointer",
            isOutbound && "[&_[role=slider]]:bg-primary-foreground"
          )}
        />
        
        {/* Time display */}
        <div className="flex items-center justify-between">
          <span className={cn(
            "text-xs",
            isOutbound ? "text-primary-foreground/70" : "text-muted-foreground"
          )}>
            {formatTime(currentTime)}
          </span>
          <span className={cn(
            "text-xs",
            isOutbound ? "text-primary-foreground/70" : "text-muted-foreground"
          )}>
            {formatTime(duration)}
          </span>
        </div>
      </div>

      {/* Playback rate button */}
      <Button
        variant="ghost"
        size="sm"
        className={cn(
          "h-6 px-1.5 text-xs font-medium flex-shrink-0",
          isOutbound 
            ? "hover:bg-primary/30 text-primary-foreground/70" 
            : "hover:bg-muted text-muted-foreground"
        )}
        onClick={cyclePlaybackRate}
      >
        {playbackRate}x
      </Button>
    </div>
  );
}