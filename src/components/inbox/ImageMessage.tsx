import { useState, useCallback } from 'react';
import { X, Download, ImageOff, Loader2, ZoomIn } from 'lucide-react';
import { cn } from '@/lib/utils';
import { Button } from '@/components/ui/button';
import {
  Dialog,
  DialogContent,
  DialogClose,
} from '@/components/ui/dialog';

interface ImageMessageProps {
  src: string;
  alt?: string;
  isOutbound?: boolean;
  width?: number;
  height?: number;
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

export function ImageMessage({
  src,
  alt = 'Imagem do WhatsApp',
  isOutbound = false,
  width,
  height,
  fileSize,
  status,
  errorMessage,
  caption,
}: ImageMessageProps) {
  const [isLoading, setIsLoading] = useState(true);
  const [hasError, setHasError] = useState(false);
  const [isLightboxOpen, setIsLightboxOpen] = useState(false);

  const handleLoad = useCallback(() => {
    setIsLoading(false);
    setHasError(false);
  }, []);

  const handleError = useCallback(() => {
    setIsLoading(false);
    setHasError(true);
  }, []);

  const handleDownload = useCallback(() => {
    window.open(src, '_blank', 'noopener,noreferrer');
  }, [src]);

  const handleKeyDown = useCallback((e: React.KeyboardEvent) => {
    if (e.key === 'Enter' || e.key === ' ') {
      e.preventDefault();
      setIsLightboxOpen(true);
    }
  }, []);

  // Failed state
  if (status === 'failed' || (!src && !isLoading)) {
    return (
      <div 
        className={cn(
          "flex flex-col items-center justify-center gap-2 p-6 rounded-xl",
          "w-full max-w-[300px] md:max-w-[300px] min-h-[120px]",
          isOutbound 
            ? "bg-gradient-to-br from-blue-100 to-blue-50" 
            : "bg-slate-100"
        )}
      >
        <ImageOff className="w-8 h-8 text-muted-foreground" />
        <span className="text-xs text-muted-foreground text-center">
          {errorMessage || 'Imagem indisponível'}
        </span>
      </div>
    );
  }

  return (
    <>
      <div 
        className={cn(
          "relative rounded-xl overflow-hidden cursor-pointer group",
          "w-full max-w-[300px] md:max-w-[300px]",
          "transition-transform duration-200 hover:scale-[1.02]",
          isOutbound 
            ? "bg-gradient-to-br from-blue-100 to-blue-50" 
            : "bg-slate-100"
        )}
        onClick={() => !isLoading && !hasError && setIsLightboxOpen(true)}
        onKeyDown={handleKeyDown}
        role="button"
        tabIndex={0}
        aria-label={`${alt}. Clique para ampliar.`}
      >
        {/* Loading skeleton */}
        {isLoading && (
          <div 
            className="absolute inset-0 flex items-center justify-center bg-slate-200/80"
            style={{ aspectRatio: width && height ? `${width}/${height}` : '16/9' }}
          >
            <div className="animate-shimmer w-full h-full bg-gradient-to-r from-slate-200 via-slate-100 to-slate-200 bg-[length:200%_100%]" />
            <div className="absolute inset-0 flex items-center justify-center">
              <Loader2 className="w-6 h-6 animate-spin text-muted-foreground" />
            </div>
          </div>
        )}

        {/* Error state */}
        {hasError && (
          <div 
            className="flex flex-col items-center justify-center gap-2 p-6 min-h-[120px]"
          >
            <ImageOff className="w-8 h-8 text-muted-foreground" />
            <span className="text-xs text-muted-foreground">Imagem indisponível</span>
          </div>
        )}

        {/* Image */}
        {!hasError && (
          <img
            src={src}
            alt={alt}
            loading="lazy"
            onLoad={handleLoad}
            onError={handleError}
            className={cn(
              "w-full h-auto object-cover max-h-[400px]",
              "transition-opacity duration-200",
              isLoading ? "opacity-0" : "opacity-100"
            )}
            style={{ 
              aspectRatio: width && height ? `${width}/${height}` : undefined,
              minHeight: isLoading ? '120px' : undefined
            }}
          />
        )}

        {/* Hover overlay */}
        {!isLoading && !hasError && (
          <div className={cn(
            "absolute inset-0 bg-black/0 group-hover:bg-black/20",
            "flex items-center justify-center opacity-0 group-hover:opacity-100",
            "transition-all duration-200"
          )}>
            <div className="bg-white/90 backdrop-blur-sm rounded-full p-2 shadow-lg">
              <ZoomIn className="w-5 h-5 text-slate-700" />
            </div>
          </div>
        )}

      {/* Download button */}
        {!isLoading && !hasError && (
          <Button
            variant="ghost"
            size="icon"
            onClick={(e) => {
              e.stopPropagation();
              handleDownload();
            }}
            className={cn(
              "absolute top-2 right-2 h-7 w-7 rounded-full",
              "bg-black/30 hover:bg-black/50 text-white",
              "opacity-0 group-hover:opacity-100 transition-opacity"
            )}
            aria-label="Baixar imagem"
          >
            <Download className="w-3.5 h-3.5" />
          </Button>
        )}

        {/* Caption */}
        {caption && (
          <div 
            className={cn(
              "px-3 py-2 text-sm leading-relaxed",
              "whitespace-pre-wrap break-words",
              isOutbound ? "text-foreground" : "text-foreground"
            )}
          >
            {caption}
          </div>
        )}
      </div>

      {/* Image info */}
      {!isLoading && !hasError && (width || height || fileSize) && (
        <div className="flex items-center gap-2 mt-1 opacity-70">
          {width && height && (
            <span className="text-[10px] text-muted-foreground">
              {width}×{height}
            </span>
          )}
          {fileSize && (
            <span className="text-[10px] text-muted-foreground">
              {formatFileSize(fileSize)}
            </span>
          )}
        </div>
      )}

      {/* Lightbox */}
      <Dialog open={isLightboxOpen} onOpenChange={setIsLightboxOpen}>
        <DialogContent 
          className="max-w-[95vw] max-h-[95vh] p-0 bg-black/95 border-none"
          onPointerDownOutside={() => setIsLightboxOpen(false)}
        >
          <DialogClose className="absolute top-4 right-4 z-50">
            <Button
              variant="ghost"
              size="icon"
              className="h-10 w-10 rounded-full bg-white/10 hover:bg-white/20 text-white"
            >
              <X className="w-5 h-5" />
            </Button>
          </DialogClose>

          {/* Download button in lightbox */}
          <Button
            variant="ghost"
            size="icon"
            onClick={handleDownload}
            className="absolute top-4 right-16 z-50 h-10 w-10 rounded-full bg-white/10 hover:bg-white/20 text-white"
            aria-label="Baixar imagem"
          >
            <Download className="w-5 h-5" />
          </Button>

          <div className="flex items-center justify-center w-full h-full min-h-[50vh] p-4">
            <img
              src={src}
              alt={alt}
              className="max-w-full max-h-[90vh] object-contain rounded-lg"
            />
          </div>
        </DialogContent>
      </Dialog>
    </>
  );
}
