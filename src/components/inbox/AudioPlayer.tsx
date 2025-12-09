import { useState, useRef, useEffect, useCallback } from 'react';
import { Play, Pause, Mic, Download, AlertCircle, Loader2 } from 'lucide-react';
import { cn } from '@/lib/utils';

interface AudioPlayerProps {
  src: string;
  mimeType?: string;
  duration?: number;
  isOutbound?: boolean;
  status?: string;
  errorMessage?: string;
  metadata?: {
    fileName?: string;
    fileSize?: number;
    isPTT?: boolean;
  };
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
  metadata,
}: AudioPlayerProps) {
  const audioRef = useRef<HTMLAudioElement>(null);
  const progressRef = useRef<HTMLDivElement>(null);
  const [isPlaying, setIsPlaying] = useState(false);
  const [currentTime, setCurrentTime] = useState(0);
  const [duration, setDuration] = useState(initialDuration);
  const [isLoading, setIsLoading] = useState(true);
  const [hasError, setHasError] = useState(false);
  const [isDragging, setIsDragging] = useState(false);

  const progress = duration > 0 ? (currentTime / duration) * 100 : 0;

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

  const handleProgressClick = useCallback((e: React.MouseEvent<HTMLDivElement>) => {
    const audio = audioRef.current;
    const progressBar = progressRef.current;
    if (!audio || !progressBar) return;

    const rect = progressBar.getBoundingClientRect();
    const clickX = e.clientX - rect.left;
    const percentage = Math.max(0, Math.min(1, clickX / rect.width));
    const newTime = percentage * duration;
    
    audio.currentTime = newTime;
    setCurrentTime(newTime);
  }, [duration]);

  const handleKeyDown = useCallback((e: React.KeyboardEvent) => {
    const audio = audioRef.current;
    if (!audio) return;

    switch (e.key) {
      case ' ':
        e.preventDefault();
        togglePlayback();
        break;
      case 'ArrowLeft':
        e.preventDefault();
        audio.currentTime = Math.max(0, audio.currentTime - 5);
        break;
      case 'ArrowRight':
        e.preventDefault();
        audio.currentTime = Math.min(duration, audio.currentTime + 5);
        break;
    }
  }, [togglePlayback, duration]);

  const handleDownload = useCallback(() => {
    const link = document.createElement('a');
    link.href = src;
    link.download = metadata?.fileName || `audio_${Date.now()}.${mimeType?.split('/')[1] || 'ogg'}`;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  }, [src, mimeType, metadata]);

  useEffect(() => {
    const audio = audioRef.current;
    if (!audio) return;

    const handleLoadedMetadata = () => {
      setDuration(audio.duration || initialDuration);
      setIsLoading(false);
    };

    const handleTimeUpdate = () => {
      if (!isDragging) {
        setCurrentTime(audio.currentTime);
      }
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
  }, [initialDuration, isDragging]);

  // Error state
  if (status === 'failed' || hasError) {
    return (
      <div className={cn(
        "flex items-center gap-3 p-3 rounded-2xl min-w-[200px] max-w-[320px] shadow-sm",
        isOutbound 
          ? "bg-gradient-to-br from-red-100 to-red-200" 
          : "bg-gradient-to-br from-red-50 to-red-100"
      )}>
        <div className="flex-shrink-0 w-9 h-9 rounded-full bg-red-500/15 flex items-center justify-center">
          <AlertCircle className="w-5 h-5 text-red-500" />
        </div>
        <div className="flex-1 min-w-0">
          <p className="text-xs text-red-600 font-medium">
            Falha ao carregar áudio
          </p>
          {errorMessage && (
            <p className="text-[10px] text-red-500/70 truncate mt-0.5">
              {errorMessage}
            </p>
          )}
        </div>
        {src && (
          <button
            onClick={handleDownload}
            className="flex-shrink-0 w-8 h-8 rounded-full hover:bg-red-500/10 flex items-center justify-center transition-colors"
            aria-label="Baixar áudio"
          >
            <Download className="w-4 h-4 text-red-500" />
          </button>
        )}
      </div>
    );
  }

  // Loading skeleton
  if (isLoading) {
    return (
      <div className={cn(
        "flex items-center gap-3 p-3 rounded-2xl min-w-[220px] max-w-[320px] shadow-sm",
        isOutbound 
          ? "bg-gradient-to-br from-green-100 to-green-200" 
          : "bg-gradient-to-br from-gray-100 to-gray-200"
      )}>
        <audio ref={audioRef} src={src} preload="metadata" />
        
        {/* Mic icon skeleton */}
        <div className="flex-shrink-0 w-9 h-9 sm:w-9 sm:h-9 rounded-full bg-blue-500/15 flex items-center justify-center">
          <Mic className="w-5 h-5 text-blue-500" />
        </div>
        
        {/* Play button skeleton */}
        <div className="flex-shrink-0 w-8 h-8 sm:w-8 sm:h-8 rounded-full bg-gray-300/50 animate-pulse" />
        
        {/* Progress skeleton */}
        <div className="flex-1 flex items-center gap-3">
          <div className="flex-1 h-1 bg-gray-300/50 rounded-full animate-pulse" />
          <div className="w-8 h-3 bg-gray-300/50 rounded animate-pulse" />
        </div>
      </div>
    );
  }

  return (
    <div
      className={cn(
        "flex items-center gap-3 p-3 pr-4 rounded-2xl min-w-[220px] max-w-[320px] shadow-sm",
        "transition-all duration-200 hover:scale-[1.02] hover:shadow-md",
        "focus-within:ring-2 focus-within:ring-blue-500/50 focus-within:ring-offset-1",
        isOutbound 
          ? "bg-gradient-to-br from-green-100 to-green-200 hover:from-green-150 hover:to-green-250" 
          : "bg-gradient-to-br from-gray-100 to-gray-200 hover:from-gray-150 hover:to-gray-250"
      )}
      onKeyDown={handleKeyDown}
      tabIndex={0}
      role="region"
      aria-label="Player de áudio"
    >
      {/* Hidden audio element */}
      <audio ref={audioRef} src={src} preload="metadata" />

      {/* Mic icon with pulse when playing */}
      <div className={cn(
        "flex-shrink-0 w-9 h-9 rounded-full bg-blue-500/15 flex items-center justify-center transition-transform",
        isPlaying && "animate-pulse"
      )}>
        <Mic className="w-5 h-5 text-blue-500" />
      </div>

      {/* Play/Pause button */}
      <button
        onClick={togglePlayback}
        disabled={isLoading}
        className={cn(
          "flex-shrink-0 w-8 h-8 rounded-full flex items-center justify-center",
          "bg-blue-500 hover:bg-blue-600 active:bg-blue-700",
          "text-white shadow-md hover:shadow-lg",
          "transition-all duration-200 hover:scale-110 active:scale-95",
          "focus:outline-none focus:ring-2 focus:ring-blue-500/50 focus:ring-offset-1",
          "disabled:opacity-50 disabled:cursor-not-allowed"
        )}
        aria-label={isPlaying ? "Pausar" : "Reproduzir"}
      >
        {isPlaying ? (
          <Pause className="w-4 h-4" />
        ) : (
          <Play className="w-4 h-4 ml-0.5" />
        )}
      </button>

      {/* Progress bar */}
      <div className="flex-1 flex items-center gap-3 min-w-0">
        <div
          ref={progressRef}
          onClick={handleProgressClick}
          className="flex-1 h-1 bg-black/10 rounded-full cursor-pointer relative group"
          role="slider"
          aria-valuenow={currentTime}
          aria-valuemin={0}
          aria-valuemax={duration}
          aria-label="Progresso do áudio"
        >
          {/* Progress fill */}
          <div 
            className="absolute inset-y-0 left-0 bg-blue-500 rounded-full transition-all duration-100"
            style={{ width: `${progress}%` }}
          />
          
          {/* Draggable handle (visible on hover) */}
          <div 
            className={cn(
              "absolute top-1/2 -translate-y-1/2 w-3 h-3 bg-blue-500 rounded-full shadow-md",
              "opacity-0 group-hover:opacity-100 transition-opacity",
              "pointer-events-none"
            )}
            style={{ left: `calc(${progress}% - 6px)` }}
          />
        </div>

        {/* Duration display */}
        <span className="flex-shrink-0 text-xs font-medium text-gray-500 min-w-[32px] text-right tabular-nums">
          {isPlaying ? formatTime(currentTime) : formatTime(duration)}
        </span>
      </div>

      {/* Download button (optional) */}
      <button
        onClick={handleDownload}
        className={cn(
          "flex-shrink-0 w-6 h-6 rounded-full flex items-center justify-center",
          "text-gray-400 hover:text-gray-600 hover:bg-black/5",
          "transition-colors opacity-0 group-hover:opacity-100",
          "focus:outline-none focus:opacity-100"
        )}
        aria-label="Baixar áudio"
      >
        <Download className="w-3.5 h-3.5" />
      </button>
    </div>
  );
}
