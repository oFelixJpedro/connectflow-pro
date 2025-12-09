import { useState, useRef, useEffect, useCallback } from 'react';
import { Play, Pause, Mic, Download, AlertCircle } from 'lucide-react';
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

function formatSpeed(speed: number): string {
  return speed.toFixed(1).replace('.', ',') + '×';
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
  const [playbackSpeed, setPlaybackSpeed] = useState(1.0);

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

  const cycleSpeed = useCallback(() => {
    setPlaybackSpeed(prev => {
      if (prev === 1.0) return 1.5;
      if (prev === 1.5) return 2.0;
      return 1.0;
    });
  }, []);

  // Sync playback speed with audio element
  useEffect(() => {
    if (audioRef.current) {
      audioRef.current.playbackRate = playbackSpeed;
    }
  }, [playbackSpeed]);

  const calculateTimeFromEvent = useCallback((e: React.MouseEvent<HTMLDivElement> | MouseEvent) => {
    const progressBar = progressRef.current;
    if (!progressBar || !duration) return null;

    const rect = progressBar.getBoundingClientRect();
    const clickX = e.clientX - rect.left;
    const percentage = Math.max(0, Math.min(1, clickX / rect.width));
    return percentage * duration;
  }, [duration]);

  const handleProgressClick = useCallback((e: React.MouseEvent<HTMLDivElement>) => {
    const audio = audioRef.current;
    if (!audio) return;

    const newTime = calculateTimeFromEvent(e);
    if (newTime !== null) {
      audio.currentTime = newTime;
      setCurrentTime(newTime);
    }
  }, [calculateTimeFromEvent]);

  const handleMouseDown = useCallback((e: React.MouseEvent<HTMLDivElement>) => {
    e.preventDefault();
    setIsDragging(true);
    handleProgressClick(e);

    const handleMouseMove = (moveEvent: MouseEvent) => {
      const audio = audioRef.current;
      if (!audio) return;

      const newTime = calculateTimeFromEvent(moveEvent);
      if (newTime !== null) {
        audio.currentTime = newTime;
        setCurrentTime(newTime);
      }
    };

    const handleMouseUp = () => {
      setIsDragging(false);
      document.removeEventListener('mousemove', handleMouseMove);
      document.removeEventListener('mouseup', handleMouseUp);
    };

    document.addEventListener('mousemove', handleMouseMove);
    document.addEventListener('mouseup', handleMouseUp);
  }, [calculateTimeFromEvent, handleProgressClick]);

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

  const handleSpeedKeyDown = useCallback((e: React.KeyboardEvent) => {
    if (e.key === 'Enter' || e.key === ' ') {
      e.preventDefault();
      e.stopPropagation();
      cycleSpeed();
    }
  }, [cycleSpeed]);

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
        "flex items-center gap-3 py-3 px-4 rounded-xl w-[336px] max-w-full shadow-sm",
        isOutbound 
          ? "bg-gradient-to-br from-red-100 to-red-200" 
          : "bg-red-50"
      )}>
        <div className="flex-shrink-0 w-8 h-8 rounded-full bg-red-500/15 flex items-center justify-center">
          <AlertCircle className="w-4 h-4 text-red-500" />
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
        "flex items-center gap-3 py-3 px-4 rounded-xl w-[336px] max-w-full shadow-sm",
        isOutbound 
          ? "bg-gradient-to-br from-blue-100 to-blue-200" 
          : "bg-slate-100"
      )}>
        <audio ref={audioRef} src={src} preload="metadata" />
        
        {/* Mic icon skeleton */}
        <div className="flex-shrink-0 w-8 h-8 rounded-full bg-blue-500/20 flex items-center justify-center">
          <Mic className="w-4 h-4 text-blue-500" />
        </div>
        
        {/* Play button skeleton */}
        <div className="flex-shrink-0 w-8 h-8 rounded-full bg-gray-300/50 animate-pulse" />
        
        {/* Progress skeleton */}
        <div className="flex-1 flex items-center gap-3">
          <div className="flex-1 h-1 bg-gray-300/50 rounded-full animate-pulse" />
          <div className="w-10 h-3 bg-gray-300/50 rounded animate-pulse" />
        </div>
      </div>
    );
  }

  return (
    <div
      className={cn(
        "flex items-center gap-3 py-3 px-4 rounded-xl w-[336px] max-w-full shadow-sm",
        "transition-all duration-200 hover:shadow-md",
        "focus-within:ring-2 focus-within:ring-blue-500/50 focus-within:ring-offset-1",
        isOutbound 
          ? "bg-gradient-to-br from-blue-100 to-blue-200" 
          : "bg-slate-100"
      )}
      onKeyDown={handleKeyDown}
      tabIndex={0}
      role="region"
      aria-label="Player de áudio"
    >
      {/* Hidden audio element */}
      <audio ref={audioRef} src={src} preload="metadata" />

      {/* Dynamic: Mic icon (paused) OR Speed control (playing) */}
      <div className="flex-shrink-0 w-[42px] h-8 flex items-center justify-center">
        {isPlaying ? (
          // Speed control button
          <button
            onClick={(e) => {
              e.stopPropagation();
              cycleSpeed();
            }}
            onKeyDown={handleSpeedKeyDown}
            className={cn(
              "w-[42px] h-8 rounded-lg bg-blue-500/15 flex items-center justify-center",
              "cursor-pointer select-none",
              "hover:bg-blue-500/25 hover:scale-105",
              "active:scale-95",
              "transition-all duration-150",
              "focus:outline-none focus:ring-2 focus:ring-blue-500/50"
            )}
            aria-label={`Velocidade de reprodução: ${formatSpeed(playbackSpeed)}`}
            title="Alterar velocidade"
          >
            <span className="text-xs font-semibold text-blue-500 tabular-nums">
              {formatSpeed(playbackSpeed)}
            </span>
          </button>
        ) : (
          // Mic icon
          <div className={cn(
            "w-8 h-8 rounded-full bg-blue-500/20 flex items-center justify-center",
            "transition-all duration-150"
          )}>
            <Mic className="w-4 h-4 text-blue-500" />
          </div>
        )}
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

      {/* Progress bar - larger clickable area */}
      <div className="flex-1 flex items-center gap-3 min-w-0">
        <div
          ref={progressRef}
          onClick={handleProgressClick}
          onMouseDown={handleMouseDown}
          className={cn(
            "flex-1 py-2 cursor-pointer relative group",
            isDragging && "cursor-grabbing"
          )}
          role="slider"
          aria-valuenow={currentTime}
          aria-valuemin={0}
          aria-valuemax={duration}
          aria-label="Progresso do áudio"
        >
          {/* Track background */}
          <div className={cn(
            "h-1 bg-black/10 rounded-full relative overflow-visible",
            "group-hover:h-1.5 transition-all duration-150"
          )}>
            {/* Progress fill */}
            <div 
              className={cn(
                "absolute inset-y-0 left-0 bg-blue-500 rounded-full",
                !isDragging && "transition-all duration-100"
              )}
              style={{ width: `${progress}%` }}
            />
          </div>
          
          {/* Draggable handle */}
          <div 
            className={cn(
              "absolute top-1/2 -translate-y-1/2 w-3.5 h-3.5 bg-blue-500 rounded-full shadow-md",
              "opacity-0 group-hover:opacity-100 transition-opacity duration-150",
              isDragging && "opacity-100 scale-110",
              "pointer-events-none border-2 border-white"
            )}
            style={{ left: `calc(${progress}% - 7px)` }}
          />
        </div>

        {/* Duration display */}
        <span className="flex-shrink-0 text-xs font-medium text-gray-500 min-w-[40px] text-right tabular-nums">
          {isPlaying ? formatTime(currentTime) : formatTime(duration)}
        </span>
      </div>
    </div>
  );
}
