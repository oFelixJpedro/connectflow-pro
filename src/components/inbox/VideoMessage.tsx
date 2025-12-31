import { useState, useRef } from 'react';
import { cn } from '@/lib/utils';
import { Download, VideoOff, AlertCircle, Clock, CheckCheck, Loader2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { LinkifyText } from '@/components/ui/linkify-text';
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from '@/components/ui/tooltip';

// Status indicator component for video messages (outbound)
function VideoStatusIndicator({ status, isOutbound }: { status?: string; isOutbound?: boolean }) {
  if (!isOutbound || !status) return null;
  
  const statusConfig: Record<string, { icon: React.ReactNode; label: string; className: string }> = {
    pending: {
      icon: <Clock className="w-3 h-3 animate-pulse" />,
      label: 'Enviando...',
      className: 'text-amber-500',
    },
    sent: {
      icon: <CheckCheck className="w-3 h-3" />,
      label: 'Enviado',
      className: 'text-muted-foreground',
    },
    delivered: {
      icon: <CheckCheck className="w-3 h-3" />,
      label: 'Entregue',
      className: 'text-muted-foreground',
    },
    read: {
      icon: <CheckCheck className="w-3 h-3" />,
      label: 'Lido',
      className: 'text-blue-500',
    },
    failed: {
      icon: <AlertCircle className="w-3 h-3" />,
      label: 'Falha no envio',
      className: 'text-destructive',
    },
  };

  const config = statusConfig[status];
  if (!config) return null;

  return (
    <Tooltip>
      <TooltipTrigger asChild>
        <div className={cn("absolute bottom-14 right-2 z-10 flex items-center gap-1 px-1.5 py-0.5 rounded-full bg-black/50 backdrop-blur-sm", config.className)}>
          {config.icon}
          {status === 'pending' && <span className="text-[10px] font-medium text-white">Enviando</span>}
          {status === 'failed' && <span className="text-[10px] font-medium text-white">Falhou</span>}
        </div>
      </TooltipTrigger>
      <TooltipContent side="top">
        <p>{config.label}</p>
      </TooltipContent>
    </Tooltip>
  );
}

// Loading indicator for inbound video (processing)
function InboundVideoLoading() {
  return (
    <div 
      className="flex flex-col items-center justify-center gap-3 p-8 rounded-xl bg-muted/60 animate-pulse"
      style={{ aspectRatio: '16/9', minWidth: '200px', maxWidth: '400px' }}
    >
      <div className="w-14 h-14 rounded-full bg-primary/20 flex items-center justify-center">
        <Loader2 className="w-7 h-7 text-primary animate-spin" />
      </div>
      <div className="text-center">
        <p className="text-xs text-muted-foreground font-medium">Carregando vídeo...</p>
        <p className="text-[10px] text-muted-foreground/70 mt-0.5">Aguarde um momento</p>
      </div>
    </div>
  );
}

interface VideoMessageProps {
  src: string;
  isOutbound: boolean;
  width?: number;
  height?: number;
  duration?: number;
  fileSize?: number;
  status?: string;
  errorMessage?: string;
  caption?: string | null;
}

function formatFileSize(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

function formatDuration(seconds: number): string {
  const mins = Math.floor(seconds / 60);
  const secs = seconds % 60;
  return `${mins}:${secs.toString().padStart(2, '0')}`;
}

export function VideoMessage({
  src,
  isOutbound,
  width,
  height,
  duration,
  fileSize,
  status,
  errorMessage,
  caption,
}: VideoMessageProps) {
  const [isLoading, setIsLoading] = useState(true);
  const [hasError, setHasError] = useState(false);
  const videoRef = useRef<HTMLVideoElement>(null);

  const handleLoadedMetadata = () => {
    setIsLoading(false);
    setHasError(false);
  };

  const handleError = () => {
    setIsLoading(false);
    setHasError(true);
  };

  const handleDownload = () => {
    window.open(src, '_blank', 'noopener,noreferrer');
  };

  const isFailed = status === 'failed';

  // Inbound media loading state (waiting for media processing)
  const isInboundLoading = !isOutbound && !src && status !== 'failed';
  if (isInboundLoading) {
    return <InboundVideoLoading />;
  }

  return (
    <div className="relative group">
      <div
        className={cn(
          'overflow-hidden relative',
          'max-w-[400px] min-w-[200px]',
          caption ? '' : 'rounded-xl'
        )}
      >
        {/* Loading skeleton */}
        {isLoading && !hasError && !isFailed && (
          <div 
            className="absolute inset-0 bg-muted/80 animate-shimmer flex items-center justify-center z-10"
            style={{
              aspectRatio: width && height ? `${width}/${height}` : '16/9',
            }}
          >
            <div className="flex flex-col items-center gap-2 text-muted-foreground">
              <div className="w-12 h-12 rounded-full bg-muted-foreground/20 flex items-center justify-center">
                <div className="w-0 h-0 border-l-[12px] border-l-muted-foreground border-t-[8px] border-t-transparent border-b-[8px] border-b-transparent ml-1" />
              </div>
              <span className="text-xs">Carregando vídeo...</span>
            </div>
          </div>
        )}

        {/* Error state */}
        {(hasError || isFailed) && (
          <div 
            className={cn(
              "flex flex-col items-center justify-center gap-2 p-6",
              "bg-muted/80 text-muted-foreground"
            )}
            style={{
              aspectRatio: '16/9',
              minHeight: '150px',
            }}
          >
            {isFailed ? (
              <AlertCircle className="w-8 h-8 text-destructive" />
            ) : (
              <VideoOff className="w-8 h-8" />
            )}
            <span className="text-xs text-center">
              {isFailed ? (errorMessage || 'Falha ao carregar vídeo') : 'Vídeo indisponível'}
            </span>
          </div>
        )}

        {/* Video player */}
        {!isFailed && (
          <video
            ref={videoRef}
            src={src}
            controls
            preload="metadata"
            className={cn(
              'w-full max-h-[500px] object-contain bg-black/90',
              (isLoading || hasError) && 'opacity-0 absolute',
              caption ? 'rounded-t-xl' : 'rounded-xl'
            )}
            style={{
              aspectRatio: width && height ? `${width}/${height}` : undefined,
            }}
            onLoadedMetadata={handleLoadedMetadata}
            onError={handleError}
          />
        )}

        {/* Video info overlay */}
        {!isLoading && !hasError && !isFailed && (duration || fileSize) && (
          <div className="absolute bottom-12 left-2 flex items-center gap-2 text-[10px] text-white/80 bg-black/40 px-1.5 py-0.5 rounded pointer-events-none">
            {duration && <span>{formatDuration(duration)}</span>}
            {duration && fileSize && <span>•</span>}
            {fileSize && <span>{formatFileSize(fileSize)}</span>}
          </div>
        )}

        {/* Download button */}
        {!isLoading && !hasError && !isFailed && (
          <Button
            variant="ghost"
            size="icon"
            onClick={handleDownload}
            className={cn(
              "absolute top-2 right-2 h-8 w-8 rounded-full",
              "bg-black/40 hover:bg-black/60 text-white",
              "opacity-0 group-hover:opacity-100 transition-opacity"
            )}
            title="Baixar vídeo"
          >
            <Download className="w-3.5 h-3.5" />
          </Button>
        )}

        {/* Status indicator */}
        <VideoStatusIndicator status={status} isOutbound={isOutbound} />

        {/* Caption */}
        {caption && (
          <div 
            className={cn(
              "px-4 py-3 rounded-b-xl text-sm leading-relaxed",
              isOutbound 
                ? "bg-primary/10 dark:bg-primary/20 text-foreground"
                : "bg-muted text-foreground"
            )}
          >
            <LinkifyText text={caption} />
          </div>
        )}
      </div>
    </div>
  );
}
